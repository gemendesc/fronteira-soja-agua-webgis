from __future__ import annotations

import httpx
import pandas as pd
from python_calamine import CalamineWorkbook

from etl.config import ANO_FIM, ANO_INICIO, DATA_RAW_DIR

ANA_XLSX_URL = (
    "https://metadados.snirh.gov.br/files/"
    "5146c9ec-5589-4af1-bd64-d34848f484fd/"
    "ANA_DemandaHidrica_Municipio_1931a2040_env.xlsx"
)
SECONDS_PER_YEAR_MILLIONS = 31.536  # 1 m³/s contínuo = 31,536 hm³/ano


def fetch_snirh_irrigacao(valid_cd_muns: set[str]) -> pd.DataFrame:
    """
    Extrai Vazão de Retirada e Vazão de Consumo para Agricultura Irrigada (m³/s)
    da série oficial de Usos Consuntivos da Água por Município (SNIRH / ANA),
    convertendo também para volume anual equivalente (hm³/ano).
    """
    cache_csv = DATA_RAW_DIR / "ana_snirh_irrigacao_2013_2024.csv"
    if cache_csv.exists():
        print(f"[SNIRH/ANA] Lendo demanda hídrica de irrigação em cache: {cache_csv.name}")
        return pd.read_csv(cache_csv, dtype={"cd_mun": str})

    xlsx_path = DATA_RAW_DIR / "ANA_DemandaHidrica_Municipio_1931a2040_env.xlsx"
    if not xlsx_path.exists():
        print("[SNIRH/ANA] Baixando planilha oficial ANA Usos Consuntivos (metadados.snirh.gov.br)...")
        with httpx.Client(timeout=180.0, verify=False, follow_redirects=True) as client:
            with client.stream("GET", ANA_XLSX_URL) as resp:
                resp.raise_for_status()
                with open(xlsx_path, "wb") as f:
                    for chunk in resp.iter_bytes(chunk_size=1024 * 512):
                        f.write(chunk)

    print("[SNIRH/ANA] Processando aba _SERIEHISTORICA_FINAL_20220621_ via Calamine...")
    wb = CalamineWorkbook.from_path(str(xlsx_path))
    rows = wb.get_sheet_by_name("_SERIEHISTORICA_FINAL_20220621_").to_python()
    header = [str(h).strip() for h in rows[0]]
    col_idx = {name: i for i, name in enumerate(header)}

    idx_ano = col_idx["aa_ref"]
    idx_mun = col_idx["mun_cd_atual"]
    idx_ret_ir = col_idx["retirada_ir_m3_s"]
    idx_con_ir = col_idx["consumo_ir_m3_s"]

    parsed = []
    for r in rows[1:]:
        if not r or r[idx_ano] is None or r[idx_mun] is None:
            continue
        ano = int(float(r[idx_ano]))
        if ano < ANO_INICIO or ano > ANO_FIM:
            continue
        cd_mun = str(int(float(r[idx_mun]))).zfill(7)
        if cd_mun not in valid_cd_muns:
            continue

        q_ret = float(r[idx_ret_ir] or 0.0)
        q_con = float(r[idx_con_ir] or 0.0)
        vol_hm3 = q_ret * SECONDS_PER_YEAR_MILLIONS

        parsed.append(
            {
                "cd_mun": cd_mun,
                "ano": ano,
                "ana_irrig_retirada_m3s": round(q_ret, 5),
                "ana_irrig_consumo_m3s": round(q_con, 5),
                "agua_irrig_hm3_ano": round(vol_hm3, 4),
                # Série histórica consolidada ANA até 2020; 2021+ estimativa/projeção oficial ANA
                "status_serie_ana": "observado" if ano <= 2020 else "estimado",
            }
        )

    df_out = pd.DataFrame(parsed).drop_duplicates(["cd_mun", "ano"])
    df_out.to_csv(cache_csv, index=False)
    print(f"[SNIRH/ANA] {len(df_out)} registros municipais anuais de irrigação salvos.")
    return df_out
