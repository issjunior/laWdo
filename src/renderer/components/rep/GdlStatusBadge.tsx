import { Badge } from '@/components/ui/badge';
import type { StatusMinhaRepGdl } from '@shared/types/gdl-minhas-reps.types';

export const classesStatusRepGdl: Record<StatusMinhaRepGdl, string> = {
  'Aberta e Distribuída': 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  'Laudo em Execução': 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  'Concluída e Não Remetida': 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
};

export function GdlStatusBadge({ status }: { status: StatusMinhaRepGdl }) {
  return <Badge variant="outline" className={`font-normal ${classesStatusRepGdl[status]}`}>{status}</Badge>;
}
