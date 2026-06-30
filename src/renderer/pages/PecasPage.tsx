import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Search, Edit, Trash2, Loader2, AlertCircle, Package, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { toast } from 'sonner';

interface CategoriaArvore {
  id: string; chave: string; label: string; cor?: string; icone?: string;
  parent_id: string | null; is_sistema: number; ordem: number;
  subcategorias: CategoriaArvore[];
}

interface PecaItem {
  id: string;
  nome: string;
  descricao?: string;
  conteudo: string;
  categoria_id?: string;
  categoria_label?: string;
  categoria_cor?: string;
  categoria_icone?: string;
  tags?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

const PecasPage: React.FC = () => {
  const navigate = useNavigate();
  const [pecas, setPecas] = useState<PecaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [categoriasArvore, setCategoriasArvore] = useState<CategoriaArvore[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PecaItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<PecaItem | null>(null);

  // Form state
  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formCategoriaId, setFormCategoriaId] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formConteudo, setFormConteudo] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pecasRes, arvoreRes] = await Promise.all([
        window.ipcAPI.peca.findAll(),
        window.ipcAPI.categoriaPeca.findArvore(),
      ]);
      if (pecasRes.success) setPecas(pecasRes.data || []);
      else setError(pecasRes.error || 'Erro ao carregar peças');
      if (arvoreRes.success) setCategoriasArvore(arvoreRes.data || []);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleNova = () => {
    setEditingItem(null);
    setFormNome('');
    setFormDescricao('');
    setFormCategoriaId('');
    setFormTags('');
    setFormConteudo('');
    setDialogOpen(true);
  };

  const handleEditar = (item: PecaItem) => {
    setEditingItem(item);
    setFormNome(item.nome);
    setFormDescricao(item.descricao || '');
    setFormCategoriaId(item.categoria_id || '');
    setFormTags(item.tags ? (typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags).join(', ') : '');
    setFormConteudo(item.conteudo);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formNome.trim()) return;
    if (!formConteudo.trim()) return;
    setSaving(true);
    try {
      const tagArr = formTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const data: Record<string, any> = {
        nome: formNome.trim(),
        descricao: formDescricao.trim() || undefined,
        categoria_id: formCategoriaId || null,
        tags: tagArr.length > 0 ? JSON.stringify(tagArr) : undefined,
        conteudo: formConteudo,
        ativo: true,
      };

      if (editingItem) {
        const res = await window.ipcAPI.peca.update(editingItem.id, data);
        if (res.success) {
          toast.success('Peça atualizada');
          loadData();
          setDialogOpen(false);
        } else toast.error(res.error || 'Erro ao atualizar');
      } else {
        const res = await window.ipcAPI.peca.create(data);
        if (res.success) {
          toast.success('Peça criada');
          loadData();
          setDialogOpen(false);
        } else toast.error(res.error || 'Erro ao criar');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    try {
      const res = await window.ipcAPI.peca.delete(deletingItem.id);
      if (res.success) {
        toast.success('Peça excluída');
        loadData();
      } else toast.error(res.error || 'Erro ao excluir');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingItem(null);
    }
  };

  const filteredPecas = pecas.filter(p => {
    if (categoriaFiltro !== 'todas') {
      if (categoriaFiltro === 'sem-categoria') {
        if (p.categoria_id) return false;
      } else if (p.categoria_id !== categoriaFiltro) {
        return false;
      }
    }
    if (busca) {
      const q = busca.toLowerCase();
      const tags: string[] = p.tags ? (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags) : [];
      return (
        p.nome.toLowerCase().includes(q) ||
        (p.descricao || '').toLowerCase().includes(q) ||
        (p.categoria_label || '').toLowerCase().includes(q) ||
        tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const columnas: ColumnDef<PecaItem>[] = [
    {
      accessorKey: 'nome',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Nome" />,
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.nome}</span>
          {row.original.descricao && (
            <p className="text-xs text-muted-foreground truncate max-w-[300px]">{row.original.descricao}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'categoria_id',
      header: 'Categoria',
      cell: ({ row }) => {
        const label = row.original.categoria_label;
        const cor = row.original.categoria_cor || 'slate';
        const icone = row.original.categoria_icone || 'Tag';
        const IconComp = (LucideIcons as any)[icone] || LucideIcons.Tag;
        return label ? (
          <Badge variant="secondary" className={`text-xs gap-1 bg-${cor}-100 dark:bg-${cor}-900/30 text-${cor}-700 dark:text-${cor}-300`}>
            <IconComp size={12} /> {label}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        );
      },
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      cell: ({ row }) => {
        const tags: string[] = row.original.tags ? (typeof row.original.tags === 'string' ? JSON.parse(row.original.tags) : row.original.tags) : [];
        return (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map(t => <Badge key={t} variant="outline" className="text-[10px] h-4 px-1.5">{t}</Badge>)}
            {tags.length > 3 && <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>}
          </div>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => handleEditar(row.original)}>
                <Edit size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => { setDeletingItem(row.original); setDeleteDialogOpen(true); }}>
                <Trash2 size={14} className="text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ];

  const renderCategoriaOptions = (cats: CategoriaArvore[], depth: number = 0): React.ReactNode[] => {
    const items: React.ReactNode[] = [];
    for (const cat of cats) {
      if (cat.id === 'cat-peca-sem-categoria') continue;
      items.push(
        <SelectItem key={cat.id} value={cat.id}>
          <span style={{ paddingLeft: depth * 12 }}>{depth > 0 ? '└ ' : ''}{cat.label}</span>
        </SelectItem>
      );
      if (cat.subcategorias?.length) {
        items.push(...renderCategoriaOptions(cat.subcategorias, depth + 1));
      }
    }
    return items;
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Banco de Peças</h1>
            <p className="text-muted-foreground mt-1">Gerencie os trechos de texto em lote. Peças também podem ser criadas inline durante a edição do wizard.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/categorias-pecas')} className="flex items-center gap-2">
              <Settings2 size={16} /> Categorias
            </Button>
            <Button onClick={handleNova} className="flex items-center gap-2">
              <Plus size={16} /> Nova Peça
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
              <div>
                <CardTitle>Lista de Peças</CardTitle>
                <CardDescription>{filteredPecas.length} peça(s) cadastrada(s)</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou tag..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    className="pl-8 w-[200px]"
                  />
                </div>
                <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {pecas.some(p => !p.categoria_id) && (
                      <SelectItem value="sem-categoria">Sem categoria</SelectItem>
                    )}
                    {renderCategoriaOptions(categoriasArvore)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPecas.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
                <Package size={48} />
                <p>Nenhuma peça encontrada</p>
                <Button variant="outline" size="sm" onClick={handleNova}>Criar primeira peça</Button>
              </div>
            ) : (
              <DataTable columns={columnas} data={filteredPecas} searchColumn="nome" searchPlaceholder="Buscar peça..." />
            )}
          </CardContent>
        </Card>

        {/* Dialog Criar/Editar */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Editar Peça' : 'Nova Peça'}</DialogTitle>
              <DialogDescription>
                {editingItem ? 'Altere os dados da peça.' : 'Preencha os dados para cadastrar uma nova peça.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="peca-nome">Nome *</Label>
                <Input id="peca-nome" value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Nome da peça" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peca-desc">Descrição</Label>
                <Input id="peca-desc" value={formDescricao} onChange={e => setFormDescricao(e.target.value)} placeholder="Breve descrição" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="peca-cat">Categoria</Label>
                  <Select value={formCategoriaId} onValueChange={v => setFormCategoriaId(v === 'none' ? '' : v)}>
                    <SelectTrigger id="peca-cat">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {renderCategoriaOptions(categoriasArvore)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="peca-tags">Tags (separadas por vírgula)</Label>
                  <Input id="peca-tags" value={formTags} onChange={e => setFormTags(e.target.value)} placeholder="revolver, taurus, calibre38" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="peca-conteudo">Conteúdo HTML *</Label>
                <Textarea
                  id="peca-conteudo"
                  value={formConteudo}
                  onChange={e => setFormConteudo(e.target.value)}
                  placeholder="<p>Trata-se de um revólver...</p>"
                  className="min-h-[150px] font-mono text-sm"
                />
              </div>
              {formConteudo && (
                <div className="space-y-2">
                  <Label>Prévia</Label>
                  <div className="border rounded-md p-4 prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: formConteudo }} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !formNome.trim() || !formConteudo.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Confirmar Exclusão */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir Peça</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir a peça &quot;{deletingItem?.nome}&quot;? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>Excluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default PecasPage;
