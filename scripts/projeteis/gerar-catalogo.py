"""Gera o catálogo local a partir dos documentos periciais fornecidos pelo usuário."""

import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook


PASTA = Path(sys.argv[1])
DESTINO = Path(__file__).resolve().parents[2] / "src/shared/catalogos/projeteis.catalogo.ts"
PDF = "tabela de calibres_balistica forense_final.pdf"
PLANILHA = "Tabela Projéteis (PERICIA AMAZONAS).xlsx"
PESO = "Tabela Peso x Calibre.xlsx"


def numero(valor):
    return round(valor, 4) if isinstance(valor, (int, float)) and valor > 0 else None


def sigla(texto):
    encontro = re.search(r"\b(CHOG|CHPP|CHCV|CSCV|ETOG|ETPP|EXPP|EXPO|CXPO|NTA|OTM|SAT|SEPO|SEPP|CHPO|ETP|ESCV|EOOG|EXOG|ETPT)\b", texto or "")
    return encontro.group(1) if encontro else None


itens = []


def adicionar(id, calibre, tipo, massa, calibre_min, calibre_max, altura_min, altura_max, fonte, localizacao, **extras):
    if not calibre or not tipo or all(v is None for v in (massa, calibre_min, altura_min)):
        return
    itens.append(dict(
        id=id, calibre=str(calibre).strip(), tipo=str(tipo).strip(), sigla=sigla(str(tipo)),
        massaGramas=numero(massa), calibreRealMinMm=numero(calibre_min), calibreRealMaxMm=numero(calibre_max),
        alturaMinMm=numero(altura_min), alturaMaxMm=numero(altura_max), situacao="estimada",
        fonte=fonte, localizacao=localizacao, **{k: v for k, v in extras.items() if v is not None and v != ""},
    ))


# Transcrição visual da tabela de uma página; grupos de calibre real médio são repetidos por linha.
# Os valores questionáveis são mantidos literalmente e sinalizados em observacao.
pdf = [
    (".22 Curto", "CHOG", 1.817, 5.60, 9.75),
    (".22 LR", "CHOG", 2.551, 5.60, 12.75),
    (".22 LR", "CHPO", 2.142, 5.60, 11.85),
    (".223 Rem", "ETP", 19.65, 5.56, 5.68),
    (".25 Auto", "ETOG", 3.240, 6.35, 11.29),
    (".308 Win", "ETP", 9.423, 7.62, 28.76),
    (".32 Auto", "ETOG", 4.600, 7.65, 11.48),
    (".32 S&WL", "CHOG", 6.350, 7.65, 14.56),
    (".32 S&WL", "SEPO", 6.382, 7.65, 13.89),
    ("7,62 AK", "ETP", 8.066, 7.65, 21.46),
    (".32 S&W", "CHOG", 5.702, 7.90, 12.96),
    (".38 Curto", "CHOG", 5.702, 9.00, 17.39),
    (".380 Auto", "ETOG", 6.135, 9.00, 11.73),
    (".380 Auto", "EXPO (Gold)", 6.223, 9.00, 11.20),
    ("9mm Luger", "ETOG", 8.030, 9.00, 15.05),
    ("9mm Luger", "EXPO", None, 9.00, 14.08),
    (".38 SPL", "CHOG", 10.230, 9.00, 17.63),
    (".38 SPL", "SEPO", None, 9.00, 16.02),
    (".38 SPL", "EXPO (Gold)", 8.236, 9.00, 14.26),
    (".357 Magnum", "SEPO", 10.388, 9.00, 16.00),
    (".357 Magnum", "SEPP", 11.400, 9.00, 16.00),
    (".40 S&W", "ETPP", 10.021, 10.00, 15.85),
    (".40 S&W", "EXPO (Gold)", 10.031, 10.00, 13.95),
    (".40 S&W", "CXPO", 8.445, 10.00, 15.90),
    (".44 WCF", "CHOG", 15.940, 10.60, 15.41),
    (".44 REM Magnum", "SEPO", 15.614, 11.00, 17.21),
    (".45 Auto", "ETOG", 14.904, 11.45, 17.40),
]

for indice, (calibre, tipo, massa, diametro, altura) in enumerate(pdf, 1):
    observacao = None
    if calibre == ".223 Rem" or calibre == ".38 Curto" or calibre == "7,62 AK":
        observacao = "Possível inconsistência na tabela original; valores transcritos literalmente."
    extras = {"observacao": observacao}
    comprimentos_estojo = {
        ".22 Curto": 11, ".22 LR": 15, ".223 Rem": 45, ".25 Auto": 16,
        ".308 Win": 51, ".32 Auto": 17, ".32 S&WL": 23, "7,62 AK": 39,
        ".32 S&W": 15, ".38 Curto": 19, ".380 Auto": 17, "9mm Luger": 19,
        ".38 SPL": 29, ".357 Magnum": 32, ".40 S&W": 21,
        ".44 WCF": 33, ".44 REM Magnum": 32, ".45 Auto": 23,
    }
    extras["comprimentoEstojoMm"] = comprimentos_estojo.get(calibre)
    massas_componentes = {
        4: (3.617, None), 5: (2.667, 0.573), 9: (5.746, 0.636),
        13: (5.080, 0.991), 14: (4.774, 1.449), 19: (6.458, 1.776),
        22: (7.810, 2.200), 23: (7.761, 2.270),
    }
    if indice in massas_componentes:
        extras["massaNucleoGramas"], extras["massaCamisaGramas"] = massas_componentes[indice]
    adicionar(f"pdf-{indice:03}", calibre, tipo, massa, diametro, diametro, altura, altura,
             PDF, f"Página 1, linha {indice}", **extras)

planilha = load_workbook(PASTA / PLANILHA, data_only=True, read_only=True)


def calibre_equivalente(texto):
    reduzido = re.sub(r"[^a-z0-9]", "", texto.lower())
    equivalentes = {"9mmluger": "9mmluger", "9x19mmluger": "9mmluger", "38special": "38spl"}
    return equivalentes.get(reduzido, reduzido)


def repeticao_pdf(calibre, tipo, massa):
    codigo = sigla(tipo)
    if not codigo or not isinstance(massa, (int, float)):
        return False
    return any(calibre_equivalente(item["calibre"]) == calibre_equivalente(calibre)
               and item["sigla"] == codigo and item["massaGramas"] is not None
               and abs(item["massaGramas"] - massa) <= 0.02
               for item in itens if item["fonte"] == PDF)


for numero_linha, linha in enumerate(planilha["CBC"].iter_rows(values_only=True), 1):
    if numero_linha < 3:
        continue
    calibre, tipo, liga, massa, _, minimo, maximo, altura, linha_comercial = (list(linha) + [None] * 9)[:9]
    if numero(minimo) is not None and numero(maximo) is not None and minimo > maximo:
        continue
    if isinstance(calibre, str) and repeticao_pdf(calibre, tipo, massa):
        continue
    if isinstance(massa, (int, float)) and massa > 0:
        adicionar(f"cbc-{numero_linha:03}", calibre, tipo, massa, minimo, maximo, altura, altura,
                 PLANILHA, f"Aba CBC, linha {numero_linha}", liga=liga,
                 linha=str(linha_comercial).strip() if linha_comercial else None)

for numero_linha, linha in enumerate(planilha["Computador"].iter_rows(values_only=True), 1):
    if numero_linha < 3:
        continue
    calibre, dmin, dmax, amin, amax, mmin, mmax = (list(linha) + [None] * 7)[:7]
    if not isinstance(calibre, str) or not isinstance(mmin, (int, float)) or mmin <= 0:
        continue
    massa = mmin if mmin == mmax else None
    if repeticao_pdf(calibre, calibre, massa):
        continue
    adicionar(f"computador-{numero_linha:03}", calibre, calibre, massa, dmin, dmax, amin, amax,
             PLANILHA, f"Aba Computador, linha {numero_linha}",
             observacao="Massa publicada como faixa; massa pontual não utilizada." if massa is None else None)

planilha_peso = load_workbook(PASTA / PESO, data_only=True, read_only=True)["Plan1"]
calibre = None
for numero_linha, linha in enumerate(planilha_peso.iter_rows(values_only=True), 1):
    tipo, codigo, _, massa = (list(linha) + [None] * 4)[:4]
    if numero_linha < 7:
        continue
    if isinstance(tipo, str) and tipo.startswith(".") or isinstance(tipo, str) and tipo.startswith("9mm"):
        calibre = tipo
    elif calibre and isinstance(massa, (int, float)) and massa > 0:
        if repeticao_pdf(calibre, f"{tipo} ({codigo})", massa):
            continue
        adicionar(f"peso-{numero_linha:03}", calibre, f"{tipo} ({codigo})" if codigo not in (None, "-") else tipo,
                 massa, None, None, None, None, PESO, f"Aba Plan1, linha {numero_linha}")

# A fotografia apresenta apenas massas e diâmetros usuais, sem variante ou formato individual.
for indice, (calibre, massa, diametro) in enumerate([
    ("22 C", 1.817, 5.59), ("22 LR", 2.551, 5.59), ("25 Auto", 3.240, 6.35),
    ("30 Mauser", 5.508, 7.63), ("30 Luger", 6.026, 7.65), ("32 Auto", 4.600, 7.65),
    ("32 curto", 5.702, 7.65), ("32 longo", 6.350, 7.65), ("38 curto", 9.460, 8.90),
    ("38 longo", 10.238, 8.90), ("38 EXPO", 8.100, 8.90), ("357 Mag", 10.238, 8.90),
    ("38 Auto", 8.424, 8.90), ("38 Super Auto", 8.424, 8.90), ("9mm Luger", 8.035, 8.90),
    ("40 Auto", 11.676, 10.10), ("44", 15.940, 10.80), ("45 Colt", 16.200, 11.43),
    ("45 Auto enc.", 14.904, 11.43), ("45 Auto nu", 12.960, 11.43),
], 1):
    adicionar(f"foto-{indice:03}", calibre, "Formato não informado", massa, diametro, diametro,
             None, None, "Tabela de Massa de Cartuchos.jpg", f"Tabela, linha {indice}",
             observacao="Relação de massa e diâmetro mais comuns; variante não especificada.")

DESTINO.write_text(
    "import type { ProjetilReferencia } from '../types/projetil.types.js';\n\n"
    + "export const catalogoProjeteis: ProjetilReferencia[] = "
    + json.dumps(itens, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
print(f"{len(itens)} referências geradas em {DESTINO}")
