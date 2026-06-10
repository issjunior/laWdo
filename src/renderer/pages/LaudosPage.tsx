import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Save, ArrowLeft, Edit, ChevronDown, ChevronRight, Eye, FileText, Trash2, Layers, List, Bot, SpellCheck, PenLine, Image as ImageIcon, Send, Sun, Moon, SunMoon, ExternalLink, Tag, RefreshCw, ShieldAlert, Lock, CheckCircle, RotateCcw, Clock, Zap, Plus, Wand2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { TinyMceEditor } from '@/components/editor/TinyMceEditor';
import { AISectionToolbar } from '@/components/ai/AISectionToolbar';
import { AISheet, type ChatMessage } from '@/components/ai/AISheet';
import { removerFormatacaoPlaceholders, cn, converterPlaceholdersTextuais } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IlustracoesPanel, type ImagemLaudo } from '@/components/laudo/IlustracoesPanel';
import { RepTimelineDialog } from '@/components/timeline/RepTimelineDialog';
import { PlaceholderContextMenu } from '@/components/editor/PlaceholderContextMenu';
import { CAMPOS_ESPECIFICOS_PLACEHOLDERS } from '@/components/rep/exam-fields/placeholders';
import { EXAM_MENU_REGISTRY } from '@/components/rep/exam-fields';
import type { MenuSection } from '@/components/rep/exam-fields';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reindexarFiguras } from '@/lib/figuras';
import { getMargens } from '@/lib/margens';
import { buildPdfHeaderConfig } from '@/lib/pdf-header';
import { toast } from 'sonner';

function buildFigureHtml(url: string, id: string, legenda: string): string {
  return (
    `<figure class="laudo-figure" data-image-id="${id}" style="text-align:center;margin:12px auto;max-width:100%">` +
    `<img src="${url}" alt="${legenda}" style="max-width:100%;height:auto;border:1px solid #ddd;border-radius:4px;padding:4px"/>` +
    `<figcaption style="font-size:13px;color:#666;font-weight:bold;margin-top:4px">Figura XX${legenda ? ': ' + legenda : ''}</figcaption>` +
    `</figure><br>`
  );
}

function buildFiguresHtml(imagens: Array<{ url: string; id: string; legenda: string }>): string {
  return imagens.map(img => buildFigureHtml(img.url, img.id, img.legenda)).join('');
}

const TABLE_STYLES = {
  table:  { borderCollapse: 'collapse', width: '100%', margin: '8px 0' },
  title:  { background: '#d9d9d9', color: '#000', fontWeight: 'bold', textAlign: 'center' as const },
  th:     { border: '1px solid #000', padding: '6px 10px', textAlign: 'center' as const, fontWeight: '600', background: '#e8e8e8', color: '#000', fontSize: '12px' },
  td:     { border: '1px solid #000', padding: '6px 10px', fontSize: '12px', color: '#000' },
  item:   { width: '50px', textAlign: 'center' as const },
} as const;

function style(obj: Record<string, string>): string {
  return Object.entries(obj).map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`).join(';');
}

function buildNumberedTable(titulo: string, headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '';

  const allHeaders = ['Item', ...headers];
  const colCount = allHeaders.length;
  const theadRow = `<tr>${allHeaders.map(h => `<th style="${style(TABLE_STYLES.th)}">${h}</th>`).join('')}</tr>`;

  const tbodyRows = rows.map((row, i) => {
    const cells = [
      `<td style="${style({ ...TABLE_STYLES.td, ...TABLE_STYLES.item })};">${i + 1}</td>`,
      ...row.map(cell => {
        const val = (cell ?? '').trim() === '' ? '-' : cell;
        return `<td style="${style(TABLE_STYLES.td)}">${val}</td>`;
      }),
    ].join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const titleRow = `<tr><td colspan="${colCount}" style="${style({ ...TABLE_STYLES.th, ...TABLE_STYLES.title })};border:1px solid #000;padding:6px 10px">${titulo}</td></tr>`;

  return `<table style="${style(TABLE_STYLES.table)}"><thead>${titleRow}${theadRow}</thead><tbody>${tbodyRows}</tbody></table>`;
}

function buildDadosInvestigacaoTable(b602: Record<string, unknown>): string {
  const envolvidos = (b602.envolvidos as string[] | undefined)?.filter(Boolean) ?? [];
  const dataOcorrencia = String(b602.data_ocorrencia || '-');
  const local = String(b602.local || '-');
  const numeroBo = String(b602.numero_bo || '-');
  const numeroIp = String(b602.numero_ip || '-');
  const solicitanteNome = String(b602.solicitante_nome || '-');

  const s = TABLE_STYLES;

  const titleRow = `<tr><td colspan="4" style="${style({ ...s.th, ...s.title })};border:1px solid #000;padding:6px 10px">TABELA 1 – DADOS DA INVESTIGAÇÃO</td></tr>`;

  const cell = (val: string, w?: string, extra?: string) =>
    `<td style="${style(s.td)}${w ? ';width:' + w : ''}${extra ? ';' + extra : ''}">${val}</td>`;

  const labelCell = (val: string, w?: string) =>
    `<td style="${style({ ...s.td, fontWeight: '600' })}${w ? ';width:' + w : ''}">${val}</td>`;

  const envolvidosVal = envolvidos.length > 0 ? envolvidos.join(', ') : '-';

  const rows = [
    titleRow,
    `<tr>${labelCell('Envolvido(s):', '25%')}<td colspan="3" style="${style(s.td)}">${envolvidosVal}</td></tr>`,
    `<tr>${labelCell('Data da Ocorrência:', '25%')}${cell(dataOcorrencia, '25%')}${labelCell('Local:', '25%')}${cell(local, '25%')}</tr>`,
    `<tr>${labelCell('Boletim de Ocorrência:', '25%')}${cell(numeroBo, '25%')}${labelCell('Nº do IP:', '25%')}${cell(numeroIp, '25%')}</tr>`,
    `<tr><td colspan="1" style="${style({ ...s.td, fontWeight: '600' })};width:25%">Unidade Policial:</td><td colspan="3" style="${style(s.td)};width:75%">${solicitanteNome}</td></tr>`,
  ];

  return `<table style="${style(s.table)}">${rows.join('')}</table>`;
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

// ... (seções de interfaces mantidas)

function formatarData(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    const data = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
    if (isNaN(data.getTime())) return iso;
    return data.toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function formatarDataExtenso(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    const data = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
    if (isNaN(data.getTime())) return iso;
    return data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatarDataHora(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    const data = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
    if (isNaN(data.getTime())) return iso;
    return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

const aplicarPlaceholders = (html: string, repData: any, extraContext?: { solicitanteNome?: string; tipoExameNome?: string; tipoExameCodigo?: string }) => {
  if (!repData) return html;

  // Buscar usuário logado para placeholders de perito
  let perito: any = null;
  try {
    const userJson = sessionStorage.getItem('lawdo_auth_user');
    if (userJson) perito = JSON.parse(userJson);
  } catch (e) {}

  // Mapeamento exaustivo para cobrir diferentes estilos de tag
  const mapping: Record<string, string> = {
    // Prefixados com rep. (compatibilidade com placeholders antigos)
    'rep.numero': repData.numero || '',
    'rep.documento': repData.numero_documento || '',
    'rep.local': repData.local_fato || '',
    'rep.data': formatarData(repData.data_requisicao),
    'rep.autoridade': repData.autoridade_solicitante || '',
    'rep.requisicao': repData.numero_documento || '',

    // Prefixados com rep_ (notação do banco de dados — seed do sistema)
    'rep_numero': repData.numero || '',
    'rep_data_requisicao': formatarData(repData.data_requisicao),
    'rep_prazo': repData.prazo || '',
    'rep_tipo_solicitacao': repData.tipo_solicitacao || '',
    'rep_numero_documento': repData.numero_documento || '',
    'rep_data_documento': formatarData(repData.data_documento),
    'rep_data_acionamento': formatarDataHora(repData.data_acionamento),
    'rep_data_chegada': formatarDataHora(repData.data_chegada),
    'rep_data_saida': formatarDataHora(repData.data_saida),
    'rep_observacoes': repData.observacoes || '',

    // Relacionamentos (preenchidos via extraContext em handlePreview)
    'solicitante_nome': extraContext?.solicitanteNome || '',
    'tipo_exame_nome': extraContext?.tipoExameNome || '',
    'tipo_exame_codigo': extraContext?.tipoExameCodigo || '',

    // Sem prefixo (compatibilidade)
    'NUMERO_REP': repData.numero || '',
    'NUMERO': repData.numero || '',
    'LOCAL_FATO': repData.local_fato || '',
    'AUTORIDADE': repData.autoridade_solicitante || '',

    // Sem prefixo (notação recomendada após migração)
    'numero_rep': repData.numero || '',
    'data_recebimento_rep': formatarData(repData.data_requisicao),
    'tipo_solicitacao_rep': repData.tipo_solicitacao || '',
    'numero_solicitacao_rep': repData.numero_documento || '',
    'data_solicitacao_rep': formatarData(repData.data_documento),
    'data_acionamento_local': formatarDataHora(repData.data_acionamento),
    'data_chegada_local': formatarDataHora(repData.data_chegada),
    'data_saida_local': formatarDataHora(repData.data_saida),
    'observacoes_rep': repData.observacoes || '',

    // Perito (notação com ponto — compatibilidade retroativa)
    'perito.nome': perito?.nome || '',
    'perito.cargo': perito?.cargo || 'Perito Criminal',
    'perito.especialidade': perito?.especialidade || '',

    // Perito (notação snake_case — seed do sistema)
    'perito_nome': perito?.nome || '',
    'perito_cargo': perito?.cargo || 'Perito Criminal',
    'perito_lotacao': perito?.lotacao || '',
    'perito_matricula': perito?.matricula || '',

    // Geral
    'data_atual': new Date().toLocaleDateString('pt-BR'),
    'data_extenso_recebimento_rep': formatarDataExtenso(repData.data_requisicao),
  };

  if (repData.campos_especificos) {
    try {
      const especificos = JSON.parse(repData.campos_especificos);
      for (const placeholder of CAMPOS_ESPECIFICOS_PLACEHOLDERS) {
        const partes = placeholder.jsonPath.split('.');
        let valor: unknown = especificos;
        for (const parte of partes) {
          valor = (valor as Record<string, unknown>)?.[parte];
        }
        if (valor !== undefined && valor !== null && valor !== '') {
          mapping[placeholder.chave] = String(valor);
        }
      }

      const b602 = especificos.b602 as Record<string, unknown> | undefined;
      if (b602) {
        const envolvidos = b602.envolvidos as string[] | undefined;
        if (envolvidos && envolvidos.length > 0) {
          mapping['b602_envolvidos'] = envolvidos.filter(Boolean).join(', ');
          envolvidos.forEach((nome, i) => {
            mapping[`b602_envolvido_${i + 1}`] = nome;
          });
        }

        mapping['b602_tabela_dados_investigacao'] = buildDadosInvestigacaoTable(b602);

        const material = b602.material_enc as Record<string, string>[] | undefined;
        if (material && material.length > 0) {
          mapping['b602_tabela_material_enc'] = buildNumberedTable(
            'TABELA 2 – MATERIAL ENCAMINHADO',
            ['Natureza', 'Qtd', 'Tipo', 'Dito do Ofício', 'Nº do Lacre'],
            material.map(m => [m.natureza || '', m.quantidade || '', m.tipo || '', m.dito_oficio || '', m.numero_lacre || ''])
          );
          material.forEach((m, i) => {
            mapping[`b602_material_enc_${i + 1}_natureza`] = m.natureza || '';
            mapping[`b602_material_enc_${i + 1}_quantidade`] = m.quantidade || '';
            mapping[`b602_material_enc_${i + 1}_tipo`] = m.tipo || '';
            mapping[`b602_material_enc_${i + 1}_dito_oficio`] = m.dito_oficio || '';
            mapping[`b602_material_enc_${i + 1}_numero_lacre`] = m.numero_lacre || '';
          });
        }

        const cartuchos = b602.cartuchos as Record<string, unknown>[] | undefined;
        if (cartuchos && cartuchos.length > 0) {
          mapping['b602_tabela_cartuchos'] = buildNumberedTable(
            'TABELA 3 – CARTUCHOS',
            ['Qtd', 'Calibre', 'Marca', 'Origem', 'Espoleta', 'Estojo', 'Projétil', 'Observação'],
            cartuchos.map(c => [
              String(c.quantidade || ''),
              String(c.calibre || ''),
              String(c.marca || ''),
              String(c.origem || ''),
              String(c.espoleta || ''),
              String(c.estojo || ''),
              String(c.projetil || ''),
              Array.isArray(c.observacao) ? (c.observacao as string[]).join(', ') : String(c.observacao || ''),
            ])
          );
          cartuchos.forEach((c, i) => {
            mapping[`b602_cartucho_${i + 1}_quantidade`] = String(c.quantidade || '');
            mapping[`b602_cartucho_${i + 1}_calibre`] = String(c.calibre || '');
            mapping[`b602_cartucho_${i + 1}_marca`] = String(c.marca || '');
            mapping[`b602_cartucho_${i + 1}_origem`] = String(c.origem || '');
            mapping[`b602_cartucho_${i + 1}_espoleta`] = String(c.espoleta || '');
            mapping[`b602_cartucho_${i + 1}_estojo`] = String(c.estojo || '');
            mapping[`b602_cartucho_${i + 1}_projetil`] = String(c.projetil || '');
            mapping[`b602_cartucho_${i + 1}_observacao`] = Array.isArray(c.observacao) ? (c.observacao as string[]).join(', ') : '';
          });
        }

        const estojos = b602.estojos as Record<string, unknown>[] | undefined;
        if (estojos && estojos.length > 0) {
          mapping['b602_tabela_estojos'] = buildNumberedTable(
            'TABELA 4 – ESTOJOS',
            ['Qtd', 'Calibre', 'Marca', 'Origem', 'Espoleta', 'Estojo', 'Observação'],
            estojos.map(e => [
              String(e.quantidade || ''),
              String(e.calibre || ''),
              String(e.marca || ''),
              String(e.origem || ''),
              String(e.espoleta || ''),
              String(e.estojo || ''),
              Array.isArray(e.observacao) ? (e.observacao as string[]).join(', ') : String(e.observacao || ''),
            ])
          );
          estojos.forEach((e, i) => {
            mapping[`b602_estojo_${i + 1}_quantidade`] = String(e.quantidade || '');
            mapping[`b602_estojo_${i + 1}_calibre`] = String(e.calibre || '');
            mapping[`b602_estojo_${i + 1}_marca`] = String(e.marca || '');
            mapping[`b602_estojo_${i + 1}_origem`] = String(e.origem || '');
            mapping[`b602_estojo_${i + 1}_espoleta`] = String(e.espoleta || '');
            mapping[`b602_estojo_${i + 1}_estojo`] = String(e.estojo || '');
            mapping[`b602_estojo_${i + 1}_observacao`] = Array.isArray(e.observacao) ? (e.observacao as string[]).join(', ') : '';
          });
        }
      }
    } catch { /* mantém mapping atual */ }
  }

  try {
    // 1. Usar DOMParser para encontrar e substituir spans de placeholder
    //    (muito mais robusto que regex, imune a modificações do TinyMCE no HTML)
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const placeholderSpans = doc.querySelectorAll('span[data-placeholder]');
    placeholderSpans.forEach(span => {
      const rawPlaceholder = span.getAttribute('data-placeholder') || '';
      // Extrai a chave de dentro de {{...}}
      const chaveMatch = rawPlaceholder.match(/^\{\{(.+)\}\}$/);
      if (chaveMatch) {
        const chave = chaveMatch[1];
        const valor = mapping[chave];
        if (valor !== undefined) {
          span.replaceWith(doc.createRange().createContextualFragment(valor));
        }
      }
    });

    // Serializa de volta, extraindo apenas o conteúdo do <body>
    let resultado = doc.body.innerHTML;

    // 2. Substituir tags de texto puro {{...}} que sobraram ou foram digitadas manualmente
    Object.entries(mapping).forEach(([chave, valor]) => {
      const displayValue = valor || '';
      const escapedChave = chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tagRegex = new RegExp(`\\{\\{${escapedChave}\\}\\}`, 'gi');
      resultado = resultado.replace(tagRegex, displayValue);
    });

    // 3. Se houver campos rep.X, tentar substituir também {{X}}
    Object.entries(mapping).forEach(([chave, valor]) => {
      if (chave.startsWith('rep.')) {
        const semPrefixo = chave.replace('rep.', '');
        const tagRegex = new RegExp(`\\{\\{${semPrefixo}\\}\\}`, 'gi');
        resultado = resultado.replace(tagRegex, valor || '');
      }
    });

    return resultado;
  } catch {
    // Fallback: se DOMParser falhar (muito raro), tentar só regex textual
    let resultado = html;
    Object.entries(mapping).forEach(([chave, valor]) => {
      const displayValue = valor || '';
      const escapedChave = chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tagRegex = new RegExp(`\\{\\{${escapedChave}\\}\\}`, 'gi');
      resultado = resultado.replace(tagRegex, displayValue);
    });
    return resultado;
  }
};

interface LaudoItem {
  id: string;
  rep_id: string;
  perito_id: string;
  template_id: string;
  conteudo: string;
  status: string;
  data_inicio: string;
  data_conclusao?: string;
  data_entrega?: string;
  rep_numero: string;
  template_nome: string;
  status_rep: string;
  tipo_exame_nome?: string;
  tipo_exame_codigo?: string;
  nome_envolvido?: string;
  data_requisicao?: string;
  tipo_solicitacao?: string;
  numero_documento?: string;
  tipo_criacao?: string;
  wizard_id?: string;
}

interface SecaoEditor {
  titulo: string;
  conteudo: string;
}

/** Decodifica entidades HTML (&Acirc; → Â, &amp; → &, etc.) usando o parser do navegador */
function decodificarEntidadesHtml(texto: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = texto;
  return txt.value;
}

/** Faz o parse do HTML do laudo em seções independentes, usando <h2> como delimitador */
function parseConteudoEmSecoes(html: string): SecaoEditor[] {
  if (!html) return [{ titulo: 'Conteúdo', conteudo: '<p>&nbsp;</p>' }];

  const regexH2 = /<h2[^>]*>(.*?)<\/h2>/gi;
  const matches: { titulo: string; pos: number; endPos: number }[] = [];
  let match;

  while ((match = regexH2.exec(html)) !== null) {
    matches.push({
      titulo: decodificarEntidadesHtml(match[1].replace(/<[^>]*>/g, '').trim()),
      pos: match.index,
      endPos: match.index + match[0].length,
    });
  }

  if (matches.length === 0) {
    return [{ titulo: 'Conteúdo', conteudo: html }];
  }

  const secoes: SecaoEditor[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].endPos;
    const end = i < matches.length - 1 ? matches[i + 1].pos : html.length;
    const conteudo = html.substring(start, end).trim();
    secoes.push({
      titulo: matches[i].titulo,
      conteudo: conteudo || '<p>&nbsp;</p>',
    });
  }

  return secoes;
}

/** Reconstrói o HTML completo concatenando as seções */
function reconstruirConteudo(secoes: SecaoEditor[]): string {
  return secoes.map(s => `<h2>${s.titulo}</h2>\n${s.conteudo}`).join('\n');
}

export const LaudosPage: React.FC = () => {
  const navigate = useNavigate();
  const [laudos, setLaudos] = useState<LaudoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<LaudoItem | null>(null);
  const [secoes, setSecoes] = useState<SecaoEditor[]>([]);
  const [secoesColapsadas, setSecoesColapsadas] = useState<Record<number, boolean>>({});
  const [editorMode, setEditorMode] = useState<'multi' | 'single'>('single');
  const [singleEditorHtml, setSingleEditorHtml] = useState('');
  const singleTemImagens = useMemo(() => {
    if (!singleEditorHtml) return false;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(singleEditorHtml, 'text/html');
      return Array.from(doc.querySelectorAll('img')).some(
        (img) => img.src.startsWith('data:') || img.src.startsWith('http') || img.src.startsWith('blob:')
      );
    } catch {
      return false;
    }
  }, [singleEditorHtml]);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState('');
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [iaSheetOpen, setIaSheetOpen] = useState(false);
  const [iaSheetSecaoIdx, setIaSheetSecaoIdx] = useState<number | null>(null);
  const [iaSheetSecaoTitulo, setIaSheetSecaoTitulo] = useState('');
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [iaLoading, setIaLoading] = useState(false);
  const [iaError, setIaError] = useState<string | null>(null);
  const [iaSheetMode, setIaSheetMode] = useState<'ortografia' | 'adequar' | 'imagem' | 'perguntar' | null>(null);
  const [singlePergunta, setSinglePergunta] = useState('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [laudoParaExcluir, setLaudoParaExcluir] = useState<LaudoItem | null>(null);
  const [senhaExclusao, setSenhaExclusao] = useState('');
  const [senhaExclusaoErro, setSenhaExclusaoErro] = useState('');
  const [verificandoSenhaExclusao, setVerificandoSenhaExclusao] = useState(false);
  const [passoExclusao, setPassoExclusao] = useState<'confirmar' | 'senha'>('confirmar');
  const [iluminacoesPanelOpen, setIlustracoesPanelOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelPoppedOut, setPanelPoppedOut] = useState(false);

  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLaudo, setTimelineLaudo] = useState<LaudoItem | null>(null);

  const [exameMenuStructure, setExameMenuStructure] = useState<MenuSection[] | undefined>(undefined);
  const [exameCamposEspecificos, setExameCamposEspecificos] = useState<Record<string, unknown> | undefined>(undefined);
  const [categoriaExameId, setCategoriaExameId] = useState<string>('');

  const togglePanel = useCallback(() => {
    setPanelCollapsed(prev => !prev);
  }, []);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [figuraAtivaId, setFiguraAtivaId] = useState<string | null>(null);

  const [ilustracoesKey, setIlustracoesKey] = useState(0);
  const [ilustracoesRemounting, setIlustracoesRemounting] = useState(false);
  const remountScheduledRef = useRef(false);
  const scrollRestoreRef = useRef<number | null>(null);

  const SINGLE_CHAT_KEY = 'single-editor';

  const placeholderChaves = useMemo(() => placeholders.map(p => p.chave), [placeholders]);

  const [editorTheme, setEditorTheme] = useState<'light' | 'dark' | 'auto'>(() => {
    try { return (localStorage.getItem('laudo_editor_theme') as 'light' | 'dark' | 'auto') || 'auto'; }
    catch { return 'auto'; }
  });

  const toggleEditorTheme = useCallback(() => {
    setEditorTheme(prev => {
      const next = prev === 'light' ? 'dark' : prev === 'dark' ? 'auto' : 'light';
      try { localStorage.setItem('laudo_editor_theme', next); } catch {}
      return next;
    });
  }, []);

  const themeLabel = editorTheme === 'light' ? 'Claro' : editorTheme === 'dark' ? 'Escuro' : 'Auto';
  const ThemeIcon = editorTheme === 'light' ? Sun : editorTheme === 'dark' ? Moon : SunMoon;

  const buildSingleHtmlFromSecoes = useCallback((secoesFonte: SecaoEditor[]) => {
    if (secoesFonte.length === 0) return '';
    return secoesFonte
      .map((sec, index) => {
        const tituloRaw = (sec.titulo || '').trim();
        const titulo = tituloRaw
          ? (/^(?:se[cç]ão\b|\d+[\s\.\-\:]|[a-zA-Z][\.\-\:]\s|[IVXLCDM]+[\.\-\:]\s)/i.test(tituloRaw)
            ? tituloRaw
            : `Seção ${index + 1}: ${tituloRaw}`)
          : `Seção ${index + 1}`;
        const conteudo = sec.conteudo?.trim() || '<p>&nbsp;</p>';
        return `
          <section data-laudo-secao="true" data-secao-index="${index}" style="margin-bottom:16px;border:1px solid rgba(128,128,128,0.2);border-radius:8px;overflow:hidden;">
            <div contenteditable="false" data-laudo-secao-header="true" style="background:rgba(128,128,128,0.08);padding:8px 12px;border-bottom:1px solid rgba(128,128,128,0.2);font-weight:600;color:inherit;">
              ${titulo}
            </div>
            <div data-laudo-secao-content="true" style="padding:8px 4px;">
              ${conteudo}
            </div>
          </section>
        `;
      })
      .join('\n');
  }, []);

  const parseSingleHtmlToSecoes = useCallback((singleHtml: string, secoesBase: SecaoEditor[]) => {
    if (!singleHtml || secoesBase.length === 0) return secoesBase;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(singleHtml, 'text/html');
      const sectionNodes = Array.from(doc.querySelectorAll('section[data-laudo-secao="true"]'));
      if (sectionNodes.length === 0) return secoesBase;

      const contentByIndex = new Map<number, string>();
      sectionNodes.forEach(node => {
        const idxRaw = node.getAttribute('data-secao-index');
        const idx = idxRaw != null ? Number(idxRaw) : NaN;
        const contentNode = node.querySelector('[data-laudo-secao-content="true"]') as HTMLElement | null;
        if (!Number.isNaN(idx) && contentNode) {
          contentByIndex.set(idx, (contentNode.innerHTML || '').trim() || '<p>&nbsp;</p>');
        }
      });

      return secoesBase.map((sec, idx) => ({
        ...sec,
        conteudo: contentByIndex.get(idx) ?? sec.conteudo,
      }));
    } catch {
      return secoesBase;
    }
  }, []);

  const getSecoesSincronizadas = useCallback(() => {
    return editorMode === 'single' ? parseSingleHtmlToSecoes(singleEditorHtml, secoes) : secoes;
  }, [editorMode, parseSingleHtmlToSecoes, singleEditorHtml, secoes]);

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

  const carregarPlaceholders = useCallback(async () => {
    const rCat = await window.ipcAPI.categoria.findAll();
    if (rCat.success && rCat.data) {
      setCategorias(rCat.data);
    }
    const rPlace = await window.ipcAPI.placeholder.findAll();
    if (rPlace.success && rPlace.data) {
      setPlaceholders(rPlace.data);
    }
  }, []);

  const carregarLaudos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const r = await window.ipcAPI.laudo.findAll();
      if (r.success && r.data) {
        setLaudos(r.data);
      } else {
        setError(r.error || 'Erro ao carregar laudos');
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar laudos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarLaudos();
    carregarPlaceholders();
  }, [carregarLaudos, carregarPlaceholders]);

  useEffect(() => {
    if (!syncEnabled || !editando) {
      setFiguraAtivaId(null);
      return;
    }

    const ratios = new Map<string, number>();
    const observers: IntersectionObserver[] = [];

    const timeout = setTimeout(() => {
      const editors: any[] = editorMode === 'single'
        ? [(window as any).tinymce?.get('laudo-single-editor')].filter(Boolean)
        : secoes.map((_, i) => (window as any).tinymce?.get(`secao-${i}`)).filter(Boolean);

      for (const editor of editors) {
        const body = editor.getBody();
        const win = editor.getWin();
        if (!body || !win) continue;

        const observer = new win.IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const id = (entry.target as HTMLElement).getAttribute('data-image-id') || '';
              ratios.set(id, entry.intersectionRatio);
            }
            let bestId: string | null = null;
            let bestRatio = 0;
            ratios.forEach((r, id) => {
              if (r > bestRatio) { bestRatio = r; bestId = id; }
            });
            setFiguraAtivaId(bestId);
          },
          { threshold: [0, 0.25, 0.5, 0.75, 1] }
        );

        body.querySelectorAll('.laudo-figure').forEach(f => observer.observe(f));
        observers.push(observer);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      observers.forEach(o => o.disconnect());
    };
  }, [syncEnabled, editando, editorMode, secoes, singleEditorHtml]);

  const inserirPlaceholder = (editorId: string, chave: string) => {
    const editor = (window as any).tinymce?.get(editorId);
    if (editor) {
      editor.execCommand('insertPlaceholder', false, { chave });
    }
  };

  /**
   * Verifica e cria a seção "ILUSTRAÇÕES" no modo multi-seção.
   * Retorna o índice da seção de ilustrações.
   */
  const garantirSecaoIlustracoes = useCallback((): { idx: number; secoes: SecaoEditor[] } => {
    const idxExistente = secoes.findIndex(s => s.titulo.trim().toUpperCase() === 'ILUSTRAÇÕES');
    if (idxExistente >= 0) return { idx: idxExistente, secoes };

    const novaSecao: SecaoEditor = {
      titulo: 'ILUSTRAÇÕES',
      conteudo: '<p>&nbsp;</p>',
    };

    const titulosUpper = secoes.map(s => s.titulo.trim().toUpperCase());
    let idx: number;
    const novas: SecaoEditor[] = [...secoes];

    const idxConsideracoes = titulosUpper.indexOf('CONSIDERAÇÕES FINAIS');
    if (idxConsideracoes >= 0) {
      novas.splice(idxConsideracoes, 0, novaSecao);
      idx = idxConsideracoes;
    } else {
      const idxEncerramento = titulosUpper.indexOf('ENCERRAMENTO');
      if (idxEncerramento >= 0) {
        novas.splice(idxEncerramento, 0, novaSecao);
        idx = idxEncerramento;
      } else {
        const idxConclusao = titulosUpper.indexOf('CONCLUSÃO');
        if (idxConclusao >= 0) {
          novas.splice(idxConclusao, 0, novaSecao);
          idx = idxConclusao;
        } else {
          idx = novas.length;
          novas.push(novaSecao);
        }
      }
    }

    setSecoes(novas);
    setSecoesColapsadas(prev => ({ ...prev, [idx]: false }));
    return { idx, secoes: novas };
  }, [secoes]);

  /** Extrai figuras do HTML de um editor (modo multi ou single) */
  const extrairFigurasDoHtml = (html: string): ImagemLaudo[] => {
    if (!html) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const figures = doc.querySelectorAll('.laudo-figure');
    return Array.from(figures)
      .map((fig, idx) => {
        const id = fig.getAttribute('data-image-id') || '';
        const dummy = fig.getAttribute('data-dummy') === 'true';
        const img = fig.querySelector('img');
        const figcaption = fig.querySelector('figcaption');
        return {
          id,
          url: img?.getAttribute('src') || '',
          thumbnailUrl: img?.getAttribute('src') || '',
          legenda: figcaption?.textContent?.replace(/^Fig(?:ura|\.)\s*(?:\d+|XX)[:\s]*\s*/i, '').trim() || '',
          numero_figura: idx + 1,
          sequencia: idx + 1,
          created_at: '',
          dummy,
        };
      })
      .filter(f => f.id && f.url);
  };

  const extrairFigurasDoEditor = useCallback((): ImagemLaudo[] => {
    if (editorMode === 'single') {
      return extrairFigurasDoHtml(singleEditorHtml);
    }
    return secoes.flatMap(s => extrairFigurasDoHtml(s.conteudo));
  }, [editorMode, singleEditorHtml, secoes]);

  const handleScrollToFigure = useCallback((imageId: string) => {
    const editorIds = editorMode === 'single'
      ? ['laudo-single-editor']
      : secoes.map((_, i) => `secao-${i}`);
    for (const editorId of editorIds) {
      const editor = (window as any).tinymce?.get(editorId);
      if (!editor) continue;
      const figure = editor.getBody()?.querySelector(`.laudo-figure[data-image-id="${imageId}"]`);
      if (figure) {
        figure.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
    }
  }, [editorMode, secoes]);

  const atualizarConteudoSecao = useCallback((idx: number, novoConteudo: string) => {
    setSecoes(prev => {
      const novas = [...prev];
      novas[idx] = { ...novas[idx], conteudo: novoConteudo };
      return novas;
    });
  }, []);

  const obterEditorIlustracoes = useCallback((): {
    editorId: string;
    idx: number;
    editor: any | null;
    secoesAtuais: SecaoEditor[];
  } => {
    if (editorMode === 'single') {
      const editor = (window as any).tinymce?.get('laudo-single-editor');
      return { editorId: 'laudo-single-editor', idx: -1, editor, secoesAtuais: secoes };
    }
    const { idx, secoes: secoesAtuais } = garantirSecaoIlustracoes();
    const editor = (window as any).tinymce?.get(`secao-${idx}`);
    return { editorId: `secao-${idx}`, idx, editor, secoesAtuais };
  }, [editorMode, secoes, garantirSecaoIlustracoes]);

  const aplicarFigurasNoEditor = useCallback((
    operacao: string,
    imagens: Array<{ url: string; id: string; legenda: string }>,
    substituirConteudo: boolean = false,
  ): { metodo: 'execCommand' | 'remount'; count: number } => {
    const { editorId, idx, editor } = obterEditorIlustracoes();

    if (editor && editor.initialized && editor.getBody()) {
      if (substituirConteudo) {
        const body = editor.getBody();
        Array.from(body.querySelectorAll('.laudo-figure')).forEach(fig => {
          const next = fig.nextElementSibling;
          fig.remove();
          if (next && (next.tagName === 'BR' || next.tagName === 'P')) next.remove();
        });
      }
      for (const img of imagens) {
        editor.execCommand('insertLaudoImage', false, {
          url: img.url, id: img.id, legenda: img.legenda
        });
      }
      console.info(`[ilustracoes] ${operacao}: execCommand ${editorId} ✓ ${imagens.length} figs`);
      return { metodo: 'execCommand', count: imagens.length };
    }

    const secaoIlus = secoes.find(s => s.titulo.trim().toUpperCase() === 'ILUSTRAÇÕES');
    const isNewOrEmpty = !secaoIlus || secaoIlus.conteudo === '<p>&nbsp;</p>';
    const baseContent = (substituirConteudo || isNewOrEmpty)
      ? ''
      : (secaoIlus?.conteudo || '');

    atualizarConteudoSecao(idx, baseContent + buildFiguresHtml(imagens));

    if (editor?.getBody()) {
      scrollRestoreRef.current = editor.getBody().parentElement?.scrollTop || 0;
    }

    setIlustracoesRemounting(true);

    if (!remountScheduledRef.current) {
      remountScheduledRef.current = true;
      queueMicrotask(() => {
        setIlustracoesKey(k => k + 1);
        remountScheduledRef.current = false;
      });
    }

    const status = editor ? 'loaded-without-body' : 'not-loaded';
    console.warn(`[ilustracoes] ${operacao}: remount ${editorId} (editor: ${status}) ${imagens.length} figs`);
    return { metodo: 'remount', count: imagens.length };
  }, [secoes, obterEditorIlustracoes, atualizarConteudoSecao]);

  const handleIlustracoesEditorInit = useCallback((editor: any) => {
    if (scrollRestoreRef.current !== null && editor.getBody()) {
      const scrollContainer = editor.getBody().parentElement;
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollRestoreRef.current;
      }
      scrollRestoreRef.current = null;
    }
    setIlustracoesRemounting(false);
    console.info('[ilustracoes] remount: editor inicializado, scroll restaurado ✓');
  }, []);

  /**
   * Sincroniza a ordem das figuras no editor com a ordem do painel de ilustrações.
   * Chamado após drag-and-drop no painel (painel → editor).
   */
  const sincronizarOrdemEditor = useCallback((
    imagensOrdenadas: Array<{ url: string; id: string; legenda: string }>
  ) => {
    if (editorMode === 'single') return;
    const idxIlustracoes = secoes.findIndex(s => s.titulo.trim().toUpperCase() === 'ILUSTRAÇÕES');
    if (idxIlustracoes < 0) return;
    aplicarFigurasNoEditor('reorder', imagensOrdenadas, true);
  }, [editorMode, secoes, aplicarFigurasNoEditor]);

  const panelCallbacksRef = useRef<{
    onInsertImage: (url: string, id: string, legenda: string) => void;
    onDeleteImage: (imageId: string) => void;
    onUpdateLegenda: (id: string, legenda: string) => void;
    onReorder: (imagens: ImagemLaudo[]) => void;
    onRefreshHtml: () => void;
    onInsertAll: (imagens: ImagemLaudo[]) => void;
    onSyncToggle: (enabled: boolean) => void;
    onScrollToFigure: (imageId: string) => void;
    onReplaceImage: (imageId: string, dataUri?: string) => void;
    syncCurrentState: () => void;
  }>({
    onInsertImage: () => {},
    onDeleteImage: () => {},
    onUpdateLegenda: () => {},
    onReorder: () => {},
    onRefreshHtml: () => {},
    onInsertAll: () => {},
    onSyncToggle: () => {},
    onScrollToFigure: () => {},
    onReplaceImage: () => {},
    syncCurrentState: () => {},
  });

  panelCallbacksRef.current = {
    onInsertImage: (url, id, legenda) => {
      if (editorMode === 'single') {
        const editor = (window as any).tinymce?.get('laudo-single-editor');
        if (!editor) {
          console.error('[ilustracoes] insertImage: ERRO single mode - editor not found');
          toast.error('Editor não encontrado. Tente recarregar a página.');
          return;
        }
        const secoesAtualizadas = parseSingleHtmlToSecoes(editor.getContent(), secoes);
        let idxIlus = secoesAtualizadas.findIndex(s => s.titulo.trim().toUpperCase() === 'ILUSTRAÇÕES');
        let secoesComIlus = [...secoesAtualizadas];
        if (idxIlus < 0) {
          const titulos = secoesAtualizadas.map(s => s.titulo.trim().toUpperCase());
          const idxRef = titulos.indexOf('CONSIDERAÇÕES FINAIS');
          if (idxRef >= 0) { idxIlus = idxRef; }
          else {
            const idxEnc = titulos.indexOf('ENCERRAMENTO');
            if (idxEnc >= 0) { idxIlus = idxEnc; }
            else {
              const idxConcl = titulos.indexOf('CONCLUSÃO');
              idxIlus = idxConcl >= 0 ? idxConcl : secoesAtualizadas.length;
            }
          }
          secoesComIlus.splice(idxIlus, 0, { titulo: 'ILUSTRAÇÕES', conteudo: '<p>&nbsp;</p>' });
        }
        const secaoIlus = secoesComIlus[idxIlus];
        const baseContent = secaoIlus.conteudo === '<p>&nbsp;</p>' ? '' : secaoIlus.conteudo;
        secoesComIlus[idxIlus] = { ...secaoIlus, conteudo: baseContent + buildFigureHtml(url, id, legenda) };
        setSecoes(secoesComIlus);
        const novoHtml = buildSingleHtmlFromSecoes(secoesComIlus);
        setSingleEditorHtml(novoHtml);
        editor.setContent(novoHtml);
        toast.success('Imagem inserida na seção ILUSTRAÇÕES');
        return;
      }
      const r = aplicarFigurasNoEditor('insertImage', [{ url, id, legenda }]);
      if (r.metodo === 'execCommand') {
        toast.success('Imagem inserida na seção ILUSTRAÇÕES');
      } else {
        toast.info('Imagem adicionada. O editor está carregando — a figura aparecerá em instantes.');
      }
    },
    onDeleteImage: (imageId) => {
      if (editorMode === 'single') {
        const editor = (window as any).tinymce?.get('laudo-single-editor');
        if (!editor) return;
        editor.execCommand('removeLaudoImage', false, { id: imageId });
        const novoHtml = editor.getContent();
        setSingleEditorHtml(novoHtml);

        const novasSecoes = parseSingleHtmlToSecoes(novoHtml, secoes);
        const idxIlus = novasSecoes.findIndex(s => s.titulo.trim().toUpperCase() === 'ILUSTRAÇÕES');
        if (idxIlus >= 0) {
          const temFiguras = extrairFigurasDoHtml(novasSecoes[idxIlus].conteudo).length > 0;
          if (!temFiguras) {
            novasSecoes.splice(idxIlus, 1);
            setSecoesColapsadas(prev => {
              const novo: Record<number, boolean> = {};
              Object.keys(prev).forEach(k => {
                const i = Number(k);
                if (i < idxIlus) novo[i] = prev[i];
                else if (i > idxIlus) novo[i - 1] = prev[i];
              });
              return novo;
            });
            toast.success('Seção ILUSTRAÇÕES removida');
          }
        }
        setSecoes(novasSecoes);
        console.info('[ilustracoes] deleteImage: single mode ✓');
        return;
      }
      const idxIlustracoes = secoes.findIndex(
        s => s.titulo.trim().toUpperCase() === 'ILUSTRAÇÕES'
      );
      if (idxIlustracoes < 0) {
        console.warn('[ilustracoes] deleteImage: seção ILUSTRAÇÕES não encontrada');
        return;
      }
      const editor = (window as any).tinymce?.get(`secao-${idxIlustracoes}`);
      if (!editor || !editor.getBody()) {
        console.warn(
          `[ilustracoes] deleteImage: secao-${idxIlustracoes} editor not ready, falling back to state-path`
        );
        setSecoes(prev => {
          const novas = [...prev];
          const secao = novas[idxIlustracoes];
          const parser = new DOMParser();
          const doc = parser.parseFromString(secao.conteudo, 'text/html');
          const figure = doc.querySelector(`.laudo-figure[data-image-id="${imageId}"]`);
          if (figure) {
            const next = figure.nextElementSibling;
            figure.remove();
            if (next && (next.tagName === 'BR' || next.tagName === 'P')) next.remove();
          }
          novas[idxIlustracoes] = { ...secao, conteudo: doc.body.innerHTML || '<p>&nbsp;</p>' };
          return novas;
        });
        toast.success('Figura removida da seção ILUSTRAÇÕES');
        return;
      }
      editor.execCommand('removeLaudoImage', false, { id: imageId });
      atualizarConteudoSecao(idxIlustracoes, editor.getContent());
      const temFiguras = editor.getBody()?.querySelector('.laudo-figure');
      if (!temFiguras) {
        setSecoes(prev => {
          const novas = [...prev];
          novas.splice(idxIlustracoes, 1);
          return novas;
        });
        setSecoesColapsadas(prev => {
          const novo: Record<number, boolean> = {};
          Object.keys(prev).forEach(k => {
            const i = Number(k);
            if (i < idxIlustracoes) novo[i] = prev[i];
            else if (i > idxIlustracoes) novo[i - 1] = prev[i];
          });
          return novo;
        });
        toast.success('Seção ILUSTRAÇÕES removida');
      }
      console.info(`[ilustracoes] deleteImage: execCommand secao-${idxIlustracoes} ✓`);
    },
    onUpdateLegenda: (id, legenda) => {
      const atualizarFigcaption = (editor: any) => {
        const figure = editor.getBody()?.querySelector(`.laudo-figure[data-image-id="${id}"]`);
        if (figure) {
          const figcaption = figure.querySelector('figcaption');
          if (figcaption) {
            const legendaAtual = figcaption.textContent || '';
            const match = legendaAtual.match(/Fig(?:ura|\.)\s*(\d+|XX)/i);
            const num = match ? match[1] : '';
            const numFormatado = num === 'XX' ? 'XX' : (num ? num.padStart(2, '0') : 'XX');
            figcaption.textContent = legenda
              ? `Figura ${numFormatado}: ${legenda}`
              : `Figura ${numFormatado}`;
            const img = figure.querySelector('img');
            if (img) img.alt = figcaption.textContent;
          }
          return true;
        }
        return false;
      };
      if (editorMode === 'single') {
        const editor = (window as any).tinymce?.get('laudo-single-editor');
        if (editor && atualizarFigcaption(editor)) {
          const novoHtml = editor.getContent();
          setSingleEditorHtml(novoHtml);
          setSecoes(parseSingleHtmlToSecoes(novoHtml, secoes));
        }
        return;
      }
      for (let idx = 0; idx < secoes.length; idx++) {
        const editor = (window as any).tinymce?.get(`secao-${idx}`);
        if (editor && atualizarFigcaption(editor)) {
          atualizarConteudoSecao(idx, editor.getContent());
          break;
        }
      }
    },
    onReorder: (imagens) => {
      if (editorMode === 'single') {
        const editor = (window as any).tinymce?.get('laudo-single-editor');
        if (!editor) return;
        const secoesAtualizadas = parseSingleHtmlToSecoes(editor.getContent(), secoes);
        const idxIlus = secoesAtualizadas.findIndex(s => s.titulo.trim().toUpperCase() === 'ILUSTRAÇÕES');
        if (idxIlus < 0) return;
        const secoesReordenadas = [...secoesAtualizadas];
        secoesReordenadas[idxIlus] = { ...secoesAtualizadas[idxIlus], conteudo: buildFiguresHtml(imagens.map(i => ({ url: i.url, id: i.id, legenda: i.legenda }))) };
        setSecoes(secoesReordenadas);
        const novoHtml = buildSingleHtmlFromSecoes(secoesReordenadas);
        setSingleEditorHtml(novoHtml);
        editor.setContent(novoHtml);
        return;
      }
      sincronizarOrdemEditor(imagens.map(i => ({ url: i.url, id: i.id, legenda: i.legenda })));
    },
    onRefreshHtml: () => {
      if (editorMode === 'single') {
        const editor = (window as any).tinymce?.get('laudo-single-editor');
        if (editor) {
          editor.execCommand('scanAndWrapImages');
          const novoHtml = editor.getContent();
          setSingleEditorHtml(novoHtml);
          setSecoes(parseSingleHtmlToSecoes(novoHtml, secoes));
        }
      } else {
        setSecoes(prev => {
          const novas = [...prev];
          for (let idx = 0; idx < prev.length; idx++) {
            const editor = (window as any).tinymce?.get(`secao-${idx}`);
            if (editor) {
              editor.execCommand('scanAndWrapImages');
              novas[idx] = { ...novas[idx], conteudo: editor.getContent() };
            } else {
              novas[idx] = { ...novas[idx], conteudo: reindexarFiguras(prev[idx].conteudo) };
            }
          }
          return novas;
        });
      }
    },
    onInsertAll: (imagens) => {
      if (!imagens || imagens.length === 0) {
        toast.info('Nenhuma imagem carregada para inserir');
        return;
      }

      if (editorMode === 'single') {
        const editor = (window as any).tinymce?.get('laudo-single-editor');
        if (editor) {
          const secoesAtualizadas = parseSingleHtmlToSecoes(editor.getContent(), secoes);
          let idxIlus = secoesAtualizadas.findIndex(s => s.titulo.trim().toUpperCase() === 'ILUSTRAÇÕES');
          let secoesComIlus = [...secoesAtualizadas];
          if (idxIlus < 0) {
            const titulos = secoesAtualizadas.map(s => s.titulo.trim().toUpperCase());
            const idxRef = titulos.indexOf('CONSIDERAÇÕES FINAIS');
            if (idxRef >= 0) { idxIlus = idxRef; }
            else {
              const idxEnc = titulos.indexOf('ENCERRAMENTO');
              if (idxEnc >= 0) { idxIlus = idxEnc; }
              else {
                const idxConcl = titulos.indexOf('CONCLUSÃO');
                idxIlus = idxConcl >= 0 ? idxConcl : secoesAtualizadas.length;
              }
            }
            secoesComIlus.splice(idxIlus, 0, { titulo: 'ILUSTRAÇÕES', conteudo: '<p>&nbsp;</p>' });
          }
          const secaoIlus = secoesComIlus[idxIlus];
          const baseContent = secaoIlus.conteudo === '<p>&nbsp;</p>' ? '' : secaoIlus.conteudo;
          secoesComIlus[idxIlus] = { ...secaoIlus, conteudo: baseContent + buildFiguresHtml(imagens.map(i => ({ url: i.url, id: i.id, legenda: i.legenda }))) };
          setSecoes(secoesComIlus);
          const novoHtml = buildSingleHtmlFromSecoes(secoesComIlus);
          setSingleEditorHtml(novoHtml);
          editor.setContent(novoHtml);
          toast.success(`${imagens.length} imagens inseridas na seção ILUSTRAÇÕES`);
        }
        return;
      }

      const r = aplicarFigurasNoEditor('insertAll', imagens.map(i => ({ url: i.url, id: i.id, legenda: i.legenda })));
      if (r.metodo === 'execCommand') {
        toast.success(`${r.count} imagens inseridas na seção ILUSTRAÇÕES`);
      } else {
        toast.info(`${r.count} imagens adicionadas. O editor está carregando — as figuras aparecerão em instantes.`);
      }
    },
    onSyncToggle: (enabled) => { setSyncEnabled(enabled); },
    onScrollToFigure: (imageId) => { handleScrollToFigure(imageId); },
    onReplaceImage: (imageId, dataUri?) => {
      const executarReplace = (dataUrl: string) => {
        if (editorMode === 'single') {
          const editor = (window as any).tinymce?.get('laudo-single-editor');
          if (editor) {
            editor.execCommand('replaceLaudoImage', false, { imageId, newUrl: dataUrl });
            const novoHtml = editor.getContent();
            setSingleEditorHtml(novoHtml);
            setSecoes(parseSingleHtmlToSecoes(novoHtml, secoes));
          }
        } else {
          for (let idx = 0; idx < secoes.length; idx++) {
            const editor = (window as any).tinymce?.get(`secao-${idx}`);
            if (editor) {
              const figure = editor.getBody()?.querySelector(`.laudo-figure[data-image-id="${imageId}"]`);
              if (figure) {
                editor.execCommand('replaceLaudoImage', false, { imageId, newUrl: dataUrl });
                atualizarConteudoSecao(idx, editor.getContent());
                break;
              }
            }
          }
        }
        toast.success('Imagem placeholder substituída');
      };

      if (dataUri) {
        executarReplace(dataUri);
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => executarReplace(reader.result as string);
        reader.readAsDataURL(file);
      };
      input.click();
    },
    syncCurrentState: () => {
      window.ipcAPI.ilustracoes.syncToPanel({
        figurasNoEditor: extrairFigurasDoEditor(),
        syncEnabled,
        figuraAtivaId,
        tema: document.body.classList.contains('dark') ? 'dark' : 'light',
      });
    },
  };

  useEffect(() => {
    if (!panelPoppedOut) return;
    const timer = setTimeout(() => {
      window.ipcAPI.ilustracoes.syncToPanel({
        figurasNoEditor: extrairFigurasDoEditor(),
        syncEnabled,
        figuraAtivaId,
        tema: document.body.classList.contains('dark') ? 'dark' : 'light',
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [panelPoppedOut, extrairFigurasDoEditor, syncEnabled, figuraAtivaId]);

  useEffect(() => {
    if (!panelPoppedOut) return;
    return window.ipcAPI.ilustracoes.onPanelAction((action: string, ...args: any[]) => {
      const cbs = panelCallbacksRef.current;
      switch (action) {
        case 'insertImage': cbs.onInsertImage(args[0], args[1], args[2]); break;
        case 'deleteImage': cbs.onDeleteImage(args[0]); break;
        case 'updateLegenda': cbs.onUpdateLegenda(args[0], args[1]); break;
        case 'reorder': cbs.onReorder(args[0]); break;
        case 'refreshHtml': cbs.onRefreshHtml(); break;
        case 'insertAll': cbs.onInsertAll(args[0]); break;
        case 'syncToggle': cbs.onSyncToggle(args[0]); break;
        case 'scrollToFigure': cbs.onScrollToFigure(args[0]); break;
        case 'replaceImage': cbs.onReplaceImage(args[0], args[1]); break;
        case 'ready': cbs.syncCurrentState(); break;
        case 'popIn':
          setPanelPoppedOut(false);
          setIlustracoesPanelOpen(true);
          setPanelCollapsed(false);
          toast.info('Painel de ilustrações retornou ao editor');
          break;
      }
    });
  }, [panelPoppedOut]);

  useEffect(() => {
    if (!panelPoppedOut) return;
    return window.ipcAPI.ilustracoes.onPanelClosed(() => {
      setPanelPoppedOut(false);
      toast.info('Painel de ilustrações fechado');
    });
  }, [panelPoppedOut]);

  const handlePopOut = () => {
    setIlustracoesPanelOpen(false);
    setPanelPoppedOut(true);
    window.ipcAPI.ilustracoes.openPanel();

    panelCallbacksRef.current.syncCurrentState();
    setTimeout(() => panelCallbacksRef.current.syncCurrentState(), 300);
    setTimeout(() => panelCallbacksRef.current.syncCurrentState(), 700);

    toast.info('Painel de ilustrações movido para janela separada');
  };

  const handleToggleIlustracoes = () => {
    if (panelPoppedOut) {
      window.ipcAPI.ilustracoes.closePanel();
      setPanelPoppedOut(false);
      setIlustracoesPanelOpen(true);
      setPanelCollapsed(false);
    } else {
      const next = !iluminacoesPanelOpen;
      setIlustracoesPanelOpen(next);
      if (next) setPanelCollapsed(false);
    }
  };

  const handlePreview = async () => {
    if (!editando) return;
    try {
      setCarregandoPreview(true);
      setError(null);

      let secoesAtuais: SecaoEditor[];
      if (editorMode === 'single') {
        const editor = (window as any).tinymce?.get('laudo-single-editor');
        const latestHtml = editor ? editor.getContent() : singleEditorHtml;
        setSingleEditorHtml(latestHtml);
        secoesAtuais = parseSingleHtmlToSecoes(latestHtml, secoes);
      } else {
        secoesAtuais = [];
        for (let idx = 0; idx < secoes.length; idx++) {
          const editor = (window as any).tinymce?.get(`secao-${idx}`);
          const conteudo = editor ? editor.getContent() : secoes[idx].conteudo;
          if (editor) atualizarConteudoSecao(idx, conteudo);
          secoesAtuais.push({ ...secoes[idx], conteudo });
        }
      }
      
      // 1. Buscar dados da REP para placeholders
      const rRep = await window.ipcAPI.rep.findById(editando.rep_id);
      if (!rRep.success || !rRep.data) {
        setError('Erro ao carregar dados da REP para o preview');
        return;
      }

      // 1a. Buscar dados de relacionamento para placeholders como solicitante_nome, tipo_exame_nome
      const repData = rRep.data;
      let solicitanteNome = '';
      let tipoExameNome = '';
      let tipoExameCodigo = '';

      if (repData.solicitante_id) {
        try {
          const rSol = await window.ipcAPI.solicitante.findById(repData.solicitante_id);
          if (rSol.success && rSol.data) {
            solicitanteNome = rSol.data.nome || '';
          }
        } catch { /* silencioso: placeholder fica vazio */ }
      }

      if (repData.tipo_exame_id) {
        try {
          const rTipo = await window.ipcAPI.tipoExame.findById(repData.tipo_exame_id);
          if (rTipo.success && rTipo.data) {
            tipoExameNome = rTipo.data.nome || '';
            tipoExameCodigo = rTipo.data.codigo || '';
          }
        } catch { /* silencioso: placeholder fica vazio */ }
      }

      // 2. Buscar cabeçalho das configurações
      const { headerTemplate, cabecalhoPrimeiraPagina } = await buildPdfHeaderConfig({
        numeroRepFallback: repData.numero || '',
      });

      // 3. Montar HTML completo
      const secoesHtml = secoesAtuais
        .map((s, i) => {
          const tituloRaw = (s.titulo || '').trim();
          const titulo = /^(?:se[cç]ão\b|\d+[\s\.\-\:]|[a-zA-Z][\.\-\:]\s|[IVXLCDM]+[\.\-\:]\s)/i.test(tituloRaw)
            ? tituloRaw
            : `${i + 1}. ${tituloRaw}`;
          return `<h2>${titulo}</h2>${s.conteudo}`;
        })
        .join('\n');

      let fullHtml = cabecalhoPrimeiraPagina
        ? `<div class="cabecalho" style="padding-bottom:16px;margin-bottom:32px;">${cabecalhoPrimeiraPagina}</div>`
        : '';
      fullHtml += secoesHtml;

      fullHtml = reindexarFiguras(fullHtml);

      // 4. Aplicar placeholders (incluindo relacionamentos)
      const htmlProcessado = aplicarPlaceholders(fullHtml, repData, {
        solicitanteNome,
        tipoExameNome,
        tipoExameCodigo,
      });

      // 5. Gerar PDF via IPC (usando o mesmo handler do template)
      const result = await window.ipcAPI.template.previewPDF(htmlProcessado, await getMargens(), headerTemplate || undefined);
      if (result.success && result.data) {
        const byteChars = atob(result.data);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNums[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(url);
        setPreviewOpen(true);
      } else {
        setError(result.error || 'Erro ao gerar PDF do laudo');
      }
    } catch (e: any) {
      setError('Erro ao gerar preview: ' + e.message);
    } finally {
      setCarregandoPreview(false);
    }
  };

  const handleEditar = async (laudo: LaudoItem) => {
    if (laudo.tipo_criacao === 'wizard') {
      navigate(`/laudos/${laudo.id}/wizard`);
      return;
    }
    const parsedSecoes = parseConteudoEmSecoes(converterPlaceholdersTextuais(laudo.conteudo || '', placeholderChaves));
    setEditando(laudo);
    setSecoes(parsedSecoes);
    setSingleEditorHtml(buildSingleHtmlFromSecoes(parsedSecoes));
    setEditorMode('single');
    setSecoesColapsadas({});
    setError(null);
    setSuccess(null);

    const codigo = laudo.tipo_exame_codigo;
    if (codigo) {
      setCategoriaExameId(`cat-exam-${codigo}`);
      setExameMenuStructure(EXAM_MENU_REGISTRY[codigo]);
      try {
        const rRep = await window.ipcAPI.rep.findById(laudo.rep_id);
        if (rRep.success && rRep.data && rRep.data.campos_especificos) {
          const parsed = JSON.parse(rRep.data.campos_especificos);
          setExameCamposEspecificos(parsed.b602 || parsed);
        } else {
          setExameCamposEspecificos(undefined);
        }
      } catch {
        setExameCamposEspecificos(undefined);
      }
    } else {
      setCategoriaExameId('');
      setExameMenuStructure(undefined);
      setExameCamposEspecificos(undefined);
    }
  };

  const handleVoltar = () => {
    if (panelPoppedOut) {
      window.ipcAPI.ilustracoes.closePanel();
    }
    setEditando(null);
    setSecoes([]);
    setSingleEditorHtml('');
    setEditorMode('single');
    setSecoesColapsadas({});
    setError(null);
    setSuccess(null);
    setExameMenuStructure(undefined);
    setExameCamposEspecificos(undefined);
    setCategoriaExameId('');
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl('');
    }
  };

  const handleSalvar = async () => {
    if (!editando) return;
    try {
      setSalvando(true);
      setError(null);
      setSuccess(null);

      let secoesAtuais: SecaoEditor[];
      if (editorMode === 'single') {
        const editor = (window as any).tinymce?.get('laudo-single-editor');
        const latestHtml = editor ? editor.getContent() : singleEditorHtml;
        setSingleEditorHtml(latestHtml);
        secoesAtuais = parseSingleHtmlToSecoes(latestHtml, secoes);
        setSecoes(secoesAtuais);
      } else {
        secoesAtuais = [];
        for (let idx = 0; idx < secoes.length; idx++) {
          const editor = (window as any).tinymce?.get(`secao-${idx}`);
          const conteudo = editor ? editor.getContent() : secoes[idx].conteudo;
          if (editor) atualizarConteudoSecao(idx, conteudo);
          secoesAtuais.push({ ...secoes[idx], conteudo });
        }
      }

      // 1. Reindexar figuras fisicamente para garantir ordem definitiva
      const conteudoOriginal = reconstruirConteudo(secoesAtuais);
      const htmlReindexado = reindexarFiguras(conteudoOriginal);

      // 2. Remover formatação de placeholders e salvar
      const conteudoFinal = removerFormatacaoPlaceholders(htmlReindexado);

      const r = await window.ipcAPI.laudo.updateConteudo(editando.id, conteudoFinal);
      if (r.success) {

        setSuccess('Laudo salvo com sucesso!');
        setEditando(prev => prev ? { ...prev, conteudo: conteudoFinal } : null);
        setLaudos(prev =>
          prev.map(l => (l.id === editando.id ? { ...l, conteudo: conteudoFinal } : l))
        );

        // Atualizar visualização atual
        if (editorMode === 'single') {
          setSingleEditorHtml(conteudoFinal);
          const editor = (window as any).tinymce?.get('laudo-single-editor');
          if (editor) {
            editor.setContent(conteudoFinal);
          }
        } else {
          const novasSecoes = parseConteudoEmSecoes(conteudoFinal);
          setSecoes(novasSecoes);
          novasSecoes.forEach((sec, idx) => {
            const editor = (window as any).tinymce?.get(`secao-${idx}`);
            if (editor) {
              editor.setContent(sec.conteudo);
            }
          });
        }

        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(r.error || 'Erro ao salvar laudo');
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar laudo');
    } finally {
      setSalvando(false);
    }
  };

  const handleOpenSheet = (idx: number, titulo: string) => {
    setIaSheetSecaoIdx(idx);
    setIaSheetSecaoTitulo(titulo);
    setIaSheetOpen(true);
    setIaError(null);
  };

  /**
   * Resolve os valores reais dos placeholders num bloco HTML antes de enviar à IA.
   * Usa os dados da REP vinculada ao laudo em edição.
   */
  const resolverPlaceholdersNoHtml = async (html: string): Promise<string> => {
    if (!editando) return html;
    try {
      const rRep = await window.ipcAPI.rep.findById(editando.rep_id);
      if (!rRep.success || !rRep.data) return html;
      const repData = rRep.data;

      let solicitanteNome = '';
      let tipoExameNome = '';
      let tipoExameCodigo = '';

      if (repData.solicitante_id) {
        try {
          const rSol = await window.ipcAPI.solicitante.findById(repData.solicitante_id);
          if (rSol.success && rSol.data) solicitanteNome = rSol.data.nome || '';
        } catch {}
      }
      if (repData.tipo_exame_id) {
        try {
          const rTipo = await window.ipcAPI.tipoExame.findById(repData.tipo_exame_id);
          if (rTipo.success && rTipo.data) {
            tipoExameNome = rTipo.data.nome || '';
            tipoExameCodigo = rTipo.data.codigo || '';
          }
        } catch {}
      }

      // Substituir os {{placeholders}} pelos valores reais
      let resolved = aplicarPlaceholders(html, repData, { solicitanteNome, tipoExameNome, tipoExameCodigo });

      // Substituir quaisquer placeholders customizados (valor padrão do banco)
      for (const p of placeholders) {
        if (p.valor) {
          resolved = resolved.split(`{{${p.chave}}}`).join(p.valor);
        }
      }

      return resolved;
    } catch {
      return html; // fallback: envia o original
    }
  };

  const handleRevisarOrtografia = async (html: string, idx: number) => {
    try {
      setIaSheetMode('ortografia');
      setIaLoading(true);
      setIaError(null);
      // Abre o sheet para o usuário ver a sugestão
      handleOpenSheet(idx, secoes[idx]?.titulo || '');
      const htmlResolvido = await resolverPlaceholdersNoHtml(html);
      const r = await window.ipcAPI.ia.revisarOrtografia(htmlResolvido);
      if (r.success && r.data) {
        const chatKey = idx === -1 ? SINGLE_CHAT_KEY : `secao-${idx}`;
        const resposta: ChatMessage = {
          role: 'assistant',
          content: String(r.data),
          timestamp: Date.now(),
        };
        setChatMessages(prev => ({
          ...prev,
          [chatKey]: [...(prev[chatKey] || []), resposta],
        }));
      } else {
        setIaError(r.error || 'Erro ao revisar ortografia');
      }
    } catch (e: any) {
      setIaError(e.message || 'Erro ao revisar ortografia');
    } finally {
      setIaLoading(false);
    }
  };

  const handleAdequarEscrita = async (html: string, idx: number) => {
    try {
      setIaSheetMode('adequar');
      setIaLoading(true);
      setIaError(null);
      const htmlResolvido = await resolverPlaceholdersNoHtml(html);
      const r = await window.ipcAPI.ia.adequarEscrita(htmlResolvido);
      if (r.success && r.data) {
        const chatKey = idx === -1 ? SINGLE_CHAT_KEY : `secao-${idx}`;
        const resposta: ChatMessage = {
          role: 'assistant',
          content: String(r.data),
          timestamp: Date.now(),
        };
        setChatMessages(prev => ({
          ...prev,
          [chatKey]: [...(prev[chatKey] || []), resposta],
        }));
      } else {
        setIaError(r.error || 'Erro ao adequar escrita');
      }
    } catch (e: any) {
      setIaError(e.message || 'Erro ao adequar escrita');
    } finally {
      setIaLoading(false);
    }
  };

  const handleDescreverImagem = async (imagens: Array<{ src: string; alt?: string }>, idx: number) => {
    try {
      setIaSheetMode('imagem');
      setIaLoading(true);
      setIaError(null);
      const r = await window.ipcAPI.ia.descreverImagem(imagens);
      if (r.success && r.data) {
        const chatKey = idx === -1 ? SINGLE_CHAT_KEY : `secao-${idx}`;
        const resposta: ChatMessage = {
          role: 'assistant',
          content: String(r.data),
          timestamp: Date.now(),
        };
        setChatMessages(prev => ({
          ...prev,
          [chatKey]: [...(prev[chatKey] || []), resposta],
        }));
      } else {
        setIaError(r.error || 'Erro ao descrever imagem');
      }
    } catch (e: any) {
      setIaError(e.message || 'Erro ao descrever imagem');
    } finally {
      setIaLoading(false);
    }
  };

  const handlePerguntar = async (pergunta: string, html: string, idx: number, _titulo: string) => {
    try {
      setIaSheetMode('perguntar');
      setIaLoading(true);
      setIaError(null);

      const userMsg: ChatMessage = {
        role: 'user',
        content: pergunta,
        timestamp: Date.now(),
      };

      const chatKey = idx === -1 ? SINGLE_CHAT_KEY : `secao-${idx}`;
      setChatMessages(prev => ({
        ...prev,
        [chatKey]: [...(prev[chatKey] || []), userMsg],
      }));

      const r = await window.ipcAPI.ia.perguntar(pergunta, html);
      if (r.success && r.data) {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: String(r.data),
          timestamp: Date.now(),
        };
        setChatMessages(prev => ({
          ...prev,
          [chatKey]: [...(prev[chatKey] || []), assistantMsg],
        }));
      } else {
        setIaError(r.error || 'Erro ao processar pergunta');
      }
    } catch (e: any) {
      setIaError(e.message || 'Erro ao processar pergunta');
    } finally {
      setIaLoading(false);
    }
  };

  const handleApplyResponse = (texto: string) => {
    if (iaSheetSecaoIdx !== null) {
      if (iaSheetSecaoIdx === -1) {
        const editor = (window as any).tinymce?.get('laudo-single-editor');
        if (!editor) return;
        if (iaSheetMode === 'imagem' || iaSheetMode === 'perguntar') {
          const descHtml = texto
            .split('\n')
            .map((line) => (line.trim() ? `<p>${line}</p>` : ''))
            .join('');
          editor.insertContent(descHtml);
        } else {
          editor.setContent(texto);
        }
        setSingleEditorHtml(editor.getContent());
        setIaSheetOpen(false);
        return;
      }

      const editorId = `secao-${iaSheetSecaoIdx}`;
      const win = window as any;

      if (iaSheetMode === 'imagem' || iaSheetMode === 'perguntar') {
        // Converter quebras de linha em parágrafos de HTML
        const descHtml = texto
          .split('\n')
          .map((line) => (line.trim() ? `<p>${line}</p>` : ''))
          .join('');

        const editor = win.tinymce?.get(editorId);
        if (editor) {
          // Insere na posição atual do cursor no editor correspondente
          editor.insertContent(descHtml);
        } else {
          // Fallback caso o editor não seja encontrado: anexa ao final
          const atual = secoes[iaSheetSecaoIdx]?.conteudo || '';
          const divisor = atual.trim() ? '<p>&nbsp;</p>' : '';
          atualizarConteudoSecao(iaSheetSecaoIdx, atual + divisor + descHtml);
        }
      } else {
        const editor = win.tinymce?.get(editorId);
        if (editor) {
          editor.setContent(texto);
        }
        atualizarConteudoSecao(iaSheetSecaoIdx, texto);
      }
      setIaSheetOpen(false);
    }
  };

  const handleSendChatMessage = (message: string) => {
    if (iaSheetSecaoIdx !== null) {
      if (iaSheetSecaoIdx === -1) {
        handlePerguntar(message, singleEditorHtml, -1, 'Editor único');
        return;
      }
      const html = secoes[iaSheetSecaoIdx]?.conteudo || '';
      const titulo = secoes[iaSheetSecaoIdx]?.titulo || '';
      handlePerguntar(message, html, iaSheetSecaoIdx, titulo);
    }
  };

  function getCurrentUserId(): string {
    try {
      const raw = sessionStorage.getItem('lawdo_auth_user');
      return raw ? JSON.parse(raw)?.id ?? '' : '';
    } catch { return ''; }
  }

  const precisaSenhaParaExcluir = (status: string) =>
    status === 'Concluído' || status === 'Entregue';

  const handleAbrirExclusao = (laudo: LaudoItem) => {
    setLaudoParaExcluir(laudo);
    setSenhaExclusao('');
    setSenhaExclusaoErro('');
    setVerificandoSenhaExclusao(false);
    setPassoExclusao(precisaSenhaParaExcluir(laudo.status) ? 'senha' : 'confirmar');
    setDeleteDialogOpen(true);
  };

  const handleConfirmarExclusao = async () => {
    if (!senhaExclusao) {
      setSenhaExclusaoErro('Digite sua senha para continuar.');
      return;
    }
    setVerificandoSenhaExclusao(true);
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        setSenhaExclusaoErro('Sessão não encontrada. Faça login novamente.');
        return;
      }
      const r = await window.ipcAPI.verifyPassword(userId, senhaExclusao);
      if (r.valid) {
        setSenhaExclusaoErro('');
        await handleExcluir();
      } else {
        setSenhaExclusaoErro(r.error || 'Senha incorreta.');
      }
    } catch {
      setSenhaExclusaoErro('Erro ao verificar senha.');
    } finally {
      setVerificandoSenhaExclusao(false);
    }
  };

  const handleExcluir = async () => {
    if (!laudoParaExcluir) return;
    try {
      setError(null);
      const userId = precisaSenhaParaExcluir(laudoParaExcluir.status) ? getCurrentUserId() : undefined;
      const r = await window.ipcAPI.laudo.delete(laudoParaExcluir.id, userId);
      if (r.success) {
        setSuccess(r.message || 'Laudo excluído com sucesso!');
        setDeleteDialogOpen(false);
        setLaudoParaExcluir(null);
        setSenhaExclusao('');
        carregarLaudos();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(r.error || 'Erro ao excluir laudo');
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao excluir laudo');
    }
  };

  const handleUpdateStatus = async (laudo: LaudoItem, novoStatus: string) => {
    try {
      setError(null);
      const r = await window.ipcAPI.laudo.updateStatus(laudo.id, novoStatus);
      if (r.success) {
        carregarLaudos();
      } else {
        setError(r.error || 'Erro ao atualizar status');
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao atualizar status');
    }
  };

  const botoesAcaoStatus = useMemo(() => [
    { label: 'Entregar',  value: 'Entregue',     icon: Send,        enabled: (s: string) => s === 'Concluído',      disabledHint: 'Disponível apenas para laudos Concluídos' },
    { label: 'Concluir',  value: 'Concluído',    icon: CheckCircle, enabled: (s: string) => s === 'Em andamento',   disabledHint: 'Disponível apenas para laudos Em andamento' },
    { label: 'Preencher', value: 'Em andamento', icon: null, enabled: () => true },
  ], []);

  const laudoColumns = useMemo<ColumnDef<LaudoItem>[]>(() => [
    {
      accessorKey: 'data_requisicao',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Data de recebimento" />
      ),
      cell: ({ row }) => formatarData(row.getValue('data_requisicao')),
    },
    {
      accessorKey: 'rep_numero',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nº REP" />
      ),
      cell: ({ row }) => <span className="font-medium">{row.getValue('rep_numero')}</span>,
    },
    {
      accessorKey: 'tipo_solicitacao',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tipo de Solicitação" />
      ),
      cell: ({ row }) => row.getValue('tipo_solicitacao') || '-',
    },
    {
      accessorKey: 'numero_documento',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nº da Solicitação" />
      ),
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate block">{row.getValue('numero_documento') || '-'}</span>
      ),
    },
    {
      accessorKey: 'template_nome',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Template" />
      ),
      cell: ({ row }) => row.getValue('template_nome') || 'Não definido',
    },
    {
      accessorKey: 'tipo_exame_nome',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tipo de Exame" />
      ),
      cell: ({ row }) => row.getValue('tipo_exame_nome') || '-',
    },
    {
      accessorKey: 'nome_envolvido',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Envolvido" />
      ),
      cell: ({ row }) => (
        <span className="max-w-[150px] truncate block">{row.getValue('nome_envolvido') || '-'}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const statusStyles: Record<string, string> = {
          'Em andamento': 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700',
          'Concluído': 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700',
          'Entregue': 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700',
        };
        return <Badge className={statusStyles[status] || ''}>{status}</Badge>;
      },
    },
    {
      accessorKey: 'data_inicio',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Início" />
      ),
      cell: ({ row }) => formatarData(row.getValue('data_inicio')),
    },
    {
      id: 'actions',
      enableHiding: false,
      header: () => <span className="sr-only">Ações</span>,
      cell: ({ row }) => {
        const laudo = row.original;
        const isReadonly = laudo.status === 'Concluído' || laudo.status === 'Entregue';
        return (
          <div className="flex justify-end gap-1">
            {/* Preencher via Wizard — disponível para qualquer laudo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm"
                  onClick={() => navigate(`/laudos/${laudo.id}/wizard`)}
                >
                  <Wand2 size={14} className="text-violet-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Preencher via Wizard</TooltipContent>
            </Tooltip>

            {botoesAcaoStatus.map(op => {
              const isPreencher = op.value === 'Em andamento';
              const habilitado = isPreencher || op.enabled(laudo.status);

              let icon;
              let tooltip;
              let onClick;
              if (isPreencher) {
                icon = isReadonly ? <RotateCcw size={14} /> : <Edit size={14} />;
                tooltip = isReadonly
                  ? 'Reabrir para edição — status voltará para Em andamento'
                  : 'Abrir editor';
                onClick = async () => {
                  if (isReadonly) await handleUpdateStatus(laudo, 'Em andamento');
                  handleEditar(laudo);
                };
              } else {
                const IconComponent = op.icon!;
                icon = <IconComponent size={14} />;
                tooltip = habilitado ? op.label : op.disabledHint;
                onClick = () => handleUpdateStatus(laudo, op.value!);
              }

              return (
                <Tooltip key={op.label}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!habilitado}
                      onClick={onClick}
                      className={!habilitado ? 'opacity-30' : ''}
                    >
                      {icon}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{tooltip}</TooltipContent>
                </Tooltip>
              );
            })}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setTimelineLaudo(laudo); setTimelineOpen(true); }}
                >
                  <Clock size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Histórico</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAbrirExclusao(laudo)}
              aria-label={`Excluir laudo da REP ${laudo.rep_numero}`}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        );
      },
    },
  ], [handleEditar, handleUpdateStatus, botoesAcaoStatus]);

  // Modo editor com múltiplas seções
  if (editando) {
    return (
      <TooltipProvider>
        <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Editor de Laudo</h1>
            <p className="text-muted-foreground mt-1">
              REP: {editando.rep_numero}
              {editando.tipo_exame_nome && ` — ${editando.tipo_exame_nome}`}
              {editando.nome_envolvido && ` — ${editando.nome_envolvido}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <Button
                    variant="outline"
                    onClick={handleToggleIlustracoes}
                    className={`flex items-center gap-2 rounded-r-none border-r-0 ${iluminacoesPanelOpen || panelPoppedOut ? (panelPoppedOut ? 'bg-primary/20 border-primary/40' : 'bg-muted') : ''}`}
                  >
                    <ImageIcon size={16} /> Ilustrações
                    {panelPoppedOut && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className={`rounded-l-none h-9 w-7 ${iluminacoesPanelOpen || panelPoppedOut ? (panelPoppedOut ? 'bg-primary/20 border-primary/40' : 'bg-muted') : ''}`}
                      >
                        <ChevronDown size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={handlePopOut} disabled={panelPoppedOut}>
                        <ExternalLink size={14} className="mr-2" />
                        Abrir em janela separada
                      </DropdownMenuItem>
                      {panelPoppedOut && (
                        <DropdownMenuItem onClick={handleToggleIlustracoes}>
                          <ImageIcon size={14} className="mr-2" />
                          Retornar ao editor
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {panelPoppedOut ? 'Painel em janela separada (clique para retornar)' : 'Abrir painel de ilustrações'}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => panelCallbacksRef.current.onRefreshHtml()}
                  className="h-9 w-9"
                >
                  <RefreshCw size={15} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Atualizar figuras (numeração e legendas)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={handleVoltar} className="flex items-center gap-2">
                  <ArrowLeft size={16} /> Voltar
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Voltar para a lista de laudos</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" onClick={handlePreview} disabled={carregandoPreview || salvando} className="flex items-center gap-2">
                  <Eye size={16} /> {carregandoPreview ? 'Gerando PDF...' : 'Visualizar'}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Pré-visualizar o laudo em PDF</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleSalvar} disabled={salvando || carregandoPreview} className="flex items-center gap-2">
                  <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar'}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Salvar o conteúdo do laudo</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {success && <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900/50"><AlertDescription className="text-green-800 dark:text-green-400">{success}</AlertDescription></Alert>}

        <Card className="flex-1 overflow-hidden flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <div>
                <CardTitle className="text-lg">Template: {editando.template_nome || 'Não definido'}</CardTitle>
                <CardDescription>
                  Status: {editando.status} &middot; Iniciado em {formatarData(editando.data_inicio)}
                  {editando.data_conclusao ? ` &middot; Concluído em ${formatarData(editando.data_conclusao)}` : ''}
                </CardDescription>
              </div>
              <Badge className={
                editando.status === 'Concluído' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700' :
                editando.status === 'Entregue' ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700' :
                'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700'
              }>{editando.status}</Badge>
            </div>
            <div className="flex items-center justify-end">
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
                      <List size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Editor único com laudo inteiro</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleEditorTheme}
                      className="h-8 px-2.5"
                    >
                      <ThemeIcon size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Tema do editor: {themeLabel} {editorTheme === 'auto' ? '(segue o tema do sistema)' : ''}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0 px-6 pb-6">
            <div className="flex h-full gap-0">
              <div className="flex-1 overflow-y-auto pr-2">
                {editorMode === 'single' ? (
                  <div className="space-y-3 pb-4">
                <div className="space-y-2 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Bot size={14} className="text-primary" />
                      <span className="text-xs font-medium text-muted-foreground">IA:</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 disabled:opacity-45 disabled:cursor-not-allowed"
                      disabled={iaLoading}
                      onClick={async () => {
                        if (!singleEditorHtml.trim()) {
                          setIaError('Editor vazio');
                          return;
                        }
                        setIaSheetSecaoIdx(-1);
                        setIaSheetSecaoTitulo('Editor único');
                        setIaSheetOpen(true);
                        await handleRevisarOrtografia(singleEditorHtml, -1);
                      }}
                    >
                      <SpellCheck size={12} /> Ortografia
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 disabled:opacity-45 disabled:cursor-not-allowed"
                      disabled={iaLoading}
                      onClick={async () => {
                        if (!singleEditorHtml.trim()) {
                          setIaError('Editor vazio');
                          return;
                        }
                        setIaSheetSecaoIdx(-1);
                        setIaSheetSecaoTitulo('Editor único');
                        setIaSheetOpen(true);
                        await handleAdequarEscrita(singleEditorHtml, -1);
                      }}
                    >
                      <PenLine size={12} /> Adequar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 disabled:opacity-45 disabled:cursor-not-allowed"
                      disabled={iaLoading || !singleTemImagens}
                      onClick={async () => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(singleEditorHtml, 'text/html');
                        const imagens = Array.from(doc.querySelectorAll('img'))
                          .filter(img => img.src.startsWith('data:') || img.src.startsWith('http'))
                          .map((img) => ({ src: img.src, alt: img.alt }));
                        if (imagens.length === 0) {
                          setIaError('Nenhuma imagem encontrada no editor.');
                          return;
                        }
                        setIaSheetSecaoIdx(-1);
                        setIaSheetSecaoTitulo('Editor único');
                        setIaSheetOpen(true);
                        await handleDescreverImagem(imagens, -1);
                      }}
                    >
                      <ImageIcon size={12} /> Imagem
                    </Button>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Input
                        value={singlePergunta}
                        onChange={(e) => setSinglePergunta(e.target.value)}
                        placeholder="Pergunte à IA..."
                        className="h-7 text-xs w-[200px]"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 disabled:opacity-45 disabled:cursor-not-allowed"
                        disabled={iaLoading || !singlePergunta.trim()}
                        onClick={async () => {
                          if (!singlePergunta.trim()) {
                            setIaError('Digite uma pergunta para a IA.');
                            return;
                          }
                          setIaSheetSecaoIdx(-1);
                          setIaSheetSecaoTitulo('Editor único');
                          setIaSheetOpen(true);
                          await handlePerguntar(singlePergunta, singleEditorHtml, -1, 'Editor único');
                          setSinglePergunta('');
                        }}
                      >
                        <Send size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
                    <PlaceholderContextMenu editorId="laudo-single-editor" categorias={categorias} placeholders={placeholders} onInsertPlaceholder={inserirPlaceholder} exameMenuStructure={exameMenuStructure} exameCamposEspecificos={exameCamposEspecificos} categoriaExameId={categoriaExameId}>
                      <TinyMceEditor
                        editorId="laudo-single-editor"
                        initialValue={singleEditorHtml}
                        onChange={setSingleEditorHtml}
                        height={560}
                        placeholder="Edite o laudo completo..."
                        laudoId={editando.id}
                        theme={editorTheme}
                        placeholderChaves={placeholderChaves}
                      />
                    </PlaceholderContextMenu>
                  </div>
                ) : (
                  <div className="space-y-6 pb-4">
                    {secoes.map((secao, idx) => {
                      const isIlustracoes = secao.titulo.trim().toUpperCase() === 'ILUSTRAÇÕES';
                      return (
                      <Collapsible
                        key={isIlustracoes ? `ilus-${ilustracoesKey}` : idx}
                        open={!secoesColapsadas[idx]}
                        onOpenChange={(open) => setSecoesColapsadas(prev => ({ ...prev, [idx]: !open }))}
                        className="border rounded-lg bg-card shadow-sm"
                      >
                        <div className="flex items-center justify-between p-4 cursor-default">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center gap-3 flex-1 cursor-pointer">
                              <div className="p-2 rounded-full bg-primary/10 text-primary">
                                <Edit size={18} />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold">{secao.titulo}</h3>
                                <p className="text-sm text-muted-foreground">Clique para expandir/recolher</p>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                        </div>
                        <CollapsibleContent className="p-4 border-t" forceMount>
                          <AISectionToolbar
                            editorId={`secao-${idx}`}
                            secaoIndex={idx}
                            secaoTitulo={secao.titulo}
                            htmlContent={secao.conteudo}
                            onRevisarOrtografia={handleRevisarOrtografia}
                            onAdequarEscrita={handleAdequarEscrita}
                            onDescreverImagem={handleDescreverImagem}
                            onPerguntar={handlePerguntar}
                            onOpenSheet={handleOpenSheet}
                          />
                          <PlaceholderContextMenu editorId={`secao-${idx}`} categorias={categorias} placeholders={placeholders} onInsertPlaceholder={inserirPlaceholder} exameMenuStructure={exameMenuStructure} exameCamposEspecificos={exameCamposEspecificos} categoriaExameId={categoriaExameId}>
                            <div className={isIlustracoes ? 'relative' : ''}>
                              <TinyMceEditor
                                editorId={`secao-${idx}`}
                                initialValue={secao.conteudo}
                                onChange={(txt) => atualizarConteudoSecao(idx, txt)}
                                height={400}
                                laudoId={editando.id}
                                theme={editorTheme}
                                placeholderChaves={placeholderChaves}
                                onEditorInit={isIlustracoes ? handleIlustracoesEditorInit : undefined}
                              />

                              {isIlustracoes && ilustracoesRemounting && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 rounded">
                                  <div className="flex flex-col items-center gap-3">
                                    <LucideIcons.Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="text-sm text-muted-foreground">Carregando editor...</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </PlaceholderContextMenu>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                    })}
                  </div>
                )}
              </div>

              {iluminacoesPanelOpen && (
                <>
                  <button
                    onClick={togglePanel}
                    aria-expanded={!panelCollapsed}
                    className="w-7 border-y border-l rounded-l-md bg-background hover:bg-accent flex-shrink-0 flex items-center justify-center transition-colors group"
                    title={panelCollapsed ? 'Expandir painel' : 'Recolher painel'}
                  >
                    <ChevronRight
                      size={15}
                      className={cn(
                        "transition-transform duration-300 ease-in-out text-muted-foreground group-hover:text-foreground",
                        !panelCollapsed && "rotate-180"
                      )}
                    />
                  </button>

                  <div
                    className={cn(
                      "border-l overflow-hidden bg-background transition-all duration-300 ease-in-out",
                      panelCollapsed
                        ? "w-0 border-l-0"
                        : "w-[380px] 2xl:w-[420px] max-w-[85vw]"
                    )}
                  >
                    <div className={cn("w-[380px] 2xl:w-[420px] max-w-[85vw] h-full overflow-y-auto", panelCollapsed && "invisible")}>
                      <IlustracoesPanel
                        laudoId={editando.id}
                        onInsertImage={panelCallbacksRef.current.onInsertImage}
                        onDeleteImage={panelCallbacksRef.current.onDeleteImage}
                        onRefreshHtml={panelCallbacksRef.current.onRefreshHtml}
                        onInsertAll={panelCallbacksRef.current.onInsertAll}
                        figurasNoEditor={extrairFigurasDoEditor()}
                        onUpdateLegendaInEditor={panelCallbacksRef.current.onUpdateLegenda}
                        onReorder={panelCallbacksRef.current.onReorder}
                        syncEnabled={syncEnabled}
                        figuraAtivaId={figuraAtivaId}
                        onSyncToggle={panelCallbacksRef.current.onSyncToggle}
                        onScrollToFigure={panelCallbacksRef.current.onScrollToFigure}
                        onPopOut={handlePopOut}
                        onReplaceImage={panelCallbacksRef.current.onReplaceImage}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Modal de Visualização (Preview PDF) */}
        <Dialog open={previewOpen} onOpenChange={(open) => {
          if (!open && previewBlobUrl) {
            URL.revokeObjectURL(previewBlobUrl);
            setPreviewBlobUrl('');
          }
          setPreviewOpen(open);
        }}>
          <DialogContent className="max-w-[90vw] w-[1000px] h-[95vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-4 border-b">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Pré-visualização do Laudo (PDF)
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 bg-slate-100 dark:bg-slate-800">
              {carregandoPreview ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Gerando PDF...
                </div>
              ) : (
                <iframe
                  src={previewBlobUrl}
                  className="w-full h-full border-0"
                  title="Preview PDF"
                />
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-background">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Sheet de Chat com IA */}
        <AISheet
          open={iaSheetOpen}
          onOpenChange={setIaSheetOpen}
          secaoTitulo={iaSheetSecaoTitulo}
          editorId={iaSheetSecaoIdx === -1 ? 'laudo-single-editor' : (iaSheetSecaoIdx !== null ? `secao-${iaSheetSecaoIdx}` : '')}
          messages={
            iaSheetSecaoIdx === -1
              ? (chatMessages[SINGLE_CHAT_KEY] || [])
              : (iaSheetSecaoIdx !== null ? chatMessages[`secao-${iaSheetSecaoIdx}`] || [] : [])
          }
          onSendMessage={handleSendChatMessage}
          onApplyResponse={handleApplyResponse}
          loading={iaLoading}
          error={iaError}
        />
      </div>
      </TooltipProvider>
    );
  }

  // Modo lista
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Laudos</h1>
          <p className="text-muted-foreground mt-1">Escreva e edite os laudos periciais usando os templates cadastrados</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Laudos em Andamento</CardTitle>
          <CardDescription>{laudos.length} laudo(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
          {success && <Alert className="mb-4 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900/50"><AlertDescription className="text-green-800 dark:text-green-400">{success}</AlertDescription></Alert>}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <DataTable
              columns={laudoColumns}
              data={laudos}
              enableRowPinning
              hideSearch
              defaultSorting={[{ id: "data_requisicao", desc: true }]}
              initialColumnVisibility={{
                template_nome: false,
                tipo_exame_nome: false,
                nome_envolvido: false,
                data_inicio: false,
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação para exclusão de laudo */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!open) { setSenhaExclusao(''); setSenhaExclusaoErro(''); }
        setDeleteDialogOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Excluir Laudo
            </DialogTitle>
          </DialogHeader>

          {passoExclusao === 'senha' ? (
            <>
              <div className="space-y-3">
                <Alert variant="destructive">
                  <AlertDescription>
                    <strong>ATENÇÃO:</strong> Este laudo está <strong>{laudoParaExcluir?.status}</strong>. A exclusão é irreversível, a REP
                    voltará para <strong>Pendente</strong> e esta ação requer autenticação.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    Digite sua senha para confirmar a exclusão
                  </div>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={senhaExclusao}
                    onChange={e => { setSenhaExclusao(e.target.value); setSenhaExclusaoErro(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleConfirmarExclusao(); }}
                    disabled={verificandoSenhaExclusao}
                    autoFocus
                  />
                  {senhaExclusaoErro && (
                    <p className="text-sm text-destructive">{senhaExclusaoErro}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={verificandoSenhaExclusao}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmarExclusao}
                  disabled={verificandoSenhaExclusao || !senhaExclusao}
                >
                  {verificandoSenhaExclusao ? 'Excluindo...' : 'Confirmar Exclusão'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <p>Tem certeza que deseja excluir o laudo da REP nº <strong>{laudoParaExcluir?.rep_numero}</strong>?</p>
                <Alert variant="destructive">
                  <AlertDescription>
                    A REP vinculada voltará para o status <strong>Pendente</strong>.
                  </AlertDescription>
                </Alert>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleExcluir}>Excluir Laudo</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {timelineLaudo && (
        <RepTimelineDialog
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
          repId={timelineLaudo.rep_id}
          repNumero={timelineLaudo.rep_numero}
        />
      )}
    </div>
  );
};
