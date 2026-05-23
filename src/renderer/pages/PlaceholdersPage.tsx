import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Search, Edit, Trash2, Lock, Zap, ArrowRight, ChevronDown, ChevronUp, Layers, Hash, Type, AlignLeft, Tag, LayoutGrid, List, Settings } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Placeholder } from '@/lib/validators';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Dnd Kit
import { DndContext, useDroppable, useDraggable, DragOverlay, closestCorners } from '@dnd-kit/core';

// Modais e Componentes
import { ManageCategoriesModal, CategoriaPlaceholderRow } from '@/components/placeholders/ManageCategoriesModal';
import { CAMPOS_ESPECIFICOS_PLACEHOLDERS, EXAM_PLACEHOLDER_CATEGORIES } from '@/components/rep/exam-fields/placeholders';

interface PlaceholderFormData {
  chave: string;
  valor: string;
  descricao: string;
  categoria_id: string;
}

const emptyForm = (defaultCat: string): PlaceholderFormData => ({
  chave: '', valor: '', descricao: '', categoria_id: defaultCat,
});

const PLACEHOLDERS_SISTEMA_CHAVES = [
  'numero_rep', 'data_recebimento_rep', 'tipo_solicitacao_rep', 'numero_solicitacao_rep',
  'data_solicitacao_rep', 'autoridade_solicitante_rep', 'nome_envolvido', 'local_fato',
  'latitude', 'longitude', 'data_acionamento_local', 'data_chegada_local', 'data_saida_local',
  'numero_bo', 'numero_ip', 'lacre_entrada', 'lacre_saida', 'observacoes_rep',
  'solicitante_nome', 'tipo_exame_nome', 'tipo_exame_codigo',
  'perito_nome', 'perito_cargo', 'perito_lotacao', 'perito_matricula',
  'data_atual',
  'data_extenso_recebimento_rep'
];

/* ── COMPONENTES DRAG & DROP ── */
const DraggableCard = ({ p, categoria, isOverlay = false }: { p: Placeholder, categoria: CategoriaPlaceholderRow | undefined, isOverlay?: boolean }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: p.id,
    data: { placeholder: p }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  if (!categoria) return null;
  const isSysCat = categoria.is_sistema === 1;
  const isSysPlaceholder = PLACEHOLDERS_SISTEMA_CHAVES.includes(p.chave);

  const IconComp = (LucideIcons as any)[categoria.icone] || LucideIcons.Tag;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`relative overflow-hidden mb-1.5 cursor-grab hover:shadow-md transition-shadow 
        ${isDragging ? 'opacity-50 border-primary ring-2 ring-primary/50' : ''} 
        ${isOverlay ? 'shadow-xl cursor-grabbing scale-105 rotate-2' : ''}
        ${isSysPlaceholder ? 'border-blue-200 dark:border-blue-800/60' : ''}
      `}
    >
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 bg-${categoria.cor}-500`}
      />
      <CardHeader className="pb-3 pl-5 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <code className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted font-mono text-xs font-semibold text-foreground truncate">
                <Hash size={10} className="mr-1 text-muted-foreground shrink-0" />
                {`{{${p.chave}}}`}
              </code>
              {isSysPlaceholder && (
                <Badge variant="outline" className="text-[10px] h-4 px-1 gap-1 shrink-0 border-blue-200 text-blue-600 dark:text-blue-300">
                  <Lock size={8} />
                  Fixo
                </Badge>
              )}
              {(() => {
                const examPH = CAMPOS_ESPECIFICOS_PLACEHOLDERS.find(ep => ep.chave === p.chave);
                if (!examPH) return null;
                const examCat = EXAM_PLACEHOLDER_CATEGORIES.find(c => c.codigo === examPH.categoria_exam_codigo);
                return (
                  <Badge
                    variant="outline"
                    className={`text-[10px] h-4 px-1 gap-1 shrink-0 border-${examCat?.cor || 'amber'}-200 text-${examCat?.cor || 'amber'}-600 dark:text-${examCat?.cor || 'amber'}-300 dark:border-${examCat?.cor || 'amber'}-800/60`}
                  >
                    <Zap size={8} />
                    {examPH.categoria_exam_codigo}
                  </Badge>
                );
              })()}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <IconComp size={11} className="text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate">
                {categoria.label}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pl-5 pb-3 space-y-2">
        {!isSysPlaceholder && p.valor && (
          <div className="flex items-start gap-2">
            <Type size={12} className="text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-foreground font-medium truncate" title={p.valor}>{p.valor}</p>
          </div>
        )}
        {p.descricao && (
          <div className="flex items-start gap-2">
            <AlignLeft size={12} className="text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2" title={p.descricao}>{p.descricao}</p>
          </div>
        )}
        {(() => {
          const examPH = CAMPOS_ESPECIFICOS_PLACEHOLDERS.find(ep => ep.chave === p.chave);
          if (!examPH) return null;
          return (
            <div className="flex items-start gap-2">
              <code className="text-[9px] text-muted-foreground/60 truncate" title={`JSON path: ${examPH.jsonPath}`}>
                {examPH.jsonPath}
              </code>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
};

const DroppableColumn = ({ categoria, placeholders, onEdit, onDelete, open, onToggle }: { 
  categoria: CategoriaPlaceholderRow, 
  placeholders: Placeholder[], 
  onEdit: (p: Placeholder) => void, 
  onDelete: (id: string) => void,
  open: boolean,
  onToggle: () => void,
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: categoria.id,
    data: { categoria }
  });

  const IconComp = (LucideIcons as any)[categoria.icone] || LucideIcons.Tag;

  if (!open) {
    return (
      <div
        ref={setNodeRef}
        className={`flex flex-col items-center rounded-xl border bg-muted/20 py-3 px-2 gap-3 cursor-pointer hover:bg-muted/40 transition-colors shrink-0 w-12
          ${isOver ? `ring-2 ring-${categoria.cor}-500/50` : ''}
        `}
        onClick={onToggle}
        title={`Expandir: ${categoria.label} (${placeholders.length})`}
      >
        <IconComp size={16} className={`text-${categoria.cor}-600 dark:text-${categoria.cor}-400 shrink-0`} />
        <span
          className={`text-[11px] font-semibold text-${categoria.cor}-700 dark:text-${categoria.cor}-300 whitespace-nowrap`}
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {categoria.label}
        </span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1">{placeholders.length}</Badge>
      </div>
    );
  }

  return (
    <div 
      ref={setNodeRef} 
      className={`flex flex-col flex-1 min-w-[270px] max-w-[310px] rounded-xl border bg-muted/20 
      ${isOver ? `ring-2 ring-${categoria.cor}-500/50 bg-${categoria.cor}-50/50 dark:bg-${categoria.cor}-900/10` : ''}`}
    >
      <div className={`p-3 border-b bg-${categoria.cor}-50/50 dark:bg-${categoria.cor}-900/20 flex items-center justify-between rounded-t-xl`}>
        <div className="flex items-center gap-2">
          <IconComp size={16} className={`text-${categoria.cor}-600 dark:text-${categoria.cor}-400`} />
          <h3 className={`font-semibold text-sm text-${categoria.cor}-700 dark:text-${categoria.cor}-300`}>{categoria.label}</h3>
          <Badge variant="secondary" className="text-[10px] h-4 px-1">{placeholders.length}</Badge>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
          title="Recolher coluna"
        >
          <ChevronDown size={14} className="rotate-90" />
        </button>
      </div>
      <div className="p-3 flex-1 overflow-y-auto min-h-[150px]">
        {placeholders.map(p => {
          const deletavel = !PLACEHOLDERS_SISTEMA_CHAVES.includes(p.chave) && !CAMPOS_ESPECIFICOS_PLACEHOLDERS.some(ep => ep.chave === p.chave);
          return (
            <div key={p.id} className="group relative">
              <DraggableCard p={p} categoria={categoria} />
              {/* Actions overlay for DND mode */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex bg-background/90 rounded border shadow-sm z-10">
                 <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(p)}><Edit size={12} /></Button>
                 <Button variant="ghost" size="icon" className={`h-6 w-6 ${deletavel ? 'text-destructive hover:text-destructive' : 'text-muted-foreground/30'}`} onClick={() => deletavel && onDelete(p.id)} disabled={!deletavel}><Trash2 size={12} /></Button>
              </div>
            </div>
          );
        })}
        {placeholders.length === 0 && (
          <div className="h-full flex flex-col justify-center items-center text-muted-foreground/50 border-2 border-dashed rounded-lg p-4 text-center">
            <span className="text-xs">Solte aqui</span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── COMPONENTE PRINCIPAL ── */
export const PlaceholdersPage: React.FC = () => {
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [categorias, setCategorias] = useState<CategoriaPlaceholderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlaceholder, setEditingPlaceholder] = useState<Placeholder | null>(null);
  const [formData, setFormData] = useState<PlaceholderFormData>(emptyForm(''));
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Accordion: no máximo 3 categorias expandidas por vez
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const MAX_EXPANDED = 3;

  // DND Overlay
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  /* ── Carregamento ── */
  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setLoadError(null);
      await window.ipcAPI.placeholder.migrateSistema();
      const seedResult = await window.ipcAPI.placeholder.seedSistema();
      if (!seedResult.success) {
        setLoadError(seedResult.error || 'Erro ao semear placeholders do sistema');
      }
      
      const rPlaceholders = await window.ipcAPI.placeholder.findAll();
      const rCategorias = await window.ipcAPI.categoria.findAll();

      if (rCategorias.success && rCategorias.data) {
        setCategorias(rCategorias.data);
      }
      if (rPlaceholders.success && rPlaceholders.data) {
        setPlaceholders(rPlaceholders.data);
      } else {
        setLoadError(rPlaceholders.error || 'Erro ao carregar dados');
      }
    } catch (err: any) {
      setLoadError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  // Inicializa as 3 primeiras categorias expandidas ao carregar
  useEffect(() => {
    if (categorias.length > 0 && expandedCategories.length === 0) {
      const primeiras = categorias
        .sort((a, b) => a.ordem - b.ordem)
        .slice(0, MAX_EXPANDED)
        .map(c => c.id);
      setExpandedCategories(primeiras);
    }
  }, [categorias]);

  const toggleExpand = useCallback((catId: string) => {
    setExpandedCategories(prev => {
      if (prev.includes(catId)) {
        return prev.filter(id => id !== catId);
      }
      if (prev.length >= MAX_EXPANDED) {
        return [...prev.slice(1), catId];
      }
      return [...prev, catId];
    });
  }, []);

  /* ── Filtro ── */
  const filtradosPorBusca = useMemo(
    () =>
      placeholders.filter(p => {
        const cat = categorias.find(c => c.id === p.categoria_id);
        const catLabel = cat ? cat.label : '';
        return p.chave.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.valor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        catLabel.toLowerCase().includes(searchTerm.toLowerCase())
      }),
    [placeholders, searchTerm, categorias]
  );

  /* ── Ações de Placeholders ── */
  const handleNovo = () => {
    setEditingPlaceholder(null);
    const catPadrao = categorias.find(c => c.chave === 'Personalizado')?.id || categorias[0]?.id || '';
    setFormData(emptyForm(catPadrao));
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  };

  const handleEditar = (p: Placeholder) => {
    setEditingPlaceholder(p);
    setFormData({
      chave: p.chave,
      valor: p.valor || '',
      descricao: p.descricao || '',
      categoria_id: p.categoria_id || categorias[0]?.id || '',
    });
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este placeholder?')) return;
    try {
      const r = await window.ipcAPI.placeholder.delete(id);
      if (r.success) {
        await carregarDados();
      } else {
        alert(`Erro: ${r.error}`);
      }
    } catch (err: any) {
      alert('Erro ao excluir placeholder');
    }
  };

  const handleSalvar = async () => {
    try {
      setError(null);
      setSuccess(null);

      if (!formData.chave.trim()) {
        setError('A chave do placeholder é obrigatória.');
        return;
      }

      const payload = {
        chave: formData.chave,
        valor: formData.valor,
        descricao: formData.descricao || null,
        categoria_id: formData.categoria_id || null,
      };

      if (editingPlaceholder) {
        const r = await window.ipcAPI.placeholder.update(editingPlaceholder.id, payload);
        if (r.success) {
          setSuccess('Atualizado com sucesso!');
          await carregarDados();
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(r.error || 'Erro ao atualizar');
        }
      } else {
        const r = await window.ipcAPI.placeholder.create(payload);
        if (r.success) {
          setSuccess('Criado com sucesso!');
          await carregarDados();
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(r.error || 'Erro ao criar');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar placeholder');
    }
  };

  /* ── Drag & Drop Handlers ── */
  const handleDragStart = (event: any) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveDragId(null);
    
    if (!over) return;

    const placeholderId = active.id;
    const novaCategoriaId = over.id;

    const placeholder = placeholders.find(p => p.id === placeholderId);
    const catDestino = categorias.find(c => c.id === novaCategoriaId);
    
    if (placeholder && catDestino && placeholder.categoria_id !== novaCategoriaId) {
      // Optimistic update
      setPlaceholders(prev => prev.map(p => p.id === placeholderId ? { ...p, categoria_id: novaCategoriaId } : p));
      
      const res = await window.ipcAPI.placeholder.update(placeholderId, { categoria_id: novaCategoriaId });
      if (!res.success) {
        // Rollback on fail
        await carregarDados();
        alert('Erro ao mover placeholder: ' + res.error);
      }
    }
  };

  const activePlaceholder = activeDragId ? placeholders.find(p => p.id === activeDragId) : null;
  const activeCategoria = activePlaceholder ? categorias.find(c => c.id === activePlaceholder.categoria_id) : undefined;

  /* ── Colunas da DataTable ── */
  const columnDefs = useMemo<ColumnDef<Placeholder>[]>(() => [
    {
      accessorKey: 'chave',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Chave" />,
      cell: ({ row }) => (
        <code className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted font-mono text-xs font-semibold whitespace-nowrap">
          <Hash size={10} className="mr-1 text-muted-foreground shrink-0" />
          {`{{${row.getValue('chave')}}}`}
        </code>
      ),
    },
    {
      accessorKey: 'categoria_id',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Categoria" />,
      cell: ({ row }) => {
        const cat = categorias.find(c => c.id === row.getValue('categoria_id')) || categorias.find(c => c.id === 'cat-sem-categoria');
        if (!cat) return null;
        const Icon = (LucideIcons as any)[cat.icone] || LucideIcons.Tag;
        const p = row.original;
        const sistema = PLACEHOLDERS_SISTEMA_CHAVES.includes(p.chave);
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 gap-1 border-${cat.cor}-200 text-${cat.cor}-600`}>
              <Icon size={10} />
              {cat.label}
            </Badge>
            {sistema && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 shrink-0 border-blue-200 text-blue-600">
                <Lock size={9} />
                Fixo
              </Badge>
            )}
            {(() => {
              const examPH = CAMPOS_ESPECIFICOS_PLACEHOLDERS.find(ep => ep.chave === p.chave);
              if (!examPH) return null;
              const examCat = EXAM_PLACEHOLDER_CATEGORIES.find(c => c.codigo === examPH.categoria_exam_codigo);
              return (
                <Badge variant="outline" className={`text-[10px] h-5 px-1.5 gap-1 shrink-0 border-${examCat?.cor || 'amber'}-200 text-${examCat?.cor || 'amber'}-600`}>
                  <Zap size={9} />
                  {examPH.categoria_exam_codigo}
                </Badge>
              );
            })()}
          </div>
        );
      },
    },
    {
      accessorKey: 'valor',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Valor padrão" />,
      cell: ({ row }) => {
        const valor = row.getValue('valor') as string;
        const p = row.original;
        if (PLACEHOLDERS_SISTEMA_CHAVES.includes(p.chave) || CAMPOS_ESPECIFICOS_PLACEHOLDERS.some(ep => ep.chave === p.chave)) {
          return <span className="text-xs text-muted-foreground italic">Automático</span>;
        }
        return valor
          ? <span className="text-sm font-medium truncate block max-w-[200px]" title={valor}>{valor}</span>
          : <span className="text-xs text-muted-foreground italic">Sem valor</span>;
      },
    },
    {
      accessorKey: 'descricao',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Descrição" />,
      cell: ({ row }) => {
        const desc = row.getValue('descricao') as string;
        return desc
          ? <span className="text-xs text-muted-foreground line-clamp-2 block max-w-[250px]" title={desc}>{desc}</span>
          : <span className="text-xs text-muted-foreground/50 italic">—</span>;
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      header: () => <span className="sr-only">Ações</span>,
      cell: ({ row }) => {
        const p = row.original;
        const deletavel = !PLACEHOLDERS_SISTEMA_CHAVES.includes(p.chave) && !CAMPOS_ESPECIFICOS_PLACEHOLDERS.some(ep => ep.chave === p.chave);
        return (
          <div className="flex justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => handleEditar(p)}><Edit size={14} /></Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Editar</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="sm"
                  className={!deletavel ? 'text-muted-foreground/30' : 'text-red-600'}
                  onClick={() => deletavel && handleExcluir(p.id)}
                  disabled={!deletavel}
                >
                  <Trash2 size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{deletavel ? 'Excluir' : 'Fixos não podem ser excluídos'}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
  ], [categorias]);

  return (
    <TooltipProvider>
    <div className="container mx-auto p-6 space-y-6 flex flex-col h-[calc(100vh-2rem)] overflow-hidden">
      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Placeholders</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os campos dinâmicos dos laudos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setManageCategoriesOpen(true)} className="flex items-center gap-2">
            <Settings size={16} /> Categorias
          </Button>

          <div className="border rounded-lg p-1 flex items-center gap-1 bg-muted/50">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('cards')}
              className="h-8 px-2.5" title="Cards"
            ><LayoutGrid size={14} /></Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('table')}
              className="h-8 px-2.5" title="Lista"
            ><List size={14} /></Button>
          </div>
          <Button onClick={handleNovo} className="flex items-center gap-2 shrink-0">
            <Plus size={16} /> Novo Placeholder
          </Button>
        </div>
      </div>

      {/* ── Busca ── */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por chave, valor, descrição..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* ── Área principal ── */}
      <div className="flex-1 overflow-hidden">
        {loadError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="flex items-center justify-between gap-2">
              <span>{loadError}</span>
              <Button variant="outline" size="sm" onClick={() => carregarDados()}>Tentar novamente</Button>
            </AlertDescription>
          </Alert>
        )}
        {loading ? (
          <div className="h-full flex items-center justify-center"><p className="animate-pulse">Carregando...</p></div>
        ) : viewMode === 'table' ? (
          <div className="h-full overflow-y-auto pr-2">
             <DataTable
               columns={columnDefs}
               data={filtradosPorBusca}
               searchColumn="chave"
               searchPlaceholder="Filtrar tabela..."
               hideSearch
             />
          </div>
        ) : (
          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
            <div className="flex gap-2 h-full overflow-x-auto pb-4 items-start">
              {categorias.map(cat => (
                <DroppableColumn 
                  key={cat.id} 
                  categoria={cat} 
                  placeholders={filtradosPorBusca.filter(p => p.categoria_id === cat.id)} 
                  onEdit={handleEditar}
                  onDelete={handleExcluir}
                  open={expandedCategories.includes(cat.id)}
                  onToggle={() => toggleExpand(cat.id)}
                />
              ))}
            </div>
            <DragOverlay>
              {activePlaceholder ? <DraggableCard p={activePlaceholder} categoria={activeCategoria} isOverlay /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* ── Modal de Gerenciamento de Categorias ── */}
      <ManageCategoriesModal 
        open={manageCategoriesOpen} 
        onOpenChange={setManageCategoriesOpen} 
        categorias={categorias} 
        onCategoriasChange={carregarDados} 
      />

      {/* ── Dialog de criação/edição Placeholder ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingPlaceholder ? 'Editar Placeholder' : 'Novo Placeholder'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            {success && <Alert className="bg-green-50"><AlertDescription className="text-green-800">{success}</AlertDescription></Alert>}

            <div className="space-y-2">
              <Label htmlFor="chave">Chave *</Label>
              <Input
                id="chave" value={formData.chave}
                onChange={e => setFormData({ ...formData, chave: e.target.value })}
                disabled={!!editingPlaceholder && PLACEHOLDERS_SISTEMA_CHAVES.includes(editingPlaceholder.chave)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select value={formData.categoria_id} onValueChange={v => setFormData({ ...formData, categoria_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria..." /></SelectTrigger>
                <SelectContent>
                  {categorias.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label} {cat.is_sistema === 1 && '(Sistema)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!PLACEHOLDERS_SISTEMA_CHAVES.includes(formData.chave) && (
              <div className="space-y-2">
                <Label htmlFor="valor">Valor padrão</Label>
                <Input
                  id="valor" value={formData.valor}
                  onChange={e => setFormData({ ...formData, valor: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao" value={formData.descricao}
                onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={!formData.chave.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};
