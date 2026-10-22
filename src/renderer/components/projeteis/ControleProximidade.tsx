import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LIMITE_PROXIMIDADE_PERCENTUAL } from '@shared/utils/proximidade-medida';
import { ChevronDown, CircleHelp } from 'lucide-react';

const explicacaoProximidade = 'Define quanto a medida pode diferir da referência para contar como próxima e ficar verde. Quanto maior o percentual, mais ampla a comparação. Mais medidas próximas favorecem a posição na lista.';

export function ControleProximidade({ limite, texto, aoAlterarTexto, aoAlterarLimite }: {
  limite: number; texto: string; aoAlterarTexto: (texto: string) => void; aoAlterarLimite: (limite: number) => void;
}) {
  const normalizado = texto.trim();
  const valor = Number(normalizado.replace(',', '.'));
  const valido = /^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/.test(normalizado) && Number.isFinite(valor) && valor >= 0 && valor <= 100;
  function alterar(valor: number) {
    aoAlterarTexto(valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    aoAlterarLimite(valor);
  }
  const percentual = limite.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <div className="min-w-0 space-y-1.5">
    <div className="flex h-5 items-center gap-1">
      <Label htmlFor="controle-proximidade">Proximidade</Label>
      <span id="ajuda-proximidade" className="sr-only">{explicacaoProximidade}</span>
      <TooltipProvider delayDuration={200}><Tooltip>
        <TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-5 w-5" aria-label="Sobre proximidade"><CircleHelp className="h-4 w-4" aria-hidden="true" /></Button></TooltipTrigger>
        <TooltipContent className="max-w-xs">{explicacaoProximidade}</TooltipContent>
      </Tooltip></TooltipProvider>
    </div>
    <Popover>
    <PopoverTrigger asChild><Button id="controle-proximidade" variant="outline" className="h-10 w-full justify-between font-normal" aria-label={`Proximidade: ${percentual}%`} aria-describedby="ajuda-proximidade"><span>{percentual}%</span><ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" /></Button></PopoverTrigger>
    <PopoverContent align="start" className="space-y-4">
      <div className="space-y-1"><Label htmlFor="limite-proximidade">Limite de proximidade (%)</Label><p id="descricao-proximidade" className="text-xs text-muted-foreground">Usado na ordem dos resultados e no destaque verde.</p></div>
      <Slider aria-label="Ajustar limite de proximidade" min={0} max={100} step={0.01} value={[limite]} onValueChange={valores => { if (valores[0] !== undefined) alterar(valores[0]); }} />
      <Input id="limite-proximidade" inputMode="decimal" value={texto} aria-invalid={!valido} aria-describedby={`descricao-proximidade${valido ? '' : ' erro-proximidade'}`} onChange={evento => {
        const novoTexto = evento.target.value;
        aoAlterarTexto(novoTexto);
        const novoValor = Number(novoTexto.trim().replace(',', '.'));
        if (/^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/.test(novoTexto.trim()) && Number.isFinite(novoValor) && novoValor >= 0 && novoValor <= 100) aoAlterarLimite(novoValor);
      }} />
      {!valido && <p id="erro-proximidade" role="alert" className="text-xs text-destructive">Informe de 0 a 100%, com até duas casas decimais. O último limite válido continua aplicado.</p>}
      <Button variant="ghost" size="sm" onClick={() => alterar(LIMITE_PROXIMIDADE_PERCENTUAL)}>Restaurar 5%</Button>
    </PopoverContent>
    </Popover>
  </div>;
}
