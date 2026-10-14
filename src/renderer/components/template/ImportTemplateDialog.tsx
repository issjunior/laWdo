/**
 * Diálogo de importação de template a partir de PDF/DOCX
 * Fluxo em 2 etapas: upload → revisão de seções com TinyMCE
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { TipoExameFormFields } from '@/components/tipos-exame/TipoExameFormFields';
import type { CreateTipoExameInput } from '@/lib/validators/tipo-exame.schema';
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Upload,
  FileText,
  Loader2,
  GripVertical,
  X,
  ArrowUp,
  ArrowDown,
  ClipboardPen,
} from 'lucide-react';
import type { PreviaPacoteTemplate } from '@shared/types/template-pacote.types';
import type { ResultadoImportacaoTemplate, SecaoImportadaTemplate } from '@shared/types/importacao-template.types';
import { ehResultadoImportacaoTemplate, type AvisoImportacaoTemplate } from '@shared/types/importacao-template.types';
import { RevisaoImportacaoPanel } from './RevisaoImportacaoPanel';
import { documentoSecao, localizarSecoes } from './importacao-revisao';
import { useRegistrarAlteracoesPendentes } from '@/contexts/AlteracoesPendentesContext';

type SecaoImportada = SecaoImportadaTemplate;

interface ImportTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tiposExame: { id: string; codigo?: string | null; nome: string }[];
  placeholders: { id: string; chave: string; descricao: string; categoria_id: string }[];
  onImportSuccess: () => void;
  onTiposExameAtualizados: () => Promise<void>;
}

const getMensagemErro = (erro: unknown, fallback: string): string =>
  erro instanceof Error ? erro.message : fallback;

const normalizarImportacao = (dados: unknown): ResultadoImportacaoTemplate => {
  if (!ehResultadoImportacaoTemplate(dados)) throw new Error('Resposta de importação inválida');
  return dados;
};

// ─── Sortable Section Item ─────────────────────────────────

interface SortableSecaoItemProps {
  secao: SecaoImportada;
  index: number;
  onToggleIncluir: (index: number) => void;
  onUpdateNome: (index: number, nome: string) => void;
  onUpdateConteudo: (secaoId: string, conteudo: string) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  total: number;
  onDividir: (index: number) => void;
  onUnir: (index: number) => void;
  salvando: boolean;
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
  onDividir,
  onUnir,
  salvando,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: secao.id });

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
          id={`incluir-${secao.id}`}
        />
        <label
          htmlFor={`incluir-${secao.id}`}
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
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onDividir(index)}>Dividir seção</Button>
        <Button size="sm" variant="outline" disabled={index === total - 1} onClick={() => onUnir(index)}>Unir com a próxima</Button>
      </div>
      <TinyMceEditor
        somenteLeitura={salvando}
        editorId={`import-secao-${secao.id}`}
        value={secao.conteudo}
        onChange={(html) => onUpdateConteudo(secao.id, html)}
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
  placeholders: _placeholders,
  onImportSuccess,
  onTiposExameAtualizados,
}) => {
  const [etapa, setEtapa] = useState<'upload' | 'revisao' | 'pacote'>('upload');
  const [nomeTemplate, setNomeTemplate] = useState('');
  const [tipoExameId, setTipoExameId] = useState('');
  const [secoes, setSecoes] = useState<SecaoImportada[]>([]);
  const [avisos, setAvisos] = useState<AvisoImportacaoTemplate[]>([]);
  const [resumo, setResumo] = useState({ tabelas: 0, figuras: 0 });
  const [alterado, setAlterado] = useState(false);
  const [acaoDescarte, setAcaoDescarte] = useState<'fechar' | 'voltar' | null>(null);
  const [divisao, setDivisao] = useState<{ secaoId: string; limite: string; nome: string } | null>(null);
  const [importando, setImportando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [pacote, setPacote] = useState<PreviaPacoteTemplate | null>(null);
  const [confirmarCriacaoTipo, setConfirmarCriacaoTipo] = useState(false);
  const [tipoExameQCOpen, setTipoExameQCOpen] = useState(false);
  const [tipoExameQCFormData, setTipoExameQCFormData] = useState<CreateTipoExameInput>({ codigo: '', nome: '', descricao: '' });
  const [tipoExameQCError, setTipoExameQCError] = useState<string | null>(null);
  const [tipoExameQCSubmitting, setTipoExameQCSubmitting] = useState(false);
  const revisaoAtualRef = useRef({ secoes, salvando });
  revisaoAtualRef.current = { secoes, salvando };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const existentes = secoes.map(secao => ({ ...secao, incluir: true }));
    setAvisos(anteriores => {
      const mantidos = anteriores.filter(item => localizarSecoes(existentes, item).length);
      return mantidos.length === anteriores.length ? anteriores : mantidos;
    });
  }, [secoes]);

  useRegistrarAlteracoesPendentes('importacao-template', {
    pendente: open && alterado,
    salvando: open && (salvando || importando),
    verificar: () => open && alterado,
    salvar: () => handleSalvar(),
    erro: () => 'Confira o nome e o tipo de exame e tente novamente.',
  });

  const resetarEstado = useCallback(() => {
    setEtapa('upload');
    setNomeTemplate('');
    setTipoExameId('');
    setSecoes([]);
    setAvisos([]);
    setResumo({ tabelas: 0, figuras: 0 });
    setAlterado(false);
    setAcaoDescarte(null);
    setDivisao(null);
    setPacote(null);
    setConfirmarCriacaoTipo(false);
    setTipoExameQCOpen(false);
    setTipoExameQCFormData({ codigo: '', nome: '', descricao: '' });
    setTipoExameQCError(null);
    setImportando(false);
    setSalvando(false);
  }, []);

  const handleClose = (val: boolean, concluido = false) => {
    if (!val && (salvando || importando) && !concluido) return;
    if (!val && alterado && !concluido) { setAcaoDescarte('fechar'); return; }
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
        if (!result.cancelado) toast.error(result.error || 'Erro ao importar arquivo');
        return;
      }

      const { nomeArquivo, secoes: secoesImportadas, avisos: novosAvisos, resumo: novoResumo } = normalizarImportacao(result.data);
      setNomeTemplate(nomeArquivo);
      setSecoes(secoesImportadas || []);
      setAvisos(novosAvisos);
      setResumo(novoResumo);
      setAlterado(true);
      setEtapa('revisao');
      toast.success(`${secoesImportadas?.length || 0} seções detectadas`);
    } catch (e: unknown) {
      toast.error(getMensagemErro(e, 'Erro ao importar arquivo'));
    } finally {
      setImportando(false);
    }
  };

  const handleSelecionarPacote = async () => {
    try {
      setImportando(true);
      const resposta = await window.ipcAPI.template.selecionarPacote();
      if (!resposta.success || !resposta.data) {
        if (resposta.error !== 'Importação cancelada') toast.error(resposta.error || 'Erro ao ler pacote de template');
        return;
      }
      setPacote(resposta.data as PreviaPacoteTemplate);
      setEtapa('pacote');
    } catch (erro: unknown) {
      toast.error(getMensagemErro(erro, 'Erro ao ler pacote de template'));
    } finally {
      setImportando(false);
    }
  };

  const handleSalvarTipoExame = async () => {
    if (!tipoExameQCFormData.codigo.trim()) {
      setTipoExameQCError('O código do tipo de exame é obrigatório.');
      return;
    }
    if (!tipoExameQCFormData.nome.trim()) {
      setTipoExameQCError('O nome do tipo de exame é obrigatório.');
      return;
    }

    try {
      setTipoExameQCSubmitting(true);
      setTipoExameQCError(null);
      const resposta = await window.ipcAPI.tipoExame.create(tipoExameQCFormData);
      if (!resposta.success || !resposta.data?.id) {
        setTipoExameQCError(resposta.error || 'Erro ao criar tipo de exame');
        return;
      }

      await onTiposExameAtualizados();
      setTipoExameId(resposta.data.id);
      setTipoExameQCOpen(false);
      setTipoExameQCFormData({ codigo: '', nome: '', descricao: '' });
    } catch (erro: unknown) {
      setTipoExameQCError(getMensagemErro(erro, 'Erro ao criar tipo de exame'));
    } finally {
      setTipoExameQCSubmitting(false);
    }
  };

  const handleImportarPacote = async (criarTipo: boolean) => {
    if (!pacote) return;
    try {
      setSalvando(true);
      const resposta = await window.ipcAPI.template.importarPacote(pacote.caminho, criarTipo);
      if (!resposta.success) {
        toast.error(resposta.error || 'Erro ao importar template');
        return;
      }
      toast.success(`Template "${pacote.template.nome}" importado com sucesso`);
      handleClose(false, true);
      onImportSuccess();
    } catch (erro: unknown) {
      toast.error(getMensagemErro(erro, 'Erro ao importar template'));
    } finally {
      setSalvando(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (salvando) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSecoes((prev) => {
        const oldIndex = prev.findIndex(secao => secao.id === active.id);
        const newIndex = prev.findIndex(secao => secao.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const toggleIncluir = (index: number) => {
    if (salvando) return;
    setAlterado(true);
    setSecoes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, incluir: !s.incluir } : s))
    );
  };

  const updateNome = (index: number, nome: string) => {
    if (salvando) return;
    setAlterado(true);
    setSecoes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, nome } : s))
    );
  };

  const updateConteudo = (secaoId: string, conteudo: string) => {
    const revisao = revisaoAtualRef.current;
    if (revisao.salvando) return;
    const anterior = revisao.secoes.find(secao => secao.id === secaoId);
    if (!anterior || anterior.conteudo === conteudo) return;
    setAlterado(true);
    setSecoes((prev) =>
      prev.map(s => (s.id === secaoId ? { ...s, conteudo } : s))
    );
  };

  const removeSecao = (index: number) => {
    if (salvando) return;
    setAlterado(true);
    setSecoes((prev) => prev.filter((_, i) => i !== index));
  };

  const moveSecao = (index: number, direction: 'up' | 'down') => {
    if (salvando) return;
    setAlterado(true);
    setSecoes((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const unirSecoes = (indice: number) => {
    if (salvando) return;
    const primeira = secoes[indice];
    const segunda = secoes[indice + 1];
    if (!primeira || !segunda) return;
    const titulo = documentoSecao('<h2></h2>');
    titulo.body.firstElementChild!.textContent = segunda.nome;
    setSecoes(anteriores => anteriores.flatMap((secao, posicao) => posicao === indice
      ? [{ ...secao, incluir: secao.incluir || segunda.incluir, conteudo: secao.conteudo + titulo.body.innerHTML + segunda.conteudo }]
      : posicao === indice + 1 ? [] : [secao]));
    setAvisos(anteriores => anteriores.map(item => item.secaoId === segunda.id ? { ...item, secaoId: primeira.id } : item));
    setAlterado(true);
  };

  const dividirSecao = () => {
    if (!divisao || salvando) return;
    const indice = secoes.findIndex(secao => secao.id === divisao.secaoId);
    if (indice < 0 || !divisao.nome.trim()) return;
    const secao = secoes[indice];
    const blocos = Array.from(documentoSecao(secao.conteudo).body.children);
    const limite = Number(divisao.limite);
    if (!Number.isInteger(limite) || limite < 1 || limite >= blocos.length) return;
    const novaId = crypto.randomUUID();
    setSecoes(anteriores => anteriores.flatMap(item => item.id !== secao.id ? [item] : [
      { ...item, conteudo: blocos.slice(0, limite).map(bloco => bloco.outerHTML).join('') },
      { id: novaId, nome: divisao.nome.trim(), incluir: item.incluir, conteudo: blocos.slice(limite).map(bloco => bloco.outerHTML).join('') },
    ]));
    setAvisos(anteriores => [...anteriores, ...anteriores.filter(item => item.secaoId === secao.id && !item.elementoId && !item.pagina)
      .map(item => ({ ...item, id: crypto.randomUUID(), secaoId: novaId }))]);
    setAlterado(true);
    setDivisao(null);
  };

  const handleSalvar = async (): Promise<boolean> => {
    if (salvando || importando) return false;
    if (!nomeTemplate.trim()) {
      toast.error('Nome do template é obrigatório');
      return false;
    }
    if (!tipoExameId) {
      toast.error('Tipo de exame é obrigatório');
      return false;
    }

    const secoesFiltradas = secoes.filter((s) => s.incluir);
    if (secoesFiltradas.some(secao => !secao.nome.trim())) {
      toast.error('Informe o nome de todas as seções incluídas');
      return false;
    }
    if (secoesFiltradas.length === 0) {
      toast.error('Selecione pelo menos uma seção com nome');
      return false;
    }

    try {
      setSalvando(true);

      const resposta = await window.ipcAPI.template.salvarCompleto({
        nome: nomeTemplate.trim(),
        tipo_exame_id: tipoExameId,
        descricao: null,
        importado_de_documento: true,
        secoes: secoesFiltradas.map(secao => ({
          chave_local: secao.id,
          nome: secao.nome.trim(),
          conteudo: secao.conteudo,
        })),
      });

      if (!resposta.success || !resposta.data || typeof resposta.data.id !== 'string' || !resposta.data.id) {
        toast.error(resposta.error || 'Erro ao salvar template');
        return false;
      }

      toast.success('Template importado com sucesso!');
      handleClose(false, true);
      onImportSuccess();
      return true;
    } catch (e: unknown) {
      toast.error(getMensagemErro(e, 'Erro ao salvar template'));
      return false;
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
            {etapa === 'upload' ? 'Importar Template' : etapa === 'pacote' ? 'Revisar Pacote de Template' : 'Revisar Seções Importadas'}
          </DialogTitle>
          <DialogDescription>
            {etapa === 'upload'
              ? 'Importe um documento PDF, DOCX ou ODT, ou um pacote ZIP de template.'
              : etapa === 'pacote' ? 'Confira os dados do pacote antes de criar uma cópia no sistema.' : 'Revise, edite e reordene as seções detectadas antes de salvar.'}
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
                {importando ? 'Processando...' : 'Selecionar Arquivo (PDF, DOCX ou ODT)'}
              </Button>
              <Button variant="outline" onClick={handleSelecionarPacote} disabled={importando} className="flex items-center gap-2">
                <FileText size={18} /> Selecionar Pacote de Template (ZIP)
              </Button>
              <p className="text-sm text-muted-foreground">
                Limite máximo: 20 MB · Formatos aceitos: PDF, DOCX, ODT e ZIP
              </p>
            </div>
          ) : etapa === 'pacote' && pacote ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card/50 p-4 space-y-2">
                <p><strong>Template:</strong> {pacote.template.nome}</p>
                <p><strong>Tipo de exame:</strong> {pacote.tipo_exame.codigo} — {pacote.tipo_exame.nome}</p>
                <p><strong>Seções:</strong> {pacote.secoes.length}</p>
                {!pacote.tipoExameExiste && <p className="text-amber-700 dark:text-amber-400">Este tipo de exame ainda não existe nesta instalação.</p>}
              </div>
              <p className="text-sm text-muted-foreground">O template será importado como uma cópia, sem substituir os existentes.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <RevisaoImportacaoPanel secoes={secoes} avisos={avisos} resumo={resumo} />
              {/* Dados do template */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="imp-nome">Nome do Template *</Label>
                  <Input
                    id="imp-nome"
                    value={nomeTemplate}
                    disabled={salvando}
                    onChange={(e) => setNomeTemplate(e.target.value)}
                    placeholder="Ex: Laudo de Local de Crime"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="imp-tipo">Tipo de Exame *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-primary"
                      title="Cadastrar tipo de exame"
                      aria-label="Cadastrar tipo de exame"
                      onClick={() => {
                        setTipoExameQCError(null);
                        setTipoExameQCOpen(true);
                      }}
                    >
                      <ClipboardPen size={14} />
                    </Button>
                  </div>
                  <Select value={tipoExameId} disabled={salvando} onValueChange={(value: string) => setTipoExameId(value)}>
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
                      items={secoes.map(secao => secao.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {secoes.map((secao, index) => (
                          <SortableSecaoItem
                            key={secao.id}
                            secao={secao}
                            index={index}
                            onToggleIncluir={toggleIncluir}
                            onUpdateNome={updateNome}
                            onUpdateConteudo={updateConteudo}
                            onRemove={removeSecao}
                            onMove={moveSecao}
                            total={secoes.length}
                            salvando={salvando}
                            onUnir={unirSecoes}
                            onDividir={indice => { if (!salvando) setDivisao({ secaoId: secoes[indice].id, limite: '', nome: 'Nova seção' }); }}
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
            <Button variant="outline" onClick={() => alterado ? setAcaoDescarte('voltar') : setEtapa('upload')} disabled={salvando} className="mr-auto">
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={() => handleClose(false)} disabled={salvando || importando}>
            Cancelar
          </Button>
          {etapa === 'revisao' && (
            <Button
              onClick={() => { void handleSalvar(); }}
              disabled={salvando}
              className="flex items-center gap-2"
            >
              {salvando && <Loader2 size={16} className="animate-spin" />}
              {salvando ? 'Salvando...' : 'Salvar como novo template'}
            </Button>
          )}
          {etapa === 'pacote' && pacote && (
            <Button
              onClick={() => pacote.tipoExameExiste ? handleImportarPacote(false) : setConfirmarCriacaoTipo(true)}
              disabled={salvando}
            >
              {salvando ? 'Importando...' : 'Importar como cópia'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      <Dialog open={divisao !== null} onOpenChange={aberto => { if (!aberto) setDivisao(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dividir seção</DialogTitle><DialogDescription>Escolha o bloco que iniciará a nova seção. Tabelas, listas e figuras são mantidas inteiras.</DialogDescription></DialogHeader>
          <Input aria-label="Nome da nova seção" value={divisao?.nome || ''} onChange={evento => setDivisao(atual => atual ? { ...atual, nome: evento.target.value } : null)} />
          <Select value={divisao?.limite || ''} onValueChange={limite => setDivisao(atual => atual ? { ...atual, limite } : null)}>
            <SelectTrigger><SelectValue placeholder="Iniciar nova seção antes de..." /></SelectTrigger>
            <SelectContent>{Array.from(documentoSecao(secoes.find(secao => secao.id === divisao?.secaoId)?.conteudo || '').body.children).slice(1).map((bloco, indice) =>
              <SelectItem key={indice} value={String(indice + 1)}>Bloco {indice + 2}: {(bloco.textContent?.trim() || bloco.tagName).slice(0, 100)}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter><Button variant="outline" onClick={() => setDivisao(null)}>Cancelar</Button><Button disabled={!divisao?.limite || !divisao.nome.trim()} onClick={dividirSecao}>Dividir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={acaoDescarte !== null} onOpenChange={aberto => { if (!aberto) setAcaoDescarte(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Descartar revisão do template?</AlertDialogTitle><AlertDialogDescription>O conteúdo importado e as alterações da revisão ainda não foram salvos.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Continuar revisando</AlertDialogCancel><AlertDialogAction onClick={() => { const acao = acaoDescarte; resetarEstado(); if (acao === 'fechar') onOpenChange(false); }}>Descartar revisão</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmarCriacaoTipo} onOpenChange={setConfirmarCriacaoTipo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tipo de exame não encontrado</AlertDialogTitle>
            <AlertDialogDescription>
              O tipo {pacote?.tipo_exame.codigo} não existe neste sistema. Você pode cancelar ou criá-lo automaticamente antes de importar o template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleImportarPacote(true)}>Criar tipo de exame e importar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={tipoExameQCOpen} onOpenChange={setTipoExameQCOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo Tipo de Exame</DialogTitle>
            <DialogDescription>
              Preencha as informações para criar um novo tipo de exame.
            </DialogDescription>
          </DialogHeader>
          <TipoExameFormFields
            formData={tipoExameQCFormData}
            onChange={setTipoExameQCFormData}
            error={tipoExameQCError}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setTipoExameQCOpen(false);
                setTipoExameQCError(null);
                setTipoExameQCFormData({ codigo: '', nome: '', descricao: '' });
              }}
              disabled={tipoExameQCSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSalvarTipoExame} disabled={tipoExameQCSubmitting}>
              {tipoExameQCSubmitting ? 'Criando...' : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
