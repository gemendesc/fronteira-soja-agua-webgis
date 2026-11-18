import React, { useMemo, useState } from "react";
import {
  Bar,
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
  interpretSpearman,
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
  const [tab, setTab] = useState<"dispersao" | "serie" | "ranking">("dispersao");
  const yMeta = EIXO_Y_META[eixoY];

  const scatterPoints = useMemo(() => {
    if (!summary) return [];
    const pool = summary.municipalities.filter(
      (m) =>
        (!selectedClass || m.biv_class === selectedClass) &&
        (m.desmat_km2 > 0 || m.y_value > 0)
    );
    return pool.slice(0, 700).map((m) => ({
      cd_mun: m.cd_mun,
      label: `${m.nm_mun} (${m.sigla_uf})`,
      biv_class: m.biv_class,
      desmat_km2: m.desmat_km2,
      y_value: m.y_value,
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
      .sort(
        (a, b) =>
          b.desmat_km2 * Math.log10(b.y_value + 10) -
          a.desmat_km2 * Math.log10(a.y_value + 10)
      )
      .slice(0, 14);
  }, [summary, selectedClass]);

  if (!summary) {
    return (
      <aside className="side-panel">
        <div className="panel-skeleton">Consultando banco espacial PostGIS (Neon)...</div>
      </aside>
    );
  }

  const { correlation, regionalSeries, params } = summary;
  const interpretation = interpretSpearman(correlation.rho, correlation.pValue);

  return (
    <aside className="side-panel">
      {/* Bloco de leitura estatística comentada */}
      <div className="stat-readout">
        <div className="stat-readout-top">
          <span className="mono-label">CORRELAÇÃO DE SPEARMAN · RECORTE ATIVO</span>
          <span className="mono-meta">
            n = {correlation.n} · lag +{params.lag}a
          </span>
        </div>
        <div className="stat-rho-line">
          <strong className="rho-number">
            ρ = {correlation.rho >= 0 ? `+${correlation.rho.toFixed(2)}` : correlation.rho.toFixed(2)}
          </strong>
          <span className="pval-tag">
            {correlation.pValue < 0.0001
              ? "p < 0,0001"
              : `p = ${correlation.pValue.toFixed(4)}`}
          </span>
        </div>
        <p className="stat-human-text">{interpretation}</p>
      </div>

      {/* Abas limpas */}
      <div className="panel-tabs">
        <button
          type="button"
          className={tab === "dispersao" ? "active" : ""}
          onClick={() => setTab("dispersao")}
        >
          Dispersão
        </button>
        <button
          type="button"
          className={tab === "serie" ? "active" : ""}
          onClick={() => setTab("serie")}
        >
          Série Anual
        </button>
        <button
          type="button"
          className={tab === "ranking" ? "active" : ""}
          onClick={() => setTab("ranking")}
        >
          Municípios ({selectedClass || "C3"})
        </button>
      </div>

      {tab === "dispersao" && (
        <div className="tab-body">
          <div className="chart-box">
            <div className="chart-header">
              <h4>Cada ponto é um município (escala log₁₀)</h4>
              <span>Clique p/ abrir a ficha</span>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <ScatterChart margin={{ top: 10, right: 12, bottom: 22, left: -14 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#cbd0cc" />
                <XAxis
                  type="number"
                  dataKey="logX"
                  domain={[0, "auto"]}
                  tick={{ fill: "#3d454b", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                  label={{
                    value: "log₁₀(Desmatamento km² + 1) →",
                    position: "insideBottom",
                    offset: -12,
                    fill: "#3d454b",
                    fontSize: 11,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="logY"
                  domain={[0, "auto"]}
                  tick={{ fill: "#3d454b", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "2 2" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="chart-tooltip">
                        <strong>{d.label}</strong>
                        <div>Supressão PRODES: {formatNumber(d.desmat_km2, 1)} km²</div>
                        <div>
                          {yMeta.shortLabel}: {formatCompact(d.y_value, 1)} {yMeta.unit}
                        </div>
                        <div>Classe bivariada: {d.biv_class}</div>
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
                      fill={BIVARIATE_COLORS[entry.biv_class] || "#6b7278"}
                      stroke="#1e2328"
                      strokeWidth={entry.biv_class === "C3" ? 0.6 : 0.25}
                      fillOpacity={0.9}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <p className="chart-caption">
              Municípios no canto superior direito (<strong>C3</strong>, tom bordô) combinam intensa abertura
              de vegetação nativa entre {params.anoIni}–{params.desmatFim} e elevada pressão agrícola/hídrica
              entre {params.respIni}–{params.anoFim}.
            </p>
          </div>
        </div>
      )}

      {tab === "serie" && (
        <div className="tab-body">
          <div className="chart-box">
            <div className="chart-header">
              <h4>Evolução Anual no Recorte (2013–2024)</h4>
              <span>Barras: PRODES · Linha: Soja PAM</span>
            </div>
            <ResponsiveContainer width="100%" height={245}>
              <ComposedChart data={regionalSeries} margin={{ top: 10, right: 8, bottom: 4, left: -12 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#cbd0cc" />
                <XAxis dataKey="ano" tick={{ fill: "#3d454b", fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                <YAxis yAxisId="left" tick={{ fill: "#b83b1d", fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "#24506b", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1e2328",
                    color: "#eceeeb",
                    border: "none",
                    borderRadius: 2,
                    fontSize: 12,
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="desmat_km2"
                  name="Desmatamento PRODES (km²)"
                  fill="#d9532f"
                  fillOpacity={0.85}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="pam_mton"
                  name="Soja colhida PAM (milhões t)"
                  stroke="#1b3c51"
                  strokeWidth={2.4}
                  dot={{ r: 2.5, fill: "#1b3c51" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="chart-caption">
              Enquanto a produção física de soja cresce de forma contínua na década, o incremento anual de
              desmatamento oscila conforme ciclos econômicos e de fiscalização ambiental.
            </p>
          </div>
        </div>
      )}

      {tab === "ranking" && (
        <div className="tab-body">
          <p className="ranking-intro">
            Municípios de maior convergência no filtro atual (clique para inspecionar a série histórica e o
            fluxo comercial):
          </p>
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
                      {m.nm_mun} · {m.sigla_uf}
                    </strong>
                    <small>
                      {m.bioma_predominante}
                      {m.fl_matopiba ? " · MATOPIBA" : ""}
                    </small>
                  </div>
                </div>
                <div className="ranking-right">
                  <span className="rk-terra">{formatNumber(m.desmat_km2, 0)} km²</span>
                  <span className="rk-petrol">
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
