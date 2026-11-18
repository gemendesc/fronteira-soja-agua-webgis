import type { EixoYKey, RecorteKey } from "./types";

/**
 * Paleta Cartográfica Bivariada 3x3 (inspirada em Joshua Stevens / Atlas Editorial Suíço)
 * Calibrada para fundo claro de papel técnico (#eceeeb):
 * - Eixo X (1 -> 3): Supressão PRODES (km²) — Neutro -> Ocre -> Terracota (#d9532f)
 * - Eixo Y (A -> C): Soja / Pegada Hídrica — Neutro -> Azul-Aço -> Azul-Petróleo (#24506b)
 * - Convergência Crítica C3 (Alto X + Alto Y): Bordô-Ameixa Escuro (#56162e)
 */
export const BIVARIATE_COLORS: Record<string, string> = {
  A1: "#dfe3de",
  A2: "#de9d7e",
  A3: "#d9532f",
  B1: "#82abc0",
  B2: "#8e7d8a",
  B3: "#a74143",
  C1: "#24506b",
  C2: "#503e67",
  C3: "#56162e",
};

export const BIVARIATE_LABELS: Record<string, string> = {
  A1: "Baixo desmatamento · Baixa pressão de soja/água",
  A2: "Médio desmatamento · Baixa pressão de soja/água",
  A3: "Alto desmatamento · Fronteira sem soja consolidada",
  B1: "Baixo desmatamento · Média pressão de soja/água",
  B2: "Transição intermediária nos dois eixos",
  B3: "Alto desmatamento · Média pressão de soja/água",
  C1: "Polo agrícola consolidado (baixo desmatamento pós-2013)",
  C2: "Médio desmatamento · Alta pressão de soja/água",
  C3: "Convergência crítica: Alto desmatamento + Alta soja/água",
};

export const EIXO_Y_META: Record<
  EixoYKey,
  {
    label: string;
    shortLabel: string;
    unit: string;
    source: string;
    contextNote: string;
  }
> = {
  pegada_soja: {
    label: "Pegada Hídrica da Soja Colhida (PAM/IBGE)",
    shortLabel: "Pegada Hídrica",
    unit: "hm³",
    source: "PAM/IBGE (Tabela 5457) × 2.050 m³/t",
    contextNote:
      "Calculada sobre a produção física colhida em cada município (1.222 municípios produtores), eliminando a distorção fiscal das sedes de tradings. Inclui água verde (chuva/umidade do solo) e água azul.",
  },
  pam_ton: {
    label: "Produção Física de Soja no Município (PAM/IBGE)",
    shortLabel: "Soja Colhida",
    unit: "t",
    source: "IBGE / SIDRA — Pesquisa Agrícola Municipal",
    contextNote:
      "Mede onde o grão efetivamente ocupou o solo e foi colhido (1.222 municípios com produção registrada no recorte), independentemente de qual cidade emitiu a nota de exportação.",
  },
  irrig_hm3: {
    label: "Retirada de Água Azul para Irrigação (SNIRH/ANA)",
    shortLabel: "Irrigação ANA",
    unit: "hm³",
    source: "ANA — Manual de Usos Consuntivos da Água",
    contextNote:
      "Mede o bombeamento direto de rios e aquíferos para agricultura irrigada (todas as culturas). Evidencia polos de estresse hídrico por pivôs centrais, como o Oeste da Bahia (Aquífero Urucuia), Cristalina (GO) e Paracatu/Unaí (MG).",
  },
  comex_ton: {
    label: "Exportação Fiscal Declarada (Comex Stat — 312 polos)",
    shortLabel: "Exportação Fiscal",
    unit: "t",
    source: "MDIC / Comex Stat (SH4 1201 — Domicílio Fiscal)",
    contextNote:
      "Atenção metodológica: registra o domicílio fiscal da empresa exportadora, não a fazenda de origem. Por isso, 934 municípios que plantam soja aparecem zerados aqui, enquanto polos de tradings (como Balsas-MA e Rio Verde-GO) concentram a carga regional.",
  },
};

export const RECORTE_META: Record<
  RecorteKey,
  { label: string; bounds: [[number, number], [number, number]]; summaryNote: string }
> = {
  todos: {
    label: "Amazônia + Cerrado (1.873 municípios)",
    bounds: [[-73.9, -24.7], [-41.0, 5.3]],
    summaryNote:
      "Visão conjunta dos dois biomas que concentram a expansão agropecuária brasileira contemporânea.",
  },
  matopiba: {
    label: "Fronteira MATOPIBA (MA · TO · PI · BA)",
    bounds: [[-50.9, -15.6], [-41.3, -2.2]],
    summaryNote:
      "Principal fronteira ativa do Cerrado: apresenta o maior acoplamento estatístico entre supressão recente de vegetação nativa e avanço da soja.",
  },
  arco: {
    label: "Arco do Desmatamento Amazônico",
    bounds: [[-66.8, -14.5], [-44.0, -1.5]],
    summaryNote:
      "Franja sul e leste do bioma Amazônia (RO, MT, PA, TO, MA, AC, AM), onde abertura de pastagens e consolidação mecanizada de grãos interagem em estágios sucessivos.",
  },
  amazonia: {
    label: "Bioma Amazônia (559 municípios)",
    bounds: [[-73.9, -16.5], [-44.0, 5.3]],
    summaryNote:
      "Contrasta frentes de grãos já mecanizadas (norte de MT, eixo BR-163 e leste do PA) com áreas de desmatamento recente ainda não ocupadas por soja.",
  },
  cerrado: {
    label: "Bioma Cerrado (1.433 municípios)",
    bounds: [[-60.5, -24.7], [-41.2, -2.2]],
    summaryNote:
      "Evidencia a dualidade entre terras consolidadas antes de 2013 no Centro-Sul (C1, azul-petróleo) e a conversão ativa no norte do bioma (C3, bordô).",
  },
};

export function formatCompact(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: decimals })} bi`;
  if (abs >= 1e6) return `${(value / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: decimals })} mi`;
  if (abs >= 1e3) return `${(value / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: decimals })} mil`;
  return value.toLocaleString("pt-BR", { maximumFractionDigits: decimals });
}

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function interpretSpearman(rho: number, pValue: number): string {
  if (pValue >= 0.05) {
    return "Sem correlação estatisticamente significativa neste recorte (p ≥ 0,05): as duas variáveis não seguem o mesmo ordenamento espacial.";
  }
  const abs = Math.abs(rho);
  const dir = rho >= 0 ? "positiva" : "negativa";
  if (abs >= 0.6) {
    return `Correlação ${dir} forte e altamente significativa: municípios com maior desmatamento tendem consistentemente a apresentar maior intensidade no eixo Y.`;
  }
  if (abs >= 0.3) {
    return `Correlação ${dir} moderada e estatisticamente significativa: há associação clara nas frentes de expansão, coexistindo com áreas consolidadas mais antigas.`;
  }
  return `Correlação ${dir} fraca (porém estatisticamente significativa pelo tamanho amostral): o fenômeno ocorre em polos concentrados e não de modo homogêneo em todos os municípios.`;
}
