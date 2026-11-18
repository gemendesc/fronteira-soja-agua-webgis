import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT
        cd_mun,
        nm_mun,
        sigla_uf,
        bioma_predominante,
        fl_amazonia,
        fl_cerrado,
        fl_matopiba,
        fl_arco_desmatamento,
        area_mun_km2::float8 AS area_mun_km2,
        ROUND(ST_X(centroide)::numeric, 4)::float8 AS lon,
        ROUND(ST_Y(centroide)::numeric, 4)::float8 AS lat,
        ST_AsGeoJSON(geom_simplificada, 4)::json AS geometry
      FROM agro_hidro.dim_municipio
      ORDER BY cd_mun;
    `;

    const featureCollection = {
      type: "FeatureCollection",
      features: rows.map((r: any) => ({
        type: "Feature",
        id: r.cd_mun,
        properties: {
          cd_mun: r.cd_mun,
          nm_mun: r.nm_mun,
          sigla_uf: r.sigla_uf,
          bioma_predominante: r.bioma_predominante,
          fl_amazonia: r.fl_amazonia,
          fl_cerrado: r.fl_cerrado,
          fl_matopiba: r.fl_matopiba,
          fl_arco_desmatamento: r.fl_arco_desmatamento,
          area_mun_km2: r.area_mun_km2,
          lon: r.lon,
          lat: r.lat,
        },
        geometry: r.geometry,
      })),
    };

    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json(featureCollection);
  } catch (err: any) {
    console.error("[api/geometries] Error:", err);
    return res.status(500).json({ error: "Erro ao consultar malha espacial no PostGIS." });
  }
}
