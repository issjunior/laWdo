import { useEffect, useState } from 'react';
import { Image as ImageIcon, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ImagemLaudo } from '@/components/laudo/IlustracoesPanel';

interface SeletorFiguraDialogProps {
  aberto: boolean;
  figuraAlvo: ImagemLaudo | null;
  imagens: ImagemLaudo[];
  imagemSelecionadaId: string | null;
  onAbertoChange: (aberto: boolean) => void;
  onSelecionar: (imagemId: string) => void;
  onConfirmar: (legenda: string) => void;
  onBuscarGdl: () => void;
}

export function SeletorFiguraDialog({
  aberto,
  figuraAlvo,
  imagens,
  imagemSelecionadaId,
  onAbertoChange,
  onSelecionar,
  onConfirmar,
  onBuscarGdl,
}: SeletorFiguraDialogProps) {
  const imagemSelecionada = imagens.find(imagem => imagem.id === imagemSelecionadaId) || null;
  const [legenda, setLegenda] = useState('');

  useEffect(() => {
    if (aberto) setLegenda(figuraAlvo?.legenda || '');
  }, [aberto, figuraAlvo?.id, figuraAlvo?.legenda]);

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Substituir figura</DialogTitle>
          <DialogDescription>Escolha uma imagem e revise a legenda que será exibida no laudo antes de confirmar.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <div className="min-h-0 overflow-y-auto pr-1">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Imagens disponíveis</p>
            {imagens.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/40 p-6 text-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhuma imagem está disponível no painel.</p>
                <Button variant="outline" onClick={onBuscarGdl}><Search className="mr-2 h-4 w-4" />Buscar na REP</Button>
              </div>
            ) : (
              <TooltipProvider>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {imagens.map(imagem => {
                    const selecionada = imagem.id === imagemSelecionadaId;
                    return (
                      <Tooltip key={imagem.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-pressed={selecionada}
                            onClick={() => onSelecionar(imagem.id)}
                            className={`overflow-hidden rounded-lg border bg-card text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selecionada ? 'border-primary ring-2 ring-ring' : 'border-border hover:bg-accent'}`}
                          >
                            <div className="aspect-[4/3] bg-muted p-1"><img src={imagem.thumbnailUrl || imagem.url} alt={imagem.legenda || imagem.nomeArquivo || 'Imagem disponível'} className="h-full w-full object-contain" /></div>
                            <div className="space-y-1 p-2">
                              <p className="truncate text-xs font-medium">{imagem.nomeArquivo || imagem.legenda || 'Imagem sem nome'}</p>
                              {imagem.origem === 'gdl' && <Badge variant="secondary" className="h-4 text-[9px]">GDL</Badge>}
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{imagem.legenda || imagem.nomeArquivo || 'Imagem disponível'}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
            )}
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <section className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">Figura original</p>
              {figuraAlvo && <>
                <div className="aspect-[4/3] overflow-hidden rounded-md border bg-muted"><img src={figuraAlvo.thumbnailUrl || figuraAlvo.url} alt={figuraAlvo.legenda || 'Figura original'} className="h-full w-full object-contain" /></div>
                <div className="space-y-1"><p className="text-xs font-medium">Legenda atual</p><p className="min-h-5 text-sm text-muted-foreground">{figuraAlvo.legenda || 'Sem legenda'}</p></div>
              </>}
            </section>

            <section className="space-y-3 rounded-lg border bg-card p-3">
              <p className="text-xs font-medium text-muted-foreground">Nova figura</p>
              {imagemSelecionada ? <>
                <div className="aspect-[4/3] overflow-hidden rounded-md border bg-muted"><img src={imagemSelecionada.thumbnailUrl || imagemSelecionada.url} alt={imagemSelecionada.nomeArquivo || imagemSelecionada.legenda || 'Nova figura'} className="h-full w-full object-contain" /></div>
                <p className="truncate text-xs text-muted-foreground">{imagemSelecionada.nomeArquivo || imagemSelecionada.legenda || 'Imagem selecionada'}</p>
              </> : <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed bg-muted/40 text-xs text-muted-foreground">Selecione uma imagem acima</div>}
              <div className="space-y-2">
                <Label htmlFor="legenda-substituicao">Legenda da nova figura</Label>
                <Input id="legenda-substituicao" value={legenda} onChange={(event) => setLegenda(event.target.value)} disabled={!imagemSelecionada} placeholder="Descreva a figura..." />
                <p className="text-xs text-muted-foreground">A legenda foi copiada da figura original e pode ser ajustada.</p>
              </div>
            </section>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onAbertoChange(false)}>Cancelar</Button>
          <Button onClick={() => onConfirmar(legenda.trim())} disabled={!imagemSelecionada}>Substituir figura</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
