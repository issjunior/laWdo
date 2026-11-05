import type { SessaoSeletorTabela } from '@/lib/seletores-tabela-laudo';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

function ComboboxTabelaLaudo({ sessao }: { sessao: SessaoSeletorTabela }) {
  const [texto, definirTexto] = useState(sessao.textoApresentado ?? sessao.valor);
  const [editou, definirEditou] = useState(false);
  const [indiceAtivo, definirIndiceAtivo] = useState(-1);
  const entrada = useRef<HTMLInputElement>(null);
  const encerrando = useRef(false);
  const lista = useRef<HTMLDivElement>(null);
  const normalizar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  const busca = editou ? normalizar(texto) : '';
  const opcoes = sessao.opcoes.filter(opcao => !opcao.desabilitada && (opcao.valor === '__manual__' || !busca || normalizar(opcao.texto).includes(busca)));
  const confirmar = (valor: string, selecionou = false) => {
    if (encerrando.current) return;
    encerrando.current = true;
    sessao.escolher(!editou && !selecionou ? sessao.valor : valor.trim() === 'XXX' ? '' : valor);
  };
  useEffect(() => {
    entrada.current?.focus({ preventScroll: true });
    entrada.current?.select();
  }, []);
  useEffect(() => {
    lista.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [indiceAtivo]);
  return (
    <Popover open onOpenChange={aberto => { if (!aberto) confirmar(texto); }}>
      {createPortal(<PopoverAnchor asChild>
        <Input ref={entrada} data-seletor-tabela-ancora={sessao.id} className={`seletor-tabela-entrada${!texto.trim() || texto.trim() === 'XXX' ? ' seletor-tabela-pendente' : ''}`}
          value={texto} placeholder="XXX" aria-label={sessao.rotulo} role="combobox" aria-autocomplete="list"
          aria-expanded="true" aria-controls={`${sessao.id}-lista`}
          aria-activedescendant={indiceAtivo >= 0 ? `${sessao.id}-opcao-${indiceAtivo}` : undefined}
          onChange={evento => {
            definirTexto(evento.target.value); sessao.digitar(evento.target.value);
            definirEditou(true); definirIndiceAtivo(-1);
          }}
          onBlur={evento => {
            if (evento.relatedTarget instanceof Node && lista.current?.contains(evento.relatedTarget)) return;
            confirmar(texto);
          }}
          onKeyDown={evento => {
            if (evento.nativeEvent.isComposing) return;
            if (evento.key === 'Escape') {
              evento.preventDefault(); evento.stopPropagation(); encerrando.current = true; sessao.fechar();
            } else if (evento.key === 'Enter') {
              evento.preventDefault(); confirmar(opcoes[indiceAtivo]?.valor ?? texto, indiceAtivo >= 0);
            } else if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
              evento.preventDefault();
              if (!opcoes.length) return;
              definirIndiceAtivo(atual => evento.key === 'ArrowDown' ? Math.min(opcoes.length - 1, atual + 1) : Math.max(0, atual - 1));
            }
          }} />
      </PopoverAnchor>, document.body)}
      <PopoverContent ref={lista} data-seletor-tabela-lista="true" className="seletor-tabela-lista seletor-tabela-sugestoes"
        align="start" sideOffset={4} collisionPadding={8} onOpenAutoFocus={evento => evento.preventDefault()}
        onInteractOutside={evento => { if (evento.target === entrada.current) evento.preventDefault(); }}
        onEscapeKeyDown={evento => { evento.preventDefault(); encerrando.current = true; sessao.fechar(); }}
        onCloseAutoFocus={evento => { evento.preventDefault(); sessao.concluirFechamento(); }}>
        <div id={`${sessao.id}-lista`} role="listbox" aria-label={sessao.rotulo}>
          {opcoes.map((opcao, indice) => <Button key={opcao.valor} id={`${sessao.id}-opcao-${indice}`}
            type="button" variant="ghost" role="option" aria-selected={indice === indiceAtivo} tabIndex={-1}
            className="seletor-tabela-sugestao" onPointerDown={evento => evento.preventDefault()}
            onClick={() => confirmar(opcao.valor, true)}>{opcao.texto}</Button>)}
          {!opcoes.length && <p className="px-3 py-2 text-sm text-muted-foreground">Nenhuma opção encontrada.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SeletorTabelaLaudo({ sessao }: { sessao: SessaoSeletorTabela }) {
  return <ComboboxTabelaLaudo sessao={sessao} />;
}
