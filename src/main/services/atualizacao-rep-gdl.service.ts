import { tipoExameService } from './tipo-exame.service.js'
import { normalizarCodigoExame } from '../../shared/gdl/natureza-exame.js'
import { templateService } from './template.service.js'
import { randomUUID } from 'crypto'
import { withTransaction, executeNonQuery } from '../database/sqlite.js'
import { converterRepGdl } from './gdl-adaptadores.service.js'
import * as gdlService from './gdl.service.js'
import { laudoService } from './laudo.service.js'
import { repService } from './rep.service.js'
import { auditCicloVida } from './audit-log.service.js'
import type { REPRow } from '../types/database.js'
import { ADAPTADORES_ATUALIZACAO_GDL, type ImportacaoAtualizacaoGdl } from './gdl-atualizacao-adaptadores.service.js'
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
  importacao: ImportacaoAtualizacaoGdl
  adaptadorCodigo: 'B-601' | 'B-602'
  diferencas: DiferencaAtualizacaoRepGdl[]
  expiraEm: number
}

const operacoesPendentes = new Map<string, OperacaoPendente>()
const DURACAO_OPERACAO_MS = 10 * 60 * 1000

const CAMPOS_REP = new Set([
  'tipo_solicitacao', 'numero_documento', 'data_documento', 'observacoes',
  'autoridade_solicitante', 'data_requisicao', 'tipo_exame_id',
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

function rotuloCampo(campo: string): string {
  const rotulos: Record<string, string> = {
    tipo_exame_id: 'Tipo de exame', tipo_solicitacao: 'Tipo de solicitação', numero_documento: 'Número do documento',
    data_documento: 'Data do documento', observacoes: 'Quesito/observações',
    autoridade_solicitante: 'Autoridade solicitante', data_requisicao: 'Data da requisição',
    b601_local_cidade: 'Cidade do local', b601_numero_bo: 'Boletim de ocorrência',
    b601_numero_ip: 'Inquérito policial', b601_solicitante_nome: 'Órgão solicitante',
    b602_local_cidade: 'Cidade do local', b602_numero_bo: 'Boletim de ocorrência',
    b602_numero_ip: 'Inquérito policial', b602_solicitante_nome: 'Órgão solicitante',
  }
  return rotulos[campo] ?? campo.replace(/^b(?:601|602)_envolvidos_/, 'Envolvido ')
}

class AtualizacaoRepGdlService {
  async preparar(repId: string, consultaExistente?: gdlService.GdlConsultaResultado, camposVaziosConfirmados: Array<'observacoes' | 'data_requisicao'> = []): Promise<PreviaAtualizacaoRepGdl> {
    const rep = await repService.findById(repId)
    if (!rep) throw new Error('REP não encontrada.')
    const identificacao = extrairNumeroEAno(rep.numero)
    if (!identificacao) throw new Error('O número da REP deve estar no formato número/ano para consultar o GDL.')
    const consulta = consultaExistente ?? await gdlService.consultarRep(identificacao.numero, identificacao.ano)
    if (!consulta.sucesso || !consulta.dados) throw new Error(consulta.erro || 'Não foi possível consultar a REP no GDL.')
    const codigo = gdlService.extrairCodigoNaturezaExame(consulta.naturezaExame?.trim() || '')
    if (!codigo) throw new Error(`O exame ${consulta.naturezaExame || 'retornado'} não possui natureza identificável.`)
    const adaptador = ADAPTADORES_ATUALIZACAO_GDL.get(codigo as 'B-601' | 'B-602')
    if (!adaptador) throw new Error(`O exame ${consulta.naturezaExame || 'retornado'} ainda não possui adaptador de atualização.`)
    const importacao = converterRepGdl(codigo, consulta.dados, { origemInicial: 'gdl', ultimaConsulta: { ambiente: consulta.ambiente ?? 'producao', numeroRep: identificacao.numero, anoRep: identificacao.ano, consultadoEm: new Date().toISOString() } })
    if (importacao.codigoExame !== adaptador.codigo) throw new Error('Adaptador de atualização incompatível.');
    importacao.camposVaziosConfirmados = camposVaziosConfirmados;
    for (const campo of camposVaziosConfirmados) importacao.camposGerais[campo] = '';
    if (consultaExistente) {
      const tipo = (await tipoExameService.findAllOrdered()).find(item => normalizarCodigoExame(item.codigo) === normalizarCodigoExame(codigo));
      if (!tipo) throw new Error('Cadastre ou ative o tipo de exame confirmado no GDL.');
      importacao.camposGerais.tipo_exame_id = tipo.id;
    }
    const camposEspecificos = parseCamposEspecificos(rep.campos_especificos)
    const dadosAtuais = typeof camposEspecificos[adaptador.chaveDados] === 'object' && camposEspecificos[adaptador.chaveDados] !== null
      ? camposEspecificos[adaptador.chaveDados] as Record<string, unknown> : {}
    const locaisCampos = adaptador.mapearCampos(dadosAtuais)
    const diferencas: DiferencaAtualizacaoRepGdl[] = []
    for (const [campo, valor] of Object.entries(importacao.camposGerais)) {
      if ((!valor.trim() && !camposVaziosConfirmados.some(item => item === campo)) || campo === 'numero') continue
      const local = campo.startsWith('b601_') || campo.startsWith('b602_') ? (locaisCampos[campo] ?? '') : valorTexto(rep[campo as keyof REPRow])
      if (local === valor) continue
      diferencas.push({ id: `campo:${campo}`, categoria: 'campo', grupo: campo.startsWith('b601_') || campo.startsWith('b602_') ? adaptador.grupoCampos : 'Dados da REP', rotulo: rotuloCampo(campo), valorLocal: local || 'Não preenchido', valorGdl: valor || 'Vazio confirmado no GDL', selecionadaPorPadrao: Boolean(valor.trim()) && campo !== 'tipo_exame_id' })
    }
    diferencas.push(...adaptador.compararPecas(adaptador.obterPecas(dadosAtuais), 'pecas' in importacao.camposEspecificos ? importacao.camposEspecificos.pecas : []))
    const laudo = await laudoService.findByRepId(repId)
    const operacaoId = randomUUID()
    operacoesPendentes.set(operacaoId, { repId, repAtualizadoEm: rep.updated_at, laudoId: laudo?.id, laudoAtualizadoEm: laudo?.updated_at, importacao, adaptadorCodigo: adaptador.codigo, diferencas, expiraEm: Date.now() + DURACAO_OPERACAO_MS })
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
    const novoTipo = operacao.importacao.camposGerais.tipo_exame_id;
    if (laudo && novoTipo && novoTipo !== rep.tipo_exame_id && selecionados.has('campo:tipo_exame_id')) {
      if (!laudo.template_id) throw new Error('O laudo usa uma estrutura incorporada. Não é possível trocar seu tipo de exame nesta atualização.');
      const template = await templateService.findById(laudo.template_id);
      if (template?.tipo_exame_id && template.tipo_exame_id !== novoTipo) throw new Error('Selecione um template compatível com o novo tipo no laudo antes de aplicar a troca de tipo.');
    }
    const camposEspecificos = parseCamposEspecificos(rep.campos_especificos)
    const adaptador = ADAPTADORES_ATUALIZACAO_GDL.get(operacao.adaptadorCodigo)
    if (!adaptador) throw new Error('Adaptador de atualização não encontrado.')
    const dadosAtuais = typeof camposEspecificos[adaptador.chaveDados] === 'object' && camposEspecificos[adaptador.chaveDados] !== null
      ? camposEspecificos[adaptador.chaveDados] as Record<string, unknown> : {}
    const dadosAtualizados = adaptador.aplicarCampos(dadosAtuais, operacao.importacao, selecionados)
    const novoCamposEspecificos = { ...camposEspecificos, [adaptador.chaveDados]: dadosAtualizados, integracaoGdl: operacao.importacao.metadadosIntegracaoGdl }
    const atualizacoes: Array<[string, unknown]> = []
    for (const [campo, valor] of Object.entries(operacao.importacao.camposGerais)) {
      if (CAMPOS_REP.has(campo) && selecionados.has(`campo:${campo}`) && (valor.trim() || operacao.importacao.camposVaziosConfirmados?.some(item => item === campo))) atualizacoes.push([campo, valor])
    }
    atualizacoes.push(['campos_especificos', JSON.stringify(novoCamposEspecificos)])
    await withTransaction(async () => {
      if (selecionados.size > 0) {
        const camposSql = atualizacoes.map(([campo]) => `${campo} = ?`).join(', ')
        await executeNonQuery(`UPDATE reps SET ${camposSql}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...atualizacoes.map(([, valor]) => valor), rep.id])
      }
      if (laudo && ['Concluído', 'Entregue'].includes(laudo.status)) {
        await laudoService.updateStatus(laudo.id, 'Em andamento')
        await repService.updateStatus(rep.id, 'Em Andamento')
        auditCicloVida('', 'laudo', laudo.id, 'transicao_status', `Laudo da Requisição ${rep.numero}: ${laudo.status} → Em andamento`, { status: laudo.status }, { status: 'Em andamento', motivo: 'atualizacao_gdl' })
      }
      if (laudo) await laudoService.sincronizarSecoesCondicionais(laudo.id, camposEspecificos)
    })
    auditCicloVida(
      '',
      'rep',
      rep.id,
      'atualizacao',
      selecionados.size > 0
        ? `Requisição ${rep.numero} atualizada a partir do GDL`
        : `Laudo da Requisição ${rep.numero} reconciliado com os dados locais`,
      null,
      { diferencas: [...selecionados], somenteReconciliacaoLaudo: selecionados.size === 0 },
    )
    operacoesPendentes.delete(entrada.operacaoId)
    return { camposAtualizados: [...selecionados].filter(id => id.startsWith('campo:')).length, pecasAtualizadas: [...selecionados].filter(id => id.startsWith('peca:')).length, laudoReconciliado: Boolean(laudo), laudoReaberto: Boolean(laudo && ['Concluído', 'Entregue'].includes(laudo.status)) }
  }
}

export const atualizacaoRepGdlService = new AtualizacaoRepGdlService()
