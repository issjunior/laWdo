import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useRegistrarAlteracoesPendentes } from '@/contexts/AlteracoesPendentesContext';
import { useAtalhoSalvarLaudo } from '@/hooks/useAtalhoSalvarLaudo';
import { useModelosIaSessao } from '@/hooks/useModelosIaSessao';
import {
  useGerenciadorAlteracoesLaudo,
  type OrigemAlteracaoLaudo,
} from '@/hooks/useGerenciadorAlteracoesLaudo';
import type { Editor as TinyMceEditorInstance } from 'tinymce';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Edit, ChevronDown, Eye, FileText, Trash2, Send, ShieldAlert, Lock, CheckCircle, RotateCcw, Clock, Wand2, Download, CircleAlert } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { DefinicaoColunaTabela } from '@/components/data-table/data-table-features';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { TinyMceEditor } from '@/components/editor/TinyMceEditor';
import { DialogoAplicarRespostaIa } from '@/components/ai/DialogoAplicarRespostaIa';
import { AssistenteIaPanel, type ChatMessage } from '@/components/ai/AssistenteIaPanel';
import { PainelIaErrorBoundary } from '@/components/ai/PainelIaErrorBoundary';
import { criarChaveMemoriaConsultaIa, localizarEvidenciasConsultaIa, serializarBlocosContextoIa } from '@/lib/ia-consulta-contexto';
import { tabelaMarkdownParaHtmlSeguro } from '@/lib/ia-resposta-formatada';
import { navegarParaEvidenciaIa as navegarParaEvidenciaNoEditor } from '@/lib/ia-evidencia-navegacao';
import { listarModelosIa, obterModeloPadraoIa } from '@shared/catalogos/modelos-ia.catalogo';
import {
  CONFIGURACAO_PRIVACIDADE_IA_PADRAO,
  configuracaoPrivacidadeIaValida,
  deveMascararConteudoIa,
  respostaConsultaIaValida,
  type AcaoIa,
  type BlocoContextoIa,
  type AtualizacaoPainelIa,
  type CamposEstadoPainelIa,
  type ComandoPainelIa,
  type EstadoOperacaoPainelIa,
  type FragmentoIa,
  type LimiteUsoIa,
  type ModoInteracaoIa,
  type ProgressoIa,
  type ProgressoConsultaIa,
  type RetomadaIa,
  type SolicitacaoIa,
} from '@shared/types/ia.types';
import {
  BarraEditorLaudo,
  CabecalhoEditorLaudo,
  obterClasseBadgeStatusLaudo,
  RodapeEditorLaudo,
} from '@/components/laudo/editor/ControlesEditorLaudo';
import { removerFormatacaoPlaceholders, cn, converterPlaceholdersTextuais } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { IlustracoesPanel, type ImagemLaudo } from '@/components/laudo/IlustracoesPanel';
import {
  PainelLateralRedimensionavel,
  type PainelLateralAtivo,
} from '@/components/laudo/PainelLateralRedimensionavel';
import { useSidebar } from '@/components/ui/sidebar';
import { RepTimelineDialog } from '@/components/timeline/RepTimelineDialog';
import { PlaceholderContextMenu } from '@/components/editor/PlaceholderContextMenu';
import { CAMPOS_ESPECIFICOS_PLACEHOLDERS } from '@/components/rep/exam-fields/placeholders';
import { EXAM_MENU_REGISTRY, EXAM_TOGGLES } from '@/components/rep/exam-fields/index';
import type { ExamToggle } from '@/components/rep/exam-fields/index';
import type { MenuSection } from '@/components/rep/exam-fields/types';
import { reindexarFiguras } from '@/lib/figuras';
import {
  getClasseSecaoEstrutural,
  normalizarTituloSecao,
  parsearSecoesEstruturais,
  reconstruirHtmlEstrutural,
  reindexarHtmlEstrutural,
  type SecaoEstruturalLaudo,
} from '@/lib/estrutura-laudo';
import { getMargens } from '@/lib/margens';
import { descreverPlaceholderPendente } from '@/lib/placeholder-pendente';
import {
  agendarVisualizacaoPlaceholders,
  type ModoVisualizacaoPlaceholders,
} from '@/lib/apresentacao-placeholders';
import { buildPdfHeaderConfig } from '@/lib/pdf-header';
import {
  construirMapaPlaceholdersResolvidos,
  limparIndicadoresCondicionais,
  resolverPlaceholdersExportacao,
  type MapaPlaceholdersResolvidos,
} from '@/lib/exportacao-placeholders';
import { parseHtmlParaEstrutura } from '@/lib/exportacao-parser';
import { protegerFragmentosIa, restaurarFragmentosIa } from '@/lib/ia-fragmentos';
import { resolverHtmlContextoIa, resolverTextoContextoIa } from '@/lib/ia-contexto';
import {
  identificarPendenciasConclusaoLaudo,
  possuiPendenciasConclusaoLaudo,
  type PendenciasConclusaoLaudo,
} from '@/lib/pendencias-conclusao-laudo';
import { toast } from 'sonner';
import { obterNomeArquivoLaudo } from '@shared/utils/nomes-documentos-rep';

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

interface Placeholder {
  id: string;
  chave: string;
  valor: string;
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

interface RepPlaceholderData {
  numero?: string;
  numero_documento?: string;
  local_fato?: string;
  data_requisicao?: string;
  autoridade_solicitante?: string;
  prazo?: string;
  tipo_solicitacao?: string;
  data_documento?: string;
  data_acionamento?: string;
  data_chegada?: string;
  data_saida?: string;
  observacoes?: string;
  solicitante_id?: string;
  tipo_exame_id?: string;
  campos_especificos?: string;
}

type TinymceWindow = Window & {
  tinymce?: {
    get: (id?: string) => TinyMceEditorInstance | null;
  };
};

type WindowComIntersectionObserver = Window & {
  IntersectionObserver: typeof IntersectionObserver;
};

const obterEditorTinyMce = (editorId: string): TinyMceEditorInstance | null => (
  (window as TinymceWindow).tinymce?.get(editorId) ?? null
);

const isTinyMceEditor = (editor: TinyMceEditorInstance | null | undefined): editor is TinyMceEditorInstance => (
  editor != null
);

const obterMensagemErro = (erro: unknown, fallback: string): string => (
  erro instanceof Error && erro.message ? erro.message : fallback
);

const obterMensagemErroIa = (erro: unknown): string => {
  const valor = typeof erro === 'string'
    ? erro
    : erro instanceof Error ? erro.message : '';
  const codigo = valor.split(':')[0];
  const mensagens: Record<string, string> = {
    CONFIGURACAO_AUSENTE: 'Configure o provedor, o modelo e a chave de API em Modelos de IA antes de tentar novamente.',
    NAO_AUTORIZADO: 'A chave de API foi recusada pelo provedor. Revise a configuração em Modelos de IA.',
    ENTRADA_INVALIDA: 'O provedor recusou esta solicitação. Tente reduzir o escopo ou selecionar outro modelo.',
    LIMITE_EXCEDIDO: 'O conteúdo selecionado excede o limite do modelo. Reduza o escopo e tente novamente.',
    SEM_CONEXAO: 'Não foi possível conectar ao provedor de IA. Verifique sua conexão e tente novamente.',
    LIMITE_REQUISICOES: 'O provedor respondeu HTTP 429. Verifique o aviso para os detalhes informados.',
    TIMEOUT: 'A IA demorou mais que o esperado para responder. Tente novamente ou reduza o escopo.',
    PROVEDOR_INDISPONIVEL: 'O provedor de IA está temporariamente indisponível. Tente novamente em alguns instantes.',
    RESPOSTA_INVALIDA: 'A IA respondeu em um formato inesperado mesmo após uma tentativa de correção. Tente novamente; se persistir, selecione outro modelo.',
    CANCELADO: 'A operação foi cancelada. O conteúdo do laudo não foi alterado.',
    OPERACAO_EM_ANDAMENTO: 'Já existe uma operação de IA em andamento. Aguarde sua conclusão ou cancele-a antes de iniciar outra.',
    CONFIRMACAO_NECESSARIA: 'Revise e confirme o plano antes de iniciar o processamento.',
    PLANO_ALTERADO: 'O texto ou as configurações mudaram após o planejamento. Gere a solicitação novamente.',
    RETOMADA_INDISPONIVEL: 'Os resultados intermediários não estão mais disponíveis. Inicie novamente o processamento.',
    RETOMADA_INVALIDA: 'O texto ou as configurações mudaram. Por segurança, o processamento deve ser iniciado novamente.',
    ERRO_INTERNO: 'Ocorreu uma falha interna ao processar a solicitação. Tente novamente.',
  };
  return mensagens[codigo] || 'Não foi possível concluir a solicitação de IA. Tente novamente.';
};

const obterAvisoLimiteIa = (limite: LimiteUsoIa | undefined): { mensagem: string; tentarNovamenteEm?: number } => {
  const provedor = limite?.provedor === 'gemini' ? 'O Gemini' : limite?.provedor === 'groq' ? 'O Groq' : 'O provedor';
  const descricoes: Record<LimiteUsoIa['categoria'], string> = {
    requisicoes: 'informou que o limite de requisições foi atingido.',
    tokens: 'informou que o limite de tokens foi atingido.',
    diario: 'informou que a cota diária foi atingida.',
    gasto: 'informou que o limite de uso financeiro foi atingido.',
    desconhecido: 'respondeu HTTP 429, sem detalhes suficientes para identificar a causa.',
  };
  return {
    mensagem: `${provedor} ${descricoes[limite?.categoria ?? 'desconhecido']}`,
    ...(limite?.tentarNovamenteEm !== undefined ? { tentarNovamenteEm: limite.tentarNovamenteEm } : {}),
  };
};

const isRecord = (valor: unknown): valor is Record<string, unknown> => (
  typeof valor === 'object' && valor !== null
);

const isString = (valor: unknown): valor is string => typeof valor === 'string';

const isBoolean = (valor: unknown): valor is boolean => typeof valor === 'boolean';

const isImagemLaudoArray = (valor: unknown): valor is ImagemLaudo[] => Array.isArray(valor);

const isImagemLaudo = (valor: unknown): valor is ImagemLaudo => (
  isRecord(valor)
  && isString(valor.id)
  && isString(valor.url)
  && isString(valor.thumbnailUrl)
  && isString(valor.legenda)
);

const aplicarPlaceholders = (
  html: string,
  repData: RepPlaceholderData,
  extraContext?: { solicitanteNome?: string; tipoExameNome?: string; tipoExameCodigo?: string },
): string => resolverPlaceholdersExportacao(html, {
  repData,
  solicitanteNome: extraContext?.solicitanteNome,
  tipoExameNome: extraContext?.tipoExameNome,
  tipoExameCodigo: extraContext?.tipoExameCodigo,
});

const converterHtmlEmTexto = (html: string): string => {
  try {
    return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() || '';
  } catch {
    return html;
  }
};

const converterTextoEmHtmlSeguro = (texto: string): string => {
  const escaparHtml = (valor: string) => valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  return texto
    .split(/\r?\n/)
    .map(linha => linha.trim() ? `<p>${escaparHtml(linha)}</p>` : '<p>&nbsp;</p>')
    .join('');
};

const seletorTextoProtegidoIa = 'figure, figcaption, script, style, [data-placeholder], [contenteditable="false"]';

const extrairFragmentosIa = (html: string): FragmentoIa[] => {
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const walker = documento.createTreeWalker(documento.body, NodeFilter.SHOW_TEXT);
  const fragmentos: FragmentoIa[] = [];
  let no: Node | null;
  while ((no = walker.nextNode())) {
    const pai = no.parentElement;
    if (!pai || pai.closest(seletorTextoProtegidoIa) || !no.textContent?.trim()) continue;
    fragmentos.push({ id: `texto-${fragmentos.length}`, texto: no.textContent });
  }
  return fragmentos;
};

const reconstruirHtmlIa = (htmlOriginal: string, fragmentos: FragmentoIa[]): string | null => {
  const documento = new DOMParser().parseFromString(htmlOriginal, 'text/html');
  const walker = documento.createTreeWalker(documento.body, NodeFilter.SHOW_TEXT);
  const nos: Text[] = [];
  let no: Node | null;
  while ((no = walker.nextNode())) {
    if (no.parentElement && !no.parentElement.closest(seletorTextoProtegidoIa) && no.textContent?.trim()) nos.push(no as Text);
  }
  if (nos.length !== fragmentos.length || fragmentos.some((fragmento, indice) => fragmento.id !== `texto-${indice}`)) return null;
  nos.forEach((texto, indice) => { texto.textContent = fragmentos[indice].texto; });
  return documento.body.innerHTML;
};

const assinaturaEstruturalIa = (html: string): string => {
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const descrever = (elemento: Element): string => {
    const atributos = Array.from(elemento.attributes)
      .map(atributo => `${atributo.name}=${atributo.value}`)
      .sort()
      .join(';');
    return `<${elemento.tagName.toLowerCase()} ${atributos}>${Array.from(elemento.children).map(descrever).join('')}</${elemento.tagName.toLowerCase()}>`;
  };
  return Array.from(documento.body.children).map(descrever).join('');
};

const calcularFingerprintIa = async (tipo: AlvoIaCapturado['tipo'], html: string): Promise<string> => {
  const dados = `${tipo}\n${assinaturaEstruturalIa(html)}\n${extrairFragmentosIa(html).map(fragmento => `${fragmento.id}:${fragmento.texto}`).join('\n')}`;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dados));
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const obterMascaramentoIa = async (): Promise<boolean> => {
  const privacidadeResposta = await window.ipcAPI.configuracao.obter('privacidade_ia');
  let configuracao = CONFIGURACAO_PRIVACIDADE_IA_PADRAO;
  if (privacidadeResposta.success && typeof privacidadeResposta.data === 'string') {
    try {
      const valor: unknown = JSON.parse(privacidadeResposta.data);
      if (configuracaoPrivacidadeIaValida(valor)) configuracao = valor;
    } catch {
      configuracao = CONFIGURACAO_PRIVACIDADE_IA_PADRAO;
    }
  }
  return deveMascararConteudoIa(configuracao);
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
  updated_at?: string;
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

interface AtualizacaoStatusPendente {
  laudo: LaudoItem;
  novoStatus: string;
  pendencias: PendenciasConclusaoLaudo;
}

type SecaoEditor = SecaoEstruturalLaudo;

interface RespostaIaPendente {
  modo: 'inserir' | 'substituir';
  texto: string;
  htmlProposto: string;
  conteudoAtual: string;
  conteudoProposto: string;
  indiceAlvo: number;
  conteudoAlvo: string;
  alvoId: string;
  fragmentosPropostos: FragmentoIa[];
}

type BookmarkTinyMce = ReturnType<TinyMceEditorInstance['selection']['getBookmark']>;

interface AlvoIaCapturado {
  id: string;
  indice: number;
  editorId: string;
  tipo: 'selecao' | 'secao' | 'laudo_completo' | 'cursor';
  conteudo: string;
  texto: string;
  bookmark: BookmarkTinyMce | null;
  fingerprint?: string;
}

interface ExecucaoIaPreparada {
  solicitacao: SolicitacaoIa;
  alvo: AlvoIaCapturado;
  html: string;
  indice: number;
  descricao: string;
  chatKey: string;
  protecao: ReturnType<typeof protegerFragmentosIa> | null;
  tamanhoResposta?: ChatMessage['tamanhoResposta'];
}

interface RetomadaIaPendente {
  retomada: RetomadaIa;
  execucao: ExecucaoIaPreparada;
}

interface FallbackModeloIaPendente {
  pergunta: string;
  codigo: 'MODELO_REMOVIDO' | 'MODELO_INCOMPATIVEL' | 'CONFIGURACAO_AUSENTE';
  modeloRecomendado: string | null;
}

export const LaudosPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setTemporariamenteRecolhida } = useSidebar();
  const [laudos, setLaudos] = useState<LaudoItem[]>([]);
  const filtroDashboard = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const laudosFiltradosDashboard = useMemo(() => {
    const status = filtroDashboard.get('status');
    const prioridade = filtroDashboard.get('prioridade');
    if (status) return laudos.filter(laudo => laudo.status === status);
    if (prioridade === 'aguardando-entrega') return laudos.filter(laudo => laudo.status === 'Concluído' && !laudo.data_entrega);
    if (prioridade === 'sem-alteracao') {
      const limite = new Date(); limite.setDate(limite.getDate() - 7);
      return laudos.filter(laudo => laudo.status === 'Em andamento' && Boolean(laudo.updated_at) && new Date(laudo.updated_at ?? '') <= limite);
    }
    return laudos;
  }, [filtroDashboard, laudos]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<LaudoItem | null>(null);
  const [secoes, setSecoes] = useState<SecaoEditor[]>([]);
  const [secoesColapsadas, setSecoesColapsadas] = useState<Record<number, boolean>>({});
  const [editorMode, setEditorMode] = useState<'multi' | 'single'>('single');
  const [singleEditorHtml, setSingleEditorHtml] = useState('');
  const {
    estadoSalvamento,
    alteracoesPendentes,
    salvando,
    iniciarSessao,
    encerrarSessao,
    registrarAlteracao,
    iniciarSalvamento,
    concluirSalvamento,
    falharSalvamento,
    executarSemRegistrar,
  } = useGerenciadorAlteracoesLaudo();
  const [dialogoSaidaAberto, setDialogoSaidaAberto] = useState(false);
  const salvarAntesDeVoltarRef = useRef<HTMLButtonElement>(null);
  useRegistrarAlteracoesPendentes('editor-laudo', Boolean(editando) && alteracoesPendentes);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState('');
  const [nomeArquivoPreview, setNomeArquivoPreview] = useState('laudo.pdf');
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [libreOfficeDisponivel, setLibreOfficeDisponivel] = useState<boolean | null>(null);
  const [listaPreviewOpen, setListaPreviewOpen] = useState(false);
  const [listaPreviewBlobUrl, setListaPreviewBlobUrl] = useState('');
  const [nomeArquivoListaPreview, setNomeArquivoListaPreview] = useState('laudo.pdf');
  const [listaPreviewLoading, setListaPreviewLoading] = useState(false);
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [iaSheetOpen, setIaSheetOpen] = useState(false);
  const [painelIaDestacado, setPainelIaDestacado] = useState(false);
  const [iaSheetSecaoIdx, setIaSheetSecaoIdx] = useState<number | null>(null);
  const [iaSheetSecaoTitulo, setIaSheetSecaoTitulo] = useState('');
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [iaLoading, setIaLoading] = useState(false);
  const [estadoOperacaoIa, setEstadoOperacaoIa] = useState<EstadoOperacaoPainelIa>('ocioso');
  const [operacaoIaAtivaId, setOperacaoIaAtivaId] = useState<string | null>(null);
  const [progressoIa, setProgressoIa] = useState<ProgressoIa | null>(null);
  const [progressoConsultaIa, setProgressoConsultaIa] = useState<ProgressoConsultaIa | null>(null);
  const [retomadaIaPendente, setRetomadaIaPendente] = useState<RetomadaIaPendente | null>(null);
  const [iaError, setIaError] = useState<string | null>(null);
  const [avisoLimiteIa, setAvisoLimiteIa] = useState<{ mensagem: string; tentarNovamenteEm?: number } | null>(null);
  const {
    modeloIaSessao,
    setModeloIaSessao,
    provedorIaSessao,
  } = useModelosIaSessao(editando?.id);
  const [fallbackModeloIaPendente, setFallbackModeloIaPendente] = useState<FallbackModeloIaPendente | null>(null);
  const [iaSheetMode, setIaSheetMode] = useState<AcaoIa | null>(null);
  const [respostaIaPendente, setRespostaIaPendente] = useState<RespostaIaPendente | null>(null);
  const editorIaAtivoRef = useRef<string | null>(null);
  const alvosIaRef = useRef(new Map<string, AlvoIaCapturado>());
  const execucoesIaReenviaveisRef = useRef(new Map<string, ExecucaoIaPreparada>());
  const memoriaConsultasIaRef = useRef(new Map<string, Array<{ pergunta: string; resposta: string }>>());
  const reconciliacaoImagensRef = useRef<Promise<void> | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [atualizacaoStatusPendente, setAtualizacaoStatusPendente] = useState<AtualizacaoStatusPendente | null>(null);
  const [laudoParaExcluir, setLaudoParaExcluir] = useState<LaudoItem | null>(null);
  const [senhaExclusao, setSenhaExclusao] = useState('');
  const [senhaExclusaoErro, setSenhaExclusaoErro] = useState('');
  const [verificandoSenhaExclusao, setVerificandoSenhaExclusao] = useState(false);
  const [passoExclusao, setPassoExclusao] = useState<'confirmar' | 'senha'>('confirmar');
  const [iluminacoesPanelOpen, setIlustracoesPanelOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelPoppedOut, setPanelPoppedOut] = useState(false);
  const [figuraSubstituicaoSolicitada, setFiguraSubstituicaoSolicitada] = useState<string | null>(null);

  const painelLateralAtivo: PainelLateralAtivo = iaSheetOpen
    ? 'ia'
    : iluminacoesPanelOpen ? 'ilustracoes' : null;
  const painelLateralExpandido = painelLateralAtivo !== null && !panelCollapsed;

  useEffect(() => {
    setTemporariamenteRecolhida(painelLateralExpandido);
    return () => setTemporariamenteRecolhida(false);
  }, [painelLateralExpandido, setTemporariamenteRecolhida]);

  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLaudo, setTimelineLaudo] = useState<LaudoItem | null>(null);

  const [exameMenuStructure, setExameMenuStructure] = useState<MenuSection[] | undefined>(undefined);
  const [exameCamposEspecificos, setExameCamposEspecificos] = useState<Record<string, unknown> | undefined>(undefined);
  const [categoriaExameId, setCategoriaExameId] = useState<string>('');
  const [modoVisualizacaoPlaceholders, setModoVisualizacaoPlaceholders] = useState<ModoVisualizacaoPlaceholders>('dados');
  const [mapaPlaceholdersResolvidos, setMapaPlaceholdersResolvidos] = useState<MapaPlaceholdersResolvidos>({});
  const avisosFalhaPlaceholdersRef = useRef<Set<string>>(new Set());
  const [blocoParaSuprimir, setBlocoParaSuprimir] = useState<{ tipo: string; armaChave?: string; armaIndice?: number } | null>(null);
  const [quantidadeBlocosSuprimidos, setQuantidadeBlocosSuprimidos] = useState(0);

  const exameToggles = useMemo<ExamToggle[] | undefined>(() => {
    if (!editando?.tipo_exame_codigo) return undefined;
    const allToggles = EXAM_TOGGLES[editando.tipo_exame_codigo];
    if (!allToggles) return undefined;

    // Sem dados da REP ainda, mostra todos (evita flicker enquanto carrega)
    if (!exameCamposEspecificos) return allToggles;

    // exameCamposEspecificos já é o objeto b602 (extraído em handleEditar via parsed.b602)
    const b602 = exameCamposEspecificos as Record<string, unknown>;

    /** Retorna true se o toggle está 'on' na REP (explícito ou implícito por array de dados) */
    const isToggleOn = (toggleId: string): boolean => {
      // Remove prefixo 'b602_' do ID para casar com a chave no JSON armazenado
      // Ex: 'b602_armas_toggle' → 'armas_toggle'  /  'b602_cartuchos_toggle' → 'cartuchos_toggle'
      const storedKey = toggleId.replace(/^b602_/, '');

      // Toggle explícito: valor 'on'/'off' armazenado diretamente
      if (b602[storedKey] === 'on') return true;

      // Toggle implícito: array de dados correspondente existe e tem itens
      // Ex: 'cartuchos_toggle' → 'cartuchos' (array com os itens cadastrados)
      const arrayKey = storedKey.replace('_toggle', '');
      const arr = b602[arrayKey];
      return Array.isArray(arr) && arr.length > 0;
    };

    return allToggles
      .filter(toggle => {
        const selfOn = isToggleOn(toggle.id);
        if (toggle.subToggles) {
          const activeSubs = toggle.subToggles.filter(sub => isToggleOn(sub.id));
          return selfOn || activeSubs.length > 0;
        }
        return selfOn;
      })
      .map(toggle => {
        if (toggle.subToggles) {
          const activeSubs = toggle.subToggles.filter(sub => isToggleOn(sub.id));
          return { ...toggle, subToggles: activeSubs.length > 0 ? activeSubs : undefined };
        }
        return toggle;
      });
  }, [editando?.tipo_exame_codigo, exameCamposEspecificos]);

  const [syncEnabled, setSyncEnabled] = useState(true);
  const [figuraAtivaId, setFiguraAtivaId] = useState<string | null>(null);
  const [imagemSelecionadaIaId, setImagemSelecionadaIaId] = useState<string | null>(null);

  const [ilustracoesKey, setIlustracoesKey] = useState(0);
  const [ilustracoesRemounting, setIlustracoesRemounting] = useState(false);
  const remountScheduledRef = useRef(false);
  const scrollRestoreRef = useRef<number | null>(null);

  // --- Filtro por abas ---
  const [tabFiltro, setTabFiltro] = useState<string>('todos');

  const contagem = useMemo(() => ({
    todos: laudosFiltradosDashboard.length,
    em_andamento: laudosFiltradosDashboard.filter(l => l.status === 'Em andamento').length,
    concluidos: laudosFiltradosDashboard.filter(l => l.status === 'Concluído').length,
    entregues: laudosFiltradosDashboard.filter(l => l.status === 'Entregue').length,
  }), [laudosFiltradosDashboard]);

  const laudosFiltrados = useMemo(() => {
    if (tabFiltro === 'todos') return laudosFiltradosDashboard;
    const statusMap: Record<string, string> = {
      'em_andamento': 'Em andamento',
      'concluidos': 'Concluído',
      'entregues': 'Entregue',
    };
    return laudosFiltradosDashboard.filter(l => l.status === statusMap[tabFiltro]);
  }, [laudosFiltradosDashboard, tabFiltro]);

  const tituloTab: Record<string, string> = {
    todos: 'Todos os Laudos',
    em_andamento: 'Laudos em Andamento',
    concluidos: 'Laudos Concluídos',
    entregues: 'Laudos Entregues',
  };

  const pillVariant = (value: string) => {
    const isActive = tabFiltro === value;
    const base = 'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 h-auto';
    if (!isActive) return cn(
      base,
      'bg-transparent border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground',
      // Neutraliza o data-[state=active] do Radix/shadcn que daria bg-background num frame ínfimo
      'data-[state=active]:bg-transparent data-[state=active]:border-border/60 data-[state=active]:text-muted-foreground data-[state=active]:shadow-none'
    );
    const colors: Record<string, string> = {
      todos: 'bg-primary text-primary-foreground border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary',
      em_andamento: 'bg-amber-500 text-white border-amber-500 data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:border-amber-500',
      concluidos: 'bg-emerald-500 text-white border-emerald-500 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:border-emerald-500',
      entregues: 'bg-blue-500 text-white border-blue-500 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:border-blue-500',
    };
    return cn(base, colors[value], 'shadow-sm data-[state=active]:shadow-sm');
  };

  const dotClasses = (value: string) => {
    const isActive = tabFiltro === value;
    const size = 'w-2.5 h-2.5 rounded-full shrink-0';
    if (isActive) return cn(size, 'bg-white/90');
    const colors: Record<string, string> = {
      em_andamento: 'bg-amber-500',
      concluidos: 'bg-emerald-500',
      entregues: 'bg-blue-500',
    };
    return cn(size, colors[value] || 'bg-muted-foreground/40');
  };

  const badgePill = (value: string) => {
    const isActive = tabFiltro === value;
    if (isActive) return 'bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold tabular-nums leading-tight';
    return 'bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full font-semibold tabular-nums leading-tight';
  };

  const SINGLE_CHAT_KEY = 'single-editor';
  const chaveChatImagemIa = (imagemId: string) => `imagem-${imagemId}`;

  const placeholderChaves = useMemo(
    () => Array.from(new Set([
      ...placeholders.map(p => p.chave),
      ...CAMPOS_ESPECIFICOS_PLACEHOLDERS.map(p => p.chave),
    ])),
    [placeholders],
  );

  const buildSingleHtmlFromSecoes = useCallback((secoesFonte: SecaoEditor[]) => {
    if (secoesFonte.length === 0) return '';
    let indiceH2 = 0;
    let indiceH3 = 0;
    return secoesFonte
      .map((sec, index) => {
        if (sec.nivel === 2) {
          indiceH2 += 1;
          indiceH3 = 0;
        } else {
          indiceH3 += 1;
        }

        const tituloBase = normalizarTituloSecao(sec.titulo || `Seção ${index + 1}`);
        const titulo = sec.nivel === 2
          ? `${indiceH2}. ${tituloBase}`
          : `${indiceH2}.${indiceH3} ${tituloBase}`;
        const conteudo = sec.conteudo?.trim() || '<p>&nbsp;</p>';
        return `
          <section
            data-laudo-secao="true"
            data-secao-index="${index}"
            data-secao-id="${sec.id || ''}"
            data-parent-id="${sec.parentId || ''}"
            data-estrutura-nivel="${sec.nivel}"
            data-derivada-rep="${sec.derivadaRep ? 'true' : 'false'}"
            style="margin-bottom:16px;border:1px solid rgba(128,128,128,0.2);border-radius:8px;overflow:hidden;"
          >
            <div
              contenteditable="false"
              data-laudo-secao-header="true"
              style="background:rgba(128,128,128,0.08);padding:8px 12px;border-bottom:1px solid rgba(128,128,128,0.2);font-weight:600;color:inherit;"
            >
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

  const reindexarSecoesEditadas = useCallback((secoesFonte: SecaoEditor[]) => (
    secoesFonte.map(secao => ({
      ...secao,
      titulo: normalizarTituloSecao(secao.titulo),
    }))
  ), []);

  const atualizarConteudoSecao = useCallback((
    idx: number,
    novoConteudo: string,
    origem: OrigemAlteracaoLaudo = 'usuario',
  ) => {
    registrarAlteracao(origem);
    setSecoes(prev => {
      const novas = [...prev];
      novas[idx] = { ...novas[idx], conteudo: novoConteudo };
      return novas;
    });
  }, [registrarAlteracao]);

  const obterSecoesAtuaisDoEditor = useCallback((): SecaoEditor[] => {
    if (editorMode === 'single') {
      const editor = obterEditorTinyMce('laudo-single-editor');
      const latestHtml = editor ? editor.getContent() : singleEditorHtml;
      setSingleEditorHtml(latestHtml);
      return parseSingleHtmlToSecoes(latestHtml, secoes);
    }

    return secoes.map((secao, idx) => {
      const editor = obterEditorTinyMce(`secao-${idx}`);
      const conteudo = editor ? editor.getContent() : secao.conteudo;
      return { ...secao, conteudo };
    });
  }, [editorMode, parseSingleHtmlToSecoes, secoes, singleEditorHtml]);

  const montarHtmlEstruturalAtual = useCallback((secoesFonte: SecaoEditor[]) => {
    const htmlEstrutural = reconstruirHtmlEstrutural(reindexarSecoesEditadas(secoesFonte));
    return reindexarFiguras(reindexarHtmlEstrutural(htmlEstrutural));
  }, [reindexarSecoesEditadas]);

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
    } catch (e: unknown) {
      setError(obterMensagemErro(e, 'Erro ao carregar laudos'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarLaudos();
    carregarPlaceholders();
    window.ipcAPI.laudo.verificarLibreOffice().then((r: { success: boolean; data?: boolean }) => {
      setLibreOfficeDisponivel(r.success && r.data === true);
    });
  }, [carregarLaudos, carregarPlaceholders]);

  useEffect(() => {
    if (!syncEnabled || !editando) {
      setFiguraAtivaId(null);
      return;
    }

    const ratios = new Map<string, number>();
    const observers: IntersectionObserver[] = [];

    const timeout = setTimeout(() => {
      const editors: TinyMceEditorInstance[] = editorMode === 'single'
        ? [obterEditorTinyMce('laudo-single-editor')].filter(isTinyMceEditor)
        : secoes.map((_, i) => obterEditorTinyMce(`secao-${i}`)).filter(isTinyMceEditor);

      for (const editor of editors) {
        const body = editor.getBody();
        const win = editor.getWin() as WindowComIntersectionObserver;
        if (!body || !win) continue;

        const observer = new win.IntersectionObserver(
          (entries: IntersectionObserverEntry[]) => {
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

        Array.from(body.querySelectorAll('.laudo-figure') as NodeListOf<Element>).forEach((f) => observer.observe(f));
        observers.push(observer);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      observers.forEach(o => o.disconnect());
    };
  }, [syncEnabled, editando, editorMode, secoes, singleEditorHtml]);

  useEffect(() => {
    setImagemSelecionadaIaId(null);
  }, [editando?.id, editorMode]);

  useEffect(() => {
    avisosFalhaPlaceholdersRef.current.clear();
  }, [editando?.id]);

  useEffect(() => {
    if (!imagemSelecionadaIaId) return;
    const marcador = `data-image-id="${imagemSelecionadaIaId}"`;
    const imagemPermaneceNoLaudo = editorMode === 'single'
      ? singleEditorHtml.includes(marcador)
      : secoes.some(secao => secao.conteudo.includes(marcador));
    if (!imagemPermaneceNoLaudo) setImagemSelecionadaIaId(null);
  }, [editorMode, imagemSelecionadaIaId, secoes, singleEditorHtml]);

  const inserirPlaceholder = (editorId: string, chave: string) => {
    const editor = obterEditorTinyMce(editorId);
    if (editor) {
      editor.execCommand('insertPlaceholder', false, { chave });
      aplicarModoNoEditor(editor);
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
      nivel: 2,
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

  const reconciliarImagensDoEditor = useCallback(async (): Promise<void> => {
    if (!editando?.id) return;
    if (reconciliacaoImagensRef.current) return reconciliacaoImagensRef.current;

    const reconciliar = async () => {
      const editorIds = editorMode === 'single'
        ? ['laudo-single-editor']
        : secoes.map((_, indice) => `secao-${indice}`);
      const figuras = editorIds.flatMap(editorId => {
        const editor = obterEditorTinyMce(editorId);
        return Array.from(editor?.getBody()?.querySelectorAll<HTMLElement>('.laudo-figure[data-image-id]') || [])
          .map(figura => ({ editorId, figura }));
      });

      for (const [indice, { figura }] of figuras.entries()) {
        const imagemId = figura.getAttribute('data-image-id');
        const imagem = figura.querySelector('img');
        const dataUri = imagem?.getAttribute('src') || '';
        if (!imagemId || !/^data:image\/(?:jpeg|png|gif|bmp|webp);base64,/i.test(dataUri)) continue;

        const legenda = figura.querySelector('figcaption')?.textContent
          ?.replace(/^Fig(?:ura|\.)\s*(?:\d+|XX)[:\s]*/i, '')
          .trim() || '';
        const resposta = await window.ipcAPI.ilustracoes.salvarImagem(editando.id, {
          id: imagemId,
          nomeArquivo: `imagem-editor-${indice + 1}`,
          dataUri,
          legenda,
          origem: 'local',
          sequencia: indice + 1,
        });
        if (!resposta.success) throw new Error(resposta.error || 'Não foi possível vincular a imagem ao laudo.');
        const arquivamento = await window.ipcAPI.ilustracoes.arquivarImagem(editando.id, imagemId);
        if (!arquivamento.success) throw new Error(arquivamento.error || 'Não foi possível atualizar a imagem vinculada.');
      }

      if (editorMode === 'single') {
        const editor = obterEditorTinyMce('laudo-single-editor');
        if (!editor) return;
        const html = editor.getContent();
        setSingleEditorHtml(html);
        setSecoes(parseSingleHtmlToSecoes(html, secoes));
        return;
      }

      setSecoes(prev => prev.map((secao, indice) => {
        const editor = obterEditorTinyMce(`secao-${indice}`);
        return editor ? { ...secao, conteudo: editor.getContent() } : secao;
      }));
    };

    const promessa = reconciliar().finally(() => {
      reconciliacaoImagensRef.current = null;
    });
    reconciliacaoImagensRef.current = promessa;
    return promessa;
  }, [editando?.id, editorMode, parseSingleHtmlToSecoes, secoes]);

  const handleScrollToFigure = useCallback((imageId: string) => {
    const editorIds = editorMode === 'single'
      ? ['laudo-single-editor']
      : secoes.map((_, i) => `secao-${i}`);
    for (const editorId of editorIds) {
      const editor = obterEditorTinyMce(editorId);
      if (!editor) continue;
      const figure = editor.getBody()?.querySelector(`.laudo-figure[data-image-id="${imageId}"]`);
      if (figure) {
        figure.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
    }
  }, [editorMode, secoes]);

  const obterEditorIlustracoes = useCallback((): {
    editorId: string;
    idx: number;
    editor: TinyMceEditorInstance | null;
    secoesAtuais: SecaoEditor[];
  } => {
    if (editorMode === 'single') {
      const editor = obterEditorTinyMce('laudo-single-editor');
      return { editorId: 'laudo-single-editor', idx: -1, editor, secoesAtuais: secoes };
    }
    const { idx, secoes: secoesAtuais } = garantirSecaoIlustracoes();
    const editor = obterEditorTinyMce(`secao-${idx}`);
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
          Array.from(body.querySelectorAll('.laudo-figure') as NodeListOf<Element>).forEach((fig) => {
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

  const handleIlustracoesEditorInit = useCallback((editor: TinyMceEditorInstance) => {
    if (scrollRestoreRef.current !== null && editor.getBody()) {
      const scrollContainer = editor.getBody().parentElement;
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollRestoreRef.current;
      }
      scrollRestoreRef.current = null;
    }
    setIlustracoesRemounting(false);
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
    onReplaceImage: (imageId: string, imagem: ImagemLaudo) => void;
    onGerarLegenda: (imageId: string) => Promise<string | null>;
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
    onGerarLegenda: async () => null,
    syncCurrentState: () => {},
  });

  panelCallbacksRef.current = {
    onInsertImage: (url, id, legenda) => {
      if (editorMode === 'single') {
        const editor = obterEditorTinyMce('laudo-single-editor');
        if (!editor) {
          console.error('[ilustracoes] insertImage: ERRO single mode - editor not found');
          toast.error('Editor não encontrado. Tente recarregar a página.');
          return;
        }
        const secoesAtualizadas = parseSingleHtmlToSecoes(editor.getContent(), secoes);
        let idxIlus = secoesAtualizadas.findIndex(s => s.titulo.trim().toUpperCase() === 'ILUSTRAÇÕES');
        const secoesComIlus = [...secoesAtualizadas];
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
          secoesComIlus.splice(idxIlus, 0, { nivel: 2, titulo: 'ILUSTRAÇÕES', conteudo: '<p>&nbsp;</p>' });
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
      setImagemSelecionadaIaId(atual => atual === imageId ? null : atual);
      if (editorMode === 'single') {
        const editor = obterEditorTinyMce('laudo-single-editor');
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
        return;
      }
      const idxIlustracoes = secoes.findIndex(
        s => s.titulo.trim().toUpperCase() === 'ILUSTRAÇÕES'
      );
      if (idxIlustracoes < 0) {
        console.warn('[ilustracoes] deleteImage: seção ILUSTRAÇÕES não encontrada');
        return;
      }
      const editor = obterEditorTinyMce(`secao-${idxIlustracoes}`);
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
    },
    onUpdateLegenda: (id, legenda) => {
      const atualizarFigcaption = (editor: TinyMceEditorInstance) => {
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
        const editor = obterEditorTinyMce('laudo-single-editor');
        if (editor && atualizarFigcaption(editor)) {
          const novoHtml = editor.getContent();
          setSingleEditorHtml(novoHtml);
          setSecoes(parseSingleHtmlToSecoes(novoHtml, secoes));
        }
        return;
      }
      for (let idx = 0; idx < secoes.length; idx++) {
        const editor = obterEditorTinyMce(`secao-${idx}`);
        if (editor && atualizarFigcaption(editor)) {
          atualizarConteudoSecao(idx, editor.getContent());
          break;
        }
      }
    },
    onReorder: (imagens) => {
      if (editorMode === 'single') {
        const editor = obterEditorTinyMce('laudo-single-editor');
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
        const editor = obterEditorTinyMce('laudo-single-editor');
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
            const editor = obterEditorTinyMce(`secao-${idx}`);
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
      void reconciliarImagensDoEditor().catch(error => {
        toast.error(obterMensagemErro(error, 'Não foi possível vincular as imagens do editor ao laudo.'));
      });
    },
    onInsertAll: (imagens) => {
      if (!imagens || imagens.length === 0) {
        toast.info('Nenhuma imagem carregada para inserir');
        return;
      }

      if (editorMode === 'single') {
        const editor = obterEditorTinyMce('laudo-single-editor');
        if (editor) {
          const secoesAtualizadas = parseSingleHtmlToSecoes(editor.getContent(), secoes);
          let idxIlus = secoesAtualizadas.findIndex(s => s.titulo.trim().toUpperCase() === 'ILUSTRAÇÕES');
          const secoesComIlus = [...secoesAtualizadas];
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
            secoesComIlus.splice(idxIlus, 0, { nivel: 2, titulo: 'ILUSTRAÇÕES', conteudo: '<p>&nbsp;</p>' });
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
    onGerarLegenda: async (imageId) => {
      const legenda = await gerarLegendaImagemIaRef.current(imageId);
      if (legenda) {
        panelCallbacksRef.current.onUpdateLegenda(imageId, legenda);
        panelCallbacksRef.current.syncCurrentState();
      }
      return legenda;
    },
    onReplaceImage: (imageId, imagem) => {
      setImagemSelecionadaIaId(atual => atual === imageId ? null : atual);
      const executarReplace = () => {
        if (editorMode === 'single') {
          const editor = obterEditorTinyMce('laudo-single-editor');
          if (editor) {
            editor.execCommand('replaceLaudoImage', false, { imageId, newImageId: imagem.id, newUrl: imagem.url });
            const novoHtml = editor.getContent();
            setSingleEditorHtml(novoHtml);
            setSecoes(parseSingleHtmlToSecoes(novoHtml, secoes));
          }
        } else {
          for (let idx = 0; idx < secoes.length; idx++) {
            const editor = obterEditorTinyMce(`secao-${idx}`);
            if (editor) {
              const figure = editor.getBody()?.querySelector(`.laudo-figure[data-image-id="${imageId}"]`);
              if (figure) {
                editor.execCommand('replaceLaudoImage', false, { imageId, newImageId: imagem.id, newUrl: imagem.url });
                atualizarConteudoSecao(idx, editor.getContent());
                break;
              }
            }
          }
        }
        if (editando?.id) {
          void window.ipcAPI.ilustracoes.disponibilizarImagem(editando.id, imageId);
        }
        toast.success('Figura substituída');
      };
      executarReplace();
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
    return window.ipcAPI.ilustracoes.onPanelAction((action: string, ...args: unknown[]) => {
      const cbs = panelCallbacksRef.current;
      switch (action) {
        case 'insertImage':
          if (isString(args[0]) && isString(args[1]) && isString(args[2])) cbs.onInsertImage(args[0], args[1], args[2]);
          break;
        case 'deleteImage':
          if (isString(args[0])) cbs.onDeleteImage(args[0]);
          break;
        case 'updateLegenda':
          if (isString(args[0]) && isString(args[1])) cbs.onUpdateLegenda(args[0], args[1]);
          break;
        case 'reorder':
          if (isImagemLaudoArray(args[0])) cbs.onReorder(args[0]);
          break;
        case 'refreshHtml': cbs.onRefreshHtml(); break;
        case 'insertAll':
          if (isImagemLaudoArray(args[0])) cbs.onInsertAll(args[0]);
          break;
        case 'syncToggle':
          if (isBoolean(args[0])) cbs.onSyncToggle(args[0]);
          break;
        case 'scrollToFigure':
          if (isString(args[0])) cbs.onScrollToFigure(args[0]);
          break;
        case 'replaceImage':
          if (isString(args[0]) && isImagemLaudo(args[1])) cbs.onReplaceImage(args[0], args[1]);
          break;
        case 'generateCaption':
          if (isString(args[0])) void cbs.onGerarLegenda(args[0]);
          break;
        case 'ready': cbs.syncCurrentState(); break;
        case 'popIn':
          setPanelPoppedOut(false);
          setIaSheetOpen(false);
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
    if (!editando?.id) return;
    setIaSheetOpen(false);
    setIlustracoesPanelOpen(false);
    setPanelPoppedOut(true);
    window.ipcAPI.ilustracoes.openPanel(editando.id, editando.rep_numero);

    panelCallbacksRef.current.syncCurrentState();
    setTimeout(() => panelCallbacksRef.current.syncCurrentState(), 300);
    setTimeout(() => panelCallbacksRef.current.syncCurrentState(), 700);

    toast.info('Painel de ilustrações movido para janela separada');
  };

  const handleToggleIlustracoes = () => {
    setIaSheetOpen(false);
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
      const secoesAtuais = obterSecoesAtuaisDoEditor();
      
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
      let fullHtml = cabecalhoPrimeiraPagina
        ? `<div class="cabecalho" style="padding-bottom:16px;margin-bottom:32px;">${cabecalhoPrimeiraPagina}</div>`
        : '';
      fullHtml += montarHtmlEstruturalAtual(secoesAtuais);

      // 4. Aplicar placeholders (incluindo relacionamentos)
      const htmlProcessado = aplicarPlaceholders(fullHtml, repData, {
        solicitanteNome,
        tipoExameNome,
        tipoExameCodigo,
      });

      // 5. Resolver placeholders de exame (B-602, I-801) incluindo armas computados
      const htmlResolvido = resolverPlaceholdersExportacao(htmlProcessado, {
        repData,
        solicitanteNome,
        tipoExameNome,
        tipoExameCodigo,
      });

      // 6. Gerar PDF via IPC
      const nomeArquivo = obterNomeArquivoLaudo(repData.numero || editando.rep_numero, 'pdf');
      const result = await window.ipcAPI.template.previewPDF(htmlResolvido, await getMargens(), headerTemplate || undefined, nomeArquivo);
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
        setNomeArquivoPreview(nomeArquivo);
        setPreviewOpen(true);
      } else {
        setError(result.error || 'Erro ao gerar PDF do laudo');
      }
    } catch (e: unknown) {
      setError('Erro ao gerar preview: ' + obterMensagemErro(e, 'Erro inesperado'));
    } finally {
      setCarregandoPreview(false);
    }
  };

  const handleListaPreview = useCallback(async (laudo: LaudoItem) => {
    try {
      setListaPreviewLoading(true);
      setError(null);

      const rRep = await window.ipcAPI.rep.findById(laudo.rep_id);
      if (!rRep.success || !rRep.data) {
        setError('Erro ao carregar dados da REP para o preview');
        return;
      }
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

      const { headerTemplate, cabecalhoPrimeiraPagina } = await buildPdfHeaderConfig({
        numeroRepFallback: repData.numero || '',
      });

      let html = reindexarHtmlEstrutural(laudo.conteudo || '<p>&nbsp;</p>');
      if (cabecalhoPrimeiraPagina) {
        html = `<div class="cabecalho" style="padding-bottom:16px;margin-bottom:32px;">${cabecalhoPrimeiraPagina}</div>${html}`;
      }
      html = reindexarFiguras(html);
      html = aplicarPlaceholders(html, repData, { solicitanteNome, tipoExameNome, tipoExameCodigo });
      html = resolverPlaceholdersExportacao(html, {
        repData,
        solicitanteNome,
        tipoExameNome,
        tipoExameCodigo,
      });

      const margins = await getMargens();
      const nomeArquivo = obterNomeArquivoLaudo(repData.numero || laudo.rep_numero, 'pdf');
      const result = await window.ipcAPI.template.previewPDF(html, margins, headerTemplate || undefined, nomeArquivo);

      if (result.success && result.data) {
        const byteChars = atob(result.data);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
        if (listaPreviewBlobUrl) URL.revokeObjectURL(listaPreviewBlobUrl);
        const url = URL.createObjectURL(blob);
        setListaPreviewBlobUrl(url);
        setNomeArquivoListaPreview(nomeArquivo);
        setListaPreviewOpen(true);
      } else {
        setError(result.error || 'Erro ao gerar PDF do laudo');
      }
    } catch (e: unknown) {
      setError('Erro ao gerar preview: ' + obterMensagemErro(e, 'Erro inesperado'));
    } finally {
      setListaPreviewLoading(false);
    }
  }, [listaPreviewBlobUrl]);

  const baixarPdfVisualizado = (url: string, nomeArquivo: string) => {
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.click();
    link.remove();
  };

  const handleExportar = async (formato: 'pdf' | 'docx' | 'odt') => {
    if (!editando) return;
    let toastId: string | number | undefined;
    try {
      setExportando(true);
      setError(null);

      const labelFormato = formato === 'pdf' ? 'PDF' : formato === 'docx' ? 'Word (.docx)' : 'ODT (.odt)';
      toastId = toast.loading(`Exportando laudo como ${labelFormato}...`);

      const rRep = await window.ipcAPI.rep.findById(editando.rep_id);
      if (!rRep.success || !rRep.data) {
        setError('Erro ao carregar dados da REP para exportação');
        return;
      }
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

      const { cabecalhoPrimeiraPagina } = await buildPdfHeaderConfig({
        numeroRepFallback: repData.numero || '',
      });

      const secoesAtuais = obterSecoesAtuaisDoEditor();
      let html = montarHtmlEstruturalAtual(secoesAtuais);

      if (cabecalhoPrimeiraPagina) {
        html = `<div class="cabecalho" style="padding-bottom:16px;margin-bottom:32px;">${cabecalhoPrimeiraPagina}</div>${html}`;
      }

      const htmlResolvido = resolverPlaceholdersExportacao(html, {
        repData,
        solicitanteNome,
        tipoExameNome,
        tipoExameCodigo,
      });

      if (formato === 'pdf') {
        const result = await window.ipcAPI.laudo.exportar({
          laudoId: editando.id,
          formato: 'pdf',
          html: htmlResolvido,
          margens: await getMargens() || undefined,
        });
        if (result.success) {
          toast.success('Documento PDF exportado com sucesso', { id: toastId });
        } else if (result.error !== 'Operação cancelada pelo usuário') {
          toast.error(result.error || 'Erro ao exportar PDF', { id: toastId });
        } else {
          toast.dismiss(toastId);
        }
      } else if (formato === 'docx') {
        const estrutura = parseHtmlParaEstrutura(htmlResolvido);

        let logoBase64: string | undefined;
        if (cabecalhoPrimeiraPagina) {
          const match = cabecalhoPrimeiraPagina.match(/<img[^>]+src="(data:image\/[^"]+)"[^>]*>/i);
          if (match) logoBase64 = match[1].replace(/^data:image\/\w+;base64,/, '');
        }

        const result = await window.ipcAPI.laudo.exportar({
          laudoId: editando.id,
          formato: 'docx',
          html: htmlResolvido,
          estrutura,
          cabecalho: cabecalhoPrimeiraPagina ? {
            logoBase64,
            texto: cabecalhoPrimeiraPagina.replace(/<[^>]*>/g, '').trim(),
            alinhamento: /text-align:\s*(center|right|left)/i.test(cabecalhoPrimeiraPagina)
              ? cabecalhoPrimeiraPagina.match(/text-align:\s*(center|right|left)/i)![1]
              : 'left',
          } : undefined,
          margens: await getMargens() || undefined,
        });

        if (result.success) {
          toast.success('Documento Word exportado com sucesso', { id: toastId });
        } else if (result.error !== 'Operação cancelada pelo usuário') {
          toast.error(result.error || 'Erro ao exportar DOCX', { id: toastId });
        } else {
          toast.dismiss(toastId);
        }
      } else if (formato === 'odt') {
        const estrutura = parseHtmlParaEstrutura(htmlResolvido);

        const result = await window.ipcAPI.laudo.exportar({
          laudoId: editando.id,
          formato: 'odt',
          html: htmlResolvido,
          estrutura,
          margens: await getMargens() || undefined,
        });

        if (result.success) {
          toast.success('Documento ODT exportado com sucesso', { id: toastId });
        } else if (result.error !== 'Operação cancelada pelo usuário') {
          toast.error(result.error || 'Erro ao exportar ODT', { id: toastId });
        } else {
          toast.dismiss(toastId);
        }
      }
    } catch (e: unknown) {
      toast.error('Erro ao exportar: ' + obterMensagemErro(e, 'Erro inesperado'), { id: toastId });
    } finally {
      setExportando(false);
    }
  };

  const handleEditar = useCallback(async (laudo: LaudoItem) => {
    if (laudo.tipo_criacao === 'wizard') {
      navigate(`/laudos/${laudo.id}/wizard`);
      return;
    }
    const parsedSecoes = parsearSecoesEstruturais(
      reindexarHtmlEstrutural(
        limparIndicadoresCondicionais(converterPlaceholdersTextuais(laudo.conteudo || '', placeholderChaves))
      )
    ).map(secao => ({
      ...secao,
      titulo: normalizarTituloSecao(secao.titulo),
    }));
    const codigo = laudo.tipo_exame_codigo;
    if (codigo) {
      setCategoriaExameId(`cat-exam-${codigo}`);
      setExameMenuStructure(EXAM_MENU_REGISTRY[codigo]);
      try {
        const rRep = await window.ipcAPI.rep.findById(laudo.rep_id);
        if (rRep.success && rRep.data) {
          setMapaPlaceholdersResolvidos(construirMapaPlaceholdersResolvidos({ repData: rRep.data }));
        }
        if (rRep.success && rRep.data && rRep.data.campos_especificos) {
          const parsed = JSON.parse(rRep.data.campos_especificos);
          setExameCamposEspecificos(parsed.b602 || parsed);
        } else {
          setExameCamposEspecificos(undefined);
        }
      } catch {
        setExameCamposEspecificos(undefined);
        setMapaPlaceholdersResolvidos({});
      }
    } else {
      setCategoriaExameId('');
      setExameMenuStructure(undefined);
      setExameCamposEspecificos(undefined);
      setMapaPlaceholdersResolvidos({});
    }

    setModoVisualizacaoPlaceholders('dados');
    setQuantidadeBlocosSuprimidos((laudo.conteudo.match(/data-cond-suprimido="true"/g) || []).length);
    iniciarSessao();
    setSecoes(parsedSecoes);
    setSingleEditorHtml(buildSingleHtmlFromSecoes(parsedSecoes));
    setEditorMode('single');
    setSecoesColapsadas({});
    setError(null);
    setSuccess(null);
    setEditando(laudo);
  }, [navigate, placeholderChaves, buildSingleHtmlFromSecoes, iniciarSessao]);

  const aplicarModoNoEditor = useCallback((editor: TinyMceEditorInstance) => {
    agendarVisualizacaoPlaceholders(editor, {
      modo: modoVisualizacaoPlaceholders,
      valores: mapaPlaceholdersResolvidos,
      placeholdersPersonalizados: placeholders,
      descreverPendente: descreverPlaceholderPendente,
      aoFalharDefinitivamente: () => {
        if (avisosFalhaPlaceholdersRef.current.has(editor.id)) return;
        avisosFalhaPlaceholdersRef.current.add(editor.id);
        toast.warning('Alguns campos não puderam ser atualizados visualmente. O conteúdo original foi preservado.');
      },
    });
  }, [mapaPlaceholdersResolvidos, modoVisualizacaoPlaceholders, placeholders]);

  const confirmarSupressaoBloco = useCallback(() => {
    if (!blocoParaSuprimir) return;
    const editores = editorMode === 'single'
      ? [obterEditorTinyMce('laudo-single-editor')]
      : secoes.map((_, indice) => obterEditorTinyMce(`secao-${indice}`));
    const editor = editores.filter(isTinyMceEditor).find(candidato => {
      const seletor = `[data-bloco-pericial="${blocoParaSuprimir.tipo}"]`;
      return Array.from(candidato.getBody()?.querySelectorAll<HTMLElement>(seletor) || []).some(bloco => (
        !blocoParaSuprimir.armaChave || bloco.getAttribute('data-arma-chave') === blocoParaSuprimir.armaChave
      ));
    });
    if (!editor) return;
    editor.undoManager.transact(() => {
      const seletor = `[data-bloco-pericial="${blocoParaSuprimir.tipo}"]`;
      const bloco = Array.from(editor.getBody()?.querySelectorAll<HTMLElement>(seletor) || []).find(candidato => (
        !blocoParaSuprimir.armaChave || candidato.getAttribute('data-arma-chave') === blocoParaSuprimir.armaChave
      ));
      bloco?.setAttribute('data-cond-suprimido', 'true');
    });
    const conteudo = editor.getContent();
    registrarAlteracao();
    if (editorMode === 'single') setSingleEditorHtml(conteudo);
    else {
      const indice = editores.indexOf(editor);
      if (indice >= 0) atualizarConteudoSecao(indice, conteudo);
    }
    setQuantidadeBlocosSuprimidos(quantidade => quantidade + 1);
    setBlocoParaSuprimir(null);
  }, [atualizarConteudoSecao, blocoParaSuprimir, editorMode, registrarAlteracao, secoes]);

  const restaurarBlocosSuprimidos = useCallback(() => {
    const editores = editorMode === 'single'
      ? [obterEditorTinyMce('laudo-single-editor')]
      : secoes.map((_, indice) => obterEditorTinyMce(`secao-${indice}`));
    editores.filter(isTinyMceEditor).forEach((editor, indice) => {
      if (!editor.getBody()?.querySelector('[data-cond-suprimido="true"]')) return;
      editor.undoManager.transact(() => editor.getBody()?.querySelectorAll('[data-cond-suprimido="true"]').forEach(bloco => bloco.removeAttribute('data-cond-suprimido')));
      const conteudo = editor.getContent();
      if (editorMode === 'single') setSingleEditorHtml(conteudo);
      else atualizarConteudoSecao(indice, conteudo);
    });
    registrarAlteracao();
    setQuantidadeBlocosSuprimidos(0);
  }, [atualizarConteudoSecao, editorMode, registrarAlteracao, secoes]);

  useEffect(() => {
    if (!editando) return;
    const aplicarAosEditores = () => {
      const editores = editorMode === 'single'
        ? [obterEditorTinyMce('laudo-single-editor')]
        : secoes.map((_, indice) => obterEditorTinyMce(`secao-${indice}`));
      editores.filter(isTinyMceEditor).forEach(aplicarModoNoEditor);
    };
    aplicarAosEditores();
  }, [aplicarModoNoEditor, editando, editorMode, secoes]);

  const finalizarVolta = () => {
    if (panelPoppedOut) {
      window.ipcAPI.ilustracoes.closePanel();
    }
    setEditando(null);
    setSecoes([]);
    setSingleEditorHtml('');
    encerrarSessao();
    setEditorMode('single');
    setSecoesColapsadas({});
    setError(null);
    setSuccess(null);
    setExameMenuStructure(undefined);
    setExameCamposEspecificos(undefined);
    setMapaPlaceholdersResolvidos({});
    setQuantidadeBlocosSuprimidos(0);
    setCategoriaExameId('');
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl('');
    }
  };

  const handleVoltar = () => {
    if (alteracoesPendentes) {
      setDialogoSaidaAberto(true);
      return;
    }
    finalizarVolta();
  };

  const handleVoltarAoTopo = useCallback(() => {
    document.getElementById('conteudo-principal')?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  const handleIrAoFinal = useCallback(() => {
    document.getElementById('rodape-editor-laudo')?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, []);

  const handleSalvar = async (): Promise<boolean> => {
    if (!editando || !iniciarSalvamento()) return false;
    try {
      setError(null);
      setSuccess(null);
      const secoesAtuais = reindexarSecoesEditadas(obterSecoesAtuaisDoEditor());
      setSecoes(secoesAtuais);

      const htmlReindexado = montarHtmlEstruturalAtual(secoesAtuais);

      // 2. Remover formatação de placeholders e salvar
      const conteudoFinal = removerFormatacaoPlaceholders(htmlReindexado);

      const r = await window.ipcAPI.laudo.updateConteudo(editando.id, conteudoFinal);
      if (r.success) {
        const secoesNormalizadas = parsearSecoesEstruturais(conteudoFinal).map(secao => ({
          ...secao,
          titulo: normalizarTituloSecao(secao.titulo),
        }));
        setSuccess('Laudo salvo com sucesso!');
        setEditando(prev => prev ? { ...prev, conteudo: conteudoFinal } : null);
        setLaudos(prev =>
          prev.map(l => (l.id === editando.id ? { ...l, conteudo: conteudoFinal } : l))
        );

        // Atualizar visualização atual
        if (editorMode === 'single') {
          const htmlEditorUnico = buildSingleHtmlFromSecoes(secoesNormalizadas);
          setSecoes(secoesNormalizadas);
          setSingleEditorHtml(htmlEditorUnico);
          const editor = obterEditorTinyMce('laudo-single-editor');
          if (editor) {
            executarSemRegistrar(() => editor.setContent(htmlEditorUnico));
          }
        } else {
          setSecoes(secoesNormalizadas);
          secoesNormalizadas.forEach((sec, idx) => {
            const editor = obterEditorTinyMce(`secao-${idx}`);
            if (editor) {
              executarSemRegistrar(() => editor.setContent(sec.conteudo));
            }
          });
        }

        concluirSalvamento();
        setTimeout(() => setSuccess(null), 3000);
        return true;
      } else {
        falharSalvamento();
        setError(r.error || 'Erro ao salvar laudo');
        return false;
      }
    } catch (e: unknown) {
      falharSalvamento();
      setError(obterMensagemErro(e, 'Erro ao salvar laudo'));
      return false;
    }
  };

  useAtalhoSalvarLaudo({
    ativo: Boolean(editando),
    bloqueado: salvando || carregandoPreview || exportando,
    onSalvar: () => void handleSalvar(),
  });

  const handleReindexarSecoes = useCallback(() => {
    try {
      registrarAlteracao();
      const secoesAtuais = reindexarSecoesEditadas(obterSecoesAtuaisDoEditor());
      setSecoes(secoesAtuais);

      if (editorMode === 'single') {
        const htmlEditor = buildSingleHtmlFromSecoes(secoesAtuais);
        setSingleEditorHtml(htmlEditor);
        const editor = obterEditorTinyMce('laudo-single-editor');
        if (editor) editor.setContent(htmlEditor);
      }

      toast.success('Seções reindexadas com sucesso');
    } catch (e: unknown) {
      setError(obterMensagemErro(e, 'Erro ao reindexar seções'));
    }
  }, [
    buildSingleHtmlFromSecoes,
    editorMode,
    obterSecoesAtuaisDoEditor,
    registrarAlteracao,
    reindexarSecoesEditadas,
  ]);

  const handleOpenSheet = (idx: number, titulo: string) => {
    if (!panelPoppedOut) {
      setIlustracoesPanelOpen(false);
    }
    setIaSheetSecaoIdx(idx);
    setIaSheetSecaoTitulo(titulo);
    setImagemSelecionadaIaId(null);
    setIaSheetOpen(true);
    setPanelCollapsed(false);
    setIaError(null);
  };

  const capturarAlvoIa = (priorizarEscopoDoPainel = false): AlvoIaCapturado | null => {
    const editorIdDoEscopo = iaSheetSecaoIdx === null
      ? null
      : iaSheetSecaoIdx === -1 ? 'laudo-single-editor' : `secao-${iaSheetSecaoIdx}`;
    const editorId = priorizarEscopoDoPainel && editorIdDoEscopo
      ? editorIdDoEscopo
      : editorIaAtivoRef.current || editorIdDoEscopo;
    const editor = editorId ? obterEditorTinyMce(editorId) : null;
    if (editor) {
      const editorIdAtivo = editor.id;
      const indice = editorIdAtivo === 'laudo-single-editor'
        ? -1
        : Number(editorIdAtivo.replace('secao-', ''));
      const selecaoDoEditorAtivo = editorIdAtivo === editorIaAtivoRef.current;
      const htmlSelecao = selecaoDoEditorAtivo ? editor.selection.getContent({ format: 'html' }) : '';
      const textoSelecao = selecaoDoEditorAtivo ? editor.selection.getContent({ format: 'text' }).trim() : '';
      const temSelecao = Boolean(textoSelecao);
      const conteudo = temSelecao
        ? htmlSelecao
        : (indice === -1 ? editor.getContent() : secoes[indice]?.conteudo || editor.getContent());
      const textoRenderizado = temSelecao
        ? textoSelecao
        : editor.getBody()?.innerText?.trim() || resolverTextoContextoIa(conteudo, mapaPlaceholdersResolvidos);
      return {
        id: crypto.randomUUID(),
        indice,
        editorId: editorIdAtivo,
        tipo: temSelecao ? 'selecao' : (indice === -1 ? 'laudo_completo' : 'secao'),
        conteudo,
        texto: textoRenderizado,
        bookmark: editor.selection.getBookmark(2, true),
      };
    }

    if (iaSheetSecaoIdx === null) return null;
    const indice = iaSheetSecaoIdx;
    const conteudo = indice === -1 ? singleEditorHtml : secoes[indice]?.conteudo || '';
    return {
      id: crypto.randomUUID(),
      indice,
      editorId: indice === -1 ? 'laudo-single-editor' : `secao-${indice}`,
      tipo: indice === -1 ? 'laudo_completo' : 'secao',
      conteudo,
      texto: resolverTextoContextoIa(conteudo, mapaPlaceholdersResolvidos),
      bookmark: null,
    };
  };

  const registrarEditorIa = (editor: TinyMceEditorInstance) => {
    editor.on('focus', () => {
      editorIaAtivoRef.current = editor.id;
    });
    editor.on('click', event => {
      const alvo = event.target as HTMLElement;
      const figura = alvo.closest<HTMLElement>('.laudo-figure[data-image-id]');
      const imagemId = figura?.getAttribute('data-image-id') || null;
      if (imagemId) {
        setImagemSelecionadaIaId(imagemId);
        setFiguraAtivaId(imagemId);
      }
    });
  };

  const handleAbrirAssistenteIa = () => {
    if (!panelPoppedOut) setIlustracoesPanelOpen(false);
    const alvo = capturarAlvoIa();
    if (alvo) {
      alvosIaRef.current.set(alvo.id, alvo);
      setIaSheetSecaoIdx(alvo.indice);
      setIaSheetSecaoTitulo(alvo.tipo === 'selecao' ? 'Seleção atual' : alvo.indice === -1 ? 'Documento completo' : secoes[alvo.indice]?.titulo || 'Seção atual');
    } else {
      setIaSheetSecaoIdx(-1);
      setIaSheetSecaoTitulo('Documento completo');
    }
    setIaSheetOpen(true);
    setPanelCollapsed(false);
    setIaError(null);
  };

  const sessaoPainelIaRef = useRef<string | null>(null);
  const revisaoPainelIaRef = useRef(0);
  const ultimoEstadoPainelIaRef = useRef<CamposEstadoPainelIa | null>(null);
  const painelIaProntoRef = useRef(false);
  const executarAcaoIaRef = useRef<(acao: AcaoIa) => void>(() => {});
  const enviarMensagemIaRef = useRef<(mensagem: string, modo: ModoInteracaoIa, tamanho?: 'automatico' | 'curta' | 'media' | 'longa') => void>(() => {});
  const reenviarMensagemIaRef = useRef<(mensagemId: string) => void>(() => {});
  const cancelarOperacaoIaRef = useRef<() => void>(() => {});
  const retomarOperacaoIaRef = useRef<() => void>(() => {});
  const limparConversaIaRef = useRef<() => void>(() => {});
  const descreverImagemIaRef = useRef<() => void>(() => {});
  const gerarLegendaImagemIaRef = useRef<(imagemId: string) => Promise<string | null>>(async () => null);
  const aplicarRespostaIaRef = useRef<(mensagem: ChatMessage) => void>(() => {});
  const navegarParaEvidenciaIaRef = useRef<(evidencia: BlocoContextoIa) => void>(() => {});
  const consultarIaRef = useRef<(pergunta: string, modeloForcado?: string, escopoForcado?: -1) => void>(() => {});
  const operacaoIaAtivaRef = useRef<string | null>(null);

  useEffect(() => {
    operacaoIaAtivaRef.current = operacaoIaAtivaId;
  }, [operacaoIaAtivaId]);

  useEffect(() => {
    const remover = window.ipcAPI.ia.onProgresso(progresso => {
      if (progresso.operationId === operacaoIaAtivaRef.current) setProgressoIa(progresso);
    });
    const removerConsulta = window.ipcAPI.ia.onProgressoConsulta(progresso => {
      if (progresso.operationId === operacaoIaAtivaRef.current) {
        setProgressoConsultaIa(progresso);
        setEstadoOperacaoIa(progresso.fase);
      }
    });
    return () => { remover(); removerConsulta(); };
  }, []);

  useEffect(() => () => {
    const operationId = operacaoIaAtivaRef.current;
    if (operationId) void window.ipcAPI.ia.cancelar(operationId);
    window.ipcAPI.ia.painelFechar();
    sessaoPainelIaRef.current = null;
    painelIaProntoRef.current = false;
    ultimoEstadoPainelIaRef.current = null;
  }, [editando?.id]);

  const handleDestacarAssistenteIa = () => {
    const sessionId = crypto.randomUUID();
    sessaoPainelIaRef.current = sessionId;
    revisaoPainelIaRef.current = 0;
    ultimoEstadoPainelIaRef.current = null;
    painelIaProntoRef.current = false;
    setIaSheetOpen(false);
    setPainelIaDestacado(true);
    window.ipcAPI.ia.painelAbrir(sessionId);
  };

  useEffect(() => {
    const obterMensagensVisiveis = (): ChatMessage[] => {
      const chaveChat = imagemSelecionadaIaId
        ? chaveChatImagemIa(imagemSelecionadaIaId)
        : iaSheetSecaoIdx === -1
          ? SINGLE_CHAT_KEY
          : iaSheetSecaoIdx !== null ? `secao-${iaSheetSecaoIdx}` : '';
      return chaveChat ? chatMessages[chaveChat] || [] : [];
    };

    const publicarEstado = (sessionId: string, forcarSnapshot = false) => {
      if (sessionId !== sessaoPainelIaRef.current) return;
      const imagemSelecionada = Boolean(imagemSelecionadaIaId);
      const editorDisponivel = !imagemSelecionada && iaSheetSecaoIdx !== null;
      const estado: CamposEstadoPainelIa = {
        titulo: imagemSelecionadaIaId ? 'Imagem selecionada' : iaSheetSecaoTitulo || 'Escolha um escopo no editor',
        carregando: iaLoading,
        estadoOperacao: estadoOperacaoIa,
        erro: iaError,
        avisoLimite: avisoLimiteIa,
        editorDisponivel,
        imagemSelecionada,
        contextoImagem: imagemSelecionada,
        modoAplicacao: iaSheetMode && iaSheetMode !== 'inserir' ? 'substituir' : 'inserir',
        progresso: progressoIa,
        progressoConsulta: progressoConsultaIa,
        planoPendente: null,
        escopoSelecionado: iaSheetSecaoIdx ?? null,
        ...(modeloIaSessao ? { modeloSelecionado: modeloIaSessao } : {}),
        ...(provedorIaSessao ? { provedorIa: provedorIaSessao } : {}),
        retomada: retomadaIaPendente?.retomada || null,
        mensagens: obterMensagensVisiveis().map(mensagem => ({
          id: mensagem.id,
          role: mensagem.role,
          content: mensagem.content,
          timestamp: mensagem.timestamp,
          aplicacao: mensagem.aplicacao,
          acao: mensagem.acao,
          estadoConsulta: mensagem.estadoConsulta,
          modeloConsulta: mensagem.modeloConsulta,
          perguntaConsulta: mensagem.perguntaConsulta,
          recomendacao: mensagem.recomendacao,
          miniaturaDataUri: mensagem.miniaturaDataUri,
          evidencias: mensagem.evidencias,
          permiteAplicacao: mensagem.role === 'assistant' && mensagem.acao !== 'descrever_imagem',
          proposalId: mensagem.proposalId,
        })),
        escopos: [
          { id: -1, titulo: 'Documento completo' },
          ...secoes.map((secao, indice) => ({ id: indice, titulo: `${indice + 1}. Seção: ${secao.titulo}` })),
        ],
      };
      const anterior = ultimoEstadoPainelIaRef.current;
      let atualizacao: AtualizacaoPainelIa;
      if (forcarSnapshot || !anterior) {
        revisaoPainelIaRef.current += 1;
        atualizacao = {
          tipo: 'snapshot',
          estado: { revisao: revisaoPainelIaRef.current, ...estado },
        };
      } else {
        const alteracoes: Partial<CamposEstadoPainelIa> = {};
        if (estado.titulo !== anterior.titulo) alteracoes.titulo = estado.titulo;
        if (estado.carregando !== anterior.carregando) alteracoes.carregando = estado.carregando;
        if (estado.estadoOperacao !== anterior.estadoOperacao) alteracoes.estadoOperacao = estado.estadoOperacao;
        if (estado.erro !== anterior.erro) alteracoes.erro = estado.erro;
        if (estado.avisoLimite !== anterior.avisoLimite) alteracoes.avisoLimite = estado.avisoLimite;
        if (estado.editorDisponivel !== anterior.editorDisponivel) alteracoes.editorDisponivel = estado.editorDisponivel;
        if (estado.imagemSelecionada !== anterior.imagemSelecionada) alteracoes.imagemSelecionada = estado.imagemSelecionada;
        if (estado.contextoImagem !== anterior.contextoImagem) alteracoes.contextoImagem = estado.contextoImagem;
        if (estado.modoAplicacao !== anterior.modoAplicacao) alteracoes.modoAplicacao = estado.modoAplicacao;
        if (JSON.stringify(estado.progresso) !== JSON.stringify(anterior.progresso)) alteracoes.progresso = estado.progresso;
        if (JSON.stringify(estado.progressoConsulta) !== JSON.stringify(anterior.progressoConsulta)) alteracoes.progressoConsulta = estado.progressoConsulta;
        if (estado.escopoSelecionado !== anterior.escopoSelecionado) alteracoes.escopoSelecionado = estado.escopoSelecionado;
        if (estado.modeloSelecionado !== anterior.modeloSelecionado && estado.modeloSelecionado) alteracoes.modeloSelecionado = estado.modeloSelecionado;
        if (estado.provedorIa !== anterior.provedorIa && estado.provedorIa) alteracoes.provedorIa = estado.provedorIa;
        if (JSON.stringify(estado.retomada) !== JSON.stringify(anterior.retomada)) alteracoes.retomada = estado.retomada;
        if (JSON.stringify(estado.mensagens) !== JSON.stringify(anterior.mensagens)) alteracoes.mensagens = estado.mensagens;
        if (JSON.stringify(estado.escopos) !== JSON.stringify(anterior.escopos)) alteracoes.escopos = estado.escopos;
        if (Object.keys(alteracoes).length === 0) return;
        revisaoPainelIaRef.current += 1;
        atualizacao = {
          tipo: 'delta',
          revisao: revisaoPainelIaRef.current,
          alteracoes,
        };
      }
      ultimoEstadoPainelIaRef.current = estado;
      window.ipcAPI.ia.painelPublicar(sessionId, atualizacao);
    };
    const removerPronto = window.ipcAPI.ia.onPainelPronto(sessionId => {
      painelIaProntoRef.current = true;
      publicarEstado(sessionId, true);
    });
    const removerComando = window.ipcAPI.ia.onPainelComando((comando: ComandoPainelIa) => {
      if (!painelIaProntoRef.current) return;
      if (comando.tipo === 'executar_acao') {
        executarAcaoIaRef.current(comando.acao);
      } else if (comando.tipo === 'enviar_pedido_livre') {
        enviarMensagemIaRef.current(comando.mensagem, comando.modo, comando.tamanho);
      } else if (comando.tipo === 'perguntar_documento_completo') {
        setIaSheetSecaoIdx(-1);
        setIaSheetSecaoTitulo('Documento completo');
        setImagemSelecionadaIaId(null);
        consultarIaRef.current(comando.pergunta, undefined, -1);
      } else if (comando.tipo === 'reenviar_mensagem') {
        reenviarMensagemIaRef.current(comando.mensagemId);
      } else if (comando.tipo === 'cancelar_operacao') {
        cancelarOperacaoIaRef.current();
      } else if (comando.tipo === 'retomar_operacao') {
        retomarOperacaoIaRef.current();
      } else if (comando.tipo === 'limpar_conversa') {
        limparConversaIaRef.current();
      } else if (comando.tipo === 'descrever_imagem') {
        descreverImagemIaRef.current();
      } else if (comando.tipo === 'selecionar_escopo') {
        if (comando.indice === -1 || secoes[comando.indice]) {
          setIaSheetSecaoIdx(comando.indice);
          setIaSheetSecaoTitulo(comando.indice === -1 ? 'Documento completo' : secoes[comando.indice].titulo);
          setImagemSelecionadaIaId(null);
          setIaError(null);
        }
      } else if (comando.tipo === 'selecionar_modelo' && provedorIaSessao) {
        if (listarModelosIa(provedorIaSessao).some(item => item.id === comando.modelo)) setModeloIaSessao(comando.modelo);
      } else if (comando.tipo === 'solicitar_ressincronizacao') {
        if (sessaoPainelIaRef.current) publicarEstado(sessaoPainelIaRef.current, true);
      } else if (comando.tipo === 'aplicar_resposta') {
        const mensagem = obterMensagensVisiveis().find(item => item.id === comando.mensagemId);
        if (mensagem) aplicarRespostaIaRef.current(mensagem);
      } else if (comando.tipo === 'navegar_evidencia') {
        navegarParaEvidenciaIaRef.current(comando.evidencia);
      }
    });
    const removerReencaixar = window.ipcAPI.ia.onPainelReencaixar(sessionId => {
      if (sessionId !== sessaoPainelIaRef.current) return;
      painelIaProntoRef.current = false;
      setPainelIaDestacado(false);
      setIlustracoesPanelOpen(false);
      setIaSheetOpen(true);
      setPanelCollapsed(false);
    });
    const removerFechado = window.ipcAPI.ia.onPainelFechado(sessionId => {
      if (sessionId === sessaoPainelIaRef.current) {
        painelIaProntoRef.current = false;
        setPainelIaDestacado(false);
      }
    });
    if (sessaoPainelIaRef.current && painelIaProntoRef.current) publicarEstado(sessaoPainelIaRef.current);
    return () => { removerPronto(); removerComando(); removerReencaixar(); removerFechado(); };
  }, [avisoLimiteIa, chatMessages, estadoOperacaoIa, iaError, iaLoading, iaSheetMode, iaSheetSecaoIdx, iaSheetSecaoTitulo, imagemSelecionadaIaId, modeloIaSessao, progressoIa, progressoConsultaIa, provedorIaSessao, retomadaIaPendente, secoes, setModeloIaSessao]);

  const obterDescricaoAcaoIa = (acao: AcaoIa) => {
    const descricoes: Record<AcaoIa, string> = {
      ortografia: 'Revisar ortografia',
      tecnico_pericial: 'Adequar linguagem técnico-pericial',
      reescrever: 'Reescrever conteúdo',
      clareza: 'Melhorar clareza',
      resumir: 'Resumir conteúdo',
      expandir: 'Expandir conteúdo',
      inserir: 'Inserir conteúdo',
    };
    return descricoes[acao];
  };

  const execucaoIaPermaneceAtual = async (execucao: ExecucaoIaPreparada): Promise<boolean> => {
    const { alvo, indice } = execucao;
    const editor = obterEditorTinyMce(alvo.editorId);
    try {
      let conteudoAtual: string;
      if (alvo.tipo === 'selecao' && editor && alvo.bookmark) {
        editor.selection.moveToBookmark(alvo.bookmark);
        conteudoAtual = editor.selection.getContent({ format: 'html' });
      } else {
        conteudoAtual = editor?.getContent() || (indice === -1 ? singleEditorHtml : secoes[indice]?.conteudo || '');
      }
      return Boolean(alvo.fingerprint)
        && await calcularFingerprintIa(alvo.tipo, conteudoAtual) === alvo.fingerprint;
    } catch {
      return false;
    }
  };

  const executarPreparacaoIa = async (
    execucao: ExecucaoIaPreparada,
    planoId: string,
    retomada?: RetomadaIa,
    mensagemExistenteId?: string,
  ) => {
    if (!(await execucaoIaPermaneceAtual(execucao))) {
      setRetomadaIaPendente(null);
      setIaError('O texto foi alterado desde o planejamento. Gere uma nova solicitação para evitar aplicar uma resposta ao trecho errado.');
      return;
    }

    const operationId = crypto.randomUUID();
    const { alvo, html, indice, descricao, chatKey, protecao } = execucao;
    let mensagemId = mensagemExistenteId;
    try {
      setIaSheetMode(execucao.solicitacao.acao);
      setIaLoading(true);
      setOperacaoIaAtivaId(operationId);
      operacaoIaAtivaRef.current = operationId;
      setProgressoIa(null);
      setIaError(null);
      alvosIaRef.current.set(alvo.id, alvo);

      if (!retomada && !mensagemExistenteId) {
        const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content: descricao,
          timestamp: Date.now(),
          acao: execucao.solicitacao.acao,
          tamanhoResposta: execucao.tamanhoResposta,
        };
        mensagemId = userMsg.id;
        setChatMessages(prev => ({
          ...prev,
          [chatKey]: [...(prev[chatKey] || []), userMsg],
        }));
        execucoesIaReenviaveisRef.current.set(userMsg.id, execucao);
      }

      const r = await window.ipcAPI.ia.executar({
        ...execucao.solicitacao,
        operationId,
        planoId,
        retomadaId: retomada?.retomadaId,
      });
      if (!r.success || !r.data) {
        if (r.retomada) setRetomadaIaPendente({ retomada: r.retomada, execucao });
        else setRetomadaIaPendente(null);
        setIaError(r.retomada
          ? `${obterMensagemErroIa(r.error)} Os lotes concluídos foram preservados e podem ser retomados.`
          : obterMensagemErroIa(r.error));
        const codigo = (r.error || '').split(':')[0];
        if (codigo === 'LIMITE_REQUISICOES') setAvisoLimiteIa(obterAvisoLimiteIa(r.limiteRequisicoes));
        if (!r.retomada && mensagemId && ['SEM_CONEXAO', 'LIMITE_REQUISICOES', 'TIMEOUT', 'PROVEDOR_INDISPONIVEL'].includes(codigo)) {
          setChatMessages(prev => ({
            ...prev,
            [chatKey]: (prev[chatKey] || []).map(mensagem => (
              mensagem.id === mensagemId ? { ...mensagem, permiteReenvio: true } : mensagem
            )),
          }));
        }
        return;
      }
      setRetomadaIaPendente(null);
      setAvisoLimiteIa(null);
      if (r.data.operationId !== operationId) {
        setIaError('A resposta recebida não corresponde à solicitação atual. Tente novamente.');
        return;
      }
      const fragmentosRestaurados = protecao
        ? restaurarFragmentosIa(r.data.fragmentos, protecao)
        : r.data.fragmentos;
      if (!fragmentosRestaurados) {
        setIaError('A resposta alterou dados protegidos do laudo e foi descartada com segurança. Tente novamente; se persistir, selecione outro modelo.');
        return;
      }
      const htmlProposto = reconstruirHtmlIa(html, fragmentosRestaurados);
      if (htmlProposto && assinaturaEstruturalIa(htmlProposto) === assinaturaEstruturalIa(html)) {
        const acao = execucao.solicitacao.acao;
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: resolverTextoContextoIa(htmlProposto, mapaPlaceholdersResolvidos),
          timestamp: Date.now(),
          aplicacao: acao === 'inserir' ? 'inserir' : 'substituir',
          acao,
          alvo: { id: alvo.id, indice, conteudo: html, tipo: alvo.tipo },
          conteudoProposto: htmlProposto,
          proposalId: r.data.operationId,
        };
        setChatMessages(prev => ({
          ...prev,
          [chatKey]: [...(prev[chatKey] || []), assistantMsg],
        }));
      } else {
        setIaError('A resposta não preservou a estrutura do trecho selecionado e foi descartada. Gere novamente antes de aplicar qualquer alteração.');
      }
    } catch (e: unknown) {
      setIaError(obterMensagemErroIa(e));
    } finally {
      setIaLoading(false);
      setOperacaoIaAtivaId(atual => atual === operationId ? null : atual);
      operacaoIaAtivaRef.current = null;
      setProgressoIa(null);
    }
  };

  const executarAcaoIa = async (
    acao: AcaoIa,
    instrucao?: string,
    descricaoPersonalizada?: string,
    tamanhoResposta?: ChatMessage['tamanhoResposta'],
  ) => {
    if (retomadaIaPendente) {
      await window.ipcAPI.ia.descartarRetomada(retomadaIaPendente.retomada.retomadaId);
      setRetomadaIaPendente(null);
    }
    const alvo = capturarAlvoIa(true);
    if (!alvo) {
      setIaError('Escolha uma seção ou posicione o cursor no editor antes de usar o assistente.');
      return;
    }
    const idx = alvo.indice;
    const html = alvo.conteudo;
    const fragmentosOriginais = extrairFragmentosIa(html);
    if (!fragmentosOriginais.length) {
      setIaError('O escopo selecionado não possui texto editável para processar.');
      return;
    }
    const mascarar = await obterMascaramentoIa();
    const protecao = mascarar ? protegerFragmentosIa(fragmentosOriginais) : null;
    const descricao = descricaoPersonalizada || instrucao || obterDescricaoAcaoIa(acao);
    try {
      setIaError(null);
      alvo.fingerprint = await calcularFingerprintIa(alvo.tipo, html);
      const chatKey = idx === -1 ? SINGLE_CHAT_KEY : `secao-${idx}`;
      const solicitacao: SolicitacaoIa = {
        operationId: crypto.randomUUID(),
        acao,
        escopo: alvo.tipo,
        modelo: modeloIaSessao || undefined,
        instrucao,
        contextoResolvido: alvo.texto,
        fragmentos: protecao?.fragmentos || fragmentosOriginais,
      };
      const execucao: ExecucaoIaPreparada = { solicitacao, alvo, html, indice: idx, descricao, chatKey, protecao, tamanhoResposta };
      const planejamento = await window.ipcAPI.ia.planejar(solicitacao);
      if (!planejamento.success || !planejamento.data) {
        setIaError(obterMensagemErroIa(planejamento.error));
        return;
      }
      await executarPreparacaoIa(execucao, planejamento.data.planoId);
    } catch (e: unknown) {
      setIaError(obterMensagemErroIa(e));
    }
  };

  const retomarOperacaoIa = async () => {
    if (!retomadaIaPendente || iaLoading) return;
    await executarPreparacaoIa(
      retomadaIaPendente.execucao,
      retomadaIaPendente.retomada.planoId,
      retomadaIaPendente.retomada,
    );
  };

  const descreverImagemSelecionadaIa = async () => {
    const laudoId = editando?.id;
    if (!imagemSelecionadaIaId || !laudoId) {
      setIaError('Clique em uma imagem do laudo antes de solicitar sua descrição.');
      return;
    }
    try {
      await reconciliarImagensDoEditor();
    } catch (error: unknown) {
      setIaError(obterMensagemErro(error, 'Não foi possível vincular a imagem selecionada ao laudo.'));
      return;
    }

    const imagemId = imagemSelecionadaIaId;
    if (!imagemId) {
      setIaError('A imagem selecionada não está mais disponível. Selecione-a novamente e tente descrever.');
      return;
    }

    const operationId = crypto.randomUUID();
    const chatKey = chaveChatImagemIa(imagemId);
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: 'Descrever imagem selecionada',
      timestamp: Date.now(),
      acao: 'descrever_imagem',
    };

    try {
      setIaSheetMode(null);
      setIaLoading(true);
      setOperacaoIaAtivaId(operationId);
      setIaError(null);
      setChatMessages(prev => ({
        ...prev,
        [chatKey]: [...(prev[chatKey] || []), userMsg],
      }));

      const resposta = await window.ipcAPI.ia.descreverImagem({
        operationId,
        laudoId,
        imagemId,
      });
      const descricao = resposta.data?.descricao.trim();
      if (!resposta.success || !descricao) {
        const mensagens: Record<string, string> = {
          CONFIGURACAO_AUSENTE: 'Configure um provedor e um modelo de IA antes de descrever a imagem.',
          MODELO_INCOMPATIVEL: 'O modelo selecionado não oferece suporte à análise de imagens.',
          FORMATO_IMAGEM_NAO_SUPORTADO: 'O formato desta imagem não é suportado pelo modelo selecionado.',
          IMAGEM_MUITO_GRANDE: 'A imagem selecionada excede o limite aceito pelo provedor de IA.',
          IMAGEM_PROTEGIDA: 'A descrição de imagens exige o modo Conteúdo integral. Ajuste essa opção em Modelos de IA antes de continuar.',
          IMAGEM_NAO_VINCULADA: 'Esta imagem ainda não foi vinculada ao armazenamento do laudo. Atualize as figuras e tente novamente.',
          IMAGEM_DE_OUTRO_LAUDO: 'A imagem selecionada pertence a outro laudo. Selecione a figura correta e tente novamente.',
          RESPOSTA_VAZIA: 'A IA não retornou uma descrição para a imagem selecionada.',
          RESPOSTA_INVALIDA: 'A resposta do provedor não pôde ser interpretada como uma descrição.',
        };
        setIaError(mensagens[resposta.error || ''] || resposta.error || 'Erro ao descrever a imagem selecionada.');
        return;
      }
      if (resposta.data?.operationId !== operationId) {
        setIaError('A resposta recebida não corresponde à solicitação atual.');
        return;
      }

      setChatMessages(prev => ({
        ...prev,
        [chatKey]: (prev[chatKey] || []).map(mensagem =>
          mensagem.id === userMsg.id
            ? { ...mensagem, miniaturaDataUri: resposta.data?.miniaturaDataUri }
            : mensagem
        ),
      }));

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: descricao,
        timestamp: Date.now(),
        acao: 'descrever_imagem',
      };
      setChatMessages(prev => ({
        ...prev,
        [chatKey]: [...(prev[chatKey] || []), assistantMsg],
      }));
    } catch (error: unknown) {
      setIaError(obterMensagemErro(error, 'Erro ao descrever a imagem selecionada'));
    } finally {
      setIaLoading(false);
      setOperacaoIaAtivaId(atual => atual === operationId ? null : atual);
    }
  };

  const cancelarOperacaoIa = async () => {
    const operationId = operacaoIaAtivaId;
    if (!operationId) return;
    const resposta = await window.ipcAPI.ia.cancelar(operationId);
    if (!resposta.success) {
      setIaError(resposta.error || 'Não foi possível cancelar a operação atual.');
      return;
    }
    setIaError(null);
  };

  const inserirRespostaIa = (texto: string, alvo: AlvoIaCapturado) => {
    const htmlInsercao = tabelaMarkdownParaHtmlSeguro(texto) || converterTextoEmHtmlSeguro(texto);
    const editorDoAlvo = obterEditorTinyMce(alvo.editorId);

    if (editorDoAlvo && alvo.bookmark) {
      try {
        editorDoAlvo.selection.moveToBookmark(alvo.bookmark);
        editorDoAlvo.undoManager.transact(() => editorDoAlvo.insertContent(htmlInsercao));
        if (alvo.indice === -1) setSingleEditorHtml(editorDoAlvo.getContent());
        else atualizarConteudoSecao(alvo.indice, editorDoAlvo.getContent(), 'ia');
        registrarAlteracao();
        return;
      } catch {
        setIaError('A posição original de inserção não está mais disponível. Gere uma nova resposta antes de inserir.');
        return;
      }
    }

    if (alvo.indice === -1) {
      const editor = obterEditorTinyMce('laudo-single-editor');
      if (!editor) return;
      editor.undoManager.transact(() => editor.insertContent(htmlInsercao));
      setSingleEditorHtml(editor.getContent());
    } else {
      const editor = obterEditorTinyMce(`secao-${alvo.indice}`);
      if (editor) {
        editor.undoManager.transact(() => editor.insertContent(htmlInsercao));
        atualizarConteudoSecao(alvo.indice, editor.getContent(), 'ia');
      } else {
        const atual = secoes[alvo.indice]?.conteudo || '';
        const divisor = atual.trim() ? '<p>&nbsp;</p>' : '';
        atualizarConteudoSecao(alvo.indice, atual + divisor + htmlInsercao, 'ia');
      }
    }

    registrarAlteracao();
  };

  const substituirConteudoComRespostaIa = async (resposta: RespostaIaPendente) => {
    const { indiceAlvo } = resposta;
    const alvo = alvosIaRef.current.get(resposta.alvoId);
    if (!alvo) {
      setIaError('O alvo original desta resposta não está mais disponível. Gere uma nova resposta antes de aplicar.');
      setRespostaIaPendente(null);
      return;
    }
    const editorAtual = obterEditorTinyMce(indiceAlvo === -1 ? 'laudo-single-editor' : `secao-${indiceAlvo}`);
    if (alvo.tipo === 'selecao' && editorAtual && alvo.bookmark) {
      try {
        editorAtual.selection.moveToBookmark(alvo.bookmark);
        const conteudoSelecionado = editorAtual.selection.getContent({ format: 'html' });
        if (!alvo.fingerprint || await calcularFingerprintIa(alvo.tipo, conteudoSelecionado) !== alvo.fingerprint) {
          throw new Error('Seleção alterada');
        }
        editorAtual.undoManager.transact(() => editorAtual.insertContent(resposta.htmlProposto));
        if (indiceAlvo === -1) setSingleEditorHtml(editorAtual.getContent());
        else atualizarConteudoSecao(indiceAlvo, editorAtual.getContent(), 'ia');
        registrarAlteracao();
        setRespostaIaPendente(null);
        alvosIaRef.current.delete(resposta.alvoId);
        return;
      } catch {
        setIaError('A seleção original foi alterada ou não está mais disponível. Gere uma nova resposta antes de aplicar.');
        setRespostaIaPendente(null);
        return;
      }
    }
    const conteudoAtual = editorAtual?.getContent() || (indiceAlvo === -1 ? singleEditorHtml : secoes[indiceAlvo]?.conteudo || '');
    if (!alvo.fingerprint || await calcularFingerprintIa(alvo.tipo, conteudoAtual) !== alvo.fingerprint) {
      setIaError('O conteúdo-alvo foi alterado desde a geração da resposta. Gere uma nova resposta antes de aplicar.');
      setRespostaIaPendente(null);
      return;
    }
    const htmlSeguro = resposta.htmlProposto;
    if (indiceAlvo === -1) {
      const editor = obterEditorTinyMce('laudo-single-editor');
      if (!editor) return;
      editor.undoManager.transact(() => editor.setContent(htmlSeguro));
      setSingleEditorHtml(editor.getContent());
    } else {
      const editor = obterEditorTinyMce(`secao-${indiceAlvo}`);
      if (editor) editor.undoManager.transact(() => editor.setContent(htmlSeguro));
      atualizarConteudoSecao(indiceAlvo, htmlSeguro, 'ia');
    }

    registrarAlteracao();
    setRespostaIaPendente(null);
    alvosIaRef.current.delete(resposta.alvoId);
  };

  const handleApplyResponse = (mensagem: ChatMessage) => {
    if (!mensagem.alvo) return;
    const alvo = alvosIaRef.current.get(mensagem.alvo.id);
    if (!alvo) {
      setIaError('O alvo original desta resposta não está mais disponível. Gere uma nova resposta.');
      return;
    }
    if (mensagem.aplicacao === 'inserir') {
      setRespostaIaPendente({
        modo: 'inserir',
        texto: mensagem.content,
        htmlProposto: tabelaMarkdownParaHtmlSeguro(mensagem.content) || converterTextoEmHtmlSeguro(mensagem.content),
        conteudoAtual: '',
        conteudoProposto: mensagem.content,
        indiceAlvo: alvo.indice,
        conteudoAlvo: alvo.conteudo,
        alvoId: alvo.id,
        fragmentosPropostos: [],
      });
      return;
    }

    const editorId = mensagem.alvo.indice === -1
      ? 'laudo-single-editor'
      : `secao-${mensagem.alvo.indice}`;
    const editor = obterEditorTinyMce(editorId);
    const htmlAtual = editor?.getContent()
      || (mensagem.alvo.indice === -1
        ? singleEditorHtml
        : secoes[mensagem.alvo.indice]?.conteudo || '');
    setRespostaIaPendente({
      modo: 'substituir',
      texto: mensagem.content,
      htmlProposto: mensagem.conteudoProposto || converterTextoEmHtmlSeguro(mensagem.content),
      conteudoAtual: converterHtmlEmTexto(htmlAtual),
      conteudoProposto: converterHtmlEmTexto(mensagem.content),
      indiceAlvo: mensagem.alvo.indice,
      conteudoAlvo: mensagem.alvo.conteudo,
      alvoId: mensagem.alvo.id,
      fragmentosPropostos: extrairFragmentosIa(mensagem.conteudoProposto || converterTextoEmHtmlSeguro(mensagem.content)),
    });
  };

  const navegarParaEvidenciaIa = useCallback((evidencia: BlocoContextoIa) => {
    navegarParaEvidenciaNoEditor({
      modoEditor: editorMode,
      evidencia,
      obterEditor: obterEditorTinyMce,
      expandirSecao: indice => setSecoesColapsadas(atual => ({ ...atual, [indice]: false })),
      agendar: callback => window.setTimeout(callback, 0),
    });
  }, [editorMode]);
  navegarParaEvidenciaIaRef.current = navegarParaEvidenciaIa;

  const consultarIa = async (pergunta: string, modeloForcado?: string, escopoForcado?: -1) => {
    if (iaLoading) return;
    const alvo = capturarAlvoIa(true);
    if (!alvo || (alvo.tipo !== 'secao' && alvo.tipo !== 'laudo_completo')) {
      setIaError('Escolha uma seção ou o documento completo antes de perguntar.');
      return;
    }
    const modeloSelecionado = modeloForcado || modeloIaSessao;
    const operationId = crypto.randomUUID();
    const escopoCompleto = escopoForcado === -1 || alvo.tipo === 'laudo_completo';
    const fontes = escopoCompleto
      ? secoes.map((secao, indice) => ({ html: secao.conteudo, id: `secao-${indice}`, titulo: secao.titulo }))
      : [{ html: alvo.conteudo, id: `secao-${alvo.indice}`, titulo: iaSheetSecaoTitulo || 'Seção selecionada' }];
    const fontesResolvidas = fontes.map(fonte => ({ ...fonte, html: resolverHtmlContextoIa(fonte.html, mapaPlaceholdersResolvidos) }));
    const blocos = fontesResolvidas.flatMap((fonte, indice) => serializarBlocosContextoIa(fonte.html, fonte.id, fonte.titulo, indice * 10_000));
    if (!blocos.length) {
      setIaError('O escopo selecionado não possui conteúdo consultável.');
      return;
    }
    const fingerprint = await calcularFingerprintIa(alvo.tipo, fontes.map(fonte => fonte.html).join(''));
    const chaveMemoria = criarChaveMemoriaConsultaIa(alvo.tipo, alvo.indice, fingerprint);
    const chatKey = alvo.indice === -1 ? SINGLE_CHAT_KEY : `secao-${alvo.indice}`;
    setIaLoading(true);
    setEstadoOperacaoIa('preparando');
    setProgressoConsultaIa({ operationId, fase: 'preparando' });
    setOperacaoIaAtivaId(operationId);
    setIaError(null);
    setChatMessages(atual => ({ ...atual, [chatKey]: [...(atual[chatKey] || []), { id: crypto.randomUUID(), role: 'user', content: pergunta, timestamp: Date.now(), permiteAplicacao: false }] }));
    try {
      const resposta = await window.ipcAPI.ia.consultar({ operationId, pergunta, escopo: escopoCompleto ? 'laudo_completo' : 'secao', modelo: modeloSelecionado || undefined, fingerprint, blocos, memoria: memoriaConsultasIaRef.current.get(chaveMemoria) || [] });
      const dadosResposta: unknown = resposta.data;
      if (!resposta.success) {
        if (resposta.error === 'LIMITE_REQUISICOES') {
          setAvisoLimiteIa(obterAvisoLimiteIa(resposta.limiteRequisicoes));
        }
        throw new Error(resposta.error || 'RESPOSTA_INVALIDA');
      }
      if (!respostaConsultaIaValida(dadosResposta, blocos) || dadosResposta.operationId !== operationId) throw new Error('RESPOSTA_INVALIDA');
      const evidencias = localizarEvidenciasConsultaIa(blocos, dadosResposta.evidencias.map(evidencia => evidencia.blocoId));
      if (!evidencias) throw new Error('RESPOSTA_INVALIDA');
      memoriaConsultasIaRef.current.set(chaveMemoria, [
        ...(memoriaConsultasIaRef.current.get(chaveMemoria) || []),
        { pergunta, resposta: resposta.data.resposta },
      ].slice(-3));
      setChatMessages(atual => ({ ...atual, [chatKey]: [...(atual[chatKey] || []), {
        id: crypto.randomUUID(), role: 'assistant', content: dadosResposta.resposta, timestamp: Date.now(), acao: 'inserir', permiteAplicacao: true,
        evidencias,
        estadoConsulta: dadosResposta.estado,
        modeloConsulta: dadosResposta.modelo,
        perguntaConsulta: pergunta,
        recomendacao: dadosResposta.recomendacao,
      }] }));
      setAvisoLimiteIa(null);
      setEstadoOperacaoIa(dadosResposta.estado === 'respondida' ? 'concluido' : dadosResposta.estado);
    } catch (erro: unknown) {
      const codigo = erro instanceof Error ? erro.message.split(':')[0] : '';
      if (codigo === 'MODELO_INCOMPATIVEL' || codigo === 'CONFIGURACAO_AUSENTE') {
        const recomendado = provedorIaSessao
          ? listarModelosIa(provedorIaSessao).find(modelo => modelo.id !== modeloIaSessao)?.id
            || obterModeloPadraoIa(provedorIaSessao).id
          : null;
        setFallbackModeloIaPendente({ pergunta, codigo, modeloRecomendado: recomendado === modeloIaSessao ? null : recomendado });
      }
      setIaError(obterMensagemErroIa(erro));
      setEstadoOperacaoIa(codigo === 'CANCELADO' ? 'cancelado' : 'erro');
    } finally {
      setIaLoading(false);
      setProgressoConsultaIa(atual => atual?.operationId === operationId ? null : atual);
      setOperacaoIaAtivaId(atual => atual === operationId ? null : atual);
    }
  };

  const handleSendChatMessage = (message: string, modo: ModoInteracaoIa, tamanho: 'automatico' | 'curta' | 'media' | 'longa' = 'automatico') => {
    if (modo === 'perguntar') {
      void consultarIa(message);
      return;
    }
    const acao = modo === 'escrever' ? 'inserir' : 'reescrever';
    const instrucoesTamanho = {
      automatico: '',
      curta: ' TAMANHO OBRIGATÓRIO: responda em até 10 palavras, com tolerância máxima de 5 palavras.',
      media: ' TAMANHO OBRIGATÓRIO: responda em um único parágrafo.',
      longa: ' TAMANHO OBRIGATÓRIO: responda em 2 a 3 parágrafos.',
    } as const;
    void executarAcaoIa(acao, `${message}${instrucoesTamanho[tamanho]}`, message, tamanho);
  };

  consultarIaRef.current = (pergunta, modeloForcado, escopoForcado) => {
    void consultarIa(pergunta, modeloForcado, escopoForcado);
  };

  const reenviarMensagemIa = async (mensagemId: string) => {
    if (iaLoading) return;
    const execucao = execucoesIaReenviaveisRef.current.get(mensagemId);
    if (!execucao) return;
    setChatMessages(prev => ({
      ...prev,
      [execucao.chatKey]: (prev[execucao.chatKey] || []).map(mensagem => (
        mensagem.id === mensagemId ? { ...mensagem, permiteReenvio: false } : mensagem
      )),
    }));
    const planejamento = await window.ipcAPI.ia.planejar(execucao.solicitacao);
    if (!planejamento.success || !planejamento.data) {
      setIaError(obterMensagemErroIa(planejamento.error));
      return;
    }
    await executarPreparacaoIa(execucao, planejamento.data.planoId, undefined, mensagemId);
  };

  const gerarLegendaImagemIa = async (imagemId: string): Promise<string | null> => {
    if (!editando?.id) return null;
    const resposta = await window.ipcAPI.ia.descreverImagem({
      operationId: crypto.randomUUID(),
      laudoId: editando.id,
      imagemId,
      modo: 'legenda',
    });
    if (!resposta.success || !resposta.data?.descricao.trim()) {
      setIaError(resposta.error || 'Não foi possível gerar a legenda da figura.');
      return null;
    }
    return resposta.data.descricao.trim().replace(/\s+/g, ' ');
  };

  gerarLegendaImagemIaRef.current = gerarLegendaImagemIa;

  const limparConversaIa = () => {
    const chaveChat = imagemSelecionadaIaId
      ? chaveChatImagemIa(imagemSelecionadaIaId)
      : iaSheetSecaoIdx === -1
        ? SINGLE_CHAT_KEY
        : iaSheetSecaoIdx !== null ? `secao-${iaSheetSecaoIdx}` : null;
    if (!chaveChat) return;
    setChatMessages(atual => ({ ...atual, [chaveChat]: [] }));
    memoriaConsultasIaRef.current.clear();
    setIaError(null);
  };

  executarAcaoIaRef.current = acao => void executarAcaoIa(acao);
  enviarMensagemIaRef.current = handleSendChatMessage;
  reenviarMensagemIaRef.current = mensagemId => void reenviarMensagemIa(mensagemId);
  cancelarOperacaoIaRef.current = () => void cancelarOperacaoIa();
  retomarOperacaoIaRef.current = () => void retomarOperacaoIa();
  limparConversaIaRef.current = limparConversaIa;
  descreverImagemIaRef.current = () => void descreverImagemSelecionadaIa();
  aplicarRespostaIaRef.current = handleApplyResponse;

  function getCurrentUserId(): string {
    try {
      const raw = sessionStorage.getItem('lawdo_auth_user');
      return raw ? JSON.parse(raw)?.id ?? '' : '';
    } catch { return ''; }
  }

  const precisaSenhaParaExcluir = (status: string) =>
    status === 'Concluído' || status === 'Entregue';

  const handleAbrirExclusao = useCallback((laudo: LaudoItem) => {
    setLaudoParaExcluir(laudo);
    setSenhaExclusao('');
    setSenhaExclusaoErro('');
    setVerificandoSenhaExclusao(false);
    setPassoExclusao(precisaSenhaParaExcluir(laudo.status) ? 'senha' : 'confirmar');
    setDeleteDialogOpen(true);
  }, []);

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
    } catch (e: unknown) {
      setError(obterMensagemErro(e, 'Erro ao excluir laudo'));
    }
  };

  const atualizarStatus = useCallback(async (laudo: LaudoItem, novoStatus: string) => {
    try {
      setError(null);
      const r = await window.ipcAPI.laudo.updateStatus(laudo.id, novoStatus);
      if (r.success) {
        carregarLaudos();
      } else {
        setError(r.error || 'Erro ao atualizar status');
      }
    } catch (e: unknown) {
      setError(obterMensagemErro(e, 'Erro ao atualizar status'));
    }
  }, [carregarLaudos]);

  const handleUpdateStatus = useCallback((laudo: LaudoItem, novoStatus: string) => {
    if (novoStatus === 'Concluído' || novoStatus === 'Entregue') {
      const pendencias = identificarPendenciasConclusaoLaudo(laudo.conteudo);
      if (possuiPendenciasConclusaoLaudo(pendencias)) {
        setAtualizacaoStatusPendente({ laudo, novoStatus, pendencias });
        return;
      }
    }

    void atualizarStatus(laudo, novoStatus);
  }, [atualizarStatus]);

  const confirmarAtualizacaoStatus = useCallback(() => {
    const pendencia = atualizacaoStatusPendente;
    if (!pendencia) return;
    setAtualizacaoStatusPendente(null);
    void atualizarStatus(pendencia.laudo, pendencia.novoStatus);
  }, [atualizacaoStatusPendente, atualizarStatus]);

  const getProximoStatus = (status: string): { label: string; value: string; icon: typeof CheckCircle } | null => {
    if (status === 'Em andamento') return { label: 'Concluir', value: 'Concluído', icon: CheckCircle };
    if (status === 'Concluído') return { label: 'Entregar', value: 'Entregue', icon: Send };
    return null;
  };

  const laudoColumns = useMemo<DefinicaoColunaTabela<LaudoItem>[]>(() => [
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
        return (
          <Badge variant="outline" className={obterClasseBadgeStatusLaudo(status)}>
            {status}
          </Badge>
        );
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
        const statusBtn = getProximoStatus(laudo.status);
        return (
          <div className="flex justify-end gap-1">
            {/* Abrir editor */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (isReadonly) {
                      await handleUpdateStatus(laudo, 'Em andamento');
                      return;
                    }
                    handleEditar(laudo);
                  }}
                >
                  {isReadonly ? <RotateCcw size={14} /> : <Edit size={14} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isReadonly ? 'Reabrir para edição' : 'Abrir editor'}</TooltipContent>
            </Tooltip>

            {/* Próximo status (contextual) */}
            {statusBtn && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUpdateStatus(laudo, statusBtn.value)}
                  >
                    <statusBtn.icon size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{statusBtn.label}</TooltipContent>
              </Tooltip>
            )}

            {/* Visualizar PDF */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleListaPreview(laudo)}
                  disabled={listaPreviewLoading}
                >
                  <Eye size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Visualizar PDF</TooltipContent>
            </Tooltip>

            {/* Histórico */}
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

            {/* Wizard */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/laudos/${laudo.id}/wizard`)}
                >
                  <Wand2 size={14} className="text-violet-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Preencher via Wizard</TooltipContent>
            </Tooltip>

            {/* Excluir */}
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
  ], [handleEditar, handleUpdateStatus, handleListaPreview, listaPreviewLoading, handleAbrirExclusao, navigate]);

  // Modo editor com múltiplas seções
  if (editando) {
    const operacaoEmAndamento = salvando || carregandoPreview || exportando;
    const mensagensPainelIa = imagemSelecionadaIaId
      ? (chatMessages[chaveChatImagemIa(imagemSelecionadaIaId)] || [])
      : iaSheetSecaoIdx === -1
        ? (chatMessages[SINGLE_CHAT_KEY] || [])
        : (iaSheetSecaoIdx !== null ? chatMessages[`secao-${iaSheetSecaoIdx}`] || [] : []);
    const conteudoPainelLateral = painelLateralAtivo === 'ia' ? (
      <PainelIaErrorBoundary>
      <AssistenteIaPanel
        secaoTitulo={imagemSelecionadaIaId ? 'Imagem selecionada' : iaSheetSecaoTitulo}
        editorId={imagemSelecionadaIaId
          ? ''
          : (iaSheetSecaoIdx === -1 ? 'laudo-single-editor' : (iaSheetSecaoIdx !== null ? `secao-${iaSheetSecaoIdx}` : ''))}
        messages={mensagensPainelIa}
        onSendMessage={handleSendChatMessage}
        onLimparConversa={limparConversaIa}
        onExecutarAcao={acao => void executarAcaoIa(acao)}
        onDestacar={handleDestacarAssistenteIa}
        onRecolher={() => setPanelCollapsed(true)}
        onFechar={() => setIaSheetOpen(false)}
        onCancelarOperacao={() => void cancelarOperacaoIa()}
        onRetomarOperacao={() => void retomarOperacaoIa()}
        retomada={retomadaIaPendente?.retomada || null}
        onDescreverImagens={() => void descreverImagemSelecionadaIa()}
        onReenviarMensagem={mensagemId => void reenviarMensagemIa(mensagemId)}
        imagemSelecionada={Boolean(imagemSelecionadaIaId)}
        contextoImagem={Boolean(imagemSelecionadaIaId)}
        onNavegarEvidencia={navegarParaEvidenciaIa}
        modeloSelecionado={modeloIaSessao || undefined}
        opcoesModelo={provedorIaSessao ? listarModelosIa(provedorIaSessao).map(modelo => ({ id: modelo.id, rotulo: modelo.rotulo, perfil: modelo.perfil })) : []}
        onSelecionarModelo={modelo => setModeloIaSessao(modelo)}
        onApplyResponse={handleApplyResponse}
        modoAplicacao={iaSheetMode && iaSheetMode !== 'inserir' ? 'substituir' : 'inserir'}
        loading={iaLoading}
        progresso={progressoIa}
        progressoConsulta={progressoConsultaIa}
        escopoSelecionado={iaSheetSecaoIdx}
        error={iaError}
        avisoLimite={avisoLimiteIa}
        opcoesEscopo={[
          { id: -1, titulo: 'Documento completo' },
          ...secoes.map((secao, indice) => ({ id: indice, titulo: `${indice + 1}. Seção: ${secao.titulo}` })),
        ]}
        onSelecionarEscopo={indice => handleOpenSheet(indice, indice === -1 ? 'Documento completo' : secoes[indice]?.titulo || '')}
        onPerguntarDocumentoCompleto={pergunta => {
          setIaSheetSecaoIdx(-1);
          setIaSheetSecaoTitulo('Documento completo');
          setImagemSelecionadaIaId(null);
          void consultarIa(pergunta, undefined, -1);
        }}
      />
      </PainelIaErrorBoundary>
    ) : painelLateralAtivo === 'ilustracoes' ? (
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
        onRecolher={() => setPanelCollapsed(true)}
        onFechar={() => setIlustracoesPanelOpen(false)}
        onReplaceImage={panelCallbacksRef.current.onReplaceImage}
        onGerarLegenda={gerarLegendaImagemIa}
        figuraSubstituicaoSolicitada={figuraSubstituicaoSolicitada}
        onFiguraSubstituicaoSolicitadaConsumida={() => setFiguraSubstituicaoSolicitada(null)}
      />
    ) : null;

    return (
      <TooltipProvider>
        <div className="flex w-full flex-col gap-4 px-4 pb-4 md:px-8 md:pb-6">
        <CabecalhoEditorLaudo
          repNumero={editando.rep_numero}
          tipoExameCodigo={editando.tipo_exame_codigo}
          tipoExameNome={editando.tipo_exame_nome}
          status={editando.status}
          estadoSalvamento={estadoSalvamento}
          operacaoEmAndamento={operacaoEmAndamento}
          carregandoPreview={carregandoPreview}
          exportando={exportando}
          libreOfficeDisponivel={libreOfficeDisponivel}
          onVoltar={handleVoltar}
          onIrAoFinal={handleIrAoFinal}
          onVisualizar={handlePreview}
          onExportar={formato => void handleExportar(formato)}
          onSalvar={() => void handleSalvar()}
        />

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {success && <Alert><AlertDescription>{success}</AlertDescription></Alert>}

        <Card className="flex flex-col overflow-visible">
          <CardHeader className="flex-shrink-0 pb-4">
            <div>
              <CardTitle className="text-lg">Laudo pericial</CardTitle>
              <CardDescription>
                Template: {editando.template_nome || 'Não definido'} &middot; iniciado em {formatarData(editando.data_inicio)}
                {editando.data_conclusao ? ` · concluído em ${formatarData(editando.data_conclusao)}` : ''}
              </CardDescription>
            </div>
            <BarraEditorLaudo
              modoConteudo={modoVisualizacaoPlaceholders}
              modoOrganizacao={editorMode}
              onModoConteudoChange={setModoVisualizacaoPlaceholders}
              onModoOrganizacaoChange={handleEditorModeChange}
            />
          </CardHeader>
          <CardContent className="overflow-visible p-0 px-6 pb-6">
            <PainelLateralRedimensionavel
              tipo={painelLateralAtivo}
              chavePersistencia={painelLateralAtivo === 'ilustracoes'
                ? 'lawdo:laudo:painel-ilustracoes:largura:v1'
                : 'lawdo:laudo:painel-ia:largura:v1'}
              larguraPadrao={painelLateralAtivo === 'ilustracoes' ? 380 : 460}
              larguraMinima={painelLateralAtivo === 'ilustracoes' ? 320 : 360}
              larguraMaxima={painelLateralAtivo === 'ilustracoes' ? 720 : 640}
              recolhido={panelCollapsed}
              iaDestacada={painelIaDestacado}
              ilustracoesEmJanela={panelPoppedOut}
              operacaoEmAndamento={operacaoEmAndamento}
              onAlternarPainelIa={() => {
                if (painelIaDestacado && sessaoPainelIaRef.current) {
                  window.ipcAPI.ia.painelAbrir(sessaoPainelIaRef.current)
                  return
                }
                if (iaSheetOpen) {
                  if (panelCollapsed) setPanelCollapsed(false)
                  else setIaSheetOpen(false)
                  return
                }
                handleAbrirAssistenteIa()
              }}
              onAlternarPainelIlustracoes={() => {
                if (iluminacoesPanelOpen && panelCollapsed) {
                  setPanelCollapsed(false)
                  return
                }
                handleToggleIlustracoes()
              }}
              onReindexarSecoes={handleReindexarSecoes}
              onRecolherAutomaticamente={() => setPanelCollapsed(true)}
              conteudoPainel={conteudoPainelLateral}
            >
              <div data-diagnostico-id="laudos.editor-scroll" className="pr-2 [overflow-anchor:none]">
                {quantidadeBlocosSuprimidos > 0 && (
                  <Alert className="mb-3">
                    <AlertDescription className="flex items-center justify-between gap-3">
                      <span>{quantidadeBlocosSuprimidos} bloco(s) pericial(is) suprimido(s). Eles não serão exportados.</span>
                      <Button variant="outline" size="sm" onClick={restaurarBlocosSuprimidos}>Restaurar blocos</Button>
                    </AlertDescription>
                  </Alert>
                )}
                {editorMode === 'single' ? (
                  <div className="min-w-0 space-y-3 pb-4">
                    <PlaceholderContextMenu editorId="laudo-single-editor" categorias={categorias} placeholders={placeholders} onInsertPlaceholder={inserirPlaceholder} exameMenuStructure={exameMenuStructure} exameCamposEspecificos={exameCamposEspecificos} categoriaExameId={categoriaExameId}>
                      <TinyMceEditor
                        editorId="laudo-single-editor"
                        initialValue={singleEditorHtml}
                        onChange={(html: string, origem) => {
                          registrarAlteracao(origem);
                          setSingleEditorHtml(html);
                        }}
                        height={560}
                        alturaAutomatica
                        placeholder="Edite o laudo completo..."
                        laudoId={editando.id}
                        repNumero={editando.rep_numero}
                        onImageInserted={() => {
                          void reconciliarImagensDoEditor().catch(error => {
                            toast.error(obterMensagemErro(error, 'Não foi possível vincular a imagem inserida ao laudo.'));
                          });
                        }}
                        placeholderChaves={placeholderChaves}
                        condToggles={exameToggles}
                        onEditorInit={(editor) => {
                          aplicarModoNoEditor(editor);
                          registrarEditorIa(editor);
                        }}
                        onSolicitarSupressaoBloco={setBlocoParaSuprimir}
                        onDummyFigureClick={(imageId) => {
                          setFiguraSubstituicaoSolicitada(imageId);
                          setIaSheetOpen(false);
                          setIlustracoesPanelOpen(true);
                          setPanelCollapsed(false);
                        }}
                      />
                    </PlaceholderContextMenu>
                  </div>
                ) : (
                  <div className="min-w-0 space-y-6 pb-4">
                    {secoes.map((secao, idx) => {
                      const isIlustracoes = secao.titulo.trim().toUpperCase() === 'ILUSTRAÇÕES';
                      const tituloVisual = secao.nivel === 2 ? 'Seção principal' : 'Subseção';
                      return (
                      <Collapsible
                        key={isIlustracoes ? `ilus-${ilustracoesKey}` : idx}
                        open={!secoesColapsadas[idx]}
                        onOpenChange={(open) => setSecoesColapsadas(prev => ({ ...prev, [idx]: !open }))}
                        className={cn(
                          'min-w-0 max-w-full rounded-lg',
                          getClasseSecaoEstrutural(secao),
                          secao.nivel === 3 && 'ml-5'
                        )}
                      >
                        <div className="flex min-w-0 items-center justify-between p-4 cursor-default">
                          <CollapsibleTrigger asChild>
                            <div className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer">
                              <div className="p-2 rounded-full bg-primary/10 text-primary">
                                <Edit size={18} />
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-lg font-semibold">{secao.titulo}</h3>
                                <p className="text-sm text-muted-foreground">{tituloVisual} · clique para expandir/recolher</p>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                        </div>
                        <CollapsibleContent className="p-4 border-t" forceMount>
                          <PlaceholderContextMenu editorId={`secao-${idx}`} categorias={categorias} placeholders={placeholders} onInsertPlaceholder={inserirPlaceholder} exameMenuStructure={exameMenuStructure} exameCamposEspecificos={exameCamposEspecificos} categoriaExameId={categoriaExameId}>
                            <div className={isIlustracoes ? 'relative' : ''}>
                              <TinyMceEditor
                                editorId={`secao-${idx}`}
                                initialValue={secao.conteudo}
                                onChange={(txt, origem) => atualizarConteudoSecao(idx, txt, origem)}
                                height={400}
                                alturaAutomatica
                                laudoId={editando.id}
                                repNumero={editando.rep_numero}
                                onImageInserted={() => {
                                  void reconciliarImagensDoEditor().catch(error => {
                                    toast.error(obterMensagemErro(error, 'Não foi possível vincular a imagem inserida ao laudo.'));
                                  });
                                }}
                                placeholderChaves={placeholderChaves}
                                onEditorInit={(editor) => {
                                  aplicarModoNoEditor(editor);
                                  registrarEditorIa(editor);
                                  if (isIlustracoes) handleIlustracoesEditorInit(editor);
                                }}
                                condToggles={exameToggles}
                                onSolicitarSupressaoBloco={setBlocoParaSuprimir}
                                onDummyFigureClick={(imageId) => {
                                  setFiguraSubstituicaoSolicitada(imageId);
                                  setIaSheetOpen(false);
                                  setIlustracoesPanelOpen(true);
                                  setPanelCollapsed(false);
                                }}
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
                <RodapeEditorLaudo
                  estadoSalvamento={estadoSalvamento}
                  operacaoEmAndamento={operacaoEmAndamento}
                  onVoltar={handleVoltar}
                  onVoltarAoTopo={handleVoltarAoTopo}
                  onSalvar={() => void handleSalvar()}
                />
              </div>
            </PainelLateralRedimensionavel>
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
              <Button variant="outline" onClick={() => baixarPdfVisualizado(previewBlobUrl, nomeArquivoPreview)} disabled={!previewBlobUrl}>
                <Download className="mr-2 h-4 w-4" />
                Baixar PDF
              </Button>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>

        <DialogoAplicarRespostaIa
          open={respostaIaPendente !== null}
          modo={respostaIaPendente?.modo}
          secaoTitulo={iaSheetSecaoTitulo || 'Seção atual'}
          conteudoAtual={respostaIaPendente?.conteudoAtual || ''}
          conteudoProposto={respostaIaPendente?.conteudoProposto || ''}
          fragmentosPropostos={respostaIaPendente?.fragmentosPropostos || []}
          onAlterarFragmento={(id, texto) => {
            setRespostaIaPendente(atual => {
              if (!atual) return atual;
              const fragmentosPropostos = atual.fragmentosPropostos.map(fragmento => (
                fragmento.id === id ? { ...fragmento, texto } : fragmento
              ));
              const htmlProposto = reconstruirHtmlIa(atual.conteudoAlvo, fragmentosPropostos);
              if (!htmlProposto || assinaturaEstruturalIa(htmlProposto) !== assinaturaEstruturalIa(atual.conteudoAlvo)) {
                setIaError('A edição não preservou a estrutura da proposta e foi descartada.');
                return atual;
              }
              return {
                ...atual,
                fragmentosPropostos,
                htmlProposto,
                conteudoProposto: converterHtmlEmTexto(htmlProposto),
              };
            });
          }}
          onOpenChange={open => {
            if (!open) setRespostaIaPendente(null);
          }}
          onConfirmar={() => {
            if (!respostaIaPendente) return;
            if (respostaIaPendente.modo === 'inserir') {
              const alvo = alvosIaRef.current.get(respostaIaPendente.alvoId);
              if (!alvo) {
                setIaError('A posição original de inserção não está mais disponível. Gere uma nova resposta antes de inserir.');
                setRespostaIaPendente(null);
                return;
              }
              inserirRespostaIa(respostaIaPendente.texto, alvo);
              setRespostaIaPendente(null);
              return;
            }
            void substituirConteudoComRespostaIa(respostaIaPendente);
          }}
        />

        <AlertDialog open={fallbackModeloIaPendente !== null} onOpenChange={aberto => {
          if (!aberto) setFallbackModeloIaPendente(null);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Escolha como continuar com a IA</AlertDialogTitle>
              <AlertDialogDescription>
                {fallbackModeloIaPendente?.codigo === 'MODELO_REMOVIDO'
                  ? 'O modelo selecionado não está mais disponível no provedor.'
                  : fallbackModeloIaPendente?.codigo === 'MODELO_INCOMPATIVEL'
                    ? 'O modelo selecionado não é compatível com esta solicitação.'
                    : 'A configuração do modelo ou da chave precisa de atenção antes de continuar.'}
                {' '}A pergunta e o escopo foram preservados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:flex-wrap">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button type="button" variant="outline" onClick={() => setFallbackModeloIaPendente(null)}>
                Selecionar outro modelo
              </Button>
              <Button type="button" variant="outline" onClick={() => {
                setFallbackModeloIaPendente(null);
                navigate('/modelos-ia');
              }}>
                Abrir configurações
              </Button>
              {fallbackModeloIaPendente?.modeloRecomendado && (
                <AlertDialogAction onClick={() => {
                  const pendencia = fallbackModeloIaPendente;
                  if (!pendencia?.modeloRecomendado) return;
                  setFallbackModeloIaPendente(null);
                  setModeloIaSessao(pendencia.modeloRecomendado);
                  void consultarIa(pendencia.pergunta, pendencia.modeloRecomendado);
                }}>
                  Reenviar com o modelo recomendado
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={dialogoSaidaAberto} onOpenChange={setDialogoSaidaAberto}>
        <AlertDialogContent
          className="max-w-xl"
          onOpenAutoFocus={evento => {
            evento.preventDefault();
            salvarAntesDeVoltarRef.current?.focus();
          }}
        >
            <AlertDialogHeader>
              <AlertDialogTitle>Salvar antes de voltar?</AlertDialogTitle>
              <AlertDialogDescription>
                Há alterações no laudo que ainda não foram salvas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel className="h-11 min-w-40 whitespace-nowrap">Continuar editando</AlertDialogCancel>
            <AlertDialogAction className="h-11 min-w-40 whitespace-nowrap bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={finalizarVolta}>
              Voltar sem salvar
            </AlertDialogAction>
            <AlertDialogAction ref={salvarAntesDeVoltarRef} className="h-11 min-w-28 whitespace-nowrap" onClick={() => {
              void handleSalvar().then(salvou => {
                  if (salvou) finalizarVolta();
                  else setDialogoSaidaAberto(true);
                });
              }}>
              Salvar
            </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      </TooltipProvider>
    );
  }

  // Modo lista
  return (
    <div className="w-full px-4 md:px-8 py-4 md:py-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Laudos</h1>
          <p className="text-muted-foreground mt-1">Escreva e edite os laudos periciais usando os templates cadastrados</p>
        </div>
      </div>

      <Tabs value={tabFiltro} onValueChange={setTabFiltro} className="w-full">
        <TabsList className="w-full h-auto bg-transparent p-0 gap-3 flex mb-4">
          <TabsTrigger value="todos" className={pillVariant('todos')}>
            {tabFiltro !== 'todos' && <span className={dotClasses('todos')} />}
            Todos
            <span className={badgePill('todos')}>{contagem.todos}</span>
          </TabsTrigger>
          <TabsTrigger value="em_andamento" className={pillVariant('em_andamento')}>
            <span className={dotClasses('em_andamento')} />
            Em andamento
            <span className={badgePill('em_andamento')}>{contagem.em_andamento}</span>
          </TabsTrigger>
          <TabsTrigger value="concluidos" className={pillVariant('concluidos')}>
            <span className={dotClasses('concluidos')} />
            Concluídos
            <span className={badgePill('concluidos')}>{contagem.concluidos}</span>
          </TabsTrigger>
          <TabsTrigger value="entregues" className={pillVariant('entregues')}>
            <span className={dotClasses('entregues')} />
            Entregues
            <span className={badgePill('entregues')}>{contagem.entregues}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>{tituloTab[tabFiltro]}</CardTitle>
          <CardDescription>{laudosFiltrados.length} laudo(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {filtroDashboard.size > 0 && <div className="mb-4 flex items-center justify-between rounded-md border border-primary/20 bg-accent/60 p-3 text-sm"><span>Filtro aplicado pelo dashboard.</span><Button variant="outline" size="sm" onClick={() => navigate('/laudos')}>Limpar filtro</Button></div>}
          {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
          {success && <Alert className="mb-4 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900/50"><AlertDescription className="text-green-800 dark:text-green-400">{success}</AlertDescription></Alert>}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <DataTable
              columns={laudoColumns}
              data={laudosFiltrados}
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

      <AlertDialog open={atualizacaoStatusPendente !== null} onOpenChange={aberto => {
        if (!aberto) setAtualizacaoStatusPendente(null);
      }}>
        <AlertDialogContent className="max-w-2xl gap-5">
          <AlertDialogHeader className="space-y-1">
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              <CircleAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Há revisões a fazer
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <Alert className="border-amber-200 bg-amber-50 py-3 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
                  <AlertDescription className="text-center">
                    Revise as pendências abaixo antes de {atualizacaoStatusPendente?.novoStatus === 'Entregue' ? 'entregá-lo' : 'concluí-lo'}.
                  </AlertDescription>
                </Alert>
                <div className="overflow-hidden rounded-md border">
                  <Table className="text-sm">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="h-10 px-3">Seção</TableHead>
                        <TableHead className="h-10 whitespace-nowrap px-3 text-center">Padrão XXX</TableHead>
                        <TableHead className="h-10 whitespace-nowrap px-3 text-center">Figura-modelo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {atualizacaoStatusPendente?.pendencias.secoes.map((secao, indice) => (
                        <TableRow key={`${secao.titulo}-${indice}`}>
                          <TableCell className="p-3 font-medium">{secao.titulo}</TableCell>
                          <TableCell className="whitespace-nowrap p-3 text-center">{secao.camposReservados || '—'}</TableCell>
                          <TableCell className="whitespace-nowrap p-3 text-center">{secao.figurasDummy || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarAtualizacaoStatus}>
              {atualizacaoStatusPendente?.novoStatus === 'Entregue' ? 'Entregar mesmo assim' : 'Concluir mesmo assim'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <AlertDialog open={blocoParaSuprimir !== null} onOpenChange={(open) => {
        if (!open) setBlocoParaSuprimir(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suprimir bloco pericial?</AlertDialogTitle>
            <AlertDialogDescription>
              O bloco de {blocoParaSuprimir?.tipo === 'coleta' ? 'Coleta de Padrões Balísticos' : 'Funcionamento e Eficiência'}{blocoParaSuprimir?.armaIndice ? ` da Arma ${String.fromCharCode(64 + blocoParaSuprimir.armaIndice)}` : ''} não será exportado. Você poderá restaurá-lo antes de salvar o laudo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarSupressaoBloco}>Suprimir bloco</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {timelineLaudo && (
        <RepTimelineDialog
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
          repId={timelineLaudo.rep_id}
          repNumero={timelineLaudo.rep_numero}
        />
      )}

      {/* Preview PDF da lista */}
      <Dialog open={listaPreviewOpen} onOpenChange={(open) => {
        if (!open && listaPreviewBlobUrl) {
          URL.revokeObjectURL(listaPreviewBlobUrl);
          setListaPreviewBlobUrl('');
        }
        setListaPreviewOpen(open);
      }}>
        <DialogContent className="max-w-[90vw] w-[1000px] h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Pré-visualização do Laudo (PDF)
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-slate-100 dark:bg-slate-800">
            {listaPreviewLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Gerando PDF...
              </div>
            ) : (
              <iframe
                src={listaPreviewBlobUrl}
                className="w-full h-full border-0"
                title="Preview PDF"
              />
            )}
          </div>
          <div className="p-4 border-t flex justify-end gap-2 bg-background">
            <Button variant="outline" onClick={() => baixarPdfVisualizado(listaPreviewBlobUrl, nomeArquivoListaPreview)} disabled={!listaPreviewBlobUrl}>
              <Download className="mr-2 h-4 w-4" />
              Baixar PDF
            </Button>
            <Button variant="outline" onClick={() => setListaPreviewOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};
