import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BIVARIATE_COLORS,
  EIXO_Y_META,
  formatCompact,
  formatNumber,
} from "../bivariate";
import type { EixoYKey, MapSummaryResponse, MunicipioSummary } from "../types";

interface Props {
  summary: MapSummaryResponse | null;
  eixoY: EixoYKey;
  selectedClass: string | null;
  onSelectMunicipality: (cdMun: string) => void;
}

export const AnalyticsPanel: React.FC<Props> = ({
  summary,
  eixoY,
  selectedClass,
  onSelectMunicipality,
}) => {
  const [tab, setTab] = useState<"hipotese" | "destinos" | "ranking">("hipotese");
  const yMeta = EIXO_Y_META[eixoY];

  const scatterPoints = useMemo(() => {
    if (!summary) return [];
    const pool = summary.municipalities.filter(
      (m) =>
        (!selectedClass || m.biv_class === selectedClass) &&
        (m.desmat_km2 > 0 || m.y_value > 0)
    );
    return pool.slice(0, 650).map((m) => ({
      cd_mun: m.cd_mun,
      label: `${m.nm_mun} (${m.sigla_uf})`,
      biv_class: m.biv_class,
      desmat_km2: m.desmat_km2,
      y_value: m.y_value,
      // Escala log10(x + 1) para revelar toda a distribuição assimétrica territorial
      logX: Number(Math.log10(m.desmat_km2 + 1).toFixed(3)),
      logY: Number(Math.log10(m.y_value + 1).toFixed(3)),
    }));
  }, [summary, selectedClass]);

  const rankingCritical = useMemo<MunicipioSummary[]>(() => {
    if (!summary) return [];
    const base = selectedClass
      ? summary.municipalities.filter((m) => m.biv_class === selectedClass)
      : summary.municipalities.filter((m) => m.biv_class === "C3");
    const list = base.length > 0 ? base : summary.municipalities;
    return [...list]
      .sort((a, b) => b.desmat_km2 * Math.log10(b.y_value + 10) - a.desmat_km2 * Math.log10(a.y_value + 10))
      .slice(0, 15);
  }, [summary, selectedClass]);

  if (!summary) {
    return (
      <aside className="side-panel">
        <div className="panel-skeleton">Consultando banco espacial PostGIS (Neon)...</div>
      </aside>
    );
  }

  const { kpis, correlation, topCountries, regionalSeries, params } = summary;
  const anosJanela = Math.max(1, params.anoFim - params.respIni + 1);
  // Retirada urbana anual total do Brasil (ANA Usos Consuntivos ~ 10.800 hm³/ano)
  const equivAbastUrbanoBrAnual = kpis.agua_virtual_total_hm3 / anosJanela / 10800;

  return (
    <aside className="side-panel">
      {/* KPIs principais */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Supressão PRODES ({params.anoIni}–{params.desmatFim})</span>
          <strong className="kpi-value accent-terra">
            {formatCompact(kpis.desmat_total_km2, 1)} km²
          </strong>
          <span className="kpi-foot">{kpis.total_municipios} municípios no recorte</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Água Virtual Embarcada ({params.respIni}–{params.anoFim})</span>
          <strong className="kpi-value accent-cyan">
            {formatNumber(kpis.agua_virtual_total_hm3 / 1000, 1)} km³
          </strong>
          <span className="kpi-foot">
            Média anual ≈ {formatNumber(equivAbastUrbanoBrAnual, 1)}× o uso urbano do Brasil
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Soja Exportada vs. Produzida</span>
          <strong className="kpi-value">
            {formatCompact(kpis.comex_total_ton, 1)} t
          </strong>
          <span className="kpi-foot">
            PAM física: {formatCompact(kpis.pam_total_ton, 1)} t · US$ {formatCompact(kpis.comex_total_usd, 1)}
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Irrigação Azul (SNIRH) & Hotspots</span>
          <strong className="kpi-value accent-magenta">
            {kpis.municipios_criticos_c3} mun. C3
          </strong>
          <span className="kpi-foot">
            Retirada irrig.: {formatCompact(kpis.irrig_total_hm3, 1)} hm³ acumulados
          </span>
        </div>
      </div>

      {/* Bloco de Correlação Estatística */}
      <div className="corr-banner">
        <div>
          <span className="corr-tag">TESTE DE CORRELAÇÃO (SPEARMAN)</span>
          <div className="corr-main">
            <strong>ρ = {correlation.rho >= 0 ? `+${correlation.rho.toFixed(3)}` : correlation.rho.toFixed(3)}</strong>
            <span className="corr-pval">
              {correlation.pValue < 0.0001
                ? "p < 0,0001 (significativo)"
                : `p = ${correlation.pValue.toFixed(4)}`}
            </span>
          </div>
        </div>
        <div className="corr-meta">
          <span>n = {correlation.n} mun.</span>
          <span>Lag: +{params.lag}a</span>
        </div>
      </div>

      {/* Navegação interna de análises */}
      <div className="panel-tabs">
        <button
          type="button"
          className={tab === "hipotese" ? "active" : ""}
          onClick={() => setTab("hipotese")}
        >
          Dispersão & Série
        </button>
        <button
          type="button"
          className={tab === "destinos" ? "active" : ""}
          onClick={() => setTab("destinos")}
        >
          Destinos da Água
        </button>
        <button
          type="button"
          className={tab === "ranking" ? "active" : ""}
          onClick={() => setTab("ranking")}
        >
          Hotspots ({selectedClass || "C3"})
        </button>
      </div>

      {tab === "hipotese" && (
        <div className="tab-body">
          <div className="chart-box">
            <div className="chart-header">
              <h4>Dispersão Municipal (escala log₁₀)</h4>
              <span>Clique em um ponto p/ inspecionar</span>
            </div>
            <div className="chart-frame">
              <ResponsiveContainer width="100%" height={205}>
                <ScatterChart margin={{ top: 8, right: 12, bottom: 18, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis
                    type="number"
                    dataKey="logX"
                    name="log10(Desmatamento)"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    label={{
                      value: "log₁₀(Desmatamento km² + 1)",
                      position: "insideBottom",
                      offset: -10,
                      fill: "#94a3b8",
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="logY"
                    name={`log10(${yMeta.shortLabel})`}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="chart-tooltip">
                          <strong>{d.label}</strong>
                          <div>Desmatamento: {formatNumber(d.desmat_km2, 1)} km²</div>
                          <div>
                            {yMeta.shortLabel}: {formatCompact(d.y_value, 1)} {yMeta.unit}
                          </div>
                          <div>Classe: {d.biv_class}</div>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    data={scatterPoints}
                    onClick={(pt: any) => {
                      if (pt?.cd_mun) onSelectMunicipality(pt.cd_mun);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {scatterPoints.map((entry) => (
                      <Cell
                        key={entry.cd_mun}
                        fill={BIVARIATE_COLORS[entry.biv_class] || "#64748b"}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-box">
            <div className="chart-header">
              <h4>Dinâmica Anual do Recorte (2013–2024)</h4>
              <span>PRODES (km²) × Água Virtual (hm³)</span>
            </div>
            <div className="chart-frame">
              <ResponsiveContainer width="100%" height={185}>
                <ComposedChart data={regionalSeries} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="ano" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fill: "#e05a33", fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#14a3b8", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="desmat_km2"
                    name="Desmatamento (km²)"
                    fill="#e05a33"
                    fillOpacity={0.75}
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="agua_virtual_hm3"
                    name="Água Virtual Exp. (hm³)"
                    stroke="#14a3b8"
                    strokeWidth={2.2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === "destinos" && (
        <div className="tab-body">
          <div className="chart-box">
            <div className="chart-header">
              <h4>Importadores da Água Virtual (Soja SH4 1201)</h4>
              <span>Volume hídrico virtual embarcado (hm³)</span>
            </div>
            <div className="chart-frame">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={topCountries}
                  layout="vertical"
                  margin={{ top: 6, right: 18, bottom: 6, left: 26 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                  <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="pais"
                    width={96}
                    tick={{ fill: "#e2e8f0", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    formatter={(val: any) => [`${formatNumber(Number(val), 1)} hm³`, "Água Virtual"]}
                  />
                  <Bar dataKey="agua_virtual_hm3" fill="#14a3b8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="method-micro-note">
              Estimativa baseada no fluxo municipal exportado (MDIC/Comex Stat) multiplicado pela pegada
              hídrica média de 2.050 m³ de água total por tonelada de soja em grão.
            </p>
          </div>
        </div>
      )}

      {tab === "ranking" && (
        <div className="tab-body">
          <div className="ranking-list">
            {rankingCritical.map((m, idx) => (
              <button
                key={m.cd_mun}
                type="button"
                className="ranking-item"
                onClick={() => onSelectMunicipality(m.cd_mun)}
              >
                <div className="ranking-left">
                  <span className="ranking-idx">{String(idx + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>
                      {m.nm_mun} ({m.sigla_uf})
                    </strong>
                    <small>
                      {m.bioma_predominante}
                      {m.fl_matopiba ? " · MATOPIBA" : ""}
                    </small>
                  </div>
                </div>
                <div className="ranking-right">
                  <span className="rk-terra">{formatNumber(m.desmat_km2, 0)} km²</span>
                  <span className="rk-cyan">
                    {formatCompact(m.y_value, 1)} {yMeta.unit}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
