import React from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const MethodologyModal: React.FC<Props> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Nota Metodológica & Arquitetura Geoespacial</h2>
            <p> Critérios científicos, bases públicas oficiais e modelagem em PostGIS</p>
          </div>
          <button type="button" className="icon-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-content">
          <section>
            <h3>1. Hipótese Investigada</h3>
            <p>
              Esta plataforma avalia o acoplamento espacial e temporal entre a{" "}
              <strong>supressão de vegetação nativa</strong> nos biomas Amazônia e Cerrado, a{" "}
              <strong>expansão agroexportadora de soja</strong> e a{" "}
              <strong>pressão sobre recursos hídricos</strong> — tanto pelo consumo direto na agricultura
              irrigada (<em>água azul</em>) quanto pela <strong>exportação de água virtual</strong>{" "}
              incorporada nos grãos embarcados ao mercado internacional (2013–2024).
            </p>
          </section>

          <section>
            <h3>2. Fontes Oficiais e Cuidados de Engenharia de Dados</h3>
            <ul>
              <li>
                <strong>Desmatamento (INPE / TerraBrasilis):</strong> Soma unificada dos incrementos anuais
                municipais do <em>PRODES Amazônia (Floresta e Não-Floresta)</em> e{" "}
                <em>PRODES Cerrado</em>, capturando integralmente municípios situados em zonas de ecótono.
              </li>
              <li>
                <strong>Comex Stat (MDIC) vs. PAM (IBGE SIDRA 5457):</strong> As estatísticas municipais de
                exportação (SH4 <code>1201</code>) refletem o <em>domicílio fiscal do exportador</em>, o que
                pode concentrar volumes em polos de <em>tradings</em>. Por rigor metodológico, o ETL pareia o
                dado fiscal com a <strong>produção agrícola física municipal (PAM/IBGE)</strong>.
              </li>
              <li>
                <strong>Recursos Hídricos (ANA / SNIRH) & Água Virtual:</strong> A retirada hídrica para
                agricultura irrigada provém da série municipal do{" "}
                <em>Manual de Usos Consuntivos da Água no Brasil (ANA)</em>. A água virtual exportada adota a
                referência internacional de pegada hídrica média da soja brasileira (~2.050 m³/tonelada —
                Hoekstra & Mekonnen).
              </li>
              <li>
                <strong>Defasagem Temporal (Lag 0 a +3 anos):</strong> A conversão florestal no ano{" "}
                <code>t</code> frequentemente se converte em lavoura comercial e volume exportado em{" "}
                <code>t + 2</code> ou <code>t + 3</code>. O seletor de <em>lag</em> recalcula a correlação de
                postos de Spearman (ρ) dinamicamente sobre o banco espacial.
              </li>
            </ul>
          </section>

          <section>
            <h3>3. Stack Técnica (Portfólio WebGIS)</h3>
            <p>
              Pipeline ETL em <strong>Python</strong> (<code>GeoPandas</code>, <code>Shapely</code>,{" "}
              <code>Calamine</code>, <code>SciPy</code>, <code>Psycopg 3</code>) → Banco espacial{" "}
              <strong>PostgreSQL 17 + PostGIS 3.5</strong> no <strong>Neon Serverless</strong> (índices{" "}
              <code>GiST</code>, <code>ST_AsGeoJSON</code> e função nativa de Vector Tiles{" "}
              <code>ST_AsMVT</code>) → API Serverless na <strong>Vercel</strong> → Frontend em{" "}
              <strong>React + TypeScript + MapLibre GL JS + Recharts</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
