from __future__ import annotations

import csv
import io

import geopandas as gpd
import pandas as pd
import psycopg

from etl.config import get_database_url


def load_all_to_neon(
    gdf_mun: gpd.GeoDataFrame,
    df_fato: pd.DataFrame,
    df_destinos: pd.DataFrame,
) -> None:
    """
    Realiza carga transacional em lote (COPY) das dimensões espaciais e tabelas
    fato no banco PostgreSQL + PostGIS no Neon.
    """
    db_url = get_database_url()
    print("[Neon PostGIS] Conectando para carga em lote...")

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "TRUNCATE TABLE agro_hidro.fato_destino_exportacao, "
                "agro_hidro.fato_anual_municipio, "
                "agro_hidro.dim_municipio, "
                "agro_hidro.meta_fontes RESTART IDENTITY CASCADE;"
            )

            # 1. Carga da dimensão espacial (via tabela temporária WKT -> GEOMETRY)
            cur.execute(
                """
                CREATE TEMP TABLE tmp_dim_mun (
                    cd_mun CHAR(7),
                    nm_mun VARCHAR(120),
                    sigla_uf CHAR(2),
                    nm_regiao VARCHAR(30),
                    bioma_predominante VARCHAR(40),
                    fl_amazonia BOOLEAN,
                    fl_cerrado BOOLEAN,
                    fl_matopiba BOOLEAN,
                    fl_arco_desmatamento BOOLEAN,
                    area_mun_km2 NUMERIC(12, 2),
                    wkt_geom TEXT
                ) ON COMMIT DROP;
                """
            )

            buf_mun = io.StringIO()
            writer_mun = csv.writer(buf_mun, delimiter="\t", lineterminator="\n")
            for _, r in gdf_mun.iterrows():
                writer_mun.writerow(
                    [
                        r["cd_mun"],
                        r["nm_mun"],
                        r["sigla_uf"],
                        r["nm_regiao"],
                        r["bioma_predominante"],
                        bool(r["fl_amazonia"]),
                        bool(r["fl_cerrado"]),
                        bool(r["fl_matopiba"]),
                        bool(r["fl_arco_desmatamento"]),
                        round(float(r["area_mun_km2"]), 2),
                        r["geometry"].wkt,
                    ]
                )
            buf_mun.seek(0)
            with cur.copy("COPY tmp_dim_mun FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t')") as copy:
                copy.write(buf_mun.read())

            cur.execute(
                """
                INSERT INTO agro_hidro.dim_municipio (
                    cd_mun, nm_mun, sigla_uf, nm_regiao, bioma_predominante,
                    fl_amazonia, fl_cerrado, fl_matopiba, fl_arco_desmatamento,
                    area_mun_km2, geom_simplificada, centroide
                )
                SELECT
                    cd_mun, nm_mun, sigla_uf, nm_regiao, bioma_predominante,
                    fl_amazonia, fl_cerrado, fl_matopiba, fl_arco_desmatamento,
                    area_mun_km2,
                    ST_Multi(ST_MakeValid(ST_GeomFromText(wkt_geom, 4674))),
                    ST_PointOnSurface(ST_MakeValid(ST_GeomFromText(wkt_geom, 4674)))
                FROM tmp_dim_mun;
                """
            )
            print(f"  -> dim_municipio carregada: {len(gdf_mun)} municípios.")

            # 2. Carga de fato_anual_municipio via COPY
            cols_fato = [
                "cd_mun", "ano", "prodes_incr_km2", "prodes_acum_km2",
                "soja_area_plantada_ha", "soja_producao_ton",
                "comex_soja_exp_ton", "comex_soja_fob_usd",
                "ana_irrig_retirada_m3s", "ana_irrig_consumo_m3s",
                "agua_irrig_hm3_ano", "agua_virtual_exp_hm3", "status_serie_ana",
            ]
            buf_fato = io.StringIO()
            df_fato[cols_fato].to_csv(buf_fato, sep="\t", index=False, header=False, lineterminator="\n")
            buf_fato.seek(0)
            with cur.copy(
                f"COPY agro_hidro.fato_anual_municipio ({', '.join(cols_fato)}) "
                "FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t')"
            ) as copy:
                copy.write(buf_fato.read())
            print(f"  -> fato_anual_municipio carregada: {len(df_fato)} linhas.")

            # 3. Carga de fato_destino_exportacao via COPY
            if not df_destinos.empty:
                cols_dest = [
                    "cd_mun", "ano", "co_pais", "nm_pais_pt",
                    "exp_soja_ton", "exp_fob_usd", "agua_virtual_hm3",
                ]
                buf_dest = io.StringIO()
                df_destinos[cols_dest].to_csv(
                    buf_dest, sep="\t", index=False, header=False, lineterminator="\n"
                )
                buf_dest.seek(0)
                with cur.copy(
                    f"COPY agro_hidro.fato_destino_exportacao ({', '.join(cols_dest)}) "
                    "FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t')"
                ) as copy:
                    copy.write(buf_dest.read())
                print(f"  -> fato_destino_exportacao carregada: {len(df_destinos)} fluxos.")

            # 4. Metadados de governança
            cur.executemany(
                """
                INSERT INTO agro_hidro.meta_fontes (
                    id_fonte, nm_instituicao, ds_base, url_referencia, periodo_coberto, notas_metodologicas
                ) VALUES (%s, %s, %s, %s, %s, %s);
                """,
                [
                    (
                        "prodes_inpe",
                        "INPE / TerraBrasilis",
                        "Incremento anual e acumulado de desmatamento municipal (PRODES Amazônia Floresta, Não-Floresta e Cerrado)",
                        "https://terrabrasilis.dpi.inpe.br/",
                        "2013–2024",
                        "Soma unificada das frentes de supressão de vegetação nativa em municípios de ecótono Amazônia-Cerrado.",
                    ),
                    (
                        "comex_mdic",
                        "MDIC / Comex Stat",
                        "Exportação municipal de Soja mesmo triturada (SH4 1201) por país de destino",
                        "https://comexstat.mdic.gov.br/pt/municipio",
                        "2013–2024",
                        "Reflete o domicílio fiscal da empresa exportadora remetente. Pareado com PAM/IBGE para validação física.",
                    ),
                    (
                        "pam_ibge",
                        "IBGE / SIDRA (PAM Tabela 5457)",
                        "Área plantada (ha) e quantidade produzida (t) de soja em grão por município",
                        "https://sidra.ibge.gov.br/tabela/5457",
                        "2013–2024",
                        "Produção agrícola municipal física, utilizada como contraponto territorial ao registro fiscal de exportação.",
                    ),
                    (
                        "snirh_ana",
                        "ANA / SNIRH",
                        "Manual de Usos Consuntivos da Água no Brasil — Vazão de retirada e consumo na Agricultura Irrigada",
                        "https://metadados.snirh.gov.br/geonetwork/srv/por/catalog.search#/metadata/5146c9ec-5589-4af1-bd64-d34848f484fd",
                        "2013–2024",
                        "Representa captação de água azul (superficial/subterrânea). Água virtual estimada por 2.050 m³/t exportada.",
                    ),
                ],
            )

            cur.execute("ANALYZE agro_hidro.dim_municipio;")
            cur.execute("ANALYZE agro_hidro.fato_anual_municipio;")
            cur.execute("ANALYZE agro_hidro.fato_destino_exportacao;")

        conn.commit()

    print("[Neon PostGIS] Carga concluída e estatísticas do otimizador atualizadas!")
