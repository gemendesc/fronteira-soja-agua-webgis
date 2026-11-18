export type EixoYKey = "pegada_soja" | "pam_ton" | "irrig_hm3" | "comex_ton";
export type RecorteKey = "todos" | "matopiba" | "arco" | "amazonia" | "cerrado";

export interface MunicipioSummary {
  cd_mun: string;
  nm_mun: string;
  sigla_uf: string;
  bioma_predominante: string;
  fl_matopiba: boolean;
  fl_arco_desmatamento: boolean;
  area_mun_km2: number;
  desmat_km2: number;
  desmat_acum_km2: number;
  comex_ton: number;
  comex_usd: number;
  pam_ton: number;
  pegada_soja_hm3: number;
  pam_area_max_ha: number;
  agua_virtual_hm3: number;
  irrig_hm3: number;
  irrig_m3s_media: number;
  y_value: number;
  biv_class: string;
}

export interface MapSummaryResponse {
  params: {
    recorte: RecorteKey;
    uf: string;
    anoIni: number;
    anoFim: number;
    desmatFim: number;
    respIni: number;
    lag: number;
    eixoY: EixoYKey;
  };
  thresholds: {
    x: [number, number];
    y: [number, number];
  };
  kpis: {
    total_municipios: number;
    mun_produtores_pam: number;
    mun_exportadores_comex: number;
    municipios_criticos_c3: number;
    desmat_total_km2: number;
    comex_total_ton: number;
    comex_total_usd: number;
    pam_total_ton: number;
    pegada_soja_total_hm3: number;
    agua_virtual_total_hm3: number;
    irrig_total_hm3: number;
  };
  correlation: {
    rho: number;
    pValue: number;
    n: number;
  };
  classCounts: Record<string, number>;
  topCountries: Array<{
    pais: string;
    exp_soja_ton: number;
    exp_fob_usd: number;
    agua_virtual_hm3: number;
  }>;
  regionalSeries: Array<{
    ano: number;
    desmat_km2: number;
    comex_mton: number;
    pam_mton: number;
    pegada_soja_hm3: number;
    agua_virtual_hm3: number;
    irrig_hm3: number;
  }>;
  municipalities: MunicipioSummary[];
}

export interface MunicipalityDetailResponse {
  municipio: {
    cd_mun: string;
    nm_mun: string;
    sigla_uf: string;
    nm_regiao: string;
    bioma_predominante: string;
    fl_amazonia: boolean;
    fl_cerrado: boolean;
    fl_matopiba: boolean;
    fl_arco_desmatamento: boolean;
    area_mun_km2: number;
    lon: number;
    lat: number;
  };
  series: Array<{
    ano: number;
    prodes_incr_km2: number;
    prodes_acum_km2: number;
    soja_area_plantada_ha: number;
    soja_producao_ton: number;
    comex_soja_exp_ton: number;
    comex_soja_fob_usd: number;
    ana_irrig_retirada_m3s: number;
    ana_irrig_consumo_m3s: number;
    agua_irrig_hm3_ano: number;
    agua_virtual_exp_hm3: number;
    status_serie_ana: string;
  }>;
  topDestinations: Array<{
    pais: string;
    exp_soja_ton: number;
    exp_fob_usd: number;
    agua_virtual_hm3: number;
  }>;
}
