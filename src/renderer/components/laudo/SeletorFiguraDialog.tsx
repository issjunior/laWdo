import { useEffect, useState } from 'react';
import { ArrowRight, Check, Image as ImageIcon, ImageOff, LoaderCircle, Search, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  onGerarLegenda?: (imagemId: string) => Promise<string | null>;
}

function ImagemPreview({ src, alt, textoFallback }: { src: string; alt: string; textoFallback: string }) {
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [src]);

  if (!src || falhou) {
    return <div className="flex h-full w-full items-center justify-center bg-muted p-3 text-center text-xs text-muted-foreground"><span className="flex flex-col items-center gap-2"><ImageOff className="h-5 w-5" />{textoFallback}</span></div>;
  }

  return <img src={src} alt={alt} onError={() => setFalhou(true)} className="h-full w-full object-contain" />;
}

function TextoTruncado({ texto, className }: { texto: string; className: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><p tabIndex={0} className={className}>{texto}</p></TooltipTrigger>
      <TooltipContent className="max-w-72 break-words">{texto}</TooltipContent>
    </Tooltip>
  );
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
  onGerarLegenda,
}: SeletorFiguraDialogProps) {
  const imagemSelecionada = imagens.find(imagem => imagem.id === imagemSelecionadaId) || null;
  const [legenda, setLegenda] = useState('');
  const [gerandoLegenda, setGerandoLegenda] = useState(false);
  const [erroLegenda, setErroLegenda] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setLegenda(figuraAlvo?.legenda || '');
    setErroLegenda(null);
  }, [aberto, figuraAlvo?.id, figuraAlvo?.legenda]);
  useEffect(() => setErroLegenda(null), [imagemSelecionadaId]);

  const gerarLegenda = async () => {
    if (!imagemSelecionada) return;
    if (!onGerarLegenda) {
      setErroLegenda('A descrição por IA não está disponível neste laudo. Informe a legenda manualmente.');
      return;
    }
    setGerandoLegenda(true);
    setErroLegenda(null);
    try {
      const descricao = await onGerarLegenda(imagemSelecionada.id);
      if (!descricao) {
        setErroLegenda('A IA não retornou uma descrição. Revise a imagem ou informe a legenda manualmente.');
        return;
      }
      setLegenda(descricao);
    } catch (error: unknown) {
      setErroLegenda(error instanceof Error ? error.message : 'Não foi possível gerar a descrição da imagem.');
    } finally {
      setGerandoLegenda(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <TooltipProvider delayDuration={200}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col gap-5 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Substituir figura</DialogTitle>
          <DialogDescription>Selecione uma imagem, compare-a com a figura atual e confirme a legenda que será exibida no laudo.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(470px,1.2fr)]">
            <Card className="min-w-0">
              <CardHeader className="space-y-1 p-4 pb-3"><CardTitle className="text-sm">Escolha a nova figura</CardTitle><p className="text-xs text-muted-foreground">Miniaturas compactas mantêm mais imagens visíveis e destacam a seleção atual.</p></CardHeader>
              <CardContent className="p-4 pt-0">
                {imagens.length === 0 ? (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/40 p-6 text-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    <div className="space-y-1"><p className="text-sm font-medium">Nenhuma imagem está disponível</p><p className="text-xs text-muted-foreground">Busque fotos na REP para continuar a substituição.</p></div>
                    <Button variant="outline" onClick={onBuscarGdl}><Search className="mr-2 h-4 w-4" />Buscar na REP</Button>
                  </div>
                ) : (
                  <div className="h-[344px] overflow-y-auto pr-1"><div className="grid grid-cols-3 gap-3">
                    {imagens.map(imagem => {
                      const selecionada = imagem.id === imagemSelecionadaId;
                      const titulo = imagem.legenda || imagem.nomeArquivo || 'Imagem sem nome';
                      return <Tooltip key={imagem.id}><TooltipTrigger asChild><button type="button" aria-label={`Selecionar ${titulo}`} aria-pressed={selecionada} onClick={() => onSelecionar(imagem.id)} className={`group relative flex min-w-0 flex-col gap-2 rounded-md border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selecionada ? 'border-2 border-primary bg-primary/5' : 'border-border hover:bg-accent'}`}>
                        <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-md border bg-muted"><ImagemPreview src={imagem.thumbnailUrl || imagem.url} alt={titulo} textoFallback="Miniatura indisponível" /></div>
                        <div className="min-h-8"><p className="line-clamp-2 text-xs font-medium leading-tight">{titulo}</p></div>
                        {imagem.origem === 'gdl' && <Badge variant="secondary" className="absolute left-1 top-1 h-4 px-1 text-[8px]">GDL</Badge>}
                        {selecionada && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
                      </button></TooltipTrigger><TooltipContent className="max-w-64 break-words">{titulo}</TooltipContent></Tooltip>;
                    })}
                  </div></div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader className="space-y-1 p-4 pb-3"><CardTitle className="text-sm">Substituir Figuras</CardTitle><p className="text-xs text-muted-foreground">Revise lado a lado antes de substituir a figura no laudo.</p></CardHeader>
              <CardContent className="space-y-4 p-4 pt-0">
                <div className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] items-stretch gap-2">
                  <section className="grid min-w-0 grid-rows-[auto_1fr_auto] gap-2"><p className="text-xs font-medium text-muted-foreground">Figura original</p><div className="aspect-[4/3] w-full overflow-hidden rounded-md border bg-muted">{figuraAlvo ? <ImagemPreview src={figuraAlvo.thumbnailUrl || figuraAlvo.url} alt={figuraAlvo.legenda || 'Figura original'} textoFallback="Imagem original indisponível" /> : <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted-foreground">Figura original não disponível</div>}</div><div className="min-h-11 rounded-md bg-muted/50 p-2"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Legenda atual</p><TextoTruncado texto={figuraAlvo?.legenda || 'Sem legenda'} className="line-clamp-2 text-xs" /></div></section>
                  <div aria-label="Figura original será substituída pela nova figura" className="flex h-full items-center justify-center text-primary"><ArrowRight className="h-6 w-6" /></div>
                  <section className="grid min-w-0 grid-rows-[auto_1fr_auto] gap-2"><p className="text-xs font-medium text-muted-foreground">Nova figura</p><div className="aspect-[4/3] w-full overflow-hidden rounded-md border bg-muted">{imagemSelecionada ? <ImagemPreview src={imagemSelecionada.thumbnailUrl || imagemSelecionada.url} alt={imagemSelecionada.nomeArquivo || imagemSelecionada.legenda || 'Nova figura'} textoFallback="Imagem selecionada indisponível" /> : <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted-foreground">Selecione uma miniatura</div>}</div><div className="min-h-11 rounded-md bg-muted/50 p-2"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Arquivo selecionado</p><TextoTruncado texto={imagemSelecionada?.nomeArquivo || imagemSelecionada?.legenda || 'Aguardando seleção'} className="line-clamp-2 text-xs" /></div></section>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between gap-3"><Label htmlFor="legenda-substituicao">Legenda da nova figura</Label><Button type="button" variant="outline" size="sm" onClick={() => void gerarLegenda()} disabled={!imagemSelecionada || gerandoLegenda}>{gerandoLegenda ? <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}{gerandoLegenda ? 'Gerando' : 'Descrição com IA'}</Button></div>
                  <Input id="legenda-substituicao" value={legenda} onChange={(event) => setLegenda(event.target.value)} disabled={!imagemSelecionada || gerandoLegenda} placeholder="Descreva a figura..." />
                  <p className="text-xs text-muted-foreground">A legenda original é o ponto de partida. Você pode editar ou gerar uma descrição com IA para a imagem selecionada.</p>
                  {erroLegenda && <Alert variant="destructive" className="py-3"><AlertTitle>Descrição indisponível</AlertTitle><AlertDescription>{erroLegenda}</AlertDescription></Alert>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter><Button variant="outline" onClick={() => onAbertoChange(false)}>Cancelar</Button><Button onClick={() => onConfirmar(legenda.trim())} disabled={!imagemSelecionada || gerandoLegenda}>Substituir figura</Button></DialogFooter>
      </DialogContent>
      </TooltipProvider>
    </Dialog>
  );
}
