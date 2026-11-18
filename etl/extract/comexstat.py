from __future__ import annotations

import hashlib
import io
import time
import unicodedata

import httpx
import pandas as pd

from etl.config import (
    ANO_FIM,
    ANO_INICIO,
    DATA_RAW_DIR,
    SOJA_WATER_FOOTPRINT_M3_PER_TON,
)


def _norm_key(text: str) -> str:
    txt = unicodedata.normalize("NFKD", str(text))
    txt = "".join(ch for ch in txt if not unicodedata.combining(ch))
    return " ".join(txt.lower().strip().split())


def _build_city_lookup(gdf_mun: pd.DataFrame, client: httpx.Client) -> dict[str, str]:
    lookup: dict[str, str] = {}

    # 1. Tabela auxiliar oficial do MDIC (UF_MUN.csv)
    r_ufm = client.get("https://balanca.economia.gov.br/balanca/bd/tabelas/UF_MUN.csv")
    r_ufm.raise_for_status()
    df_ufm = pd.read_csv(io.StringIO(r_ufm.content.decode("latin1")), sep=";", dtype=str)
    for _, row in df_ufm.iterrows():
        co_geo = str(row.get("CO_MUN_GEO", "")).strip().zfill(7)
        no_min = str(row.get("NO_MUN_MIN", "")).strip()
        no_maj = str(row.get("NO_MUN", "")).strip()
        sg_uf = str(row.get("SG_UF", "")).strip()
        if len(co_geo) == 7 and sg_uf:
            lookup[_norm_key(f"{no_min} - {sg_uf}")] = co_geo
            lookup[_norm_key(f"{no_maj} - {sg_uf}")] = co_geo

    # 2. Complemento direto pela tabela oficial de localidades do IBGE
    for _, row in gdf_mun[["cd_mun", "nm_mun", "sigla_uf"]].iterrows():
        cd = str(row["cd_mun"]).zfill(7)
        lookup[_norm_key(f"{row['nm_mun']} - {row['sigla_uf']}")] = cd

    return lookup


def fetch_comex_soja(gdf_mun: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Extrai exportações municipais de Soja em Grão (SH4 1201) da API oficial
    do Comex Stat (MDIC) para 2013–2024, incluindo países de destino e cálculo
    de Água Virtual embarcada (hm³).
    """
    cache_anual = DATA_RAW_DIR / "comex_soja_anual_2013_2024.csv"
    cache_dest = DATA_RAW_DIR / "comex_soja_destinos_2013_2024.csv"

    if cache_anual.exists() and cache_dest.exists():
        print("[Comex Stat] Lendo exportações e destinos em cache...")
        return (
            pd.read_csv(cache_anual, dtype={"cd_mun": str}),
            pd.read_csv(cache_dest, dtype={"cd_mun": str, "co_pais": str}),
        )

    valid_muns = set(gdf_mun["cd_mun"].astype(str))
    rows_dest = []

    with httpx.Client(
        timeout=90.0,
        verify=False,
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
    ) as client:
        city_lookup = _build_city_lookup(gdf_mun, client)

        for ano in range(ANO_INICIO, ANO_FIM + 1):
            print(f"[Comex Stat] Consultando exportações municipais SH4 1201 ({ano})...")
            payload = {
                "flow": "export",
                "monthDetail": False,
                "period": {"from": f"{ano}-01", "to": f"{ano}-12"},
                "filters": [{"filter": "heading", "values": ["1201"]}],
                "details": ["city", "country"],
                "metrics": ["metricFOB", "metricKG"],
                "language": "pt",
            }

            items = []
            for attempt in range(4):
                resp = client.post("https://api-comexstat.mdic.gov.br/cities", json=payload)
                if resp.status_code == 200:
                    body = resp.json() or {}
                    items = (body.get("data") or {}).get("list") or []
                    break
                time.sleep(1.5 * (attempt + 1))

            for it in items:
                city_label = it.get("noMunMinsgUf") or ""
                cd_mun = city_lookup.get(_norm_key(city_label))
                if not cd_mun or cd_mun not in valid_muns:
                    continue

                country = str(it.get("country") or "Não informado").strip()
                kg = float(it.get("metricKG") or 0.0)
                fob = float(it.get("metricFOB") or 0.0)
                if kg <= 0 and fob <= 0:
                    continue

                ton = kg / 1000.0
                agua_virt_hm3 = (ton * SOJA_WATER_FOOTPRINT_M3_PER_TON) / 1_000_000.0
                co_pais = hashlib.md5(_norm_key(country).encode("utf-8")).hexdigest()[:6].upper()

                rows_dest.append(
                    {
                        "cd_mun": cd_mun,
                        "ano": ano,
                        "co_pais": co_pais,
                        "nm_pais_pt": country,
                        "exp_soja_ton": round(ton, 2),
                        "exp_fob_usd": round(fob, 2),
                        "agua_virtual_hm3": round(agua_virt_hm3, 4),
                    }
                )
            time.sleep(0.5)

    df_dest = pd.DataFrame(rows_dest)
    if df_dest.empty:
        df_anual = pd.DataFrame(
            columns=["cd_mun", "ano", "comex_soja_exp_ton", "comex_soja_fob_usd", "agua_virtual_exp_hm3"]
        )
        return df_anual, df_dest

    df_dest = (
        df_dest.groupby(["cd_mun", "ano", "co_pais", "nm_pais_pt"], as_index=False)[
            ["exp_soja_ton", "exp_fob_usd", "agua_virtual_hm3"]
        ]
        .sum()
    )

    df_anual = (
        df_dest.groupby(["cd_mun", "ano"], as_index=False)
        .agg(
            comex_soja_exp_ton=("exp_soja_ton", "sum"),
            comex_soja_fob_usd=("exp_fob_usd", "sum"),
            agua_virtual_exp_hm3=("agua_virtual_hm3", "sum"),
        )
    )

    df_anual.to_csv(cache_anual, index=False)
    df_dest.to_csv(cache_dest, index=False)
    print(
        f"[Comex Stat] {len(df_anual)} registros anuais e {len(df_dest)} fluxos por país salvos."
    )
    return df_anual, df_dest
