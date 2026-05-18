/**
 * Diálogo de importação de template a partir de PDF/DOCX
 * Fluxo em 2 etapas: upload → revisão de seções com TinyMCE
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { TinyMceEditor } from '@/components/editor/TinyMceEditor';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Loader2,
  GripVertical,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface SecaoImportada {
  nome: string;
  conteudo: string;
  incluir: boolean;
}

interface ImportTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tiposExame: { id: string; codigo?: string | null; nome: string }[];
  placeholders: { id: string; chave: string; nome: string }[];
  onImportSuccess: () => void;
}

// ─── Sortable Section Item ─────────────────────────────────

interface SortableSecaoItemProps {
  secao: SecaoImportada;
  index: number;
  onToggleIncluir: (index: number) => void;
  onUpdateNome: (index: number, nome: string) => void;
  onUpdateConteudo: (index: number, conteudo: string) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  total: number;
  editorIdPrefix: string;
}

const SortableSecaoItem: React.FC<SortableSecaoItemProps> = ({
  secao,
  index,
  onToggleIncluir,
  onUpdateNome,
  onUpdateConteudo,
  onRemove,
  onMove,
  total,
  editorIdPrefix,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `import-secao-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-card/50 p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-1"
          aria-label="Reordenar seção"
        >
          <GripVertical size={16} />
        </button>
        <Checkbox
          checked={secao.incluir}
          onCheckedChange={() => onToggleIncluir(index)}
          id={`incluir-${index}`}
        />
        <label
          htmlFor={`incluir-${index}`}
          className="text-sm font-medium cursor-pointer select-none"
        >
          Incluir
        </label>
        <Input
          value={secao.nome}
          onChange={(e) => onUpdateNome(index, e.target.value)}
          placeholder="Nome da seção"
          className="flex-1 h-8 text-sm"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onMove(index, 'up')}
          disabled={index === 0}
          aria-label="Mover para cima"
        >
          <ArrowUp size={14} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onMove(index, 'down')}
          disabled={index === total - 1}
          aria-label="Mover para baixo"
        >
          <ArrowDown size={14} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600"
          onClick={() => onRemove(index)}
          aria-label="Remover seção"
        >
          <X size={14} />
        </Button>
      </div>
      <TinyMceEditor
        editorId={`${editorIdPrefix}-${index}`}
        value={secao.conteudo}
        onChange={(html) => onUpdateConteudo(index, html)}
        height={200}
        placeholder={`Conteúdo da seção "${secao.nome || '...'}"`}
      />
    </div>
  );
};

// ─── Main Dialog Component ─────────────────────────────────

export const ImportTemplateDialog: React.FC<ImportTemplateDialogProps> = ({
  open,
  onOpenChange,
  tiposExame,
  placeholders,
  onImportSuccess,
}) => {
  const [etapa, setEtapa] = useState<'upload' | 'revisao'>('upload');
  const [nomeTemplate, setNomeTemplate] = useState('');
  const [tipoExameId, setTipoExameId] = useState('');
  const [secoes, setSecoes] = useState<SecaoImportada[]>([]);
  const [importando, setImportando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const resetarEstado = useCallback(() => {
    setEtapa('upload');
    setNomeTemplate('');
    setTipoExameId('');
    setSecoes([]);
    setImportando(false);
    setSalvando(false);
  }, []);

  const handleClose = (val: boolean) => {
    if (!val) {
      resetarEstado();
    }
    onOpenChange(val);
  };

  const handleSelecionarArquivo = async () => {
    try {
      setImportando(true);
      const result = await window.ipcAPI.template.importarArquivo();

      if (!result.success || !result.data) {
        toast.error(result.error || 'Erro ao importar arquivo');
        return;
      }

      const { nomeArquivo, secoes: secoesImportadas } = result.data;
      setNomeTemplate(nomeArquivo);
      setSecoes(secoesImportadas || []);
      setEtapa('revisao');
      toast.success(`${secoesImportadas?.length || 0} seções detectadas`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao importar arquivo');
    } finally {
      setImportando(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSecoes((prev) => {
        const oldIndex = Number(String(active.id).replace('import-secao-', ''));
        const newIndex = Number(String(over.id).replace('import-secao-', ''));
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const toggleIncluir = (index: number) => {
    setSecoes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, incluir: !s.incluir } : s))
    );
  };

  const updateNome = (index: number, nome: string) => {
    setSecoes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, nome } : s))
    );
  };

  const updateConteudo = (index: number, conteudo: string) => {
    setSecoes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, conteudo } : s))
    );
  };

  const removeSecao = (index: number) => {
    setSecoes((prev) => prev.filter((_, i) => i !== index));
  };

  const moveSecao = (index: number, direction: 'up' | 'down') => {
    setSecoes((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSalvar = async () => {
    if (!nomeTemplate.trim()) {
      toast.error('Nome do template é obrigatório');
      return;
    }
    if (!tipoExameId) {
      toast.error('Tipo de exame é obrigatório');
      return;
    }

    const secoesFiltradas = secoes.filter((s) => s.incluir && s.nome.trim());
    if (secoesFiltradas.length === 0) {
      toast.error('Selecione pelo menos uma seção com nome');
      return;
    }

    try {
      setSalvando(true);

      // Criar template
      const createR = await window.ipcAPI.template.create({
        nome: nomeTemplate.trim(),
        tipo_exame_id: tipoExameId,
        descricao: null,
      });

      if (!createR.success || !createR.data) {
        toast.error(createR.error || 'Erro ao criar template');
        return;
      }

      const templateId = createR.data.id;

      // Criar seções
      for (let i = 0; i < secoesFiltradas.length; i++) {
        const s = secoesFiltradas[i];
        await window.ipcAPI.template.createSecao({
          template_id: templateId,
          nome: s.nome.trim(),
          ordem: i,
          conteudo: s.conteudo,
        });
      }

      toast.success('Template importado com sucesso!');
      handleClose(false);
      onImportSuccess();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar template');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} />
            {etapa === 'upload' ? 'Importar Documento' : 'Revisar Seções Importadas'}
          </DialogTitle>
          <DialogDescription>
            {etapa === 'upload'
              ? 'Selecione um documento PDF ou DOCX para converter em template.'
              : 'Revise, edite e reordene as seções detectadas antes de salvar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {etapa === 'upload' ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Button
                onClick={handleSelecionarArquivo}
                disabled={importando}
                className="flex items-center gap-2 text-lg px-8 py-6"
              >
                {importando ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Upload size={20} />
                )}
                {importando ? 'Processando...' : 'Selecionar Arquivo (PDF ou DOCX)'}
              </Button>
              <p className="text-sm text-muted-foreground">
                Limite máximo: 20 MB · Formatos aceitos: PDF, DOCX
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Dados do template */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="imp-nome">Nome do Template *</Label>
                  <Input
                    id="imp-nome"
                    value={nomeTemplate}
                    onChange={(e) => setNomeTemplate(e.target.value)}
                    placeholder="Ex: Laudo de Local de Crime"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imp-tipo">Tipo de Exame *</Label>
                  <Select value={tipoExameId} onValueChange={setTipoExameId}>
                    <SelectTrigger id="imp-tipo">
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposExame.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {`${t.codigo || 'sem código'} - ${t.nome}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Lista de seções com DnD */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Seções detectadas ({secoes.filter((s) => s.incluir).length} incluídas)
                  </h3>
                </div>

                {secoes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma seção detectada no documento.
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={secoes.map((_, i) => `import-secao-${i}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {secoes.map((secao, index) => (
                          <SortableSecaoItem
                            key={`import-secao-${index}`}
                            secao={secao}
                            index={index}
                            onToggleIncluir={toggleIncluir}
                            onUpdateNome={updateNome}
                            onUpdateConteudo={updateConteudo}
                            onRemove={removeSecao}
                            onMove={moveSecao}
                            total={secoes.length}
                            editorIdPrefix="import-secao"
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          {etapa === 'revisao' && (
            <Button variant="outline" onClick={() => setEtapa('upload')} className="mr-auto">
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          {etapa === 'revisao' && (
            <Button
              onClick={handleSalvar}
              disabled={salvando}
              className="flex items-center gap-2"
            >
              {salvando && <Loader2 size={16} className="animate-spin" />}
              {salvando ? 'Salvando...' : 'Salvar como novo template'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
