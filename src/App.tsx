import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EIXO_Y_META, RECORTE_META, formatCompact, formatNumber } from "./bivariate";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { BivariateLegend } from "./components/BivariateLegend";
import { BivariateMap } from "./components/BivariateMap";
import { EditorialFindings } from "./components/EditorialFindings";
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
  const [eixoY, setEixoY] = useState<EixoYKey>("pegada_soja");
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
  const atlasRef = useRef<HTMLElement | null>(null);

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

  const handleQuickJump = useCallback(
    (nextRecorte: "matopiba" | "cerrado" | "todos", nextEixo: "pegada_soja" | "irrig_hm3" | "comex_ton") => {
      setRecorte(nextRecorte);
      setUf("TODAS");
      setEixoY(nextEixo);
      setSelectedClass(null);
      atlasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    []
  );

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

  const kpis = summary?.kpis;
  const params = summary?.params;
  const anosJanela = params ? Math.max(1, params.anoFim - params.respIni + 1) : 10;
  const pegadaKm3 = kpis ? kpis.pegada_soja_total_hm3 / 1000 : 0;
  const equivUrbanoBr = kpis ? kpis.pegada_soja_total_hm3 / anosJanela / 10800 : 0;

  return (
    <div className="page-root">
      {/* Cabeçalho Institucional Limpo */}
      <header className="site-header">
        <div className="container header-inner">
          <div className="header-brand">
            <a href="https://georgemendes.net" target="_blank" rel="noreferrer" className="brand-name">
              GEORGE MENDES
            </a>
            <span className="brand-sep">/</span>
            <span className="brand-project">ESTUDO WEBGIS · POSTGIS & DADOS ABERTOS</span>
          </div>

          <nav className="header-nav">
            <a href="#objetivo">Objetivo</a>
            <a href="#atlas">Mapa Interativo</a>
            <a href="#conclusoes">O que os dados mostram</a>
            <button type="button" className="text-nav-btn" onClick={() => setModalOpen(true)}>
              Nota Técnica & SQL
            </button>
            <a
              href="https://github.com/gemendesc/fronteira-soja-agua-webgis"
              target="_blank"
              rel="noreferrer"
              className="nav-repo-link"
            >
              GitHub ↗
            </a>
          </nav>
        </div>
      </header>

      {/* 01 · Abertura Editorial & Pergunta de Pesquisa */}
      <section id="objetivo" className="hero-section">
        <div className="container">
          <div className="eyebrow">01 · OBJETIVO E HIPÓTESE DE TRABALHO</div>
          <h1 className="hero-title">
            Desmatamento, avanço da soja e exportação de água na fronteira agrícola brasileira
          </h1>

          <div className="hero-columns">
            <p className="lead-paragraph">
              Este WebGIS investiga uma pergunta direta sobre os <strong>1.873 municípios</strong> dos biomas{" "}
              <strong>Amazônia e Cerrado</strong> entre 2013 e 2024: os territórios que mais perderam
              vegetação nativa são os mesmos onde a produção de soja mais cresceu — e quanto de recursos
              hídricos do país está embutido nessa produção voltada ao mercado externo?
            </p>
            <p className="body-paragraph">
              Para responder sem simplismos, um pipeline em Python integrou em um banco espacial{" "}
              <strong>PostGIS</strong> quatro bases públicas oficiais: o desmatamento anual do{" "}
              <strong>PRODES/INPE</strong>, a área e safra colhida da <strong>PAM/IBGE</strong>, a retirada
              de água para agricultura irrigada do <strong>SNIRH/ANA</strong> e os fluxos de comércio exterior
              do <strong>Comex Stat/MDIC</strong>. O painel abaixo permite testar diferentes recortes,
              variáveis e defasagens temporais.
            </p>
          </div>

          {/* Faixa Suíça de Números-Síntese do Recorte Ativo */}
          <div className="metrics-strip">
            <div className="metric-cell">
              <span className="mono-label">
                SUPRESSÃO NATIVA ({params ? `${params.anoIni}–${params.desmatFim}` : "2013–2022"})
              </span>
              <strong className="metric-num ink-terra">
                {kpis ? `${formatCompact(kpis.desmat_total_km2, 1)} km²` : "—"}
              </strong>
              <span className="metric-note">
                PRODES Amazônia + Cerrado em {kpis ? formatNumber(kpis.total_municipios) : "1.873"} municípios
              </span>
            </div>

            <div className="metric-cell">
              <span className="mono-label">
                SOJA COLHIDA NO SOLO ({params ? `${params.respIni}–${params.anoFim}` : "2015–2024"})
              </span>
              <strong className="metric-num">
                {kpis ? `${formatCompact(kpis.pam_total_ton, 1)} t` : "—"}
              </strong>
              <span className="metric-note">
                PAM/IBGE em {kpis ? formatNumber(kpis.mun_produtores_pam) : "1.222"} municípios produtores
              </span>
            </div>

            <div className="metric-cell">
              <span className="mono-label">PEGADA HÍDRICA DA SAFRA COLHIDA</span>
              <strong className="metric-num ink-petrol">
                {kpis ? `${formatNumber(pegadaKm3, 0)} km³` : "—"}
              </strong>
              <span className="metric-note">
                Média anual ≈ {kpis ? formatNumber(equivUrbanoBr, 1) : "—"}× todo o abastecimento urbano do Brasil
              </span>
            </div>

            <div className="metric-cell">
              <span className="mono-label">IRRIGAÇÃO AZUL (ANA) & HOTSPOTS C3</span>
              <strong className="metric-num">
                {kpis ? `${formatCompact(kpis.irrig_total_hm3, 1)} hm³` : "—"}
              </strong>
              <span className="metric-note">
                {kpis ? `${kpis.municipios_criticos_c3} municípios` : "—"} no quadrante crítico C3 (alto × alto)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 02 · Atlas Cartográfico Interativo */}
      <section id="atlas" ref={atlasRef} className="atlas-section">
        <div className="container">
          <div className="atlas-head">
            <div>
              <div className="eyebrow">02 · EXPLORAÇÃO CARTOGRÁFICA E ESTATÍSTICA</div>
              <h2 className="section-title-sm">Mapa bivariado e correlação em tempo real (PostGIS)</h2>
            </div>
            <p className="atlas-helper">
              Use os seletores para alternar entre produção física no solo, pegada hídrica, bombeamento de
              irrigação (ANA) e exportação fiscal (Comex Stat). Clique em qualquer município no mapa.
            </p>
          </div>

          {/* Barra Tabular de Controles */}
          <div className="filter-bar">
            <label className="ctrl-field">
              <span>Recorte Territorial</span>
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

            <label className="ctrl-field ctrl-wide">
              <span>Eixo Y (Variável Cruzada com o Desmatamento)</span>
              <select value={eixoY} onChange={(e) => setEixoY(e.target.value as EixoYKey)}>
                {(Object.keys(EIXO_Y_META) as EixoYKey[]).map((k) => (
                  <option key={k} value={k}>
                    {EIXO_Y_META[k].label}
                  </option>
                ))}
              </select>
            </label>

            <label
              className="ctrl-field ctrl-lag"
              title="Defasagem temporal entre desmatamento (t) e resposta agrícola/hídrica (t + lag)"
            >
              <span>Defasagem (Lag)</span>
              <select value={lag} onChange={(e) => setLag(Number(e.target.value))}>
                <option value={0}>Sem lag (0 ano)</option>
                <option value={1}>+1 ano</option>
                <option value={2}>+2 anos (padrão)</option>
                <option value={3}>+3 anos</option>
              </select>
            </label>

            <div className="ctrl-field search-wrap">
              <span>Localizar Município</span>
              <input
                type="text"
                placeholder="Ex.: São Desidério, Balsas, Sorriso..."
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
          </div>

          {/* Nota Explicativa Dinâmica da Lente Selecionada */}
          <div className={`lens-banner ${eixoY === "comex_ton" ? "lens-banner--warn" : ""}`}>
            <div>
              <strong>O que esta lente mostra ({EIXO_Y_META[eixoY].source}):</strong>{" "}
              {EIXO_Y_META[eixoY].contextNote}
            </div>
          </div>

          {/* Moldura do Mapa + Coluna Analítica */}
          <div className="atlas-frame">
            <div className="map-stage">
              {loadingSummary && (
                <div className="map-status-tag">Atualizando consulta espacial no PostGIS...</div>
              )}
              {errorMsg && <div className="map-status-tag map-status-tag--err">{errorMsg}</div>}

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
            </div>

            <AnalyticsPanel
              summary={summary}
              eixoY={eixoY}
              selectedClass={selectedClass}
              onSelectMunicipality={handleSelectMunicipality}
            />
          </div>
        </div>
      </section>

      {/* 03 · Ensaio Analítico: Conclusões & Crítica ao Comex Stat */}
      <div id="conclusoes">
        <EditorialFindings
          topCountries={summary?.topCountries || []}
          recorteLabel={RECORTE_META[recorte].label}
          onQuickJump={handleQuickJump}
        />
      </div>

      {/* Rodapé Técnico Alinhado ao Portfólio */}
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <strong className="footer-brand">GEORGE MENDES</strong>
            <p>
              Engenheiro Ambiental e Sanitarista · Especialista em Geotecnologias e Desenvolvimento WebGIS.
              Estudo demonstrativo construído com Python (GeoPandas), PostgreSQL/PostGIS (Neon), MapLibre GL JS
              e React.
            </p>
          </div>
          <div className="footer-links">
            <a href="https://georgemendes.net" target="_blank" rel="noreferrer">
              Portfólio Principal (georgemendes.net) ↗
            </a>
            <a
              href="https://github.com/gemendesc/fronteira-soja-agua-webgis"
              target="_blank"
              rel="noreferrer"
            >
              Código-Fonte, ETL & SQL no GitHub ↗
            </a>
            <a href="https://www.linkedin.com/in/gemendesc" target="_blank" rel="noreferrer">
              LinkedIn (in/gemendesc) ↗
            </a>
          </div>
        </div>
      </footer>

      <MethodologyModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};
