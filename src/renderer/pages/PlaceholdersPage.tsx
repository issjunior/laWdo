import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Placeholder } from '@/lib/validators';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { CAMPOS_ESPECIFICOS_PLACEHOLDERS } from '@/components/rep/exam-fields/placeholders';
import { ManageCategoriesModal, CategoriaPlaceholderRow } from '@/components/placeholders/ManageCategoriesModal';
import { SortableCategoryTree } from '@/components/categorias/SortableCategoryTree';
import { Loader2, AlertCircle, Plus, Lock, Check, FolderTree, Search, Edit, Trash2, Settings, Hash, type LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { ALLOWED_COLORS, ICON_CATEGORIES } from '@/lib/category-constants';
import {
  type CategoriaFull,
  findCat,
  removeFromTree,
  insertIntoTree,
  moveNodeInTree,
  updateNodeInTree,
  toTreeNode,
  flattenTree,
  buildParentOptions,
} from '@/lib/tree-utils';

interface PlaceholderFormData {
  chave: string;
  valor: string;
  descricao: string;
  categoria_id: string;
}

const emptyForm = (defaultCat: string): PlaceholderFormData => ({
  chave: '', valor: '', descricao: '', categoria_id: defaultCat,
});

const catEmptyForm = { label: '', descricao: '', cor: 'slate', icone: 'Tag', parent_id: '__none__' as string };
const iconesLucide = LucideIcons as unknown as Record<string, LucideIcon>;

const getMensagemErro = (erro: unknown, fallback: string): string =>
  erro instanceof Error ? erro.message : fallback;

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

/* ── COMPONENTE PRINCIPAL ── */
export const PlaceholdersPage: React.FC = () => {
  const [categorias, setCategorias] = useState<CategoriaFull[]>([]);
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState(false);

  const [catFormData, setCatFormData] = useState(catEmptyForm);
  const [savingCategory, setSavingCategory] = useState(false);
  const [catFormError, setCatFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<CategoriaFull | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlaceholder, setEditingPlaceholder] = useState<Placeholder | null>(null);
  const [formData, setFormData] = useState<PlaceholderFormData>(emptyForm(''));
  const [formError, setFormErrorState] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);

  /* ── Carregamento ── */
  const carregarDados = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      await window.ipcAPI.placeholder.migrateSistema();
      await window.ipcAPI.placeholder.seedSistema();
      const [rPlaceholders, rCategorias] = await Promise.all([
        window.ipcAPI.placeholder.findAll(),
        window.ipcAPI.categoria.findArvore(),
      ]);
      if (rPlaceholders.success) setPlaceholders(rPlaceholders.data || []);
      if (rCategorias.success) setCategorias(rCategorias.data || []);
    } catch (e: unknown) {
      setError(getMensagemErro(e, 'Erro ao carregar'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  /* ── Árvore ── */
  const selectedCat = selectedCatId ? findCat(categorias, selectedCatId) : null;

  const handleSelect = useCallback((id: string) => {
    setSelectedCatId(id);
    setEditingCategory(false);
  }, []);

  const handleTreeAdd = useCallback((_parentId: string | null) => {
    setManageCategoriesOpen(true);
  }, []);

  const handleMove = useCallback(async (id: string, newParentId: string | null) => {
    const cat = findCat(categorias, id);
    if (cat?.is_sistema === 1) return;
    const prev = categorias;
    setCategorias(prev => moveNodeInTree(prev, id, newParentId));
    try {
      const res = await window.ipcAPI.categoria.update(id, { parent_id: newParentId });
      if (res.success) toast.success('Categoria movida');
      else { setCategorias(prev); toast.error(res.error || 'Erro ao mover'); }
    } catch { setCategorias(prev); }
  }, [categorias]);

  /* ── Edição inline de categoria ── */
  const handleEditCategory = () => {
    if (!selectedCat) return;
    setCatFormData({
      label: selectedCat.label,
      descricao: selectedCat.descricao || '',
      cor: selectedCat.cor || 'slate',
      icone: selectedCat.icone || 'Tag',
      parent_id: selectedCat.parent_id || '__none__',
    });
    setCatFormError(null);
    setEditingCategory(true);
  };

  const handleSaveCategory = async () => {
    if (!catFormData.label.trim()) { setCatFormError('Nome obrigatório'); return; }
    if (!selectedCat) return;
    setSavingCategory(true); setCatFormError(null);
    const newParentId = catFormData.parent_id === '__none__' ? null : catFormData.parent_id;
    const payload = { label: catFormData.label.trim(), descricao: catFormData.descricao.trim() || null, cor: catFormData.cor, icone: catFormData.icone, parent_id: newParentId };
    const parentChanged = (selectedCat.parent_id || null) !== newParentId;
    const prev = categorias;

    if (parentChanged) {
      setCategorias(prev => {
        const { tree: without } = removeFromTree(prev, selectedCat.id);
        const updated = { ...selectedCat, ...payload };
        if (!updated.parent_id) return [...without, updated];
        return insertIntoTree(without, updated.parent_id, updated);
      });
    } else {
      setCategorias(prev => prev.map(c => updateNodeInTree(c, selectedCat.id, payload)));
    }

    try {
      const res = await window.ipcAPI.categoria.update(selectedCat.id, payload);
      if (res.success) { toast.success('Atualizada'); setEditingCategory(false); }
      else { setCategorias(prev); setCatFormError(res.error || 'Erro'); }
    } catch { setCategorias(prev); }
    setSavingCategory(false);
  };

  const handleDeleteCategory = () => {
    if (!selectedCat) return;
    setDeleteTarget(selectedCat);
  };

  const confirmDeleteCategory = async () => {
    if (!deleteTarget) return;
    const prev = categorias;
    setCategorias(prev => removeFromTree(prev, deleteTarget.id).tree);
    setDeleteTarget(null);
    if (selectedCatId === deleteTarget.id) setSelectedCatId(null);
    try {
      const res = await window.ipcAPI.categoria.delete(deleteTarget.id);
      if (res.success) { toast.success('Excluída'); carregarDados(); }
      else { setCategorias(prev); toast.error(res.error || 'Erro'); }
    } catch { setCategorias(prev); }
  };

  /* ── Placeholders ── */
  const handleNovo = () => {
    setEditingPlaceholder(null);
    setFormData(emptyForm(selectedCatId || ''));
    setFormErrorState(null);
    setFormSuccess(null);
    setDialogOpen(true);
  };

  const handleEditar = (p: Placeholder) => {
    setEditingPlaceholder(p);
    setFormData({
      chave: p.chave,
      valor: p.valor || '',
      descricao: p.descricao || '',
      categoria_id: p.categoria_id || '',
    });
    setFormErrorState(null);
    setFormSuccess(null);
    setDialogOpen(true);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este placeholder?')) return;
    try {
      const r = await window.ipcAPI.placeholder.delete(id);
      if (r.success) await carregarDados();
      else alert(`Erro: ${r.error}`);
    } catch { alert('Erro ao excluir placeholder'); }
  };

  const handleSalvar = async () => {
    try {
      setFormErrorState(null);
      setFormSuccess(null);
      if (!formData.chave.trim()) { setFormErrorState('A chave do placeholder é obrigatória.'); return; }

      const payload = {
        chave: formData.chave,
        valor: formData.valor,
        descricao: formData.descricao || null,
        categoria_id: formData.categoria_id || null,
      };

      if (editingPlaceholder) {
        const r = await window.ipcAPI.placeholder.update(editingPlaceholder.id, payload);
        if (r.success) {
          setFormSuccess('Atualizado com sucesso!');
          await carregarDados();
          setTimeout(() => setDialogOpen(false), 1000);
        } else setFormErrorState(r.error || 'Erro ao atualizar');
      } else {
        const r = await window.ipcAPI.placeholder.create(payload);
        if (r.success) {
          setFormSuccess('Criado com sucesso!');
          await carregarDados();
          setTimeout(() => setDialogOpen(false), 1000);
        } else setFormErrorState(r.error || 'Erro ao criar');
      }
    } catch (err: unknown) {
      setFormErrorState(getMensagemErro(err, 'Erro ao salvar placeholder'));
    }
  };

  /* ── Filtro ── */
  const placeholdersDaCategoria = useMemo(() =>
    placeholders.filter(p => p.categoria_id === selectedCatId),
    [placeholders, selectedCatId]
  );

  const filtrados = useMemo(() => {
    if (!searchTerm) return placeholdersDaCategoria;
    const q = searchTerm.toLowerCase();
    return placeholdersDaCategoria.filter(p =>
      p.chave.toLowerCase().includes(q) ||
      (p.valor || '').toLowerCase().includes(q) ||
      (p.descricao || '').toLowerCase().includes(q)
    );
  }, [placeholdersDaCategoria, searchTerm]);

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
        const cat = findCat(categorias, row.getValue('categoria_id') as string);
        if (!cat) return null;
        const Icon = iconesLucide[cat.icone] || LucideIcons.Tag;
        const p = row.original;
        const sistema = PLACEHOLDERS_SISTEMA_CHAVES.includes(p.chave) || CAMPOS_ESPECIFICOS_PLACEHOLDERS.some(ep => ep.chave === p.chave);
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 gap-1 border-${cat.cor}-200 text-${cat.cor}-600`}>
              <Icon size={cat.icone === 'Car' ? 12 : 10} />
{cat.label.split(' - ')[0]}
            </Badge>
            {sistema && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 shrink-0 border-blue-200 text-blue-600">
                <Lock size={9} />
                Fixo
              </Badge>
            )}
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

  /* ── Nodes para a árvore ── */
  const arvoreNodes = categorias
    .filter(c => c.id !== 'cat-sem-categoria')
    .map(toTreeNode);

  /* ── Flat list para o modal ── */
  const categoriasFlat: CategoriaPlaceholderRow[] = flattenTree(categorias);

  /* ── Opções de pai para o form de edição ── */
  const parentOptions = useMemo(() => {
    if (!selectedCatId) return [];
    return buildParentOptions(categorias, selectedCatId);
  }, [categorias, selectedCatId]);

  /* ── Loading / Error ── */
  if (loading) return (
    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
  );

  if (error) return (
    <div className="container p-6">
      <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
      <Button variant="outline" onClick={carregarDados} className="mt-4">Tentar novamente</Button>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="container mx-auto h-full flex flex-col p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Placeholders</h1>
            <p className="text-muted-foreground mt-1">Gerencie os campos dinâmicos dos laudos</p>
          </div>
          <Button variant="outline" onClick={() => setManageCategoriesOpen(true)}>
            <Settings size={16} /> Gerenciar Categorias
          </Button>
        </div>

        {/* Grid 2-painéis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">

          {/* Painel Esquerdo — Árvore */}
          <Card className="lg:col-span-1 flex flex-col min-h-0">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderTree size={18} /> Categorias
              </CardTitle>
              <CardDescription>
                Arraste para aninhar. Clique para filtrar placeholders.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto">
              <SortableCategoryTree
                arvore={arvoreNodes}
                selectedId={selectedCatId}
                onSelect={handleSelect}
                onAdd={handleTreeAdd}
                onMove={handleMove}
              />
            </CardContent>
          </Card>

          {/* Painel Direito — Placeholders */}
          <Card className="lg:col-span-2 flex flex-col min-h-0">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-base">
                {selectedCat
                  ? `Placeholders — ${selectedCat.label} (${placeholdersDaCategoria.length})`
                  : 'Selecione uma categoria'}
              </CardTitle>
              <CardDescription>
                {selectedCat
                  ? selectedCat.is_sistema === 1
                    ? 'Categoria do sistema — placeholders fixos não podem ser excluídos.'
                    : 'Gerencie os placeholders desta categoria.'
                  : 'Clique em uma categoria na árvore para ver seus placeholders.'}
              </CardDescription>
              {selectedCat && (
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={handleEditCategory}>
                    <Edit size={14} className="mr-1" /> Editar Categoria
                  </Button>
                  {selectedCat.is_sistema !== 1 && (
                    <Button variant="destructive" size="sm" onClick={handleDeleteCategory}>
                      <Trash2 size={14} className="mr-1" /> Excluir
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4 flex-1 min-h-0 overflow-y-auto">
              {/* Form inline de edição de categoria */}
              {editingCategory && selectedCat && (
                <div className="border rounded-lg p-4 space-y-3 mb-4 bg-muted/5">
                  <p className="text-sm font-medium">Editar Categoria</p>
                  {catFormError && <Alert variant="destructive"><AlertDescription>{catFormError}</AlertDescription></Alert>}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input value={catFormData.label} onChange={e => setCatFormData({ ...catFormData, label: e.target.value })}
                        disabled={selectedCat.is_sistema === 1} />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input value={catFormData.descricao} onChange={e => setCatFormData({ ...catFormData, descricao: e.target.value })} />
                    </div>
                  </div>
                  {/* Categoria pai */}
                  <div className="space-y-2">
                    <Label>Categoria pai</Label>
                    <Select value={catFormData.parent_id} onValueChange={v => setCatFormData({ ...catFormData, parent_id: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {parentOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Cor */}
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <div className="flex flex-wrap gap-2 py-1">
                      {ALLOWED_COLORS.map(color => (
                        <button key={color} type="button"
                          onClick={() => setCatFormData({ ...catFormData, cor: color })}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all bg-${color}-500 hover:scale-110 ${catFormData.cor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                          title={color}>
                          {catFormData.cor === color && <Check size={14} className="text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Ícone */}
                  <div className="space-y-2">
                    <Label>Ícone</Label>
                    <div className="border rounded-lg p-3 h-40 resize-y min-h-[120px] max-h-[400px] overflow-y-auto bg-muted/10">
                      {ICON_CATEGORIES.map(cat => (
                        <div key={cat.label} className="mb-3 last:mb-0">
                          <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">{cat.label}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {cat.icons.map(iconName => {
                              const IconComp = iconesLucide[iconName];
                              if (!IconComp) return null;
                              return (
                                <button key={iconName} type="button"
                                  onClick={() => setCatFormData({ ...catFormData, icone: iconName })}
                                  className={`p-1.5 rounded-md flex justify-center items-center hover:bg-muted transition-colors ${catFormData.icone === iconName ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground'}`}
                                  title={iconName}>
                                  <IconComp size={18} />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSaveCategory} disabled={savingCategory} className="flex-1">
                      {savingCategory && <Loader2 size={16} className="mr-2 animate-spin" />} Salvar
                    </Button>
                    <Button variant="outline" onClick={() => setEditingCategory(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {/* Placeholders — busca + DataTable */}
              {selectedCat ? (
                <>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar por chave ou valor..." value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
                    </div>
                    <Button onClick={handleNovo} size="sm" className="flex items-center gap-1 shrink-0">
                      <Plus size={14} /> Novo
                    </Button>
                  </div>
                  {placeholdersDaCategoria.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
                      <FolderTree size={40} className="opacity-30" />
                      <p className="text-sm">Nenhum placeholder nesta categoria</p>
                    </div>
                  ) : (
                    <DataTable columns={columnDefs} data={filtrados} searchColumn="chave" searchPlaceholder="Buscar placeholder..." hideSearch initialColumnVisibility={{ valor: false }} />
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                  <FolderTree size={40} className="opacity-30" />
                  <p className="text-sm">Selecione uma categoria na árvore para ver seus placeholders.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Diálogo de confirmação de exclusão de categoria */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-md mx-4 shadow-xl">
              <CardHeader>
                <CardTitle>Excluir Categoria</CardTitle>
                <CardDescription>
                  Tem certeza que deseja excluir &quot;{deleteTarget.label}&quot;?
                  Placeholders serão movidos para &quot;Sem categoria&quot;.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                  <Button variant="destructive" onClick={confirmDeleteCategory}>Excluir</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Modal de gerenciamento de categorias */}
        <ManageCategoriesModal
          open={manageCategoriesOpen}
          onOpenChange={setManageCategoriesOpen}
          categorias={categoriasFlat}
          onCategoriasChange={carregarDados}
        />

        {/* Dialog criar/editar placeholder */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingPlaceholder ? 'Editar Placeholder' : 'Novo Placeholder'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}
              {formSuccess && <Alert className="bg-green-50"><AlertDescription className="text-green-800">{formSuccess}</AlertDescription></Alert>}

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
                    {categoriasFlat.map(cat => (
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
                <Input
                  id="descricao" value={formData.descricao}
                  onChange={e => setFormData({ ...formData, descricao: e.target.value })}
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
