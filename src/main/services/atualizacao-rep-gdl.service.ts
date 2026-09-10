import { randomUUID } from 'crypto'
import { withTransaction, executeNonQuery } from '../database/sqlite.js'
import { converterRepGdl } from './gdl-adaptadores.service.js'
import * as gdlService from './gdl.service.js'
import { laudoService } from './laudo.service.js'
import { repService } from './rep.service.js'
import { auditCicloVida } from './audit-log.service.js'
import type { REPRow } from '../types/database.js'
import { combinarEnvolvido, separarEnvolvido } from '../../shared/utils/envolvido.js'
import type { DadosImportacaoB602, PecaB602, ResultadoImportacaoExame } from '../../shared/types/b602-gdl.types.js'
import type {
  AplicarAtualizacaoRepGdlEntrada,
  DiferencaAtualizacaoRepGdl,
  PreviaAtualizacaoRepGdl,
  ResultadoAtualizacaoRepGdl,
} from '../../shared/types/atualizacao-rep-gdl.types.js'

type OperacaoPendente = {
  repId: string
  repAtualizadoEm: string
  laudoId?: string
  laudoAtualizadoEm?: string
  importacao: ResultadoImportacaoExame<DadosImportacaoB602>
  diferencas: DiferencaAtualizacaoRepGdl[]
  expiraEm: number
}

const operacoesPendentes = new Map<string, OperacaoPendente>()
const DURACAO_OPERACAO_MS = 10 * 60 * 1000

const CAMPOS_REP = new Set([
  'tipo_solicitacao', 'numero_documento', 'data_documento', 'observacoes',
  'autoridade_solicitante', 'data_requisicao',
])

function extrairNumeroEAno(numero: string): { numero: string, ano: string } | null {
  const correspondencia = numero.trim().match(/^([\d.\s]+)\s*[/\\-]\s*(\d{4})$/)
  if (!correspondencia) return null
  const numeroNormalizado = correspondencia[1].replace(/\D/g, '')
  return numeroNormalizado ? { numero: numeroNormalizado, ano: correspondencia[2] } : null
}

function valorTexto(valor: unknown): string {
  return valor === null || valor === undefined ? '' : String(valor)
}

function parseCamposEspecificos(serializado?: string): Record<string, unknown> {
  try {
    const resultado: unknown = serializado ? JSON.parse(serializado) : {}
    return typeof resultado === 'object' && resultado !== null ? resultado as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function obterB602(campo: Record<string, unknown>): Record<string, unknown> {
  const b602 = campo.b602
  return typeof b602 === 'object' && b602 !== null ? b602 as Record<string, unknown> : {}
}

function mapaCamposB602(b602: Record<string, unknown>): Record<string, string> {
  const envolvidos = Array.isArray(b602.envolvidos) ? b602.envolvidos.map(valorTexto) : []
  const local = typeof b602.local === 'object' && b602.local !== null ? b602.local as Record<string, unknown> : {}
  const resultado: Record<string, string> = {
    b602_local_cidade: valorTexto(local.cidade),
    b602_numero_bo: valorTexto(b602.numero_bo),
    b602_numero_ip: valorTexto(b602.numero_ip),
    b602_solicitante_nome: valorTexto(b602.solicitante_nome),
  }
  envolvidos.forEach((envolvido, indice) => {
    const separado = separarEnvolvido(envolvido)
    resultado[`b602_envolvidos_qualificacao_${indice}`] = separado.qualificacao
    resultado[`b602_envolvidos_${indice}`] = separado.nome
  })
  return resultado
}

function rotuloCampo(campo: string): string {
  const rotulos: Record<string, string> = {
    tipo_solicitacao: 'Tipo de solicitação', numero_documento: 'Número do documento',
    data_documento: 'Data do documento', observacoes: 'Quesito/observações',
    autoridade_solicitante: 'Autoridade solicitante', data_requisicao: 'Data da requisição',
    b602_local_cidade: 'Cidade do local', b602_numero_bo: 'Boletim de ocorrência',
    b602_numero_ip: 'Inquérito policial', b602_solicitante_nome: 'Órgão solicitante',
  }
  return rotulos[campo] ?? campo.replace(/^b602_envolvidos_/, 'Envolvido ')
}

function compararPecas(atuais: PecaB602[], recebidas: PecaB602[]): DiferencaAtualizacaoRepGdl[] {
  const atuaisPorCodigo = new Map(atuais.filter(peca => peca.codPecaGdl !== undefined).map(peca => [peca.codPecaGdl!, peca]))
  return recebidas.flatMap(peca => {
    const atual = peca.codPecaGdl === undefined ? undefined : atuaisPorCodigo.get(peca.codPecaGdl)
    if (atual && JSON.stringify(atual) === JSON.stringify(peca)) return []
    const id = `peca:${peca.codPecaGdl ?? peca.idLocal}`
    return [{
      id, categoria: 'peca' as const, grupo: 'Peças B-602',
      rotulo: atual ? `Peça ${peca.tipoPeca} (${peca.codPecaGdl})` : `Nova peça ${peca.tipoPeca}`,
      valorLocal: atual ? 'Dados locais diferentes' : 'Não cadastrada',
      valorGdl: 'Dados disponíveis no GDL', selecionadaPorPadrao: true,
    }]
  })
}

function aplicarCamposB602(b602Atual: Record<string, unknown>, importacao: ResultadoImportacaoExame<DadosImportacaoB602>, selecionados: Set<string>): Record<string, unknown> {
  const b602 = { ...b602Atual }
  const local = typeof b602.local === 'object' && b602.local !== null ? { ...(b602.local as Record<string, unknown>) } : {}
  for (const [campo, valor] of Object.entries(importacao.camposGerais)) {
    if (!campo.startsWith('b602_') || !selecionados.has(`campo:${campo}`) || !valor.trim()) continue
    if (campo === 'b602_local_cidade') local.cidade = valor
    else if (campo === 'b602_numero_bo') b602.numero_bo = valor
    else if (campo === 'b602_numero_ip') b602.numero_ip = valor
    else if (campo === 'b602_solicitante_nome') b602.solicitante_nome = valor
  }
  b602.local = local

  const envolvidosAtuais = Array.isArray(b602.envolvidos) ? b602.envolvidos.map(valorTexto) : []
  const envolvidosPorIndice = new Map(envolvidosAtuais.map((envolvido, indice) => [indice, separarEnvolvido(envolvido)]))
  for (const [campo, valor] of Object.entries(importacao.camposGerais)) {
    const correspondencia = campo.match(/^b602_envolvidos_(qualificacao_)?(\d+)$/)
    if (!correspondencia || !selecionados.has(`campo:${campo}`)) continue
    const indice = Number(correspondencia[2])
    const atual = envolvidosPorIndice.get(indice) ?? { qualificacao: '', nome: '' }
    envolvidosPorIndice.set(indice, correspondencia[1] ? { ...atual, qualificacao: valor } : { ...atual, nome: valor })
  }
  const envolvidos = [...envolvidosPorIndice.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, envolvido]) => combinarEnvolvido(envolvido.qualificacao, envolvido.nome))
    .filter(Boolean)
  b602.envolvidos = envolvidos

  const pecasAtuais = Array.isArray(b602.pecas) ? b602.pecas as PecaB602[] : []
  const porCodigo = new Map(pecasAtuais.filter(peca => peca.codPecaGdl !== undefined).map(peca => [peca.codPecaGdl!, peca]))
  const proximas = [...pecasAtuais]
  for (const recebida of importacao.camposEspecificos.pecas) {
    const id = `peca:${recebida.codPecaGdl ?? recebida.idLocal}`
    if (!selecionados.has(id)) continue
    const atual = recebida.codPecaGdl === undefined ? undefined : porCodigo.get(recebida.codPecaGdl)
    if (!atual) proximas.push(recebida)
    else {
      const indice = proximas.findIndex(peca => peca.idLocal === atual.idLocal)
      if (indice >= 0) proximas[indice] = { ...recebida, idLocal: atual.idLocal }
    }
  }
  b602.pecas = proximas
  return b602
}

class AtualizacaoRepGdlService {
  async preparar(repId: string): Promise<PreviaAtualizacaoRepGdl> {
    const rep = await repService.findById(repId)
    if (!rep) throw new Error('REP não encontrada.')
    const identificacao = extrairNumeroEAno(rep.numero)
    if (!identificacao) throw new Error('O número da REP deve estar no formato número/ano para consultar o GDL.')
    const consulta = await gdlService.consultarRep(identificacao.numero, identificacao.ano)
    if (!consulta.sucesso || !consulta.dados) throw new Error(consulta.erro || 'Não foi possível consultar a REP no GDL.')
    const codigo = gdlService.extrairCodigoNaturezaExame(consulta.naturezaExame?.trim() || '')
    if (codigo !== 'B-602') throw new Error(`O exame ${consulta.naturezaExame || 'retornado'} ainda não possui adaptador de atualização.`)
    const importacao = converterRepGdl(codigo, consulta.dados, { origemInicial: 'gdl', ultimaConsulta: { ambiente: consulta.ambiente ?? 'homologacao', numeroRep: identificacao.numero, anoRep: identificacao.ano, consultadoEm: new Date().toISOString() } })
    const camposEspecificos = parseCamposEspecificos(rep.campos_especificos)
    const b602 = obterB602(camposEspecificos)
    const locaisB602 = mapaCamposB602(b602)
    const diferencas: DiferencaAtualizacaoRepGdl[] = []
    for (const [campo, valor] of Object.entries(importacao.camposGerais)) {
      if (!valor.trim() || campo === 'numero') continue
      const local = campo.startsWith('b602_') ? (locaisB602[campo] ?? '') : valorTexto(rep[campo as keyof REPRow])
      if (local === valor) continue
      diferencas.push({ id: `campo:${campo}`, categoria: 'campo', grupo: campo.startsWith('b602_') ? 'Dados B-602' : 'Dados da REP', rotulo: rotuloCampo(campo), valorLocal: local || 'Não preenchido', valorGdl: valor, selecionadaPorPadrao: true })
    }
    const pecasAtuais = Array.isArray(b602.pecas) ? b602.pecas as PecaB602[] : []
    diferencas.push(...compararPecas(pecasAtuais, importacao.camposEspecificos.pecas))
    const laudo = await laudoService.findByRepId(repId)
    const operacaoId = randomUUID()
    operacoesPendentes.set(operacaoId, { repId, repAtualizadoEm: rep.updated_at, laudoId: laudo?.id, laudoAtualizadoEm: laudo?.updated_at, importacao, diferencas, expiraEm: Date.now() + DURACAO_OPERACAO_MS })
    return { operacaoId, repId, repNumero: rep.numero, codigoExame: codigo, diferencas, impactoLaudo: laudo ? { laudoId: laudo.id, status: laudo.status, requerReabertura: ['Concluído', 'Entregue'].includes(laudo.status) } : undefined, avisos: importacao.avisos.map(aviso => aviso.mensagem) }
  }

  async aplicar(entrada: AplicarAtualizacaoRepGdlEntrada): Promise<ResultadoAtualizacaoRepGdl> {
    const operacao = operacoesPendentes.get(entrada.operacaoId)
    if (!operacao || operacao.expiraEm < Date.now()) throw new Error('A revisão expirou. Consulte o GDL novamente.')
    const rep = await repService.findById(operacao.repId)
    const laudo = operacao.laudoId ? await laudoService.findById(operacao.laudoId) : null
    if (!rep || rep.updated_at !== operacao.repAtualizadoEm || (laudo && laudo.updated_at !== operacao.laudoAtualizadoEm)) throw new Error('A REP ou o laudo foi alterado desde a consulta. Atualize a revisão antes de aplicar.')
    if (laudo && ['Concluído', 'Entregue'].includes(laudo.status) && !entrada.reabrirLaudo) throw new Error('Confirme a reabertura do laudo para aplicar esta atualização.')
    const selecionados = new Set(entrada.diferencasSelecionadas)
    const idsValidos = new Set(operacao.diferencas.map(diferenca => diferenca.id))
    if ([...selecionados].some(id => !idsValidos.has(id))) throw new Error('A seleção de diferenças é inválida.')
    const camposEspecificos = parseCamposEspecificos(rep.campos_especificos)
    const b602Atual = obterB602(camposEspecificos)
    const b602 = aplicarCamposB602(b602Atual, operacao.importacao, selecionados)
    const novoCamposEspecificos = { ...camposEspecificos, b602, integracaoGdl: operacao.importacao.metadadosIntegracaoGdl }
    const atualizacoes: Array<[string, unknown]> = []
    for (const [campo, valor] of Object.entries(operacao.importacao.camposGerais)) {
      if (CAMPOS_REP.has(campo) && selecionados.has(`campo:${campo}`) && valor.trim()) atualizacoes.push([campo, valor])
    }
    atualizacoes.push(['campos_especificos', JSON.stringify(novoCamposEspecificos)])
    await withTransaction(async () => {
      const camposSql = atualizacoes.map(([campo]) => `${campo} = ?`).join(', ')
      await executeNonQuery(`UPDATE reps SET ${camposSql}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...atualizacoes.map(([, valor]) => valor), rep.id])
      if (laudo && ['Concluído', 'Entregue'].includes(laudo.status)) {
        await laudoService.updateStatus(laudo.id, 'Em andamento')
        await repService.updateStatus(rep.id, 'Em Andamento')
        auditCicloVida('', 'laudo', laudo.id, 'transicao_status', `Laudo da Requisição ${rep.numero}: ${laudo.status} → Em andamento`, { status: laudo.status }, { status: 'Em andamento', motivo: 'atualizacao_gdl' })
      }
      if (laudo) await laudoService.sincronizarSecoesCondicionais(laudo.id)
    })
    auditCicloVida('', 'rep', rep.id, 'atualizacao', `Requisição ${rep.numero} atualizada a partir do GDL`, null, { diferencas: [...selecionados] })
    operacoesPendentes.delete(entrada.operacaoId)
    return { camposAtualizados: [...selecionados].filter(id => id.startsWith('campo:')).length, pecasAtualizadas: [...selecionados].filter(id => id.startsWith('peca:')).length, laudoReconciliado: Boolean(laudo), laudoReaberto: Boolean(laudo && ['Concluído', 'Entregue'].includes(laudo.status)) }
  }
}

export const atualizacaoRepGdlService = new AtualizacaoRepGdlService()
