export interface CategoriaFull {
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

export interface ParentOption {
  value: string;
  label: string;
}

export function findCat(tree: CategoriaFull[], id: string): CategoriaFull | null {
  for (const cat of tree) {
    if (cat.id === id) return cat;
    const found = findCat(cat.subcategorias || [], id);
    if (found) return found;
  }
  return null;
}

export function removeFromTree(nodes: CategoriaFull[], id: string): { node: CategoriaFull | null; tree: CategoriaFull[] } {
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

export function insertIntoTree(nodes: CategoriaFull[], targetId: string, node: CategoriaFull): CategoriaFull[] {
  return nodes.map(n => {
    if (n.id === targetId) {
      return { ...n, subcategorias: [...(n.subcategorias || []), node] };
    }
    return { ...n, subcategorias: insertIntoTree(n.subcategorias || [], targetId, node) };
  });
}

export function moveNodeInTree(tree: CategoriaFull[], nodeId: string, newParentId: string | null): CategoriaFull[] {
  const { node: removed, tree: without } = removeFromTree(tree, nodeId);
  if (!removed) return tree;
  if (!newParentId) return [...without, removed];
  return insertIntoTree(without, newParentId, removed);
}

export function updateNodeInTree(node: CategoriaFull, id: string, updates: Partial<CategoriaFull>): CategoriaFull {
  if (node.id === id) return { ...node, ...updates };
  return { ...node, subcategorias: (node.subcategorias || []).map(c => updateNodeInTree(c, id, updates)) };
}

export function flattenTree(tree: CategoriaFull[]): CategoriaFull[] {
  const result: CategoriaFull[] = [];
  for (const node of tree) {
    result.push(node);
    result.push(...flattenTree(node.subcategorias || []));
  }
  return result;
}

function getDescendantIds(tree: CategoriaFull[], id: string): Set<string> {
  const node = findCat(tree, id);
  if (!node) return new Set();
  const ids = new Set<string>();
  for (const sub of node.subcategorias || []) {
    ids.add(sub.id);
    for (const sid of getDescendantIds(node.subcategorias || [], sub.id)) ids.add(sid);
  }
  return ids;
}

export function buildParentOptions(tree: CategoriaFull[], excludeId: string, noParentLabel = '(Raiz — sem categoria pai)'): ParentOption[] {
  const excludeIds = getDescendantIds(tree, excludeId);
  excludeIds.add(excludeId);

  const options: ParentOption[] = [{ value: '__none__', label: noParentLabel }];

  function walk(nodes: CategoriaFull[]) {
    for (const node of nodes) {
      if (excludeIds.has(node.id)) continue;
      options.push({ value: node.id, label: node.label });
      walk(node.subcategorias || []);
    }
  }

  walk(tree);
  return options;
}

import type { CategoriaNode } from '@/components/categorias/SortableCategoryTree';

export function toTreeNode(cat: CategoriaFull): CategoriaNode {
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
