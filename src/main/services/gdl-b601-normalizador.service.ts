import { randomUUID } from 'node:crypto'
import { CATALOGO_TIPOS_PECA_B601, OPCOES_UNIDADE_MEDIDA_B601 } from '../../shared/catalogos/b601.catalogo.js'
import type { PecaBalistica, CampoPersonalizadoBalistica } from '../../shared/types/pecas-balistica.types.js'
import type { AvisoImportacao, MetadadosIntegracaoGdl } from '../../shared/types/b602-gdl.types.js'
import type { ResultadoImportacaoB601 } from '../../shared/types/gdl-importacao.types.js'
import type { GdlRepValidada } from './gdl.schema.js'
import { CHAVES_COMUNS, criarCamposComuns, montarImportacaoBalistica, normalizarChave, normalizarNomeCampo } from './gdl-balistica-normalizador.service.js'

function converterPersonalizado(campo: CampoPersonalizadoBalistica, valor: unknown): string | undefined {
  if (typeof valor !== 'string' && typeof valor !== 'number') return undefined
  const texto = String(valor).trim()
  if (!texto) return ''
  if (!campo.opcoes) return texto
  const opcao = campo.opcoes.find(item => item.codigo === texto || normalizarChave(item.label) === normalizarChave(texto))
  if (campo.controle === 'combobox') return opcao?.label ?? texto
  return opcao?.codigo
}

export function converterRepB601(rep: GdlRepValidada, metadados?: MetadadosIntegracaoGdl): ResultadoImportacaoB601 {
  const avisos: AvisoImportacao[] = []
  const codigos = new Set<number>()
  const pecas: PecaBalistica[] = rep.pecas.map((entrada, indice) => {
    if (!Number.isSafeInteger(entrada.codPeca) || entrada.codPeca <= 0 || codigos.has(entrada.codPeca)) {
      throw new Error('O GDL retornou identificadores de peças inválidos ou duplicados. Os dados locais foram preservados.')
    }
    codigos.add(entrada.codPeca)
    const tipo = CATALOGO_TIPOS_PECA_B601.find(item => normalizarChave(item.label) === normalizarChave(entrada.tipoPeca))
    const comuns: PecaBalistica['comuns'] = { ...criarCamposComuns(entrada) }
    delete comuns.materialIncinerado
    const medida = OPCOES_UNIDADE_MEDIDA_B601.find(item => item.codigo === entrada.unidadeMedida.trim() || normalizarChave(item.label) === normalizarChave(entrada.unidadeMedida))
    comuns.unidadeMedida = medida?.label ?? entrada.unidadeMedida
    if (entrada.consumida && !['s', 'sim', 'n', 'nao', 'p', 'parcialmente'].includes(normalizarChave(entrada.consumida))) throw new Error(`O consumo da peça ${indice + 1} não foi reconhecido. A importação não foi aplicada.`)
    if (typeof entrada.examinadoInLoco === 'string' && entrada.examinadoInLoco && !['s', 'sim', 'true', '1', 'n', 'nao', 'false', '0'].includes(normalizarChave(entrada.examinadoInLoco))) {
      throw new Error(`O campo Examinado In Loco da peça ${indice + 1} não foi reconhecido. A importação não foi aplicada.`)
    }
    const personalizados: Record<string, unknown> = {}
    const extrasGdl: Record<string, unknown> = {}
    for (const [chave, valor] of Object.entries(entrada)) {
      const nomeCampo = normalizarNomeCampo(chave)
      if (['numeroanalises', 'incinerado', 'materialincinerado', 'matincinerado'].includes(nomeCampo)) {
        if (valor !== '') extrasGdl[chave] = valor
        continue
      }
      if (CHAVES_COMUNS.has(nomeCampo)) {
        const dataNaoReconhecida = ['dataentrada', 'dataliberacao', 'datadeliberacao'].includes(nomeCampo)
          && valor && !(nomeCampo === 'dataentrada' ? comuns.dataEntrada : comuns.dataLiberacao)
        if (dataNaoReconhecida || (valor !== null && typeof valor === 'object')) extrasGdl[chave] = valor
        continue
      }
      const campo = tipo?.campos.find(item => (
        item.mapeamentoApiConfirmado
        && [item.chaveGdl, ...(item.aliasesGdl ?? [])].some(alias => normalizarNomeCampo(alias) === nomeCampo)
      ))
      const convertido = campo ? converterPersonalizado(campo, valor) : undefined
      if (campo && convertido !== undefined) personalizados[campo.id] = convertido
      else extrasGdl[chave] = valor
    }
    for (const [chave, original, convertido] of [['dataEntrada', entrada.dataEntrada, comuns.dataEntrada], ['dataLiberacao', entrada.dataLiberacao, comuns.dataLiberacao]]) {
      if (original && !convertido) extrasGdl[chave] = original
    }
    if (!tipo) avisos.push({
      codigo: 'TIPO_PECA_NAO_CONFIRMADO',
      mensagem: `O tipo ${entrada.tipoPeca} não pertence ao catálogo B-601. A peça foi preservada e exige revisão manual.`,
    })
    if (Object.keys(extrasGdl).length) avisos.push({
      codigo: 'CAMPOS_B601_PARA_REVISAO',
      mensagem: `A peça ${indice + 1} contém dados preservados em campos adicionais; confira os personalizados antes de salvar.`,
      contexto: { campos: Object.keys(extrasGdl) },
    })
    return {
      idLocal: randomUUID(), origem: 'gdl', alteradaLocalmente: false, codPecaGdl: entrada.codPeca,
      tipoCodigo: tipo?.codigo ?? '', tipoPeca: entrada.tipoPeca, comuns, personalizados, extrasGdl,
    }
  })
  if (!pecas.length) avisos.push({
    codigo: 'AUSENCIA_PECAS_B601_NAO_CONFIRMADA',
    mensagem: 'O GDL não retornou peças. Confirme manualmente a declaração de ausência de itens antes de salvar.',
  })
  return montarImportacaoBalistica(rep, 'B-601', pecas, metadados, avisos)
}
