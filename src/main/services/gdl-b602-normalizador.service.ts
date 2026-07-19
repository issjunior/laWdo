import { randomUUID } from 'crypto'
import type {
  CamposComunsPecaB602,
  PecaB602,
  ResultadoImportacaoExame,
  DadosImportacaoB602,
  DadosSolicitacaoGdl,
  DadosInvestigacaoGdl,
  MetadadosIntegracaoGdl,
  ReferenciaOrigemGdl,
} from '../../shared/types/b602-gdl.types.js'
import {
  obterTipoPecaB602PorLabel,
  type CampoPersonalizadoB602,
  type TipoPecaB602,
} from '../../shared/catalogos/b602-gdl.catalogo.js'
import type { GdlPecaValidada, GdlRepValidada } from './gdl.schema.js'
import { separarEnvolvido } from '../../shared/utils/envolvido.js'

function normalizarChave(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')
}

function normalizarNomeCampo(valor: string): string {
  return normalizarChave(valor).replace(/[^a-z0-9]/g, '')
}

const ALIASES_CAMPOS_COMUNS = {
  quantidadeDescricao: ['quantidadeDescricao', 'Quant. Descrição', 'Quantidade Descrição', 'Descrição da Quantidade'],
  dataLiberacao: ['dataLiberacao', 'Data de Liberação', 'Data Liberação'],
  codigoVestigio: ['codigoVestigio', 'Código do Vestígio', 'Cod. Vestígio'],
  observacao: ['observacao', 'Observação'],
} as const

const CHAVES_COMUNS = new Set([
  'codPeca', 'tipoPeca', 'identificacao', 'quantidade', 'unidadeMedida',
  'numeroAnalises', 'examinadoInLoco', 'dataEntrada', 'lacreEntrada',
  'lacreSaida', 'consumida',
  ...Object.values(ALIASES_CAMPOS_COMUNS).flat(),
].map(normalizarNomeCampo))

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
): unknown {
  if (!campo.opcoes || (typeof valor !== 'string' && typeof valor !== 'number')) return valor

  const texto = String(valor).trim()
  const opcao = campo.opcoes.find(item => (
    item.codigo === texto || normalizarChave(item.label) === normalizarChave(texto)
  ))

  if (!opcao) return valor
  return campo.controle === 'combobox' ? opcao.label : opcao.codigo
}

function obterTextoPorAlias(fonte: unknown, aliases: string[]): string {
  if (typeof fonte !== 'object' || fonte === null) return ''
  const aliasesNormalizados = new Set(aliases.map(normalizarNomeCampo))
  for (const [chave, valor] of Object.entries(fonte)) {
    if (!aliasesNormalizados.has(normalizarNomeCampo(chave))) continue
    if (typeof valor === 'string' || typeof valor === 'number') {
      const texto = String(valor).trim()
      if (texto) return texto
    }
  }
  return ''
}

function extrairOrigensDisponiveis(rep: GdlRepValidada): ReferenciaOrigemGdl[] {
  const origens = rep.origens
    .map(origem => ({
      tipo: origem.tipo.trim(),
      numero: formatarNumeroOrigem(origem.numero, origem.ano),
    }))
    .filter(origem => Boolean(origem.tipo))

  return origens.filter((origem, indice) => (
    origens.findIndex(outra => (
      normalizarChave(outra.tipo) === normalizarChave(origem.tipo)
      && outra.numero === origem.numero
    )) === indice
  ))
}

function origemPertenceFamiliaPreferencial(origem: ReferenciaOrigemGdl): boolean {
  const tipo = normalizarChave(origem.tipo).replace(/[\s/_-]/g, '')
  return tipo.startsWith('bo') || tipo.startsWith('ip') || tipo.startsWith('oficio')
}

function selecionarOrigemInicial(origens: ReferenciaOrigemGdl[]): ReferenciaOrigemGdl | undefined {
  return origens.find(origemPertenceFamiliaPreferencial) ?? origens[0]
}

function extrairDadosSolicitacao(rep: GdlRepValidada): DadosSolicitacaoGdl {
  const origem = rep.origens[0]
  const orgao = obterTextoPorAlias(origem, ['orgao', 'orgao origem', 'orgaoOrigem'])
    || obterTextoPorAlias(rep, ['orgao', 'orgao origem', 'orgaoOrigem'])
  const responsavel = obterTextoPorAlias(rep, [
    'responsavel', 'responsavel contato', 'nome responsavel',
  ]) || obterTextoPorAlias(origem, [
    'responsavel', 'responsavel contato', 'nome responsavel',
  ])
  const autoridade = obterTextoPorAlias(rep, [
    'autoridade', 'nome autoridade', 'autoridade solicitante', 'nome autoridade solicitante',
  ]) || obterTextoPorAlias(origem, [
    'autoridade', 'nome autoridade', 'autoridade solicitante', 'nome autoridade solicitante',
  ])
  return {
    orgao,
    responsavel,
    autoridade,
    origensDisponiveis: extrairOrigensDisponiveis(rep),
  }
}

function chaveIndicaEnvolvido(chave: string): boolean {
  const normalizada = normalizarChave(chave)
  return normalizada.includes('envolv') || normalizada.includes('involv')
}

function coletarNomesEnvolvidos(
  valor: unknown,
  contextoEnvolvido: boolean = false,
  profundidade: number = 0,
): string[] {
  if (profundidade > 6 || valor === null || valor === undefined) return []
  if (Array.isArray(valor)) {
    return valor.flatMap(item => coletarNomesEnvolvidos(item, contextoEnvolvido, profundidade + 1))
  }
  if (typeof valor !== 'object') {
    return contextoEnvolvido && typeof valor === 'string' && valor.trim() ? [valor.trim()] : []
  }

  const entradas = Object.entries(valor)
  const registroEnvolvido = contextoEnvolvido || entradas.some(([chave, filho]) => (
    chaveIndicaEnvolvido(chave) && (typeof filho !== 'object' || filho === null)
  ))
  const nomeConhecido = registroEnvolvido
    ? obterTextoPorAlias(valor, [
      'nome', 'name', 'nome envolvido', 'nome do envolvido', 'nomeEnvolvido',
      'nomeDoEnvolvido', 'nome completo', 'envolvido', 'nameInvolvedFact',
      'txtNameInvolvedFact',
    ])
    : ''
  const nomes = nomeConhecido ? [nomeConhecido] : []

  for (const [chave, filho] of entradas) {
    if (typeof filho !== 'object' || filho === null) continue
    nomes.push(...coletarNomesEnvolvidos(
      filho,
      registroEnvolvido || chaveIndicaEnvolvido(chave),
      profundidade + 1,
    ))
  }
  return nomes
}

function extrairNomesEnvolvidos(rep: GdlRepValidada): string[] {
  const envolvidos = coletarNomesEnvolvidos(rep).filter(Boolean)

  return envolvidos.filter((nome, indice) => (
    envolvidos.findIndex(outroNome => normalizarChave(outroNome) === normalizarChave(nome)) === indice
  ))
}

function tipoOrigemCorresponde(tipo: string, tipoEsperado: 'bo' | 'ip'): boolean {
  const normalizado = normalizarChave(tipo).replace(/[\s/_-]/g, '')
  return normalizado.startsWith(tipoEsperado)
}

function formatarNumeroOrigem(numero: string, ano: string): string {
  if (!numero || !ano || numero.endsWith(`/${ano}`)) return numero
  return `${numero}/${ano}`
}

function extrairReferenciasOrigem(rep: GdlRepValidada, tipoEsperado: 'bo' | 'ip'): ReferenciaOrigemGdl[] {
  return rep.origens
    .filter(origem => tipoOrigemCorresponde(origem.tipo, tipoEsperado))
    .map(origem => ({ tipo: origem.tipo, numero: formatarNumeroOrigem(origem.numero, origem.ano) }))
    .filter(origem => Boolean(origem.numero))
}

function obterNumeroUnico(referencias: ReferenciaOrigemGdl[]): string {
  const numeros = [...new Set(referencias.map(referencia => referencia.numero))]
  return numeros.length === 1 ? numeros[0] : ''
}

function extrairDadosInvestigacao(rep: GdlRepValidada): DadosInvestigacaoGdl {
  return {
    envolvidos: extrairNomesEnvolvidos(rep),
    boletinsOcorrencia: extrairReferenciasOrigem(rep, 'bo'),
    inqueritosPoliciais: extrairReferenciasOrigem(rep, 'ip'),
  }
}

function normalizarBooleano(valor: string | boolean): boolean {
  if (typeof valor === 'boolean') return valor
  return ['s', 'sim', 'true', '1'].includes(normalizarChave(valor))
}

function normalizarConsumida(valor: string): 'S' | 'N' | 'P' {
  const normalizado = normalizarChave(valor)
  if (['s', 'sim'].includes(normalizado)) return 'S'
  if (['n', 'nao'].includes(normalizado)) return 'N'
  if (['p', 'parcialmente'].includes(normalizado)) return 'P'
  return 'N'
}

function normalizarDataParaInput(valor: string): string {
  const dataIso = valor.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dataIso) return `${dataIso[1]}-${dataIso[2]}-${dataIso[3]}`

  const dataBrasileira = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/)
  if (dataBrasileira) return `${dataBrasileira[3]}-${dataBrasileira[2]}-${dataBrasileira[1]}`

  return ''
}

function criarCamposComuns(peca: GdlPecaValidada): CamposComunsPecaB602 {
  const quantidadeDescricao = obterTextoPorAlias(peca, [...ALIASES_CAMPOS_COMUNS.quantidadeDescricao])
  const dataLiberacao = obterTextoPorAlias(peca, [...ALIASES_CAMPOS_COMUNS.dataLiberacao])
  const codigoVestigio = obterTextoPorAlias(peca, [...ALIASES_CAMPOS_COMUNS.codigoVestigio])
  const observacao = obterTextoPorAlias(peca, [...ALIASES_CAMPOS_COMUNS.observacao])

  return {
    identificacao: peca.identificacao,
    quantidade: peca.quantidade,
    unidadeMedida: peca.unidadeMedida,
    quantidadeDescricao,
    examinadoInLoco: normalizarBooleano(peca.examinadoInLoco),
    dataEntrada: normalizarDataParaInput(peca.dataEntrada),
    lacreEntrada: peca.lacreEntrada,
    lacreSaida: peca.lacreSaida,
    dataLiberacao: normalizarDataParaInput(dataLiberacao),
    codigoVestigio,
    consumida: normalizarConsumida(peca.consumida),
    observacao,
  }
}

export function normalizarPecaB602(peca: GdlPecaValidada): PecaB602 {
  const definicao = obterTipoPecaB602PorLabel(peca.tipoPeca)
  const personalizados: Record<string, unknown> = {}
  const extrasGdl: Record<string, unknown> = {}

  for (const [chave, valor] of Object.entries(peca)) {
    if (CHAVES_COMUNS.has(normalizarNomeCampo(chave))) continue
    const campo = obterCampoPersonalizado(definicao, chave)
    if (campo) personalizados[campo.id] = normalizarValorCampoPersonalizado(campo, valor)
    else extrasGdl[chave] = valor
  }

  return {
    idLocal: randomUUID(),
    origem: 'gdl',
    alteradaLocalmente: false,
    codPecaGdl: peca.codPeca,
    tipoCodigo: definicao?.codigo ?? '',
    tipoPeca: peca.tipoPeca,
    comuns: criarCamposComuns(peca),
    personalizados,
    extrasGdl,
  }
}

export function converterRepB602(
  rep: GdlRepValidada,
  metadadosIntegracaoGdl?: MetadadosIntegracaoGdl,
): ResultadoImportacaoExame<DadosImportacaoB602> {
  const pecas = rep.pecas.map(normalizarPecaB602)
  const desconhecidas = pecas.filter(peca => !peca.tipoCodigo)
  const dadosSolicitacao = extrairDadosSolicitacao(rep)
  const dadosInvestigacao = extrairDadosInvestigacao(rep)
  const { envolvidos, boletinsOcorrencia, inqueritosPoliciais } = dadosInvestigacao
  const origemInicial = selecionarOrigemInicial(dadosSolicitacao.origensDisponiveis)
  return {
    codigoExame: 'B-602',
    camposGerais: {
      numero: `${rep.numero}-${rep.ano}`,
      tipo_solicitacao: origemInicial?.tipo ?? '',
      numero_documento: origemInicial?.numero ?? '',
      b602_local_cidade: rep.origens[0]?.cidade ?? '',
      b602_numero_bo: obterNumeroUnico(boletinsOcorrencia),
      b602_numero_ip: obterNumeroUnico(inqueritosPoliciais),
      b602_solicitante_nome: dadosSolicitacao.orgao,
      ...Object.fromEntries(envolvidos.slice(0, 10).flatMap((envolvido, indice) => {
        const { qualificacao, nome } = separarEnvolvido(envolvido)
        return [
          [`b602_envolvidos_qualificacao_${indice}`, qualificacao],
          [`b602_envolvidos_${indice}`, nome],
        ]
      })),
      autoridade_solicitante: dadosSolicitacao.autoridade,
      data_requisicao: rep.andamentos[0]?.dataHora?.split('T')[0] ?? '',
    },
    camposEspecificos: { pecas, dadosSolicitacao, dadosInvestigacao },
    metadadosIntegracaoGdl: metadadosIntegracaoGdl
      ? { ...metadadosIntegracaoGdl, dadosSolicitacao, dadosInvestigacao }
      : undefined,
    avisos: [
      ...desconhecidas.map(peca => ({
        codigo: 'TIPO_PECA_NAO_CONFIRMADO',
        mensagem: `O tipo ${peca.tipoPeca} ainda não possui round-trip confirmado.`,
        contexto: { tipoPeca: peca.tipoPeca },
      })),
      ...(envolvidos.length > 10 ? [{
        codigo: 'LIMITE_ENVOLVIDOS_EXCEDIDO',
        mensagem: 'O GDL retornou mais de 10 envolvidos; somente os 10 primeiros foram preenchidos.',
      }] : []),
      ...(envolvidos.length === 0 ? [{
        codigo: 'ENVOLVIDOS_NAO_RETORNADOS',
        mensagem: 'A API do GDL não retornou nomes de envolvidos reconhecíveis nesta consulta.',
      }] : []),
      ...(boletinsOcorrencia.length > 1 && !obterNumeroUnico(boletinsOcorrencia) ? [{
        codigo: 'MULTIPLOS_NUMEROS_BO',
        mensagem: 'O GDL retornou mais de um número de BO; selecione manualmente o número aplicável.',
      }] : []),
      ...(inqueritosPoliciais.length > 1 && !obterNumeroUnico(inqueritosPoliciais) ? [{
        codigo: 'MULTIPLOS_NUMEROS_IP',
        mensagem: 'O GDL retornou mais de um número de IP; selecione manualmente o número aplicável.',
      }] : []),
    ],
  }
}
