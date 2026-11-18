import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Database, ExternalLink, Search } from "lucide-react";
import { EIXO_Y_META, RECORTE_META } from "./bivariate";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { BivariateLegend } from "./components/BivariateLegend";
import { BivariateMap } from "./components/BivariateMap";
import { MethodologyModal } from "./components/MethodologyModal";
import { MunicipalityDrawer } from "./components/MunicipalityDrawer";
import type {
  EixoYKey,
  MapSummaryResponse,
  MunicipalityDetailResponse,
  RecorteKey,
} from "./types";

const UF_OPTIONS = [
  "TODAS", "AC", "AM", "AP", "BA", "DF", "GO", "MA", "MG",
  "MS", "MT", "PA", "PI", "PR", "RO", "RR", "SP", "TO",
];

export const App: React.FC = () => {
  const [recorte, setRecorte] = useState<RecorteKey>("todos");
  const [uf, setUf] = useState<string>("TODAS");
  const [eixoY, setEixoY] = useState<EixoYKey>("agua_virtual");
  const [lag, setLag] = useState<number>(2);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  const [geometries, setGeometries] = useState<GeoJSON.FeatureCollection | null>(null);
  const [summary, setSummary] = useState<MapSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedMunId, setSelectedMunId] = useState<string | null>(null);
  const [munDetail, setMunDetail] = useState<MunicipalityDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [flyTarget, setFlyTarget] = useState<{ lon: number; lat: number } | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // 1. Carrega malha vetorial simplificada do PostGIS uma única vez
  useEffect(() => {
    let cancelled = false;
    fetch("/api/geometries")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((geo) => {
        if (!cancelled) setGeometries(geo);
      })
      .catch((err) => {
        console.error("Erro ao carregar geometrias:", err);
        if (!cancelled) setErrorMsg("Falha ao carregar malha vetorial do banco PostGIS.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Consulta dinâmica ao PostGIS quando filtros mudam
  useEffect(() => {
    let cancelled = false;
    setLoadingSummary(true);
    setErrorMsg(null);

    const qs = new URLSearchParams({
      recorte,
      uf,
      ano_ini: "2013",
      ano_fim: "2024",
      lag: String(lag),
      eixo_y: eixoY,
    });

    fetch(`/api/map-summary?${qs.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: MapSummaryResponse) => {
        if (!cancelled) {
          setSummary(data);
          setLoadingSummary(false);
        }
      })
      .catch((err) => {
        console.error("Erro em /api/map-summary:", err);
        if (!cancelled) {
          setErrorMsg("Não foi possível consultar os indicadores no PostGIS.");
          setLoadingSummary(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [recorte, uf, eixoY, lag]);

  // 3. Abre ficha detalhada do município clicado
  const handleSelectMunicipality = useCallback((cdMun: string) => {
    setSelectedMunId(cdMun);
    setLoadingDetail(true);
    setSearchTerm("");

    fetch(`/api/municipality?cd_mun=${encodeURIComponent(cdMun)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: MunicipalityDetailResponse) => {
        setMunDetail(data);
        setLoadingDetail(false);
        if (data.municipio?.lon && data.municipio?.lat) {
          setFlyTarget({ lon: data.municipio.lon, lat: data.municipio.lat });
        }
      })
      .catch((err) => {
        console.error("Erro em /api/municipality:", err);
        setLoadingDetail(false);
      });
  }, []);

  const searchResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (q.length < 2 || !summary) return [];
    return summary.municipalities
      .filter(
        (m) =>
          m.nm_mun.toLowerCase().includes(q) ||
          `${m.nm_mun.toLowerCase()} ${m.sigla_uf.toLowerCase()}`.includes(q)
      )
      .slice(0, 8);
  }, [searchTerm, summary]);

  return (
    <div className="app-shell">
      {/* Barra Superior de Controles Científicos */}
      <header className="top-bar">
        <div className="brand-block">
          <div className="brand-badge">
            <Database size={15} />
            <span>PostGIS · WebGIS</span>
          </div>
          <div>
            <h1>Fronteira Soja, Desmatamento & Água Virtual</h1>
            <p className="brand-sub">
              Amazônia & Cerrado (2013–2024) ·{" "}
              <a href="https://georgemendes.net" target="_blank" rel="noreferrer">
                George Mendes <ExternalLink size={11} />
              </a>
            </p>
          </div>
        </div>

        <div className="controls-row">
          <label className="ctrl-field">
            <span>Recorte Espacial</span>
            <select
              value={recorte}
              onChange={(e) => {
                setRecorte(e.target.value as RecorteKey);
                setSelectedClass(null);
              }}
            >
              {(Object.keys(RECORTE_META) as RecorteKey[]).map((k) => (
                <option key={k} value={k}>
                  {RECORTE_META[k].label}
                </option>
              ))}
            </select>
          </label>

          <label className="ctrl-field ctrl-uf">
            <span>UF</span>
            <select value={uf} onChange={(e) => setUf(e.target.value)}>
              {UF_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u === "TODAS" ? "Todas" : u}
                </option>
              ))}
            </select>
          </label>

          <label className="ctrl-field">
            <span>Eixo Y (Pressão Hídrica / Soja)</span>
            <select value={eixoY} onChange={(e) => setEixoY(e.target.value as EixoYKey)}>
              {(Object.keys(EIXO_Y_META) as EixoYKey[]).map((k) => (
                <option key={k} value={k}>
                  {EIXO_Y_META[k].label}
                </option>
              ))}
            </select>
          </label>

          <label className="ctrl-field ctrl-lag" title="Defasagem entre desmatamento (t) e resposta agrícola/hídrica (t + lag)">
            <span>Lag Temporal</span>
            <select value={lag} onChange={(e) => setLag(Number(e.target.value))}>
              <option value={0}>Sem lag (0a)</option>
              <option value={1}>+1 ano</option>
              <option value={2}>+2 anos (padrão)</option>
              <option value={3}>+3 anos</option>
            </select>
          </label>

          <div className="search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar município..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchResults.length > 0 && (
              <div className="search-dropdown">
                {searchResults.map((m) => (
                  <button
                    key={m.cd_mun}
                    type="button"
                    onClick={() => handleSelectMunicipality(m.cd_mun)}
                  >
                    <span>
                      {m.nm_mun} ({m.sigla_uf})
                    </span>
                    <small>{m.biv_class}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="method-btn"
            onClick={() => setModalOpen(true)}
            title="Abrir Nota Metodológica e Arquitetura"
          >
            <BookOpen size={14} />
            <span>Metodologia</span>
          </button>
        </div>
      </header>

      {/* Corpo Principal: Mapa Bivariado + Painel Analítico */}
      <main className="workspace-grid">
        <section className="map-stage">
          {loadingSummary && <div className="map-loading-pill">Atualizando consulta PostGIS...</div>}
          {errorMsg && <div className="map-error-pill">{errorMsg}</div>}

          <BivariateMap
            geometries={geometries}
            municipalities={summary?.municipalities || []}
            recorte={recorte}
            eixoY={eixoY}
            selectedClass={selectedClass}
            selectedMunId={selectedMunId}
            flyTarget={flyTarget}
            onSelectMunicipality={handleSelectMunicipality}
          />

          <BivariateLegend
            selectedClass={selectedClass}
            onSelectClass={setSelectedClass}
            classCounts={summary?.classCounts || {}}
            yAxisShortLabel={EIXO_Y_META[eixoY].shortLabel}
          />

          <MunicipalityDrawer
            detail={munDetail}
            loading={loadingDetail}
            onClose={() => {
              setSelectedMunId(null);
              setMunDetail(null);
            }}
          />
        </section>

        <AnalyticsPanel
          summary={summary}
          eixoY={eixoY}
          selectedClass={selectedClass}
          onSelectMunicipality={handleSelectMunicipality}
        />
      </main>

      <MethodologyModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};
