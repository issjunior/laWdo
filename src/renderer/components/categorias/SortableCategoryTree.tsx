import React, { useState, useCallback, useEffect } from 'react';
import {
  DndContext, closestCenter, useDraggable, useDroppable,
  DragOverlay, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import * as LucideIcons from 'lucide-react';
import {
  ChevronRight, GripVertical, Lock, FolderTree,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CategoriaNode {
  id: string;
  label: string;
  cor: string;
  icone: string;
  is_sistema: number;
  ordem: number;
  subcategorias: CategoriaNode[];
}

export interface SortableCategoryTreeProps {
  arvore: CategoriaNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (parentId: string | null) => void;
  onMove: (id: string, newParentId: string | null) => void;
}

function getDescendantIds(node: CategoriaNode): Set<string> {
  const ids = new Set<string>();
  for (const sub of node.subcategorias) {
    ids.add(sub.id);
    for (const id of getDescendantIds(sub)) ids.add(id);
  }
  return ids;
}

function findNodeById(tree: CategoriaNode[], id: string): CategoriaNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findNodeById(node.subcategorias, id);
    if (found) return found;
  }
  return null;
}

interface TreeNodeProps {
  node: CategoriaNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (parentId: string | null) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node, depth, selectedId, onSelect, onAdd,
}) => {
  const [expanded, setExpanded] = useState(true);

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: node.id,
    data: { node },
    disabled: node.is_sistema === 1,
  });

  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `drop-${node.id}`,
    data: { node, type: 'nest' },
  });

  // Auto-expand when hovered during drag (reveals where item will land)
  useEffect(() => {
    if (isOver && !expanded && node.subcategorias.length > 0) {
      setExpanded(true);
    }
  }, [isOver, expanded, node.subcategorias.length]);

  const IconComp = (LucideIcons as any)[node.icone] || LucideIcons.Folder;
  const isSys = node.is_sistema === 1;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id);
  };

  return (
    <div>
      <div
        ref={(el) => { setDragRef(el); setDropRef(el); }}
        onClick={handleClick}
        className={cn(
          'flex items-center gap-1 py-1.5 pr-2 rounded-md cursor-pointer group transition-all',
          selectedId === node.id && 'bg-primary/10 text-primary border border-primary/20',
          selectedId !== node.id && 'hover:bg-muted/60 border border-transparent',
          isOver && 'ring-2 ring-primary/40 bg-primary/5 shadow-sm',
          isDragging && 'opacity-0',
        )}
        style={transform ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          paddingLeft: 4 + depth * 24,
          zIndex: 50,
        } : { paddingLeft: 4 + depth * 24 }}
      >
        {/* Drag handle (non-system only) */}
        {!isSys ? (
          <button
            {...listeners}
            {...attributes}
            className="p-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0"
            onClick={(e) => e.stopPropagation()}
            title="Arraste para reordenar"
          >
            <GripVertical size={14} />
          </button>
        ) : (
          <span className="w-[22px] shrink-0" />
        )}

        {/* Expand/collapse */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className={cn('p-0.5 hover:bg-muted rounded shrink-0', node.subcategorias.length === 0 && 'invisible')}
        >
          <ChevronRight size={14} className={cn('transition-transform text-muted-foreground', expanded && 'rotate-90')} />
        </button>

        {/* Icon */}
        <div className={cn(
          'w-6 h-6 rounded flex items-center justify-center shrink-0',
          `bg-${node.cor}-100 dark:bg-${node.cor}-900/30`,
          `text-${node.cor}-600 dark:text-${node.cor}-400`,
        )}>
          <IconComp size={14} />
        </div>

        {/* Label */}
        <span className="text-sm font-medium truncate flex-1 select-none">{node.label}</span>

        {/* System badge */}
        {isSys && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0" title="Categoria do sistema">
            <Lock size={10} />
          </span>
        )}

        {/* Count badge */}
        {node.subcategorias.length > 0 && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded shrink-0 select-none">
            {node.subcategorias.length}
          </span>
        )}

      </div>

      {/* Children */}
      {expanded && node.subcategorias.length > 0 && (
        <div>
          {node.subcategorias.map((sub) => (
            <TreeNode
              key={sub.id}
              node={sub}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAdd={onAdd}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function DroppableRoot({ children }: { children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'root-drop',
    data: { type: 'root' },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg border-2 border-transparent transition-colors min-h-[60px]',
        isOver && 'border-dashed border-primary/40 bg-primary/5',
      )}
    >
      {children}
      {isOver && (
        <div className="text-xs text-muted-foreground text-center py-3">
          Solte aqui para tornar categoria raiz
        </div>
      )}
    </div>
  );
}

export function SortableCategoryTree({
  arvore, selectedId, onSelect, onAdd, onMove,
}: SortableCategoryTreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const draggedId = active.id as string;
    const targetId = over.id as string;

    if (draggedId === targetId) return;
    if (draggedId === targetId.replace('drop-', '')) return;

    // Prevent dropping on own descendants
    const draggedNode = findNodeById(arvore, draggedId);
    if (draggedNode) {
      const descendants = getDescendantIds(draggedNode);
      const cleanTarget = targetId.startsWith('drop-') ? targetId.replace('drop-', '') : targetId;
      if (descendants.has(cleanTarget)) return;
    }

    if (targetId === 'root-drop') {
      onMove(draggedId, null);
    } else if (targetId.startsWith('drop-')) {
      const parentId = targetId.replace('drop-', '');
      if (parentId === draggedId) return;
      onMove(draggedId, parentId);
    }
  }, [arvore, onMove]);

  const activeNode = activeId ? findNodeById(arvore, activeId) : null;

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <DroppableRoot>
        {arvore.length === 0 && !activeId ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <FolderTree size={40} className="opacity-30" />
            <p className="text-sm">Nenhuma categoria criada</p>
          </div>
        ) : (
            arvore.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              onSelect={onSelect}
              onAdd={onAdd}
            />
          ))
        )}
      </DroppableRoot>

      <DragOverlay dropAnimation={null}>
        {activeNode ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-background border shadow-lg rounded-md opacity-95">
            <div className={cn(
              'w-6 h-6 rounded flex items-center justify-center',
              `bg-${activeNode.cor}-100 dark:bg-${activeNode.cor}-900/30`,
            )}>
              {(() => {
                const Icon = (LucideIcons as any)[activeNode.icone] || LucideIcons.Folder;
                return <Icon size={14} />;
              })()}
            </div>
            <span className="text-sm font-medium">{activeNode.label}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
