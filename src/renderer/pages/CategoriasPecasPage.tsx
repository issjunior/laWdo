import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Plus, Lock, Check, FolderTree } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { SortableCategoryTree, type CategoriaNode } from '@/components/categorias/SortableCategoryTree';
import { toast } from 'sonner';

const ALLOWED_COLORS = ['slate', 'gray', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];

const ICON_CATEGORIES = [
  {
    label: 'Armas / Balística',
    icons: ['Sword', 'Swords', 'Bomb', 'Target', 'Crosshair', 'ShieldOff', 'ShieldAlert'],
  },
  {
    label: 'Laboratório / Química',
    icons: ['Microscope', 'FlaskConical', 'FlaskRound', 'TestTube', 'TestTubes', 'Beaker', 'Dna', 'Thermometer', 'Droplets'],
  },
  {
    label: 'Veículos',
    icons: ['Car', 'CarFront', 'Truck', 'Bus', 'Ship', 'Plane', 'Bike', 'Navigation', 'Compass', 'Anchor'],
  },
  {
    label: 'Forense Digital',
    icons: ['Smartphone', 'HardDrive', 'Monitor', 'Camera', 'Database', 'Binary', 'Laptop', 'Cpu', 'Server', 'Usb', 'Wifi', 'Router'],
  },
  {
    label: 'Documentação',
    icons: ['ClipboardList', 'ClipboardCheck', 'FileSearch', 'FileWarning', 'NotebookPen', 'BookOpen', 'BookText', 'Bookmark', 'File', 'FileText', 'Copy', 'Map', 'Image'],
  },
  {
    label: 'Vestígios / Objetos',
    icons: ['Footprints', 'Glasses', 'Scan', 'ScanFace', 'ScanEye', 'Fingerprint', 'Syringe', 'Pill', 'Bone', 'PawPrint', 'Leaf', 'Shell', 'DollarSign', 'Banknote', 'Wallet', 'Gem', 'Crown'],
  },
  {
    label: 'Ferramentas',
    icons: ['Ruler', 'Wrench', 'Hammer', 'Axe', 'Drill', 'Shovel', 'Scissors', 'Flashlight', 'Tool', 'Settings'],
  },
  {
    label: 'Justiça / Geral Forense',
    icons: ['Scale', 'Skull', 'Gavel', 'Siren', 'Cctv', 'Satellite', 'Radio', 'Megaphone', 'BrainCircuit', 'Shield', 'Lock', 'Key', 'Weight'],
  },
  {
    label: 'Geral',
    icons: ['Tag', 'Folder', 'Box', 'Layers', 'Puzzle', 'User', 'Users', 'UserCheck', 'Briefcase', 'Building', 'MapPin', 'Calendar', 'Clock', 'Zap', 'Star', 'Heart', 'Flag', 'Bell', 'Info', 'AlertCircle', 'CheckCircle', 'Flame', 'Wind', 'Globe', 'Tv', 'Printer', 'Medal', 'Award', 'Trophy', 'BadgeCheck', 'ShieldCheck'],
  },
];

interface CategoriaFull {
  id: string;
  chave: string;
  label: string;
  descricao: string | null;
  cor: string;
  icone: string;
  parent_id: string | null;
  is_sistema: number;
  ordem: number;
  subcategorias: CategoriaFull[];
}

function toTreeNode(cat: CategoriaFull): CategoriaNode {
  return {
    id: cat.id,
    label: cat.label,
    cor: cat.cor || 'slate',
    icone: cat.icone || 'Tag',
    is_sistema: cat.is_sistema,
    ordem: cat.ordem,
    subcategorias: (cat.subcategorias || []).map(toTreeNode),
  };
}

function removeFromTree(nodes: CategoriaFull[], id: string): { node: CategoriaFull | null; tree: CategoriaFull[] } {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      return { node: nodes[i], tree: [...nodes.slice(0, i), ...nodes.slice(i + 1)] };
    }
    const { node, tree: updated } = removeFromTree(nodes[i].subcategorias || [], id);
    if (node) {
      const newNodes = [...nodes];
      newNodes[i] = { ...nodes[i], subcategorias: updated };
      return { node, tree: newNodes };
    }
  }
  return { node: null, tree: nodes };
}

function insertIntoTree(nodes: CategoriaFull[], targetId: string, node: CategoriaFull): CategoriaFull[] {
  return nodes.map(n => {
    if (n.id === targetId) {
      return { ...n, subcategorias: [...(n.subcategorias || []), node] };
    }
    return { ...n, subcategorias: insertIntoTree(n.subcategorias || [], targetId, node) };
  });
}

function moveNodeInTree(tree: CategoriaFull[], nodeId: string, newParentId: string | null): CategoriaFull[] {
  const { node: removed, tree: without } = removeFromTree(tree, nodeId);
  if (!removed) return tree;
  if (!newParentId) return [...without, removed];
  return insertIntoTree(without, newParentId, removed);
}

function updateNodeInTree(node: CategoriaFull, id: string, updates: Partial<CategoriaFull>): CategoriaFull {
  if (node.id === id) return { ...node, ...updates };
  return { ...node, subcategorias: (node.subcategorias || []).map(c => updateNodeInTree(c, id, updates)) };
}

const emptyForm = { label: '', descricao: '', cor: 'slate', icone: 'Tag' };

const CategoriasPecasPage: React.FC = () => {
  const [arvore, setArvore] = useState<CategoriaFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [parentForNew, setParentForNew] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoriaFull | null>(null);

  const selectedCat = selectedId ? findCat(arvore, selectedId) : null;

  function findCat(tree: CategoriaFull[], id: string): CategoriaFull | null {
    for (const cat of tree) {
      if (cat.id === id) return cat;
      const found = findCat(cat.subcategorias || [], id);
      if (found) return found;
    }
    return null;
  }

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await window.ipcAPI.categoriaPeca.findArvore();
      if (res.success) {
        setArvore(res.data || []);
      } else {
        if (!silent) setError(res.error || 'Erro ao carregar');
      }
    } catch (e: any) {
      if (!silent) setError(e.message || 'Erro');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // When selection exists but category not found locally, reload silently
  useEffect(() => {
    if (selectedId && !selectedCat && !loading) {
      loadData(true);
    }
  }, [selectedId, selectedCat, loading, loadData]);

  // When selected changes, update form
  useEffect(() => {
    if (selectedCat) {
      setIsCreating(false);
      setFormData({
        label: selectedCat.label,
        descricao: selectedCat.descricao || '',
        cor: selectedCat.cor || 'slate',
        icone: selectedCat.icone || 'Tag',
      });
      setFormError(null);
    }
  }, [selectedId, arvore]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setIsCreating(false);
    setParentForNew(null);
  }, []);

  const handleAdd = useCallback((parentId: string | null) => {
    setSelectedId(null);
    setIsCreating(true);
    setParentForNew(parentId);
    setFormData({ ...emptyForm, cor: 'slate', icone: 'Tag' });
    setFormError(null);
  }, []);

  const handleSave = async () => {
    if (!formData.label.trim()) {
      setFormError('Nome da categoria é obrigatório.');
      return;
    }
    setSaving(true);
    setFormError(null);

    const generatedChave = formData.label
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

    const payload: Record<string, any> = {
      label: formData.label.trim(),
      descricao: formData.descricao.trim() || null,
      cor: formData.cor,
      icone: formData.icone,
    };

    try {
      if (isCreating) {
        payload.chave = generatedChave;
        payload.parent_id = parentForNew || null;
        payload.is_sistema = 0;
        payload.ordem = 99;

        // Optimistic: placeholder node before API responds
        const tempId = `temp-${Date.now()}`;
        const placeholder: CategoriaFull = {
          id: tempId,
          chave: generatedChave,
          label: formData.label.trim(),
          descricao: formData.descricao.trim() || null,
          cor: formData.cor,
          icone: formData.icone,
          parent_id: parentForNew || null,
          is_sistema: 0,
          ordem: 99,
          subcategorias: [],
        };

        const prevArvore = arvore;
        setArvore(prev => {
          if (!placeholder.parent_id) return [...prev, placeholder];
          return insertIntoTree(prev, placeholder.parent_id, placeholder);
        });

        const res = await window.ipcAPI.categoriaPeca.create(payload);
        if (res.success) {
          toast.success('Categoria criada');
          setArvore(prev => {
            const without = removeFromTree(prev, tempId).tree;
            const real: CategoriaFull = { ...res.data, subcategorias: [] };
            if (!real.parent_id) return [...without, real];
            return insertIntoTree(without, real.parent_id, real);
          });
          setSelectedId(res.data?.id || null);
          setIsCreating(false);
          setParentForNew(null);
        } else {
          setArvore(prevArvore);
          setFormError(res.error || 'Erro ao criar');
        }
      } else if (selectedCat) {
        if (selectedCat.is_sistema === 1) {
          const prevArvore = arvore;
          setArvore(prev => prev.map(c => updateNodeInTree(c, selectedCat.id, { cor: formData.cor, icone: formData.icone })));
          const res = await window.ipcAPI.categoriaPeca.update(selectedCat.id, { cor: formData.cor, icone: formData.icone });
          if (res.success) {
            toast.success('Categoria atualizada');
          } else {
            setArvore(prevArvore);
            setFormError(res.error || 'Erro ao atualizar');
          }
        } else {
          const prevArvore = arvore;
          setArvore(prev => prev.map(c => updateNodeInTree(c, selectedCat.id, payload)));
          const res = await window.ipcAPI.categoriaPeca.update(selectedCat.id, payload);
          if (res.success) {
            toast.success('Categoria atualizada');
          } else {
            setArvore(prevArvore);
            setFormError(res.error || 'Erro ao atualizar');
          }
        }
      }
    } catch (e: any) {
      setFormError(e.message || 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const handleMove = useCallback(async (id: string, newParentId: string | null) => {
    const cat = findCat(arvore, id);
    if (cat?.is_sistema === 1) return;

    const prevArvore = arvore;
    setArvore(prev => moveNodeInTree(prev, id, newParentId));

    try {
      const res = await window.ipcAPI.categoriaPeca.update(id, { parent_id: newParentId });
      if (res.success) {
        toast.success('Categoria movida');
      } else {
        setArvore(prevArvore);
        toast.error(res.error || 'Erro ao mover');
      }
    } catch (e: any) {
      setArvore(prevArvore);
      toast.error(e.message || 'Erro');
    }
  }, [arvore]);

  const handleOutdent = useCallback(async (id: string) => {
    await handleMove(id, null);
  }, [handleMove]);

  const handleDelete = useCallback((id: string) => {
    const cat = findCat(arvore, id);
    if (cat) setDeleteTarget(cat);
  }, [arvore]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    const prevArvore = arvore;

    setArvore(prev => removeFromTree(prev, targetId).tree);
    setDeleteTarget(null);
    if (selectedId === targetId) setSelectedId(null);

    try {
      const res = await window.ipcAPI.categoriaPeca.delete(targetId);
      if (res.success) {
        toast.success('Categoria excluída');
      } else {
        setArvore(prevArvore);
        toast.error(res.error || 'Erro ao excluir');
      }
    } catch (e: any) {
      setArvore(prevArvore);
      toast.error(e.message || 'Erro');
    }
  };

  const arvoreNodes: CategoriaNode[] = arvore
    .filter(c => c.id !== 'cat-peca-sem-categoria')
    .map(toTreeNode);

  if (loading) return (
    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
  );

  if (error) return (
    <div className="container p-6">
      <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
      <Button variant="outline" onClick={loadData} className="mt-4">Tentar novamente</Button>
    </div>
  );

  return (
    <div className="container mx-auto h-full flex flex-col p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Categorias de Peças</h1>
          <p className="text-muted-foreground mt-1">
            Organize as categorias e subcategorias. Arraste para aninhar.
          </p>
        </div>
        <Button onClick={() => handleAdd(null)} className="flex items-center gap-2">
          <Plus size={16} /> Nova Categoria
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left: Tree */}
        <Card className="lg:col-span-1 flex flex-col min-h-0">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderTree size={18} /> Árvore
            </CardTitle>
            <CardDescription>
              Arraste categorias sobre outras para aninhar. Solte fora para desaninhar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto">
            <SortableCategoryTree
              arvore={arvoreNodes}
              selectedId={selectedId}
              onSelect={handleSelect}
              onAdd={handleAdd}
              onMove={handleMove}
              onOutdent={handleOutdent}
            />
          </CardContent>
        </Card>

        {/* Right: Form / Info */}
        <Card className="lg:col-span-2 flex flex-col min-h-0">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-base">
              {isCreating ? 'Nova Categoria' : selectedCat ? 'Editar Categoria' : 'Selecione uma categoria'}
            </CardTitle>
            <CardDescription>
              {isCreating
                ? parentForNew ? 'Criando subcategoria' : 'Criando categoria raiz'
                : selectedCat
                  ? selectedCat.is_sistema === 1
                    ? 'Categoria do sistema — apenas cor e ícone podem ser alterados.'
                    : 'Altere os dados da categoria.'
                  : 'Clique em uma categoria na árvore para editá-la.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 min-h-0 overflow-y-auto">
            {!isCreating && selectedCat && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleAdd(selectedCat.id)}
              >
                <Plus size={14} className="mr-1" /> Nova Subcategoria
              </Button>
            )}

            {formError && (
              <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>
            )}

            {(isCreating || selectedCat) ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={formData.label}
                      onChange={e => setFormData({ ...formData, label: e.target.value })}
                      placeholder="Ex: Armas"
                      disabled={selectedCat?.is_sistema === 1 && !isCreating}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      value={formData.descricao}
                      onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Opcional..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex flex-wrap gap-2 py-1">
                    {ALLOWED_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, cor: color })}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all bg-${color}-500 hover:scale-110 ${formData.cor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                        title={color}
                      >
                        {formData.cor === color && <Check size={14} className="text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Ícone</Label>
                  <div className="border rounded-lg p-3 h-40 resize-y min-h-[120px] max-h-[400px] overflow-y-auto bg-muted/10">
                    {ICON_CATEGORIES.map(cat => (
                      <div key={cat.label} className="mb-3 last:mb-0">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">{cat.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {cat.icons.map(iconName => {
                            const IconComp = (LucideIcons as any)[iconName];
                            if (!IconComp) return null;
                            return (
                              <button
                                key={iconName}
                                type="button"
                                onClick={() => setFormData({ ...formData, icone: iconName })}
                                className={`p-1.5 rounded-md flex justify-center items-center hover:bg-muted transition-colors ${formData.icone === iconName ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground'}`}
                                title={iconName}
                              >
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
                  <Button onClick={handleSave} disabled={saving} className="flex-1">
                    {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
                    {isCreating ? 'Criar' : 'Salvar'}
                  </Button>
                  {!isCreating && selectedCat && selectedCat.is_sistema !== 1 && (
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(selectedCat.id)}
                      disabled={saving}
                    >
                      Excluir
                    </Button>
                  )}
                  {isCreating && (
                    <Button variant="outline" onClick={() => { setIsCreating(false); setParentForNew(null); setSelectedId(null); }}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <FolderTree size={40} className="opacity-30" />
                <p className="text-sm">Selecione uma categoria na árvore ou crie uma nova.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog (inline) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4 shadow-xl">
            <CardHeader>
              <CardTitle>Excluir Categoria</CardTitle>
              <CardDescription>
                Tem certeza que deseja excluir "{deleteTarget.label}"?
                {deleteTarget.subcategorias?.length > 0 && (
                  <span className="block mt-1 text-destructive font-medium">
                    Suas subcategorias serão movidas para raiz.
                  </span>
                )}
                Peças nesta categoria serão movidas para "Sem categoria".
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                <Button variant="destructive" onClick={confirmDelete}>Excluir</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CategoriasPecasPage;
