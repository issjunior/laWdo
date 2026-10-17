import { randomUUID } from 'crypto'
import type { PecaB602, MetadadosIntegracaoGdl } from '../../shared/types/b602-gdl.types.js'
import type { ResultadoImportacaoB602 } from '../../shared/types/gdl-importacao.types.js'
import {
  obterTipoPecaB602PorLabel,
  type CampoPersonalizadoB602,
  type TipoPecaB602,
} from '../../shared/catalogos/b602-gdl.catalogo.js'
import type { GdlPecaValidada, GdlRepValidada } from './gdl.schema.js'
import { normalizarChave, normalizarNomeCampo, CHAVES_COMUNS, criarCamposComuns, montarImportacaoBalistica } from './gdl-balistica-normalizador.service.js'

function obterCampoPersonalizado(
  tipo: TipoPecaB602 | undefined,
  chaveGdl: string,
): CampoPersonalizadoB602 | undefined {
  const chaveNormalizada = normalizarChave(chaveGdl)
  return tipo?.campos.find(campo => (
    campo.mapeamentoApiConfirmado
    && [campo.chaveGdl, ...(campo.aliasesGdl ?? [])]
      .some(alias => normalizarChave(alias) === chaveNormalizada)
  ))
}

function normalizarValorCampoPersonalizado(
  campo: CampoPersonalizadoB602,
  valor: unknown,
  ambiente: 'homologacao' | 'producao',
): unknown {
  if (!campo.opcoes || (typeof valor !== 'string' && typeof valor !== 'number')) return valor

  const textoOriginal = String(valor).trim()
  const texto = ambiente === 'homologacao' && campo.id.endsWith(':marca_arma') && textoOriginal === '1316'
    ? 'Taurus'
    : textoOriginal
  const opcao = campo.opcoes.find(item => (
    item.codigo === texto || normalizarChave(item.label) === normalizarChave(texto)
  ))

  if (!opcao) return valor
  return opcao.codigo
}

interface ResultadoNormalizacaoPecaB602 {
  peca: PecaB602
  funcionamentoPreenchidoComoNaoTestado: boolean
}

function normalizarPecaB602(
  peca: GdlPecaValidada,
  ambiente: 'homologacao' | 'producao',
): ResultadoNormalizacaoPecaB602 {
  const definicao = obterTipoPecaB602PorLabel(peca.tipoPeca)
  const personalizados: Record<string, unknown> = {}
  const extrasGdl: Record<string, unknown> = {}

  for (const [chave, valor] of Object.entries(peca)) {
    if (CHAVES_COMUNS.has(normalizarNomeCampo(chave))) continue
    const campo = obterCampoPersonalizado(definicao, chave)
    if (campo) personalizados[campo.id] = normalizarValorCampoPersonalizado(campo, valor, ambiente)
    else extrasGdl[chave] = valor
  }

  const campoFuncionamento = definicao?.campos.find(campo => (
    campo.chaveGdl === 'Funcionamento' && campo.obrigatorio
  ))
  const opcaoNaoTestado = campoFuncionamento?.opcoes?.find(opcao => (
    normalizarChave(opcao.label) === 'nao testado'
  ))
  const funcionamentoPreenchidoComoNaoTestado = Boolean(
    campoFuncionamento
    && opcaoNaoTestado
    && !personalizados[campoFuncionamento.id],
  )

  if (funcionamentoPreenchidoComoNaoTestado && campoFuncionamento && opcaoNaoTestado) {
    personalizados[campoFuncionamento.id] = opcaoNaoTestado.codigo
  }

  return {
    peca: {
      idLocal: randomUUID(),
      origem: 'gdl',
      alteradaLocalmente: false,
      codPecaGdl: peca.codPeca,
      tipoCodigo: definicao?.codigo ?? '',
      tipoPeca: peca.tipoPeca,
      comuns: criarCamposComuns(peca),
      personalizados,
      extrasGdl,
    },
    funcionamentoPreenchidoComoNaoTestado,
  }
}

export function converterRepB602(
  rep: GdlRepValidada,
  metadadosIntegracaoGdl?: MetadadosIntegracaoGdl,
): ResultadoImportacaoB602 {
  const ambiente = metadadosIntegracaoGdl?.ultimaConsulta?.ambiente ?? 'homologacao'
  const pecasNormalizadas = rep.pecas
    .filter(peca => normalizarChave(peca.tipoPeca) !== 'peca teste')
    .map(peca => normalizarPecaB602(peca, ambiente))
  const pecas = pecasNormalizadas.map(resultado => resultado.peca)
  const quantidadeFuncionamentosPreenchidos = pecasNormalizadas.filter(
    resultado => resultado.funcionamentoPreenchidoComoNaoTestado,
  ).length
  return montarImportacaoBalistica(rep, 'B-602', pecas, metadadosIntegracaoGdl, [
    ...(quantidadeFuncionamentosPreenchidos > 0 ? [{
      codigo: 'FUNCIONAMENTO_NAO_TESTADO_PADRAO',
      mensagem: 'O campo Funcionamento foi definido automaticamente como "NÃO TESTADO" para as peças importadas nas quais essa informação não foi retornada pelo GDL.',
      contexto: { quantidadePecas: quantidadeFuncionamentosPreenchidos },
    }] : []),
    ...pecas.filter(peca => !peca.tipoCodigo).map(peca => ({
      codigo: 'TIPO_PECA_NAO_CONFIRMADO', mensagem: `O tipo ${peca.tipoPeca} ainda não possui round-trip confirmado.`,
      contexto: { tipoPeca: peca.tipoPeca },
    })),
  ])
}
