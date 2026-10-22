"""Verifica consolidação, precedência e reprodução do catálogo."""

import importlib.util
import json
import unittest
from pathlib import Path

CAMINHO = Path(__file__).with_name("gerar-catalogo.py")
ESPECIFICACAO = importlib.util.spec_from_file_location("gerar_catalogo", CAMINHO)
gerador = importlib.util.module_from_spec(ESPECIFICACAO)
ESPECIFICACAO.loader.exec_module(gerador)


def referencia(identificador, fonte, **alteracoes):
    return {"id": identificador, "calibre": "9mm Luger", "tipo": "ETOG", "sigla": "ETOG",
            "massaGramas": 8, "calibreRealMinMm": 9, "calibreRealMaxMm": 9,
            "alturaMinMm": None, "alturaMaxMm": None, "situacao": "estimada",
            "fonte": fonte, "localizacao": "Página 1, linha 1", **alteracoes}


class TesteCatalogo(unittest.TestCase):
    def test_precedencia_preserva_originais_e_procedencia(self):
        fontes = ["outra.xlsx", "Perfis de Projéteis - Eliane Baruch.pdf", "tabela de calibres_balistica forense_final.pdf"]
        resultado = gerador.consolidar([referencia(str(i), fonte) for i, fonte in enumerate(fontes)], {})
        self.assertEqual(len(resultado), 1)
        self.assertEqual(resultado[0]["fonte"], fontes[2])
        self.assertEqual({origem["fonte"] for origem in resultado[0]["origens"]}, set(fontes))
        self.assertEqual(resultado[0]["alturaMinMm"], None)
        baruch = gerador.consolidar([referencia(str(i), fonte) for i, fonte in enumerate(fontes[:2])], {})
        self.assertEqual(baruch[0]["fonte"], fontes[1])

    def test_nao_combina_medidas_de_variantes_incompletas(self):
        itens = [referencia("a", "a.pdf"), referencia("b", "b.pdf", alturaMinMm=15, alturaMaxMm=15)]
        self.assertEqual(len(gerador.consolidar(itens, {})), 2)

    def test_preserva_massas_modelos_e_linhas_diferentes(self):
        base = referencia("a", "a.pdf")
        for campo, valor in (("massaGramas", 7.4), ("tipo", "ETOG Flat"), ("linha", "Especial")):
            with self.subTest(campo=campo):
                self.assertEqual(len(gerador.consolidar([base, {**base, "id": "b", campo: valor}], {})), 2)

    def test_revisao_nao_corrige_valores_e_sobrevive_consolidacao(self):
        itens = [referencia("a", "tabela de calibres_balistica forense_final.pdf"), referencia("b", "outra.pdf")]
        resultado = gerador.consolidar(itens, {"b": "Em revisão"})
        self.assertEqual(resultado[0]["motivoExclusaoClassificacao"], "Em revisão")
        self.assertEqual(resultado[0]["massaGramas"], 8)

    def test_ressalva_nao_bloqueia_nem_substitui_gramas_por_grains(self):
        item = referencia("balote", "Perfis de Projéteis - Eliane Baruch.pdf",
                          massaGramas=24.8, observacao="A fonte publica 390 grains e 24,8 g.",
                          origens=[{"fonte": "Perfis de Projéteis - Eliane Baruch.pdf",
                                    "localizacao": "Página 4, linha 9",
                                    "valoresOriginais": {"massaGrains": 390, "massaGramas": 24.8}}])
        resultado = gerador.consolidar([item], {})[0]
        self.assertNotIn("motivoExclusaoClassificacao", resultado)
        self.assertEqual(resultado["massaGramas"], 24.8)
        self.assertEqual(resultado["origens"], item["origens"])
        self.assertEqual(resultado["observacao"], item["observacao"])

    def test_equivalencia_revisada_mantem_fonte_prioritaria_sem_preencher_lacunas(self):
        itens = [referencia("a", "outra.xlsx", alturaMinMm=15, alturaMaxMm=15),
                 referencia("b", "Perfis de Projéteis - Eliane Baruch.pdf", calibreRealMinMm=9.02, calibreRealMaxMm=9.02)]
        equivalencias = [{"ids": ["a", "b"], "justificativa": "Variante conferida"}]
        resultado = gerador.consolidar(itens, {}, equivalencias)
        self.assertEqual(len(resultado), 1)
        self.assertEqual(resultado[0]["id"], "b")
        self.assertIsNone(resultado[0]["alturaMinMm"])
        self.assertEqual(resultado[0]["origens"][1]["valoresOriginais"]["alturaMinMm"], 15)
        with self.assertRaises(ValueError):
            gerador.consolidar(itens, {}, [{"ids": ["a", "inexistente"], "justificativa": "Conferida"}])

    def test_rejeita_identificadores_e_revisoes_orfaos(self):
        item = referencia("a", "a.pdf")
        with self.assertRaises(ValueError):
            gerador.consolidar([item, item], {})
        with self.assertRaises(ValueError):
            gerador.consolidar([item], {"inexistente": "Em revisão"})

    def test_geracao_reproduz_catalogo_versionado(self):
        self.assertEqual(gerador.gerar(), gerador.DESTINO.read_text(encoding="utf-8"))
        transcricao = json.loads((gerador.PASTA / "perfis-eliane-baruch.json").read_text(encoding="utf-8"))
        self.assertEqual(len(transcricao), 43)
        self.assertTrue(all(item["alturaMinMm"] is None for item in transcricao))


if __name__ == "__main__":
    unittest.main()
