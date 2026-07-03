import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarRange,
  ClipboardList,
  Clock3,
  FileText,
  FolderClock,
  FolderKanban,
  FolderSearch,
  Gauge,
  LineChart,
  PackageCheck,
  RefreshCcw,
  ScrollText,
  Siren,
  Sparkles,
} from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type {
  DashboardIndicadorConfiabilidade,
  DashboardKpiStatus,
  DashboardLaudoRecente,
  DashboardProjecoes,
  DashboardResumo,
  DashboardSerieAnual,
  DashboardSerieMensal,
  DashboardTempoMedioTipoExame,
} from '../../types/dashboard.js'

const AUTH_USER_KEY = 'lawdo_auth_user'

type RespostaDashboard<T> = {
  success: boolean
  data?: T
  error?: string
}

type RegistroDesconhecido = Record<string, unknown>

const classesAnimacao = [
  '[animation-delay:0ms]',
  '[animation-delay:60ms]',
  '[animation-delay:120ms]',
  '[animation-delay:180ms]',
  '[animation-delay:240ms]',
  '[animation-delay:300ms]',
] as const

const classesConfiabilidade: Record<DashboardIndicadorConfiabilidade['nivel'], string> = {
  alta: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700',
  moderada: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700',
  baixa: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700',
  insuficiente: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700',
}

const configStatus: Record<string, { titulo: string; destaque: string; icone: typeof FileText }> = {
  Pendente: {
    titulo: 'REPs pendentes',
    destaque: 'text-slate-700 dark:text-slate-200',
    icone: FolderSearch,
  },
  'Em Andamento': {
    titulo: 'REPs em andamento',
    destaque: 'text-amber-700 dark:text-amber-300',
    icone: FolderClock,
  },
  'Concluído': {
    titulo: 'Concluído',
    destaque: 'text-emerald-700 dark:text-emerald-300',
    icone: PackageCheck,
  },
  'Em andamento': {
    titulo: 'Laudos em andamento',
    destaque: 'text-amber-700 dark:text-amber-300',
    icone: FileText,
  },
  Entregue: {
    titulo: 'Laudos entregues',
    destaque: 'text-blue-700 dark:text-blue-300',
    icone: ScrollText,
  },
}

const atalhosDashboard = [
  {
    titulo: 'REPs',
    descricao: 'Cadastrar, revisar e retomar requisições.',
    rota: '/reps',
    icone: FolderKanban,
  },
  {
    titulo: 'Laudos',
    descricao: 'Abrir o fluxo geral de elaboração e revisão.',
    rota: '/laudos',
    icone: ScrollText,
  },
  {
    titulo: 'Logs',
    descricao: 'Consultar rastreabilidade e diagnóstico do sistema.',
    rota: '/logs',
    icone: ClipboardList,
  },
] as const

const formatadorDataCompleta = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const formatadorMesAno = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: 'numeric',
})

const isRecord = (valor: unknown): valor is RegistroDesconhecido =>
  typeof valor === 'object' && valor !== null

const obterNumero = (valor: unknown): number => {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return valor
  }

  if (typeof valor === 'string') {
    const numero = Number(valor)
    return Number.isFinite(numero) ? numero : 0
  }

  return 0
}

const obterFloat = (valor: unknown): number => {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return valor
  }

  if (typeof valor === 'string') {
    const numero = Number(valor)
    return Number.isFinite(numero) ? numero : 0
  }

  return 0
}

const obterTexto = (valor: unknown, fallback = ''): string =>
  typeof valor === 'string' ? valor : fallback

const extrairNomeUsuario = (): string => {
  try {
    const raw = sessionStorage.getItem(AUTH_USER_KEY)
    if (!raw) return ''

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return ''

    return typeof parsed.nome === 'string'
      ? parsed.nome
      : typeof parsed.name === 'string'
        ? parsed.name
        : ''
  } catch {
    return ''
  }
}

const formatarSaudacao = (nome: string, data = new Date()): string => {
  const hora = data.getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const nomeLimpo = nome.trim() || 'Perito'
  return `${saudacao} ${nomeLimpo} — ${formatadorDataCompleta.format(data)}`
}

const formatarDataRelativa = (valor: string): string => {
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) {
    return 'data indisponível'
  }

  const diferencaDias = Math.max(0, Math.floor((Date.now() - data.getTime()) / 86400000))
  if (diferencaDias === 0) return 'atualizado hoje'
  if (diferencaDias === 1) return 'atualizado há 1 dia'
  return `atualizado há ${diferencaDias} dias`
}

const formatarDuracaoDias = (dias: number): string => {
  if (!Number.isFinite(dias) || dias <= 0) return '0 dia'
  if (dias === 1) return '1 dia'
  const valor = Number.isInteger(dias) ? dias.toString() : dias.toFixed(1).replace('.', ',')
  return `${valor} dias`
}

const formatarMesAno = (referencia: string): string => {
  const [anoTexto, mesTexto] = referencia.split('-')
  const ano = Number(anoTexto)
  const mes = Number(mesTexto)

  if (!Number.isInteger(ano) || !Number.isInteger(mes)) {
    return referencia
  }

  return formatadorMesAno.format(new Date(Date.UTC(ano, mes - 1, 1)))
}

const formatarPeriodoMensal = (serie: DashboardSerieMensal | null): string => {
  if (!serie) return 'Sem estimativa'
  return formatadorMesAno.format(new Date(Date.UTC(serie.ano, serie.mes - 1, 1)))
}

const formatarPeriodoAnual = (serie: DashboardSerieAnual | null): string => {
  if (!serie) return 'Sem estimativa'
  return String(serie.ano)
}

const formatarCoberturaHistorica = (indicador: DashboardIndicadorConfiabilidade): string =>
  `${Math.round(indicador.coberturaHistorica * 100)}%`

const normalizarKpiStatus = (valor: unknown): DashboardKpiStatus | null => {
  if (!isRecord(valor)) return null

  return {
    status: obterTexto(valor.status, 'Sem status'),
    total: Math.max(0, Math.round(obterNumero(valor.total))),
  }
}

const normalizarTempoMedio = (valor: unknown): DashboardTempoMedioTipoExame | null => {
  if (!isRecord(valor)) return null

  return {
    tipoExameId: typeof valor.tipoExameId === 'string' ? valor.tipoExameId : null,
    tipoExameNome: obterTexto(valor.tipoExameNome, 'Tipo de exame não informado'),
    totalLaudos: Math.max(0, Math.round(obterNumero(valor.totalLaudos))),
    tempoMedioDias: Number(obterFloat(valor.tempoMedioDias).toFixed(1)),
  }
}

const normalizarLaudoRecente = (valor: unknown): DashboardLaudoRecente | null => {
  if (!isRecord(valor)) return null
  const id = obterTexto(valor.id)
  if (!id) return null

  return {
    id,
    rep_numero: obterTexto(valor.rep_numero, 'REP sem número'),
    tipo_exame_nome: obterTexto(valor.tipo_exame_nome, 'Tipo de exame não informado'),
    status: obterTexto(valor.status, 'Sem status'),
    updated_at: obterTexto(valor.updated_at),
  }
}

const normalizarSerieMensal = (valor: unknown): DashboardSerieMensal | null => {
  if (!isRecord(valor)) return null

  const referencia = obterTexto(valor.referencia)
  if (!referencia) return null

  return {
    referencia,
    ano: Math.max(0, Math.round(obterNumero(valor.ano))),
    mes: Math.max(0, Math.round(obterNumero(valor.mes))),
    totalConcluidos: Math.max(0, Math.round(obterNumero(valor.totalConcluidos))),
  }
}

const normalizarSerieAnual = (valor: unknown): DashboardSerieAnual | null => {
  if (!isRecord(valor)) return null

  return {
    ano: Math.max(0, Math.round(obterNumero(valor.ano))),
    totalConcluidos: Math.max(0, Math.round(obterNumero(valor.totalConcluidos))),
    mesesComDados: Math.max(0, Math.round(obterNumero(valor.mesesComDados))),
  }
}

const normalizarIndicador = (valor: unknown): DashboardIndicadorConfiabilidade => {
  if (!isRecord(valor)) {
    return {
      dadosInsuficientes: true,
      mesesHistoricos: 0,
      mesesComDados: 0,
      coberturaHistorica: 0,
      nivel: 'insuficiente',
      mensagem: 'Dados insuficientes para estimativa confiável.',
    }
  }

  const nivel = valor.nivel
  const nivelNormalizado = nivel === 'alta' || nivel === 'moderada' || nivel === 'baixa' || nivel === 'insuficiente'
    ? nivel
    : 'insuficiente'

  return {
    dadosInsuficientes: Boolean(valor.dadosInsuficientes),
    mesesHistoricos: Math.max(0, Math.round(obterNumero(valor.mesesHistoricos))),
    mesesComDados: Math.max(0, Math.round(obterNumero(valor.mesesComDados))),
    coberturaHistorica: Number(obterFloat(valor.coberturaHistorica).toFixed(2)),
    nivel: nivelNormalizado,
    mensagem: obterTexto(valor.mensagem, 'Dados insuficientes para estimativa confiável.'),
  }
}

const normalizarDashboardResumo = (valor: unknown): DashboardResumo => {
  const payload = isRecord(valor) ? valor : {}

  return {
    repsPorStatus: Array.isArray(payload.repsPorStatus)
      ? payload.repsPorStatus.map(normalizarKpiStatus).filter((item): item is DashboardKpiStatus => item !== null)
      : [],
    repsPrazoProximo: Math.max(0, Math.round(obterNumero(payload.repsPrazoProximo))),
    repsPrazoVencido: Math.max(0, Math.round(obterNumero(payload.repsPrazoVencido))),
    laudosPorStatus: Array.isArray(payload.laudosPorStatus)
      ? payload.laudosPorStatus.map(normalizarKpiStatus).filter((item): item is DashboardKpiStatus => item !== null)
      : [],
    tempoMedioPorTipoExame: Array.isArray(payload.tempoMedioPorTipoExame)
      ? payload.tempoMedioPorTipoExame
        .map(normalizarTempoMedio)
        .filter((item): item is DashboardTempoMedioTipoExame => item !== null)
      : [],
    laudosRecentes: Array.isArray(payload.laudosRecentes)
      ? payload.laudosRecentes
        .map(normalizarLaudoRecente)
        .filter((item): item is DashboardLaudoRecente => item !== null)
      : [],
  }
}

const normalizarDashboardProjecoes = (valor: unknown): DashboardProjecoes => {
  const payload = isRecord(valor) ? valor : {}
  const baseHistorica = isRecord(payload.baseHistoricaAnalisada) ? payload.baseHistoricaAnalisada : {}

  return {
    historicoMensal: Array.isArray(payload.historicoMensal)
      ? payload.historicoMensal
        .map(normalizarSerieMensal)
        .filter((item): item is DashboardSerieMensal => item !== null)
      : [],
    resumoAnual: Array.isArray(payload.resumoAnual)
      ? payload.resumoAnual
        .map(normalizarSerieAnual)
        .filter((item): item is DashboardSerieAnual => item !== null)
      : [],
    projecaoMensalEstimada: normalizarSerieMensal(payload.projecaoMensalEstimada),
    projecaoAnualEstimada: normalizarSerieAnual(payload.projecaoAnualEstimada),
    baseHistoricaAnalisada: {
      primeiroMes: typeof baseHistorica.primeiroMes === 'string' ? baseHistorica.primeiroMes : null,
      ultimoMes: typeof baseHistorica.ultimoMes === 'string' ? baseHistorica.ultimoMes : null,
      totalLaudosConcluidos: Math.max(0, Math.round(obterNumero(baseHistorica.totalLaudosConcluidos))),
    },
    indicadorConfiabilidade: normalizarIndicador(payload.indicadorConfiabilidade),
  }
}

const obterConfigStatus = (status: string) => {
  return configStatus[status] ?? {
    titulo: status,
    destaque: 'text-foreground',
    icone: FileText,
  }
}

const obterClasseBadgeStatus = (status: string): string => {
  if (status === 'Concluído') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700'
  }

  if (status === 'Entregue') {
    return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700'
  }

  return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700'
}

const dashboardVazio = (dados: DashboardResumo | null): boolean => Boolean(
  dados &&
  dados.repsPorStatus.every(item => item.total === 0) &&
  dados.laudosPorStatus.every(item => item.total === 0) &&
  dados.laudosRecentes.length === 0 &&
  dados.tempoMedioPorTipoExame.length === 0,
)

const fallbackBloco = (titulo: string) => (
  <Card className="border-red-300/80 bg-red-50/50 dark:border-red-700 dark:bg-red-950/20">
    <CardContent className="p-5">
      <p className="font-semibold text-red-900 dark:text-red-200">{titulo}</p>
      <p className="text-sm text-red-900/80 dark:text-red-200/80">
        Este bloco falhou ao renderizar, mas o restante da dashboard continua disponível.
      </p>
    </CardContent>
  </Card>
)

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/80 bg-card/90 p-6">
        <Skeleton className="h-5 w-72 bg-muted" />
        <Skeleton className="h-10 w-48 bg-muted" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl bg-muted" />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32 rounded-2xl bg-muted" />
        <Skeleton className="h-32 rounded-2xl bg-muted" />
      </div>

      <Skeleton className="h-80 rounded-3xl bg-muted" />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Skeleton className="h-64 rounded-3xl bg-muted" />
        <Skeleton className="h-64 rounded-3xl bg-muted" />
      </div>
    </div>
  )
}

function DashboardErro({
  mensagem,
  onTentarNovamente,
}: {
  mensagem: string
  onTentarNovamente: () => void
}) {
  return (
    <Card className="border-red-300/80 bg-red-50/60 dark:border-red-700 dark:bg-red-950/20">
      <CardContent className="flex flex-col items-start gap-4 p-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-red-300/80 bg-white/70 p-3 dark:border-red-700 dark:bg-red-950/30">
            <AlertTriangle className="h-5 w-5 text-red-700 dark:text-red-300" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-red-900 dark:text-red-200">Não foi possível carregar o dashboard</p>
            <p className="text-sm text-red-900/80 dark:text-red-200/80">{mensagem}</p>
          </div>
        </div>
        <Button variant="outline" onClick={onTentarNovamente}>
          <RefreshCcw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </CardContent>
    </Card>
  )
}

function DashboardVazio() {
  return (
    <Card className="border-border/80 bg-card/95">
      <CardContent className="p-8">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/80 bg-primary/10 text-primary">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Dashboard pronto para começar</h2>
            <p className="text-sm text-muted-foreground">
              Ainda não há dados suficientes no banco para exibir indicadores operacionais.
            </p>
          </div>
          <div className="grid gap-3 text-left md:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <FolderSearch className="h-4 w-4 text-primary" />
                REPs
              </div>
              <p className="text-sm text-muted-foreground">
                Cadastre as primeiras requisições para acompanhar status e prazos.
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <ScrollText className="h-4 w-4 text-primary" />
                Laudos
              </div>
              <p className="text-sm text-muted-foreground">
                Laudos concluídos passam a alimentar tempo médio de ciclo e projeções.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function KpiCards({ reps, laudos }: { reps: DashboardKpiStatus[]; laudos: DashboardKpiStatus[] }) {
  const itens = [...reps, ...laudos]

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
      {itens.map((item, index) => {
        const config = obterConfigStatus(item.status)
        const Icone = config.icone

        return (
          <Card
            key={`${item.status}-${index}`}
            className={`animate-fade-in border-border/80 bg-card/95 ${classesAnimacao[index] ?? ''}`}
          >
            <CardContent className="flex items-start justify-between p-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {config.titulo}
                </p>
                <p className={`text-3xl font-bold leading-none ${config.destaque}`}>
                  {item.total}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/50 p-3">
                <Icone className={`h-5 w-5 ${config.destaque}`} />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function AlertaPrazo({
  prazoProximo,
  prazoVencido,
}: {
  prazoProximo: number
  prazoVencido: number
}) {
  if (prazoProximo <= 0 && prazoVencido <= 0) {
    return null
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {prazoProximo > 0 && (
        <Card className="animate-fade-in border-amber-300/80 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/20">
          <CardContent className="flex items-start justify-between p-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-300">
                Prazo próximo
              </p>
              <p className="text-3xl font-bold text-amber-900 dark:text-amber-200">{prazoProximo}</p>
              <p className="text-sm text-amber-900/80 dark:text-amber-200/80">
                REPs ativas vencendo nos próximos 7 dias.
              </p>
            </div>
            <div className="rounded-xl border border-amber-300/80 bg-white/60 p-3 dark:border-amber-700 dark:bg-amber-950/30">
              <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            </div>
          </CardContent>
        </Card>
      )}

      {prazoVencido > 0 && (
        <Card className="animate-fade-in border-red-300/80 bg-red-50/70 dark:border-red-700 dark:bg-red-950/20">
          <CardContent className="flex items-start justify-between p-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-800 dark:text-red-300">
                Prazo vencido
              </p>
              <p className="text-3xl font-bold text-red-900 dark:text-red-200">{prazoVencido}</p>
              <p className="text-sm text-red-900/80 dark:text-red-200/80">
                REPs ativas já ultrapassaram o prazo previsto.
              </p>
            </div>
            <div className="rounded-xl border border-red-300/80 bg-white/60 p-3 dark:border-red-700 dark:bg-red-950/30">
              <Siren className="h-5 w-5 text-red-700 dark:text-red-300" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function LaudosRecentes({
  laudos,
  onAbrirLaudos,
}: {
  laudos: DashboardLaudoRecente[]
  onAbrirLaudos: () => void
}) {
  return (
    <Card className="animate-fade-in border-border/80 bg-card/95">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-lg">Laudos recentes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Últimos laudos atualizados para retomada rápida.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAbrirLaudos}>
          Abrir Laudos
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {laudos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
            Nenhum laudo recente encontrado.
          </div>
        ) : (
          laudos.map(laudo => (
            <button
              key={laudo.id}
              type="button"
              onClick={onAbrirLaudos}
              className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-background/60 p-4 text-left transition-colors hover:bg-accent/70"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">REP {laudo.rep_numero}</p>
                    <p className="text-sm text-muted-foreground">{laudo.tipo_exame_nome}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  <span>{formatarDataRelativa(laudo.updated_at)}</span>
                </div>
              </div>
              <Badge className={obterClasseBadgeStatus(laudo.status)}>
                {laudo.status}
              </Badge>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function TempoMedioCiclo({ itens }: { itens: DashboardTempoMedioTipoExame[] }) {
  return (
    <Card className="animate-fade-in border-border/80 bg-card/95">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gauge className="h-5 w-5 text-primary" />
          Tempo médio de ciclo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {itens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
            Ainda não há laudos concluídos suficientes para calcular o tempo médio de ciclo.
          </div>
        ) : (
          itens.map(item => (
            <div
              key={`${item.tipoExameId ?? item.tipoExameNome}`}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-4 py-3"
            >
              <div>
                <p className="font-medium text-foreground">{item.tipoExameNome}</p>
                <p className="text-xs text-muted-foreground">
                  {item.totalLaudos} laudo{item.totalLaudos === 1 ? '' : 's'} concluído{item.totalLaudos === 1 ? '' : 's'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-foreground">
                  {formatarDuracaoDias(item.tempoMedioDias)}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function AtalhosDashboard({ onAbrirRota }: { onAbrirRota: (rota: string) => void }) {
  return (
    <Card className="animate-fade-in border-border/80 bg-card/95">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Atalhos rápidos</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {atalhosDashboard.map(atalho => {
          const Icone = atalho.icone

          return (
            <Button
              key={atalho.titulo}
              variant="outline"
              className="h-auto justify-start gap-3 rounded-xl px-4 py-4 text-left"
              onClick={() => onAbrirRota(atalho.rota)}
            >
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Icone className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{atalho.titulo}</p>
                <p className="text-xs text-muted-foreground">{atalho.descricao}</p>
              </div>
            </Button>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ModalProjecoes({
  aberto,
  onAbertoChange,
  dados,
  carregando,
  erro,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  dados: DashboardProjecoes | null
  carregando: boolean
  erro: string | null
}) {
  const historicoMensal = dados?.historicoMensal ?? []
  const resumoAnual = dados?.resumoAnual ?? []
  const indicador = dados?.indicadorConfiabilidade

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="max-w-5xl border-border/80 bg-background p-0">
        <DialogHeader className="border-b border-border/80 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <LineChart className="h-5 w-5 text-primary" />
            Projeções
          </DialogTitle>
          <DialogDescription>
            Projeção estimada a partir de laudos concluídos no histórico do banco.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[80vh] space-y-6 overflow-y-auto px-6 py-6">
          {carregando && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-56 rounded-2xl bg-muted" />
              <Skeleton className="h-56 rounded-2xl bg-muted" />
              <Skeleton className="h-72 rounded-2xl bg-muted lg:col-span-2" />
            </div>
          )}

          {!carregando && erro && (
            <Card className="border-red-300/80 bg-red-50/60 dark:border-red-700 dark:bg-red-950/20">
              <CardContent className="flex items-start gap-3 p-6">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-red-700 dark:text-red-300" />
                <div>
                  <p className="font-semibold text-red-900 dark:text-red-200">Falha ao carregar projeções</p>
                  <p className="text-sm text-red-900/80 dark:text-red-200/80">{erro}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {!carregando && !erro && dados && (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-border/80 bg-card/95">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Projeção mensal</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className={indicador?.dadosInsuficientes ? 'opacity-65' : ''}>
                      <p className="text-sm text-muted-foreground">Projeção estimada</p>
                      <p className="text-3xl font-bold text-foreground">
                        {dados.projecaoMensalEstimada?.totalConcluidos ?? 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatarPeriodoMensal(dados.projecaoMensalEstimada)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                      <p className="text-sm font-medium text-foreground">Base histórica analisada</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {dados.baseHistoricaAnalisada.primeiroMes
                          ? `${formatarMesAno(dados.baseHistoricaAnalisada.primeiroMes)} até ${formatarMesAno(dados.baseHistoricaAnalisada.ultimoMes ?? dados.baseHistoricaAnalisada.primeiroMes)}`
                          : 'Sem base histórica disponível'}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {dados.baseHistoricaAnalisada.totalLaudosConcluidos} laudos concluídos observados
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-card/95">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Projeção anual</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className={indicador?.dadosInsuficientes ? 'opacity-65' : ''}>
                      <p className="text-sm text-muted-foreground">Projeção estimada</p>
                      <p className="text-3xl font-bold text-foreground">
                        {dados.projecaoAnualEstimada?.totalConcluidos ?? 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatarPeriodoAnual(dados.projecaoAnualEstimada)}
                      </p>
                    </div>
                    {indicador && (
                      <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={classesConfiabilidade[indicador.nivel]}>
                            {indicador.dadosInsuficientes ? 'Base insuficiente' : 'Base suficiente'}
                          </Badge>
                          <Badge variant="outline">
                            Cobertura {formatarCoberturaHistorica(indicador)}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">{indicador.mensagem}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/80 bg-card/95">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarRange className="h-4 w-4 text-primary" />
                    Histórico mensal observado
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 lg:grid-cols-2">
                  {historicoMensal.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground lg:col-span-2">
                      Nenhum laudo concluído encontrado no histórico.
                    </div>
                  ) : (
                    historicoMensal.map(item => (
                      <div
                        key={item.referencia}
                        className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-4 py-3"
                      >
                        <span className="text-sm font-medium text-foreground">{formatarMesAno(item.referencia)}</span>
                        <span className="text-sm text-muted-foreground">{item.totalConcluidos} concluído(s)</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-card/95">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Consolidado anual observado</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {resumoAnual.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground md:col-span-2">
                      Nenhum consolidado anual disponível.
                    </div>
                  ) : (
                    resumoAnual.map(item => (
                      <div
                        key={item.ano}
                        className="rounded-xl border border-border/70 bg-background/60 px-4 py-3"
                      >
                        <p className="font-semibold text-foreground">{item.ano}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.totalConcluidos} concluído(s) em {item.mesesComDados} mês(es) com dados
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [dadosResumo, setDadosResumo] = useState<DashboardResumo | null>(null)
  const [carregandoResumo, setCarregandoResumo] = useState(true)
  const [erroResumo, setErroResumo] = useState<string | null>(null)
  const [modalProjecoesAberto, setModalProjecoesAberto] = useState(false)
  const [projecoesHabilitadas, setProjecoesHabilitadas] = useState(false)
  const [dadosProjecoes, setDadosProjecoes] = useState<DashboardProjecoes | null>(null)
  const [carregandoProjecoes, setCarregandoProjecoes] = useState(false)
  const [erroProjecoes, setErroProjecoes] = useState<string | null>(null)

  const carregarResumo = useCallback(async () => {
    setCarregandoResumo(true)
    setErroResumo(null)

    try {
      const resposta = await window.ipcAPI.dashboard.resumo() as RespostaDashboard<DashboardResumo>
      if (!resposta.success) {
        throw new Error(resposta.error || 'Não foi possível carregar o dashboard')
      }

      setDadosResumo(normalizarDashboardResumo(resposta.data))
    } catch (error) {
      setErroResumo(error instanceof Error ? error.message : 'Erro inesperado ao carregar o dashboard')
    } finally {
      setCarregandoResumo(false)
    }
  }, [])

  useEffect(() => {
    void carregarResumo()
  }, [carregarResumo, pathname])

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        void carregarResumo()
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void carregarResumo()
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [carregarResumo])

  useEffect(() => {
    if (!projecoesHabilitadas || dadosProjecoes) {
      return
    }

    let ativo = true

    const carregarProjecoes = async () => {
      setCarregandoProjecoes(true)
      setErroProjecoes(null)

      try {
        const resposta = await window.ipcAPI.dashboard.projecoes() as RespostaDashboard<DashboardProjecoes>
        if (!resposta.success) {
          throw new Error(resposta.error || 'Não foi possível carregar as projeções')
        }

        if (ativo) {
          setDadosProjecoes(normalizarDashboardProjecoes(resposta.data))
        }
      } catch (error) {
        if (ativo) {
          setErroProjecoes(error instanceof Error ? error.message : 'Erro inesperado ao carregar projeções')
        }
      } finally {
        if (ativo) {
          setCarregandoProjecoes(false)
        }
      }
    }

    void carregarProjecoes()

    return () => {
      ativo = false
    }
  }, [dadosProjecoes, projecoesHabilitadas])

  const abrirModalProjecoes = () => {
    setProjecoesHabilitadas(true)
    setModalProjecoesAberto(true)
  }

  const vazio = dashboardVazio(dadosResumo)

  return (
    <>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-border/80 bg-card/95 p-6 shadow-sm animate-fade-in">
          <div className="absolute inset-y-0 right-0 w-48 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.16),_transparent_72%)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                Painel operacional
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  {formatarSaudacao(extrairNomeUsuario())}
                </h1>
                <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
                  Visão rápida do que está pendente, em andamento e do que exige retomada imediata.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => void carregarResumo()} aria-label="Atualizar dashboard">
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button onClick={abrirModalProjecoes}>
                <Sparkles className="h-4 w-4" />
                Projeções
              </Button>
            </div>
          </div>
        </section>

        {carregandoResumo && !dadosResumo && <DashboardSkeleton />}

        {!carregandoResumo && erroResumo && !dadosResumo && (
          <DashboardErro mensagem={erroResumo} onTentarNovamente={() => void carregarResumo()} />
        )}

        {!carregandoResumo && !erroResumo && dadosResumo && vazio && <DashboardVazio />}

        {!carregandoResumo && dadosResumo && !vazio && (
          <div className="space-y-6">
            <ErrorBoundary fallback={fallbackBloco('Falha ao renderizar os indicadores principais.')}>
              <KpiCards reps={dadosResumo.repsPorStatus} laudos={dadosResumo.laudosPorStatus} />
            </ErrorBoundary>

            <ErrorBoundary fallback={fallbackBloco('Falha ao renderizar os alertas de prazo.')}>
              <AlertaPrazo
                prazoProximo={dadosResumo.repsPrazoProximo}
                prazoVencido={dadosResumo.repsPrazoVencido}
              />
            </ErrorBoundary>

            <ErrorBoundary fallback={fallbackBloco('Falha ao renderizar os laudos recentes.')}>
              <LaudosRecentes laudos={dadosResumo.laudosRecentes} onAbrirLaudos={() => navigate('/laudos')} />
            </ErrorBoundary>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <ErrorBoundary fallback={fallbackBloco('Falha ao renderizar o tempo médio de ciclo.')}>
                <TempoMedioCiclo itens={dadosResumo.tempoMedioPorTipoExame} />
              </ErrorBoundary>
              <ErrorBoundary fallback={fallbackBloco('Falha ao renderizar os atalhos rápidos.')}>
                <AtalhosDashboard onAbrirRota={navigate} />
              </ErrorBoundary>
            </div>
          </div>
        )}
      </div>

      <ModalProjecoes
        aberto={modalProjecoesAberto}
        onAbertoChange={setModalProjecoesAberto}
        dados={dadosProjecoes}
        carregando={carregandoProjecoes}
        erro={erroProjecoes}
      />
    </>
  )
}

export default DashboardPage
