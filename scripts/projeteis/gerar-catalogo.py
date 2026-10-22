"""Gera o catálogo com transcrições versionadas, sem dependências externas.

Uso: python scripts/projeteis/gerar-catalogo.py [--verificar]
A precedência só consolida referências com os mesmos dados de variante.
"""

import argparse
import json
import re
from pathlib import Path

PASTA = Path(__file__).resolve().parent / "fontes"
DESTINO = Path(__file__).resolve().parents[2] / "src/shared/catalogos/projeteis.catalogo.ts"
CAMPOS_VARIANTE = (
    "calibre", "tipo", "sigla", "massaGramas", "calibreRealMinMm", "calibreRealMaxMm",
    "alturaMinMm", "alturaMaxMm", "liga", "linha", "comprimentoEstojoMm",
    "massaNucleoGramas", "massaCamisaGramas",
)


def prioridade_fonte(item):
    if item["fonte"] == "tabela de calibres_balistica forense_final.pdf":
        return 0
    if item["fonte"] == "Perfis de Projéteis - Eliane Baruch.pdf":
        return 1
    return 2


def chave_variante(item):
    # Igualdade de calibre e sigla, isoladamente, não comprova a mesma variante.
    return tuple(re.sub(r"\s+", " ", valor.strip()).casefold() if isinstance(valor, str) else valor
                 for campo in CAMPOS_VARIANTE for valor in [item.get(campo)])


def origem(item):
    return {"fonte": item["fonte"], "localizacao": item["localizacao"],
            "valoresOriginais": {campo: item.get(campo) for campo in CAMPOS_VARIANTE}}


def consolidar(itens, revisoes, equivalencias=None):
    grupos = {}
    ids_disponiveis = {item["id"] for item in itens}
    for equivalencia in equivalencias or []:
        ids = equivalencia["ids"]
        if len(ids) < 2 or not equivalencia.get("justificativa") or not set(ids) <= ids_disponiveis:
            raise ValueError("Equivalência sem evidência ou com identificadores ausentes")
        for identificador in ids:
            if identificador in grupos:
                raise ValueError(f"Equivalência repetida: {identificador}")
            grupos[identificador] = tuple(sorted(ids))
    consolidados = {}
    identificadores = set()
    for original in sorted(itens, key=prioridade_fonte):
        item = dict(original)
        if item["id"] in identificadores:
            raise ValueError(f"Identificador repetido: {item['id']}")
        identificadores.add(item["id"])
        item["origens"] = list(item.get("origens", [origem(item)]))
        motivo = revisoes.get(item["id"])
        if motivo:
            item["motivoExclusaoClassificacao"] = motivo
        chave = ("confirmada", grupos[item["id"]]) if item["id"] in grupos else ("dados", chave_variante(item))
        existente = consolidados.get(chave)
        if existente is None:
            consolidados[chave] = item
            continue
        for registro in item["origens"]:
            if registro not in existente["origens"]:
                existente["origens"].append(registro)
        if motivo:
            existente["motivoExclusaoClassificacao"] = motivo
    ausentes = set(revisoes) - identificadores
    if ausentes:
        raise ValueError(f"Revisões sem referência: {sorted(ausentes)}")
    return list(consolidados.values())


def gerar():
    itens = []
    for nome in ("catalogo-legado.json", "perfis-eliane-baruch.json"):
        itens.extend(json.loads((PASTA / nome).read_text(encoding="utf-8")))
    revisoes = json.loads((PASTA / "revisao.json").read_text(encoding="utf-8"))
    equivalencias = json.loads((PASTA / "equivalencias-revisadas.json").read_text(encoding="utf-8"))
    catalogo = consolidar(itens, revisoes, equivalencias)
    return ("import type { ProjetilReferencia } from '../types/projetil.types.js';\n\n"
            + "export const catalogoProjeteis: ProjetilReferencia[] = "
            + json.dumps(catalogo, ensure_ascii=False, indent=2) + ";\n")


if __name__ == "__main__":
    argumentos = argparse.ArgumentParser(description=__doc__)
    argumentos.add_argument("--verificar", action="store_true", help="Confere sem reescrever o catálogo")
    opcoes = argumentos.parse_args()
    conteudo = gerar()
    if opcoes.verificar:
        if DESTINO.read_text(encoding="utf-8") != conteudo:
            raise SystemExit("Catálogo desatualizado; execute o gerador sem --verificar.")
        print("Catálogo confere com as transcrições versionadas.")
    else:
        DESTINO.write_text(conteudo, encoding="utf-8")
        print(f"Catálogo gerado em {DESTINO}")
