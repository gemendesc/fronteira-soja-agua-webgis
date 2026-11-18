import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cdMun = String(req.query.cd_mun || "").trim();
  if (!/^\d{7}$/.test(cdMun)) {
    return res.status(400).json({ error: "Código IBGE municipal (cd_mun) inválido." });
  }

  try {
    const sql = getSql();

    const metaRows = await sql`
      SELECT
        cd_mun,
        nm_mun,
        sigla_uf,
        nm_regiao,
        bioma_predominante,
        fl_amazonia,
        fl_cerrado,
        fl_matopiba,
        fl_arco_desmatamento,
        area_mun_km2::float8 AS area_mun_km2,
        ROUND(ST_X(centroide)::numeric, 4)::float8 AS lon,
        ROUND(ST_Y(centroide)::numeric, 4)::float8 AS lat
      FROM agro_hidro.dim_municipio
      WHERE cd_mun = ${cdMun};
    `;

    if (metaRows.length === 0) {
      return res.status(404).json({ error: "Município não encontrado no recorte." });
    }

    const serieRows = await sql`
      SELECT
        ano::int AS ano,
        prodes_incr_km2::float8 AS prodes_incr_km2,
        prodes_acum_km2::float8 AS prodes_acum_km2,
        soja_area_plantada_ha::float8 AS soja_area_plantada_ha,
        soja_producao_ton::float8 AS soja_producao_ton,
        comex_soja_exp_ton::float8 AS comex_soja_exp_ton,
        comex_soja_fob_usd::float8 AS comex_soja_fob_usd,
        ana_irrig_retirada_m3s::float8 AS ana_irrig_retirada_m3s,
        ana_irrig_consumo_m3s::float8 AS ana_irrig_consumo_m3s,
        agua_irrig_hm3_ano::float8 AS agua_irrig_hm3_ano,
        agua_virtual_exp_hm3::float8 AS agua_virtual_exp_hm3,
        status_serie_ana
      FROM agro_hidro.fato_anual_municipio
      WHERE cd_mun = ${cdMun}
      ORDER BY ano;
    `;

    const destRows = await sql`
      SELECT
        nm_pais_pt AS pais,
        ROUND(SUM(exp_soja_ton)::numeric, 1)::float8 AS exp_soja_ton,
        ROUND(SUM(exp_fob_usd)::numeric, 0)::float8 AS exp_fob_usd,
        ROUND(SUM(agua_virtual_hm3)::numeric, 2)::float8 AS agua_virtual_hm3
      FROM agro_hidro.fato_destino_exportacao
      WHERE cd_mun = ${cdMun}
      GROUP BY nm_pais_pt
      ORDER BY SUM(agua_virtual_hm3) DESC
      LIMIT 8;
    `;

    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({
      municipio: metaRows[0],
      series: serieRows,
      topDestinations: destRows,
    });
  } catch (err) {
    console.error("[api/municipality] Error:", err);
    return res.status(500).json({ error: "Erro ao consultar série municipal no PostGIS." });
  }
}
