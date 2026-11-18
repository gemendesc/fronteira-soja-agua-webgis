import type { VercelRequest, VercelResponse } from "@vercel/node";
import { computeSpearman, getSql, quantileThresholds } from "./_db.js";

type EixoY = "agua_virtual" | "comex_ton" | "pam_ton" | "irrig_hm3";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sql = getSql();

    const recorte = String(req.query.recorte || "todos").toLowerCase();
    const uf = String(req.query.uf || "TODAS").toUpperCase();
    const anoIni = Math.max(2013, Math.min(2024, Number(req.query.ano_ini || 2013)));
    const anoFim = Math.max(anoIni, Math.min(2024, Number(req.query.ano_fim || 2024)));
    const lag = Math.max(0, Math.min(3, Number(req.query.lag || 0)));
    const eixoY = (["agua_virtual", "comex_ton", "pam_ton", "irrig_hm3"].includes(
      String(req.query.eixo_y)
    )
      ? String(req.query.eixo_y)
      : "agua_virtual") as EixoY;

    // Janela com defasagem temporal (lag):
    // Desmatamento avaliado em [anoIni, desmatFim] e resposta produtiva/hídrica em [respIni, anoFim]
    const desmatFim = Math.max(anoIni, anoFim - lag);
    const respIni = Math.min(anoFim, anoIni + lag);

    const munRows = await sql`
      WITH filtro_mun AS (
        SELECT
          cd_mun, nm_mun, sigla_uf, bioma_predominante,
          fl_amazonia, fl_cerrado, fl_matopiba, fl_arco_desmatamento,
          area_mun_km2::float8 AS area_mun_km2
        FROM agro_hidro.dim_municipio
        WHERE
          (${uf} = 'TODAS' OR sigla_uf = ${uf})
          AND (
            ${recorte} = 'todos'
            OR (${recorte} = 'matopiba' AND fl_matopiba = TRUE)
            OR (${recorte} = 'arco' AND fl_arco_desmatamento = TRUE)
            OR (${recorte} = 'amazonia' AND fl_amazonia = TRUE)
            OR (${recorte} = 'cerrado' AND fl_cerrado = TRUE)
          )
      ),
      desmat AS (
        SELECT
          f.cd_mun,
          COALESCE(SUM(f.prodes_incr_km2), 0)::float8 AS desmat_km2,
          COALESCE(MAX(f.prodes_acum_km2), 0)::float8 AS desmat_acum_km2
        FROM agro_hidro.fato_anual_municipio f
        INNER JOIN filtro_mun m ON m.cd_mun = f.cd_mun
        WHERE f.ano BETWEEN ${anoIni} AND ${desmatFim}
        GROUP BY f.cd_mun
      ),
      resposta AS (
        SELECT
          f.cd_mun,
          COALESCE(SUM(f.comex_soja_exp_ton), 0)::float8 AS comex_ton,
          COALESCE(SUM(f.comex_soja_fob_usd), 0)::float8 AS comex_usd,
          COALESCE(SUM(f.soja_producao_ton), 0)::float8 AS pam_ton,
          COALESCE(MAX(f.soja_area_plantada_ha), 0)::float8 AS pam_area_max_ha,
          COALESCE(SUM(f.agua_virtual_exp_hm3), 0)::float8 AS agua_virtual_hm3,
          COALESCE(SUM(f.agua_irrig_hm3_ano), 0)::float8 AS irrig_hm3,
          COALESCE(AVG(f.ana_irrig_retirada_m3s), 0)::float8 AS irrig_m3s_media
        FROM agro_hidro.fato_anual_municipio f
        INNER JOIN filtro_mun m ON m.cd_mun = f.cd_mun
        WHERE f.ano BETWEEN ${respIni} AND ${anoFim}
        GROUP BY f.cd_mun
      )
      SELECT
        m.cd_mun,
        m.nm_mun,
        m.sigla_uf,
        m.bioma_predominante,
        m.fl_matopiba,
        m.fl_arco_desmatamento,
        m.area_mun_km2,
        COALESCE(d.desmat_km2, 0) AS desmat_km2,
        COALESCE(d.desmat_acum_km2, 0) AS desmat_acum_km2,
        COALESCE(r.comex_ton, 0) AS comex_ton,
        COALESCE(r.comex_usd, 0) AS comex_usd,
        COALESCE(r.pam_ton, 0) AS pam_ton,
        COALESCE(r.pam_area_max_ha, 0) AS pam_area_max_ha,
        COALESCE(r.agua_virtual_hm3, 0) AS agua_virtual_hm3,
        COALESCE(r.irrig_hm3, 0) AS irrig_hm3,
        COALESCE(r.irrig_m3s_media, 0) AS irrig_m3s_media
      FROM filtro_mun m
      LEFT JOIN desmat d ON d.cd_mun = m.cd_mun
      LEFT JOIN resposta r ON r.cd_mun = m.cd_mun
      ORDER BY COALESCE(r.agua_virtual_hm3, 0) DESC, COALESCE(d.desmat_km2, 0) DESC;
    `;

    const serieRows = await sql`
      SELECT
        f.ano::int AS ano,
        ROUND(SUM(f.prodes_incr_km2)::numeric, 2)::float8 AS desmat_km2,
        ROUND((SUM(f.comex_soja_exp_ton) / 1e6)::numeric, 3)::float8 AS comex_mton,
        ROUND((SUM(f.soja_producao_ton) / 1e6)::numeric, 3)::float8 AS pam_mton,
        ROUND(SUM(f.agua_virtual_exp_hm3)::numeric, 2)::float8 AS agua_virtual_hm3,
        ROUND(SUM(f.agua_irrig_hm3_ano)::numeric, 2)::float8 AS irrig_hm3
      FROM agro_hidro.fato_anual_municipio f
      INNER JOIN agro_hidro.dim_municipio m ON m.cd_mun = f.cd_mun
      WHERE
        (${uf} = 'TODAS' OR m.sigla_uf = ${uf})
        AND (
          ${recorte} = 'todos'
          OR (${recorte} = 'matopiba' AND m.fl_matopiba = TRUE)
          OR (${recorte} = 'arco' AND m.fl_arco_desmatamento = TRUE)
          OR (${recorte} = 'amazonia' AND m.fl_amazonia = TRUE)
          OR (${recorte} = 'cerrado' AND m.fl_cerrado = TRUE)
        )
      GROUP BY f.ano
      ORDER BY f.ano;
    `;

    const paisRows = await sql`
      SELECT
        d.nm_pais_pt AS pais,
        ROUND(SUM(d.exp_soja_ton)::numeric, 0)::float8 AS exp_soja_ton,
        ROUND(SUM(d.exp_fob_usd)::numeric, 0)::float8 AS exp_fob_usd,
        ROUND(SUM(d.agua_virtual_hm3)::numeric, 2)::float8 AS agua_virtual_hm3
      FROM agro_hidro.fato_destino_exportacao d
      INNER JOIN agro_hidro.dim_municipio m ON m.cd_mun = d.cd_mun
      WHERE
        d.ano BETWEEN ${respIni} AND ${anoFim}
        AND (${uf} = 'TODAS' OR m.sigla_uf = ${uf})
        AND (
          ${recorte} = 'todos'
          OR (${recorte} = 'matopiba' AND m.fl_matopiba = TRUE)
          OR (${recorte} = 'arco' AND m.fl_arco_desmatamento = TRUE)
          OR (${recorte} = 'amazonia' AND m.fl_amazonia = TRUE)
          OR (${recorte} = 'cerrado' AND m.fl_cerrado = TRUE)
        )
      GROUP BY d.nm_pais_pt
      ORDER BY SUM(d.agua_virtual_hm3) DESC
      LIMIT 8;
    `;

    const pickY = (r: any): number => {
      switch (eixoY) {
        case "comex_ton":
          return r.comex_ton;
        case "pam_ton":
          return r.pam_ton;
        case "irrig_hm3":
          return r.irrig_hm3;
        case "agua_virtual":
        default:
          return r.agua_virtual_hm3;
      }
    };

    const posX = munRows.map((r: any) => r.desmat_km2).filter((v: number) => v > 0);
    const posY = munRows.map((r: any) => pickY(r)).filter((v: number) => v > 0);
    const [qx1, qx2] = quantileThresholds(posX);
    const [qy1, qy2] = quantileThresholds(posY);

    const classCounts: Record<string, number> = {};
    const enriched = munRows.map((r: any) => {
      const valX = r.desmat_km2;
      const valY = pickY(r);

      const tierX = valX <= qx1 ? "1" : valX <= qx2 ? "2" : "3";
      const tierY = valY <= qy1 ? "A" : valY <= qy2 ? "B" : "C";
      const bivClass = valX === 0 && valY === 0 ? "A1" : `${tierY}${tierX}`;
      classCounts[bivClass] = (classCounts[bivClass] || 0) + 1;

      return {
        ...r,
        y_value: valY,
        biv_class: bivClass,
      };
    });

    // Correlação calculada sobre municípios com presença da cultura/indicador no recorte
    const activeForCorr = enriched.filter((r: any) => r.y_value > 0 || r.pam_ton > 0);
    const corrPool = activeForCorr.length >= 10 ? activeForCorr : enriched;
    const spearman = computeSpearman(
      corrPool.map((r: any) => r.desmat_km2),
      corrPool.map((r: any) => r.y_value)
    );

    const kpis = enriched.reduce(
      (acc: any, r: any) => {
        acc.total_municipios += 1;
        acc.desmat_total_km2 += r.desmat_km2;
        acc.comex_total_ton += r.comex_ton;
        acc.comex_total_usd += r.comex_usd;
        acc.pam_total_ton += r.pam_ton;
        acc.agua_virtual_total_hm3 += r.agua_virtual_hm3;
        acc.irrig_total_hm3 += r.irrig_hm3;
        if (r.biv_class === "C3") acc.municipios_criticos_c3 += 1;
        return acc;
      },
      {
        total_municipios: 0,
        municipios_criticos_c3: 0,
        desmat_total_km2: 0,
        comex_total_ton: 0,
        comex_total_usd: 0,
        pam_total_ton: 0,
        agua_virtual_total_hm3: 0,
        irrig_total_hm3: 0,
      }
    );

    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
    return res.status(200).json({
      params: { recorte, uf, anoIni, anoFim, desmatFim, respIni, lag, eixoY },
      thresholds: { x: [qx1, qx2], y: [qy1, qy2] },
      kpis,
      correlation: spearman,
      classCounts,
      topCountries: paisRows,
      regionalSeries: serieRows,
      municipalities: enriched,
    });
  } catch (err: any) {
    console.error("[api/map-summary] Error:", err);
    return res.status(500).json({ error: "Erro ao processar consulta analítica no PostGIS." });
  }
}
