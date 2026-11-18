# Fronteira Soja, Desmatamento & Água Virtual — WebGIS Analítico

Plataforma WebGIS de ponta a ponta desenvolvida para investigar espacialmente e estatisticamente o acoplamento entre **supressão de vegetação nativa (PRODES/INPE)**, **expansão agroexportadora de soja (Comex Stat / PAM-IBGE)** e **pressão sobre recursos hídricos — irrigação agrícola e exportação de água virtual (SNIRH/ANA)** nos **1.873 municípios** dos biomas **Amazônia e Cerrado** (`2013–2024`).

[![Demo Online](https://img.shields.io/badge/Acessar_WebGIS-webgis--soja.georgemendes.net-14a3b8?style=flat-square)](https://webgis-soja.georgemendes.net)
![PostGIS](https://img.shields.io/badge/PostGIS_3.5-Neon_Serverless-24292f?style=flat-square&logo=postgresql&logoColor=white)
![Python ETL](https://img.shields.io/badge/ETL-Python_%2F_GeoPandas-24292f?style=flat-square&logo=python&logoColor=white)
![MapLibre GL](https://img.shields.io/badge/WebGIS-MapLibre_GL_JS-24292f?style=flat-square&logo=maplibre&logoColor=white)
![React TypeScript](https://img.shields.io/badge/Frontend-React_%2B_TypeScript-24292f?style=flat-square&logo=react&logoColor=white)

![Preview WebGIS](docs/preview-webgis.png)

---

## 1. Tese e Rigor Metodológico

O avanço da fronteira agrícola brasileira envolve uma dimensão frequentemente invisível nas estatísticas comerciais: além da conversão direta de áreas de Cerrado e Floresta Amazônica, o embarque internacional de milhões de toneladas de grãos representa uma **transferência maciça de água virtual** (*virtual water trade*), somada à intensificação local da **agricultura irrigada por pivôs centrais** (*água azul*) em bacias estratégicas como o Oeste da Bahia (Aquífero Urucuia / Bacia do São Francisco).

Para testar essa hipótese sem distorções analíticas, o pipeline ETL trata três particularidades críticas das bases públicas brasileiras:

1. **Domicílio Fiscal (Comex Stat) vs. Produção Física (PAM/IBGE):**
   Dos **1.873 municípios** analisados, **1.222 colhem soja fisicamente** segundo o IBGE, mas apenas **312 (25%)** registram exportação direta no Comex Stat (SH4 `1201`) — deixando **934 municípios produtores zerados** no dado aduaneiro porque o faturamento ocorre via *tradings* sediadas em municípios-polo (apenas 20 cidades concentram 51% das exportações declaradas; *Balsas-MA*, por exemplo, declara quase 3× mais soja exportada do que colhe fisicamente). Por isso, o mapa adota como referência primária a **produção física e pegada hídrica da lavoura (PAM/IBGE)** — onde a correlação de Spearman com o desmatamento atinge **$\rho = +0,34$ ($p < 0,0001$)** no conjunto dos biomas e **$\rho = +0,74$ ($p < 10^{-78}$)** na fronteira ativa do **MATOPIBA** —, reservando o Comex Stat para rastrear os polos comerciais e os **países compradores da água virtual**.
2. **Água Azul (SNIRH/ANA) vs. Água Virtual Embarcada:**
   Diferencia a captação física para irrigação nos corpos hídricos municipais (*Manual de Usos Consuntivos da Água no Brasil — ANA*, em $\text{m}^3/\text{s}$ e $\text{hm}^3/\text{ano}$) da pegada hídrica total embutida na soja exportada (~$2.050\text{ m}^3/\text{t}$, segundo Hoekstra & Mekonnen), rastreando inclusive os **países compradores** desse volume hídrico virtual.
3. **Ecótonos Amazônia–Cerrado e Defasagem Temporal (*Lag*):**
   Integra as frentes **PRODES Amazônia (Floresta e Não-Floresta)** e **PRODES Cerrado** por código IBGE (`cd_mun`), permitindo avaliar defasagens temporais de `0` a `+3 anos` entre o desmatamento no ano $t$ e a consolidação produtiva/exportadora em $t + k$.

---

## 2. Arquitetura do Sistema

```mermaid
flowchart LR
    subgraph Fontes["Bases Públicas Oficiais"]
        IBGE["IBGE (Malhas v3 + Localidades + SIDRA 5457)"]
        INPE["TerraBrasilis / INPE (WFS OGC + PRODES Anual)"]
        MDIC["MDIC / Comex Stat (API Cities SH4 1201 + UF_MUN)"]
        ANA["ANA / SNIRH (Usos Consuntivos 1931–2040)"]
    end

    subgraph ETL["Pipeline ETL (/etl - Python 3.12)"]
        PY["GeoPandas + Shapely + Calamine + SciPy + Psycopg 3"]
    end

    subgraph DB["Banco Espacial Serverless (Neon)"]
        PG["PostgreSQL 17 + PostGIS 3.5 (SIRGAS 2000 / EPSG:4674)"]
        FN["Índices GiST + Views + fn_mvt_municipios (ST_AsMVT)"]
        PG --> FN
    end

    subgraph Web["Aplicação WebGIS (Vercel)"]
        API["Serverless Functions (/api/*.ts)"]
        SPA["React + TypeScript + MapLibre GL + Recharts"]
        API --> SPA
    end

    IBGE & INPE & MDIC & ANA --> PY --> PG
    FN --> API
```

---

## 3. Estrutura do Repositório

```text
fronteira-soja-agua-webgis/
├── api/                        # Endpoints Serverless (Vercel) conectados ao PostGIS
│   ├── _db.ts                  # Conexão Neon Serverless + cálculo estatístico Spearman
│   ├── geometries.ts           # Malha vetorial simplificada via ST_AsGeoJSON
│   ├── mvt.ts                  # Servidor nativo de Vector Tiles (.pbf) via ST_AsMVT
│   ├── map-summary.ts          # Agregação dinâmica com lag temporal e tercis 3x3
│   └── municipality.ts         # Série histórica 2013–2024 e países destino por cd_mun
├── etl/                        # Engenharia de Dados Espaciais em Python
│   ├── extract/                # Conectores oficiais (ibge.py, terrabrasilis.py, comexstat.py, snirh_ana.py)
│   ├── load/                   # Inicialização DDL e carga transacional via PostgreSQL COPY
│   └── run_pipeline.py         # Orquestrador completo reprodutível
├── sql/                        # Scripts SQL / PostGIS
│   ├── 01_schema_postgis.sql   # Tabelas dimensão/fato e índices espaciais GiST
│   └── 02_views_and_functions.sql # Views consolidadas e geração de Vector Tiles MVT
└── src/                        # Interface WebGIS (MapLibre GL JS + matriz bivariada 3x3 + gráficos)
```

---

## 4. Como Reproduzir Localmente

### Pré-requisitos
- **Python 3.12+** e **Node.js 20+**
- Banco **PostgreSQL 16+ com PostGIS** (ex.: instância gratuita no [Neon](https://neon.tech))

### 1. Configurar variáveis de ambiente
Copie `.env.example` para `.env` e informe sua `DATABASE_URL`:

```bash
cp .env.example .env
```

### 2. Executar o Pipeline ETL Geoespacial
```bash
python -m venv .venv
.venv\Scripts\pip install -r etl/requirements.txt
.venv\Scripts\python etl/run_pipeline.py
```

### 3. Iniciar o WebGIS e a API local
```bash
npm install
npm run dev
```

---

## 5. Principais Referências Científicas

- **Mekonnen, M. M.; Hoekstra, A. Y.** (2011). *The green, blue and grey water footprint of crops and derived crop products*. Hydrology and Earth System Sciences (HESS), 15, 1577–1600. [doi:10.5194/hess-15-1577-2011](https://doi.org/10.5194/hess-15-1577-2011)
- **Lathuillière, M. J.; Johnson, M. S.; Galford, G. L.; Couto, E. G.** (2014). *Environmental footprints show China and Europe's evolving resource appropriation for soybean production in Mato Grosso, Brazil*. Environmental Research Letters, 9(7), 074001. [doi:10.1088/1748-9326/9/7/074001](https://doi.org/10.1088/1748-9326/9/7/074001)
- **Spera, S. A.; Galford, G. L.; Coe, M. T.; Macedo, M. N.; Mustard, J. F.** (2016). *Land-use change affects water recycling in Brazil's last agricultural frontier*. Global Change Biology, 22(10), 3405–3413. [doi:10.1111/gcb.13298](https://doi.org/10.1111/gcb.13298)
- **Pousa, R.; Costa, M. H.; Pimenta, F. M. et al.** (2019). *Climate Change and Intense Irrigation Growth in Western Bahia, Brazil: The Urgent Need for Hydroclimatic Monitoring*. Water, 11(5), 933. [doi:10.3390/w11050933](https://doi.org/10.3390/w11050933)
- **Rausch, L. L.; Gibbs, H. K.; Schelly, I. et al.** (2019). *Soy expansion in Brazil's Cerrado*. Conservation Letters, 12(6), e12671. [doi:10.1111/conl.12671](https://doi.org/10.1111/conl.12671)
- **Allan, J. A.** (1998). *Virtual Water: A Strategic Resource — Global Solutions to Regional Deficits*. Ground Water, 36(4), 545–546.
- **ANA** (2019/2021). *Manual de Usos Consuntivos da Água no Brasil* & *Atlas Irrigação*. Brasília: ANA / SNIRH.

---

## Autor

**George Mendes** — Engenheiro Ambiental e Sanitarista · Especialista em Geotecnologias e Desenvolvimento WebGIS  
Portfólio: [georgemendes.net](https://georgemendes.net/) · LinkedIn: [in/gemendesc](https://www.linkedin.com/in/gemendesc)
