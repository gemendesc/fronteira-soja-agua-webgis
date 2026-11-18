import React from "react";
import { X } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatNumber } from "../bivariate";
import type { MunicipalityDetailResponse } from "../types";

interface Props {
  detail: MunicipalityDetailResponse | null;
  loading: boolean;
  onClose: () => void;
}

export const MunicipalityDrawer: React.FC<Props> = ({ detail, loading, onClose }) => {
  if (!loading && !detail) return null;

  return (
    <div className="mun-drawer" role="dialog" aria-label="Ficha Municipal Detalhada">
      <div className="mun-drawer-header">
        {loading || !detail ? (
          <strong>Carregando série histórica PostGIS...</strong>
        ) : (
          <div>
            <div className="mun-title-row">
              <h3>
                {detail.municipio.nm_mun} — {detail.municipio.sigla_uf}
              </h3>
              <span className="mun-code-pill">IBGE {detail.municipio.cd_mun}</span>
            </div>
            <p className="mun-subtitle">
              {detail.municipio.bioma_predominante} · Área: {formatNumber(detail.municipio.area_mun_km2, 0)} km²
              {detail.municipio.fl_matopiba ? " · MATOPIBA" : ""}
              {detail.municipio.fl_arco_desmatamento ? " · Arco do Desmatamento" : ""}
            </p>
          </div>
        )}
        <button type="button" className="icon-close-btn" onClick={onClose} title="Fechar ficha">
          <X size={18} />
        </button>
      </div>

      {detail && !loading && (
        <div className="mun-drawer-body">
          {/* Totais acumulados do município */}
          <div className="mun-mini-kpis">
            <div>
              <span>Desmat. Acumulado</span>
              <strong className="accent-terra">
                {formatNumber(
                  Math.max(...detail.series.map((s) => s.prodes_acum_km2), 0),
                  1
                )}{" "}
                km²
              </strong>
            </div>
            <div>
              <span>Área Máx. Soja (PAM)</span>
              <strong>
                {formatCompact(
                  Math.max(...detail.series.map((s) => s.soja_area_plantada_ha), 0),
                  1
                )}{" "}
                ha
              </strong>
            </div>
            <div>
              <span>Água Virtual Exp.</span>
              <strong className="accent-cyan">
                {formatCompact(
                  detail.series.reduce((a, s) => a + s.agua_virtual_exp_hm3, 0),
                  1
                )}{" "}
                hm³
              </strong>
            </div>
            <div>
              <span>Retirada Irrig. (2024)</span>
              <strong>
                {formatNumber(
                  detail.series[detail.series.length - 1]?.ana_irrig_retirada_m3s || 0,
                  2
                )}{" "}
                m³/s
              </strong>
            </div>
          </div>

          {/* Gráfico 1: Desmatamento vs Produção/Exportação de Soja */}
          <div className="drawer-chart-section">
            <h4>Supressão Anual PRODES (km²) × Soja Produzida & Exportada (mil t)</h4>
            <ResponsiveContainer width="100%" height={175}>
              <ComposedChart
                data={detail.series.map((s) => ({
                  ...s,
                  pam_kt: Number((s.soja_producao_ton / 1000).toFixed(1)),
                  exp_kt: Number((s.comex_soja_exp_ton / 1000).toFixed(1)),
                }))}
                margin={{ top: 6, right: 8, bottom: 0, left: -14 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="ano" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fill: "#e05a33", fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#38bdf8", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="prodes_incr_km2"
                  name="Incremento PRODES (km²)"
                  fill="#e05a33"
                  radius={[2, 2, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="pam_kt"
                  name="Produção PAM (mil t)"
                  stroke="#facc15"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="exp_kt"
                  name="Exportação Comex (mil t)"
                  stroke="#14a3b8"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico 2: Pressão Hídrica na Irrigação SNIRH/ANA */}
          <div className="drawer-chart-section">
            <h4>Evolução da Retirada p/ Agricultura Irrigada — SNIRH/ANA (hm³/ano)</h4>
            <ResponsiveContainer width="100%" height={135}>
              <ComposedChart data={detail.series} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="ano" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#38bdf8", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="agua_irrig_hm3_ano"
                  name="Retirada Irrigação (hm³/ano)"
                  stroke="#38bdf8"
                  strokeWidth={2.2}
                  dot={{ r: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Destinos da água virtual do município */}
          <div className="drawer-chart-section">
            <h4>Países Destino da Água Virtual deste Município (2013–2024)</h4>
            {detail.topDestinations.length === 0 ? (
              <p className="empty-dest">
                Sem exportação direta faturada por domicílio fiscal neste município (a produção local pode
                ser escoada via tradings em municípios polo próximos).
              </p>
            ) : (
              <div className="dest-table">
                {detail.topDestinations.map((d) => (
                  <div key={d.pais} className="dest-row">
                    <span>{d.pais}</span>
                    <span>{formatCompact(d.exp_soja_ton, 1)} t</span>
                    <strong className="accent-cyan">{formatNumber(d.agua_virtual_hm3, 1)} hm³</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
