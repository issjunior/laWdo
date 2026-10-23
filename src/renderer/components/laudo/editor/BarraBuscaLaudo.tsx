import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface BarraBuscaLaudoProps {
  termo: string;
  atual: number;
  total: number;
  foco: number;
  onTermoChange: (termo: string) => void;
  onNavegar: (direcao: number) => void;
  onFechar: () => void;
}

export function BarraBuscaLaudo({ termo, atual, total, foco, onTermoChange, onNavegar, onFechar }: BarraBuscaLaudoProps) {
  const entrada = useRef<HTMLInputElement>(null);
  useEffect(() => { entrada.current?.focus(); entrada.current?.select(); }, [foco]);
  return <div role="search" aria-label="Buscar no laudo" data-barra-busca-laudo className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-md border bg-background p-2 shadow-sm">
    <Input ref={entrada} aria-label="Texto para buscar no laudo" placeholder="Buscar no laudo" value={termo}
      className="min-w-48 flex-1" onChange={evento => onTermoChange(evento.target.value)}
      onKeyDown={evento => {
        if (evento.key === 'Enter') { evento.preventDefault(); onNavegar(evento.shiftKey ? -1 : 1); }
        if (evento.key === 'Escape') { evento.preventDefault(); onFechar(); }
      }} />
    <span role="status" className="text-xs text-muted-foreground">{total ? `${atual + 1} de ${total}` : termo.trim() ? 'Nenhum resultado' : 'Digite para buscar'}</span>
    <Button type="button" variant="ghost" size="icon" aria-label="Resultado anterior" disabled={!total} onClick={() => onNavegar(-1)}><ChevronUp className="h-4 w-4" /></Button>
    <Button type="button" variant="ghost" size="icon" aria-label="Próximo resultado" disabled={!total} onClick={() => onNavegar(1)}><ChevronDown className="h-4 w-4" /></Button>
    <Button type="button" variant="ghost" size="icon" aria-label="Fechar busca" onClick={onFechar}><X className="h-4 w-4" /></Button>
  </div>;
}
