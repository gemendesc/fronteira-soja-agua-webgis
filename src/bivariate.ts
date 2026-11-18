import type { EixoYKey, RecorteKey } from "./types";

/**
 * Paleta Bivariada 3x3 otimizada para fundo cartográfico escuro:
 * - Eixo X (1 -> 3): Supressão de Vegetação Nativa (PRODES km²) — Cinza -> Ocre -> Terracota
 * - Eixo Y (A -> C): Pressão Hídrica / Soja — Cinza -> Petróleo -> Ciano Intenso
 * - Convergência C3 (Alto X + Alto Y): Magenta/Carmim Crítico (#e11d74)
 */
export const BIVARIATE_COLORS: Record<string, string> = {
  A1: "#192231",
  A2: "#6b442b",
  A3: "#b84a2c",
  B1: "#1d6376",
  B2: "#6d5975",
  B3: "#c83e58",
  C1: "#14a8bd",
  C2: "#6e56af",
  C3: "#f43f85",
};

export const BIVARIATE_LABELS: Record<string, string> = {
  A1: "Baixo Desmat. · Baixa Pressão Hídrica/Soja",
  A2: "Médio Desmat. · Baixa Pressão Hídrica/Soja",
  A3: "Alto Desmat. · Fronteira sem Soja Consolidada",
  B1: "Baixo Desmat. · Média Pressão Hídrica/Soja",
  B2: "Médio Desmat. · Média Pressão Hídrica/Soja",
  B3: "Alto Desmat. · Média Pressão Hídrica/Soja",
  C1: "Baixo Desmat. Recente · Polo Consolidado",
  C2: "Médio Desmat. · Alta Pressão Hídrica/Soja",
  C3: "Crítico (C3): Alto Desmat. + Alta Exportação/Água",
};

export const EIXO_Y_META: Record<
  EixoYKey,
  { label: string; shortLabel: string; unit: string; source: string }
> = {
  agua_virtual: {
    label: "Água Virtual Exportada na Soja",
    shortLabel: "Água Virtual",
    unit: "hm³",
    source: "Comex Stat + Pegada Hídrica (2.050 m³/t)",
  },
  comex_ton: {
    label: "Exportação de Soja em Grão (Fiscal)",
    shortLabel: "Exportação Soja",
    unit: "t",
    source: "MDIC / Comex Stat (SH4 1201)",
  },
  pam_ton: {
    label: "Produção Física de Soja (Municipal)",
    shortLabel: "Produção PAM",
    unit: "t",
    source: "IBGE / SIDRA (PAM Tabela 5457)",
  },
  irrig_hm3: {
    label: "Retirada de Água p/ Irrigação (Água Azul)",
    shortLabel: "Irrigação ANA",
    unit: "hm³",
    source: "ANA / SNIRH (Usos Consuntivos)",
  },
};

export const RECORTE_META: Record<
  RecorteKey,
  { label: string; bounds: [[number, number], [number, number]] }
> = {
  todos: {
    label: "Amazônia + Cerrado (1.873 mun.)",
    bounds: [[-73.9, -24.7], [-41.0, 5.3]],
  },
  matopiba: {
    label: "Fronteira MATOPIBA (MA·TO·PI·BA)",
    bounds: [[-50.9, -15.6], [-41.3, -2.2]],
  },
  arco: {
    label: "Arco do Desmatamento Amazônico",
    bounds: [[-66.8, -14.5], [-44.0, -1.5]],
  },
  amazonia: {
    label: "Bioma Amazônia",
    bounds: [[-73.9, -16.5], [-44.0, 5.3]],
  },
  cerrado: {
    label: "Bioma Cerrado",
    bounds: [[-60.5, -24.7], [-41.2, -2.2]],
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
