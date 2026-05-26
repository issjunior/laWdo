import React from 'react';
import * as LucideIcons from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export interface PlaceholderItem {
  id: string;
  chave: string;
  descricao: string;
  categoria_id: string;
}

export interface CategoriaItem {
  id: string;
  label: string;
  icone: string;
  cor: string;
}

export const PlaceholderContextMenu: React.FC<{
  editorId: string;
  categorias: CategoriaItem[];
  placeholders: PlaceholderItem[];
  onInsertPlaceholder: (editorId: string, chave: string) => void;
  children: React.ReactNode;
}> = ({ editorId, categorias, placeholders, onInsertPlaceholder, children }) => (
  <ContextMenu>
    <ContextMenuTrigger asChild>
      {children}
    </ContextMenuTrigger>
    <ContextMenuContent className="w-64">
      <ContextMenuLabel>Inserir Placeholder</ContextMenuLabel>
      <ContextMenuSeparator />
      {categorias
        .sort((a, b) => {
          const aIsExam = (a as any).id?.startsWith('cat-exam-');
          const bIsExam = (b as any).id?.startsWith('cat-exam-');
          const ordemA = aIsExam ? 1 : ((a as any).is_sistema === 1 ? 0 : 2);
          const ordemB = bIsExam ? 1 : ((b as any).is_sistema === 1 ? 0 : 2);
          return ordemA - ordemB;
        })
        .map(cat => {
          const items = placeholders.filter(p => p.categoria_id === cat.id);
          if (items.length === 0) return null;
          const IconComp = (LucideIcons as any)[(cat as any).icone] || LucideIcons.Tag;
          return (
            <ContextMenuSub key={cat.id}>
              <ContextMenuSubTrigger>
                <IconComp size={(cat as any).icone === 'Car' ? 16 : 14} className="mr-2" />
                <span>{cat.label}</span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-56 max-h-[350px] overflow-y-auto">
                {items
                  .sort((a, b) => a.chave.localeCompare(b.chave))
                  .map(p => {
                    return (
                      <ContextMenuItem
                        key={p.id}
                        onClick={() => onInsertPlaceholder(editorId, p.chave)}
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <code className="font-mono text-xs font-semibold">{`{{${p.chave}}}`}</code>
                          </div>
                          {p.descricao && (
                            <span className="text-[10px] text-muted-foreground truncate">{p.descricao}</span>
                          )}
                        </div>
                      </ContextMenuItem>
                    );
                  })}
              </ContextMenuSubContent>
            </ContextMenuSub>
          );
        })}
    </ContextMenuContent>
  </ContextMenu>
);

export default PlaceholderContextMenu;
