import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { criarOpcoesFormatoProjetil, normalizarFormatoProjetil as normalizar } from '@shared/utils/formato-projetil';

export function FormatoProjetilCombobox({ valor, siglas, personalizados, aoSelecionar }: {
  valor: string; siglas: string[]; personalizados: string[]; aoSelecionar: (valor: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const opcoes = useMemo(() => criarOpcoesFormatoProjetil(siglas, personalizados, valor), [siglas, personalizados, valor]);
  const termo = normalizar(busca);
  const filtradas = opcoes.filter(opcao => normalizar(opcao.rotulo).includes(termo));
  const textoNovo = busca.trim();
  const existente = opcoes.some(opcao => [opcao.valor, opcao.rotulo, opcao.descricao].some(nome => normalizar(nome) === termo));
  function selecionar(novoValor: string) {
    aoSelecionar(novoValor);
    setAberto(false);
    setBusca('');
  }
  return <Popover modal open={aberto} onOpenChange={novoEstado => { setAberto(novoEstado); if (novoEstado) setBusca(''); }}>
    <PopoverTrigger asChild>
      <Button id="cadastro-tipo" type="button" variant="outline" role="combobox" aria-expanded={aberto} aria-haspopup="listbox" aria-label="Formato/Constituição" className="w-full min-w-0 justify-between font-normal">
        <span className={cn('truncate', !valor && 'text-muted-foreground')}>{opcoes.find(opcao => normalizar(opcao.valor) === normalizar(valor))?.rotulo ?? 'Selecione ou cadastre...'}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
      <Command label="Pesquisar ou cadastrar formato" shouldFilter={false}>
        <CommandInput aria-label="Pesquisar ou cadastrar formato" placeholder="Pesquisar ou cadastrar formato..." maxLength={120} value={busca} onValueChange={setBusca} />
        <CommandList>
          <CommandEmpty>Nenhum formato encontrado.</CommandEmpty>
          <CommandGroup>
            {filtradas.map(opcao => <CommandItem key={opcao.valor} value={opcao.valor} onSelect={() => selecionar(opcao.valor)}>
              <span className="min-w-0 break-words">{opcao.rotulo}</span>
              <Check className={cn('ml-auto h-4 w-4 shrink-0', normalizar(valor) === normalizar(opcao.valor) ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
            </CommandItem>)}
            {textoNovo && !existente && <CommandItem value={`novo-${textoNovo}`} onSelect={() => selecionar(textoNovo)}>
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">Cadastrar “{textoNovo}”</span>
            </CommandItem>}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
