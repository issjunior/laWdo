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
  Type,
  Maximize2,
  ArrowUpDown,
  Calendar,
  SortAsc,
  Search,
  Plus,
  Image as ImageIcon
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { toast } from 'sonner';

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
          <Badge className="absolute top-1 left-1 h-5 px-1 truncate max-w-[60px] text-[10px]" variant="secondary">
            Fig. {imagem.numero_figura}
          </Badge>
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
}

const FiguraEditorItem: React.FC<FiguraEditorItemProps> = ({
  imagem,
  index,
  ativo = false,
  onDelete,
  onUpdateLegenda,
  onPreview,
  onScrollToFigure,
}) => {
  const [legenda, setLegenda] = useState(imagem.legenda);
  const onUpdateLegendaRef = useRef(onUpdateLegenda);
  onUpdateLegendaRef.current = onUpdateLegenda;
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ativo && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        <Badge className="absolute top-0 left-0 h-4 px-1 text-[9px] rounded-none rounded-br" variant="secondary">
          Fig. {index + 1}
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
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={onPreview}
        title="Ampliar"
      >
        <Maximize2 size={14} />
      </Button>
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
  syncEnabled,
  figuraAtivaId,
  onSyncToggle,
  onScrollToFigure,
}) => {
  const [imagens, setImagens] = useState<ImagemLaudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'sequencia' | 'nome' | 'data'>('sequencia');

  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxEditorIndex, setLightboxEditorIndex] = useState(-1);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const carregarImagens = () => {
    setImagens([]);
    setLoading(false);
  };

  useEffect(() => {
    carregarImagens();
  }, [laudoId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = imagens.findIndex((i) => i.id === active.id);
      const newIndex = imagens.findIndex((i) => i.id === over.id);
      const newArray = arrayMove(imagens, oldIndex, newIndex);
      const reindexed = newArray.map((img, idx) => ({ ...img, sequencia: idx + 1, numero_figura: idx + 1 }));
      setImagens(reindexed);
      onReorder?.(reindexed);
      onRefreshHtml();
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const dataUri = await readFileAsDataUri(file);
        const thumbnailDataUri = await generateThumbnail(dataUri, 300);
        setImagens(prev => {
          const newImg: ImagemLaudo = {
            id: crypto.randomUUID(),
            url: dataUri,
            thumbnailUrl: thumbnailDataUri,
            legenda: '',
            numero_figura: 0,
            sequencia: 0,
            created_at: new Date().toISOString(),
          };
          const updated = [...prev, newImg];
          return updated.map((img, idx) => ({ ...img, numero_figura: idx + 1, sequencia: idx + 1 }));
        });
      } catch {
        toast.error(`Erro ao carregar ${file.name}`);
      }
    }
    e.target.value = '';
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir permanentemente esta imagem?')) return;
    setImagens(prev =>
      prev.filter(img => img.id !== id).map((img, idx) => ({ ...img, sequencia: idx + 1, numero_figura: idx + 1 }))
    );
    onDeleteImage?.(id);
    onRefreshHtml();
  };

  const handleUpdateLegenda = (id: string, legenda: string) => {
    setImagens(prev => prev.map(img => img.id === id ? { ...img, legenda } : img));
  };

  const filteredImagens = imagens
    .filter(img => img.legenda.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'nome') return a.legenda.localeCompare(b.legenda);
      if (sortBy === 'data') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return a.sequencia - b.sequencia;
    });

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <div className="p-4 border-b space-y-4 bg-background">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ImageIcon size={16} /> Ilustrações ({imagens.length})
          </h2>
          <div className="flex items-center gap-2 pb-1">
            <Checkbox
              id="sync-figuras"
              checked={syncEnabled ?? false}
              onCheckedChange={(checked) => onSyncToggle?.(!!checked)}
            />
            <label
              htmlFor="sync-figuras"
              className="text-xs cursor-pointer select-none text-muted-foreground"
            >
              Sincronizar com editor
            </label>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSortBy('sequencia')} title="Ordenar por sequência">
              <ArrowUpDown size={14} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSortBy('nome')} title="Ordenar por nome">
              <SortAsc size={14} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSortBy('data')} title="Ordenar por data">
              <Calendar size={14} />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar ilustrações..."
            className="pl-8 h-9 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Button className="w-full gap-2" variant="outline" asChild>
          <label className="cursor-pointer">
            <Plus size={16} /> Carregar Imagens
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
        </Button>
        {onInsertAll && imagens.length > 0 && (
          <Button variant="secondary" className="w-full gap-2" onClick={() => {
            onInsertAll(imagens);
            setImagens([]);
          }}>
            <ImageIcon size={16} /> Inserir Todas no Laudo
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
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
                        onInsertImage(img.url, img.id, img.legenda);
                        setImagens(prev =>
                          prev.filter(i => i.id !== img.id).map((i, idx) => ({ ...i, sequencia: idx + 1, numero_figura: idx + 1 }))
                        );
                      }}
                      onPreview={setLightboxIndex}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* ─── Figuras já existentes no editor ─── */}
      {figurasNoEditor && figurasNoEditor.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Figuras no laudo ({figurasNoEditor.length})
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
            {figurasNoEditor.map((fig, idx) => (
              <FiguraEditorItem
                key={fig.id}
                imagem={fig}
                index={idx}
                ativo={fig.id === figuraAtivaId}
                onDelete={onDeleteImage ? onDeleteImage : () => {}}
                onUpdateLegenda={onUpdateLegendaInEditor || (() => {})}
                onPreview={() => setLightboxEditorIndex(idx)}
                onScrollToFigure={onScrollToFigure}
              />
            ))}
          </div>
        </div>
      )}

      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={() => setLightboxIndex(-1)}
        slides={filteredImagens.map(img => ({ src: img.url, title: img.legenda }))}
        plugins={[Zoom]}
      />

      {figurasNoEditor && figurasNoEditor.length > 0 && (
        <Lightbox
          open={lightboxEditorIndex >= 0}
          index={lightboxEditorIndex}
          close={() => setLightboxEditorIndex(-1)}
          slides={figurasNoEditor.map(img => ({ src: img.url, title: img.legenda }))}
          plugins={[Zoom]}
        />
      )}
    </div>
  );
};
