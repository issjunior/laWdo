import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { siglasProjeteis } from '@shared/catalogos/siglas-projeteis';

export function SiglaProjetil({ sigla }: { sigla: string | null }) {
  if (!sigla) return <span className="text-xs text-muted-foreground">Formato não informado</span>;
  const nome = siglasProjeteis[sigla] ?? 'Nome completo não documentado nas fontes';
  return <TooltipProvider><Tooltip>
    <TooltipTrigger asChild><button type="button" className="rounded border px-2 py-0.5 text-xs font-medium" aria-label={`${sigla}: ${nome}`}>{sigla}</button></TooltipTrigger>
    <TooltipContent>{nome}</TooltipContent>
  </Tooltip></TooltipProvider>;
}
