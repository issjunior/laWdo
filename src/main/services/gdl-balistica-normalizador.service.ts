import type { CamposComunsPecaB602, DadosSolicitacaoGdl, DadosInvestigacaoGdl, MetadadosIntegracaoGdl, ReferenciaOrigemGdl, AvisoImportacao, ResultadoImportacaoExame } from '../../shared/types/b602-gdl.types.js'
import type { PecaBalistica } from '../../shared/types/pecas-balistica.types.js'
import type { DadosImportacaoBalistica } from '../../shared/types/gdl-importacao.types.js'
import type { GdlPecaValidada, GdlRepValidada } from './gdl.schema.js'
import { separarEnvolvido } from '../../shared/utils/envolvido.js'

export function normalizarChave(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')
}

const DESCRICAO_STATUS_LAUDO_EM_EXECUCAO = 'status alterado para laudo em execucao'

function normalizarDescricaoAndamento(valor: string): string {
  return normalizarChave(valor).replace(/\s+/g, ' ')
}

function extrairDataExecucaoLaudo(rep: GdlRepValidada): string | undefined {
  const andamentosValidos = rep.andamentos.flatMap(andamento => {
    if (normalizarDescricaoAndamento(andamento.descricao) !== DESCRICAO_STATUS_LAUDO_EM_EXECUCAO) return []

    const textoDataHora = andamento.dataHora.trim()
    const correspondencia = textoDataHora.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s)/)
    const instante = Date.parse(textoDataHora)
    if (!correspondencia || Number.isNaN(instante)) return []

    const [, ano, mes, dia] = correspondencia
    const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)))
    if (
      data.getUTCFullYear() !== Number(ano)
      || data.getUTCMonth() !== Number(mes) - 1
      || data.getUTCDate() !== Number(dia)
    ) return []

    return [{ instante, data: `${ano}-${mes}-${dia}` }]
  })

  return andamentosValidos
    .sort((primeiro, segundo) => segundo.instante - primeiro.instante)[0]
    ?.data
}

export function normalizarNomeCampo(valor: string): string {
  return normalizarChave(valor).replace(/[^a-z0-9]/g, '')
}

const ALIASES_CAMPOS_COMUNS = {
  quantidadeDescricao: ['quantidadeDescricao', 'Quant. Descrição', 'Quantidade Descrição', 'Descrição da Quantidade'],
  materialIncinerado: ['incinerado', 'matIncinerado', 'materialIncinerado', 'Mat. Incinerado?', 'Material Incinerado?'],
  dataLiberacao: ['dataLiberacao', 'Data de Liberação', 'Data Liberação'],
  codigoVestigio: ['codigoVestigio', 'Código do Vestígio', 'Cod. Vestígio'],
  observacao: ['observacao', 'Observação'],
} as const

export const CHAVES_COMUNS = new Set([
  'codPeca', 'tipoPeca', 'identificacao', 'quantidade', 'unidadeMedida',
  'numeroAnalises', 'examinadoInLoco', 'dataEntrada', 'lacreEntrada',
  'lacreSaida', 'consumida',
  ...Object.values(ALIASES_CAMPOS_COMUNS).flat(),
].map(normalizarNomeCampo))

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
    .map(criarReferenciaOrigem)
    .filter(origem => Boolean(origem.tipo))

  return origens.filter((origem, indice) => (
    origens.findIndex(outra => (
      normalizarChave(outra.tipo) === normalizarChave(origem.tipo)
      && outra.numero === origem.numero
      && outra.dataDocumento === origem.dataDocumento
      && outra.iniciais === origem.iniciais
    )) === indice
  ))
}

function origemPertenceFamiliaPreferencial(origem: ReferenciaOrigemGdl): boolean {
  const tipo = normalizarChave(origem.tipo).replace(/[\s/_-]/g, '')
  return tipo.startsWith('bo') || tipo.startsWith('ip') || tipo.startsWith('oficio')
}

function origemPertenceFamiliaOficio(origem: ReferenciaOrigemGdl): boolean {
  const tipo = normalizarChave(origem.tipo).replace(/[\s/_-]/g, '')
  return tipo.startsWith('oficio')
}

function selecionarOrigemInicial(origens: ReferenciaOrigemGdl[]): ReferenciaOrigemGdl | undefined {
  const oficios = origens.filter(origemPertenceFamiliaOficio)
  if (oficios.length > 0) return oficios[oficios.length - 1]

  const boletinsOuInqueritos = origens.filter(origemPertenceFamiliaPreferencial)
  return boletinsOuInqueritos[boletinsOuInqueritos.length - 1]
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

function formatarNumeroOrigem(numero: string, ano: string, iniciais: string = ''): string {
  if (!numero) return numero
  const numeroComAno = numero.match(/^(.*?)[/-](\d{4})$/)
  const anoEfetivo = ano || numeroComAno?.[2] || ''
  if (!anoEfetivo) return numero
  if (iniciais) {
    const numeroSemAno = numeroComAno?.[1] || numero
    return `${numeroSemAno}-${anoEfetivo}/${iniciais}`
  }
  if (numeroComAno) return numero
  return `${numero}/${anoEfetivo}`
}

function normalizarDataDocumento(valor: string): string {
  const texto = valor.trim()
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/)
  const brasileira = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const partes = iso ? [iso[1], iso[2], iso[3]] : brasileira ? [brasileira[3], brasileira[2], brasileira[1]] : undefined
  if (!partes) return ''

  const [ano, mes, dia] = partes.map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return ''
  return `${partes[0]}-${partes[1]}-${partes[2]}`
}

function criarReferenciaOrigem(origem: GdlRepValidada['origens'][number]): ReferenciaOrigemGdl {
  const iniciais = origem.iniciais.trim()
  const dataDocumento = normalizarDataDocumento(origem.dataDocumento)
  return {
    tipo: origem.tipo.trim(),
    numero: formatarNumeroOrigem(origem.numero, origem.ano, iniciais),
    ...(dataDocumento ? { dataDocumento } : {}),
    ...(iniciais ? { iniciais } : {}),
  }
}

function extrairReferenciasOrigem(rep: GdlRepValidada, tipoEsperado: 'bo' | 'ip'): ReferenciaOrigemGdl[] {
  return rep.origens
    .filter(origem => tipoOrigemCorresponde(origem.tipo, tipoEsperado))
    .map(criarReferenciaOrigem)
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

function normalizarSimNao(valor: string): 'S' | 'N' {
  return ['s', 'sim', 'true', '1'].includes(normalizarChave(valor)) ? 'S' : 'N'
}

function normalizarDataParaInput(valor: string): string {
  const dataIso = valor.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dataIso) return `${dataIso[1]}-${dataIso[2]}-${dataIso[3]}`

  const dataBrasileira = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/)
  if (dataBrasileira) return `${dataBrasileira[3]}-${dataBrasileira[2]}-${dataBrasileira[1]}`

  return ''
}

export function criarCamposComuns(peca: GdlPecaValidada): CamposComunsPecaB602 {
  const quantidadeDescricao = obterTextoPorAlias(peca, [...ALIASES_CAMPOS_COMUNS.quantidadeDescricao])
  const materialIncinerado = obterTextoPorAlias(peca, [...ALIASES_CAMPOS_COMUNS.materialIncinerado])
  const dataLiberacao = obterTextoPorAlias(peca, [...ALIASES_CAMPOS_COMUNS.dataLiberacao])
  const codigoVestigio = obterTextoPorAlias(peca, [...ALIASES_CAMPOS_COMUNS.codigoVestigio])
  const observacao = obterTextoPorAlias(peca, [...ALIASES_CAMPOS_COMUNS.observacao])

  return {
    identificacao: peca.identificacao,
    quantidade: peca.quantidade,
    unidadeMedida: peca.unidadeMedida,
    quantidadeDescricao,
    examinadoInLoco: normalizarBooleano(peca.examinadoInLoco),
    materialIncinerado: normalizarSimNao(materialIncinerado),
    dataEntrada: normalizarDataParaInput(peca.dataEntrada),
    lacreEntrada: peca.lacreEntrada,
    lacreSaida: peca.lacreSaida,
    dataLiberacao: normalizarDataParaInput(dataLiberacao),
    codigoVestigio,
    consumida: normalizarConsumida(peca.consumida),
    observacao,
  }
}

export function montarImportacaoBalistica<T extends PecaBalistica, TCodigo extends 'B-601' | 'B-602'>(
  rep: GdlRepValidada,
  codigoExame: TCodigo,
  pecas: T[],
  metadadosIntegracaoGdl?: MetadadosIntegracaoGdl,
  avisosPecas: AvisoImportacao[] = [],
): ResultadoImportacaoExame<DadosImportacaoBalistica<T>> & { codigoExame: TCodigo } {
  const prefixo = codigoExame === 'B-601' ? 'b601' : 'b602'
  const dadosSolicitacao = extrairDadosSolicitacao(rep)
  const dadosInvestigacao = extrairDadosInvestigacao(rep)
  const dataExecucaoLaudo = extrairDataExecucaoLaudo(rep)
  const { envolvidos, boletinsOcorrencia, inqueritosPoliciais } = dadosInvestigacao
  const origemInicial = selecionarOrigemInicial(dadosSolicitacao.origensDisponiveis)
  return {
    codigoExame,
    camposGerais: {
      numero: `${rep.numero}-${rep.ano}`,
      tipo_solicitacao: origemInicial?.tipo ?? '',
      numero_documento: origemInicial?.numero ?? '',
      data_documento: origemInicial?.dataDocumento ?? '',
      ...(rep.quesitoAberto ? { observacoes: rep.quesitoAberto } : {}),
      [`${prefixo}_local_cidade`]: rep.origens[0]?.cidade ?? '',
      [`${prefixo}_numero_bo`]: obterNumeroUnico(boletinsOcorrencia),
      [`${prefixo}_numero_ip`]: obterNumeroUnico(inqueritosPoliciais),
      [`${prefixo}_solicitante_nome`]: dadosSolicitacao.orgao,
      ...Object.fromEntries(envolvidos.slice(0, 10).flatMap((envolvido, indice) => {
        const { qualificacao, nome } = separarEnvolvido(envolvido)
        return [[`${prefixo}_envolvidos_qualificacao_${indice}`, qualificacao], [`${prefixo}_envolvidos_${indice}`, nome]]
      })),
      autoridade_solicitante: dadosSolicitacao.autoridade,
      data_requisicao: rep.dataEntradaSolicitacao,
    },
    camposEspecificos: { pecas, dadosSolicitacao, dadosInvestigacao },
    metadadosIntegracaoGdl: metadadosIntegracaoGdl ? {
      ...metadadosIntegracaoGdl,
      ...(dataExecucaoLaudo ? { dataExecucaoLaudo } : {}),
      dadosSolicitacao,
      dadosInvestigacao,
    } : undefined,
    avisos: [
      ...(!rep.dataEntradaSolicitacao ? [{ codigo: 'DATA_ENTRADA_SOLICITACAO_NAO_RETORNADA', mensagem: 'A Data de Entrada/Solicitação não foi fornecida pela API do GDL; preencha a Data de recebimento manualmente.' }] : []),
      ...avisosPecas,
      ...(envolvidos.length > 10 ? [{ codigo: 'LIMITE_ENVOLVIDOS_EXCEDIDO', mensagem: 'O GDL retornou mais de 10 envolvidos; somente os 10 primeiros foram preenchidos.' }] : []),
      ...(envolvidos.length === 0 ? [{ codigo: 'ENVOLVIDOS_NAO_RETORNADOS', mensagem: 'A API do GDL não retornou nomes de envolvidos reconhecíveis nesta consulta.' }] : []),
      ...(boletinsOcorrencia.length > 1 && !obterNumeroUnico(boletinsOcorrencia) ? [{ codigo: 'MULTIPLOS_NUMEROS_BO', mensagem: 'O GDL retornou mais de um número de BO; selecione manualmente o número aplicável.' }] : []),
      ...(inqueritosPoliciais.length > 1 && !obterNumeroUnico(inqueritosPoliciais) ? [{ codigo: 'MULTIPLOS_NUMEROS_IP', mensagem: 'O GDL retornou mais de um número de IP; selecione manualmente o número aplicável.' }] : []),
    ],
  }
}
