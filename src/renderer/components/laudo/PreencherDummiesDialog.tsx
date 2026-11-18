import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ImagemLaudo } from '@/components/laudo/IlustracoesPanel';

interface AssociacaoFigura {
  figuraId: string;
  ocorrenciaId?: string;
  imagemId: string;
}

interface PreencherDummiesDialogProps {
  aberto: boolean;
  dummies: ImagemLaudo[];
  imagens: ImagemLaudo[];
  onAbertoChange: (aberto: boolean) => void;
  onConfirmar: (associacoes: AssociacaoFigura[]) => void;
}

export function PreencherDummiesDialog({ aberto, dummies, imagens, onAbertoChange, onConfirmar }: PreencherDummiesDialogProps) {
  const [associacoes, setAssociacoes] = useState<AssociacaoFigura[]>([]);
  const estavaAbertoRef = useRef(false);

  useEffect(() => {
    if (!aberto) {
      estavaAbertoRef.current = false;
      return;
    }
    const primeiraAbertura = !estavaAbertoRef.current;
    estavaAbertoRef.current = true;
    setAssociacoes(atuais => {
      if (primeiraAbertura) return dummies.map((dummy, indice) => ({ figuraId: dummy.id, ocorrenciaId: dummy.ocorrenciaId, imagemId: imagens[indice]?.id || '' }));
      const idsImagens = new Set(imagens.map(imagem => imagem.id));
      return dummies.map(dummy => {
        const identidade = dummy.ocorrenciaId || dummy.id;
        const anterior = atuais.find(associacao => (associacao.ocorrenciaId || associacao.figuraId) === identidade);
        return { figuraId: dummy.id, ocorrenciaId: dummy.ocorrenciaId, imagemId: anterior && idsImagens.has(anterior.imagemId) ? anterior.imagemId : '' };
      });
    });
  }, [aberto, dummies, imagens]);

  const atualizarAssociacao = (identidade: string, imagemId: string) => {
    setAssociacoes(atuais => atuais.map(associacao => {
      if ((associacao.ocorrenciaId || associacao.figuraId) === identidade) return { ...associacao, imagemId };
      return associacao.imagemId === imagemId ? { ...associacao, imagemId: '' } : associacao;
    }));
  };

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Preencher figuras do template</DialogTitle>
          <DialogDescription>Revise as associações antes de aplicar. Cada imagem pode ocupar apenas uma figura.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
          {dummies.map((dummy, indice) => {
            const identidade = dummy.ocorrenciaId || dummy.id;
            const associacao = associacoes.find(item => (item.ocorrenciaId || item.figuraId) === identidade);
            return <div key={identidade} className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[96px_minmax(0,1fr)]">
              <div className="aspect-[4/3] overflow-hidden rounded-md bg-muted"><img src={dummy.thumbnailUrl || dummy.url} alt={dummy.legenda || `Figura ${indice + 1}`} className="h-full w-full object-contain" /></div>
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-medium">Figura exemplo {indice + 1}</p>
                <p className="truncate text-xs text-muted-foreground">{dummy.legenda || 'Sem legenda'}</p>
                <Select value={associacao?.imagemId || '__vazio'} onValueChange={(valor) => atualizarAssociacao(identidade, valor === '__vazio' ? '' : valor)}>
                  <SelectTrigger><SelectValue placeholder="Manter sem imagem" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__vazio">Manter sem imagem</SelectItem>
                    {imagens.map(imagem => <SelectItem key={imagem.id} value={imagem.id}>{imagem.nomeArquivo || imagem.legenda || 'Imagem sem nome'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>;
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onAbertoChange(false)}>Cancelar</Button>
          <Button onClick={() => onConfirmar(associacoes.filter(associacao => associacao.imagemId))} disabled={!associacoes.some(associacao => associacao.imagemId)}>Aplicar associações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
