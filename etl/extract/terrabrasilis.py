from __future__ import annotations

import httpx
import pandas as pd

from etl.config import ANO_FIM, ANO_INICIO, DATA_RAW_DIR

TERRABRASILIS_BASE = "https://terrabrasilis.dpi.inpe.br/app/prodes/dashboard/deforestation/files"
PRODES_SOURCES = [
    ("prodes_amazon", "Amazônia (Floresta)"),
    ("prodes_amazon_nf", "Amazônia (Não-Floresta)"),
    ("prodes_cerrado", "Cerrado"),
]


def fetch_prodes_municipal(valid_cd_muns: set[str]) -> pd.DataFrame:
    """
    Extrai incrementos anuais e acumulado histórico de supressão de vegetação
    nativa por município (codibge) diretamente da API de dados do painel oficial
    TerraBrasilis / INPE (PRODES Amazônia Floresta, Amazônia Não-Floresta e Cerrado).
    """
    cache_csv = DATA_RAW_DIR / "inpe_prodes_municipal_2013_2024.csv"
    if cache_csv.exists():
        print(f"[TerraBrasilis/INPE] Lendo PRODES municipal em cache: {cache_csv.name}")
        return pd.read_csv(cache_csv, dtype={"cd_mun": str})

    rows = []
    with httpx.Client(
        timeout=90.0,
        verify=False,
        follow_redirects=True,
        headers={"User-Agent": "fronteira-soja-agua-etl/1.0"},
    ) as client:
        for source_key, label in PRODES_SOURCES:
            print(f"[TerraBrasilis/INPE] Baixando série municipal {label} ({source_key})...")
            r_loi = client.get(f"{TERRABRASILIS_BASE}/config/loinames/{source_key}.json")
            r_loi.raise_for_status()
            lois = r_loi.json().get("lois", [])

            mun_loi_gid = None
            gid_to_ibge: dict[int, str] = {}
            for loi in lois:
                if loi.get("name") == "mun":
                    mun_loi_gid = int(loi["gid"])
                    for item in loi.get("loinames", []):
                        cod = item.get("codibge")
                        if cod is not None:
                            cd_mun = str(int(cod)).zfill(7)
                            if cd_mun in valid_cd_muns:
                                gid_to_ibge[int(item["gid"])] = cd_mun
                    break

            if mun_loi_gid is None or not gid_to_ibge:
                continue

            r_data = client.get(f"{TERRABRASILIS_BASE}/data/{source_key}.json")
            r_data.raise_for_status()
            periods = r_data.json().get("periods", [])

            for period in periods:
                ano_ref = int(period["endDate"]["year"])
                for feat in period.get("features", []):
                    if int(feat.get("loi", -1)) != mun_loi_gid:
                        continue
                    cd_mun = gid_to_ibge.get(int(feat["loiname"]))
                    if not cd_mun:
                        continue
                    area_km2 = sum(float(a.get("area", 0.0)) for a in feat.get("areas", []))
                    if area_km2 > 0:
                        rows.append(
                            {
                                "cd_mun": cd_mun,
                                "ano": ano_ref,
                                "area_km2": area_km2,
                            }
                        )

    df_all = pd.DataFrame(rows)
    if df_all.empty:
        return pd.DataFrame(columns=["cd_mun", "ano", "prodes_incr_km2", "prodes_acum_km2"])

    # Consolida soma anual por município (incluindo municípios em ecótono Amazônia-Cerrado)
    df_grp = df_all.groupby(["cd_mun", "ano"], as_index=False)["area_km2"].sum()

    # Cria grade completa de anos desde o início da série disponível até ANO_FIM para acumulado fiel
    min_ano = min(int(df_grp["ano"].min()), ANO_INICIO)
    all_years = list(range(min_ano, ANO_FIM + 1))
    grid = pd.MultiIndex.from_product(
        [sorted(valid_cd_muns), all_years], names=["cd_mun", "ano"]
    ).to_frame(index=False)

    df_full = grid.merge(df_grp, on=["cd_mun", "ano"], how="left")
    df_full["prodes_incr_km2"] = df_full["area_km2"].fillna(0.0)
    df_full = df_full.sort_values(["cd_mun", "ano"])
    df_full["prodes_acum_km2"] = df_full.groupby("cd_mun")["prodes_incr_km2"].cumsum()

    df_out = df_full[
        (df_full["ano"] >= ANO_INICIO) & (df_full["ano"] <= ANO_FIM)
    ][["cd_mun", "ano", "prodes_incr_km2", "prodes_acum_km2"]].copy()

    df_out["prodes_incr_km2"] = df_out["prodes_incr_km2"].round(3)
    df_out["prodes_acum_km2"] = df_out["prodes_acum_km2"].round(3)
    df_out.to_csv(cache_csv, index=False)
    print(f"[TerraBrasilis/INPE] {len(df_out)} registros municipais anuais do PRODES consolidados.")
    return df_out
