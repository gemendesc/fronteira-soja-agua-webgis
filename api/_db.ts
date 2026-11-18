import { neon } from "@neondatabase/serverless";

export function getSql() {
  let raw = (process.env.DATABASE_URL || "").trim();
  if (!raw) {
    throw new Error("DATABASE_URL não configurada nas variáveis de ambiente.");
  }
  if (raw.toLowerCase().startsWith("psql ")) {
    raw = raw.slice(5).trim();
  }
  raw = raw.replace(/^['"]+|['"]+$/g, "").trim();
  const match = raw.match(/(postgres(?:ql)?:\/\/\S+)/i);
  if (match) {
    raw = match[1].replace(/^['"]+|['"]+$/g, "");
  }
  return neon(raw);
}

function averageRanks(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let pos = 0;
  while (pos < indexed.length) {
    let end = pos;
    while (end + 1 < indexed.length && indexed[end + 1].v === indexed[pos].v) {
      end++;
    }
    const avgRank = (pos + end) / 2 + 1;
    for (let k = pos; k <= end; k++) {
      ranks[indexed[k].i] = avgRank;
    }
    pos = end + 1;
  }
  return ranks;
}

/** Calcula correlação de postos de Spearman (rho) e p-valor aproximado bicaudal */
export function computeSpearman(xs: number[], ys: number[]): {
  rho: number;
  pValue: number;
  n: number;
} {
  const n = xs.length;
  if (n < 4) {
    return { rho: 0, pValue: 1, n };
  }
  const rx = averageRanks(xs);
  const ry = averageRanks(ys);

  const meanX = rx.reduce((a, b) => a + b, 0) / n;
  const meanY = ry.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - meanX;
    const dy = ry[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den === 0) {
    return { rho: 0, pValue: 1, n };
  }
  const rho = Math.max(-1, Math.min(1, num / den));
  if (Math.abs(rho) >= 0.999999) {
    return { rho, pValue: 0, n };
  }

  // Aproximação normal assintótica de Student t para n >= 10
  const tStat = Math.abs(rho) * Math.sqrt((n - 2) / (1 - rho * rho));
  // Aproximação complementar gaussiana rápida para df grande
  const z = tStat * (1 - 1 / (4 * Math.max(3, n - 2)));
  const pValue = Math.max(0, Math.min(1, 2 * Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI * (1 + z * z * 0.25))));
  return { rho: Number(rho.toFixed(4)), pValue, n };
}

export function quantileThresholds(positiveValues: number[]): [number, number] {
  if (positiveValues.length === 0) return [0, 0];
  const sorted = [...positiveValues].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.3333)] ?? 0;
  const q2 = sorted[Math.floor(sorted.length * 0.6667)] ?? q1;
  return [q1, Math.max(q1, q2)];
}
