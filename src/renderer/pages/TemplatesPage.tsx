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
  Plus, Search, Edit, Trash2, Copy, ArrowLeft,
  FileText, Layers, Eye, LayoutGrid, List, Upload,
  Image as ImageIcon,
  Baseline,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PlaceholderContextMenu } from '@/components/editor/PlaceholderContextMenu';
import { TinyMceEditor } from '@/components/editor/TinyMceEditor';
import { converterPlaceholdersTextuais } from '@/lib/utils';
import { z } from 'zod';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { EXAM_MENU_REGISTRY, EXAM_TOGGLES } from '@/components/rep/exam-fields';
import { CAMPOS_ESPECIFICOS_PLACEHOLDERS } from '@/components/rep/exam-fields/placeholders';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ImportTemplateDialog } from '@/components/template/ImportTemplateDialog';
import { SecaoConfiguracaoTemplate } from '@/components/template/SecaoConfiguracaoTemplate';
import {
  getOpcoesRepeticaoTemplate,
  getTituloPadraoRepeticao,
  type DiagnosticoSecaoTemplate,
  type OpcaoSecaoPai,
  validarConfiguracaoSecaoTemplate,
} from '@/components/template/secao-configuracao-template.utils';
import { getMargens } from '@/lib/margens';
import { buildPdfHeaderConfig } from '@/lib/pdf-header';
import { limparIndicadoresCondicionais } from '@/lib/exportacao-placeholders';

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
  parent_id?: string | null;
  conteudo?: string;
  condicao?: string | null;
  repetir_para?: string | null;
  repetir_titulo?: string | null;
}

interface TemplateForm {
  nome: string;
  tipo_exame_id: string;
  descricao: string;
}

interface SecaoForm {
  id?: string;
  chave_local: string;
  nome: string;
  parent_id?: string;
  conteudo: string;
  condicao?: string;
  repetir_para?: string;
  repetir_titulo?: string;
}

type SecaoPreview = Pick<SecaoForm, 'id' | 'chave_local' | 'nome' | 'conteudo' | 'parent_id' | 'repetir_para' | 'repetir_titulo'>;

const emptyTemplateForm = (): TemplateForm => ({
  nome: '', tipo_exame_id: '', descricao: '',
});

const emptySecaoForm = (): SecaoForm => ({
  chave_local: crypto.randomUUID(),
  nome: '',
  parent_id: '',
  conteudo: '',
  repetir_para: '',
  repetir_titulo: '',
});

function hydrateSecaoForm(row: SecaoItem, placeholderChaves: string[]): SecaoForm {
  return {
    id: row.id,
    chave_local: row.id,
    nome: row.nome,
    parent_id: row.parent_id || '',
    conteudo: row.conteudo ? limparIndicadoresCondicionais(converterPlaceholdersTextuais(row.conteudo, placeholderChaves, true)) : '',
    condicao: row.condicao || '',
    repetir_para: row.repetir_para || '',
    repetir_titulo: row.repetir_titulo || '',
  };
}

function normalizarNomeSecao(nome?: string): string {
  return (nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function getSecaoVisual(secao: Pick<SecaoForm, 'nome' | 'parent_id' | 'repetir_para'>): string {
  if (!secao.parent_id) return 'border bg-card/50 border-border';

  const nome = normalizarNomeSecao(secao.nome);
  if (nome.includes('CARTUCHO')) return 'border bg-sky-50/70 border-sky-300 dark:bg-sky-950/20 dark:border-sky-900';
  if (nome.includes('ESTOJO')) return 'border bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-900';
  if (nome.includes('ARMA') || secao.repetir_para === 'armas') return 'border bg-amber-50/70 border-amber-300 dark:bg-amber-950/20 dark:border-amber-900';

  return 'border bg-card/50 border-border';
}

function getSecaoRef(secao: Pick<SecaoForm, 'id' | 'chave_local'>): string {
  return secao.id || secao.chave_local;
}

function normalizarSecoesHierarquicas(secoesFonte: SecaoForm[]): SecaoForm[] {
  const secoes = secoesFonte.map(secao => ({ ...secao }));
  const pais = secoes.filter(secao => !secao.parent_id);
  const paisRefs = new Set(pais.map(getSecaoRef));
  const filhosPorPai = new Map<string, SecaoForm[]>();
  const raizesOrdenadas: SecaoForm[] = [];

  for (const secao of secoes) {
    if (!secao.parent_id) {
      raizesOrdenadas.push({ ...secao, parent_id: '' });
      continue;
    }

    if (!paisRefs.has(secao.parent_id)) {
      raizesOrdenadas.push({ ...secao, parent_id: '' });
      continue;
    }

    const filhos = filhosPorPai.get(secao.parent_id) || [];
    filhos.push(secao);
    filhosPorPai.set(secao.parent_id, filhos);
  }

  return raizesOrdenadas.flatMap((pai) => {
    const paiRef = getSecaoRef(pai);
    return [pai, ...(filhosPorPai.get(paiRef) || [])];
  });
}

function getBlocosSecoes(secoesFonte: SecaoForm[]) {
  const secoes = normalizarSecoesHierarquicas(secoesFonte);
  const blocos: Array<{ pai: SecaoForm; filhos: SecaoForm[] }> = [];

  for (const secao of secoes) {
    if (!secao.parent_id) {
      blocos.push({ pai: secao, filhos: [] });
      continue;
    }

    const bloco = blocos.find(({ pai }) => getSecaoRef(pai) === secao.parent_id);
    if (bloco) {
      bloco.filhos.push(secao);
    } else {
      blocos.push({ pai: { ...secao, parent_id: '' }, filhos: [] });
    }
  }

  return blocos;
}

function flattenBlocosSecoes(blocos: Array<{ pai: SecaoForm; filhos: SecaoForm[] }>): SecaoForm[] {
  return blocos.flatMap(({ pai, filhos }) => [pai, ...filhos]);
}

function moverSecaoHierarquica(
  secoesFonte: SecaoForm[],
  indiceVisual: number,
  direcao: 'up' | 'down',
): SecaoForm[] {
  const secoes = normalizarSecoesHierarquicas(secoesFonte);
  const secao = secoes[indiceVisual];
  if (!secao) return secoesFonte;

  if (!secao.parent_id) {
    const blocos = getBlocosSecoes(secoes);
    const indiceBloco = blocos.findIndex(({ pai }) => getSecaoRef(pai) === getSecaoRef(secao));
    const destino = direcao === 'up' ? indiceBloco - 1 : indiceBloco + 1;
    if (indiceBloco < 0 || destino < 0 || destino >= blocos.length) return secoes;
    const next = [...blocos];
    [next[indiceBloco], next[destino]] = [next[destino], next[indiceBloco]];
    return flattenBlocosSecoes(next);
  }

  const paiRef = secao.parent_id;
  const bloco = getBlocosSecoes(secoes).find(({ pai }) => getSecaoRef(pai) === paiRef);
  if (!bloco) return secoes;
  const indiceFilho = bloco.filhos.findIndex((filho) => getSecaoRef(filho) === getSecaoRef(secao));
  const destino = direcao === 'up' ? indiceFilho - 1 : indiceFilho + 1;
  if (indiceFilho < 0 || destino < 0 || destino >= bloco.filhos.length) return secoes;
  const filhos = [...bloco.filhos];
  [filhos[indiceFilho], filhos[destino]] = [filhos[destino], filhos[indiceFilho]];
  const blocos = getBlocosSecoes(secoes).map((item) =>
    getSecaoRef(item.pai) === paiRef ? { ...item, filhos } : item,
  );
  return flattenBlocosSecoes(blocos);
}

function podeMoverSecao(
  secoesFonte: SecaoForm[],
  indiceVisual: number,
  direcao: 'up' | 'down',
): boolean {
  const secoes = normalizarSecoesHierarquicas(secoesFonte);
  const secao = secoes[indiceVisual];
  if (!secao) return false;

  if (!secao.parent_id) {
    const blocos = getBlocosSecoes(secoes);
    const indiceBloco = blocos.findIndex(({ pai }) => getSecaoRef(pai) === getSecaoRef(secao));
    return direcao === 'up'
      ? indiceBloco > 0
      : indiceBloco >= 0 && indiceBloco < blocos.length - 1;
  }

  const bloco = getBlocosSecoes(secoes).find(({ pai }) => getSecaoRef(pai) === secao.parent_id);
  if (!bloco) return false;
  const indiceFilho = bloco.filhos.findIndex((filho) => getSecaoRef(filho) === getSecaoRef(secao));
  return direcao === 'up'
    ? indiceFilho > 0
    : indiceFilho >= 0 && indiceFilho < bloco.filhos.length - 1;
}

function reposicionarSecaoPorPai(
  secoesFonte: SecaoForm[],
  indiceVisual: number,
  novoParentId: string,
): SecaoForm[] {
  const secoes = normalizarSecoesHierarquicas(secoesFonte);
  const alvo = secoes[indiceVisual];
  if (!alvo) return secoesFonte;

  const alvoRef = getSecaoRef(alvo);
  const base = secoes
    .filter((secao) => getSecaoRef(secao) !== alvoRef)
    .map((secao) => (
      secao.parent_id === alvoRef
        ? { ...secao, parent_id: '' }
        : secao
    ));

  const atualizado: SecaoForm = {
    ...alvo,
    parent_id: novoParentId,
  };

  if (!novoParentId) {
    const indicePaiAntigo = alvo.parent_id
      ? base.findIndex((secao) => getSecaoRef(secao) === alvo.parent_id)
      : -1;
    let destino = base.length;
    if (indicePaiAntigo >= 0) {
      destino = indicePaiAntigo + 1;
      while (destino < base.length && base[destino].parent_id === alvo.parent_id) {
        destino += 1;
      }
    }

    return normalizarSecoesHierarquicas([
      ...base.slice(0, destino),
      { ...atualizado, parent_id: '' },
      ...base.slice(destino),
    ]);
  }

  const indiceNovoPai = base.findIndex((secao) => getSecaoRef(secao) === novoParentId && !secao.parent_id);
  if (indiceNovoPai < 0) {
    return normalizarSecoesHierarquicas([...base, { ...atualizado, parent_id: '' }]);
  }

  let destino = indiceNovoPai + 1;
  while (destino < base.length && base[destino].parent_id === novoParentId) {
    destino += 1;
  }

  return normalizarSecoesHierarquicas([
    ...base.slice(0, destino),
    atualizado,
    ...base.slice(destino),
  ]);
}

interface Placeholder {
  id: string;
  chave: string;
  descricao: string;
  categoria_id: string;
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

function gerarSvgPlaceholderBase64(): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400' width='100%' height='auto'>
    <rect width='600' height='400' fill='#3a3a3a' rx='8'/>
    <rect x='235' y='115' width='130' height='100' rx='8' fill='none' stroke='#888' stroke-width='2.5'/>
    <circle cx='265' cy='145' r='11' fill='none' stroke='#888' stroke-width='2.5'/>
    <polyline points='235,195 275,162 325,195' fill='none' stroke='#888' stroke-width='2.5'/>
    <text x='300' y='260' text-anchor='middle' fill='#aaa' font-size='20' font-family='sans-serif' font-weight='500'>INSERIR IMAGEM</text>
    <text x='300' y='290' text-anchor='middle' fill='#777' font-size='13' font-family='sans-serif'>Clique para substituir</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function buildDummyFigureHtml(): string {
  const id = crypto.randomUUID();
  const src = gerarSvgPlaceholderBase64();
  return (
    `<figure class="laudo-figure" data-image-id="${id}" data-dummy="true" style="text-align:center;margin:12px auto;max-width:100%;cursor:pointer">` +
    `<img src="${src}" alt="Figura XX" style="max-width:100%;height:auto;border:1px solid #444;border-radius:4px;padding:4px"/>` +
    `<figcaption style="font-size:13px;color:#666;font-weight:bold;margin-top:4px">Figura XX</figcaption>` +
    `</figure><br>`
  );
}

interface SortableSecaoTemplateItemProps {
  secao: SecaoForm;
  index: number;
  total: number;
  categorias: Categoria[];
  placeholders: Placeholder[];
  placeholderChaves: string[];
  exameMenuStructure: typeof EXAM_MENU_REGISTRY[string] | undefined;
  categoriaExameId: string;
  tipoExameCodigo?: string;
  exameToggles: typeof EXAM_TOGGLES[string] | undefined;
  opcoesSecaoPai: OpcaoSecaoPai[];
  opcoesRepeticao: Array<{ value: string; label: string }>;
  diagnosticos: DiagnosticoSecaoTemplate[];
  inserirPlaceholder: (editorId: string, chave: string) => void;
  updateSecao: (index: number, field: keyof SecaoForm, value: string) => void;
  handleMoveSecao: (index: number, direction: 'up' | 'down') => void;
  handleRemoveSecao: (index: number) => void;
  podeSubir: boolean;
  podeDescer: boolean;
}

const SortableSecaoTemplateItem: React.FC<SortableSecaoTemplateItemProps> = ({
  secao,
  index,
  total,
  categorias,
  placeholders,
  placeholderChaves,
  exameMenuStructure,
  categoriaExameId,
  tipoExameCodigo,
  exameToggles,
  opcoesSecaoPai,
  opcoesRepeticao,
  diagnosticos,
  inserirPlaceholder,
  updateSecao,
  handleMoveSecao,
  handleRemoveSecao,
  podeSubir,
  podeDescer,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `template-secao-sortable-${getSecaoRef(secao)}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg p-4 space-y-3 ${getSecaoVisual(secao)} ${secao.parent_id ? 'ml-5' : ''}`}
    >
      <SecaoConfiguracaoTemplate
        secao={secao}
        index={index}
        total={total}
        tipoExameCodigo={tipoExameCodigo}
        exameToggles={exameToggles}
        opcoesSecaoPai={opcoesSecaoPai}
        opcoesRepeticao={opcoesRepeticao}
        placeholderChaves={placeholderChaves}
        diagnosticos={diagnosticos}
        podeSubir={podeSubir}
        podeDescer={podeDescer}
        dragHandleProps={{
          attributes: attributes as React.ButtonHTMLAttributes<HTMLButtonElement>,
          listeners: (listeners || {}) as React.ButtonHTMLAttributes<HTMLButtonElement>,
        }}
        onUpdateSecao={(field, value) => updateSecao(index, field, value)}
        onMoveSecao={direction => handleMoveSecao(index, direction)}
        onRemoveSecao={() => handleRemoveSecao(index)}
      />
      <PlaceholderContextMenu
        editorId={`template-secao-${getSecaoRef(secao)}`}
        categorias={categorias}
        placeholders={placeholders}
        onInsertPlaceholder={inserirPlaceholder}
        exameMenuStructure={exameMenuStructure}
        exameCamposEspecificos={undefined}
        categoriaExameId={categoriaExameId}
      >
        <TinyMceEditor
          editorId={`template-secao-${getSecaoRef(secao)}`}
          value={secao.conteudo}
          onChange={html => updateSecao(index, 'conteudo', html)}
          height={250}
          placeholder={`Conteúdo da seção "${secao.nome || '...'}"`}
          placeholderChaves={placeholderChaves}
          autoConverterReservados={true}
          condToggles={exameToggles}
        />
      </PlaceholderContextMenu>
    </div>
  );
};
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
  const [editorMode, setEditorMode] = useState<'multi' | 'single'>('single');
  const [singleEditorHtml, setSingleEditorHtml] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof TemplateForm, string>>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const placeholderChaves = useMemo(
    () => Array.from(new Set([
      ...placeholders.map(p => p.chave),
      ...CAMPOS_ESPECIFICOS_PLACEHOLDERS.map(p => p.chave),
    ])),
    [placeholders],
  );
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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
      setPlaceholders(r.data.map((p: any) => ({
        ...p,
        descricao: p.descricao || '',
        categoria_id: p.categoria_id || '',
      })));
    }
  }, []);

  useEffect(() => { carregarTemplates(); carregarTiposExame(); carregarPlaceholders(); }, []);

  const tipoExameCodigo = useMemo(() => {
    if (!templateForm.tipo_exame_id) return '';
    return tiposExame.find(t => t.id === templateForm.tipo_exame_id)?.codigo || '';
  }, [templateForm.tipo_exame_id, tiposExame]);

  const categoriaExameId = useMemo(() => (
    tipoExameCodigo ? `cat-exam-${tipoExameCodigo}` : ''
  ), [tipoExameCodigo]);

  const exameMenuStructure = useMemo(() => {
    if (!categoriaExameId) return undefined;
    const codigo = categoriaExameId.replace('cat-exam-', '');
    return EXAM_MENU_REGISTRY[codigo];
  }, [categoriaExameId]);

  const exameToggles = useMemo(() => {
    if (!tipoExameCodigo) return undefined;
    return EXAM_TOGGLES[tipoExameCodigo];
  }, [tipoExameCodigo]);

  const secoesOrdenadas = useMemo(() => normalizarSecoesHierarquicas(secoes), [secoes]);

  const opcoesSecaoPai = useMemo<OpcaoSecaoPai[]>(() => (
    secoesOrdenadas
      .map((secao, index) => ({ secao, index }))
      .filter(({ secao }) => !secao.parent_id)
      .map(({ secao, index }) => ({
        value: getSecaoRef(secao),
        label: secao.nome.trim() || `Seção ${index + 1}`,
      }))
  ), [secoesOrdenadas]);

  const opcoesRepeticao = useMemo(() => (
    getOpcoesRepeticaoTemplate(tipoExameCodigo)
  ), [tipoExameCodigo]);

  const diagnosticosSecoes = useMemo(() => (
    Object.fromEntries(
      secoesOrdenadas.map((secao) => [
        getSecaoRef(secao),
        validarConfiguracaoSecaoTemplate(secao, tipoExameCodigo),
      ]),
    ) as Record<string, DiagnosticoSecaoTemplate[]>
  ), [secoesOrdenadas, tipoExameCodigo]);

  const buildSingleHtmlFromSecoes = useCallback((secoesFonte: SecaoForm[]) => {
    const secoesNormalizadas = normalizarSecoesHierarquicas(secoesFonte);
    if (secoesNormalizadas.length === 0) {
      return `
        <div data-template-empty="true" style="padding:12px;border:1px dashed #bbb;border-radius:8px;color:#666;">
          Nenhuma seção definida. Volte para o modo multi-editor para adicionar seções.
        </div>
      `;
    }

    return secoesNormalizadas
      .map((sec, index) => {
        const nomeRaw = (sec.nome || '').trim();
        const nome = nomeRaw
          ? (/^(?:se[cç]ão\b|\d+[\s.\-:]|[a-zA-Z][.\-:]\s|[IVXLCDM]+[.\-:]\s)/i.test(nomeRaw)
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

    setSecoes(prev => normalizarSecoesHierarquicas(parseSingleHtmlToSecoes(singleEditorHtml, prev)));
    setEditorMode('multi');
  }, [buildSingleHtmlFromSecoes, editorMode, parseSingleHtmlToSecoes, secoes, singleEditorHtml]);

  const inserirPlaceholder = (editorId: string, chave: string) => {
    const editor = (window as any).tinymce?.get(editorId);
    if (editor) {
      editor.execCommand('insertPlaceholder', false, { chave });
    }
  };

  const inserirDummyNoEditor = () => {
    const activeEditor = (window as any).tinymce?.activeEditor;
    if (!activeEditor) {
      toast.error('Selecione o editor primeiro');
      return;
    }
    const editorId = activeEditor.id;
    if (!editorId || (!editorId.startsWith('template-single-editor') && !editorId.startsWith('template-secao-'))) {
      toast.error('Editor não encontrado');
      return;
    }
    if (editorMode === 'single') {
      activeEditor.insertContent(buildDummyFigureHtml());
    } else {
      activeEditor.execCommand('insertLaudoImageDummy', false, {});
    }
  };

  const inserirReservadoNoEditor = () => {
    const activeEditor = (window as any).tinymce?.activeEditor;
    if (!activeEditor) {
      toast.error('Selecione o editor primeiro');
      return;
    }
    const editorId = activeEditor.id;
    if (!editorId || (!editorId.startsWith('template-single-editor') && !editorId.startsWith('template-secao-'))) {
      toast.error('Editor não encontrado');
      return;
    }
    activeEditor.insertContent('<span class="campo-reservado" data-reservado="true">XXX</span>&nbsp;');
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
    setEditorMode('single');
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
      const forms = normalizarSecoesHierarquicas(s.map(se => hydrateSecaoForm(se, placeholderChaves)));
      setSecoes(forms);
      setSingleEditorHtml(buildSingleHtmlFromSecoes(forms));
    } else {
      setSecoesDb([]);
      setSecoes([emptySecaoForm()]);
      setSingleEditorHtml(buildSingleHtmlFromSecoes([emptySecaoForm()]));
    }
    setEditorMode('single');
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

      // Copiar as seções preservando hierarquia pai/filho
      const mapaIds = new Map<string, string>();
      const secoesOrdenadas = [...secoesOriginais].sort((a, b) => a.ordem - b.ordem);

      for (const sec of secoesOrdenadas.filter(s => !s.parent_id)) {
        const r = await window.ipcAPI.template.createSecao({
          template_id: novoId,
          nome: sec.nome,
          ordem: sec.ordem,
          parent_id: null,
          conteudo: sec.conteudo || '',
          condicao: sec.condicao || null,
          repetir_para: sec.repetir_para || null,
          repetir_titulo: sec.repetir_titulo || null,
        });
        if (r.success && r.data?.id) {
          mapaIds.set(sec.id, r.data.id);
        }
      }

      for (const sec of secoesOrdenadas.filter(s => s.parent_id)) {
        await window.ipcAPI.template.createSecao({
          template_id: novoId,
          nome: sec.nome,
          ordem: sec.ordem,
          parent_id: sec.parent_id ? mapaIds.get(sec.parent_id) || null : null,
          conteudo: sec.conteudo || '',
          condicao: sec.condicao || null,
          repetir_para: sec.repetir_para || null,
          repetir_titulo: sec.repetir_titulo || null,
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
        const forms = normalizarSecoesHierarquicas(s.map(se => hydrateSecaoForm(se, placeholderChaves)));
        setSecoes(forms);
        setSingleEditorHtml(buildSingleHtmlFromSecoes(forms));
      } else {
        setSecoesDb([]);
        setSecoes([emptySecaoForm()]);
        setSingleEditorHtml(buildSingleHtmlFromSecoes([emptySecaoForm()]));
      }
      setEditorMode('single');
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
    setSecoes(prev => normalizarSecoesHierarquicas([...prev, emptySecaoForm()]));
  };

  const handleRemoveSecao = (index: number) => {
    setSecoes(prev => {
      const secoesNormalizadas = normalizarSecoesHierarquicas(prev);
      const removida = secoesNormalizadas[index];
      if (!removida) return prev;

      return normalizarSecoesHierarquicas(secoesNormalizadas
        .filter((_, i) => i !== index)
        .map(secao => {
          const parentRef = secao.parent_id || '';
          if (parentRef === getSecaoRef(removida)) {
            return { ...secao, parent_id: '' };
          }
          return secao;
        }));
    });
  };

  const handleMoveSecao = (index: number, direction: 'up' | 'down') => {
    setSecoes(prev => moverSecaoHierarquica(prev, index, direction));
  };

  const updateSecao = (index: number, field: keyof SecaoForm, value: string) => {
    setSecoes(prev => {
      const secoesNormalizadas = normalizarSecoesHierarquicas(prev);
      if (field === 'parent_id') {
        return reposicionarSecaoPorPai(secoesNormalizadas, index, value || '');
      }

      return secoesNormalizadas.map((secao, i) => (
        i === index
          ? {
            ...secao,
            [field]: value,
            ...(field === 'repetir_para' && value === 'armas' && !secao.repetir_titulo?.trim()
              ? { repetir_titulo: getTituloPadraoRepeticao({ repetir_para: 'armas' }, tipoExameCodigo) }
              : {}),
          }
          : secao
      ));
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    setSecoes((prev) => {
      const secoesNormalizadas = normalizarSecoesHierarquicas(prev);
      const ativa = secoesNormalizadas.find(
        (secao) => `template-secao-sortable-${getSecaoRef(secao)}` === active.id,
      );
      const destino = secoesNormalizadas.find(
        (secao) => `template-secao-sortable-${getSecaoRef(secao)}` === over.id,
      );

      if (!ativa || !destino) return prev;

      if (!ativa.parent_id) {
        const blocos = getBlocosSecoes(secoesNormalizadas);
        const origem = blocos.findIndex(({ pai }) => getSecaoRef(pai) === getSecaoRef(ativa));
        const alvoRef = destino.parent_id || getSecaoRef(destino);
        const alvo = blocos.findIndex(({ pai }) => getSecaoRef(pai) === alvoRef);
        if (origem < 0 || alvo < 0 || origem === alvo) return prev;

        const next = [...blocos];
        const [blocoAtivo] = next.splice(origem, 1);
        next.splice(alvo, 0, blocoAtivo);
        return flattenBlocosSecoes(next);
      }

      if (ativa.parent_id && destino.parent_id && ativa.parent_id === destino.parent_id) {
        const blocos = getBlocosSecoes(secoesNormalizadas);
        return flattenBlocosSecoes(
          blocos.map((bloco) => {
            if (getSecaoRef(bloco.pai) !== ativa.parent_id) return bloco;

            const filhos = [...bloco.filhos];
            const origem = filhos.findIndex((filho) => getSecaoRef(filho) === getSecaoRef(ativa));
            const alvo = filhos.findIndex((filho) => getSecaoRef(filho) === getSecaoRef(destino));
            if (origem < 0 || alvo < 0 || origem === alvo) return bloco;

            const [filhoAtivo] = filhos.splice(origem, 1);
            filhos.splice(alvo, 0, filhoAtivo);
            return { ...bloco, filhos };
          }),
        );
      }

      return prev;
    });
  };

  const handleSalvar = async () => {
    try {
      setSubmitting(true);
      setErrors({});
      const secoesParaSalvar = normalizarSecoesHierarquicas(editorMode === 'single'
        ? parseSingleHtmlToSecoes(singleEditorHtml, secoes)
        : secoes);

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

      const diagnosticos = secoesParaSalvar.flatMap(secao => (
        validarConfiguracaoSecaoTemplate(secao, tipoExameCodigo)
      ));
      if (diagnosticos.some(item => item.tipo === 'erro')) {
        toast.error('Revise as seções destacadas antes de salvar o template.');
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

        // Criar/atualizar seções em duas etapas para resolver parent_id de seções novas
        const idsOrdenados: string[] = [];
        const mapaIds = new Map<string, string>();

        for (const sec of secoesParaSalvar) {
          if (sec.id) {
            mapaIds.set(sec.id, sec.id);
          }
        }

        for (let i = 0; i < secoesParaSalvar.length; i++) {
          const sec = secoesParaSalvar[i];
          if (!sec.nome.trim() || sec.parent_id) continue;

          if (sec.id) {
            await window.ipcAPI.template.updateSecao(sec.id, {
              nome: sec.nome.trim(),
              conteudo: sec.conteudo,
              ordem: i,
              parent_id: null,
              condicao: sec.condicao || null,
              repetir_para: sec.repetir_para || null,
              repetir_titulo: sec.repetir_titulo || null,
            });
          } else {
            const r = await window.ipcAPI.template.createSecao({
              template_id: templateId,
              nome: sec.nome.trim(),
              ordem: i,
              parent_id: null,
              conteudo: sec.conteudo,
              condicao: sec.condicao || null,
              repetir_para: sec.repetir_para || null,
              repetir_titulo: sec.repetir_titulo || null,
            });
            if (r.success) {
              mapaIds.set(sec.chave_local, r.data.id);
            }
          }
        }

        for (let i = 0; i < secoesParaSalvar.length; i++) {
          const sec = secoesParaSalvar[i];
          if (!sec.nome.trim() || !sec.parent_id) continue;

          const parentIdResolvido = mapaIds.get(sec.parent_id) || null;
          if (sec.id) {
            await window.ipcAPI.template.updateSecao(sec.id, {
              nome: sec.nome.trim(),
              conteudo: sec.conteudo,
              ordem: i,
              parent_id: parentIdResolvido,
              condicao: sec.condicao || null,
              repetir_para: sec.repetir_para || null,
              repetir_titulo: sec.repetir_titulo || null,
            });
          } else {
            const r = await window.ipcAPI.template.createSecao({
              template_id: templateId,
              nome: sec.nome.trim(),
              ordem: i,
              parent_id: parentIdResolvido,
              conteudo: sec.conteudo,
              condicao: sec.condicao || null,
              repetir_para: sec.repetir_para || null,
              repetir_titulo: sec.repetir_titulo || null,
            });
            if (r.success) {
              mapaIds.set(sec.chave_local, r.data.id);
            }
          }
        }

        for (const sec of secoesParaSalvar) {
          const secaoId = sec.id || mapaIds.get(sec.chave_local);
          if (secaoId) {
            idsOrdenados.push(secaoId);
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
          const nextSecoes = normalizarSecoesHierarquicas(
            r.data.map((s: SecaoItem) => hydrateSecaoForm(s, placeholderChaves)),
          );
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
  const gerarEExibirPdf = async (fullHtml: string, headerTemplate?: string) => {
    const result = await window.ipcAPI.template.previewPDF(fullHtml, await getMargens(), headerTemplate);
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

  /** Monta o HTML com cabeçalho + placeholders substituídos. Retorna o HTML completo e o headerTemplate. */
  const montarHtmlPreview = async (
    secoesFonte: SecaoPreview[],
    templateNome: string,
    tipoExameNome: string,
  ): Promise<{ fullHtml: string; headerTemplate: string }> => {
    const { headerTemplate, cabecalhoPrimeiraPagina } = await buildPdfHeaderConfig({
      numeroRepFallback: '321.654-2026',
    });

    const secoesNormalizadas = normalizarSecoesHierarquicas(secoesFonte);
    const pais = secoesNormalizadas.filter(secao => !secao.parent_id && secao.nome.trim());
    const filhosPorPai = new Map<string, typeof secoesFonte>();
    secoesNormalizadas
      .filter(secao => secao.parent_id && secao.nome.trim())
      .forEach(secao => {
        const filhos = filhosPorPai.get(secao.parent_id || '') || [];
        filhos.push(secao);
        filhosPorPai.set(secao.parent_id || '', filhos);
      });

    const secoesHtml = pais
      .map((pai, indicePai) => {
        const partes = [
          `<h2>${indicePai + 1}. ${pai.nome.trim()}</h2>`,
          pai.conteudo || '',
        ];

        const paiRef = getSecaoRef(pai);
        const filhos = filhosPorPai.get(paiRef || '') || [];
        filhos.forEach((filho, indiceFilho) => {
          partes.push(`<h3>${indicePai + 1}.${indiceFilho + 1} ${filho.nome.trim()}</h3>`);
          partes.push(filho.conteudo || '<p style="color: #999; font-style: italic;">(subseção vazia)</p>');
        });

        return partes.join('\n');
      })
      .join('\n');

    let fullHtml = cabecalhoPrimeiraPagina
      ? `<div class="cabecalho" style="padding-bottom:16px;margin-bottom:32px;">${cabecalhoPrimeiraPagina}</div>`
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

    fullHtml = limparIndicadoresCondicionais(fullHtml);

    return { fullHtml, headerTemplate };
  };

  /** Pré-visualizar a partir do editor (usa estado atual das seções) */
  const handlePreview = async () => {
    try {
      setGeneratingPdf(true);
      setShowPreview(true);
      const secoesParaPreview = normalizarSecoesHierarquicas(editorMode === 'single'
        ? parseSingleHtmlToSecoes(singleEditorHtml, secoes)
        : secoes);

      const tipoExameNome = tiposExame.find(t => t.id === templateForm.tipo_exame_id)?.nome || '';
      const { fullHtml, headerTemplate } = await montarHtmlPreview(secoesParaPreview, templateForm.nome, tipoExameNome);
      await gerarEExibirPdf(fullHtml, headerTemplate);
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
      const loadedSecoes: SecaoPreview[] =
        (secResult.success && secResult.data ? secResult.data : []).map((s: any) => ({
          id: s.id,
          chave_local: s.id,
          nome: s.nome,
          parent_id: s.parent_id || '',
          repetir_para: s.repetir_para || '',
          repetir_titulo: s.repetir_titulo || '',
          conteudo: s.conteudo ? converterPlaceholdersTextuais(s.conteudo, placeholderChaves, true) : '',
        }));

      const { fullHtml, headerTemplate } = await montarHtmlPreview(
        normalizarSecoesHierarquicas(loadedSecoes),
        template.nome,
        template.tipo_exame_nome || '',
      );
      await gerarEExibirPdf(fullHtml, headerTemplate);
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
              <Upload size={16} /> Importar Template
            </Button>
            <Button variant="outline" onClick={handleNovo} className="flex items-center gap-2">
              <Plus size={16} /> Novo Template
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
            setPreviewBlobUrl(null);
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
              ) : previewBlobUrl ? (
                <iframe
                  src={previewBlobUrl}
                  className="w-full h-full min-h-[70vh] border-0"
                  title="Preview PDF"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Erro ao gerar PDF
                </div>
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
      <p className="text-xs text-muted-foreground mt-1 italic">Placeholders de exame (B-602, I-801) são resolvidos na exportação do laudo. Use a prévia do laudo ou exporte para visualizar os dados reais.</p>

      {/* Dialog de Preview PDF */}
      <Dialog open={showPreview} onOpenChange={(open) => {
        if (!open && previewBlobUrl) {
          URL.revokeObjectURL(previewBlobUrl);
          setPreviewBlobUrl(null);
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
            ) : previewBlobUrl ? (
              <iframe
                src={previewBlobUrl}
                className="w-full h-full min-h-[70vh] border-0"
                title="Preview PDF"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Erro ao gerar PDF
              </div>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={editorMode === 'multi' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleEditorModeChange('multi')}
                      className="h-8 px-2.5"
                    >
                      <Layers size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Editor com múltiplas seções separadas</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={editorMode === 'single' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleEditorModeChange('single')}
                      className="h-8 px-2.5"
                    >
                      <FileText size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Editor único com laudo inteiro</TooltipContent>
                </Tooltip>
              </div>
              <div className="border rounded-lg p-1 flex items-center gap-1 bg-muted/50">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={inserirDummyNoEditor}
                    className="h-8 px-2.5"
                  >
                    <ImageIcon size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Inserir Espaço para Ilustração</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={inserirReservadoNoEditor}
                    className="h-8 px-2.5"
                  >
                    <Baseline size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Inserir Campo Reservado (XXX)</TooltipContent>
              </Tooltip>
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
            <PlaceholderContextMenu
                editorId="template-single-editor"
                categorias={categorias}
                placeholders={placeholders}
                onInsertPlaceholder={inserirPlaceholder}
                exameMenuStructure={exameMenuStructure}
                exameCamposEspecificos={undefined}
                categoriaExameId={categoriaExameId}
              >
                  <TinyMceEditor
                    editorId="template-single-editor"
                    value={singleEditorHtml}
                    onChange={(html: string) => setSingleEditorHtml(html)}
                    height={520}
                    placeholder="Edite o laudo completo..."
                    placeholderChaves={placeholderChaves}
                    autoConverterReservados={true}
                    condToggles={exameToggles}
                  />
              </PlaceholderContextMenu>
          ) : secoesOrdenadas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma seção. Clique em &quot;Adicionar Seção&quot; para começar.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={secoesOrdenadas.map((secao) => `template-secao-sortable-${getSecaoRef(secao)}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {secoesOrdenadas.map((secao, index) => (
                    <SortableSecaoTemplateItem
                      key={getSecaoRef(secao)}
                      secao={secao}
                      index={index}
                      total={secoesOrdenadas.length}
                      categorias={categorias}
                      placeholders={placeholders}
                      placeholderChaves={placeholderChaves}
                      exameMenuStructure={exameMenuStructure}
                      categoriaExameId={categoriaExameId}
                      tipoExameCodigo={tipoExameCodigo}
                      exameToggles={exameToggles}
                      opcoesSecaoPai={opcoesSecaoPai}
                      opcoesRepeticao={opcoesRepeticao}
                      diagnosticos={diagnosticosSecoes[getSecaoRef(secao)] || []}
                      inserirPlaceholder={inserirPlaceholder}
                      updateSecao={updateSecao}
                      handleMoveSecao={handleMoveSecao}
                      handleRemoveSecao={handleRemoveSecao}
                      podeSubir={podeMoverSecao(secoesOrdenadas, index, 'up')}
                      podeDescer={podeMoverSecao(secoesOrdenadas, index, 'down')}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
