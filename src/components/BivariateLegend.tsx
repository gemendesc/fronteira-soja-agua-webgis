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

export const BivariateLegend: React.FC<Props> = ({
  selectedClass,
  onSelectClass,
  classCounts,
  yAxisShortLabel,
}) => {
  return (
    <div className="biv-legend-card" role="region" aria-label="Legenda Bivariada 3x3">
      <div className="biv-legend-header">
        <span className="biv-legend-title">Matriz Bivariada (Tercis)</span>
        {selectedClass && (
          <button
            type="button"
            className="biv-clear-btn"
            onClick={() => onSelectClass(null)}
            title="Limpar filtro de classe"
          >
            Limpar ({selectedClass})
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
                return (
                  <button
                    key={code}
                    type="button"
                    className={`biv-cell ${isSelected ? "is-selected" : ""} ${
                      isDimmed ? "is-dimmed" : ""
                    }`}
                    style={{ backgroundColor: BIVARIATE_COLORS[code] }}
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
            <span>Desmatamento PRODES →</span>
          </div>
        </div>
      </div>

      <p className="biv-legend-hint">
        {selectedClass
          ? `${BIVARIATE_LABELS[selectedClass]} (${classCounts[selectedClass] || 0} mun.)`
          : "Clique em um quadrante para filtrar o mapa"}
      </p>
    </div>
  );
};
