import React from "react";
import { BIVARIATE_COLORS, BIVARIATE_LABELS } from "../bivariate";

interface Props {
  selectedClass: string | null;
  onSelectClass: (cls: string | null) => void;
  classCounts: Record<string, number>;
  yAxisShortLabel: string;
}

const ROWS = ["C", "B", "A"];
const COLS = ["1", "2", "3"];
const LIGHT_CELLS = new Set(["A1", "A2", "B1"]);

export const BivariateLegend: React.FC<Props> = ({
  selectedClass,
  onSelectClass,
  classCounts,
  yAxisShortLabel,
}) => {
  return (
    <div className="biv-legend-card" role="region" aria-label="Legenda Bivariada 3x3">
      <div className="biv-legend-header">
        <span className="biv-legend-title">LEGENDA BIVARIADA (TERCIS)</span>
        {selectedClass && (
          <button
            type="button"
            className="biv-clear-btn"
            onClick={() => onSelectClass(null)}
          >
            Limpar filtro ({selectedClass})
          </button>
        )}
      </div>

      <div className="biv-matrix-wrap">
        <div className="biv-axis-y">
          <span>↑ {yAxisShortLabel}</span>
        </div>

        <div className="biv-grid-block">
          <div className="biv-grid">
            {ROWS.map((r) =>
              COLS.map((c) => {
                const code = `${r}${c}`;
                const isSelected = selectedClass === code;
                const isDimmed = selectedClass !== null && !isSelected;
                const count = classCounts[code] || 0;
                const darkInk = LIGHT_CELLS.has(code);
                return (
                  <button
                    key={code}
                    type="button"
                    className={`biv-cell ${isSelected ? "is-selected" : ""} ${
                      isDimmed ? "is-dimmed" : ""
                    }`}
                    style={{
                      backgroundColor: BIVARIATE_COLORS[code],
                      color: darkInk ? "#1e2328" : "#f8faf9",
                    }}
                    onClick={() => onSelectClass(isSelected ? null : code)}
                    title={`${code} — ${BIVARIATE_LABELS[code]} (${count} municípios)`}
                  >
                    <span className="biv-cell-code">{code}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="biv-axis-x">
            <span>Supressão PRODES (km²) →</span>
          </div>
        </div>
      </div>

      <p className="biv-legend-hint">
        {selectedClass
          ? `${BIVARIATE_LABELS[selectedClass]} (${classCounts[selectedClass] || 0} mun.)`
          : "Clique em qualquer célula (ex.: C3) para isolar os municípios correspondentes."}
      </p>
    </div>
  );
};
