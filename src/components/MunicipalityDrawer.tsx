import React from "react";
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

  const totalPamTon = detail
    ? detail.series.reduce((a, s) => a + s.soja_producao_ton, 0)
    : 0;
  const totalComexTon = detail
    ? detail.series.reduce((a, s) => a + s.comex_soja_exp_ton, 0)
    : 0;
  const pegadaLavouraHm3 = (totalPamTon * 2050) / 1_000_000;

  let fiscalNote = "";
  if (detail) {
    if (totalPamTon > 0 && totalComexTon === 0) {
      fiscalNote = `Este município colheu ${formatCompact(
        totalPamTon,
        1
      )} t de soja no período (PAM/IBGE), mas registrou 0 t de exportação direta no Comex Stat — indicando que sua safra é faturada por tradings e cooperativas sediadas em municípios-polo.`;
    } else if (totalComexTon > totalPamTon * 1.25 && totalComexTon > 100000) {
      fiscalNote = `Polo comercial regional: o volume exportado declarado no Comex Stat (${formatCompact(
        totalComexTon,
        1
      )} t) supera a produção colhida dentro do próprio município (${formatCompact(
        totalPamTon,
        1
      )} t), pois empresas exportadoras locais centralizam grãos de municípios vizinhos.`;
    } else if (totalPamTon > 0 && totalComexTon > 0) {
      fiscalNote = `Município com produção agrícola local (${formatCompact(
        totalPamTon,
        1
      )} t na PAM/IBGE) e faturamento exportador direto registrado no Comex Stat (${formatCompact(
        totalComexTon,
        1
      )} t).`;
    } else {
      fiscalNote =
        "Sem produção comercial de soja registrada na PAM/IBGE nem exportação direta no Comex Stat no período 2013–2024.";
    }
  }

  return (
    <div className="mun-drawer" role="dialog" aria-label="Diagnóstico Municipal">
      <div className="mun-drawer-header">
        {loading || !detail ? (
          <strong>Consultando série histórica no PostGIS...</strong>
        ) : (
          <div>
            <span className="mono-label">DIAGNÓSTICO MUNICIPAL · IBGE {detail.municipio.cd_mun}</span>
            <h3>
              {detail.municipio.nm_mun} ({detail.municipio.sigla_uf})
            </h3>
            <p className="mun-subtitle">
              {detail.municipio.bioma_predominante} · Área territorial:{" "}
              {formatNumber(detail.municipio.area_mun_km2, 0)} km²
              {detail.municipio.fl_matopiba ? " · MATOPIBA" : ""}
              {detail.municipio.fl_arco_desmatamento ? " · Arco do Desmatamento" : ""}
            </p>
          </div>
        )}
        <button type="button" className="close-text-btn" onClick={onClose}>
          Fechar ×
        </button>
      </div>

      {detail && !loading && (
        <div className="mun-drawer-body">
          <div className="mun-mini-kpis">
            <div>
              <span>Desmat. Acumulado</span>
              <strong className="ink-terra">
                {formatNumber(
                  Math.max(...detail.series.map((s) => s.prodes_acum_km2), 0),
                  1
                )}{" "}
                km²
              </strong>
            </div>
            <div>
              <span>Soja Colhida (PAM)</span>
              <strong className="ink-petrol">{formatCompact(totalPamTon, 1)} t</strong>
            </div>
            <div>
              <span>Pegada Hídrica Safra</span>
              <strong className="ink-petrol">{formatCompact(pegadaLavouraHm3, 1)} hm³</strong>
            </div>
            <div>
              <span>Irrigação ANA (2024)</span>
              <strong>
                {formatNumber(
                  detail.series[detail.series.length - 1]?.ana_irrig_retirada_m3s || 0,
                  2
                )}{" "}
                m³/s
              </strong>
            </div>
          </div>

          <div className="fiscal-callout">
            <strong>Leitura Produção × Comex Stat:</strong> {fiscalNote}
          </div>

          <div className="drawer-chart-section">
            <h4>Supressão Anual PRODES (km²) × Soja Colhida & Exportada (mil t)</h4>
            <ResponsiveContainer width="100%" height={170}>
              <ComposedChart
                data={detail.series.map((s) => ({
                  ...s,
                  pam_kt: Number((s.soja_producao_ton / 1000).toFixed(1)),
                  exp_kt: Number((s.comex_soja_exp_ton / 1000).toFixed(1)),
                }))}
                margin={{ top: 6, right: 6, bottom: 0, left: -14 }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="#d5dad6" />
                <XAxis dataKey="ano" tick={{ fill: "#3d454b", fontSize: 10, fontFamily: "IBM Plex Mono" }} />
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
                    fontSize: 11,
                  }}
                />
                <Bar yAxisId="left" dataKey="prodes_incr_km2" name="PRODES (km²)" fill="#d9532f" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="pam_kt"
                  name="Colhido PAM (mil t)"
                  stroke="#1b3c51"
                  strokeWidth={2.2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="exp_kt"
                  name="Exportado Comex (mil t)"
                  stroke="#6b7278"
                  strokeDasharray="4 3"
                  strokeWidth={1.8}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="drawer-chart-section">
            <h4>Retirada Hídrica p/ Agricultura Irrigada — SNIRH/ANA (hm³/ano)</h4>
            <ResponsiveContainer width="100%" height={130}>
              <ComposedChart data={detail.series} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#d5dad6" />
                <XAxis dataKey="ano" tick={{ fill: "#3d454b", fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                <YAxis tick={{ fill: "#24506b", fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                <Tooltip
                  contentStyle={{
                    background: "#1e2328",
                    color: "#eceeeb",
                    border: "none",
                    borderRadius: 2,
                    fontSize: 11,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="agua_irrig_hm3_ano"
                  name="Retirada Irrigação (hm³/ano)"
                  stroke="#24506b"
                  strokeWidth={2.2}
                  dot={{ r: 2, fill: "#24506b" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {detail.topDestinations.length > 0 && (
            <div className="drawer-chart-section">
              <h4>Destinos Diretos Declarados neste Município (Comex Stat)</h4>
              <div className="dest-table">
                {detail.topDestinations.map((d) => (
                  <div key={d.pais} className="dest-row">
                    <span>{d.pais}</span>
                    <span>{formatCompact(d.exp_soja_ton, 1)} t</span>
                    <strong className="ink-petrol">{formatNumber(d.agua_virtual_hm3, 1)} hm³</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
