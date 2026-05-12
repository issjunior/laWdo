import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Save, ArrowLeft, Edit, ChevronDown, Eye, FileText, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { TinyMceEditor } from '@/components/editor/TinyMceEditor';
import { removerFormatacaoPlaceholders } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { AISectionToolbar } from '@/components/ai/AISectionToolbar';
import { AISheet, type ChatMessage } from '@/components/ai/AISheet';

interface Placeholder {
  id: string;
  chave: string;
  descricao: string;
  categoria: string;
}

// ... (seções de interfaces mantidas)

function formatarData(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    const data = new Date(iso);
    if (isNaN(data.getTime())) return iso;
    return data.toLocaleDateString('pt-BR');
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
    'rep.envolvido': repData.nome_envolvido || '',
    'rep.local': repData.local_fato || '',
    'rep.bo': repData.numero_bo || '',
    'rep.ip': repData.numero_ip || '',
    'rep.data': formatarData(repData.data_requisicao),
    'rep.autoridade': repData.autoridade_solicitante || '',
    'rep.requisicao': repData.numero_documento || '',
    'rep.lacre_entrada': repData.lacre_entrada || '',
    'rep.lacre_saida': repData.lacre_saida || '',

    // Prefixados com rep_ (notação do banco de dados — seed do sistema)
    'rep_numero': repData.numero || '',
    'rep_data_requisicao': formatarData(repData.data_requisicao),
    'rep_prazo': repData.prazo || '',
    'rep_tipo_solicitacao': repData.tipo_solicitacao || '',
    'rep_numero_documento': repData.numero_documento || '',
    'rep_data_documento': repData.data_documento || '',
    'rep_autoridade_solicitante': repData.autoridade_solicitante || '',
    'rep_nome_envolvido': repData.nome_envolvido || '',
    'rep_local_fato': repData.local_fato || '',
    'rep_latitude': repData.latitude != null ? String(repData.latitude) : '',
    'rep_longitude': repData.longitude != null ? String(repData.longitude) : '',
    'rep_data_acionamento': repData.data_acionamento || '',
    'rep_data_chegada': repData.data_chegada || '',
    'rep_data_saida': repData.data_saida || '',
    'rep_numero_bo': repData.numero_bo || '',
    'rep_numero_ip': repData.numero_ip || '',
    'rep_lacre_entrada': repData.lacre_entrada || '',
    'rep_lacre_saida': repData.lacre_saida || '',
    'rep_observacoes': repData.observacoes || '',

    // Relacionamentos (preenchidos via extraContext em handlePreview)
    'solicitante_nome': extraContext?.solicitanteNome || '',
    'tipo_exame_nome': extraContext?.tipoExameNome || '',
    'tipo_exame_codigo': extraContext?.tipoExameCodigo || '',

    // Sem prefixo (compatibilidade)
    'NUMERO_REP': repData.numero || '',
    'NUMERO': repData.numero || '',
    'NOME_ENVOLVIDO': repData.nome_envolvido || '',
    'ENVOLVIDO': repData.nome_envolvido || '',
    'LOCAL_FATO': repData.local_fato || '',
    'BO': repData.numero_bo || '',
    'IP': repData.numero_ip || '',
    'AUTORIDADE': repData.autoridade_solicitante || '',
    'LACRE_ENTRADA': repData.lacre_entrada || '',
    'LACRE_SAIDA': repData.lacre_saida || '',

    // Sem prefixo (notação recomendada após migração)
    'numero_rep': repData.numero || '',
    'data_recebimento_rep': formatarData(repData.data_requisicao),
    'tipo_solicitacao_rep': repData.tipo_solicitacao || '',
    'numero_solicitacao_rep': repData.numero_documento || '',
    'data_solicitacao_rep': repData.data_documento || '',
    'autoridade_solicitante_rep': repData.autoridade_solicitante || '',
    'nome_envolvido': repData.nome_envolvido || '',
    'local_fato': repData.local_fato || '',
    'latitude': repData.latitude != null ? String(repData.latitude) : '',
    'longitude': repData.longitude != null ? String(repData.longitude) : '',
    'data_acionamento_local': repData.data_acionamento || '',
    'data_chegada_local': repData.data_chegada || '',
    'data_saida_local': repData.data_saida || '',
    'numero_bo': repData.numero_bo || '',
    'numero_ip': repData.numero_ip || '',
    'lacre_entrada': repData.lacre_entrada || '',
    'lacre_saida': repData.lacre_saida || '',
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
  };

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
          // Substitui o span inteiro pelo valor (texto puro)
          span.replaceWith(valor);
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
  nome_envolvido?: string;
  data_requisicao?: string;
  tipo_solicitacao?: string;
  numero_documento?: string;
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

/** Converte placeholders {{chave}} textuais em spans estilizados (formato TinyMCE),
 *  preservando placeholders que já estão no formato span. */
function converterPlaceholdersTextuais(html: string, chavesValidas: string[]): string {
  if (!html || chavesValidas.length === 0) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const chavesSet = new Set(chavesValidas);

  // Percorre todos os nós de texto do DOM
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  const regex = /\{\{([^{}]+)\}\}/g;

  for (const textNode of textNodes) {
    // Não processar texto dentro de spans de placeholder já existentes
    const parent = textNode.parentElement;
    if (parent?.classList?.contains('placeholder-tag')) continue;
    if (parent?.getAttribute?.('data-placeholder')) continue;

    const text = textNode.textContent || '';
    const substituicoes: { pos: number; fim: number; chave: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (chavesSet.has(match[1])) {
        substituicoes.push({ pos: match.index, fim: match.index + match[0].length, chave: match[1] });
      }
    }

    if (substituicoes.length === 0) continue;

    // Constrói fragmento com texto + spans intercalados
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const s of substituicoes) {
      if (s.pos > cursor) {
        fragment.appendChild(document.createTextNode(text.substring(cursor, s.pos)));
      }
      const span = document.createElement('span');
      span.className = 'placeholder-tag';
      span.setAttribute('contenteditable', 'false');
      span.setAttribute('data-placeholder', `{{${s.chave}}}`);
      span.textContent = `{{${s.chave}}}`;
      fragment.appendChild(span);
      cursor = s.fim;
    }
    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(cursor)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  return doc.body.innerHTML;
}

export const LaudosPage: React.FC = () => {
  const [laudos, setLaudos] = useState<LaudoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<LaudoItem | null>(null);
  const [secoes, setSecoes] = useState<SecaoEditor[]>([]);
  const [secoesColapsadas, setSecoesColapsadas] = useState<Record<number, boolean>>({});
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState('');
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);

  const [iaSheetOpen, setIaSheetOpen] = useState(false);
  const [iaSheetSecaoIdx, setIaSheetSecaoIdx] = useState<number | null>(null);
  const [iaSheetSecaoTitulo, setIaSheetSecaoTitulo] = useState('');
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [iaLoading, setIaLoading] = useState(false);
  const [iaError, setIaError] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [laudoParaExcluir, setLaudoParaExcluir] = useState<LaudoItem | null>(null);

  const carregarPlaceholders = useCallback(async () => {
    const r = await window.ipcAPI.placeholder.findAll();
    if (r.success && r.data) {
      setPlaceholders(r.data);
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

  const inserirPlaceholder = (editorId: string, chave: string) => {
    const editor = (window as any).tinymce?.get(editorId);
    if (editor) {
      editor.insertContent(`{{${chave}}}`);
    }
  };

  const handlePreview = async () => {
    if (!editando) return;
    try {
      setCarregandoPreview(true);
      setError(null);
      
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
      let cabecalhoHtml = '';
      const headerResult = await window.ipcAPI.configuracao.obter('cabecalho_laudo');
      if (headerResult.success && headerResult.data) {
        cabecalhoHtml = headerResult.data;
      }

      // 3. Montar HTML completo
      const secoesHtml = secoes
        .map((s, i) => `<h2>${i + 1}. ${s.titulo}</h2>${s.conteudo}`)
        .join('\n');

      let fullHtml = cabecalhoHtml
        ? `<div class="cabecalho" style="border-bottom:2px solid #000;padding-bottom:16px;margin-bottom:32px;">${cabecalhoHtml}</div>`
        : '';
      fullHtml += secoesHtml;

      // 4. Aplicar placeholders (incluindo relacionamentos)
      const htmlProcessado = aplicarPlaceholders(fullHtml, repData, {
        solicitanteNome,
        tipoExameNome,
        tipoExameCodigo,
      });

      // 5. Gerar PDF via IPC (usando o mesmo handler do template)
      const result = await window.ipcAPI.template.previewPDF(htmlProcessado);
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

  const handleEditar = (laudo: LaudoItem) => {
    setEditando(laudo);
    setSecoes(parseConteudoEmSecoes(laudo.conteudo || ''));
    setSecoesColapsadas({});
    setError(null);
    setSuccess(null);
  };

  const handleVoltar = () => {
    setEditando(null);
    setSecoes([]);
    setSecoesColapsadas({});
    setError(null);
    setSuccess(null);
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

      const conteudo = removerFormatacaoPlaceholders(reconstruirConteudo(secoes));
      const r = await window.ipcAPI.laudo.updateConteudo(editando.id, conteudo);
      if (r.success) {
        setSuccess('Laudo salvo com sucesso!');
        setEditando(prev => prev ? { ...prev, conteudo } : null);
        setLaudos(prev =>
          prev.map(l => (l.id === editando.id ? { ...l, conteudo } : l))
        );
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

  const atualizarConteudoSecao = (idx: number, novoConteudo: string) => {
    setSecoes(prev => {
      const novas = [...prev];
      novas[idx] = { ...novas[idx], conteudo: novoConteudo };
      return novas;
    });
  };

  const handleOpenSheet = (idx: number, titulo: string) => {
    setIaSheetSecaoIdx(idx);
    setIaSheetSecaoTitulo(titulo);
    setIaSheetOpen(true);
    setIaError(null);
  };

  const handleRevisarOrtografia = async (html: string, idx: number) => {
    try {
      setIaLoading(true);
      setIaError(null);
      const r = await window.ipcAPI.ia.revisarOrtografia(html);
      if (r.success && r.data) {
        // Aplicar diretamente ao editor
        atualizarConteudoSecao(idx, String(r.data));
      } else {
        setIaError(r.error || 'Erro ao revisar ortografia');
        handleOpenSheet(idx, secoes[idx]?.titulo || '');
      }
    } catch (e: any) {
      setIaError(e.message || 'Erro ao revisar ortografia');
    } finally {
      setIaLoading(false);
    }
  };

  const handleAdequarEscrita = async (html: string, idx: number) => {
    try {
      setIaLoading(true);
      setIaError(null);
      const r = await window.ipcAPI.ia.adequarEscrita(html);
      if (r.success && r.data) {
        const resposta: ChatMessage = {
          role: 'assistant',
          content: String(r.data),
          timestamp: Date.now(),
        };
        setChatMessages(prev => ({
          ...prev,
          [`secao-${idx}`]: [...(prev[`secao-${idx}`] || []), resposta],
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
      setIaLoading(true);
      setIaError(null);
      const r = await window.ipcAPI.ia.descreverImagem(imagens);
      if (r.success && r.data) {
        const resposta: ChatMessage = {
          role: 'assistant',
          content: String(r.data),
          timestamp: Date.now(),
        };
        setChatMessages(prev => ({
          ...prev,
          [`secao-${idx}`]: [...(prev[`secao-${idx}`] || []), resposta],
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

  const handlePerguntar = async (pergunta: string, html: string, idx: number, titulo: string) => {
    try {
      setIaLoading(true);
      setIaError(null);

      const userMsg: ChatMessage = {
        role: 'user',
        content: pergunta,
        timestamp: Date.now(),
      };

      setChatMessages(prev => ({
        ...prev,
        [`secao-${idx}`]: [...(prev[`secao-${idx}`] || []), userMsg],
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
          [`secao-${idx}`]: [...(prev[`secao-${idx}`] || []), assistantMsg],
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
      atualizarConteudoSecao(iaSheetSecaoIdx, texto);
      setIaSheetOpen(false);
    }
  };

  const handleSendChatMessage = (message: string) => {
    if (iaSheetSecaoIdx !== null) {
      const html = secoes[iaSheetSecaoIdx]?.conteudo || '';
      const titulo = secoes[iaSheetSecaoIdx]?.titulo || '';
      handlePerguntar(message, html, iaSheetSecaoIdx, titulo);
    }
  };

  const handleExcluir = async () => {
    if (!laudoParaExcluir) return;
    try {
      setError(null);
      const r = await window.ipcAPI.laudo.delete(laudoParaExcluir.id);
      if (r.success) {
        setSuccess(r.message || 'Laudo excluído com sucesso!');
        setDeleteDialogOpen(false);
        setLaudoParaExcluir(null);
        carregarLaudos();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(r.error || 'Erro ao excluir laudo');
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao excluir laudo');
    }
  };

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
        const variantMap: Record<string, 'default' | 'secondary' | 'outline'> = {
          'Em andamento': 'default',
          'Concluído': 'outline',
          'Entregue': 'secondary',
        };
        return <Badge variant={variantMap[status] || 'secondary'}>{status}</Badge>;
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
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => handleEditar(laudo)} aria-label={`Editar laudo da REP ${laudo.rep_numero}`}>
              <Edit size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setLaudoParaExcluir(laudo); setDeleteDialogOpen(true); }}
              aria-label={`Excluir laudo da REP ${laudo.rep_numero}`}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        );
      },
    },
  ], [handleEditar]);

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

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <div>
                <CardTitle className="text-lg">Template: {editando.template_nome || 'Não definido'}</CardTitle>
                <CardDescription>
                  Status: {editando.status} &middot; Iniciado em {formatarData(editando.data_inicio)}
                  {editando.data_conclusao ? ` &middot; Concluído em ${formatarData(editando.data_conclusao)}` : ''}
                </CardDescription>
              </div>
              <Badge variant={editando.status === 'Concluído' ? 'outline' : editando.status === 'Entregue' ? 'secondary' : 'default'}>{editando.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {secoes.map((secao, idx) => (
              <Collapsible
                key={idx}
                open={!secoesColapsadas[idx]}
                onOpenChange={(open) => setSecoesColapsadas(prev => ({ ...prev, [idx]: !open }))}
                className="border rounded-lg"
              >
                <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 rounded-t-lg transition-colors">
                  <h3 className="text-base font-semibold">{secao.titulo}</h3>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
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
                    <ContextMenu>
                      <ContextMenuTrigger>
                        <TinyMceEditor
                          editorId={`secao-${idx}`}
                          value={secao.conteudo}
                          onChange={val => atualizarConteudoSecao(idx, val)}
                          height={400}
                          placeholder={`Escreva o conteúdo de "${secao.titulo}"...`}
                          laudoId={editando.id}
                        />
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-64">
                        <ContextMenuLabel>Inserir Placeholder</ContextMenuLabel>
                        <ContextMenuSeparator />
                        {Array.from(new Set(placeholders.map(p => p.categoria))).sort().map(cat => (
                          <ContextMenuSub key={cat}>
                            <ContextMenuSubTrigger>{cat || 'Outros'}</ContextMenuSubTrigger>
                            <ContextMenuSubContent className="w-56">
                              {placeholders
                                .filter(p => p.categoria === cat)
                                .sort((a, b) => a.chave.localeCompare(b.chave))
                                .map(p => (
                                  <ContextMenuItem
                                    key={p.id}
                                    onClick={() => inserirPlaceholder(`secao-${idx}`, p.chave)}
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
                </CollapsibleContent>
              </Collapsible>
            ))}
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
          editorId={iaSheetSecaoIdx !== null ? `secao-${iaSheetSecaoIdx}` : ''}
          messages={iaSheetSecaoIdx !== null ? chatMessages[`secao-${iaSheetSecaoIdx}`] || [] : []}
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
              searchColumn="rep_numero"
              searchPlaceholder="Buscar por REP, template ou envolvido..."
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
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Laudo</DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </div>
  );
};
