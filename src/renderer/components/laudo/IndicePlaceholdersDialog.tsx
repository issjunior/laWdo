import { useMemo, useState } from 'react';
import { Check, Copy, Search, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AlinhamentoCelulaIndice, ItemIndicePlaceholder, TabelaIndicePlaceholder } from '@/lib/indice-placeholders';
import { toast } from 'sonner';

interface IndicePlaceholdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itens: ItemIndicePlaceholder[];
}

const CLASSES_ALINHAMENTO_CELULA: Record<AlinhamentoCelulaIndice, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
};

async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Usa o fallback para ambientes sem acesso à Clipboard API.
  }

  try {
    const area = document.createElement('textarea');
    area.value = texto;
    area.readOnly = true;
    area.className = 'fixed -left-full top-0 opacity-0';
    document.body.append(area);
    area.select();
    const copiado = document.execCommand('copy');
    area.remove();
    return copiado;
  } catch {
    return false;
  }
}

function TabelaCompacta({ tabela, onAbrir }: { tabela: TabelaIndicePlaceholder; onAbrir: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="max-h-28 w-full cursor-pointer overflow-hidden rounded-md border p-1 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onAbrir}
      onKeyDown={evento => {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          onAbrir();
        }
      }}
      aria-label="Abrir tabela em tamanho ampliado"
    >
      <Table className="min-w-max text-[10px]">
        <TableBody>
          {tabela.linhas.slice(0, 4).map((linha, indice) => (
            <TableRow key={indice}>
              {linha.map((celula, indiceCelula) => (
                <TableCell key={indiceCelula} className={`whitespace-nowrap px-1.5 py-1 ${CLASSES_ALINHAMENTO_CELULA[celula.alinhamento]}`}>
                  {celula.valor || '-'}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TabelaAmpliada({ tabela }: { tabela: TabelaIndicePlaceholder }) {
  return (
    <Table className="min-w-max text-sm">
      <TableBody>
        {tabela.linhas.map((linha, indice) => (
          <TableRow key={indice}>
            {linha.map((celula, indiceCelula) => (
              <TableCell key={indiceCelula} className={`whitespace-nowrap ${CLASSES_ALINHAMENTO_CELULA[celula.alinhamento]}`}>
                {celula.valor || '-'}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function IndicePlaceholdersDialog({ open, onOpenChange, itens }: IndicePlaceholdersDialogProps) {
  const [busca, setBusca] = useState('');
  const [itemTabela, setItemTabela] = useState<ItemIndicePlaceholder | null>(null);
  const [chaveCopiada, setChaveCopiada] = useState<string | null>(null);

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return itens;
    return itens.filter(item => (item.campoFormulario.toLocaleLowerCase('pt-BR').includes(termo)
      || `{{${item.chave}}}`.toLocaleLowerCase('pt-BR').includes(termo)
      || item.valor.toLocaleLowerCase('pt-BR').includes(termo)));
  }, [busca, itens]);

  const copiarPlaceholder = async (chave: string) => {
    const copiado = await copiarTexto(`{{${chave}}}`);
    if (!copiado) {
      toast.error('Não foi possível copiar o placeholder.');
      return;
    }
    setChaveCopiada(chave);
    toast.success('Placeholder copiado para a área de transferência.');
    window.setTimeout(() => setChaveCopiada(atual => atual === chave ? null : atual), 1600);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden border-primary/20 bg-card shadow-2xl">
          <DialogHeader className="-mx-6 -mt-6 border-b border-primary/15 bg-gradient-to-r from-primary/15 via-accent/80 to-card px-6 py-5 dark:from-primary/20 dark:via-accent/50">
            <DialogTitle className="flex items-center gap-2.5 text-foreground">
              <span className="rounded-lg bg-primary p-2 text-primary-foreground shadow-sm"><Table2 className="size-4" /></span>
              Índice de placeholders
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary ring-1 ring-primary/15">
                {itens.length}
              </span>
              {itens.length === 1 ? 'placeholder utilizado no laudo atual.' : 'placeholders utilizados no laudo atual.'}
            </DialogDescription>
          </DialogHeader>
          <div className="relative rounded-lg bg-primary/[0.04] p-1.5 ring-1 ring-primary/10">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input value={busca} onChange={evento => setBusca(evento.target.value)} className="border-primary/15 bg-background pl-9 shadow-sm focus-visible:ring-primary/40" placeholder="Buscar por campo, placeholder ou valor..." />
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-primary/15 bg-card shadow-inner">
            <Table className="min-w-[900px] table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[28%]" />
                <col className="w-[50%]" />
              </colgroup>
              <TableHeader className="sticky top-0 z-10 bg-gradient-to-r from-primary/15 via-accent/80 to-primary/[0.07] backdrop-blur supports-[backdrop-filter]:from-primary/20 supports-[backdrop-filter]:via-accent/65">
                <TableRow className="border-border/70 hover:bg-transparent">
                  <TableHead className="h-11 px-4 text-[11px] font-bold uppercase tracking-wide text-primary">Campo da REP</TableHead>
                  <TableHead className="h-11 px-4 text-[11px] font-bold uppercase tracking-wide text-primary">Placeholder</TableHead>
                  <TableHead className="h-11 px-4 text-[11px] font-bold uppercase tracking-wide text-primary">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensFiltrados.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="h-28 text-center text-muted-foreground">Nenhum placeholder encontrado.</TableCell></TableRow>
                ) : itensFiltrados.map(item => (
                  <TableRow key={item.chave} className="border-border/60 transition-colors odd:bg-accent/30 hover:bg-primary/[0.07]">
                    <TableCell className="align-middle px-4 py-3.5 text-muted-foreground">
                      <span className="leading-5">{item.campoFormulario}</span>
                    </TableCell>
                    <TableCell className="align-middle px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <code className="min-w-0 whitespace-nowrap rounded-md bg-primary/[0.07] px-2 py-1 font-medium text-xs text-primary shadow-sm ring-1 ring-primary/15">{`{{${item.chave}}}`}</code>
                        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0 rounded-md text-primary hover:bg-primary/10 hover:text-primary" onClick={() => void copiarPlaceholder(item.chave)} aria-label={`Copiar {{${item.chave}}}`} title="Copiar placeholder">
                          {chaveCopiada === item.chave ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="align-middle px-4 py-3.5">
                      {item.tabela ? <TabelaCompacta tabela={item.tabela} onAbrir={() => setItemTabela(item)} /> : item.preenchido
                        ? <span className="whitespace-pre-wrap break-words leading-5 text-foreground">{item.valor}</span>
                        : <span className="font-medium text-amber-700 dark:text-amber-400">XXX — não preenchido</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={itemTabela !== null} onOpenChange={aberto => { if (!aberto) setItemTabela(null); }}>
        <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{itemTabela ? `{{${itemTabela.chave}}}` : 'Tabela do placeholder'}</DialogTitle>
            <DialogDescription>Valor efetivo utilizado no laudo.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-auto rounded-md border">
            {itemTabela?.tabela && <TabelaAmpliada tabela={itemTabela.tabela} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
