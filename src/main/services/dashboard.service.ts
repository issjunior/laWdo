import { executeQuery } from '../database/sqlite.js'
import { getLogger } from '../utils/logger.js'
import type {
  DashboardIndicadorConfiabilidade,
  DashboardKpiStatus,
  DashboardLaudoRecente,
  DashboardRepRecente,
  DashboardProjecoes,
  DashboardResumo,
  DashboardSerieAnual,
  DashboardSerieMensal,
  DashboardTempoMedioTipoExame,
  DashboardConsultaLaudosEntrada,
  DashboardConsultaLaudosResultado,
  DashboardLaudoConsulta,
  DashboardProducaoLaudosEntrada,
  DashboardProducaoLaudosResultado,
  DashboardIndicadorCicloProducao,
} from '../../types/dashboard.js'

const log = getLogger('database')

type LinhaContagemStatus = {
  status: string | null
  total: number | string | null
}

type LinhaTempoMedio = {
  tipoExameId: string | null
  tipoExameNome: string | null
  totalLaudos: number | string | null
  tempoMedioDias: number | string | null
}

type LinhaLaudoRecente = {
  id: string | null
  rep_numero: string | null
  tipo_exame_nome: string | null
  status: string | null
  updated_at: string | null
}

type LinhaRepRecente = {
  id: string | null
  numero: string | null
  tipo_exame_nome: string | null
  status: string | null
  updated_at: string | null
}

type LinhaSerieMensal = {
  referencia: string | null
  ano: number | string | null
  mes: number | string | null
  totalConcluidos: number | string | null
}

const STATUS_REP = ['Pendente', 'Em Andamento', 'Concluído'] as const
const STATUS_LAUDO = ['Em andamento', 'Concluído', 'Entregue'] as const

const TAMANHO_PAGINA_PADRAO = 10
const TAMANHO_PAGINA_MAXIMO = 100

const toInt = (valor: unknown, fallback = 0): number => {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return Math.round(valor)
  }
  if (typeof valor === 'string') {
    const numero = Number(valor)
    if (Number.isFinite(numero)) {
      return Math.round(numero)
    }
  }
  return fallback
}

const toFloat = (valor: unknown, fallback = 0): number => {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return valor
  }
  if (typeof valor === 'string') {
    const numero = Number(valor)
    if (Number.isFinite(numero)) {
      return numero
    }
  }
  return fallback
}

const preencherStatus = (
  linhas: LinhaContagemStatus[],
  statusBase: readonly string[],
): DashboardKpiStatus[] => {
  const mapa = new Map<string, number>()

  for (const linha of linhas) {
    const status = typeof linha.status === 'string' ? linha.status : ''
    if (!status) continue
    mapa.set(status, toInt(linha.total))
  }

  return statusBase.map(status => ({
    status,
    total: mapa.get(status) ?? 0,
  }))
}

const proximoMes = (referencia: string): { referencia: string; ano: number; mes: number } => {
  const [anoTexto, mesTexto] = referencia.split('-')
  const ano = Number(anoTexto)
  const mes = Number(mesTexto)

  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return { referencia, ano: 0, mes: 0 }
  }

  const proximo = new Date(Date.UTC(ano, mes, 1))
  const proximoAno = proximo.getUTCFullYear()
  const proximoMesNumero = proximo.getUTCMonth() + 1

  return {
    referencia: `${proximoAno}-${String(proximoMesNumero).padStart(2, '0')}`,
    ano: proximoAno,
    mes: proximoMesNumero,
  }
}

const listarMesesNoIntervalo = (inicio: string, fim: string): string[] => {
  const resultado: string[] = []
  let atual = `${inicio}-01T00:00:00.000Z`
  const limite = `${fim}-01T00:00:00.000Z`

  while (atual <= limite) {
    const data = new Date(atual)
    const ano = data.getUTCFullYear()
    const mes = data.getUTCMonth() + 1
    resultado.push(`${ano}-${String(mes).padStart(2, '0')}`)
    const proximo = new Date(Date.UTC(ano, mes, 1))
    atual = proximo.toISOString()
  }

  return resultado
}

const completarSerieMensal = (historicoMensal: DashboardSerieMensal[]): DashboardSerieMensal[] => {
  if (historicoMensal.length === 0) {
    return []
  }

  const primeiro = historicoMensal[0]?.referencia
  const ultimo = historicoMensal[historicoMensal.length - 1]?.referencia

  if (!primeiro || !ultimo) {
    return []
  }

  const mapa = new Map(historicoMensal.map(item => [item.referencia, item]))

  return listarMesesNoIntervalo(primeiro, ultimo).map(referencia => {
    const existente = mapa.get(referencia)
    if (existente) {
      return existente
    }

    const [anoTexto, mesTexto] = referencia.split('-')
    return {
      referencia,
      ano: Number(anoTexto),
      mes: Number(mesTexto),
      totalConcluidos: 0,
    }
  })
}

export const resumirSerieAnual = (serieMensal: DashboardSerieMensal[]): DashboardSerieAnual[] => {
  const mapa = new Map<number, DashboardSerieAnual>()

  for (const item of serieMensal) {
    const atual = mapa.get(item.ano) ?? {
      ano: item.ano,
      totalConcluidos: 0,
      mesesComDados: 0,
    }

    atual.totalConcluidos += item.totalConcluidos
    if (item.totalConcluidos > 0) {
      atual.mesesComDados += 1
    }

    mapa.set(item.ano, atual)
  }

  return Array.from(mapa.values()).sort((a, b) => a.ano - b.ano)
}

export const avaliarConfiabilidadeHistorico = (
  serieCompleta: DashboardSerieMensal[],
  historicoMensal: DashboardSerieMensal[],
): DashboardIndicadorConfiabilidade => {
  const mesesHistoricos = serieCompleta.length
  const mesesComDados = historicoMensal.length
  const coberturaHistorica = mesesHistoricos > 0
    ? Number((mesesComDados / mesesHistoricos).toFixed(2))
    : 0

  if (mesesComDados === 0) {
    return {
      dadosInsuficientes: true,
      mesesHistoricos,
      mesesComDados,
      coberturaHistorica,
      nivel: 'insuficiente',
      mensagem: 'Dados insuficientes para estimativa confiável: nenhum laudo concluído foi encontrado na base histórica.',
    }
  }

  if (mesesComDados >= 12 && coberturaHistorica >= 0.85) {
    return {
      dadosInsuficientes: false,
      mesesHistoricos,
      mesesComDados,
      coberturaHistorica,
      nivel: 'alta',
      mensagem: 'Projeção estimada com base histórica ampla e distribuição mensal consistente.',
    }
  }

  if (mesesComDados >= 6 && mesesHistoricos >= 9 && coberturaHistorica >= 0.7) {
    return {
      dadosInsuficientes: false,
      mesesHistoricos,
      mesesComDados,
      coberturaHistorica,
      nivel: 'moderada',
      mensagem: 'Projeção estimada com base histórica suficiente, mas ainda sujeita a oscilações mensais.',
    }
  }

  if (mesesComDados >= 3 && coberturaHistorica >= 0.45) {
    return {
      dadosInsuficientes: true,
      mesesHistoricos,
      mesesComDados,
      coberturaHistorica,
      nivel: 'baixa',
      mensagem: 'Dados insuficientes para estimativa confiável: a série histórica existe, mas ainda é curta ou irregular.',
    }
  }

  return {
    dadosInsuficientes: true,
    mesesHistoricos,
    mesesComDados,
    coberturaHistorica,
    nivel: 'insuficiente',
    mensagem: 'Dados insuficientes para estimativa confiável: a série histórica é muito esparsa para sustentar uma projeção operacional.',
  }
}

export const estimarProjecoes = (
  serieCompleta: DashboardSerieMensal[],
): Pick<DashboardProjecoes, 'projecaoMensalEstimada' | 'projecaoAnualEstimada'> => {
  if (serieCompleta.length === 0) {
    return {
      projecaoMensalEstimada: null,
      projecaoAnualEstimada: null,
    }
  }

  const janela = serieCompleta.slice(-Math.min(6, serieCompleta.length))
  const mediaMensal = janela.reduce((acc, item) => acc + item.totalConcluidos, 0) / janela.length
  const ultimoMes = serieCompleta[serieCompleta.length - 1]
  const referenciaProjetada = proximoMes(ultimoMes.referencia)
  const totalMensal = Math.max(0, Math.round(mediaMensal))

  return {
    projecaoMensalEstimada: {
      referencia: referenciaProjetada.referencia,
      ano: referenciaProjetada.ano,
      mes: referenciaProjetada.mes,
      totalConcluidos: totalMensal,
    },
    projecaoAnualEstimada: {
      ano: referenciaProjetada.ano,
      totalConcluidos: Math.max(0, Math.round(mediaMensal * 12)),
      mesesComDados: janela.filter(item => item.totalConcluidos > 0).length,
    },
  }
}

export class DashboardService {
  async obterResumo(): Promise<DashboardResumo> {
    try {
      const [
        repsPorStatusRaw,
        prazoProximoRaw,
        prazoVencidoRaw,
        laudosPorStatusRaw,
        tempoMedioRaw,
        laudosAguardandoEntregaRaw,
        laudosSemAlteracaoRaw,
        repsRecentesRaw,
        laudosRecentesRaw,
      ] = await Promise.all([
        executeQuery<LinhaContagemStatus>(`
          SELECT status, COUNT(*) AS total
          FROM reps
          GROUP BY status
        `),
        executeQuery<{ total: number | string | null }>(`
          SELECT COUNT(*) AS total
          FROM reps
          WHERE status IN ('Pendente', 'Em Andamento')
            AND prazo IS NOT NULL
            AND date(substr(prazo, 1, 10)) BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+7 days')
        `),
        executeQuery<{ total: number | string | null }>(`
          SELECT COUNT(*) AS total
          FROM reps
          WHERE status IN ('Pendente', 'Em Andamento')
            AND prazo IS NOT NULL
            AND date(substr(prazo, 1, 10)) < date('now', 'localtime')
        `),
        executeQuery<LinhaContagemStatus>(`
          SELECT status, COUNT(*) AS total
          FROM laudos
          GROUP BY status
        `),
        executeQuery<LinhaTempoMedio>(`
          SELECT
            te.id AS tipoExameId,
            te.nome AS tipoExameNome,
            COUNT(l.id) AS totalLaudos,
            AVG(julianday(l.data_conclusao) - julianday(l.data_inicio)) AS tempoMedioDias
          FROM laudos l
          JOIN reps r ON r.id = l.rep_id
          LEFT JOIN tipos_exame te ON te.id = r.tipo_exame_id
          WHERE l.data_inicio IS NOT NULL
            AND l.data_conclusao IS NOT NULL
            AND julianday(l.data_conclusao) >= julianday(l.data_inicio)
          GROUP BY te.id, te.nome
          ORDER BY te.nome COLLATE NOCASE ASC
        `),
        executeQuery<{ total: number | string | null }>(`
          SELECT COUNT(*) AS total
          FROM laudos
          WHERE status = 'Concluído' AND data_entrega IS NULL
        `),
        executeQuery<{ total: number | string | null }>(`
          SELECT COUNT(*) AS total
          FROM laudos
          WHERE status = 'Em andamento'
            AND julianday('now', 'localtime') - julianday(updated_at) >= 7
        `),
        executeQuery<LinhaRepRecente>(`
          SELECT
            r.id,
            r.numero,
            COALESCE(te.nome, 'Tipo de exame não informado') AS tipo_exame_nome,
            r.status,
            r.updated_at
          FROM reps r
          LEFT JOIN tipos_exame te ON te.id = r.tipo_exame_id
          ORDER BY r.updated_at DESC
          LIMIT 6
        `),
        executeQuery<LinhaLaudoRecente>(`
          SELECT
            l.id,
            r.numero AS rep_numero,
            COALESCE(te.nome, 'Tipo de exame não informado') AS tipo_exame_nome,
            l.status,
            l.updated_at
          FROM laudos l
          JOIN reps r ON r.id = l.rep_id
          LEFT JOIN tipos_exame te ON te.id = r.tipo_exame_id
          ORDER BY l.updated_at DESC
          LIMIT 6
        `),
      ])

      const tempoMedioPorTipoExame: DashboardTempoMedioTipoExame[] = tempoMedioRaw.map(item => ({
        tipoExameId: typeof item.tipoExameId === 'string' ? item.tipoExameId : null,
        tipoExameNome: typeof item.tipoExameNome === 'string' && item.tipoExameNome.trim()
          ? item.tipoExameNome
          : 'Tipo de exame não informado',
        totalLaudos: toInt(item.totalLaudos),
        tempoMedioDias: Number(toFloat(item.tempoMedioDias).toFixed(1)),
      }))

      const repsRecentes: DashboardRepRecente[] = repsRecentesRaw
        .filter(item => typeof item.id === 'string' && item.id.trim())
        .map(item => ({
          id: item.id as string,
          numero: typeof item.numero === 'string' && item.numero.trim()
            ? item.numero
            : 'REP sem número',
          tipo_exame_nome: typeof item.tipo_exame_nome === 'string' && item.tipo_exame_nome.trim()
            ? item.tipo_exame_nome
            : 'Tipo de exame não informado',
          status: typeof item.status === 'string' && item.status.trim()
            ? item.status
            : 'Sem status',
          updated_at: typeof item.updated_at === 'string' ? item.updated_at : '',
        }))

      const laudosRecentes: DashboardLaudoRecente[] = laudosRecentesRaw
        .filter(item => typeof item.id === 'string' && item.id.trim())
        .map(item => ({
          id: item.id as string,
          rep_numero: typeof item.rep_numero === 'string' && item.rep_numero.trim()
            ? item.rep_numero
            : 'REP sem número',
          tipo_exame_nome: typeof item.tipo_exame_nome === 'string' && item.tipo_exame_nome.trim()
            ? item.tipo_exame_nome
            : 'Tipo de exame não informado',
          status: typeof item.status === 'string' && item.status.trim()
            ? item.status
            : 'Sem status',
          updated_at: typeof item.updated_at === 'string' ? item.updated_at : '',
        }))

      return {
        repsPorStatus: preencherStatus(repsPorStatusRaw, STATUS_REP),
        repsPrazoProximo: toInt(prazoProximoRaw[0]?.total),
        repsPrazoVencido: toInt(prazoVencidoRaw[0]?.total),
        laudosPorStatus: preencherStatus(laudosPorStatusRaw, STATUS_LAUDO),
        laudosConcluidosAguardandoEntrega: toInt(laudosAguardandoEntregaRaw[0]?.total),
        laudosEmAndamentoSemAlteracao: toInt(laudosSemAlteracaoRaw[0]?.total),
        tempoMedioPorTipoExame,
        repsRecentes,
        laudosRecentes,
      }
    } catch (error) {
      log.error('Erro ao consolidar resumo do dashboard', error)
      throw error
    }
  }

  async consultarLaudos(entrada: DashboardConsultaLaudosEntrada): Promise<DashboardConsultaLaudosResultado> {
    const pagina = Math.max(1, Math.floor(entrada.pagina ?? 1))
    const tamanhoPagina = Math.min(TAMANHO_PAGINA_MAXIMO, Math.max(1, Math.floor(entrada.tamanhoPagina ?? TAMANHO_PAGINA_PADRAO)))
    const colunaData = {
      criacao: 'l.created_at',
      alteracao: 'l.updated_at',
      conclusao: 'l.data_conclusao',
      entrega: 'l.data_entrega',
    }[entrada.tipoData]
    const clausulas = [`${colunaData} IS NOT NULL`]
    const parametros: (string | number)[] = []

    if (entrada.busca?.trim()) {
      clausulas.push("(r.numero LIKE ? OR te.codigo LIKE ? OR te.nome LIKE ?)")
      const termo = `%${entrada.busca.trim()}%`
      parametros.push(termo, termo, termo)
    }
    if (entrada.dataInicial) {
      clausulas.push(`date(${colunaData}) >= date(?)`)
      parametros.push(entrada.dataInicial)
    }
    if (entrada.dataFinal) {
      clausulas.push(`date(${colunaData}) <= date(?)`)
      parametros.push(entrada.dataFinal)
    }

    const de = `FROM laudos l JOIN reps r ON r.id = l.rep_id LEFT JOIN tipos_exame te ON te.id = r.tipo_exame_id WHERE ${clausulas.join(' AND ')}`
    const [linhas, totalRaw, statusRaw] = await Promise.all([
      executeQuery<DashboardLaudoConsulta>(`
        SELECT l.id, l.rep_id AS repId, r.numero AS repNumero, te.id AS tipoExameId,
          te.codigo AS tipoExameCodigo, COALESCE(te.nome, 'Tipo de exame não informado') AS tipoExameNome,
          l.status, l.created_at AS createdAt, l.updated_at AS updatedAt, l.data_conclusao AS dataConclusao,
          l.data_entrega AS dataEntrega, ${colunaData} AS dataOrdenacao
        ${de} ORDER BY datetime(${colunaData}) DESC LIMIT ? OFFSET ?
      `, [...parametros, tamanhoPagina, (pagina - 1) * tamanhoPagina]),
      executeQuery<{ total: number | string | null }>(`SELECT COUNT(*) AS total ${de}`, parametros),
      executeQuery<LinhaContagemStatus>(`SELECT l.status, COUNT(*) AS total ${de} GROUP BY l.status`, parametros),
    ])

    return {
      itens: linhas.map(linha => ({ ...linha, tipoExameId: linha.tipoExameId ?? null, tipoExameCodigo: linha.tipoExameCodigo ?? null })),
      total: toInt(totalRaw[0]?.total),
      pagina,
      tamanhoPagina,
      porStatus: preencherStatus(statusRaw, STATUS_LAUDO),
    }
  }

  async obterProducaoLaudos(entrada: DashboardProducaoLaudosEntrada): Promise<DashboardProducaoLaudosResultado[]> {
    const clausulas = ["l.status IN ('Concluído', 'Entregue')", 'l.data_conclusao IS NOT NULL', 'l.data_inicio IS NOT NULL', 'r.created_at IS NOT NULL']
    const parametros: string[] = []
    if (entrada.tipoExameId) {
      clausulas.push('te.id = ?')
      parametros.push(entrada.tipoExameId)
    }
    if (entrada.dataInicial) {
      clausulas.push('date(l.data_conclusao) >= date(?)')
      parametros.push(entrada.dataInicial)
    }
    if (entrada.dataFinal) {
      clausulas.push('date(l.data_conclusao) <= date(?)')
      parametros.push(entrada.dataFinal)
    }
    const linhas = await executeQuery<{ id: string; codigo: string | null; nome: string | null; repDias: number | string; laudoDias: number | string }>(`
      SELECT te.id, te.codigo, te.nome,
        julianday(l.data_conclusao) - julianday(r.created_at) AS repDias,
        julianday(l.data_conclusao) - julianday(l.data_inicio) AS laudoDias
      FROM laudos l JOIN reps r ON r.id = l.rep_id JOIN tipos_exame te ON te.id = r.tipo_exame_id
      WHERE ${clausulas.join(' AND ')}
        AND julianday(l.data_conclusao) >= julianday(r.created_at)
        AND julianday(l.data_conclusao) >= julianday(l.data_inicio)
      ORDER BY te.nome COLLATE NOCASE ASC
    `, parametros)
    const porNatureza = new Map<string, typeof linhas>()
    for (const linha of linhas) porNatureza.set(linha.id, [...(porNatureza.get(linha.id) ?? []), linha])
    const resumir = (valores: number[]): DashboardIndicadorCicloProducao => {
      const ordenados = valores.sort((a, b) => a - b)
      const meio = Math.floor(ordenados.length / 2)
      const mediana = ordenados.length % 2 ? ordenados[meio] : ((ordenados[meio - 1] ?? 0) + (ordenados[meio] ?? 0)) / 2
      return { quantidade: ordenados.length, mediaDias: Number((ordenados.reduce((soma, valor) => soma + valor, 0) / ordenados.length).toFixed(1)), medianaDias: Number(mediana.toFixed(1)) }
    }
    return Array.from(porNatureza.values()).map(grupo => ({
      natureza: { id: grupo[0].id, codigo: grupo[0].codigo, nome: grupo[0].nome ?? 'Tipo de exame não informado' },
      repAteConclusao: resumir(grupo.map(item => toFloat(item.repDias)).filter(item => item >= 0)),
      laudoAteConclusao: resumir(grupo.map(item => toFloat(item.laudoDias)).filter(item => item >= 0)),
    }))
  }

  async obterProjecoes(): Promise<DashboardProjecoes> {
    try {
      const historicoMensalRaw = await executeQuery<LinhaSerieMensal>(`
        SELECT
          substr(data_conclusao, 1, 7) AS referencia,
          CAST(substr(data_conclusao, 1, 4) AS INTEGER) AS ano,
          CAST(substr(data_conclusao, 6, 2) AS INTEGER) AS mes,
          COUNT(*) AS totalConcluidos
        FROM laudos
        WHERE data_conclusao IS NOT NULL
        GROUP BY substr(data_conclusao, 1, 7)
        ORDER BY substr(data_conclusao, 1, 7) ASC
      `)

      const historicoMensal: DashboardSerieMensal[] = historicoMensalRaw
        .filter(item => typeof item.referencia === 'string' && item.referencia.length === 7)
        .map(item => ({
          referencia: item.referencia as string,
          ano: toInt(item.ano),
          mes: toInt(item.mes),
          totalConcluidos: toInt(item.totalConcluidos),
        }))

      const serieCompleta = completarSerieMensal(historicoMensal)
      const resumoAnual = resumirSerieAnual(historicoMensal)
      const indicadorConfiabilidade = avaliarConfiabilidadeHistorico(serieCompleta, historicoMensal)
      const { projecaoMensalEstimada, projecaoAnualEstimada } = estimarProjecoes(serieCompleta)

      return {
        historicoMensal,
        resumoAnual,
        projecaoMensalEstimada,
        projecaoAnualEstimada,
        baseHistoricaAnalisada: {
          primeiroMes: historicoMensal[0]?.referencia ?? null,
          ultimoMes: historicoMensal[historicoMensal.length - 1]?.referencia ?? null,
          totalLaudosConcluidos: historicoMensal.reduce((acc, item) => acc + item.totalConcluidos, 0),
        },
        indicadorConfiabilidade,
      }
    } catch (error) {
      log.error('Erro ao consolidar projeções do dashboard', error)
      throw error
    }
  }
}

export const dashboardService = new DashboardService()
