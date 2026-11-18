from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
from scipy.stats import spearmanr

from etl.config import ANO_FIM, ANO_INICIO
from etl.extract.comexstat import fetch_comex_soja
from etl.extract.ibge import UFS_ARCO_CANDIDATAS, fetch_municipios_biomas, fetch_pam_soja
from etl.extract.snirh_ana import fetch_snirh_irrigacao
from etl.extract.terrabrasilis import fetch_prodes_municipal
from etl.load.init_db import init_database
from etl.load.load_neon import load_all_to_neon


def main() -> None:
    print("=" * 72)
    print(" PIPELINE ETL — FRONTEIRA SOJA, DESMATAMENTO E ÁGUA VIRTUAL (2013–2024)")
    print("=" * 72)

    # 1. Garante schema e views no Neon PostGIS
    init_database()

    # 2. Extrai base territorial municipal e recorte Amazônia + Cerrado
    gdf_mun = fetch_municipios_biomas()
    valid_muns = set(gdf_mun["cd_mun"].astype(str))

    # 3. Extrai séries oficiais
    df_prodes = fetch_prodes_municipal(valid_muns)
    df_pam = fetch_pam_soja(valid_muns)
    df_comex_anual, df_comex_dest = fetch_comex_soja(gdf_mun)
    df_ana = fetch_snirh_irrigacao(valid_muns)

    # 4. Classifica Arco do Desmatamento (municípios amazônicos nas UFs da borda sul/leste
    #    com pressão relevante de supressão histórica >= 150 km² acumulados ou >= 30 km² no período)
    prodes_resumo = (
        df_prodes.groupby("cd_mun", as_index=False)
        .agg(incr_tot=("prodes_incr_km2", "sum"), acum_max=("prodes_acum_km2", "max"))
    )
    gdf_mun = gdf_mun.merge(prodes_resumo, on="cd_mun", how="left")
    gdf_mun["fl_arco_desmatamento"] = (
        gdf_mun["fl_amazonia"]
        & gdf_mun["sigla_uf"].isin(UFS_ARCO_CANDIDATAS)
        & ((gdf_mun["acum_max"].fillna(0) >= 150.0) | (gdf_mun["incr_tot"].fillna(0) >= 30.0))
    )
    gdf_mun = gdf_mun.drop(columns=["incr_tot", "acum_max"])

    # 5. Constrói grade painel balanceada (município x ano)
    anos = list(range(ANO_INICIO, ANO_FIM + 1))
    df_painel = pd.MultiIndex.from_product(
        [sorted(valid_muns), anos], names=["cd_mun", "ano"]
    ).to_frame(index=False)

    df_painel = (
        df_painel.merge(df_prodes, on=["cd_mun", "ano"], how="left")
        .merge(df_pam, on=["cd_mun", "ano"], how="left")
        .merge(df_comex_anual, on=["cd_mun", "ano"], how="left")
        .merge(df_ana, on=["cd_mun", "ano"], how="left")
    )

    num_cols = [
        "prodes_incr_km2", "prodes_acum_km2",
        "soja_area_plantada_ha", "soja_producao_ton",
        "comex_soja_exp_ton", "comex_soja_fob_usd",
        "ana_irrig_retirada_m3s", "ana_irrig_consumo_m3s",
        "agua_irrig_hm3_ano", "agua_virtual_exp_hm3",
    ]
    for c in num_cols:
        df_painel[c] = df_painel[c].fillna(0.0)

    df_painel["status_serie_ana"] = df_painel.apply(
        lambda r: r["status_serie_ana"]
        if isinstance(r["status_serie_ana"], str) and r["status_serie_ana"]
        else ("observado" if int(r["ano"]) <= 2020 else "estimado"),
        axis=1,
    )

    # 6. Diagnóstico estatístico rápido da hipótese antes da carga
    resumo_mun = df_painel.groupby("cd_mun", as_index=False).agg(
        desmat_periodo=("prodes_incr_km2", "sum"),
        exp_ton=("comex_soja_exp_ton", "sum"),
        prod_ton=("soja_producao_ton", "sum"),
        irrig_hm3=("agua_irrig_hm3_ano", "sum"),
    )
    ativos = resumo_mun[(resumo_mun["exp_ton"] > 0) | (resumo_mun["prod_ton"] > 0)]
    rho_exp, p_exp = spearmanr(ativos["desmat_periodo"], ativos["exp_ton"])
    rho_prod, p_prod = spearmanr(ativos["desmat_periodo"], ativos["prod_ton"])
    print(
        f"[Diagnóstico Hipótese] Municípios com atividade de soja={len(ativos)} | "
        f"Spearman(Desmat x Exportação Soja)={rho_exp:.3f} (p={p_exp:.2e}) | "
        f"Spearman(Desmat x Produção PAM)={rho_prod:.3f} (p={p_prod:.2e})"
    )

    # 7. Carrega tudo no Neon PostGIS
    load_all_to_neon(gdf_mun, df_painel, df_comex_dest)


if __name__ == "__main__":
    main()
