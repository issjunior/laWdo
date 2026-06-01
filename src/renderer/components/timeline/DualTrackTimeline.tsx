import { useState, useEffect } from 'react';
import {
  ScrollText,
  FilePlus,
  Edit,
  ArrowRightLeft,
  Trash2,
  CheckCircle,
  Send,
  RotateCcw,
  Clock,
  Loader2,
  ArrowRight,
  ArrowLeft,
  History,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TimelineEvent {
  id: number;
  created_at: string;
  tipo_acao: string;
  modulo: string;
  entidade: string;
  acao: string;
  mensagem?: string;
  dados_anteriores?: string;
  dados_novos?: string;
  nivel: string;
  origem: string;
}

interface ConnectionLine {
  direction: 'rep→laudo' | 'laudo→rep';
  label: string;
}

interface TimelineRow {
  repEvent?: TimelineEvent;
  laudoEvent?: TimelineEvent;
  connection?: ConnectionLine;
}

interface DualTrackTimelineProps {
  repId: string;
  repNumero?: string;
}

const laudoStatusStyles: Record<string, string> = {
  'Em andamento': 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700',
  'Concluído': 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700',
  'Entregue': 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700',
};

const repStatusStyles: Record<string, string> = {
  'Pendente': 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
  'Em Andamento': 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700',
  'Concluído': 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700',
};

function getEventIcon(event: TimelineEvent): React.ReactNode {
  const { tipo_acao, acao, origem } = event;
  if (tipo_acao === 'criacao') {
    return origem === 'REP' ? <ScrollText size={13} /> : <FilePlus size={13} />;
  }
  if (tipo_acao === 'atualizacao') return <Edit size={13} />;
  if (tipo_acao === 'transicao_status') {
    if (acao.includes('Conclu')) return <CheckCircle size={13} />;
    if (acao.includes('Entregue')) return <Send size={13} />;
    if (acao.includes('Em andamento') || acao.includes('Em Andamento') || acao.includes('Reabert'))
      return <RotateCcw size={13} />;
    return <ArrowRightLeft size={13} />;
  }
  if (tipo_acao === 'exclusao') return <Trash2 size={13} />;
  return <Clock size={13} />;
}

function getDotColor(track: 'rep' | 'laudo', event: TimelineEvent): string {
  const { tipo_acao, acao } = event;
  if (tipo_acao === 'criacao') return 'bg-emerald-500';
  if (tipo_acao === 'exclusao') return 'bg-red-500';
  if (tipo_acao === 'transicao_status') {
    if (acao.includes('Conclu')) return 'bg-emerald-500';
    if (acao.includes('Entregue')) return 'bg-blue-500';
    return 'bg-amber-500';
  }
  return track === 'rep' ? 'bg-blue-500' : 'bg-purple-500';
}

function getIconColor(track: 'rep' | 'laudo', event: TimelineEvent): string {
  const { tipo_acao, acao } = event;
  if (tipo_acao === 'criacao') return 'text-emerald-600 dark:text-emerald-400';
  if (tipo_acao === 'exclusao') return 'text-red-600 dark:text-red-400';
  if (tipo_acao === 'transicao_status') {
    if (acao.includes('Conclu')) return 'text-emerald-600 dark:text-emerald-400';
    if (acao.includes('Entregue')) return 'text-blue-600 dark:text-blue-400';
    return 'text-amber-600 dark:text-amber-400';
  }
  return track === 'rep' ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400';
}

function extractStatusFromEvent(event: TimelineEvent): string | null {
  try {
    if (event.dados_novos) {
      const dados = JSON.parse(event.dados_novos);
      if (dados.status) return dados.status;
    }
    if (event.dados_anteriores) {
      const dados = JSON.parse(event.dados_anteriores);
      if (dados.status) return dados.status;
    }
  } catch { /* ignore */ }
  return null;
}

function formatTimestamp(ts: string): string {
  try {
    // Normaliza separador de espaço para T e garante parte de hora
    const normalized = ts.trim().replace(' ', 'T');
    const iso = normalized.includes('T') ? normalized : `${normalized}T00:00:00`;
    const date = new Date(iso);
    if (isNaN(date.getTime())) return ts;
    const pad = (n: number) => String(n).padStart(2, '0');
    const dia  = pad(date.getDate());
    const mes  = pad(date.getMonth() + 1);
    const ano  = date.getFullYear();
    const hora = pad(date.getHours());
    const min  = pad(date.getMinutes());
    // Só exibe hora se não for meia-noite (data-only sem hora real)
    const temHora = normalized.includes('T') && !normalized.endsWith('T00:00:00');
    return temHora ? `${dia}/${mes}/${ano} ${hora}:${min}` : `${dia}/${mes}/${ano}`;
  } catch { return ts; }
}


function getStatusBadge(event: TimelineEvent): { label: string; className: string } | null {
  const status = extractStatusFromEvent(event);
  if (!status) return null;
  if (event.origem === 'Laudo') {
    const style = laudoStatusStyles[status];
    if (style) return { label: status, className: style };
  }
  if (event.origem === 'REP') {
    const style = repStatusStyles[status];
    if (style) return { label: status, className: style };
  }
  return null;
}

function detectConnectionDirection(
  repEvent: TimelineEvent,
  laudoEvent: TimelineEvent,
): ConnectionLine | null {
  const ra = repEvent.tipo_acao;
  const la = laudoEvent.tipo_acao;
  const rAc = repEvent.acao;
  const lAc = laudoEvent.acao;

  if (la === 'criacao' && ra === 'transicao_status' && rAc.includes('Em Andamento')) {
    return { direction: 'rep→laudo', label: 'Iniciou laudo' };
  }
  if (la === 'transicao_status' && lAc.includes('Conclu') && ra === 'transicao_status' && rAc.includes('Conclu')) {
    return { direction: 'laudo→rep', label: 'Concluiu REP' };
  }
  if (la === 'transicao_status' && (lAc.includes('Em andamento') || lAc.includes('Reabert')) && ra === 'transicao_status') {
    return { direction: 'laudo→rep', label: 'Reabriu REP' };
  }
  if (la === 'exclusao' && ra === 'transicao_status' && rAc.includes('Pendente')) {
    return { direction: 'laudo→rep', label: 'Removeu laudo' };
  }
  if (la === 'transicao_status' && lAc.includes('Entregue')) {
    return { direction: 'laudo→rep', label: 'Entregue' };
  }
  return null;
}

function processEvents(allEvents: TimelineEvent[]): {
  rows: TimelineRow[];
  hasLaudoEvents: boolean;
} {
  const taggedEvents = allEvents.map(e => ({
    ...e,
    ts: new Date(e.created_at).getTime(),
  })).sort((a, b) => a.ts - b.ts);

  const laudoEvents = taggedEvents.filter(e => e.origem === 'Laudo');
  const rows: TimelineRow[] = [];
  let i = 0;

  while (i < taggedEvents.length) {
    const curr = taggedEvents[i];
    const next = taggedEvents[i + 1];

    if (
      next &&
      curr.origem !== next.origem &&
      Math.abs(curr.ts - next.ts) <= 2000
    ) {
      const connection = curr.origem === 'REP'
        ? detectConnectionDirection(curr, next)
        : detectConnectionDirection(next, curr);

      rows.push({
        repEvent: curr.origem === 'REP' ? curr : next,
        laudoEvent: curr.origem === 'Laudo' ? curr : next,
        connection: connection ?? undefined,
      });
      i += 2;
    } else {
      rows.push({
        repEvent: curr.origem === 'REP' ? curr : undefined,
        laudoEvent: curr.origem === 'Laudo' ? curr : undefined,
      });
      i += 1;
    }
  }

  return { rows, hasLaudoEvents: laudoEvents.length > 0 };
}

/* ─── Skeleton Loader ─────────────────────────────────────────────────────── */
function TimelineSkeleton() {
  return (
    <div className="dual-track-container space-y-0">
      {/* Header skeleton */}
      <div className="grid grid-cols-[1fr_60px_1fr] gap-0 mb-4">
        <div className="flex justify-center">
          <div className="dual-track-skeleton h-6 w-16 rounded-full" />
        </div>
        <div />
        <div className="flex justify-center">
          <div className="dual-track-skeleton h-6 w-16 rounded-full" />
        </div>
      </div>
      {/* Row skeletons */}
      {[0, 1, 2].map(i => (
        <div key={i} className="grid grid-cols-[1fr_60px_1fr] gap-0 min-h-[72px]">
          <div className="flex items-center justify-center pr-4">
            {i % 2 === 0 && (
              <div className="dual-track-skeleton h-14 w-full rounded-xl" />
            )}
          </div>
          <div className="flex items-center justify-center">
            <div className="dual-track-skeleton h-3 w-3 rounded-full" />
          </div>
          <div className="flex items-center justify-center pl-4">
            {i % 2 === 1 && (
              <div className="dual-track-skeleton h-14 w-full rounded-xl" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Empty State ─────────────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
      {/* Inline SVG illustration */}
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        fill="none"
        className="opacity-30"
        aria-hidden="true"
      >
        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" className="text-muted-foreground" />
        <circle cx="32" cy="22" r="4" fill="currentColor" className="text-blue-400" opacity="0.6" />
        <circle cx="32" cy="42" r="4" fill="currentColor" className="text-purple-400" opacity="0.6" />
        <line x1="32" y1="26" x2="32" y2="38" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" className="text-muted-foreground" opacity="0.5" />
      </svg>
      <p className="text-sm font-medium text-muted-foreground">Nenhum evento registrado</p>
      <p className="text-xs text-muted-foreground opacity-60 max-w-[200px]">
        Os eventos aparecerão aqui conforme a REP e o Laudo evoluírem.
      </p>
    </div>
  );
}

/* ─── Event Card ──────────────────────────────────────────────────────────── */
function EventCard({
  event,
  track,
}: {
  event: TimelineEvent;
  track: 'rep' | 'laudo';
}) {
  const sb = getStatusBadge(event);
  const cardClass = track === 'rep'
    ? 'dual-track-card dual-track-card-rep'
    : 'dual-track-card dual-track-card-laudo';
  const borderClass = track === 'rep'
    ? 'border-blue-200 dark:border-blue-800/70'
    : 'border-purple-200 dark:border-purple-800/70';

  return (
    <Card className={`p-3 shadow-sm ${cardClass} ${borderClass}`}>
      <div className="flex items-start gap-2.5">
        {/* Icon bubble */}
        <div className={`
          mt-0.5 flex-shrink-0 p-1 rounded-md
          ${track === 'rep'
            ? 'bg-blue-50 dark:bg-blue-950/40'
            : 'bg-purple-50 dark:bg-purple-950/40'
          }
          ${getIconColor(track, event)}
        `}>
          {getEventIcon(event)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Action label */}
          <p className="text-xs font-semibold leading-tight text-foreground mb-1 line-clamp-2">
            {event.acao}
          </p>

          {/* Status badge + timestamp */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {sb && (
              <Badge className={`text-[9px] px-1.5 py-0 h-4 border font-medium ${sb.className}`}>
                {sb.label}
              </Badge>
            )}
            <span className="dual-track-timestamp">
              {formatTimestamp(event.created_at)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ─── Connection Gutter ───────────────────────────────────────────────────── */
function ConnectionGutter({ connection }: { connection: ConnectionLine }) {
  const isRepToLaudo = connection.direction === 'rep→laudo';
  const lineColor = isRepToLaudo ? 'bg-blue-400 dark:bg-blue-500' : 'bg-purple-400 dark:bg-purple-500';
  const badgeClass = isRepToLaudo
    ? 'dual-track-conn-badge dual-track-conn-rep-laudo'
    : 'dual-track-conn-badge dual-track-conn-laudo-rep';

  return (
    <div className="flex flex-col items-center gap-0.5 w-full">
      {/* Arrow line */}
      <div className="flex items-center gap-0 w-full justify-center">
        {!isRepToLaudo && (
          <ArrowLeft size={11} className={isRepToLaudo ? 'text-blue-500' : 'text-purple-500'} />
        )}
        <div className={`h-px flex-1 max-w-[20px] ${lineColor}`} />
        {isRepToLaudo && (
          <ArrowRight size={11} className="text-blue-500" />
        )}
      </div>
      {/* Label badge */}
      <span className={badgeClass}>
        {connection.label}
      </span>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */
export function DualTrackTimeline({ repId }: DualTrackTimelineProps) {
  const [allEvents, setAllEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const r = await window.ipcAPI.log.timelineRep(repId);
        if (cancelled) return;
        if (r.success && Array.isArray(r.data)) {
          setAllEvents(r.data as TimelineEvent[]);
        } else {
          setError(r.error || 'Erro ao carregar linha do tempo');
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [repId]);

  if (loading) return <TimelineSkeleton />;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (allEvents.length === 0) return <EmptyState />;

  const { rows, hasLaudoEvents } = processEvents(allEvents);

  return (
    <div className="dual-track-container">

      {/* ── Track header labels ── */}
      <div className="grid grid-cols-[1fr_60px_1fr] gap-0 mb-4">
        <div className="flex justify-center">
          <span className="dual-track-header-rep">
            <ScrollText size={10} />
            REP
          </span>
        </div>
        <div />
        <div className="flex justify-center">
          <span className="dual-track-header-laudo">
            <History size={10} />
            Laudo
          </span>
        </div>
      </div>

      {/* ── Timeline body ── */}
      <div className="relative">

        {/* Continuous vertical track lines (background layer) */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="grid grid-cols-[1fr_60px_1fr] gap-0 h-full">
            {/* REP track line */}
            <div className="relative">
              <div className="dual-track-line-rep absolute right-[-1.5px] top-0 bottom-0 w-[3px]" />
            </div>
            <div />
            {/* Laudo track line */}
            <div className="relative">
              {hasLaudoEvents ? (
                <div className="dual-track-line-laudo absolute left-[-1.5px] top-0 bottom-0 w-[3px]" />
              ) : (
                <div className="absolute left-[-1.5px] top-0 bottom-0 w-[3px] border-l-2 border-dashed border-purple-300/30 dark:border-purple-700/20" />
              )}
            </div>
          </div>
        </div>

        {/* ── Rows ── */}
        <div className="relative" style={{ zIndex: 1 }}>
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-[1fr_60px_1fr] gap-0 min-h-[68px] timeline-row-animate"
              style={{ animationDelay: `${rowIndex * 55}ms` }}
            >
              {/* REP column */}
              <div className="relative flex items-center justify-center pr-4">
                {row.repEvent ? (
                  <div className="relative w-full">
                    {/* Dot */}
                    <div
                      className={`
                        dual-track-dot dual-track-dot-rep
                        absolute right-[-13px] top-1/2 -translate-y-1/2
                        w-4 h-4 rounded-full
                        border-2 border-background
                        z-10
                        ${getDotColor('rep', row.repEvent)}
                      `}
                    />
                    {/* Card */}
                    <EventCard event={row.repEvent} track="rep" />
                  </div>
                ) : (
                  <div className="h-3" />
                )}
              </div>

              {/* Gutter */}
              <div className="relative flex items-center justify-center px-1">
                {row.connection && <ConnectionGutter connection={row.connection} />}
              </div>

              {/* Laudo column */}
              <div className="relative flex items-center justify-center pl-4">
                {row.laudoEvent ? (
                  <div className="relative w-full">
                    {/* Dot */}
                    <div
                      className={`
                        dual-track-dot dual-track-dot-laudo
                        absolute left-[-13px] top-1/2 -translate-y-1/2
                        w-4 h-4 rounded-full
                        border-2 border-background
                        z-10
                        ${getDotColor('laudo', row.laudoEvent)}
                      `}
                    />
                    {/* Card */}
                    <EventCard event={row.laudoEvent} track="laudo" />
                  </div>
                ) : (
                  <div className="h-3" />
                )}
              </div>
            </div>
          ))}

          {/* Ghost placeholder when no laudo events exist */}
          {!hasLaudoEvents && (
            <div
              className="grid grid-cols-[1fr_60px_1fr] gap-0 min-h-[88px] timeline-row-animate"
              style={{ animationDelay: `${rows.length * 55}ms` }}
            >
              <div />
              <div />
              <div className="flex items-center justify-center pl-4 pr-2">
                <div className="dual-track-ghost w-full flex flex-col items-center justify-center py-5 gap-1.5">
                  <Clock className="h-5 w-5 text-purple-400/40 dark:text-purple-500/30" />
                  <p className="text-[10px] font-medium text-muted-foreground opacity-50 text-center leading-tight">
                    Aguardando<br />criação do laudo
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DualTrackTimeline;
