import React from "react";

interface ReferenceItem {
  authors: string;
  year: string;
  title: string;
  venue: string;
  doiUrl?: string;
  doiLabel?: string;
  relevance: string;
}

const REFERENCES: ReferenceItem[] = [
  {
    authors: "MEKONNEN, M. M.; HOEKSTRA, A. Y.",
    year: "2011",
    title: "The green, blue and grey water footprint of crops and derived crop products",
    venue: "Hydrology and Earth System Sciences (HESS), v. 15, p. 1577–1600",
    doiUrl: "https://doi.org/10.5194/hess-15-1577-2011",
    doiLabel: "10.5194/hess-15-1577-2011",
    relevance:
      "Base metodológica global que quantifica a pegada hídrica verde, azul e cinza das culturas agrícolas, fundamentando o fator médio (~2.050 m³/t) adotado para estimar o volume hídrico embutido na soja.",
  },
  {
    authors: "LATHUILLIÈRE, M. J.; JOHNSON, M. S.; GALFORD, G. L.; COUTO, E. G.",
    year: "2014",
    title:
      "Environmental footprints show China and Europe's evolving resource appropriation for soybean production in Mato Grosso, Brazil",
    venue: "Environmental Research Letters, v. 9, n. 7, 074001",
    doiUrl: "https://doi.org/10.1088/1748-9326/9/7/074001",
    doiLabel: "10.1088/1748-9326/9/7/074001",
    relevance:
      "Demonstra como a demanda asiática e europeia reconfigurou a apropriação de terra e fluxos de água virtual no arco sul-amazônico e no Cerrado mato-grossense.",
  },
  {
    authors: "SPERA, S. A.; GALFORD, G. L.; COE, M. T.; MACEDO, M. N.; MUSTARD, J. F.",
    year: "2016",
    title: "Land-use change affects water recycling in Brazil's last agricultural frontier",
    venue: "Global Change Biology, v. 22, n. 10, p. 3405–3413",
    doiUrl: "https://doi.org/10.1111/gcb.13298",
    doiLabel: "10.1111/gcb.13298",
    relevance:
      "Comprova que, mesmo sem irrigação (sequeiro), substituir a vegetação nativa de raízes profundas do Cerrado por lavouras sazonais no MATOPIBA reduz a evapotranspiração na estação seca e altera a reciclagem regional de chuvas.",
  },
  {
    authors: "POUSA, R.; COSTA, M. H.; PIMENTA, F. M. et al.",
    year: "2019",
    title:
      "Climate Change and Intense Irrigation Growth in Western Bahia, Brazil: The Urgent Need for Hydroclimatic Monitoring",
    venue: "Water, v. 11, n. 5, 933",
    doiUrl: "https://doi.org/10.3390/w11050933",
    doiLabel: "10.3390/w11050933",
    relevance:
      "Documenta a combinação de tendência climática secante e expansão acelerada de pivôs centrais sobre o Sistema Aquífero Urucuia, explicando o cluster crítico de demanda hídrica observado no Oeste da Bahia.",
  },
  {
    authors: "RAUSCH, L. L.; GIBBS, H. K.; SCHELLY, I. et al.",
    year: "2019",
    title: "Soy expansion in Brazil's Cerrado",
    venue: "Conservation Letters, v. 12, n. 6, e12671",
    doiUrl: "https://doi.org/10.1111/conl.12671",
    doiLabel: "10.1111/conl.12671",
    relevance:
      "Evidencia por sensoriamento remoto que, enquanto mecanismos de governança frearam a conversão direta para soja na Amazônia, a expansão sobre vegetação nativa deslocou-se fortemente para o Cerrado — especialmente no MATOPIBA.",
  },
  {
    authors: "ALLAN, J. A.",
    year: "1998",
    title: "Virtual Water: A Strategic Resource — Global Solutions to Regional Deficits",
    venue: "Ground Water, v. 36, n. 4, p. 545–546",
    doiUrl: "https://doi.org/10.1111/j.1745-6584.1998.tb02825.x",
    doiLabel: "10.1111/j.1745-6584.1998.tb02825.x",
    relevance:
      "Artigo seminal que formulou o conceito de comércio de água virtual (transferência indireta de recursos hídricos embutidos em commodities agrícolas comercializadas internacionalmente).",
  },
  {
    authors: "AGÊNCIA NACIONAL DE ÁGUAS E SANEAMENTO BÁSICO (ANA)",
    year: "2019 / 2021",
    title:
      "Manual de Usos Consuntivos da Água no Brasil & Atlas Irrigação: Uso da Água na Agricultura Irrigada (2ª ed.)",
    venue: "Brasília: ANA / SNIRH",
    doiUrl: "https://www.snirh.gov.br/usos-da-agua/",
    doiLabel: "snirh.gov.br/usos-da-agua",
    relevance:
      "Referência técnica oficial para as estimativas municipais de vazão de retirada e consumo na agricultura irrigada utilizadas no banco espacial deste projeto.",
  },
];

export const LiteratureSection: React.FC = () => {
  return (
    <section id="referencias" className="literature-section">
      <div className="container">
        <div className="eyebrow">04 · EMBASAMENTO CIENTÍFICO E REVISÃO DA LITERATURA</div>
        <h2 className="section-title">
          O que a literatura hidrológica e ambiental já estabeleceu sobre soja, desmatamento e água virtual
        </h2>

        <div className="lit-synthesis-grid">
          <div className="lit-pillar">
            <span className="mono-label">EIXO TEÓRICO A · COMÉRCIO DE ÁGUA VIRTUAL</span>
            <h3>Exportar grãos é exportar disponibilidade hídrica territorial</h3>
            <p>
              Desde a formulação original de <strong>Allan (1998)</strong> e a sistematização quantitativa de{" "}
              <strong>Mekonnen &amp; Hoekstra (2011)</strong>, a hidrologia reconhece que países importadores de
              grãos poupam seus próprios aquíferos e rios ao externalizar a demanda evaporativa para regiões
              exportadoras. Aplicando essa métrica ao Mato Grosso,{" "}
              <strong>Lathuillière et al. (2014)</strong> demonstraram a escala da apropriação de água verde e
              terra associada às compras chinesas e europeias — padrão que nosso cruzamento confirma e amplia
              para todo o eixo Amazônia–Cerrado até 2024.
            </p>
          </div>

          <div className="lit-pillar">
            <span className="mono-label">EIXO TEÓRICO B · RECICLAGEM DE CHUVAS (ÁGUA VERDE)</span>
            <h3>Mesmo sem irrigação, desmatar para plantar soja altera o ciclo hidrológico</h3>
            <p>
              Um argumento recorrente é que a soja de sequeiro não impactaria recursos hídricos por usar apenas
              água da chuva. Estudos como o de <strong>Spera et al. (2016)</strong> no MATOPIBA refutam essa
              simplificação: árvores e arbustos nativos do Cerrado possuem raízes profundas que bombeiam umidade
              subterrânea para a atmosfera durante a estiagem. Sua substituição por monoculturas anuais (que
              deixam o solo exposto parte do ano) derruba a evapotranspiração de estação seca, reduzindo a
              reciclagem de vapor que alimenta chuvas a sotavento.
            </p>
          </div>

          <div className="lit-pillar">
            <span className="mono-label">EIXO TEÓRICO C · GOVERNANÇA E CONFLITOS DE ÁGUA AZUL</span>
            <h3>Vazamento espacial para o Cerrado e pressão sobre o Aquífero Urucuia</h3>
            <p>
              <strong>Rausch et al. (2019)</strong> mostram que restrições de mercado como a Moratória da Soja
              reduziram o desmatamento direto para soja na Amazônia, mas parte da expansão migrou para o Cerrado
              norte (onde o Código Florestal exige menor reserva legal), explicando o{" "}
              <strong>ρ = +0,74</strong> encontrado no MATOPIBA. Em paralelo,{" "}
              <strong>Pousa et al. (2019)</strong> evidenciam que, no Oeste da Bahia, a multiplicação de pivôs
              centrais somada à redução de precipitação vem pressionando as vazões dos rios tributários do São
              Francisco — exatamente o polo destacado pelos dados da ANA em nosso mapa.
            </p>
          </div>
        </div>

        <div className="references-block">
          <h3 className="ref-heading">Referências Bibliográficas Consultadas</h3>
          <ol className="ref-list">
            {REFERENCES.map((ref) => (
              <li key={ref.title} className="ref-item">
                <div className="ref-citation">
                  <strong>{ref.authors}</strong> ({ref.year}). {ref.title}. <em>{ref.venue}</em>.{" "}
                  {ref.doiUrl && (
                    <a href={ref.doiUrl} target="_blank" rel="noreferrer" className="ref-doi">
                      [{ref.doiLabel} ↗]
                    </a>
                  )}
                </div>
                <p className="ref-note">{ref.relevance}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
};
