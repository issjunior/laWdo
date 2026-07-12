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
  type TipoPecaB602,
} from '../../shared/catalogos/b602-gdl.catalogo.js'
import type { GdlPecaValidada, GdlRepValidada } from './gdl.schema.js'

const CHAVES_COMUNS = new Set([
  'codPeca', 'tipoPeca', 'identificacao', 'quantidade', 'unidadeMedida',
  'numeroAnalises', 'examinadoInLoco', 'dataEntrada', 'lacreEntrada',
  'lacreSaida', 'consumida',
])

function normalizarChave(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')
}

function obterIdCampoPersonalizado(
  tipo: TipoPecaB602 | undefined,
  chaveGdl: string,
): string | undefined {
  const chaveNormalizada = normalizarChave(chaveGdl)
  return tipo?.campos.find(campo => (
    campo.mapeamentoApiConfirmado
    && [campo.chaveGdl, ...(campo.aliasesGdl ?? [])]
      .some(alias => normalizarChave(alias) === chaveNormalizada)
  ))?.id
}

function obterTextoPorAlias(fonte: unknown, aliases: string[]): string {
  if (typeof fonte !== 'object' || fonte === null) return ''
  const normalizarAlias = (valor: string) => normalizarChave(valor).replace(/[\s_-]/g, '')
  const aliasesNormalizados = new Set(aliases.map(normalizarAlias))
  for (const [chave, valor] of Object.entries(fonte)) {
    if (!aliasesNormalizados.has(normalizarAlias(chave))) continue
    if (typeof valor === 'string' || typeof valor === 'number') return String(valor).trim()
  }
  return ''
}

function extrairOrigensCandidatasSolicitacao(rep: GdlRepValidada): ReferenciaOrigemGdl[] {
  const candidatos = rep.origens
    .filter(origem => {
      const normalizado = normalizarChave(origem.tipo).replace(/[\s/_-]/g, '')
      return normalizado.startsWith('bo')
        || normalizado.startsWith('ip')
        || normalizado.startsWith('oficio')
    })
    .map(origem => ({
      tipo: origem.tipo.trim(),
      numero: formatarNumeroOrigem(origem.numero, origem.ano),
    }))

  return candidatos.filter((origem, indice) => (
    candidatos.findIndex(outra => normalizarChave(outra.tipo) === normalizarChave(origem.tipo)) === indice
  ))
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
    origensCandidatasSolicitacao: extrairOrigensCandidatasSolicitacao(rep),
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

function normalizarConsumida(valor: string): 'S' | 'N' | 'P' | '' {
  const normalizado = normalizarChave(valor)
  if (['s', 'sim'].includes(normalizado)) return 'S'
  if (['n', 'nao'].includes(normalizado)) return 'N'
  if (['p', 'parcialmente'].includes(normalizado)) return 'P'
  return ''
}

function criarCamposComuns(peca: GdlPecaValidada): CamposComunsPecaB602 {
  return {
    identificacao: peca.identificacao,
    numeroAnalises: peca.numeroAnalises,
    quantidade: peca.quantidade,
    unidadeMedida: peca.unidadeMedida,
    quantidadeDescricao: '',
    examinadoInLoco: normalizarBooleano(peca.examinadoInLoco),
    dataEntrada: peca.dataEntrada,
    lacreEntrada: peca.lacreEntrada,
    lacreSaida: peca.lacreSaida,
    dataLiberacao: '',
    codigoVestigio: '',
    consumida: normalizarConsumida(peca.consumida),
    observacao: '',
  }
}

export function normalizarPecaB602(peca: GdlPecaValidada): PecaB602 {
  const definicao = obterTipoPecaB602PorLabel(peca.tipoPeca)
  const personalizados: Record<string, unknown> = {}
  const extrasGdl: Record<string, unknown> = {}

  for (const [chave, valor] of Object.entries(peca)) {
    if (CHAVES_COMUNS.has(chave)) continue
    const idCanonico = obterIdCampoPersonalizado(definicao, chave)
    if (idCanonico) personalizados[idCanonico] = valor
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
  return {
    codigoExame: 'B-602',
    camposGerais: {
      numero: `${rep.numero}-${rep.ano}`,
      tipo_solicitacao: dadosSolicitacao.origensCandidatasSolicitacao[0]?.tipo ?? rep.origens[0]?.tipo ?? '',
      numero_documento: dadosSolicitacao.origensCandidatasSolicitacao[0]?.numero ?? rep.origens[0]?.numero ?? '',
      b602_local_cidade: rep.origens[0]?.cidade ?? '',
      b602_numero_bo: obterNumeroUnico(boletinsOcorrencia),
      b602_numero_ip: obterNumeroUnico(inqueritosPoliciais),
      ...Object.fromEntries(envolvidos.slice(0, 10).map((nome, indice) => [`b602_envolvidos_${indice}`, nome])),
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
