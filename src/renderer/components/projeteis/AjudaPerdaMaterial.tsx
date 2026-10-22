import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const explicacao = 'Marque se parte do projétil foi perdida. A massa será usada como limite inferior e não contará na proximidade.';

export function AjudaPerdaMaterial() {
  return <>
    <span id="descricao-perda-material" className="sr-only">{explicacao}</span>
    <TooltipProvider delayDuration={200}><Tooltip>
      <TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Sobre perda de material"><CircleHelp className="h-4 w-4" aria-hidden="true" /></Button></TooltipTrigger>
      <TooltipContent className="max-w-xs">{explicacao}</TooltipContent>
    </Tooltip></TooltipProvider>
  </>;
}
