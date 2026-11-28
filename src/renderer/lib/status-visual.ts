// Toda interface local que apresente status de REP ou Laudo deve reutilizar este módulo.
type CorStatusLocal = 'pendente' | 'em_andamento' | 'concluido' | 'entregue';

const coresBadge: Record<CorStatusLocal, string> = {
  pendente: 'border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-300',
  em_andamento: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  concluido: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  entregue: 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
};

const coresIndicador: Record<CorStatusLocal, string> = {
  pendente: 'bg-red-500',
  em_andamento: 'bg-amber-500',
  concluido: 'bg-emerald-500',
  entregue: 'bg-blue-500',
};

const coresTexto: Record<CorStatusLocal, string> = {
  pendente: 'text-red-600 dark:text-red-400',
  em_andamento: 'text-amber-600 dark:text-amber-400',
  concluido: 'text-emerald-600 dark:text-emerald-400',
  entregue: 'text-blue-600 dark:text-blue-400',
};

const coresAba: Record<CorStatusLocal, string> = {
  pendente: 'bg-red-500 text-white border-red-500 data-[state=active]:bg-red-500 data-[state=active]:text-white data-[state=active]:border-red-500',
  em_andamento: 'bg-amber-500 text-white border-amber-500 data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:border-amber-500',
  concluido: 'bg-emerald-500 text-white border-emerald-500 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:border-emerald-500',
  entregue: 'bg-blue-500 text-white border-blue-500 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:border-blue-500',
};

function obterCorStatusLocal(status: string): CorStatusLocal | null {
  const statusNormalizado = status.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

  if (statusNormalizado === 'pendente') return 'pendente';
  if (statusNormalizado === 'em andamento') return 'em_andamento';
  if (statusNormalizado === 'concluido') return 'concluido';
  if (statusNormalizado === 'entregue') return 'entregue';
  return null;
}

export function obterClasseBadgeStatusLocal(status: string): string {
  const cor = obterCorStatusLocal(status);
  return cor ? coresBadge[cor] : 'border-border bg-muted text-muted-foreground';
}

export function obterClasseIndicadorStatusLocal(status: string): string {
  const cor = obterCorStatusLocal(status);
  return cor ? coresIndicador[cor] : 'bg-muted-foreground/40';
}

export function obterClasseTextoStatusLocal(status: string): string {
  const cor = obterCorStatusLocal(status);
  return cor ? coresTexto[cor] : 'text-muted-foreground';
}

export function obterClasseAbaStatusLocal(status: string): string {
  const cor = obterCorStatusLocal(status);
  if (!cor) return 'bg-primary text-primary-foreground border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary';

  return coresAba[cor];
}
