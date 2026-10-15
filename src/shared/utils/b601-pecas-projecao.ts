import { TIPOS_PECA_B601_POR_CODIGO } from '../catalogos/b601.catalogo.js'
import { validarDadosB601 } from '../types/b601.types.js'

export function projetarB601ParaLaudo(valor: unknown) {
  const dados = validarDadosB601(valor)
  return {
    dados,
    pecas: dados.pecas.map((peca, indice) => {
      const tipo = TIPOS_PECA_B601_POR_CODIGO.get(peca.tipoCodigo)
      const campos: Record<string, string> = {
        numero: String(indice + 1),
        natureza: ['476', '472', '477', '475', '480', '104', '106', '479'].includes(peca.tipoCodigo) ? 'ARMA(S)' : peca.tipoPeca,
        letra: letraPecaB601(indice), tipo: peca.tipoPeca, identificacao: peca.comuns.identificacao,
        quantidade: String(peca.comuns.quantidade).replace('.', ','),
        medida: peca.comuns.unidadeMedida, quantidade_descricao: peca.comuns.quantidadeDescricao,
        lacre_entrada: peca.comuns.lacreEntrada, lacre_saida: peca.comuns.lacreSaida,
        data_entrada: peca.comuns.dataEntrada, data_liberacao: peca.comuns.dataLiberacao,
        codigo_vestigio: peca.comuns.codigoVestigio, observacao: peca.comuns.observacao,
      }
      for (const campo of tipo?.campos ?? []) {
        const bruto = peca.personalizados[campo.id]
        const texto = typeof bruto === 'string' ? bruto : ''
        const chave = campo.id.slice(peca.tipoCodigo.length + 1)
        campos[chave] = campo.opcoes?.find(opcao => opcao.codigo === texto)?.label ?? texto
      }
      return { idLocal: peca.idLocal, tipoCodigo: peca.tipoCodigo, indice: indice + 1, campos }
    }),
  }
}

function letraPecaB601(indice: number): string {
  let numero = indice + 1
  let letra = ''
  while (numero > 0) {
    numero -= 1
    letra = String.fromCharCode(65 + numero % 26) + letra
    numero = Math.floor(numero / 26)
  }
  return letra
}
