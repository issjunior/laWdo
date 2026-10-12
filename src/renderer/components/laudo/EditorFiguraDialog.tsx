import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface AjustesFigura {
  angulo: number;
  espelharHorizontal: boolean;
  espelharVertical: boolean;
  corte: { x: number; y: number; largura: number; altura: number };
}

type CorteFigura = AjustesFigura['corte'];
type Ponto = { x: number; y: number };
type Canto = 'superior-esquerdo' | 'superior-direito' | 'inferior-esquerdo' | 'inferior-direito';
type OperacaoCorte = {
  tipo: 'criar' | 'mover' | 'redimensionar';
  inicio: Ponto;
  corteInicial: CorteFigura;
  canto?: Canto;
  ponteiroId: number;
};

const CORTE_INTEIRO: CorteFigura = { x: 0, y: 0, largura: 100, altura: 100 };

const AJUSTES_INICIAIS: AjustesFigura = {
  angulo: 0,
  espelharHorizontal: false,
  espelharVertical: false,
  corte: CORTE_INTEIRO,
};

const limitar = (valor: number, minimo: number, maximo: number) => Math.min(maximo, Math.max(minimo, valor));

export function pontoPercentualFigura(x: number, y: number, limites: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): Ponto {
  if (limites.width <= 0 || limites.height <= 0) return { x: 0, y: 0 };
  return {
    x: limitar((x - limites.left) / limites.width * 100, 0, 100),
    y: limitar((y - limites.top) / limites.height * 100, 0, 100),
  };
}

export function calcularCorteFigura(operacao: Pick<OperacaoCorte, 'tipo' | 'inicio' | 'corteInicial' | 'canto'>, ponto: Ponto): CorteFigura {
  const { corteInicial, inicio } = operacao;
  if (operacao.tipo === 'criar') {
    return {
      x: Math.min(inicio.x, ponto.x),
      y: Math.min(inicio.y, ponto.y),
      largura: Math.abs(ponto.x - inicio.x),
      altura: Math.abs(ponto.y - inicio.y),
    };
  }
  if (operacao.tipo === 'mover') {
    return {
      ...corteInicial,
      x: limitar(corteInicial.x + ponto.x - inicio.x, 0, 100 - corteInicial.largura),
      y: limitar(corteInicial.y + ponto.y - inicio.y, 0, 100 - corteInicial.altura),
    };
  }
  const canto = operacao.canto ?? 'inferior-direito';
  const ancoraX = canto.endsWith('esquerdo') ? corteInicial.x + corteInicial.largura : corteInicial.x;
  const ancoraY = canto.startsWith('superior') ? corteInicial.y + corteInicial.altura : corteInicial.y;
  return {
    x: Math.min(ancoraX, ponto.x),
    y: Math.min(ancoraY, ponto.y),
    largura: Math.abs(ponto.x - ancoraX),
    altura: Math.abs(ponto.y - ancoraY),
  };
}

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
  const origemX = limitar(Math.round(largura * x / 100), 0, largura - 1);
  const origemY = limitar(Math.round(altura * y / 100), 0, altura - 1);
  const larguraCorte = limitar(Math.round(largura * ajustes.corte.largura / 100), 1, largura - origemX);
  const alturaCorte = limitar(Math.round(altura * ajustes.corte.altura / 100), 1, altura - origemY);
  const resultado = document.createElement('canvas');
  resultado.width = larguraCorte;
  resultado.height = alturaCorte;
  resultado.getContext('2d')?.drawImage(orientada, origemX, origemY, larguraCorte, alturaCorte, 0, 0, larguraCorte, alturaCorte);
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
  const operacao = useRef<OperacaoCorte | null>(null);
  const corteAtual = useRef<CorteFigura>(CORTE_INTEIRO);

  useEffect(() => {
    if (aberto) {
      setAjustes(AJUSTES_INICIAIS);
      corteAtual.current = CORTE_INTEIRO;
      operacao.current = null;
      setPrevia(origem);
      setErro('');
    }
  }, [aberto, origem]);

  useEffect(() => {
    if (!aberto || !origem) return;
    let ativo = true;
    void transformarFigura(origem, {
      angulo: ajustes.angulo,
      espelharHorizontal: ajustes.espelharHorizontal,
      espelharVertical: ajustes.espelharVertical,
      corte: CORTE_INTEIRO,
    })
      .then(valor => { if (ativo) setPrevia(valor); })
      .catch(() => { if (ativo) setErro('Não foi possível mostrar a prévia.'); });
    return () => { ativo = false; };
  }, [aberto, origem, ajustes.angulo, ajustes.espelharHorizontal, ajustes.espelharVertical]);

  const atualizarCorte = (corte: CorteFigura) => {
    corteAtual.current = corte;
    setAjustes(atual => ({ ...atual, corte }));
  };

  const pontoDoPonteiro = (evento: PointerEvent<SVGSVGElement>): Ponto => {
    return pontoPercentualFigura(evento.clientX, evento.clientY, evento.currentTarget.getBoundingClientRect());
  };

  const iniciarCorte = (evento: PointerEvent<SVGSVGElement>) => {
    if (evento.button !== 0 || operacao.current) return;
    const limites = evento.currentTarget.getBoundingClientRect();
    if (limites.width <= 0 || limites.height <= 0) return;
    const alvo = evento.target as SVGElement;
    const acao = alvo.dataset.acao;
    const tipo = acao === 'mover' ? 'mover' : acao === 'redimensionar' ? 'redimensionar' : 'criar';
    const inicio = pontoDoPonteiro(evento);
    operacao.current = {
      tipo,
      inicio,
      corteInicial: corteAtual.current,
      canto: tipo === 'redimensionar' ? alvo.dataset.canto as Canto : undefined,
      ponteiroId: evento.pointerId,
    };
    evento.currentTarget.setPointerCapture(evento.pointerId);
    if (tipo === 'criar') atualizarCorte({ x: inicio.x, y: inicio.y, largura: 0, altura: 0 });
  };

  const moverCorte = (evento: PointerEvent<SVGSVGElement>) => {
    if (!operacao.current || operacao.current.ponteiroId !== evento.pointerId) return;
    atualizarCorte(calcularCorteFigura(operacao.current, pontoDoPonteiro(evento)));
  };

  const finalizarCorte = (evento: PointerEvent<SVGSVGElement>) => {
    if (!operacao.current || operacao.current.ponteiroId !== evento.pointerId) return;
    const atual = calcularCorteFigura(operacao.current, pontoDoPonteiro(evento));
    const anterior = operacao.current.corteInicial;
    const limites = evento.currentTarget.getBoundingClientRect();
    const larguraMinima = 4 / limites.width * 100;
    const alturaMinima = 4 / limites.height * 100;
    atualizarCorte(atual.largura >= larguraMinima && atual.altura >= alturaMinima ? atual : anterior);
    operacao.current = null;
    evento.currentTarget.releasePointerCapture(evento.pointerId);
  };

  const cancelarCorte = (evento: PointerEvent<SVGSVGElement>) => {
    if (!operacao.current || operacao.current.ponteiroId !== evento.pointerId) return;
    atualizarCorte(operacao.current.corteInicial);
    operacao.current = null;
  };

  const alterarAngulo = (angulo: number) => {
    atualizarCorte(CORTE_INTEIRO);
    setAjustes(atual => ({ ...atual, angulo }));
  };
  const aplicar = async () => {
    setSalvando(true);
    setErro('');
    try { await onAplicar(await transformarFigura(origem, ajustes), ajustes); onAbertoChange(false); }
    catch (falha) { setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar a figura.'); }
    finally { setSalvando(false); }
  };

  const { corte } = ajustes;
  const temCorte = corte.x !== 0 || corte.y !== 0 || corte.largura !== 100 || corte.altura !== 100;
  const direita = corte.x + corte.largura;
  const inferior = corte.y + corte.altura;

  return <Dialog open={aberto} onOpenChange={onAbertoChange}>
    <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>Editar figura</DialogTitle><DialogDescription>Arraste sobre a imagem para delimitar o corte. Mova o retângulo ou ajuste seus cantos antes de aplicar. A edição afeta somente esta figura.</DialogDescription></DialogHeader>
      <div className="flex h-72 items-center justify-center overflow-hidden rounded-md border bg-muted sm:h-80">
        <div className="relative max-h-full max-w-full">
          <img src={previa} alt="Prévia da figura antes do recorte" className="block max-h-72 max-w-full object-contain sm:max-h-80" draggable={false} />
          <svg aria-label="Área de recorte da figura" className="absolute inset-0 size-full cursor-crosshair touch-none" viewBox="0 0 100 100" preserveAspectRatio="none" onPointerDown={iniciarCorte} onPointerMove={moverCorte} onPointerUp={finalizarCorte} onPointerCancel={cancelarCorte}>
            {temCorte && <>
              <path d={`M0 0H100V100H0Z M${corte.x} ${corte.y}V${inferior}H${direita}V${corte.y}Z`} fill="black" fillRule="evenodd" opacity="0.55" pointerEvents="none" />
              <rect x={corte.x} y={corte.y} width={corte.largura} height={corte.altura} fill="transparent" stroke="white" strokeWidth="0.5" data-acao="mover" className="cursor-move" />
              {([
                ['superior-esquerdo', corte.x, corte.y],
                ['superior-direito', direita, corte.y],
                ['inferior-esquerdo', corte.x, inferior],
                ['inferior-direito', direita, inferior],
              ] as const).map(([canto, x, y]) => <circle key={canto} cx={x} cy={y} r="2" fill="white" stroke="black" strokeWidth="0.4" data-acao="redimensionar" data-canto={canto} className={canto === 'superior-esquerdo' || canto === 'inferior-direito' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'} />)}
            </>}
          </svg>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => alterarAngulo(ajustes.angulo - 90)}>Girar 90° à esquerda</Button>
        <Button type="button" variant="outline" onClick={() => alterarAngulo(ajustes.angulo + 90)}>Girar 90° à direita</Button>
        <Button type="button" variant="outline" onClick={() => setAjustes(atual => ({ ...atual, espelharHorizontal: !atual.espelharHorizontal }))}>Espelhar horizontal</Button>
        <Button type="button" variant="outline" onClick={() => setAjustes(atual => ({ ...atual, espelharVertical: !atual.espelharVertical }))}>Espelhar vertical</Button>
        <Button type="button" variant="secondary" onClick={() => { setAjustes(AJUSTES_INICIAIS); atualizarCorte(CORTE_INTEIRO); }}>Restaurar imagem</Button>
        {temCorte && <Button type="button" variant="outline" onClick={() => atualizarCorte(CORTE_INTEIRO)}>Selecionar imagem inteira</Button>}
      </div>
      <label className="grid gap-1 text-sm">Ângulo: {ajustes.angulo}°<input type="range" min="-180" max="180" value={((ajustes.angulo + 180) % 360 + 360) % 360 - 180} onChange={evento => alterarAngulo(Number(evento.target.value))} /></label>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <DialogFooter><Button variant="outline" onClick={() => onAbertoChange(false)}>Cancelar</Button><Button onClick={() => void aplicar()} disabled={salvando || !origem}>Aplicar ajustes</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
