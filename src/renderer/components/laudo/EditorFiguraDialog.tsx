import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface AjustesFigura {
  angulo: number;
  espelharHorizontal: boolean;
  espelharVertical: boolean;
  corte: { x: number; y: number; largura: number; altura: number };
}

const AJUSTES_INICIAIS: AjustesFigura = {
  angulo: 0,
  espelharHorizontal: false,
  espelharVertical: false,
  corte: { x: 0, y: 0, largura: 100, altura: 100 },
};

export async function transformarFigura(origem: string, ajustes: AjustesFigura): Promise<string> {
  const imagem = new Image();
  imagem.src = origem;
  await imagem.decode();
  const radianos = ajustes.angulo * Math.PI / 180;
  const largura = Math.max(1, Math.ceil(Math.abs(imagem.width * Math.cos(radianos)) + Math.abs(imagem.height * Math.sin(radianos)) - 1e-8));
  const altura = Math.max(1, Math.ceil(Math.abs(imagem.width * Math.sin(radianos)) + Math.abs(imagem.height * Math.cos(radianos)) - 1e-8));
  const orientada = document.createElement('canvas');
  orientada.width = largura;
  orientada.height = altura;
  const contexto = orientada.getContext('2d');
  if (!contexto) throw new Error('Não foi possível editar a figura.');
  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, largura, altura);
  contexto.translate(largura / 2, altura / 2);
  contexto.rotate(radianos);
  contexto.scale(ajustes.espelharHorizontal ? -1 : 1, ajustes.espelharVertical ? -1 : 1);
  contexto.drawImage(imagem, -imagem.width / 2, -imagem.height / 2);
  const { x, y } = ajustes.corte;
  const larguraCorte = Math.max(1, Math.round(largura * ajustes.corte.largura / 100));
  const alturaCorte = Math.max(1, Math.round(altura * ajustes.corte.altura / 100));
  const resultado = document.createElement('canvas');
  resultado.width = larguraCorte;
  resultado.height = alturaCorte;
  resultado.getContext('2d')?.drawImage(orientada, Math.round(largura * x / 100), Math.round(altura * y / 100), larguraCorte, alturaCorte, 0, 0, larguraCorte, alturaCorte);
  return resultado.toDataURL('image/png');
}

interface EditorFiguraDialogProps {
  aberto: boolean;
  origem: string;
  onAbertoChange: (aberto: boolean) => void;
  onAplicar: (dataUri: string, ajustes: AjustesFigura) => Promise<void> | void;
}

export function EditorFiguraDialog({ aberto, origem, onAbertoChange, onAplicar }: EditorFiguraDialogProps) {
  const [ajustes, setAjustes] = useState<AjustesFigura>(AJUSTES_INICIAIS);
  const [previa, setPrevia] = useState(origem);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (aberto) { setAjustes(AJUSTES_INICIAIS); setPrevia(origem); setErro(''); } }, [aberto, origem]);
  useEffect(() => {
    if (!aberto || !origem) return;
    let ativo = true;
    void transformarFigura(origem, ajustes).then(valor => { if (ativo) setPrevia(valor); }).catch(() => { if (ativo) setErro('Não foi possível mostrar a prévia.'); });
    return () => { ativo = false; };
  }, [aberto, origem, ajustes]);

  const alterarAngulo = (angulo: number) => setAjustes(atual => ({ ...atual, angulo, corte: AJUSTES_INICIAIS.corte }));
  const alterarCorte = (campo: keyof AjustesFigura['corte'], valor: number) => setAjustes(atual => {
    const corte = { ...atual.corte, [campo]: valor };
    if (corte.x + corte.largura > 100) corte.largura = 100 - corte.x;
    if (corte.y + corte.altura > 100) corte.altura = 100 - corte.y;
    return { ...atual, corte };
  });
  const aplicar = async () => {
    setSalvando(true);
    setErro('');
    try { await onAplicar(await transformarFigura(origem, ajustes), ajustes); onAbertoChange(false); }
    catch (falha) { setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar a figura.'); }
    finally { setSalvando(false); }
  };

  return <Dialog open={aberto} onOpenChange={onAbertoChange}>
    <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>Editar figura</DialogTitle><DialogDescription>Gire, espelhe e ajuste o recorte. A edição afeta somente esta figura.</DialogDescription></DialogHeader>
      <div className="flex h-64 items-center justify-center overflow-hidden rounded-md border bg-muted"><img src={previa} alt="Prévia dos ajustes" className="max-h-full max-w-full object-contain" /></div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => alterarAngulo(ajustes.angulo - 90)}>Girar 90° à esquerda</Button>
        <Button type="button" variant="outline" onClick={() => alterarAngulo(ajustes.angulo + 90)}>Girar 90° à direita</Button>
        <Button type="button" variant="outline" onClick={() => setAjustes(atual => ({ ...atual, espelharHorizontal: !atual.espelharHorizontal }))}>Espelhar horizontal</Button>
        <Button type="button" variant="outline" onClick={() => setAjustes(atual => ({ ...atual, espelharVertical: !atual.espelharVertical }))}>Espelhar vertical</Button>
        <Button type="button" variant="secondary" onClick={() => setAjustes(AJUSTES_INICIAIS)}>Restaurar imagem</Button>
      </div>
      <label className="grid gap-1 text-sm">Ângulo: {ajustes.angulo}°<input type="range" min="-180" max="180" value={((ajustes.angulo + 180) % 360 + 360) % 360 - 180} onChange={evento => alterarAngulo(Number(evento.target.value))} /></label>
      <div className="grid grid-cols-2 gap-3">{(['x', 'y', 'largura', 'altura'] as const).map(campo => <label key={campo} className="grid gap-1 text-sm">Recorte {campo}: {ajustes.corte[campo]}%<input type="range" min={campo === 'largura' || campo === 'altura' ? 1 : 0} max={campo === 'x' ? 100 - ajustes.corte.largura : campo === 'y' ? 100 - ajustes.corte.altura : campo === 'largura' ? 100 - ajustes.corte.x : 100 - ajustes.corte.y} value={ajustes.corte[campo]} onChange={evento => alterarCorte(campo, Number(evento.target.value))} /></label>)}</div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <DialogFooter><Button variant="outline" onClick={() => onAbertoChange(false)}>Cancelar</Button><Button onClick={() => void aplicar()} disabled={salvando || !origem}>Aplicar ajustes</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
