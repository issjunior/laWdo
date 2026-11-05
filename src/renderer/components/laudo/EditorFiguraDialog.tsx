import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RotateCcw, RotateCw, FlipHorizontal2, FlipVertical2, Crop, Type, Plus, Trash2, Undo2, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { carregarImagemFigura, desenharTextosFigura, normalizarAnguloFigura, renderizarFigura, type AreaTextoFigura } from '@/lib/renderizacao-figura';
import type { TextoFigura, AjustesFigura } from '@shared/types/imagem-laudo.types';

export type { AjustesFigura } from '@shared/types/imagem-laudo.types';

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

export { transformarFigura } from '@/lib/renderizacao-figura';

interface EditorFiguraDialogProps {
  aberto: boolean;
  origem: string;
  ajustesIniciais?: AjustesFigura;
  onAbertoChange: (aberto: boolean) => void;
  onAplicar: (dataUri: string, ajustes: AjustesFigura) => Promise<void> | void;
}

export function EditorFiguraDialog({ aberto, origem, ajustesIniciais, onAbertoChange, onAplicar }: EditorFiguraDialogProps) {
  const [ajustes, setAjustes] = useState<AjustesFigura>(AJUSTES_INICIAIS);
  const [previa, setPrevia] = useState(origem);
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null);
  const [ferramenta, setFerramenta] = useState<'ajustar' | 'texto'>('ajustar');
  const [textoSelecionadoId, setTextoSelecionadoId] = useState<string | null>(null);
  const [geometria, setGeometria] = useState<{ largura: number; altura: number; areas: AreaTextoFigura[] }>({ largura: 1, altura: 1, areas: [] });
  const campoTexto = useRef<HTMLTextAreaElement>(null);
  const arrasteTexto = useRef<{ id: string; inicio: Ponto; posicao: Ponto; ponteiroId: number } | null>(null);
  const [anguloDigitado, setAnguloDigitado] = useState('0');
  const digitandoAngulo = useRef(false);
  const focarTextoNovo = useRef(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const operacao = useRef<OperacaoCorte | null>(null);
  const corteAtual = useRef<CorteFigura>(CORTE_INTEIRO);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    const iniciais = ajustesIniciais ?? AJUSTES_INICIAIS;
    setAjustes({ ...iniciais, angulo: normalizarAnguloFigura(iniciais.angulo) });
    setAnguloDigitado(String(normalizarAnguloFigura(iniciais.angulo)));
    corteAtual.current = iniciais.corte;
    operacao.current = null;
    arrasteTexto.current = null;
    setFerramenta('ajustar');
    setTextoSelecionadoId(null);
    digitandoAngulo.current = false;
    focarTextoNovo.current = false;
    setPrevia('');
    setImagem(null);
    setErro('');
    void carregarImagemFigura(origem).then(carregada => {
      if (ativo) setImagem(carregada);
    }).catch(() => { if (ativo) setErro('Não foi possível carregar a imagem.'); });
    return () => { ativo = false; };
  }, [aberto, origem, ajustesIniciais]);

  useEffect(() => {
    if (!aberto || !imagem) return;
    const quadro = requestAnimationFrame(() => {
      try {
        const canvas = renderizarFigura(imagem, { ...ajustes, corte: ferramenta === 'texto' ? ajustes.corte : CORTE_INTEIRO }, 1280);
        const areas = ferramenta === 'texto' ? desenharTextosFigura(canvas, ajustes.textos ?? []) : [];
        setPrevia(canvas.toDataURL('image/png'));
        setGeometria({ largura: canvas.width, altura: canvas.height, areas });
        setErro('');
      } catch { setErro('Não foi possível mostrar a prévia.'); }
    });
    return () => cancelAnimationFrame(quadro);
  }, [aberto, imagem, ajustes, ferramenta]);

  useEffect(() => {
    if (focarTextoNovo.current && textoSelecionadoId && ferramenta === 'texto') {
      campoTexto.current?.focus();
      campoTexto.current?.select();
      focarTextoNovo.current = false;
    }
  }, [textoSelecionadoId, ferramenta]);

  useEffect(() => {
    if (!digitandoAngulo.current) setAnguloDigitado(String(ajustes.angulo));
  }, [ajustes.angulo]);

  const atualizarCorte = (corte: CorteFigura) => {
    corteAtual.current = corte;
    setAjustes(atual => ({ ...atual, corte }));
  };

  const pontoDoPonteiro = (evento: PointerEvent<SVGSVGElement>): Ponto => {
    return pontoPercentualFigura(evento.clientX, evento.clientY, evento.currentTarget.getBoundingClientRect());
  };

  const iniciarCorte = (evento: PointerEvent<SVGSVGElement>) => {
    if (evento.button !== 0 || operacao.current || salvando) return;
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
    setAjustes(atual => ({ ...atual, angulo: normalizarAnguloFigura(angulo) }));
  };
  const aplicar = async () => {
    setSalvando(true);
    setErro('');
    try {
      if (!imagem) throw new Error('Aguarde o carregamento da imagem.');
      const canvas = renderizarFigura(imagem, ajustes);
      if (ajustes.textos?.length) desenharTextosFigura(canvas, ajustes.textos);
      await onAplicar(canvas.toDataURL('image/png'), ajustes);
      onAbertoChange(false);
    }
    catch (falha) { setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar a figura.'); }
    finally { setSalvando(false); }
  };

  const textos = ajustes.textos ?? [];
  const textoSelecionado = textos.find(texto => texto.id === textoSelecionadoId);
  const atualizarTexto = (id: string, alteracoes: Partial<Omit<TextoFigura, 'id'>>) => {
    setAjustes(atual => ({ ...atual, textos: (atual.textos ?? []).map(texto => texto.id === id ? { ...texto, ...alteracoes } : texto) }));
  };
  const adicionarTexto = () => {
    if (textos.length >= 20) return;
    const id = crypto.randomUUID();
    focarTextoNovo.current = true;
    setAjustes(atual => ({ ...atual, textos: [...(atual.textos ?? []), { id, conteudo: 'Novo texto', x: 50, y: 50, tamanho: 'medio', cor: 'branco' }] }));
    setTextoSelecionadoId(id);
  };
  const excluirTexto = (id: string) => {
    setAjustes(atual => ({ ...atual, textos: (atual.textos ?? []).filter(texto => texto.id !== id) }));
    setTextoSelecionadoId(null);
  };
  const pontoTexto = (evento: PointerEvent<SVGRectElement>) => {
    const svg = evento.currentTarget.ownerSVGElement;
    return svg ? pontoPercentualFigura(evento.clientX, evento.clientY, svg.getBoundingClientRect()) : { x: 0, y: 0 };
  };
  const iniciarArrasteTexto = (evento: PointerEvent<SVGRectElement>, texto: TextoFigura) => {
    if (evento.button !== 0 || salvando) return;
    setTextoSelecionadoId(texto.id);
    arrasteTexto.current = { id: texto.id, inicio: pontoTexto(evento), posicao: { x: texto.x, y: texto.y }, ponteiroId: evento.pointerId };
    evento.currentTarget.setPointerCapture(evento.pointerId);
  };
  const moverTexto = (evento: PointerEvent<SVGRectElement>) => {
    const arraste = arrasteTexto.current;
    if (!arraste || arraste.ponteiroId !== evento.pointerId) return;
    const ponto = pontoTexto(evento);
    atualizarTexto(arraste.id, { x: limitar(arraste.posicao.x + ponto.x - arraste.inicio.x, 0, 100), y: limitar(arraste.posicao.y + ponto.y - arraste.inicio.y, 0, 100) });
  };
  const finalizarArrasteTexto = (evento: PointerEvent<SVGRectElement>, cancelar = false) => {
    const arraste = arrasteTexto.current;
    if (!arraste || arraste.ponteiroId !== evento.pointerId) return;
    if (cancelar) atualizarTexto(arraste.id, arraste.posicao);
    else moverTexto(evento);
    arrasteTexto.current = null;
    evento.currentTarget.releasePointerCapture(evento.pointerId);
  };

  const { corte } = ajustes;
  const temCorte = corte.x !== 0 || corte.y !== 0 || corte.largura !== 100 || corte.altura !== 100;
  const direita = corte.x + corte.largura;
  const inferior = corte.y + corte.altura;

  return <Dialog open={aberto} onOpenChange={valor => { if (!salvando) onAbertoChange(valor); }}>
    <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden" onKeyDown={evento => evento.stopPropagation()}>
      <DialogHeader className="shrink-0"><DialogTitle>Editar figura</DialogTitle><DialogDescription>Gire, recorte ou adicione textos. As alterações afetam somente esta figura; a imagem original é preservada.</DialogDescription></DialogHeader>
      <div className="min-h-0 overflow-y-auto pr-2">
      <fieldset disabled={salvando} className="min-w-0 space-y-4 disabled:pointer-events-none disabled:opacity-60">
      <div className="flex gap-2" role="group" aria-label="Ferramentas da figura">
        <Button type="button" variant={ferramenta === 'ajustar' ? 'default' : 'outline'} aria-pressed={ferramenta === 'ajustar'} onClick={() => setFerramenta('ajustar')}><SlidersHorizontal className="mr-2 size-4" />Ajustar imagem</Button>
        <Button type="button" variant={ferramenta === 'texto' ? 'default' : 'outline'} aria-pressed={ferramenta === 'texto'} onClick={() => setFerramenta('texto')}><Type className="mr-2 size-4" />Texto{textos.length > 0 ? ` (${textos.length})` : ''}</Button>
      </div>
      <p className="text-sm text-muted-foreground">{ferramenta === 'ajustar' ? 'Arraste sobre a imagem para recortar. Mova a seleção ou ajuste seus cantos.' : 'Adicione um texto e arraste para posicionar. Os textos permanecem legíveis ao girar ou espelhar a foto.'}</p>
      <div className="flex h-72 items-center justify-center overflow-hidden rounded-md border bg-muted sm:h-80">
        {!previa && <p role="status" className="text-sm text-muted-foreground">Preparando imagem…</p>}
        <div className="relative max-h-full max-w-full">
          <img src={previa || undefined} alt="Prévia da figura antes do recorte" className="block max-h-72 max-w-full object-contain sm:max-h-80" draggable={false} />
          {ferramenta === 'ajustar' && previa && <svg aria-label="Área de recorte da figura" className="absolute inset-0 size-full cursor-crosshair touch-none" viewBox="0 0 100 100" preserveAspectRatio="none" onPointerDown={iniciarCorte} onPointerMove={moverCorte} onPointerUp={finalizarCorte} onPointerCancel={cancelarCorte}>
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
          </svg>}
          {ferramenta === 'texto' && previa && <svg aria-label="Textos sobre a figura" className="absolute inset-0 size-full touch-none" viewBox={`0 0 ${geometria.largura} ${geometria.altura}`} preserveAspectRatio="none">
            {geometria.areas.map((area, indice) => {
              const texto = textos.find(item => item.id === area.id);
              if (!texto) return null;
              return <rect key={area.id} x={area.x} y={area.y} width={area.largura} height={area.altura} fill="transparent"
                className={textoSelecionadoId === area.id ? 'cursor-move stroke-primary' : 'cursor-move stroke-transparent'} strokeWidth="2" vectorEffect="non-scaling-stroke"
                role="button" tabIndex={salvando ? -1 : 0} aria-label={`Mover texto ${indice + 1}`} aria-pressed={textoSelecionadoId === area.id}
                onFocus={() => { if (!salvando) setTextoSelecionadoId(area.id); }}
                onPointerDown={evento => iniciarArrasteTexto(evento, texto)} onPointerMove={moverTexto}
                onPointerUp={evento => finalizarArrasteTexto(evento)} onPointerCancel={evento => finalizarArrasteTexto(evento, true)}
                onKeyDown={evento => {
                  if (salvando) return;
                  const passos: Record<string, Ponto> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
                  const passo = passos[evento.key];
                  if (passo) { evento.preventDefault(); atualizarTexto(area.id, { x: limitar(texto.x + passo.x, 0, 100), y: limitar(texto.y + passo.y, 0, 100) }); }
                  if (evento.key === 'Delete') { evento.preventDefault(); excluirTexto(area.id); }
                }} />;
            })}
          </svg>}
        </div>
      </div>
      {ferramenta === 'ajustar' ? <div className="space-y-4 rounded-lg border p-3">
        <div className="space-y-3">
          <p className="text-sm font-medium">Rotação</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => alterarAngulo(ajustes.angulo - 90)}><RotateCcw className="mr-2 size-4" />90° à esquerda</Button>
            <Button type="button" variant="outline" onClick={() => alterarAngulo(ajustes.angulo + 90)}><RotateCw className="mr-2 size-4" />90° à direita</Button>
            <Button type="button" variant="ghost" onClick={() => alterarAngulo(0)}>Zerar rotação</Button>
          </div>
          <div className="grid items-center gap-4 sm:grid-cols-[1fr_8rem]">
            <div className="space-y-2">
              <Slider aria-label="Rotação da imagem" min={-180} max={180} step={0.1} value={[ajustes.angulo]} onValueChange={valores => { if (valores[0] !== undefined) alterarAngulo(valores[0]); }} disabled={salvando} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>−180° · Esquerda</span><span>0°</span><span>Direita · +180°</span></div>
            </div>
            <label className="grid gap-1 text-sm">Ângulo (graus)<Input type="number" min={-180} max={180} step={0.1} value={anguloDigitado}
              onFocus={() => { digitandoAngulo.current = true; }}
              onBlur={() => { digitandoAngulo.current = false; setAnguloDigitado(String(ajustes.angulo)); }}
              onChange={evento => {
                setAnguloDigitado(evento.target.value);
                if (evento.target.value !== '' && Number.isFinite(evento.target.valueAsNumber)) alterarAngulo(evento.target.valueAsNumber);
              }} /></label>
          </div>
          <p className="text-xs text-muted-foreground">Girar redefine o recorte para a imagem inteira.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="mr-1 text-sm font-medium">Espelhamento</span>
          <Button type="button" variant={ajustes.espelharHorizontal ? 'secondary' : 'outline'} aria-pressed={ajustes.espelharHorizontal} onClick={() => setAjustes(atual => ({ ...atual, espelharHorizontal: !atual.espelharHorizontal }))}><FlipHorizontal2 className="mr-2 size-4" />Horizontal</Button>
          <Button type="button" variant={ajustes.espelharVertical ? 'secondary' : 'outline'} aria-pressed={ajustes.espelharVertical} onClick={() => setAjustes(atual => ({ ...atual, espelharVertical: !atual.espelharVertical }))}><FlipVertical2 className="mr-2 size-4" />Vertical</Button>
          {temCorte && <Button type="button" variant="outline" onClick={() => atualizarCorte(CORTE_INTEIRO)}><Crop className="mr-2 size-4" />Remover recorte</Button>}
        </div>
      </div> : <div className="space-y-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={adicionarTexto} disabled={textos.length >= 20 || !imagem}><Plus className="mr-2 size-4" />Adicionar texto</Button>
          <span className="text-xs text-muted-foreground">{textos.length}/20 textos</span>
          {textos.map((texto, indice) => <Button key={texto.id} type="button" size="sm" variant={textoSelecionadoId === texto.id ? 'secondary' : 'ghost'} aria-pressed={textoSelecionadoId === texto.id} onClick={() => setTextoSelecionadoId(texto.id)}>Texto {indice + 1}</Button>)}
        </div>
        {textoSelecionado ? <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <label className="grid gap-1 text-sm">Conteúdo do texto<Textarea ref={campoTexto} maxLength={500} rows={3} value={textoSelecionado.conteudo} onChange={evento => atualizarTexto(textoSelecionado.id, { conteudo: evento.target.value })} /><span className="text-xs text-muted-foreground">{textoSelecionado.conteudo.length}/500 caracteres</span></label>
          <div className="space-y-2">
            <label className="grid gap-1 text-sm">Tamanho<select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={textoSelecionado.tamanho} onChange={evento => {
              const tamanho = evento.target.value;
              if (tamanho === 'pequeno' || tamanho === 'medio' || tamanho === 'grande') atualizarTexto(textoSelecionado.id, { tamanho });
            }}><option value="pequeno">Pequeno</option><option value="medio">Médio</option><option value="grande">Grande</option></select></label>
            <label className="grid gap-1 text-sm">Cor<select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={textoSelecionado.cor} onChange={evento => {
              const cor = evento.target.value;
              if (cor === 'branco' || cor === 'preto' || cor === 'vermelho' || cor === 'amarelo' || cor === 'azul') atualizarTexto(textoSelecionado.id, { cor });
            }}><option value="branco">Branco</option><option value="preto">Preto</option><option value="vermelho">Vermelho</option><option value="amarelo">Amarelo</option><option value="azul">Azul</option></select></label>
            <Button type="button" variant="ghost" size="sm" onClick={() => excluirTexto(textoSelecionado.id)}><Trash2 className="mr-2 size-4" />Excluir texto</Button>
          </div>
        </div> : <p className="text-sm text-muted-foreground">Adicione um texto ou selecione uma anotação para editar. Use as setas do teclado sobre a anotação para mover.</p>}
      </div>}
      <Button type="button" variant="ghost" onClick={() => { setAjustes(AJUSTES_INICIAIS); atualizarCorte(CORTE_INTEIRO); setTextoSelecionadoId(null); }}><Undo2 className="mr-2 size-4" />Restaurar imagem</Button>
      </fieldset>
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <DialogFooter className="shrink-0 border-t pt-3"><Button variant="outline" disabled={salvando} onClick={() => onAbertoChange(false)}>Cancelar</Button><Button onClick={() => void aplicar()} disabled={salvando || !imagem || !previa}>{salvando ? 'Aplicando…' : 'Aplicar ajustes'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
