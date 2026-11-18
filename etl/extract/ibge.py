from __future__ import annotations

import time

import geopandas as gpd
import httpx
import pandas as pd
from shapely.geometry import MultiPolygon, Polygon

from etl.config import ANO_FIM, ANO_INICIO, DATA_RAW_DIR

# UFs que possuem municípios nos biomas Amazônia ou Cerrado
UFS_ALVO = {
    11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO",
    21: "MA", 22: "PI", 29: "BA",
    31: "MG", 35: "SP",
    41: "PR",
    50: "MS", 51: "MT", 52: "GO", 53: "DF",
}

UFS_ARCO_CANDIDATAS = {"RO", "AC", "AM", "PA", "MT", "TO", "MA"}


def _ensure_multipolygon(geom):
    if geom is None or geom.is_empty:
        return geom
    if isinstance(geom, Polygon):
        return MultiPolygon([geom])
    if isinstance(geom, MultiPolygon):
        return geom
    polys = [g for g in getattr(geom, "geoms", []) if isinstance(g, (Polygon, MultiPolygon))]
    flat = []
    for p in polys:
        if isinstance(p, Polygon):
            flat.append(p)
        else:
            flat.extend(list(p.geoms))
    return MultiPolygon(flat) if flat else geom


def fetch_municipios_biomas() -> gpd.GeoDataFrame:
    """
    Extrai a relação oficial de municípios dos biomas Amazônia e Cerrado via WFS
    OGC do TerraBrasilis/INPE, combina com metadados de localidades (IBGE v1) e
    geometrias municipais (IBGE Malhas v3) padronizadas em SIRGAS 2000 (EPSG:4674).
    """
    cache_file = DATA_RAW_DIR / "ibge_municipios_amazonia_cerrado.gpkg"
    if cache_file.exists():
        print(f"[IBGE + WFS] Lendo malha municipal em cache: {cache_file.name}")
        return gpd.read_file(cache_file)

    print("[IBGE + TerraBrasilis WFS] Consultando municípios oficiais de Amazônia e Cerrado...")
    headers = {"Accept": "application/json", "User-Agent": "fronteira-soja-agua-etl/1.0"}
    with httpx.Client(timeout=90.0, verify=False, headers=headers, follow_redirects=True) as client:
        # 1. Lista oficial WFS de geocódigos municipais nos biomas Amazônia e Cerrado
        r_amz = client.get(
            "https://terrabrasilis.dpi.inpe.br/geoserver/wfs",
            params={
                "service": "WFS",
                "version": "1.0.0",
                "request": "GetFeature",
                "typeName": "prodes-amazon-nb:municipalities_amazon_biome",
                "propertyName": "geocodigo",
                "outputFormat": "application/json",
            },
        )
        r_amz.raise_for_status()
        set_amz = {
            str(f["properties"]["geocodigo"]).strip().zfill(7)
            for f in r_amz.json().get("features", [])
            if f.get("properties", {}).get("geocodigo")
        }

        r_cer = client.get(
            "https://terrabrasilis.dpi.inpe.br/geoserver/wfs",
            params={
                "service": "WFS",
                "version": "1.0.0",
                "request": "GetFeature",
                "typeName": "prodes-cerrado-nb:municipalities_cerrado_biome",
                "propertyName": "geocodigo",
                "outputFormat": "application/json",
            },
        )
        r_cer.raise_for_status()
        set_cer = {
            str(f["properties"]["geocodigo"]).strip().zfill(7)
            for f in r_cer.json().get("features", [])
            if f.get("properties", {}).get("geocodigo")
        }

        target_codes = set_amz | set_cer
        print(
            f"  -> WFS INPE: Amazônia={len(set_amz)} mun. | Cerrado={len(set_cer)} mun. | União={len(target_codes)} mun."
        )

        # 2. Localidades IBGE v1
        loc_resp = client.get("https://servicodados.ibge.gov.br/api/v1/localidades/municipios")
        loc_resp.raise_for_status()
        meta_rows = []
        for item in loc_resp.json():
            cd_mun = str(item["id"]).zfill(7)
            if cd_mun not in target_codes:
                continue
            nm_mun = item["nome"]
            uf_obj = (
                (item.get("regiao-imediata") or {})
                .get("regiao-intermediaria", {})
                .get("UF")
            ) or (
                (item.get("microrregiao") or {})
                .get("mesorregiao", {})
                .get("UF")
            )
            if not uf_obj:
                continue
            meta_rows.append(
                {
                    "cd_mun": cd_mun,
                    "nm_mun": nm_mun,
                    "sigla_uf": uf_obj["sigla"],
                    "nm_regiao": uf_obj["regiao"]["nome"],
                }
            )
        df_meta = pd.DataFrame(meta_rows).drop_duplicates("cd_mun")

        # 3. Malha municipal IBGE v3 por UF (qualidade=minima: geometria leve e fiel para WebGIS)
        features_all = []
        for uf_id, sigla in UFS_ALVO.items():
            r = client.get(
                f"https://servicodados.ibge.gov.br/api/v3/malhas/estados/{uf_id}",
                params={
                    "intrarregiao": "municipio",
                    "qualidade": "minima",
                    "formato": "application/vnd.geo+json",
                },
            )
            r.raise_for_status()
            for feat in r.json().get("features", []):
                cod = str(feat.get("properties", {}).get("codarea", "")).zfill(7)
                if cod in target_codes:
                    features_all.append(feat)
            print(f"  -> Malha IBGE carregada: {sigla}")
            time.sleep(0.08)

    gdf_mun = gpd.GeoDataFrame.from_features(features_all, crs="EPSG:4674")
    gdf_mun["cd_mun"] = gdf_mun["codarea"].astype(str).str.zfill(7)
    gdf_mun["geometry"] = gdf_mun.geometry.make_valid().apply(_ensure_multipolygon)

    # Área municipal oficial calculada em SIRGAS 2000 / Brazil Polyconic (EPSG:5880)
    gdf_5880 = gdf_mun.to_crs("EPSG:5880")
    gdf_mun["area_mun_km2"] = (gdf_5880.geometry.area / 1e6).round(2)

    gdf_mun = gdf_mun.merge(df_meta, on="cd_mun", how="inner")
    gdf_mun["fl_amazonia"] = gdf_mun["cd_mun"].isin(set_amz)
    gdf_mun["fl_cerrado"] = gdf_mun["cd_mun"].isin(set_cer)

    # Em municípios de transição/ecótono (presentes em ambos), rotula conforme região/UF predominante
    def _pick_bioma(row) -> str:
        if row["fl_amazonia"] and not row["fl_cerrado"]:
            return "Amazônia"
        if row["fl_cerrado"] and not row["fl_amazonia"]:
            return "Cerrado"
        return "Amazônia / Cerrado (Ecótono)"

    gdf_mun["bioma_predominante"] = gdf_mun.apply(_pick_bioma, axis=1)

    # MATOPIBA: municípios do bioma Cerrado situados em MA, TO, PI e BA
    gdf_mun["fl_matopiba"] = gdf_mun["fl_cerrado"] & gdf_mun["sigla_uf"].isin({"MA", "TO", "PI", "BA"})

    cols = [
        "cd_mun", "nm_mun", "sigla_uf", "nm_regiao",
        "bioma_predominante", "fl_amazonia", "fl_cerrado",
        "fl_matopiba", "area_mun_km2", "geometry",
    ]
    gdf_out = gdf_mun[cols].drop_duplicates("cd_mun").reset_index(drop=True)
    gdf_out.to_file(cache_file, driver="GPKG")
    print(f"[IBGE + WFS] {len(gdf_out)} municípios consolidados e salvos em {cache_file.name}.")
    return gdf_out


def fetch_pam_soja(valid_cd_muns: set[str]) -> pd.DataFrame:
    """
    Extrai Área Plantada (ha, var 8331) e Quantidade Produzida (ton, var 214)
    de Soja em Grão (c782=40124) da Pesquisa Agrícola Municipal (SIDRA 5457)
    por UF e janela de anos.
    """
    cache_csv = DATA_RAW_DIR / "ibge_pam_soja_2013_2024.csv"
    if cache_csv.exists():
        print(f"[SIDRA/PAM] Lendo produção de soja em cache: {cache_csv.name}")
        return pd.read_csv(cache_csv, dtype={"cd_mun": str})

    print("[SIDRA/PAM] Consultando API SIDRA Tabela 5457 (Soja em grão)...")
    anos_blocos = [
        ",".join(str(y) for y in range(ANO_INICIO, 2019)),
        ",".join(str(y) for y in range(2019, ANO_FIM + 1)),
    ]
    records = []
    with httpx.Client(timeout=90.0, verify=False, follow_redirects=True) as client:
        for uf_id, sigla in UFS_ALVO.items():
            for anos_str in anos_blocos:
                url = (
                    f"https://apisidra.ibge.gov.br/values/t/5457"
                    f"/n6/in%20n3%20{uf_id}/v/8331,214/p/{anos_str}/c782/40124?formato=json"
                )
                r = client.get(url)
                if r.status_code != 200:
                    continue
                data = r.json()
                for row in data[1:]:
                    cd_mun = str(row.get("D1C", "")).zfill(7)
                    if cd_mun not in valid_cd_muns:
                        continue
                    ano_raw = str(row.get("D3C", ""))
                    if not ano_raw.isdigit():
                        continue
                    var_code = str(row.get("D2C", ""))
                    val_str = str(row.get("V", "0")).strip()
                    val = float(val_str) if val_str.replace(".", "", 1).isdigit() else 0.0
                    records.append(
                        {
                            "cd_mun": cd_mun,
                            "ano": int(ano_raw),
                            "var_code": var_code,
                            "valor": val,
                        }
                    )
            print(f"  -> PAM Soja processada: {sigla}")

    if not records:
        return pd.DataFrame(columns=["cd_mun", "ano", "soja_area_plantada_ha", "soja_producao_ton"])

    df_raw = pd.DataFrame(records)
    df_piv = (
        df_raw.pivot_table(index=["cd_mun", "ano"], columns="var_code", values="valor", aggfunc="sum")
        .reset_index()
    )
    df_piv["soja_area_plantada_ha"] = df_piv.get("8331", 0.0).fillna(0.0)
    df_piv["soja_producao_ton"] = df_piv.get("214", 0.0).fillna(0.0)
    df_out = df_piv[["cd_mun", "ano", "soja_area_plantada_ha", "soja_producao_ton"]]
    df_out.to_csv(cache_csv, index=False)
    print(f"[SIDRA/PAM] {len(df_out)} registros anuais municipais de soja salvos.")
    return df_out
