import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  Maximize2,
  Info,
  Plus,
  Image as ImageIcon,
  ListChecks,
  ExternalLink,
  RefreshCw,
  Minus,
  Search,
  SearchX,
  ImageDown,
  Sparkles,
  ChevronsRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import Lightbox, { stopNavigationEventsPropagation } from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/counter.css";
import { toast } from 'sonner';
import { Lens } from '@/components/ui/lens';
import { GdlImagensRepModal } from '@/components/laudo/GdlImagensRepModal';
import { SeletorFiguraDialog } from '@/components/laudo/SeletorFiguraDialog';
import { PreencherDummiesDialog } from '@/components/laudo/PreencherDummiesDialog';
import type { ImagemRepGdlAdicionadaAoLaudo } from '@shared/types/gdl-arquivos.types';
import type { ImagemLaudoResumo } from '@shared/types/imagem-laudo.types';

const MINIATURAS_POR_LOTE = 30;
const MINIATURA_PENDENTE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

function generateThumbnail(dataUri: string, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas indisponível')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = dataUri;
  });
}

export interface ImagemLaudo {
  id: string;
  url: string;
  thumbnailUrl: string;
  legenda: string;
  numero_figura: number;
  sequencia: number;
  created_at: string;
  dummy?: boolean;
  origem?: 'gdl';
  sha256?: string;
  nomeArquivo?: string;
}

async function criarImagemLaudo(
  dataUri: string,
  legenda = '',
  origem?: 'gdl',
  sha256?: string,
  id: string = crypto.randomUUID(),
  nomeArquivo = 'imagem',
): Promise<ImagemLaudo> {
  return {
    id, url: dataUri, thumbnailUrl: await generateThumbnail(dataUri, 300), legenda,
    numero_figura: 0, sequencia: 0, created_at: new Date().toISOString(), origem, sha256, nomeArquivo,
  };
}

function sugerirLegenda(nomeArquivo: string): string {
  return nomeArquivo.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

interface IlustracoesPanelProps {
  laudoId: string;
  onInsertImage: (imageUrl: string, imageId: string, legenda: string) => void;
  onInsertAll?: (imagens: ImagemLaudo[]) => void;
  onDeleteImage?: (imageId: string) => void;
  onReorder?: (imagens: ImagemLaudo[]) => void;
  onRefreshHtml: () => void;
  /** Lista de figuras já existentes no editor (extraídas do HTML pelo LaudosPage) */
  figurasNoEditor?: ImagemLaudo[];
  /** Callback quando o painel altera a legenda de uma figura existente no editor */
  onUpdateLegendaInEditor?: (id: string, legenda: string) => void;
  syncEnabled?: boolean;
  figuraAtivaId?: string | null;
  onSyncToggle?: (enabled: boolean) => void;
  onScrollToFigure?: (imageId: string) => void;
  onPopOut?: () => void;
  onRecolher?: () => void;
  onFechar?: () => void;
  onReplaceImage?: (imageId: string, imagem: ImagemLaudo) => void;
  onGerarLegenda?: (imageId: string) => Promise<string | null>;
  figuraSubstituicaoSolicitada?: string | null;
  onFiguraSubstituicaoSolicitadaConsumida?: () => void;
}

interface SortableItemProps {
  imagem: ImagemLaudo;
  onDelete: (id: string) => void;
  onUpdateLegenda: (id: string, novaLegenda: string) => void;
  onInsert: (img: ImagemLaudo) => void;
  onPreview: (index: number) => void;
  index: number;
}

const SortableItem: React.FC<SortableItemProps> = ({
  imagem,
  onDelete,
  onUpdateLegenda,
  onInsert,
  onPreview,
  index
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: imagem.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const [legenda, setLegenda] = useState(imagem.legenda);

  // Debounce para salvar legenda
  useEffect(() => {
    if (legenda === imagem.legenda) return;
    const timer = setTimeout(() => {
      onUpdateLegenda(imagem.id, legenda);
    }, 600);
    return () => clearTimeout(timer);
  }, [legenda, imagem.id, onUpdateLegenda, imagem.legenda]);

  return (
    <div ref={setNodeRef} style={style} className="group relative bg-card border rounded-lg p-2 mb-2 hover:shadow-sm transition-shadow">
      <div className="flex gap-3">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        >
          <GripVertical size={18} />
        </div>

        <div className="relative h-20 w-20 flex-shrink-0 bg-muted rounded overflow-hidden border">
          <img
            src={imagem.thumbnailUrl}
            alt={imagem.legenda}
            className="h-full w-full object-cover cursor-pointer hover:scale-105 transition-transform"
            onClick={() => onPreview(index)}
          />
        </div>

        <div className="flex-1 flex flex-col justify-between min-w-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Input
                    value={legenda}
                    onChange={(e) => setLegenda(e.target.value)}
                    className="h-8 text-xs bg-transparent border-transparent hover:border-input focus:bg-background pr-7"
                    placeholder="Descreva a figura..."
                  />
                  {imagem.origem === 'gdl' && <Badge variant="secondary" className="absolute right-1 top-1 h-5 text-[9px]">GDL</Badge>}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] text-xs">
                Descreva a figura para identificação no laudo. A numeração (Figura 01, 02...) é gerada automaticamente.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex justify-end gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => onInsert(imagem)}>
                    <Plus size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Inserir no laudo</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPreview(index)}>
                    <Maximize2 size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ampliar</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(imagem.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Excluir permanentemente</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FiguraEditorItemProps {
  imagem: ImagemLaudo;
  index: number;
  ativo?: boolean;
  onDelete: (id: string) => void;
  onUpdateLegenda: (id: string, legenda: string) => void;
  onPreview: () => void;
  onScrollToFigure?: (id: string) => void;
  onReplaceImage?: (id: string) => void;
  onGerarLegenda?: (id: string) => Promise<string | null>;
}

const FiguraEditorItem: React.FC<FiguraEditorItemProps> = ({
  imagem,
  index,
  ativo = false,
  onDelete,
  onUpdateLegenda,
  onPreview,
  onScrollToFigure,
  onReplaceImage,
  onGerarLegenda,
}) => {
  const [legenda, setLegenda] = useState(imagem.legenda);
  const [gerandoLegenda, setGerandoLegenda] = useState(false);
  const onUpdateLegendaRef = useRef(onUpdateLegenda);

  useEffect(() => {
    setLegenda(imagem.legenda);
  }, [imagem.legenda]);
  onUpdateLegendaRef.current = onUpdateLegenda;
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ativo && itemRef.current) {
      const item = itemRef.current;
      const lista = item.parentElement;
      if (!lista) return;

      const limitesItem = item.getBoundingClientRect();
      const limitesLista = lista.getBoundingClientRect();
      if (limitesItem.top < limitesLista.top) {
        lista.scrollTo({
          top: lista.scrollTop - (limitesLista.top - limitesItem.top),
          behavior: 'smooth',
        });
      } else if (limitesItem.bottom > limitesLista.bottom) {
        lista.scrollTo({
          top: lista.scrollTop + (limitesItem.bottom - limitesLista.bottom),
          behavior: 'smooth',
        });
      }
    }
  }, [ativo]);

  useEffect(() => {
    if (legenda === imagem.legenda) return;
    const timer = setTimeout(() => {
      onUpdateLegendaRef.current(imagem.id, legenda);
    }, 600);
    return () => clearTimeout(timer);
  }, [legenda, imagem.id, imagem.legenda]);

  return (
    <div
      ref={itemRef}
      className={`flex items-center gap-2 bg-muted/30 rounded-lg p-2 border transition-all ${
        ativo ? 'ring-2 ring-primary border-primary/50 bg-primary/5' : 'border-border/50'
      }`}
    >
      <div className="w-12 h-12 rounded overflow-hidden shrink-0 bg-muted flex items-center justify-center relative cursor-pointer group/thumb"
        onClick={() => onScrollToFigure?.(imagem.id)}
        title="Clique para localizar no editor"
      >
        <img
          src={imagem.thumbnailUrl || imagem.url}
          alt={imagem.legenda}
          className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <Badge
          className="absolute top-0 left-0 h-4 px-1 text-[9px] rounded-none rounded-br"
          variant="secondary"
          aria-label={imagem.dummy ? `Figura ${index + 1}, exemplo` : `Figura ${index + 1}`}
        >
          {`Fig. ${index + 1}`}
        </Badge>
      </div>
      <div className="flex-1 min-w-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <input
                type="text"
                value={legenda}
                onChange={(e) => setLegenda(e.target.value)}
                placeholder="Descreva a figura..."
                className="w-full bg-transparent text-xs border-none outline-none p-0 text-foreground placeholder:text-muted-foreground/50 truncate"
              />
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="text-xs max-w-[250px]">
              A numeração (Figura 01, 02...) é gerada automaticamente
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {!imagem.dummy && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onPreview}
          title="Ampliar"
        >
          <Maximize2 size={14} />
        </Button>
      )}
      {onGerarLegenda && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-primary hover:text-primary"
          onClick={() => void (async () => {
            setGerandoLegenda(true);
            try {
              const novaLegenda = await onGerarLegenda(imagem.id);
              if (novaLegenda) setLegenda(novaLegenda);
            } finally {
              setGerandoLegenda(false);
            }
          })()}
          disabled={gerandoLegenda}
          title="Gerar legenda com IA"
        >
          <Sparkles size={14} className={gerandoLegenda ? 'animate-pulse' : undefined} />
        </Button>
      )}
      {onReplaceImage && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-primary hover:text-primary"
          onClick={() => onReplaceImage(imagem.id)}
          title="Substituir figura"
        >
          <RefreshCw size={14} />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => {
          if (confirm('Deseja remover esta figura do laudo?')) {
            onDelete(imagem.id);
          }
        }}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
};

export const IlustracoesPanel: React.FC<IlustracoesPanelProps> = ({
  laudoId,
  onInsertImage,
  onInsertAll,
  onDeleteImage,
  onReorder,
  onRefreshHtml,
  figurasNoEditor,
  onUpdateLegendaInEditor,
  syncEnabled: _syncEnabled,
  figuraAtivaId,
  onSyncToggle: _onSyncToggle,
  onScrollToFigure,
  onPopOut,
  onRecolher,
  onFechar,
  onReplaceImage,
  onGerarLegenda,
  figuraSubstituicaoSolicitada,
  onFiguraSubstituicaoSolicitadaConsumida,
}) => {
  const [imagens, setImagens] = useState<ImagemLaudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalGdlAberto, setModalGdlAberto] = useState(false);
  const [figuraSubstituicaoId, setFiguraSubstituicaoId] = useState<string | null>(null);
  const [imagemSubstituicaoId, setImagemSubstituicaoId] = useState<string | null>(null);
  const [seletorSubstituicaoAberto, setSeletorSubstituicaoAberto] = useState(false);
  const [preenchimentoDummiesAberto, setPreenchimentoDummiesAberto] = useState(false);

  useEffect(() => {
    if (!figuraSubstituicaoSolicitada) return;
    setImagemSubstituicaoId(null);
    setFiguraSubstituicaoId(figuraSubstituicaoSolicitada);
    setSeletorSubstituicaoAberto(true);
    onFiguraSubstituicaoSolicitadaConsumida?.();
  }, [figuraSubstituicaoSolicitada, onFiguraSubstituicaoSolicitadaConsumida]);
  const hashesGdlCapturados = useRef(new Set<string>());

  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [imagensEmVisualizacao, setImagensEmVisualizacao] = useState<ImagemLaudo[]>([]);
  const [lightboxEditorIndex, setLightboxEditorIndex] = useState(-1);

  const [lensZoom, setLensZoom] = useState(2);
  const [lensSize, setLensSize] = useState(250);
  const [lensOn, setLensOn] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    void (async () => {
      const reconciliacao = await window.ipcAPI.ilustracoes.reconciliarImagens(laudoId);
      if (!reconciliacao.success) throw new Error(reconciliacao.error || 'Não foi possível verificar as imagens do laudo.');
      if (!cancelado && reconciliacao.data?.recuperadasParaPainel) {
        toast.info(`${reconciliacao.data.recuperadasParaPainel} imagem(ns) recuperada(s) para o painel.`);
      }
      if (!cancelado && reconciliacao.data?.arquivosAusentes) {
        toast.warning(`${reconciliacao.data.arquivosAusentes} imagem(ns) não está(ão) disponível(is) no armazenamento local.`);
      }
      const resultado = await window.ipcAPI.ilustracoes.listarImagens(laudoId);
      if (!resultado.success || !resultado.data) throw new Error(resultado.error || 'Não foi possível carregar as imagens do laudo.');
      const carregadas: ImagemLaudo[] = resultado.data.map((imagem: ImagemLaudoResumo) => ({
        id: imagem.id,
        url: '',
        thumbnailUrl: MINIATURA_PENDENTE,
        legenda: imagem.legenda,
        numero_figura: imagem.sequencia,
        sequencia: imagem.sequencia,
        created_at: imagem.createdAt,
        origem: imagem.origem === 'gdl' ? 'gdl' : undefined,
        sha256: imagem.sha256,
        nomeArquivo: imagem.nomeArquivo,
      }));
      const primeirosIds = carregadas.slice(0, MINIATURAS_POR_LOTE).map(imagem => imagem.id);
      const miniaturas = primeirosIds.length > 0
        ? await window.ipcAPI.ilustracoes.obterMiniaturas(laudoId, primeirosIds)
        : { success: true, data: [] };
      if (!miniaturas.success) throw new Error(miniaturas.error || 'Não foi possível carregar as miniaturas das imagens.');
      const miniaturasPorId = new Map((miniaturas.data || []).map(miniatura => [miniatura.id, miniatura.thumbnailDataUri]));
      if (cancelado) return;
      setImagens(carregadas.map(imagem => ({ ...imagem, thumbnailUrl: miniaturasPorId.get(imagem.id) || imagem.thumbnailUrl })));
      hashesGdlCapturados.current = new Set(
        carregadas.flatMap(imagem => imagem.origem === 'gdl' && imagem.sha256 ? [imagem.sha256] : []),
      );
    })().catch((error: unknown) => {
      if (cancelado) return;
      setImagens([]);
      hashesGdlCapturados.current.clear();
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as imagens do laudo.');
    }).finally(() => {
      if (!cancelado) setLoading(false);
    });
    return () => { cancelado = true; };
  }, [laudoId]);

  const carregarMiniaturas = async (ids: string[]) => {
    if (ids.length === 0) return;
    const resultado = await window.ipcAPI.ilustracoes.obterMiniaturas(laudoId, ids);
    if (!resultado.success) {
      toast.error(resultado.error || 'Não foi possível carregar as próximas miniaturas.');
      return;
    }
    const miniaturasPorId = new Map((resultado.data || []).map(miniatura => [miniatura.id, miniatura.thumbnailDataUri]));
    setImagens(atuais => atuais.map(imagem => ({
      ...imagem,
      thumbnailUrl: miniaturasPorId.get(imagem.id) || imagem.thumbnailUrl,
    })));
  };

  const carregarMiniaturasPendentes = async () => {
    const ids = imagens
      .filter(imagem => imagem.thumbnailUrl === MINIATURA_PENDENTE)
      .slice(0, MINIATURAS_POR_LOTE)
      .map(imagem => imagem.id);
    await carregarMiniaturas(ids);
  };

  const carregarImagemCompleta = async (imagem: ImagemLaudo): Promise<ImagemLaudo> => {
    if (imagem.url) return imagem;
    const resultado = await window.ipcAPI.ilustracoes.obterImagem(laudoId, imagem.id);
    if (!resultado.success || !resultado.data) throw new Error(resultado.error || 'Não foi possível carregar a imagem.');
    const carregada = { ...imagem, url: resultado.data.dataUri };
    setImagens(atuais => atuais.map(item => item.id === imagem.id ? carregada : item));
    return carregada;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = imagens.findIndex((i) => i.id === active.id);
      const newIndex = imagens.findIndex((i) => i.id === over.id);
      const newArray = arrayMove(imagens, oldIndex, newIndex);
      const reindexed = newArray.map((img, idx) => ({ ...img, sequencia: idx + 1, numero_figura: idx + 1 }));
      setImagens(reindexed);
      void window.ipcAPI.ilustracoes.atualizarOrdem(laudoId, reindexed.map(imagem => ({ id: imagem.id, sequencia: imagem.sequencia })));
      onReorder?.(reindexed);
      onRefreshHtml();
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    let proximaSequencia = imagens.length + 1;
    const novasImagens: ImagemLaudo[] = [];
    for (const file of Array.from(files)) {
      try {
        const dataUri = await readFileAsDataUri(file);
        const novaImagem = await criarImagemLaudo(dataUri, '', undefined, undefined, undefined, file.name);
        novaImagem.numero_figura = proximaSequencia;
        novaImagem.sequencia = proximaSequencia;
        const resultado = await window.ipcAPI.ilustracoes.salvarImagem(laudoId, {
          id: novaImagem.id,
          nomeArquivo: file.name,
          dataUri,
          legenda: novaImagem.legenda,
          origem: 'local',
          sequencia: proximaSequencia,
        });
        if (!resultado.success) throw new Error(resultado.error || 'Não foi possível armazenar a imagem.');
        novasImagens.push(novaImagem);
        proximaSequencia += 1;
      } catch (error) {
        toast.error(error instanceof Error ? `${file.name}: ${error.message}` : `Erro ao carregar ${file.name}`);
      }
    }
    if (novasImagens.length > 0) setImagens(prev => [...prev, ...novasImagens]);
    e.target.value = '';
  };

  const handleImagensGdlCapturadas = (capturadas: ImagemRepGdlAdicionadaAoLaudo[], permitirDuplicadas: boolean) => {
    const novasImagens: ImagemLaudo[] = [];
    for (const capturada of capturadas) {
      if (!permitirDuplicadas && hashesGdlCapturados.current.has(capturada.sha256)) continue;
      novasImagens.push({
        id: capturada.imagemId,
        url: '',
        thumbnailUrl: MINIATURA_PENDENTE,
        legenda: sugerirLegenda(capturada.nomeArquivo),
        numero_figura: capturada.sequencia,
        sequencia: capturada.sequencia,
        created_at: new Date().toISOString(),
        origem: 'gdl',
        sha256: capturada.sha256,
        nomeArquivo: capturada.nomeArquivo,
      });
      hashesGdlCapturados.current.add(capturada.sha256);
    }
    if (novasImagens.length === 0 && capturadas.length > 0) {
      toast.info('As imagens selecionadas já foram adicionadas neste painel.');
      return;
    }
    setImagens(prev => [...prev, ...novasImagens]);
    void carregarMiniaturas(novasImagens.map(imagem => imagem.id));
    if (figuraSubstituicaoId && novasImagens[0]) {
      setImagemSubstituicaoId(novasImagens[0].id);
      setSeletorSubstituicaoAberto(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir permanentemente esta imagem?')) return;
    const removida = imagens.find(imagem => imagem.id === id);
    const resultado = await window.ipcAPI.ilustracoes.excluirImagem(laudoId, id);
    if (!resultado.success) {
      toast.error(resultado.error || 'Não foi possível excluir a imagem.');
      return;
    }
    const restantes = imagens
      .filter(img => img.id !== id)
      .map((img, idx) => ({ ...img, sequencia: idx + 1, numero_figura: idx + 1 }));
    setImagens(restantes);
    if (removida?.origem === 'gdl' && removida.sha256) hashesGdlCapturados.current.delete(removida.sha256);
    void window.ipcAPI.ilustracoes.atualizarOrdem(laudoId, restantes.map(imagem => ({ id: imagem.id, sequencia: imagem.sequencia })));
    onDeleteImage?.(id);
  };

  const handleUpdateLegenda = (id: string, legenda: string) => {
    setImagens(prev => prev.map(img => img.id === id ? { ...img, legenda } : img));
    void window.ipcAPI.ilustracoes.atualizarLegenda(laudoId, id, legenda).then(resultado => {
      if (!resultado.success) toast.error(resultado.error || 'Não foi possível salvar a legenda.');
    });
  };

  const arquivarImagensInseridas = async (ids: string[]) => {
    const resultados = await Promise.all(ids.map(id => window.ipcAPI.ilustracoes.arquivarImagem(laudoId, id)));
    const falha = resultados.find(resultado => !resultado.success);
    if (falha) toast.error(falha.error || 'Não foi possível arquivar as imagens inseridas.');
  };

  const handleDeleteFiguraEditor = (id: string) => {
    void window.ipcAPI.ilustracoes.excluirImagem(laudoId, id).then(resultado => {
      if (!resultado.success) toast.error(resultado.error || 'Não foi possível excluir o arquivo da figura.');
    });
    onDeleteImage?.(id);
  };

  const handleInsertAll = async () => {
    if (!onInsertAll || imagens.length === 0) return;
    if (imagens.length > MINIATURAS_POR_LOTE && !confirm(`Inserir ${imagens.length} imagens pode consumir muita memória no editor. Deseja continuar?`)) return;
    try {
      const completas: ImagemLaudo[] = [];
      for (const imagem of imagens) completas.push(await carregarImagemCompleta(imagem));
      onInsertAll(completas);
      void arquivarImagensInseridas(completas.map(imagem => imagem.id));
      setImagens([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível preparar as imagens para inserção.');
    }
  };

  const filteredImagens = [...imagens]
    .sort((a, b) => a.sequencia - b.sequencia);
  const figurasReaisNoEditor = (figurasNoEditor || []).filter(figura => !figura.dummy);

  const abrirCarrosselImagens = (imagemId: string) => {
    const imagensReais = filteredImagens.filter(imagem => !imagem.dummy);
    const indice = imagensReais.findIndex(imagem => imagem.id === imagemId);
    if (indice < 0) return;

    void Promise.all(imagensReais.map(carregarImagemCompleta)).then(carregadas => {
      setImagensEmVisualizacao(carregadas);
      setLightboxIndex(indice);
    }).catch(error => toast.error(error instanceof Error ? error.message : 'Não foi possível abrir as imagens.'));
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-y border-border/80 bg-muted/20">
      <div className="relative shrink-0 space-y-3 border-b bg-background p-4">
        <h2 className="flex min-w-0 items-center gap-2 pr-24 text-base font-semibold">
          <ImageIcon className="size-4 shrink-0 text-primary" />
          <span className="truncate">Painel de Ilustrações</span>
        </h2>

        {(onPopOut || onRecolher || onFechar) && (
          <div className="absolute right-3 top-3 flex items-center gap-1">
            <TooltipProvider>
              {onRecolher && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRecolher} aria-label="Recolher painel de ilustrações">
                      <ChevronsRight size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Recolher painel</TooltipContent>
                </Tooltip>
              )}
              {onPopOut && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPopOut} aria-label="Destacar painel de ilustrações">
                    <ExternalLink size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir em janela separada</TooltipContent>
              </Tooltip>
              )}
              {onFechar && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onFechar} aria-label="Fechar painel de ilustrações">
                      <X size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Fechar painel</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Carregados</span>
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px] rounded-full">{imagens.length}</Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info size={12} className="text-muted-foreground/50 cursor-help hover:text-muted-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-xs">
                Imagens carregadas neste painel. Arraste para reordenar. Use o botão <strong>+</strong> para inserir individualmente ou <strong>Inserir Todas</strong> para incluir todas de uma vez no laudo.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <TooltipProvider delayDuration={200}>
          <div className="grid grid-cols-3 gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="h-14 min-w-0 flex-col gap-1 px-2" variant="outline" asChild>
                  <label className="cursor-pointer" aria-label="Carregar imagens">
                    <Plus size={16} className="shrink-0" />
                    <span className="whitespace-nowrap text-xs font-medium">Carregar</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
                  </label>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Carregar imagens localmente</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="h-14 min-w-0 flex-col gap-1 px-2" variant="outline" onClick={() => setModalGdlAberto(true)} aria-label="Buscar imagens da REP">
                  <ImageDown size={16} className="shrink-0" />
                  <span className="whitespace-nowrap text-xs font-medium">Buscar REP</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Buscar imagens da REP</TooltipContent>
            </Tooltip>

            {onInsertAll && imagens.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" className="h-14 min-w-0 flex-col gap-1 px-2" onClick={() => { void handleInsertAll(); }} aria-label="Inserir todas as imagens no laudo">
                    <ImageIcon size={16} className="shrink-0" />
                    <span className="whitespace-nowrap text-xs font-medium">Inserir</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Inserir todas as imagens no laudo</TooltipContent>
              </Tooltip>
            ) : (
              <div aria-hidden="true" />
            )}
          </div>
        </TooltipProvider>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {loading ? (
          <div className="text-center py-10 text-xs text-muted-foreground">Carregando...</div>
        ) : filteredImagens.length === 0 ? (
          <div className="text-center py-20 text-xs text-muted-foreground border-2 border-dashed rounded-lg">
            Nenhuma imagem carregada.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={filteredImagens.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <AnimatePresence>
                {filteredImagens.map((img, idx) => (
                  <motion.div
                    key={img.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <SortableItem
                      imagem={img}
                      index={idx}
                      onDelete={handleDelete}
                      onUpdateLegenda={handleUpdateLegenda}
                      onInsert={img => {
                        void carregarImagemCompleta(img).then(carregada => {
                          onInsertImage(carregada.url, carregada.id, carregada.legenda);
                          void arquivarImagensInseridas([carregada.id]);
                          if (carregada.origem === 'gdl' && carregada.sha256) hashesGdlCapturados.current.delete(carregada.sha256);
                          setImagens(prev =>
                            prev.filter(i => i.id !== carregada.id).map((i, idx) => ({ ...i, sequencia: idx + 1, numero_figura: idx + 1 }))
                          );
                        }).catch(error => toast.error(error instanceof Error ? error.message : 'Não foi possível preparar a imagem.'));
                      }}
                      onPreview={index => {
                        const imagem = filteredImagens[index];
                        if (imagem) abrirCarrosselImagens(imagem.id);
                      }}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </SortableContext>
          </DndContext>
        )}
        {imagens.some(imagem => imagem.thumbnailUrl === MINIATURA_PENDENTE) && (
          <Button variant="outline" className="mt-3 w-full" onClick={() => { void carregarMiniaturasPendentes(); }}>
            Carregar próximas miniaturas
          </Button>
        )}
      </div>

      {/* ─── Figuras já existentes no editor ─── */}
      {figurasNoEditor && figurasNoEditor.length > 0 && (
        <div className="border-t pt-3">
          <div className="flex items-center gap-1.5 px-4 mb-2">
            <span className="text-xs font-medium text-muted-foreground">Figuras no Laudo</span>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] rounded-full">{figurasNoEditor.length}</Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info size={12} className="text-muted-foreground/50 cursor-help hover:text-muted-foreground transition-colors" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-xs">
                  Figuras já inseridas no editor do laudo. Clique na miniatura para localizar a figura no texto. O destaque azul indica a figura atualmente visível no editor.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="px-4 mb-3">
            {figurasNoEditor.some(figura => figura.dummy) && filteredImagens.length > 0 && (
              <Button variant="secondary" className="mb-2 w-full gap-2" onClick={() => setPreenchimentoDummiesAberto(true)}>
                <ListChecks size={16} /> Preencher figuras do template
              </Button>
            )}
            <Button variant="outline" className="w-full gap-2" onClick={() => {
              onRefreshHtml();
              toast.success('Figuras atualizadas e renumeradas');
            }}>
              <ListChecks size={16} /> Atualizar Figuras
            </Button>
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar px-4">
            {figurasNoEditor.map((fig, idx) => (
              <FiguraEditorItem
                key={fig.id}
                imagem={fig}
                index={idx}
                ativo={fig.id === figuraAtivaId}
                onDelete={handleDeleteFiguraEditor}
                onUpdateLegenda={onUpdateLegendaInEditor || (() => {})}
                onPreview={() => setLightboxEditorIndex(figurasReaisNoEditor.findIndex(figura => figura.id === fig.id))}
                onScrollToFigure={onScrollToFigure}
                onReplaceImage={(id) => {
                  setImagemSubstituicaoId(null);
                  setFiguraSubstituicaoId(id);
                  setSeletorSubstituicaoAberto(true);
                }}
                onGerarLegenda={onGerarLegenda}
              />
            ))}
          </div>
        </div>
      )}

      <div className="shrink-0 border-t bg-background px-4 py-3">
        <p className="text-[10px] text-muted-foreground">
          Revise as imagens e legendas antes de inseri-las no laudo.
        </p>
      </div>

      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={() => { setLightboxIndex(-1); setImagensEmVisualizacao([]); }}
        slides={imagensEmVisualizacao.map(imagem => ({
          src: imagem.url,
          description: imagem.legenda || undefined,
        }))}
        plugins={[Zoom, Captions, Counter]}
        styles={{ toolbar: { top: '44px' } }}
        captions={{ descriptionTextAlign: 'center' }}
      />

      <GdlImagensRepModal
        aberto={modalGdlAberto}
        laudoId={laudoId}
        onAbertoChange={setModalGdlAberto}
        onCapturadas={(imagensCapturadas, permitirDuplicadas) => { handleImagensGdlCapturadas(imagensCapturadas, permitirDuplicadas); }}
      />

      <SeletorFiguraDialog
        aberto={seletorSubstituicaoAberto}
        figuraAlvo={figurasNoEditor?.find(figura => figura.id === figuraSubstituicaoId) || null}
        imagens={filteredImagens}
        imagemSelecionadaId={imagemSubstituicaoId}
        onAbertoChange={(aberto) => { setSeletorSubstituicaoAberto(aberto); if (!aberto) { setFiguraSubstituicaoId(null); setImagemSubstituicaoId(null); } }}
        onSelecionar={setImagemSubstituicaoId}
        onBuscarGdl={() => { setSeletorSubstituicaoAberto(false); setModalGdlAberto(true); }}
        onGerarLegenda={onGerarLegenda}
        onConfirmar={(legenda) => {
          const imagem = filteredImagens.find(item => item.id === imagemSubstituicaoId);
          if (!figuraSubstituicaoId || !imagem) return;
          void carregarImagemCompleta(imagem).then(carregada => {
            onReplaceImage?.(figuraSubstituicaoId, carregada);
            onUpdateLegendaInEditor?.(carregada.id, legenda);
            void window.ipcAPI.ilustracoes.atualizarLegenda(laudoId, carregada.id, legenda).then(resultado => {
              if (!resultado.success) toast.error(resultado.error || 'Não foi possível salvar a legenda da figura.');
            });
            void arquivarImagensInseridas([carregada.id]);
            if (carregada.origem === 'gdl' && carregada.sha256) hashesGdlCapturados.current.delete(carregada.sha256);
            setImagens(prev => prev.filter(item => item.id !== carregada.id).map((item, indice) => ({ ...item, sequencia: indice + 1, numero_figura: indice + 1 })));
            setFiguraSubstituicaoId(null);
            setImagemSubstituicaoId(null);
            setSeletorSubstituicaoAberto(false);
          }).catch(error => toast.error(error instanceof Error ? error.message : 'Não foi possível preparar a imagem.'));
        }}
      />

      <PreencherDummiesDialog
        aberto={preenchimentoDummiesAberto}
        dummies={(figurasNoEditor || []).filter(figura => figura.dummy)}
        imagens={filteredImagens}
        onAbertoChange={setPreenchimentoDummiesAberto}
        onConfirmar={(associacoes) => {
          const imagensPorId = new Map(filteredImagens.map(imagem => [imagem.id, imagem]));
          void (async () => {
            const usadas: ImagemLaudo[] = [];
            for (const associacao of associacoes) {
              const imagem = imagensPorId.get(associacao.imagemId);
              if (!imagem) continue;
              const carregada = await carregarImagemCompleta(imagem);
              onReplaceImage?.(associacao.figuraId, carregada);
              usadas.push(carregada);
            }
            if (usadas.length === 0) return;
            void arquivarImagensInseridas(usadas.map(imagem => imagem.id));
            setImagens(prev => prev.filter(imagem => !usadas.some(usada => usada.id === imagem.id)).map((imagem, indice) => ({ ...imagem, sequencia: indice + 1, numero_figura: indice + 1 })));
            setPreenchimentoDummiesAberto(false);
            toast.success(`${usadas.length} figura(s) substituída(s)`);
          })().catch(error => toast.error(error instanceof Error ? error.message : 'Não foi possível preparar as imagens.'));
        }}
      />

      {figurasNoEditor && figurasNoEditor.length > 0 && (
        <Lightbox
          open={lightboxEditorIndex >= 0}
          index={lightboxEditorIndex}
          close={() => setLightboxEditorIndex(-1)}
          slides={figurasReaisNoEditor.map(img => {
            const num = img.numero_figura.toString().padStart(2, '0')
            return { src: img.url, description: img.legenda ? `Figura ${num}: ${img.legenda}` : `Figura ${num}` }
          })}
          plugins={[Captions, Counter]}
          styles={{ toolbar: { top: '44px' } }}
          captions={{ descriptionTextAlign: "center" }}
          render={{
            slide: ({ slide, offset, rect }) => {
              if (offset !== 0) return undefined
              const imgEl = (
                <img src={slide.src} alt=""
                  style={{ maxWidth: rect.width, maxHeight: rect.height }}
                  className="object-contain" />
              )
              return (
                <div style={{ width: rect.width, height: rect.height }}
                  className="flex items-center justify-center">
                  {lensOn ? (
                    <Lens zoomFactor={lensZoom} lensSize={lensSize}>{imgEl}</Lens>
                  ) : (
                    imgEl
                  )}
                </div>
              )
            },
            controls: () => {
              const stopNav = stopNavigationEventsPropagation()
              return (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50"
                {...stopNav}>
                <div className="flex items-center gap-3 bg-black/85 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2.5 shadow-2xl">
                  <button onClick={() => setLensOn(o => !o)}
                    className={`p-1 rounded-lg transition-colors ${lensOn ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'text-white/30 hover:text-white/50 hover:bg-white/5'}`}>
                    {lensOn ? <Search size={16} /> : <SearchX size={16} />}
                  </button>
                  <div className="flex items-center gap-1">
                    <span className="text-white/40 text-[10px] uppercase tracking-wider w-7">Zoom</span>
                    <button onClick={() => setLensZoom(z => Math.max(1.5, z - 0.5))}
                      disabled={!lensOn}
                      className="text-white/70 hover:text-white p-0.5 disabled:opacity-20">
                      <Minus size={14} />
                    </button>
                    <input type="range" min="1.5" max="5" step="0.5"
                      value={lensZoom}
                      disabled={!lensOn}
                      onChange={e => setLensZoom(Number(e.target.value))}
                      className="w-20 h-1 accent-primary cursor-pointer disabled:opacity-20" />
                    <button onClick={() => setLensZoom(z => Math.min(5, z + 0.5))}
                      disabled={!lensOn}
                      className="text-white/70 hover:text-white p-0.5 disabled:opacity-20">
                      <Plus size={14} />
                    </button>
                    <span className={`text-xs min-w-[2.5rem] text-center tabular-nums ${lensOn ? 'text-white/80' : 'text-white/20'}`}>{lensOn ? `${lensZoom}x` : 'off'}</span>
                  </div>
                  <div className="w-px h-5 bg-white/10" />
                  <div className="flex items-center gap-1">
                    <span className="text-white/40 text-[10px] uppercase tracking-wider">Tam</span>
                    <button onClick={() => setLensSize(z => Math.max(100, z - 25))}
                      disabled={!lensOn}
                      className="text-white/70 hover:text-white p-0.5 disabled:opacity-20">
                      <Minus size={14} />
                    </button>
                    <input type="range" min="100" max="400" step="25"
                      value={lensSize}
                      disabled={!lensOn}
                      onChange={e => setLensSize(Number(e.target.value))}
                      className="w-20 h-1 accent-primary cursor-pointer disabled:opacity-20" />
                    <button onClick={() => setLensSize(z => Math.min(400, z + 25))}
                      disabled={!lensOn}
                      className="text-white/70 hover:text-white p-0.5 disabled:opacity-20">
                      <Plus size={14} />
                    </button>
                    <span className={`text-xs min-w-[2.5rem] text-center tabular-nums ${lensOn ? 'text-white/80' : 'text-white/20'}`}>{lensOn ? `${lensSize}px` : 'off'}</span>
                  </div>
                </div>
              </div>
              )
            },
          }}
        />
      )}
    </div>
  );
};
