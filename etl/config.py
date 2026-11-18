from __future__ import annotations

import os
import re
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
SQL_DIR = ROOT_DIR / "sql"
DATA_RAW_DIR = ROOT_DIR / "etl" / "data" / "raw"
DATA_PROC_DIR = ROOT_DIR / "etl" / "data" / "processed"

DATA_RAW_DIR.mkdir(parents=True, exist_ok=True)
DATA_PROC_DIR.mkdir(parents=True, exist_ok=True)

# Coeficiente médio de pegada hídrica total da soja brasileira (m³ / tonelada)
# Referência: Hoekstra & Mekonnen (Water Footprint Network) ~ 2.050 m³/t
SOJA_WATER_FOOTPRINT_M3_PER_TON = 2050.0

# Janela analítica padrão do estudo
ANO_INICIO = 2013
ANO_FIM = 2024

# Estados que compõem o MATOPIBA e UFs com recorte do Arco do Desmatamento
UFS_MATOPIBA = {"MA", "TO", "PI", "BA"}


def get_database_url() -> str:
    """Lê e higieniza a DATABASE_URL do arquivo .env sem expor credenciais."""
    load_dotenv(ROOT_DIR / ".env", override=True)
    raw = os.getenv("DATABASE_URL", "").strip()
    if not raw:
        raise RuntimeError("DATABASE_URL não encontrada no arquivo .env.")

    # Caso o usuário tenha colado 'psql "postgresql://..."' do painel do Neon
    if raw.lower().startswith("psql "):
        raw = raw[5:].strip()

    # Remove aspas simples ou duplas externas, se existirem
    raw = raw.strip("'").strip('"').strip()

    # Extrai apenas a URI caso haja flags extras
    match = re.search(r"(postgres(?:ql)?://\S+)", raw)
    if match:
        raw = match.group(1).strip("'").strip('"')

    return raw
