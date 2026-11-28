import { Badge } from '@/components/ui/badge';
import type { StatusMinhaRepGdl } from '@shared/types/gdl-minhas-reps.types';

export const classesStatusRepGdl: Record<StatusMinhaRepGdl, string> = {
  'Aberta e Distribuída': 'border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-300',
  'Laudo em Execução': 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  'Concluída e Não Remetida': 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
};

export function GdlStatusBadge({ status }: { status: StatusMinhaRepGdl }) {
  return <Badge variant="outline" className={`font-normal ${classesStatusRepGdl[status]}`}>{status}</Badge>;
}
