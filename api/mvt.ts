import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "./_db.js";

/** Endpoint nativo de Vector Tiles (MVT .pbf) gerados diretamente pelo PostGIS */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const z = Number(req.query.z ?? 4);
  const x = Number(req.query.x ?? 5);
  const y = Number(req.query.y ?? 8);

  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 16) {
    return res.status(400).json({ error: "Coordenadas Z/X/Y inválidas." });
  }

  try {
    const sql = getSql();
    const rows = await sql`SELECT encode(agro_hidro.fn_mvt_municipios(${z}, ${x}, ${y}), 'base64') AS mvt_b64;`;
    const b64 = rows[0]?.mvt_b64 || "";
    const buf = Buffer.from(b64, "base64");

    res.setHeader("Content-Type", "application/vnd.mapbox-vector-tile");
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).send(buf);
  } catch (err) {
    console.error("[api/mvt] Error:", err);
    return res.status(500).json({ error: "Erro ao gerar Vector Tile no PostGIS." });
  }
}
