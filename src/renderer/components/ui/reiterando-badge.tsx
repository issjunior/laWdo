import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRepReiterando } from '@/contexts/AvisosReiteracaoContext';

export function ReiterandoBadge({ numeroRep, reiterando, centralizado = false, juntoNumero = false }: { numeroRep: string; reiterando?: boolean; centralizado?: boolean; juntoNumero?: boolean }) {
  const salvo = useRepReiterando(numeroRep);
  if (!(reiterando ?? salvo)) return null;
  const badge = <Tooltip>
    <TooltipTrigger asChild>
      <Badge variant="outline" className={`${centralizado || juntoNumero ? '' : 'ml-2 '}shrink-0 border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300`}>REITERANDO</Badge>
    </TooltipTrigger>
    <TooltipContent>Ofício reiterando identificado no GDL</TooltipContent>
  </Tooltip>;
  return centralizado ? <span className="mt-1 flex w-full justify-center">{badge}</span> : badge;
}
