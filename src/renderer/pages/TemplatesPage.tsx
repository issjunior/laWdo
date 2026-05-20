import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Plus, Search, Edit, Trash2, X, Copy, ArrowUp, ArrowDown, ArrowLeft,
  FileText, GripVertical, Layers, Eye, LayoutGrid, List, Upload,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { TinyMceEditor } from '@/components/editor/TinyMceEditor';
import { removerFormatacaoPlaceholders } from '@/lib/utils';
import { z } from 'zod';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';

interface TemplateItem {
  id: string;
  nome: string;
  tipo_exame_id: string;
  descricao?: string;
  qtd_secoes: number;
  tipo_exame_nome?: string;
  tipo_exame_codigo?: string;
  created_at: string;
}

interface SecaoItem {
  id: string;
  template_id: string;
  nome: string;
  ordem: number;
  conteudo?: string;
}

interface TemplateForm {
  nome: string;
  tipo_exame_id: string;
  descricao: string;
}

interface SecaoForm {
  id?: string;
  nome: string;
  conteudo: string;
}

const emptyTemplateForm = (): TemplateForm => ({
  nome: '', tipo_exame_id: '', descricao: '',
});

const emptySecaoForm = (): SecaoForm => ({
  nome: '', conteudo: '',
});

interface Placeholder {
  id: string;
  chave: string;
  descricao: string | null;
  categoria_id: string | null;
}

interface Categoria {
  id: string;
  label: string;
  icone: string;
  cor: string;
}

const templateFormSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(200, 'Máximo 200 caracteres'),
  tipo_exame_id: z.string().min(1, 'Tipo de exame é obrigatório'),
  descricao: z.string().max(500, 'Máximo 500 caracteres').optional(),
});

import { ImportTemplateDialog } from '@/components/template/ImportTemplateDialog';

export const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipoExame, setFiltroTipoExame] = useState('');
  const [tiposExame, setTiposExame] = useState<any[]>([]);

  // Modo de edição
  const [editMode, setEditMode] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateForm>(emptyTemplateForm);
  const [secoes, setSecoes] = useState<SecaoForm[]>([]);
  const [secoesDb, setSecoesDb] = useState<SecaoItem[]>([]);
  const [editorMode, setEditorMode] = useState<'multi' | 'single'>('multi');
  const [singleEditorHtml, setSingleEditorHtml] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof TemplateForm, string>>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const carregarTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const r = await window.ipcAPI.template.findAll();
      if (r.success) setTemplates(r.data || []);
      else toast.error(r.error);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarTiposExame = useCallback(async () => {
    const r = await window.ipcAPI.tipoExame.findAllSemFiltroStatus();
    if (r.success) setTiposExame(r.data || []);
  }, []);

  const carregarPlaceholders = useCallback(async () => {
    const rCat = await window.ipcAPI.categoria.findAll();
    if (rCat.success && rCat.data) {
      setCategorias(rCat.data);
    }
    const r = await window.ipcAPI.placeholder.findAll();
    if (r.success && r.data) {
      setPlaceholders(r.data);
    }
  }, []);

  useEffect(() => { carregarTemplates(); carregarTiposExame(); carregarPlaceholders(); }, []);

  const buildSingleHtmlFromSecoes = useCallback((secoesFonte: SecaoForm[]) => {
    if (secoesFonte.length === 0) {
      return `
        <div data-template-empty="true" style="padding:12px;border:1px dashed #bbb;border-radius:8px;color:#666;">
          Nenhuma seção definida. Volte para o modo multi-editor para adicionar seções.
        </div>
      `;
    }

    return secoesFonte
      .map((sec, index) => {
        const nomeRaw = (sec.nome || '').trim();
        const nome = nomeRaw
          ? (/^(?:se[cç]ão\b|\d+[\s\.\-\:]|[a-zA-Z][\.\-\:]\s|[IVXLCDM]+[\.\-\:]\s)/i.test(nomeRaw)
            ? nomeRaw
            : `Seção ${index + 1}: ${nomeRaw}`)
          : `Seção ${index + 1}`;
        const conteudo = sec.conteudo?.trim() || '<p>&nbsp;</p>';
        const secId = sec.id || `tmp-${index}`;

        return `
          <section data-template-secao="true" data-secao-index="${index}" data-secao-id="${secId}" style="margin-bottom:16px;border:1px solid #d9d9d9;border-radius:8px;overflow:hidden;">
            <div contenteditable="false" data-template-secao-header="true" style="background:#f5f5f5;padding:8px 12px;border-bottom:1px solid #d9d9d9;font-weight:600;">
              ${nome}
            </div>
            <div data-template-secao-content="true" style="padding:8px 4px;">
              ${conteudo}
            </div>
          </section>
        `;
      })
      .join('\n');
  }, []);

  const parseSingleHtmlToSecoes = useCallback((singleHtml: string, secoesBase: SecaoForm[]) => {
    if (!singleHtml || secoesBase.length === 0) return secoesBase;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(singleHtml, 'text/html');
      const sectionNodes = Array.from(doc.querySelectorAll('section[data-template-secao="true"]'));
      if (sectionNodes.length === 0) return secoesBase;

      const contentByIndex = new Map<number, string>();
      sectionNodes.forEach(node => {
        const idxRaw = node.getAttribute('data-secao-index');
        const idx = idxRaw != null ? Number(idxRaw) : NaN;
        const contentNode = node.querySelector('[data-template-secao-content="true"]') as HTMLElement | null;
        if (!Number.isNaN(idx) && contentNode) {
          contentByIndex.set(idx, (contentNode.innerHTML || '').trim() || '<p>&nbsp;</p>');
        }
      });

      return secoesBase.map((s, idx) => ({
        ...s,
        conteudo: contentByIndex.get(idx) ?? s.conteudo,
      }));
    } catch {
      return secoesBase;
    }
  }, []);

  const handleEditorModeChange = useCallback((nextMode: 'multi' | 'single') => {
    if (nextMode === editorMode) return;
    if (nextMode === 'single') {
      setSingleEditorHtml(buildSingleHtmlFromSecoes(secoes));
      setEditorMode('single');
      return;
    }

    setSecoes(prev => parseSingleHtmlToSecoes(singleEditorHtml, prev));
    setEditorMode('multi');
  }, [buildSingleHtmlFromSecoes, editorMode, parseSingleHtmlToSecoes, secoes, singleEditorHtml]);

  const inserirPlaceholder = (editorId: string, chave: string) => {
    const editor = (window as any).tinymce?.get(editorId);
    if (editor) {
      editor.insertContent(`{{${chave}}}`);
    }
  };

  const filteredByTipo = templates.filter(t => {
    if (t.id === 'tpl-nao-definido') return false;
    return !filtroTipoExame || filtroTipoExame === 'todos' || t.tipo_exame_id === filtroTipoExame;
  });

  const filtered = filteredByTipo.filter(t =>
    t.nome.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // ─── Modo Lista ──────────────────────────────────────

  const handleNovo = () => {
    setEditingTemplateId(null);
    setTemplateForm(emptyTemplateForm());
    setSecoes([emptySecaoForm()]);
    setSecoesDb([]);
    setEditorMode('multi');
    setSingleEditorHtml('');
    setErrors({});
    setEditMode(true);
  };

  const handleEditar = async (template: TemplateItem) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      nome: template.nome,
      tipo_exame_id: template.tipo_exame_id,
      descricao: template.descricao || '',
    });
    setErrors({});

    // Carregar seções existentes
    const r = await window.ipcAPI.template.findSecoes(template.id);
    if (r.success && r.data) {
      const s: SecaoItem[] = r.data;
      setSecoesDb(s);
      setSecoes(s.map(se => ({ id: se.id, nome: se.nome, conteudo: se.conteudo || '' })));
      setSingleEditorHtml(buildSingleHtmlFromSecoes(s.map(se => ({ id: se.id, nome: se.nome, conteudo: se.conteudo || '' }))));
    } else {
      setSecoesDb([]);
      setSecoes([emptySecaoForm()]);
      setSingleEditorHtml(buildSingleHtmlFromSecoes([emptySecaoForm()]));
    }
    setEditorMode('multi');
    setEditMode(true);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir este template? As seções vinculadas também serão removidas.')) return;
    const r = await window.ipcAPI.template.delete(id);
    if (r.success) {
      await carregarTemplates();
    } else {
      toast.error(r.error || 'Erro ao excluir template');
    }
  };

  const handleClonar = async (template: TemplateItem) => {
    try {
      // Buscar as seções do template original
      const secResult = await window.ipcAPI.template.findSecoes(template.id);
      const secoesOriginais: SecaoItem[] =
        secResult.success && secResult.data ? secResult.data : [];

      const nomeClonado = `${template.nome} - (Cópia)`;

      // Criar novo template com nome "{original} - (Cópia)"
      const createR = await window.ipcAPI.template.create({
        nome: nomeClonado,
        tipo_exame_id: template.tipo_exame_id,
        descricao: template.descricao || null,
      });
      if (!createR.success || !createR.data) {
        toast.error(createR.error || 'Erro ao criar cópia do template');
        return;
      }

      const novoId: string = createR.data.id;

      // Copiar as seções
      for (const sec of secoesOriginais) {
        await window.ipcAPI.template.createSecao({
          template_id: novoId,
          nome: sec.nome,
          ordem: sec.ordem,
          conteudo: sec.conteudo || '',
        });
      }

      // Atualizar lista em segundo plano
      carregarTemplates();

      // Abrir o template clonado no modo edição
      setEditingTemplateId(novoId);
      setTemplateForm({
        nome: nomeClonado,
        tipo_exame_id: template.tipo_exame_id,
        descricao: template.descricao || '',
      });
      setErrors({});

      // Carregar as seções recém-criadas
      const r = await window.ipcAPI.template.findSecoes(novoId);
      if (r.success && r.data) {
        const s: SecaoItem[] = r.data;
        setSecoesDb(s);
        setSecoes(s.map(se => ({ id: se.id, nome: se.nome, conteudo: se.conteudo || '' })));
        setSingleEditorHtml(buildSingleHtmlFromSecoes(s.map(se => ({ id: se.id, nome: se.nome, conteudo: se.conteudo || '' }))));
      } else {
        setSecoesDb([]);
        setSecoes([emptySecaoForm()]);
        setSingleEditorHtml(buildSingleHtmlFromSecoes([emptySecaoForm()]));
      }
      setEditorMode('multi');
      setEditMode(true);
    } catch (e: any) {
      toast.error('Erro ao clonar template');
    }
  };

  const handleVoltar = () => {
    setEditMode(false);
    carregarTemplates();
  };

  // ─── Formulário ──────────────────────────────────────

  const updateTemplateField = (field: keyof TemplateForm, value: string) => {
    setTemplateForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleAddSecao = () => {
    setSecoes(prev => [...prev, emptySecaoForm()]);
  };

  const handleRemoveSecao = (index: number) => {
    setSecoes(prev => prev.filter((_, i) => i !== index));
  };

  const handleMoveSecao = (index: number, direction: 'up' | 'down') => {
    setSecoes(prev => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateSecao = (index: number, field: keyof SecaoForm, value: string) => {
    setSecoes(prev => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const handleSalvar = async () => {
    try {
      setSubmitting(true);
      setErrors({});
      const secoesParaSalvar = editorMode === 'single'
        ? parseSingleHtmlToSecoes(singleEditorHtml, secoes)
        : secoes;

      // Validar template
      const result = templateFormSchema.safeParse(templateForm);
      if (!result.success) {
        const fErrors: Partial<Record<keyof TemplateForm, string>> = {};
        result.error.errors.forEach(err => {
          const f = err.path[0] as keyof TemplateForm;
          if (!fErrors[f]) fErrors[f] = err.message;
        });
        setErrors(fErrors);
        setSubmitting(false);
        return;
      }

      // Salvar template
      let templateId = editingTemplateId;
      if (editingTemplateId) {
        const r = await window.ipcAPI.template.update(editingTemplateId, {
          nome: templateForm.nome,
          tipo_exame_id: templateForm.tipo_exame_id,
          descricao: templateForm.descricao || null,
        });
        if (!r.success) { toast.error(r.error); setSubmitting(false); return; }
      } else {
        const r = await window.ipcAPI.template.create({
          nome: templateForm.nome,
          tipo_exame_id: templateForm.tipo_exame_id,
          descricao: templateForm.descricao || null,
        });
        if (!r.success) { toast.error(r.error); setSubmitting(false); return; }
        templateId = r.data.id;
      }

      // Salvar seções (excluir as removidas, atualizar/criar as atuais)
      if (templateId) {
        // Remover seções que não estão mais na lista
        const idsAtuais = secoesParaSalvar.filter(s => s.id).map(s => s.id!);
        for (const s of secoesDb) {
          if (!idsAtuais.includes(s.id)) {
            await window.ipcAPI.template.deleteSecao(s.id);
          }
        }

        // Criar/atualizar seções
        const idsOrdenados: string[] = [];
        for (let i = 0; i < secoesParaSalvar.length; i++) {
          const sec = secoesParaSalvar[i];
          if (!sec.nome.trim()) continue;

          if (sec.id) {
            await window.ipcAPI.template.updateSecao(sec.id, {
              nome: sec.nome.trim(),
              conteudo: removerFormatacaoPlaceholders(sec.conteudo),
              ordem: i,
            });
            idsOrdenados.push(sec.id);
          } else {
            const r = await window.ipcAPI.template.createSecao({
              template_id: templateId,
              nome: sec.nome.trim(),
              ordem: i,
              conteudo: removerFormatacaoPlaceholders(sec.conteudo),
            });
            if (r.success) idsOrdenados.push(r.data.id);
          }
        }

        // Reordenar
        if (idsOrdenados.length > 0) {
          await window.ipcAPI.template.reordenarSecoes(templateId, idsOrdenados);
        }
      }

      toast.success(editingTemplateId ? 'Template atualizado com sucesso!' : 'Template criado com sucesso!');
      carregarTemplates();

      if (!editingTemplateId) {
        setEditingTemplateId(templateId);
      }

      // Recarregar seções do BD
      if (templateId) {
        const r = await window.ipcAPI.template.findSecoes(templateId);
        if (r.success) {
          setSecoesDb(r.data);
          const nextSecoes = r.data.map((s: SecaoItem) => ({ id: s.id, nome: s.nome, conteudo: s.conteudo || '' }));
          setSecoes(nextSecoes);
          setSingleEditorHtml(buildSingleHtmlFromSecoes(nextSecoes));
        }
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  /** Converte HTML em PDF e exibe no dialog */
  const gerarEExibirPdf = async (fullHtml: string) => {
    const result = await window.ipcAPI.template.previewPDF(fullHtml);
    if (result.success && result.data) {
      const byteChars = atob(result.data);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
    } else {
      toast.error(result.error || 'Erro ao gerar PDF');
      setShowPreview(false);
    }
  };

  /** Monta o HTML com cabeçalho + placeholders substituídos */
  const montarHtmlPreview = async (
    secoesFonte: { nome: string; conteudo?: string }[],
    templateNome: string,
    tipoExameNome: string,
  ) => {
    let cabecalhoHtml = '';
    const headerResult = await window.ipcAPI.configuracao.obter('cabecalho_laudo');
    if (headerResult.success && headerResult.data) {
      cabecalhoHtml = headerResult.data;
    }

    const secoesHtml = secoesFonte
      .filter(s => s.nome.trim())
      .map((s, i) => {
        const titulo = s.nome.trim();
        const conteudo = s.conteudo || '<p style="color: #999; font-style: italic;">(seção vazia)</p>';
        return `<h2>${i + 1}. ${titulo}</h2>${conteudo}`;
      })
      .join('\n');

    let fullHtml = cabecalhoHtml
      ? `<div class="cabecalho" style="border-bottom:2px solid #000;padding-bottom:16px;margin-bottom:32px;">${cabecalhoHtml}</div>`
      : '';
    fullHtml += secoesHtml || '<p style="color:#999;">Nenhuma seção definida.</p>';

    let peritoNome = '';
    let peritoCargo = '';
    let peritoLotacao = '';
    let peritoMatricula = '';
    try {
      const userJson = sessionStorage.getItem('lawdo_auth_user');
      if (userJson) {
        const perito = JSON.parse(userJson);
        peritoNome = perito.nome || perito.name || '';
        peritoCargo = perito.cargo || perito.role || '';
        peritoLotacao = perito.lotacao || '';
        peritoMatricula = perito.matricula || '';
      }
    } catch {}

    const replacements: Record<string, string> = {
      '{{perito.nome}}': peritoNome,
      '{{perito.cargo}}': peritoCargo,
      '{{perito_nome}}': peritoNome,
      '{{perito_cargo}}': peritoCargo,
      '{{perito_lotacao}}': peritoLotacao,
      '{{perito_matricula}}': peritoMatricula,
      '{{data_atual}}': new Date().toLocaleDateString('pt-BR'),
      '{{laudo.numero}}': '<strong>2026/00123</strong>',
      '{{numero_rep}}': '<strong>321.654-2026</strong>',
      '{{solicitante.nome}}': '<strong>Delegacia de Polícia Civil</strong>',
      '{{template.nome}}': `<strong>${templateNome || '(sem nome)'}</strong>`,
      '{{tipo_exame.nome}}': `<strong>${tipoExameNome || '(não definido)'}</strong>`,
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      fullHtml = fullHtml.split(placeholder).join(value);
      const oldFormat = `{${placeholder.slice(2, -2)}}`;
      fullHtml = fullHtml.split(oldFormat).join(value);
    }

    return fullHtml;
  };

  /** Pré-visualizar a partir do editor (usa estado atual das seções) */
  const handlePreview = async () => {
    try {
      setGeneratingPdf(true);
      setShowPreview(true);
      const secoesParaPreview = editorMode === 'single'
        ? parseSingleHtmlToSecoes(singleEditorHtml, secoes)
        : secoes;

      const tipoExameNome = tiposExame.find(t => t.id === templateForm.tipo_exame_id)?.nome || '';
      const fullHtml = await montarHtmlPreview(secoesParaPreview, templateForm.nome, tipoExameNome);
      await gerarEExibirPdf(fullHtml);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar PDF');
      setShowPreview(false);
    } finally {
      setGeneratingPdf(false);
    }
  };

  /** Pré-visualizar a partir do card (carrega seções do banco) */
  const handlePreviewCard = async (template: TemplateItem) => {
    try {
      setGeneratingPdf(true);
      setShowPreview(true);

      const secResult = await window.ipcAPI.template.findSecoes(template.id);
      const loadedSecoes: { nome: string; conteudo?: string }[] =
        secResult.success && secResult.data ? secResult.data : [];

      const fullHtml = await montarHtmlPreview(
        loadedSecoes,
        template.nome,
        template.tipo_exame_nome || '',
      );
      await gerarEExibirPdf(fullHtml);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar PDF');
      setShowPreview(false);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const columnDefs = useMemo<ColumnDef<TemplateItem>[]>(() => [
    {
      accessorKey: 'nome',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nome" />
      ),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.getValue('nome')}</p>
          {row.original.descricao && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{row.original.descricao}</p>
          )}
        </div>
      ),
    },
    {
      id: 'tipo_exame',
      accessorFn: (row) => row.tipo_exame_codigo ? `${row.tipo_exame_codigo} - ${row.tipo_exame_nome || '—'}` : (row.tipo_exame_nome || '—'),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tipo de Exame" />
      ),
      cell: ({ row }) => <span className="text-muted-foreground">{row.getValue('tipo_exame')}</span>,
    },
    {
      accessorKey: 'qtd_secoes',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Seções" />
      ),
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Layers size={12} /> {row.getValue('qtd_secoes')}
        </span>
      ),
    },
    {
      id: 'actions',
      enableHiding: false,
      header: () => <span className="sr-only">Ações</span>,
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="flex justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => handlePreviewCard(t)} aria-label="Pré-visualizar">
                  <Eye size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Pré-visualizar</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => handleClonar(t)} aria-label="Clonar template">
                  <Copy size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Clonar template</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => handleEditar(t)} aria-label="Editar">
                  <Edit size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Editar</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => handleExcluir(t.id)}
                  aria-label="Excluir"
                  disabled={t.id === 'tpl-nao-definido'}
                >
                  <Trash2 size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{t.id === 'tpl-nao-definido' ? 'Template do sistema — não pode ser excluído' : 'Excluir'}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
  ], [handlePreviewCard, handleClonar, handleEditar, handleExcluir]);

  // ─── Modo Lista ──────────────────────────────────────

  if (!editMode) {
    return (
      <TooltipProvider>
        <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Templates</h1>
            <p className="text-muted-foreground mt-1">Modelos de laudo vinculados aos tipos de exame</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="border rounded-lg p-1 flex items-center gap-1 bg-muted/50">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('cards')}
                className="h-8 px-2.5"
                aria-label="Visualizar como cards"
                title="Cards"
              >
                <LayoutGrid size={14} />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-8 px-2.5"
                aria-label="Visualizar como lista"
                title="Lista"
              >
                <List size={14} />
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(true)}
              className="flex items-center gap-2"
            >
              <Upload size={16} /> Importar Documento
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
              <div>
                <CardTitle>Lista de Templates</CardTitle>
                <CardDescription>{viewMode === 'cards' ? filtered.length : filteredByTipo.length} template(s) encontrado(s)</CardDescription>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <Select value={filtroTipoExame} onValueChange={setFiltroTipoExame}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    {tiposExame.map(t => (
                      <SelectItem key={t.id} value={t.id}>{`${t.codigo || 'sem código'} - ${t.nome}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (viewMode === 'cards' ? filtered : filteredByTipo).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {filtroTipoExame ? 'Nenhum template encontrado.' : 'Nenhum template cadastrado.'}
              </div>
            ) : viewMode === 'cards' ? (
              <>
                <div className="relative w-full md:w-72 mb-4">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(t => (
                  <Card key={t.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-base truncate">{t.nome}</h3>
                          <p className="text-xs text-muted-foreground">{t.tipo_exame_codigo ? `${t.tipo_exame_codigo} - ${t.tipo_exame_nome || '—'}` : (t.tipo_exame_nome || '—')}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => handlePreviewCard(t)} aria-label="Pré-visualizar">
                            <Eye size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleClonar(t)} aria-label="Clonar template" title="Clonar template">
                            <Copy size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEditar(t)} aria-label="Editar">
                            <Edit size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => handleExcluir(t.id)}
                            aria-label="Excluir"
                            disabled={t.id === 'tpl-nao-definido'}
                            title={t.id === 'tpl-nao-definido' ? 'Template do sistema — não pode ser excluído' : 'Excluir'}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                      {t.descricao && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{t.descricao}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
                        <Layers size={12} />
                        <span>{t.qtd_secoes} seção(s)</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              </>
            ) : (
              <DataTable
                columns={columnDefs}
                data={filteredByTipo}
                searchColumn="nome"
                searchPlaceholder="Buscar por nome..."
              />
            )}
          </CardContent>
        </Card>

        {/* Dialog de Preview PDF (compartilhado com modo edição) */}
        <Dialog open={showPreview} onOpenChange={(open) => {
          if (!open && previewBlobUrl) {
            URL.revokeObjectURL(previewBlobUrl);
            setPreviewBlobUrl('');
          }
          setShowPreview(open);
        }}>
          <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Pré-visualização do Laudo (PDF)</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-[70vh] border rounded-lg overflow-hidden bg-gray-200">
              {generatingPdf ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Gerando PDF...
                </div>
              ) : (
                <iframe
                  src={previewBlobUrl}
                  className="w-full h-full min-h-[70vh] border-0"
                  title="Preview PDF"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        <ImportTemplateDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          tiposExame={tiposExame}
          placeholders={placeholders}
          onImportSuccess={carregarTemplates}
        />
      </div>
      </TooltipProvider>
    );
  }

  // ─── Modo Edição ─────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleVoltar}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              {editingTemplateId ? 'Editar Template' : 'Novo Template'}
            </h1>
            <p className="text-muted-foreground mt-1">Configure o modelo e suas seções</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handlePreview} disabled={generatingPdf} className="flex items-center gap-2">
          <Eye size={16} /> {generatingPdf ? 'Gerando PDF...' : 'Pré-visualizar'}
        </Button>
      </div>


      {/* Dialog de Preview PDF */}
      <Dialog open={showPreview} onOpenChange={(open) => {
        if (!open && previewBlobUrl) {
          URL.revokeObjectURL(previewBlobUrl);
          setPreviewBlobUrl('');
        }
        setShowPreview(open);
      }}>
        <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Pré-visualização do Laudo (PDF)</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-[70vh] border rounded-lg overflow-hidden bg-gray-200">
            {generatingPdf ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Gerando PDF...
              </div>
            ) : (
              <iframe
                src={previewBlobUrl}
                className="w-full h-full min-h-[70vh] border-0"
                title="Preview PDF"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText size={16} /> Dados do Template</CardTitle>
          <CardDescription>Informações básicas do modelo de laudo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={templateForm.nome}
                onChange={e => updateTemplateField('nome', e.target.value)}
                className={errors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}
                placeholder="Ex: Laudo de Local de Crime"
              />
              {errors.nome && <p className="text-xs text-red-600">{errors.nome}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo_exame_id">Tipo de Exame *</Label>
              <Select value={templateForm.tipo_exame_id} onValueChange={v => updateTemplateField('tipo_exame_id', v)}>
                <SelectTrigger id="tipo_exame_id" className={errors.tipo_exame_id ? 'border-red-500 focus-visible:ring-red-500' : ''}>
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {tiposExame.map(t => (
                    <SelectItem key={t.id} value={t.id}>{`${t.codigo || 'sem código'} - ${t.nome}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tipo_exame_id && <p className="text-xs text-red-600">{errors.tipo_exame_id}</p>}
            </div>
          </div>
          <div className="space-y-2 mt-4">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={templateForm.descricao}
              onChange={e => updateTemplateField('descricao', e.target.value)}
              placeholder="Descrição breve do template..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Seções */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Layers size={16} /> Seções do Laudo</CardTitle>
              <CardDescription>Adicione, edite e reordene as seções que compõem o laudo</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="border rounded-lg p-1 flex items-center gap-1 bg-muted/50">
                <Button
                  variant={editorMode === 'multi' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleEditorModeChange('multi')}
                  className="h-8 px-2.5"
                  title="Múltiplos editores por seção"
                >
                  <Layers size={14} />
                </Button>
                <Button
                  variant={editorMode === 'single' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleEditorModeChange('single')}
                  className="h-8 px-2.5"
                  title="Editor único (laudo inteiro)"
                >
                  <FileText size={14} />
                </Button>
              </div>
              {editorMode === 'multi' && (
                <Button variant="outline" size="sm" onClick={handleAddSecao} className="flex items-center gap-1">
                  <Plus size={14} /> Adicionar Seção
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {editorMode === 'single' ? (
            <>
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                Estrutura por seções preservada automaticamente. Para adicionar/remover seções, volte ao modo multi-editor.
              </div>
              <ContextMenu>
                <ContextMenuTrigger>
                  <TinyMceEditor
                    editorId="template-single-editor"
                    value={singleEditorHtml}
                    onChange={setSingleEditorHtml}
                    height={520}
                    placeholder="Edite o laudo completo..."
                  />
                </ContextMenuTrigger>
                <ContextMenuContent className="w-64">
                  <ContextMenuLabel>Inserir Placeholder</ContextMenuLabel>
                  <ContextMenuSeparator />
                  {categorias.map(cat => (
                    <ContextMenuSub key={cat.id}>
                      <ContextMenuSubTrigger className={`text-${cat.cor}-700 dark:text-${cat.cor}-300`}>
                        {cat.label}
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-56">
                        {placeholders
                          .filter(p => p.categoria_id === cat.id)
                          .sort((a, b) => a.chave.localeCompare(b.chave))
                          .map(p => (
                            <ContextMenuItem
                              key={p.id}
                              onClick={() => inserirPlaceholder('template-single-editor', p.chave)}
                            >
                              <div className="flex flex-col">
                                <span className="font-mono text-xs">{`{{${p.chave}}}`}</span>
                                {p.descricao && <span className="text-[10px] text-muted-foreground truncate">{p.descricao}</span>}
                              </div>
                            </ContextMenuItem>
                          ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  ))}
                </ContextMenuContent>
              </ContextMenu>
            </>
          ) : secoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma seção. Clique em "Adicionar Seção" para começar.
            </div>
          ) : (
            secoes.map((secao, index) => (
              <div key={index} className="rounded-lg border bg-card/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <GripVertical size={16} className="text-muted-foreground" />
                  <span className="text-sm font-semibold text-muted-foreground">Seção {index + 1}</span>
                  <Input
                    value={secao.nome}
                    onChange={e => updateSecao(index, 'nome', e.target.value)}
                    placeholder="Nome da seção (ex: Introdução, Metodologia...)"
                    className="flex-1 h-8 text-sm"
                  />
                  <Button variant="ghost" size="sm" onClick={() => handleMoveSecao(index, 'up')} disabled={index === 0} aria-label="Mover para cima">
                    <ArrowUp size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleMoveSecao(index, 'down')} disabled={index === secoes.length - 1} aria-label="Mover para baixo">
                    <ArrowDown size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleRemoveSecao(index)} aria-label="Remover seção">
                    <X size={14} />
                  </Button>
                </div>
                <ContextMenu>
                  <ContextMenuTrigger>
                    <TinyMceEditor
                      editorId={`template-secao-${index}`}
                      value={secao.conteudo}
                      onChange={html => updateSecao(index, 'conteudo', html)}
                      height={250}
                      placeholder={`Conteúdo da seção "${secao.nome || '...'}"`}
                    />
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-64">
                    <ContextMenuLabel>Inserir Placeholder</ContextMenuLabel>
                    <ContextMenuSeparator />
                    {categorias.map(cat => (
                      <ContextMenuSub key={cat.id}>
                        <ContextMenuSubTrigger className={`text-${cat.cor}-700 dark:text-${cat.cor}-300`}>
                          {cat.label}
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-56">
                          {placeholders
                            .filter(p => p.categoria_id === cat.id)
                            .sort((a, b) => a.chave.localeCompare(b.chave))
                            .map(p => (
                              <ContextMenuItem
                                key={p.id}
                                onClick={() => inserirPlaceholder(`template-secao-${index}`, p.chave)}
                              >
                                <div className="flex flex-col">
                                  <span className="font-mono text-xs">{`{{${p.chave}}}`}</span>
                                  {p.descricao && <span className="text-[10px] text-muted-foreground truncate">{p.descricao}</span>}
                                </div>
                              </ContextMenuItem>
                            ))}
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    ))}
                  </ContextMenuContent>
                </ContextMenu>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <Button variant="outline" onClick={handleVoltar}>Cancelar</Button>
        <Button onClick={handleSalvar} disabled={submitting} className="flex items-center gap-2">
          <Plus size={16} /> {submitting ? 'Salvando...' : editingTemplateId ? 'Atualizar' : 'Criar'} Template
        </Button>
      </div>
    </div>
    </TooltipProvider>
  );
};
