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
import type { MenuSection, MenuSectionItem, MenuEntry, MenuGroup } from '@/components/rep/exam-fields';
import { getGroupCount } from '@/components/rep/exam-fields/b602-menu';

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

const PlaceholderItemView: React.FC<{ chave: string; descricao: string }> = ({ chave, descricao }) => (
  <div className="flex flex-col gap-0.5">
    <div className="flex items-center gap-1.5">
      <code className="font-mono text-xs font-semibold">{`{{${chave}}}`}</code>
    </div>
    {descricao && (
      <span className="text-[10px] text-muted-foreground truncate">{descricao}</span>
    )}
  </div>
);

function buildPlaceholderKey(prefix: string, n: number, fieldName: string): string {
  if (!fieldName) return `${prefix}${n}`;
  return `${prefix}${n}_${fieldName}`;
}

export const PlaceholderContextMenu: React.FC<{
  editorId: string;
  categorias: CategoriaItem[];
  placeholders: PlaceholderItem[];
  exameMenuStructure?: MenuSection[];
  exameCamposEspecificos?: Record<string, unknown>;
  categoriaExameId?: string;
  onInsertPlaceholder: (editorId: string, chave: string) => void;
  children: React.ReactNode;
}> = ({
  editorId,
  categorias,
  placeholders,
  exameMenuStructure,
  exameCamposEspecificos,
  categoriaExameId,
  onInsertPlaceholder,
  children,
}) => {
  const categoriasFiltradas = categorias.filter(cat => {
    if (cat.id === categoriaExameId) return true;
    return !cat.id.startsWith('cat-exam-');
  });

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuLabel>Inserir Placeholder</ContextMenuLabel>
        <ContextMenuSeparator />
        {categoriasFiltradas
          .sort((a, b) => {
            const aIsExam = a.id.startsWith('cat-exam-');
            const bIsExam = b.id.startsWith('cat-exam-');
            const ordemA = aIsExam ? 1 : ((a as any).is_sistema === 1 ? 0 : 2);
            const ordemB = bIsExam ? 1 : ((b as any).is_sistema === 1 ? 0 : 2);
            return ordemA - ordemB;
          })
          .map(cat => {
            const isExamCat = cat.id === categoriaExameId;

            if (isExamCat && exameMenuStructure && exameMenuStructure.length > 0) {
              const IconComp = (LucideIcons as any)[(cat as any).icone] || LucideIcons.Tag;
              return (
                <ContextMenuSub key={cat.id}>
                  <ContextMenuSubTrigger>
                    <IconComp size={14} className="mr-2" />
                    <span>{cat.label}</span>
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-64 max-h-[400px] overflow-y-auto">
                    {exameMenuStructure.map(section => (
                      <ExamSectionSubmenu
                        key={section.id}
                        section={section}
                        b602Data={exameCamposEspecificos}
                        editorId={editorId}
                        onInsertPlaceholder={onInsertPlaceholder}
                      />
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              );
            }

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
                    .map(p => (
                      <ContextMenuItem
                        key={p.id}
                        onClick={() => onInsertPlaceholder(editorId, p.chave)}
                      >
                        <PlaceholderItemView chave={p.chave} descricao={p.descricao} />
                      </ContextMenuItem>
                    ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            );
          })}
      </ContextMenuContent>
    </ContextMenu>
  );
};

const ExamSectionSubmenu: React.FC<{
  section: MenuSection;
  b602Data: Record<string, unknown> | undefined;
  editorId: string;
  onInsertPlaceholder: (editorId: string, chave: string) => void;
}> = ({ section, b602Data, editorId, onInsertPlaceholder }) => (
  <ContextMenuSub key={section.id}>
    <ContextMenuSubTrigger>
      <span className="text-sm font-medium">{section.label}</span>
    </ContextMenuSubTrigger>
    <ContextMenuSubContent className="w-64 max-h-[350px] overflow-y-auto">
      {section.items.map((item, idx) => {
        if (item.type === 'field') {
          const entry = item as MenuEntry;
          return (
            <ContextMenuItem
              key={`${section.id}-field-${idx}`}
              onClick={() => onInsertPlaceholder(editorId, entry.name)}
            >
              <PlaceholderItemView chave={entry.name} descricao={entry.label} />
            </ContextMenuItem>
          );
        }

        if (item.type === 'group') {
          const group = item as MenuGroup;
          const count = getGroupCount(group.prefix, b602Data);

          if (count === 0) return null;

          return (
            <ContextMenuSub key={`${section.id}-group-${idx}`}>
              <ContextMenuSubTrigger>
                <span className="text-sm">{group.label}</span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-64 max-h-[350px] overflow-y-auto">
                {Array.from({ length: count }, (_, i) => {
                  const n = i + 1;
                  const chave = buildPlaceholderKey(group.prefix, n, group.fields[0]?.name || '');

                  if (group.fields.length === 1) {
                    return (
                      <ContextMenuItem
                        key={`${group.prefix}${n}`}
                        onClick={() => onInsertPlaceholder(editorId, chave)}
                      >
                        <PlaceholderItemView
                          chave={chave}
                          descricao={`${group.label} ${n}`}
                        />
                      </ContextMenuItem>
                    );
                  }

                  return (
                    <ContextMenuSub key={`${group.prefix}${n}`}>
                      <ContextMenuSubTrigger>
                        <span className="text-sm">{group.label} {n}</span>
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-56 max-h-[300px] overflow-y-auto">
                        {group.fields.map(field => {
                          const fchave = buildPlaceholderKey(group.prefix, n, field.name);
                          return (
                            <ContextMenuItem
                              key={fchave}
                              onClick={() => onInsertPlaceholder(editorId, fchave)}
                            >
                              <PlaceholderItemView chave={fchave} descricao={field.label} />
                            </ContextMenuItem>
                          );
                        })}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  );
                })}
              </ContextMenuSubContent>
            </ContextMenuSub>
          );
        }

        return null;
      })}
    </ContextMenuSubContent>
  </ContextMenuSub>
);

export default PlaceholderContextMenu;
