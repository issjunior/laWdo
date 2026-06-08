# Migração — PlaceholdersPage para Layout Hierárquico (2 painéis)

**Status:** ✅ IMPLEMENTADO
**Última atualização:** 2026-06-08

## Objetivo

Substituir o layout Kanban atual da `PlaceholdersPage.tsx` pelo mesmo layout 2-painéis do `CategoriasPecasPage.tsx`, com suporte a hierarquia (árvore) nas categorias de placeholder.

---

## Visão geral do novo layout

```
+------------------------------------+------------------------------------------+
| Painel Esquerdo (1/3)              | Painel Direito (2/3)                     |
| "Categorias"                       | "Placeholders — 🔫 Armas (12)"           |
|                                    |                                          |
| SortableCategoryTree               | [Buscar...]                    [+ Novo]  |
|  📁 Armas (12)          ← selec.   |                                          |
|    📁 Revólveres (4)               | | Chave            | Valor     | Ações  | |
|    📁 Pistolas (5)                 | | {{calibre}}      | .38       | ✏️ 🗑️ | |
|    📁 Espingardas (3)              | | {{marca}}        | Taurus    | ✏️ 🗑️ | |
|  📁 Veículos (5)                   | | {{modelo}}       | RT 85     | ✏️ 🗑️ | |
|  📁 Documentos (3)                 |                                          |
|                                    | [✏️ Editar Categoria] [🗑️ Excluir]      |
| [+ Nova Categoria]                 |                                          |
+------------------------------------+------------------------------------------+
```

### Painel direito — modo edição de categoria

Quando o botão "Editar Categoria" é clicado, um formulário inline aparece acima da DataTable:

```
+------------------------------------------+
| Painel Direito                           |
|                                          |
| ┌─ Editar Categoria ──────────────────┐ |
| │ [Nome: Armas] [Descrição: Opcional]  │ |
| │ Cor: ●●●●●●●●●●●●●●●●●●             │ |
| │ Ícone: [grid categorizado...]        │ |
| │ [Salvar] [Cancelar]                  │ |
| └──────────────────────────────────────┘ |
|                                          |
| [Buscar...]                    [+ Novo]  |
| DataTable de placeholders...             |
+------------------------------------------+
```

---

## Arquivos a modificar (5 arquivos)

### 1. `src/main/database/index.ts` — Migration v22

**Linha 20:** `CURRENT_SCHEMA_VERSION` de `21` → `22`.

**Adicionar migration v22** (~35 linhas, após o bloco da v21):

```sql
ALTER TABLE categorias_placeholders
  ADD COLUMN parent_id TEXT
  REFERENCES categorias_placeholders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categorias_placeholders_parent
  ON categorias_placeholders(parent_id);
```

---

### 2. `src/main/services/categoria-placeholder.service.ts` — Tree methods

| Mudança | Descrição |
|---------|-----------|
| `CategoriaPlaceholderRow` interface | Adicionar `parent_id: string \| null` |
| `findAllOrdered()` (novo) | `SELECT * FROM categorias_placeholders ORDER BY is_sistema DESC, ordem ASC, label ASC` |
| `findSubcategorias(parentId)` (novo) | `SELECT * FROM categorias_placeholders WHERE parent_id = ? ORDER BY ordem, label` |
| `findArvore()` (novo) | Busca ordenada + build recursivo (raiz = `parent_id IS NULL`, children em `subcategorias`) |
| `findWithDescendants(id)` (novo) | BFS traversal para buscar categoria + todos descendentes |
| `delete(id)` | Adicionar `UPDATE categorias_placeholders SET parent_id = NULL WHERE parent_id = ?` antes do DELETE (mover subcategorias para raiz) |

**Exemplo `findArvore()` (espelhado de `categoria-peca.service.ts:29-36`):**
```typescript
async findArvore(): Promise<(CategoriaPlaceholderRow & { subcategorias: CategoriaPlaceholderRow[] })[]> {
  const todas = await this.findAllOrdered();
  const build = (parentId: string | null) =>
    todas
      .filter(c => (parentId === null ? !c.parent_id : c.parent_id === parentId))
      .map(c => ({ ...c, subcategorias: build(c.id) }));
  return build(null);
}
```

---

### 3. `src/main/ipc/handlers/categoria-placeholder.handlers.ts` — Handlers

| Adicionar | Detalhe |
|-----------|---------|
| Handler `'categoria:findArvore'` | `service.findArvore()` → `{ success: true, data }` |
| `create` handler | Adicionar `parent_id: data.parent_id \|\| null` ao payload |
| `update` handler | Adicionar `if (data.parent_id !== undefined) updateData.parent_id = data.parent_id` |

---

### 4. `src/preload/index.ts` — IPC Bridge

| Local | Mudança |
|-------|---------|
| Interface `categoria` (~linha 120) | Adicionar `findArvore: () => Promise<UserResponse>` |
| Implementação (~linha 744) | Adicionar `findArvore: () => ipcRenderer.invoke('categoria:findArvore')` |
| `ALLOWED_CHANNELS` (~linha 317) | Adicionar `'categoria:findArvore'` |

---

### 5. `src/renderer/pages/PlaceholdersPage.tsx` — Reescrita completa

#### 5.1 — Imports

**Manter:**
```tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Placeholder } from '@/lib/validators';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { PLACEHOLDERS_SISTEMA_CHAVES, CAMPOS_ESPECIFICOS_PLACEHOLDERS } from '@/components/rep/exam-fields/placeholders';
import { ManageCategoriesModal } from '@/components/placeholders/ManageCategoriesModal';
import { SortableCategoryTree, type CategoriaNode } from '@/components/categorias/SortableCategoryTree';
```

**Remover:**
```tsx
- DndContext, useDroppable, useDraggable, DragOverlay, closestCorners (do @dnd-kit/core)
- DraggableCard, DroppableColumn (componentes internos)
- PlaceholderFormData, emptyForm, CategoriaPlaceholderRow
- LayoutGrid, List, ChevronDown, ChevronUp, Copy, Hash, Type, AlignLeft
```

**Adicionar:**
```tsx
+ import { Loader2, AlertCircle, Plus, Lock, Check, FolderTree, Search, Edit, Trash2, Settings } from 'lucide-react';
+ import * as LucideIcons from 'lucide-react';
+ import { ALLOWED_COLORS, ICON_CATEGORIES } from '@/pages/CategoriasPecasPage'; // ou duplicar as constantes
```

#### 5.2 — State

```tsx
// Dados principais
const [categorias, setCategorias] = useState<CategoriaFull[]>([]);  // árvore
const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Árvore / seleção
const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
const [editingCategory, setEditingCategory] = useState(false);       // toggle form inline

// Form categoria (edição inline)
const [catFormData, setCatFormData] = useState({ label: '', descricao: '', cor: 'slate', icone: 'Tag' });
const [savingCategory, setSavingCategory] = useState(false);
const [catFormError, setCatFormError] = useState<string | null>(null);

// Excluir categoria
const [deleteTarget, setDeleteTarget] = useState<CategoriaFull | null>(null);

// Busca de placeholders
const [searchTerm, setSearchTerm] = useState('');

// Dialog criar/editar placeholder
const [dialogOpen, setDialogOpen] = useState(false);
const [editingPlaceholder, setEditingPlaceholder] = useState<Placeholder | null>(null);
const [formData, setFormData] = useState({ chave: '', valor: '', descricao: '', categoria_id: '' });
const [formError, setFormErrorState] = useState<string | null>(null);

// Modal de gerenciar categorias (abre via botão "Gerenciar Categorias")
const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
```

#### 5.3 — Funções utilitárias de árvore

```tsx
interface CategoriaFull {
  id: string; chave: string; label: string; descricao: string | null;
  cor: string; icone: string; parent_id: string | null;
  is_sistema: number; ordem: number;
  subcategorias: CategoriaFull[];
}

function findCat(tree: CategoriaFull[], id: string): CategoriaFull | null { /* recursivo */ }
function toTreeNode(cat: CategoriaFull): CategoriaNode { /* id, label, cor, icone, is_sistema, ordem, subcategorias */ }

// Otimista: insertIntoTree, removeFromTree, moveNodeInTree, updateNodeInTree
// (idênticas às do CategoriasPecasPage)
```

#### 5.4 — Carregamento

```tsx
const carregarDados = useCallback(async () => {
  setLoading(true); setError(null);
  try {
    await window.ipcAPI.placeholder.migrateSistema();
    await window.ipcAPI.placeholder.seedSistema();
    const [rPlaceholders, rCategorias] = await Promise.all([
      window.ipcAPI.placeholder.findAll(),
      window.ipcAPI.categoria.findArvore(),   // NOVO: usa findArvore
    ]);
    if (rPlaceholders.success) setPlaceholders(rPlaceholders.data || []);
    if (rCategorias.success) setCategorias(rCategorias.data || []);
  } catch (e: any) {
    setError(e.message || 'Erro ao carregar');
  } finally {
    setLoading(false);
  }
}, []);
```

#### 5.5 — Handlers da árvore

```tsx
// Selecionar categoria → filtrar placeholders
const handleSelect = useCallback((id: string) => {
  setSelectedCatId(id);
  setEditingCategory(false);
}, []);

// Botão "+" no tree → abre ManageCategoriesModal
const handleTreeAdd = useCallback((parentId: string | null) => {
  setManageCategoriesOpen(true);  // ou abrir com parentId pré-definido
}, []);

// Drag para aninhar
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

const handleOutdent = useCallback((id: string) => handleMove(id, null), [handleMove]);
```

#### 5.6 — Edição inline de categoria

```tsx
// Entrar no modo edição
const handleEditCategory = () => {
  if (!selectedCat) return;
  setCatFormData({
    label: selectedCat.label,
    descricao: selectedCat.descricao || '',
    cor: selectedCat.cor || 'slate',
    icone: selectedCat.icone || 'Tag',
  });
  setCatFormError(null);
  setEditingCategory(true);
};

// Salvar edição
const handleSaveCategory = async () => {
  if (!catFormData.label.trim()) { setCatFormError('Nome obrigatório'); return; }
  if (!selectedCat) return;
  setSavingCategory(true); setCatFormError(null);
  const payload = { label: catFormData.label.trim(), descricao: catFormData.descricao.trim() || null, cor: catFormData.cor, icone: catFormData.icone };
  const prev = categorias;
  setCategorias(prev => prev.map(c => updateNodeInTree(c, selectedCat.id, payload)));
  try {
    const res = await window.ipcAPI.categoria.update(selectedCat.id, payload);
    if (res.success) { toast.success('Atualizada'); setEditingCategory(false); }
    else { setCategorias(prev); setCatFormError(res.error || 'Erro'); }
  } catch { setCategorias(prev); }
  setSavingCategory(false);
};

// Excluir
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
```

#### 5.7 — Placeholders (mantidos do código atual)

Handlers `handleNovo`, `handleEditar`, `handleExcluir`, `handleSalvar` e `columnDefs` da DataTable — mantidos com adaptações mínimas (remover referências a `categorias` antigo, usar `selectedCatId`).

#### 5.8 — Filtro

```tsx
const selectedCat = selectedCatId ? findCat(categorias, selectedCatId) : null;

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
```

#### 5.9 — JSX

Mesma estrutura flex do `CategoriasPecasPage`:

```tsx
// Loading / Error states
if (loading) return <Loader />;
if (error) return <Alert error />;

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
              onOutdent={handleOutdent}
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
                            const IconComp = (LucideIcons as any)[iconName];
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

            {/* Placeholders — busca + DataTable (visível apenas se categoria selecionada) */}
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
                  <DataTable columns={columnDefs} data={filtrados} searchColumn="chave" searchPlaceholder="Buscar placeholder..." hideSearch />
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
                Tem certeza que deseja excluir "{deleteTarget.label}"?
                Placeholders serão movidos para "Sem categoria".
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
        categorias={/* flat list from arvore */ }
        onCategoriasChange={carregarDados}
      />

      {/* Dialog criar/editar placeholder (mantido do código atual) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>...</Dialog>
    </div>
  </TooltipProvider>
);
```

#### 5.10 — Removido do código atual

| Removido | Motivo |
|----------|--------|
| `DraggableCard` (~65 linhas) | Substituído por DataTable |
| `DroppableColumn` (~120 linhas) | Substituído por layout 2-painéis |
| `viewMode` state e toggle | Sempre modo tabela |
| `expandedCategories` accordion | Sempre visível via árvore |
| `DndContext`, `DragOverlay` | Drag only no SortableCategoryTree |
| `showInstructions` | Desnecessário |
| `handleDragStart`, `handleDragEnd` | Drag só na árvore agora |

---

## Constantes compartilhadas

Para evitar duplicação, as constantes `ALLOWED_COLORS` e `ICON_CATEGORIES` podem ser extraídas para um módulo compartilhado (ex: `src/renderer/lib/category-constants.ts`) e importadas tanto por `CategoriasPecasPage` quanto por `PlaceholdersPage`.

Alternativamente, podem ser duplicadas inline em `PlaceholdersPage.tsx` (menos elegante, mas funcional).

---

## Resumo de impacto

| Camada | Arquivo | Linhas estimadas |
|--------|---------|-----------------|
| Database | `src/main/database/index.ts` | +35 (migration v22) |
| Service | `src/main/services/categoria-placeholder.service.ts` | +45 (tree methods) |
| Handlers | `src/main/ipc/handlers/categoria-placeholder.handlers.ts` | +25 (findArvore + parent_id) |
| Preload | `src/preload/index.ts` | +8 (IPC bridge) |
| Frontend | `src/renderer/pages/PlaceholdersPage.tsx` | -200 (remove Kanban) + ~250 (novo layout) = +50 net |
| **Total** | **5 arquivos** | **~+163 linhas líquidas** |

---

## Ordem de implementação

1. **Database** — migration v22 (adiciona `parent_id`)
2. **Service** — tree methods, update delete
3. **Handlers** — findArvore handler, parent_id no create/update
4. **Preload** — IPC bridge
5. **Frontend** — reescrita da PlaceholdersPage

---

## Divergências da Implementação

| Aspecto | Planejado | Implementado |
|---------|-----------|--------------|
| Constantes `ALLOWED_COLORS` e `ICON_CATEGORIES` | Extrair para módulo compartilhado `src/renderer/lib/category-constants.ts` **ou** duplicar inline | Extraídas para `src/renderer/lib/category-constants.ts` — importadas por `CategoriasPecasPage` e `PlaceholdersPage` |
| Schema version | v21 → v22 | `CURRENT_SCHEMA_VERSION = 22` em `src/main/database/index.ts:20` |
| Cor `amber` | Suficiente para I-801 | `ALLOWED_COLORS` expandido para 19 cores (slate, gray, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose) |
| Ícone I-801 | `Hash` (conforme `ciclo_placeholder.md`) | Implementado como `Car` no seed (`placeholder.service.ts:50`) |

## Estrutura de Arquivos Resultante (pós-implementação)

```
src/
├── main/
│   ├── database/index.ts                         # CURRENT_SCHEMA_VERSION = 22, migration v22 (parent_id)
│   ├── services/categoria-placeholder.service.ts # + findArvore, findSubcategorias, findWithDescendants, delete com parent_id=NULL
│   ├── ipc/handlers/categoria-placeholder.handlers.ts  # + handler 'categoria:findArvore', parent_id no create/update
├── preload/index.ts                              # + findArvore IPC bridge, ALLOWED_CHANNELS
└── renderer/
    ├── lib/category-constants.ts                 # NOVO — ALLOWED_COLORS + ICON_CATEGORIES
    └── pages/PlaceholdersPage.tsx                # REESCRITO — layout 2-painéis, SortableCategoryTree + DataTable
```
