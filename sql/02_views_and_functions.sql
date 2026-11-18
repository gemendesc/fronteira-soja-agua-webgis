-- ============================================================================
-- Views Analíticas e Funções Espaciais PostGIS (MVT / Correlação Bivariada)
-- ============================================================================

-- 1. View de Resumo Histórico Consolidado (2013–2024) por Município
CREATE OR REPLACE VIEW agro_hidro.vw_resumo_historico AS
SELECT
    d.cd_mun,
    d.nm_mun,
    d.sigla_uf,
    d.nm_regiao,
    d.bioma_predominante,
    d.fl_amazonia,
    d.fl_cerrado,
    d.fl_matopiba,
    d.fl_arco_desmatamento,
    d.area_mun_km2,
    COALESCE(SUM(f.prodes_incr_km2), 0)::NUMERIC(12, 2)        AS desmat_periodo_km2,
    COALESCE(MAX(f.prodes_acum_km2), 0)::NUMERIC(12, 2)        AS desmat_acum_total_km2,
    COALESCE(SUM(f.soja_producao_ton), 0)::NUMERIC(14, 2)      AS soja_prod_total_ton,
    COALESCE(MAX(f.soja_area_plantada_ha), 0)::NUMERIC(14, 2)  AS soja_area_max_ha,
    COALESCE(SUM(f.comex_soja_exp_ton), 0)::NUMERIC(14, 2)     AS soja_exp_total_ton,
    COALESCE(SUM(f.comex_soja_fob_usd), 0)::NUMERIC(16, 2)     AS soja_exp_total_usd,
    COALESCE(AVG(f.ana_irrig_retirada_m3s), 0)::NUMERIC(12, 4) AS irrig_retirada_media_m3s,
    COALESCE(MAX(f.ana_irrig_retirada_m3s), 0)::NUMERIC(12, 4) AS irrig_retirada_max_m3s,
    COALESCE(SUM(f.agua_irrig_hm3_ano), 0)::NUMERIC(14, 2)     AS agua_irrig_total_hm3,
    COALESCE(SUM(f.agua_virtual_exp_hm3), 0)::NUMERIC(14, 2)   AS agua_virtual_total_hm3
FROM agro_hidro.dim_municipio d
LEFT JOIN agro_hidro.fato_anual_municipio f
    ON f.cd_mun = d.cd_mun
GROUP BY
    d.cd_mun, d.nm_mun, d.sigla_uf, d.nm_regiao,
    d.bioma_predominante, d.fl_amazonia, d.fl_cerrado,
    d.fl_matopiba, d.fl_arco_desmatamento, d.area_mun_km2;

-- 2. Função Nativa PostGIS para Vector Tiles (MVT .pbf) em EPSG:3857
CREATE OR REPLACE FUNCTION agro_hidro.fn_mvt_municipios(
    z INTEGER,
    x INTEGER,
    y INTEGER
)
RETURNS BYTEA
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    WITH bounds AS (
        SELECT
            ST_TileEnvelope(z, x, y) AS env_3857,
            ST_Transform(ST_TileEnvelope(z, x, y), 4674) AS env_4674
    ),
    mvtgeom AS (
        SELECT
            d.cd_mun,
            d.nm_mun,
            d.sigla_uf,
            d.bioma_predominante,
            d.fl_matopiba,
            d.fl_arco_desmatamento,
            ST_AsMVTGeom(
                ST_Transform(d.geom_simplificada, 3857),
                bounds.env_3857,
                4096,
                256,
                true
            ) AS geom
        FROM agro_hidro.dim_municipio d
        CROSS JOIN bounds
        WHERE ST_Intersects(d.geom_simplificada, bounds.env_4674)
    )
    SELECT ST_AsMVT(mvtgeom.*, 'municipios', 4096, 'geom')
    FROM mvtgeom
    WHERE geom IS NOT NULL;
$$;
