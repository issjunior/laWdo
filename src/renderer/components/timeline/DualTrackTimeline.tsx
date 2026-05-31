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
    return origem === 'REP' ? <ScrollText size={14} /> : <FilePlus size={14} />;
  }
  if (tipo_acao === 'atualizacao') return <Edit size={14} />;
  if (tipo_acao === 'transicao_status') {
    if (acao.includes('Conclu')) return <CheckCircle size={14} />;
    if (acao.includes('Entregue')) return <Send size={14} />;
    if (acao.includes('Em andamento') || acao.includes('Em Andamento') || acao.includes('Reabert'))
      return <RotateCcw size={14} />;
    return <ArrowRightLeft size={14} />;
  }
  if (tipo_acao === 'exclusao') return <Trash2 size={14} />;
  return <Clock size={14} />;
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
    const date = new Date(ts + (ts.includes('T') ? '' : 'T00:00:00'));
    if (isNaN(date.getTime())) return ts;
    return date.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (allEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <Clock className="h-10 w-10 opacity-30" />
        <p className="text-sm">Nenhum evento registrado para esta REP</p>
      </div>
    );
  }

  const { rows, hasLaudoEvents } = processEvents(allEvents);

  return (
    <div className="dual-track-container">
      {/* Header labels */}
      <div className="grid grid-cols-[1fr_48px_1fr] gap-0 mb-3">
        <div className="flex justify-center">
          <Badge variant="outline" className="border-blue-300 text-blue-600 dark:border-blue-600 dark:text-blue-400 text-xs">
            REP
          </Badge>
        </div>
        <div />
        <div className="flex justify-center">
          <Badge variant="outline" className="border-purple-300 text-purple-600 dark:border-purple-600 dark:text-purple-400 text-xs">
            Laudo
          </Badge>
        </div>
      </div>

      {/* Timeline body */}
      <div className="relative">
        {/* Continuous vertical track lines */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="grid grid-cols-[1fr_48px_1fr] gap-0 h-full">
            <div className="relative">
              <div className="absolute right-[-0.5px] top-0 bottom-0 w-0.5 bg-blue-400 dark:bg-blue-600" />
            </div>
            <div />
            <div className="relative">
              {hasLaudoEvents ? (
                <div className="absolute left-[-0.5px] top-0 bottom-0 w-0.5 bg-purple-400 dark:bg-purple-600" />
              ) : (
                <div className="absolute left-[-0.5px] top-0 bottom-0 w-0.5 border-l-2 border-dashed border-purple-300/30 dark:border-purple-700/30" />
              )}
            </div>
          </div>
        </div>

        {/* Rows */}
        <div className="relative z-1">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-[1fr_48px_1fr] gap-0 min-h-[56px] animate-fade-in"
              style={{ animationDelay: `${rowIndex * 50}ms` }}
            >
              {/* REP column */}
              <div className="relative flex items-center justify-center pr-3">
                {row.repEvent ? (
                  <div className="relative w-full">
                    <div
                      className={`dual-track-dot absolute right-[-11px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-background ring-2 ring-background z-10 ${getDotColor('rep', row.repEvent)}`}
                    />
                    <Card className="p-2.5 mr-4 border-blue-200 dark:border-blue-800 shadow-sm">
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 flex-shrink-0 ${getIconColor('rep', row.repEvent)}`}>
                          {getEventIcon(row.repEvent)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            {(() => {
                              const sb = getStatusBadge(row.repEvent);
                              return sb ? <Badge className={`text-[9px] px-1 py-0 h-4 ${sb.className}`}>{sb.label}</Badge> : null;
                            })()}
                            <span className="text-[9px] text-muted-foreground">{formatTimestamp(row.repEvent.created_at)}</span>
                          </div>
                          <p className="text-xs font-medium">{row.repEvent.acao}</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                ) : (
                  <div className="h-2" />
                )}
              </div>

              {/* Gutter (connection arrows) */}
              <div className="relative flex items-center justify-center">
                {row.connection && (
                  <div className="flex flex-col items-center gap-0">
                    <div className="flex items-center gap-0.5">
                      <div className={`h-px w-3 ${row.connection.direction === 'rep→laudo' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                      {row.connection.direction === 'rep→laudo' ? (
                        <ArrowRight size={12} className="text-blue-500" />
                      ) : (
                        <ArrowLeft size={12} className="text-purple-500" />
                      )}
                      <div className={`h-px w-3 ${row.connection.direction === 'rep→laudo' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                    </div>
                    <span className="text-[8px] text-muted-foreground mt-0.5 whitespace-nowrap">
                      {row.connection.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Laudo column */}
              <div className="relative flex items-center justify-center pl-3">
                {row.laudoEvent ? (
                  <div className="relative w-full">
                    <div
                      className={`dual-track-dot absolute left-[-11px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-background ring-2 ring-background z-10 ${getDotColor('laudo', row.laudoEvent)}`}
                    />
                    <Card className="p-2.5 ml-4 border-purple-200 dark:border-purple-800 shadow-sm">
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 flex-shrink-0 ${getIconColor('laudo', row.laudoEvent)}`}>
                          {getEventIcon(row.laudoEvent)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            {(() => {
                              const sb = getStatusBadge(row.laudoEvent);
                              return sb ? <Badge className={`text-[9px] px-1 py-0 h-4 ${sb.className}`}>{sb.label}</Badge> : null;
                            })()}
                            <span className="text-[9px] text-muted-foreground">{formatTimestamp(row.laudoEvent.created_at)}</span>
                          </div>
                          <p className="text-xs font-medium">{row.laudoEvent.acao}</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                ) : (
                  <div className="h-2" />
                )}
              </div>
            </div>
          ))}

          {/* Ghost placeholder when no laudo events exist */}
          {!hasLaudoEvents && (
            <div className="grid grid-cols-[1fr_48px_1fr] gap-0 min-h-[80px] animate-fade-in">
              <div />
              <div />
              <div className="relative flex items-center justify-center pl-3">
                <div className="flex flex-col items-center justify-center py-4 text-muted-foreground gap-1">
                  <Clock className="h-5 w-5 opacity-15" />
                  <p className="text-[10px] opacity-30">Aguardando</p>
                  <p className="text-[10px] opacity-30">criação do laudo</p>
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
