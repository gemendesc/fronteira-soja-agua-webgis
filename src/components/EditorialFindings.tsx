import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatNumber } from "../bivariate";

interface CountryFlow {
  pais: string;
  exp_soja_ton: number;
  exp_fob_usd: number;
  agua_virtual_hm3: number;
}

interface Props {
  topCountries: CountryFlow[];
  recorteLabel: string;
  onQuickJump: (recorte: "matopiba" | "cerrado" | "todos", eixoY: "pegada_soja" | "irrig_hm3" | "comex_ton") => void;
}

export const EditorialFindings: React.FC<Props> = ({
  topCountries,
  recorteLabel,
  onQuickJump,
}) => {
  return (
    <section className="editorial-section">
      <div className="container">
        <div className="eyebrow">03 · ANÁLISE DOS RESULTADOS & LIMITES METODOLÓGICOS</div>
        <h2 className="section-title">
          O que os dados mostram — e o que realmente podemos (ou não) concluir
        </h2>
        <p className="lead-paragraph">
          Cruzar bases oficiais de natureza distinta exige separar evidência empírica de intuição inicial. Ao
          integrar os registros de <strong>1.873 municípios</strong> da Amazônia e do Cerrado entre 2013 e
          2024 no PostGIS, emergem três conclusões consistentes e uma ressalva metodológica fundamental sobre
          o uso de dados fiscais de comércio exterior.
        </p>

        <div className="findings-grid">
          <article className="finding-card">
            <span className="finding-num">ACHADO 01 · FRONTEIRA ATIVA VS. ÁREA CONSOLIDADA</span>
            <h3>A correlação existe e é forte nas frentes recentes — sobretudo no MATOPIBA (ρ = +0,74)</h3>
            <p>
              Quando observamos os dois biomas inteiros de uma só vez, a correlação de Spearman entre
              supressão recente (PRODES) e produção física de soja (PAM/IBGE) é{" "}
              <strong>positiva e moderada (ρ = +0,33; p &lt; 0,0001)</strong>. Isso ocorre porque o Centro-Sul
              do Cerrado (Goiás, Mato Grosso do Sul, Triângulo Mineiro e São Paulo — classe{" "}
              <strong>C1</strong>, em azul-petróleo no mapa) colhe volumes expressivos hoje sobre terras cuja
              vegetação nativa foi convertida <em>antes de 2013</em>.
            </p>
            <p>
              Porém, ao isolar a fronteira agrícola ativa do{" "}
              <strong>MATOPIBA (Maranhão, Tocantins, Piauí e Bahia)</strong>, o acoplamento salta para{" "}
              <strong>ρ = +0,74 (p &lt; 10⁻⁷⁸)</strong>, liderado por municípios como{" "}
              <em>Formosa do Rio Preto (BA)</em>, <em>São Desidério (BA)</em>, <em>Balsas (MA)</em>,{" "}
              <em>Baixa Grande do Ribeiro (PI)</em> e <em>Uruçuí (PI)</em>. Na Amazônia, a soja avança
              fortemente em polos como <em>Paranatinga</em> e <em>Nova Ubiratã (MT)</em>, enquanto frentes
              mais internas (classe <strong>A3</strong>, terracota) seguem dominadas por abertura para
              pecuária extensiva.
            </p>
            <button
              type="button"
              className="inline-action-btn"
              onClick={() => onQuickJump("matopiba", "pegada_soja")}
            >
              Ver recorte MATOPIBA no mapa ↑
            </button>
          </article>

          <article className="finding-card">
            <span className="finding-num">ACHADO 02 · ÁGUA VERDE VS. ÁGUA AZUL (SNIRH/ANA)</span>
            <h3>Nem toda soja drena rios — mas o Oeste da Bahia concentra conflito hídrico severo</h3>
            <p>
              É preciso rigor hidrológico ao falar em &ldquo;exportação de água&rdquo;. Mais de 90% da área de
              soja no Brasil opera em regime de <strong>sequeiro</strong>: a água virtual embarcada nos grãos
              (~2.050 m³ por tonelada) corresponde majoritariamente à <strong>água verde</strong> (umidade do
              solo proveniente da chuva que antes sustentava a evapotranspiração do Cerrado e da floresta).
              Por isso, na escala geral, soja e irrigação não apresentam correlação linear simples.
            </p>
            <p>
              Entretanto, quando mudamos o mapa para a lente de{" "}
              <strong>Retirada para Agricultura Irrigada (SNIRH/ANA — água azul)</strong>, surge um epicentro
              crítico: <strong>5 dos 10 municípios que mais bombeiam água para irrigação</strong> em todo o
              recorte situam-se no <strong>Oeste da Bahia</strong>, sobre o{" "}
              <strong>Sistema Aquífero Urucuia</strong> (<em>Barreiras</em>, <em>São Desidério</em>,{" "}
              <em>Jaborandi</em>, <em>Luís Eduardo Magalhães</em> e <em>Riachão das Neves</em>), ao lado de{" "}
              <em>Paracatu</em> e <em>Unaí (MG)</em> e <em>Cristalina (GO)</em>. Nesses territórios, há
              sobreposição real entre perda de áreas de recarga nativa, expansão de pivôs centrais e pressão
              sobre vazões de base.
            </p>
            <button
              type="button"
              className="inline-action-btn"
              onClick={() => onQuickJump("cerrado", "irrig_hm3")}
            >
              Alternar mapa para Irrigação Azul (ANA) ↑
            </button>
          </article>

          <article className="finding-card finding-card--wide">
            <div className="wide-split">
              <div>
                <span className="finding-num">
                  ACHADO 03 · POR QUE O COMEX STAT MUNICIPAL ZERA MUNICÍPIOS PRODUTORES?
                </span>
                <h3>
                  O viés do domicílio fiscal: 934 municípios plantam soja, mas aparecem zerados no Comex Stat
                </h3>
                <p>
                  Ao inspecionar municípios individualmente na base do{" "}
                  <strong>Comex Stat / MDIC (SH4 1201)</strong>, observa-se que centenas de municípios com
                  vastas áreas agrícolas aparecem com <strong>zero tonelada exportada</strong>. O cruzamento
                  com a <strong>Pesquisa Agrícola Municipal (PAM/IBGE)</strong> explica exatamente o motivo:
                </p>
                <ul className="editorial-list">
                  <li>
                    Dos <strong>1.873 municípios</strong> analisados, <strong>1.222 colhem soja</strong>{" "}
                    fisicamente segundo o IBGE, mas apenas <strong>312 (25%)</strong> possuem registro no
                    Comex Stat. Ou seja, <strong>934 municípios produtores ficam invisíveis</strong> se
                    usarmos apenas o dado aduaneiro.
                  </li>
                  <li>
                    Isso acontece porque o Comex Stat registra o{" "}
                    <strong>município do domicílio fiscal da empresa exportadora</strong> (armazéns gerais e
                    escritórios regionais de <em>tradings</em>), e não a fazenda onde o grão cresceu. Apenas{" "}
                    <strong>20 municípios-polo concentram 51%</strong> de toda a soja declarada.
                  </li>
                  <li>
                    Exemplo real na base: entre 2015 e 2024, <em>Balsas (MA)</em> colheu{" "}
                    <strong>5,5 milhões de t</strong> na lavoura (PAM), mas declarou{" "}
                    <strong>15,2 milhões de t</strong> exportadas no Comex Stat (quase 3× a própria safra,
                    absorvendo a produção vizinha). Já <em>São Desidério (BA)</em> colheu{" "}
                    <strong>15,2 milhões de t</strong>, mas faturou diretamente apenas{" "}
                    <strong>1,65 milhão de t</strong>.
                  </li>
                </ul>
                <p>
                  <strong>Conclusão prática de engenharia de dados:</strong> o Comex Stat não deve ser usado
                  isoladamente para medir impacto territorial no município, mas é indispensável para rastrear{" "}
                  <strong>para quais países essa água virtual está sendo embarcada</strong> (ao lado).
                </p>
              </div>

              <div className="countries-card">
                <div className="countries-head">
                  <span className="mono-label">DESTINO INTERNACIONAL · COMEX STAT</span>
                  <h4>Compradores da água virtual ({recorteLabel})</h4>
                </div>
                <ResponsiveContainer width="100%" height={255}>
                  <BarChart
                    data={topCountries}
                    layout="vertical"
                    margin={{ top: 4, right: 16, bottom: 4, left: 18 }}
                  >
                    <CartesianGrid strokeDasharray="2 2" stroke="#cbd0cc" />
                    <XAxis
                      type="number"
                      tick={{ fill: "#3d454b", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="pais"
                      width={105}
                      tick={{ fill: "#1e2328", fontSize: 11, fontWeight: 500 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1e2328",
                        color: "#eceeeb",
                        border: "none",
                        borderRadius: 2,
                        fontSize: 12,
                      }}
                      formatter={(val: any) => [`${formatNumber(Number(val), 1)} hm³`, "Água Virtual"]}
                    />
                    <Bar dataKey="agua_virtual_hm3" fill="#24506b" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="chart-caption">
                  Volume estimado de água virtual embarcada (hm³ = milhões de m³) a partir dos fluxos
                  municipais declarados no recorte selecionado. A China responde sozinha por mais de 70% da
                  demanda externa.
                </p>
              </div>
            </div>
          </article>
        </div>

        {/* Bloco honesto de limitações */}
        <div className="limitations-box">
          <span className="mono-label">LIMITAÇÕES E PRÓXIMOS PASSOS ANALÍTICOS</span>
          <p>
            <strong>O que este estudo NÃO prova sozinho:</strong> (1) A correlação em nível municipal mostra
            coocorrência territorial, mas não substitui o cruzamento espacial polígono a polígono (como
            sobrepor cicatrizes anuais do PRODES diretamente às máscaras de soja do MapBiomas/CONAB), pois na
            Amazônia é frequente a transição indireta <em>floresta → pastagem → soja</em>; (2) Os dados de
            irrigação da ANA (SNIRH) retratam a demanda de todo o setor agrícola irrigado municipal (incluindo
            algodão, milho, café e feijão em rotação nos mesmos pivôs), e a série pós-2020 incorpora projeções
            oficiais do Manual de Usos Consuntivos; (3) Para atribuir fluxos comerciais a municípios sem sede
            exportadora, modelos como o <em> SEI-PCS / Trase</em> combinam matrizes logísticas de rodovias,
            armazéns e portos.
          </p>
        </div>
      </div>
    </section>
  );
};
