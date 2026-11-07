import { TIPOS_PECA_B601_POR_CODIGO } from '../../shared/catalogos/b601.catalogo.js'
import { TIPOS_PECA_B602_POR_CODIGO } from '../../shared/catalogos/b602-gdl.catalogo.js'
import type { DadosImportacaoB601 } from '../../shared/types/gdl-importacao.types.js'
import type { DadosImportacaoB602, ResultadoImportacaoExame } from '../../shared/types/b602-gdl.types.js'
import type { PecaBalistica } from '../../shared/types/pecas-balistica.types.js'
import type { DetalheDiferencaAtualizacaoRepGdl, DiferencaAtualizacaoRepGdl } from '../../shared/types/atualizacao-rep-gdl.types.js'
import { combinarEnvolvido, separarEnvolvido } from '../../shared/utils/envolvido.js'

export type ImportacaoAtualizacaoGdl = ResultadoImportacaoExame<DadosImportacaoB601 | DadosImportacaoB602>

type CatalogoPeca = { campos: ReadonlyArray<{ id: string; label: string; opcoes?: ReadonlyArray<{ codigo: string; label: string }> }> }

export interface AdaptadorAtualizacaoGdl {
  codigo: 'B-601' | 'B-602'
  chaveDados: 'b601' | 'b602'
  grupoCampos: string
  grupoPecas: string
  mapearCampos: (dados: Record<string, unknown>) => Record<string, string>
  obterPecas: (dados: Record<string, unknown>) => PecaBalistica[]
  compararPecas: (atuais: PecaBalistica[], recebidas: PecaBalistica[]) => DiferencaAtualizacaoRepGdl[]
  aplicarCampos: (dadosAtuais: Record<string, unknown>, importacao: ImportacaoAtualizacaoGdl, selecionados: Set<string>) => Record<string, unknown>
}

const CAMPOS_COMUNS_PECA = [
  'identificacao', 'quantidade', 'unidadeMedida', 'quantidadeDescricao',
  'examinadoInLoco', 'materialIncinerado', 'dataEntrada', 'lacreEntrada',
  'lacreSaida', 'dataLiberacao', 'codigoVestigio', 'consumida', 'observacao',
] as const

const ROTULOS_CAMPOS_COMUNS_PECA: Record<string, string> = {
  identificacao: 'Identificação', quantidade: 'Quantidade', unidadeMedida: 'Unidade de medida',
  quantidadeDescricao: 'Descrição da quantidade', examinadoInLoco: 'Examinado no local',
  materialIncinerado: 'Material incinerado', dataEntrada: 'Data de entrada',
  lacreEntrada: 'Lacre de entrada', lacreSaida: 'Lacre de saída',
  dataLiberacao: 'Data de liberação', codigoVestigio: 'Código do vestígio',
  consumida: 'Consumida', observacao: 'Observação',
}

function valorTexto(valor: unknown): string {
  return valor === null || valor === undefined ? '' : String(valor)
}

function serializarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return 'null'
  if (Array.isArray(valor)) return `[${valor.map(serializarValor).join(',')}]`
  if (typeof valor === 'object') {
    const registro = valor as Record<string, unknown>
    return `{${Object.keys(registro).sort().map(chave => `${JSON.stringify(chave)}:${serializarValor(registro[chave])}`).join(',')}}`
  }
  return JSON.stringify(valor)
}

function apresentarValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return 'Não preenchido'
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  if (Array.isArray(valor) || typeof valor === 'object') return JSON.stringify(valor)
  return String(valor)
}

function valorRelevante(valor: unknown): boolean {
  return valor !== null && valor !== undefined && valor !== '' && valor !== false && valor !== 0 && valor !== 'N'
}

function criarDetalhesPeca(pecaAtual: PecaBalistica | undefined, pecaRecebida: PecaBalistica, catalogo: Map<string, CatalogoPeca>): DetalheDiferencaAtualizacaoRepGdl[] {
  const detalhes: DetalheDiferencaAtualizacaoRepGdl[] = []
  const adicionar = (campo: string, valorLocal: unknown, valorGdl: unknown, apresentar = apresentarValor) => {
    if (pecaAtual && serializarValor(valorLocal) === serializarValor(valorGdl)) return
    if (!pecaAtual && !valorRelevante(valorGdl)) return
    detalhes.push({ campo, valorLocal: pecaAtual ? apresentar(valorLocal) : 'Não cadastrada', valorGdl: apresentar(valorGdl) })
  }

  adicionar('Tipo da peça', pecaAtual?.tipoPeca, pecaRecebida.tipoPeca)
  for (const campo of CAMPOS_COMUNS_PECA) adicionar(ROTULOS_CAMPOS_COMUNS_PECA[campo], pecaAtual?.comuns[campo], pecaRecebida.comuns[campo])

  const tipo = catalogo.get(pecaRecebida.tipoCodigo)
  const camposPersonalizados = new Set([...Object.keys(pecaAtual?.personalizados ?? {}), ...Object.keys(pecaRecebida.personalizados)])
  for (const campoId of camposPersonalizados) {
    const campo = tipo?.campos.find(item => item.id === campoId)
    const apresentarCampo = (valor: unknown) => apresentarValor(campo?.opcoes?.find(opcao => opcao.codigo === valor || opcao.label === valor)?.label ?? valor)
    adicionar(campo?.label ?? campoId, pecaAtual?.personalizados[campoId], pecaRecebida.personalizados[campoId], apresentarCampo)
  }

  const camposAdicionais = new Set([...Object.keys(pecaAtual?.extrasGdl ?? {}), ...Object.keys(pecaRecebida.extrasGdl)])
  for (const campo of camposAdicionais) adicionar(`Dado adicional: ${campo}`, pecaAtual?.extrasGdl[campo], pecaRecebida.extrasGdl[campo])
  return detalhes
}

function compararPecas(atuais: PecaBalistica[], recebidas: PecaBalistica[], grupo: string, catalogo: Map<string, CatalogoPeca>): DiferencaAtualizacaoRepGdl[] {
  const atuaisPorCodigo = new Map(atuais.filter(peca => peca.codPecaGdl !== undefined).map(peca => [peca.codPecaGdl!, peca]))
  return recebidas.flatMap(peca => {
    const atual = peca.codPecaGdl === undefined ? undefined : atuaisPorCodigo.get(peca.codPecaGdl)
    const detalhes = criarDetalhesPeca(atual, peca, catalogo)
    if (atual && detalhes.length === 0) return []
    const id = `peca:${peca.codPecaGdl ?? peca.idLocal}`
    return [{
      id, categoria: 'peca' as const, grupo, rotulo: atual ? `Peça ${peca.tipoPeca}` : `Nova peça ${peca.tipoPeca}`,
      resumo: peca.comuns.identificacao ? `Identificação: ${peca.comuns.identificacao}` : 'Sem identificação informada',
      valorLocal: atual ? `${detalhes.length} alteração(ões) identificada(s)` : 'Não cadastrada',
      valorGdl: 'Dados disponíveis no GDL', selecionadaPorPadrao: true, detalhes,
    }]
  })
}

function criarAdaptador(codigo: 'B-601' | 'B-602', prefixo: 'b601' | 'b602', grupoPecas: string, catalogo: Map<string, CatalogoPeca>): AdaptadorAtualizacaoGdl {
  return {
    codigo, chaveDados: prefixo, grupoCampos: `Dados ${codigo}`, grupoPecas,
    mapearCampos: dados => {
      const envolvidos = Array.isArray(dados.envolvidos) ? dados.envolvidos.map(valorTexto) : []
      const local = typeof dados.local === 'object' && dados.local !== null ? dados.local as Record<string, unknown> : {}
      const resultado: Record<string, string> = {
        [`${prefixo}_local_cidade`]: valorTexto(local.cidade), [`${prefixo}_numero_bo`]: valorTexto(dados.numero_bo),
        [`${prefixo}_numero_ip`]: valorTexto(dados.numero_ip), [`${prefixo}_solicitante_nome`]: valorTexto(dados.solicitante_nome),
      }
      envolvidos.forEach((envolvido, indice) => {
        const separado = separarEnvolvido(envolvido)
        resultado[`${prefixo}_envolvidos_qualificacao_${indice}`] = separado.qualificacao
        resultado[`${prefixo}_envolvidos_${indice}`] = separado.nome
      })
      return resultado
    },
    obterPecas: dados => Array.isArray(dados.pecas) ? dados.pecas as PecaBalistica[] : [],
    compararPecas: (atuais, recebidas) => compararPecas(atuais, recebidas, grupoPecas, catalogo),
    aplicarCampos: (dadosAtuais, importacao, selecionados) => {
      const dados = { ...dadosAtuais }
      const local = typeof dados.local === 'object' && dados.local !== null ? { ...(dados.local as Record<string, unknown>) } : {}
      for (const [campo, valor] of Object.entries(importacao.camposGerais)) {
        if (!campo.startsWith(`${prefixo}_`) || !selecionados.has(`campo:${campo}`) || !valor.trim()) continue
        if (campo === `${prefixo}_local_cidade`) local.cidade = valor
        else if (campo === `${prefixo}_numero_bo`) dados.numero_bo = valor
        else if (campo === `${prefixo}_numero_ip`) dados.numero_ip = valor
        else if (campo === `${prefixo}_solicitante_nome`) dados.solicitante_nome = valor
      }
      dados.local = local
      const envolvidosAtuais = Array.isArray(dados.envolvidos) ? dados.envolvidos.map(valorTexto) : []
      const envolvidosPorIndice = new Map(envolvidosAtuais.map((envolvido, indice) => [indice, separarEnvolvido(envolvido)]))
      for (const [campo, valor] of Object.entries(importacao.camposGerais)) {
        const correspondencia = campo.match(new RegExp(`^${prefixo}_envolvidos_(qualificacao_)?(\\d+)$`))
        if (!correspondencia || !selecionados.has(`campo:${campo}`)) continue
        const indice = Number(correspondencia[2])
        const atual = envolvidosPorIndice.get(indice) ?? { qualificacao: '', nome: '' }
        envolvidosPorIndice.set(indice, correspondencia[1] ? { ...atual, qualificacao: valor } : { ...atual, nome: valor })
      }
      dados.envolvidos = [...envolvidosPorIndice.entries()].sort(([a], [b]) => a - b)
        .map(([, envolvido]) => combinarEnvolvido(envolvido.qualificacao, envolvido.nome)).filter(Boolean)
      const pecasAtuais = Array.isArray(dados.pecas) ? dados.pecas as PecaBalistica[] : []
      const porCodigo = new Map(pecasAtuais.filter(peca => peca.codPecaGdl !== undefined).map(peca => [peca.codPecaGdl!, peca]))
      const pecasRecebidas = 'pecas' in importacao.camposEspecificos ? importacao.camposEspecificos.pecas : []
      const proximas = [...pecasAtuais]
      for (const recebida of pecasRecebidas) {
        const id = `peca:${recebida.codPecaGdl ?? recebida.idLocal}`
        if (!selecionados.has(id)) continue
        const atual = recebida.codPecaGdl === undefined ? undefined : porCodigo.get(recebida.codPecaGdl)
        if (!atual) proximas.push(recebida)
        else {
          const indice = proximas.findIndex(peca => peca.idLocal === atual.idLocal)
          if (indice >= 0) proximas[indice] = { ...recebida, idLocal: atual.idLocal }
        }
      }
      dados.pecas = proximas
      return dados
    },
  }
}

export const ADAPTADORES_ATUALIZACAO_GDL = new Map<'B-601' | 'B-602', AdaptadorAtualizacaoGdl>([
  ['B-601', criarAdaptador('B-601', 'b601', 'Peças B-601', TIPOS_PECA_B601_POR_CODIGO)],
  ['B-602', criarAdaptador('B-602', 'b602', 'Peças B-602', TIPOS_PECA_B602_POR_CODIGO)],
])
