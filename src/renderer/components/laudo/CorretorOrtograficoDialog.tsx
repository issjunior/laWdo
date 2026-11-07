import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { notificarEstadoCorretor } from '@/lib/corretor-editor';
import type { EstadoCorretor, RespostaCorretor } from '@shared/types/corretor.types';

export function CorretorOrtograficoDialog({ aberto, onAbertoChange }: {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
}) {
  const [estado, definirEstado] = useState<EstadoCorretor | null>(null);
  const [ocupado, definirOcupado] = useState(false);
  const [erro, definirErro] = useState('');
  const [palavra, definirPalavra] = useState('');
  const [filtro, definirFiltro] = useState('');

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    definirOcupado(true);
    definirErro('');
    definirEstado(null);
    definirPalavra('');
    definirFiltro('');
    if (!window.ipcAPI?.corretor) {
      definirErro('O corretor está disponível no aplicativo desktop.');
      definirOcupado(false);
      return;
    }
    void window.ipcAPI.corretor.obter().then(resposta => {
      if (cancelado) return;
      if (resposta.success) definirEstado(resposta.data);
      else definirErro(resposta.error);
    }).catch(() => { if (!cancelado) definirErro('Não foi possível carregar o corretor. Feche e tente novamente.'); })
      .finally(() => { if (!cancelado) definirOcupado(false); });
    return () => { cancelado = true; };
  }, [aberto]);

  const executar = async (operacao: () => Promise<RespostaCorretor>, limparPalavra = false) => {
    if (ocupado) return;
    definirOcupado(true);
    definirErro('');
    try {
      const resposta = await operacao();
      if (!resposta.success) { definirErro(resposta.error); return; }
      definirEstado(resposta.data);
      notificarEstadoCorretor(resposta.data);
      if (limparPalavra) definirPalavra('');
    } catch (erro: unknown) {
      definirErro(erro instanceof Error ? erro.message : 'Não foi possível atualizar o corretor.');
    } finally { definirOcupado(false); }
  };

  const palavras = estado?.palavras.filter(termo => termo.toLocaleLowerCase('pt-BR').includes(filtro.toLocaleLowerCase('pt-BR'))) ?? [];

  return <Dialog open={aberto} onOpenChange={onAbertoChange}>
    <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Corretor ortográfico</DialogTitle>
        <DialogDescription>Português brasileiro. Clique com o botão direito em uma palavra sublinhada para ver sugestões.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 space-y-4 overflow-y-auto" aria-busy={ocupado}>
        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <Label htmlFor="corretor-ativo">Verificar ortografia ao digitar</Label>
          <Checkbox id="corretor-ativo" checked={estado?.ativo ?? false} disabled={ocupado || !estado?.disponivel}
            onCheckedChange={ativo => void executar(() => window.ipcAPI.corretor.configurar(ativo === true))} />
        </div>
        {estado && !estado.disponivel && <p role="status" className="text-sm text-muted-foreground">O dicionário de português brasileiro não está disponível nesta instalação.</p>}
        <p className="text-xs text-muted-foreground">Uso gratuito, com verificação local. O primeiro uso pode exigir internet para baixar o dicionário. O texto do laudo não é enviado para correção.</p>
        <form className="space-y-2" onSubmit={evento => {
          evento.preventDefault();
          if (palavra.trim()) void executar(() => window.ipcAPI.corretor.adicionar(palavra), true);
        }}>
          <Label htmlFor="corretor-palavra">Adicionar termo ao dicionário</Label>
          <div className="flex gap-2">
            <Input id="corretor-palavra" placeholder="Ex.: microestriamento" maxLength={100} value={palavra}
              onChange={evento => definirPalavra(evento.target.value)} disabled={ocupado || !estado} />
            <Button type="submit" variant="outline" disabled={ocupado || !estado || !palavra.trim()}><Plus className="mr-1 size-4" />Adicionar</Button>
          </div>
          <p className="text-xs text-muted-foreground">Uma palavra por vez. Os termos ficam salvos para os próximos laudos. No Windows, também podem integrar o dicionário pessoal do sistema.</p>
        </form>
        <div className="space-y-2">
          <Label htmlFor="corretor-filtro">Termos reconhecidos ({estado?.palavras.length ?? 0})</Label>
          <Input id="corretor-filtro" placeholder="Buscar termo" value={filtro} onChange={evento => definirFiltro(evento.target.value)} disabled={!estado} />
          <ul className="max-h-56 overflow-y-auto rounded-md border" aria-label="Dicionário personalizado">
            {palavras.map(termo => <li key={termo} className="flex items-center justify-between gap-2 border-b px-3 py-1 last:border-b-0">
              <span className="break-all text-sm">{termo}</span>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${termo} do dicionário`} disabled={ocupado}
                onClick={() => void executar(() => window.ipcAPI.corretor.remover(termo))}><Trash2 className="size-4" /></Button>
            </li>)}
            {!palavras.length && <li className="p-3 text-sm text-muted-foreground">{ocupado && !estado ? 'Carregando…' : filtro ? 'Nenhum termo encontrado.' : 'Nenhum termo adicionado.'}</li>}
          </ul>
        </div>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
