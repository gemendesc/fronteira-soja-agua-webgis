from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import psycopg
from etl.config import SQL_DIR, get_database_url


def init_database() -> None:
    db_url = get_database_url()
    sql_files = sorted(SQL_DIR.glob("*.sql"))

    with psycopg.connect(db_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            for sql_file in sql_files:
                print(f"[SQL] Executando {sql_file.name}...")
                cur.execute(sql_file.read_text(encoding="utf-8"))

            cur.execute("SELECT version(), PostGIS_Full_Version();")
            pg_ver, postgis_ver = cur.fetchone()
            print(f"[OK] PostgreSQL conectado: {pg_ver.split(',')[0]}")
            print(f"[OK] PostGIS ativo: {postgis_ver.split(' ')[0]} {postgis_ver.split(' ')[1]}")


if __name__ == "__main__":
    init_database()
