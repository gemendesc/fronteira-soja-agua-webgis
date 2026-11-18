-- ============================================================================
-- Projeto: fronteira-soja-agua-webgis
-- Banco: PostgreSQL 16+ com PostGIS (Neon Serverless)
-- Descrição: Schema espacial e analítico para correlação entre desmatamento
--            (PRODES/INPE), soja (Comex Stat/PAM-IBGE) e água (SNIRH/ANA).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS agro_hidro;

-- 1. Dimensão Espacial de Municípios (SIRGAS 2000 - EPSG:4674)
CREATE TABLE IF NOT EXISTS agro_hidro.dim_municipio (
    cd_mun               CHAR(7) PRIMARY KEY,
    nm_mun               VARCHAR(120) NOT NULL,
    sigla_uf             CHAR(2) NOT NULL,
    nm_regiao            VARCHAR(30) NOT NULL,
    bioma_predominante   VARCHAR(40) NOT NULL,
    fl_amazonia          BOOLEAN NOT NULL DEFAULT FALSE,
    fl_cerrado           BOOLEAN NOT NULL DEFAULT FALSE,
    fl_matopiba          BOOLEAN NOT NULL DEFAULT FALSE,
    fl_arco_desmatamento BOOLEAN NOT NULL DEFAULT FALSE,
    area_mun_km2         NUMERIC(12, 2),
    geom_simplificada    GEOMETRY(MultiPolygon, 4674) NOT NULL,
    centroide            GEOMETRY(Point, 4674) NOT NULL,
    atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dim_municipio_geom
    ON agro_hidro.dim_municipio USING GIST (geom_simplificada);

CREATE INDEX IF NOT EXISTS idx_dim_municipio_centroide
    ON agro_hidro.dim_municipio USING GIST (centroide);

CREATE INDEX IF NOT EXISTS idx_dim_municipio_filtros
    ON agro_hidro.dim_municipio (sigla_uf, bioma_predominante, fl_matopiba, fl_arco_desmatamento);

-- 2. Fato Anual Integrado por Município (2013–2024)
CREATE TABLE IF NOT EXISTS agro_hidro.fato_anual_municipio (
    cd_mun                  CHAR(7) NOT NULL REFERENCES agro_hidro.dim_municipio(cd_mun) ON DELETE CASCADE,
    ano                     SMALLINT NOT NULL CHECK (ano BETWEEN 2000 AND 2035),
    prodes_incr_km2         NUMERIC(12, 3) NOT NULL DEFAULT 0,
    prodes_acum_km2         NUMERIC(12, 3) NOT NULL DEFAULT 0,
    soja_area_plantada_ha   NUMERIC(14, 2) NOT NULL DEFAULT 0,
    soja_producao_ton       NUMERIC(14, 2) NOT NULL DEFAULT 0,
    comex_soja_exp_ton      NUMERIC(14, 2) NOT NULL DEFAULT 0,
    comex_soja_fob_usd      NUMERIC(16, 2) NOT NULL DEFAULT 0,
    ana_irrig_retirada_m3s  NUMERIC(12, 5) NOT NULL DEFAULT 0,
    ana_irrig_consumo_m3s   NUMERIC(12, 5) NOT NULL DEFAULT 0,
    agua_irrig_hm3_ano      NUMERIC(14, 4) NOT NULL DEFAULT 0,
    agua_virtual_exp_hm3    NUMERIC(14, 4) NOT NULL DEFAULT 0,
    status_serie_ana        VARCHAR(20) NOT NULL DEFAULT 'observado',
    PRIMARY KEY (cd_mun, ano)
);

CREATE INDEX IF NOT EXISTS idx_fato_anual_ano
    ON agro_hidro.fato_anual_municipio (ano, cd_mun);

-- 3. Fato de Destinos Internacionais da Soja e Água Virtual (Comex Stat)
CREATE TABLE IF NOT EXISTS agro_hidro.fato_destino_exportacao (
    cd_mun            CHAR(7) NOT NULL REFERENCES agro_hidro.dim_municipio(cd_mun) ON DELETE CASCADE,
    ano               SMALLINT NOT NULL CHECK (ano BETWEEN 2000 AND 2035),
    co_pais           VARCHAR(6) NOT NULL,
    nm_pais_pt        VARCHAR(100) NOT NULL,
    exp_soja_ton      NUMERIC(14, 2) NOT NULL DEFAULT 0,
    exp_fob_usd       NUMERIC(16, 2) NOT NULL DEFAULT 0,
    agua_virtual_hm3  NUMERIC(14, 4) NOT NULL DEFAULT 0,
    PRIMARY KEY (cd_mun, ano, co_pais)
);

CREATE INDEX IF NOT EXISTS idx_fato_destino_mun_ano
    ON agro_hidro.fato_destino_exportacao (cd_mun, ano);

-- 4. Metadados de Governança e Execução do ETL
CREATE TABLE IF NOT EXISTS agro_hidro.meta_fontes (
    id_fonte          VARCHAR(40) PRIMARY KEY,
    nm_instituicao    VARCHAR(100) NOT NULL,
    ds_base           TEXT NOT NULL,
    url_referencia    TEXT NOT NULL,
    periodo_coberto   VARCHAR(30) NOT NULL,
    notas_metodologicas TEXT,
    ultima_carga_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
