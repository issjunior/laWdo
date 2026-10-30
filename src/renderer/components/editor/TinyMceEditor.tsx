import { permiteEdicaoCampo } from '@/lib/politica-edicao-conteudo';
import { registrarPreparacaoConteudo } from '@/lib/preparacao-conteudo-editor';
import { registrarConteudoInterativo } from '@/lib/conteudo-interativo';
import { useConfirmacaoConteudo } from './ConfirmacaoConteudo';
import { registrarSeletoresTabela, type SessaoSeletorTabela } from '@/lib/seletores-tabela-laudo';
import { SeletorTabelaLaudo } from './SeletorTabelaLaudo';
import React, { useRef, useState, useEffect, useId, useLayoutEffect, useCallback } from 'react';
import type { EventoEditorLaudo } from '@shared/diagnostico/contratos';
import { registrarDiagnosticoEditorLaudo } from '@/lib/diagnostico-editor-laudo';
import { agruparAlteracoesEditorLaudo, instrumentarLeiturasEditorLaudo } from '@/lib/sincronizacao-editor-laudo';
import { Editor } from '@tinymce/tinymce-react';
import type { Editor as TinyMceEditorInstance, RawEditorOptions, Ui } from 'tinymce';
import { placeholderChaveEhValida } from '@/lib/utils';
import {
  sincronizarAcoesBlocosCondicionais,
} from '@/lib/blocos-periciais';
import { encontrarCampoReservado } from '@/lib/campos-reservados';
import { ESTILO_TIPOGRAFIA_EDITOR_LAUDO } from '@/lib/tipografia-editor-laudo';
import { ESTILOS_TABELAS_BALISTICA } from '@shared/utils/tabelas-balistica-layout';
import { MEDIDAS_RECUO_PRIMEIRA_LINHA } from '@/lib/recuo-editor-laudo';
export { MEDIDAS_RECUO_PRIMEIRA_LINHA } from '@/lib/recuo-editor-laudo';
import { registrarSeletoresCamposB601 } from '@/lib/b601-campos-projetil';
import { registrarColetaB601 } from '@/lib/b601-coleta';
import { registrarMenuPreenchimentoB601 } from '@/lib/menu-preenchimento-b601';
import { MARCADOR_QUEBRA_PAGINA } from '@shared/utils/quebra-pagina';
import { criarHtmlFigura, URL_FIGURA_DUMMY } from '@shared/figura/html';
import { atualizarNumeroFigura } from '@/lib/figuras';
import {
  aplicarRecuoPrimeiraLinha,
  aplicarEspacamentoParagrafo,
  obterEspacamentoSelecionado,
  VALORES_ESPACAMENTO_PARAGRAFO,
  FORMATOS_LIMPEZA_EDITOR,
  limparFormatacaoEditor,
  obterRecuoSelecionado,
  recuoCorresponde,
} from './editor-formatacao';

/* ─── Funções utilitárias para figuras (modularizadas / DRY) ─── */

/** Markup interno da figura (sem <br> ao final) — usado para criar elementos DOM */
function buildFigureInnerHtml(url: string, id: string, legenda: string): string {
  return criarHtmlFigura(url, id, legenda);
}

/** Markup completo da figura com <br> ao final — ideal para insertContent */
function buildFigureHtml(url: string, id: string, legenda: string): string {
  return buildFigureInnerHtml(url, id, legenda) + '<br>';
}

function imagemEhMarcadorQuebraPagina(img: HTMLImageElement): boolean {
  return img.classList.contains('mce-pagebreak');
}

function imagemEhTemporariaEditor(img: HTMLImageElement): boolean {
  return Boolean(img.closest('[data-mce-bogus="all"], .mce-clonedresizable'));
}

/** Converte um <img> órfão em um elemento <figure class="laudo-figure"> com id e figcaption */
function wrapImgAsFigure(img: HTMLImageElement): HTMLElement {
  const id = crypto.randomUUID();
  const template = document.createElement('template');
  template.innerHTML = buildFigureInnerHtml(img.src, id, img.alt || '').trim();
  return template.content.firstElementChild as HTMLElement;
}

/**
 * Varre um nó-fragmento e converte <img>s órfãos (fora de .laudo-figure)
 * em figuras estruturadas. Retorna quantos foram convertidos.
 */
function processarImagensPuras(raiz: Node): number {
  let count = 0;
  if (!(raiz instanceof Element) && !(raiz instanceof DocumentFragment)) return count;

  const imagens = Array.from(
    (raiz as Element).querySelectorAll?.('img') ?? []
  );

  for (const img of imagens) {
    const htmlImg = img as HTMLImageElement;
    if (htmlImg.closest('.laudo-figure') || imagemEhMarcadorQuebraPagina(htmlImg) || imagemEhTemporariaEditor(htmlImg)) continue;
    if (!htmlImg.src || (!htmlImg.src.startsWith('data:') && !htmlImg.src.startsWith('http') && !htmlImg.src.startsWith('blob:'))) continue;

    const figure = wrapImgAsFigure(htmlImg);
    htmlImg.parentNode?.replaceChild(figure, htmlImg);
    count++;
  }

  return count;
}

/** Varre o body do editor e converte todos os <img>s órfãos em figuras laudo-figure */
function scanEditorForRawImages(editor: TinyMceEditorInstance): number {
  const body = editor.getBody();
  if (!body) return 0;

  const rawImages = Array.from(body.querySelectorAll('img')).filter(
    (img) =>
      !img.closest('.laudo-figure') &&
      !imagemEhMarcadorQuebraPagina(img) &&
      !imagemEhTemporariaEditor(img) &&
      (img.src?.startsWith('data:') || img.src?.startsWith('http') || img.src?.startsWith('blob:'))
  ) as HTMLImageElement[];

  if (rawImages.length === 0) return 0;

  editor.undoManager.transact(() => {
    for (const img of rawImages) {
      const figure = wrapImgAsFigure(img);
      img.parentNode?.replaceChild(figure, img);
    }
  });

  return rawImages.length;
}

// ─── Injeção dinâmica de skin dark para o chrome do editor ───
function ensureDarkSkin() {
  if (document.getElementById('tinymce-dark-skin')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './tinymce/skins/ui/oxide-dark/skin.css';
  link.id = 'tinymce-dark-skin';
  document.head.appendChild(link);
}

function removeDarkSkin() {
  document.getElementById('tinymce-dark-skin')?.remove();
}

function aplicarTemaEditor(editor: TinyMceEditorInstance, dark: boolean) {
  const body = editor.getBody();
  if (!body) return;
  if (dark) {
    ensureDarkSkin();
    editor.dom.addClass(body, 'dark-content');
  } else {
    removeDarkSkin();
    editor.dom.removeClass(body, 'dark-content');
  }
}

function obterEstilosIndicadoresSecao(): string {
  const estilos: string[] = [];
  const visitar = (regras: CSSRuleList) => {
    for (const regra of Array.from(regras)) {
      if (regra instanceof CSSStyleRule && regra.selectorText.includes('.indicador-secao')) {
        estilos.push(regra.cssText);
      } else if ('cssRules' in regra) {
        visitar((regra as CSSGroupingRule).cssRules);
      }
    }
  };
  for (const folha of Array.from(document.styleSheets)) {
    try { visitar(folha.cssRules); } catch { continue; }
  }
  return estilos.join('\n');
}

export interface BlocoCondicionalSelecionado {
  editorId: string;
  instanciaId: string;
  titulo: string;
  resumo: string;
  armaIndice?: number;
}

interface TinyMceEditorProps {
  /** Modo controlado: conteúdo sincronizado com estado React. Pode causar salto de cursor com HTML complexo. Use initialValue para evitar. */
  value?: string;
  /** Modo NÃO controlado: conteúdo inicial fixo, sem sincronização automática. Ideal para editores com HTML complexo (ex: seções). */
  initialValue?: string;
  onChange: (html: string, origem?: 'usuario' | 'normalizacao-inicial') => void;
  agruparAlteracoes?: boolean;
  onAlteracaoPendente?: () => void;
  somenteLeitura?: boolean;
  diagnosticoLaudo?: Pick<EventoEditorLaudo, 'sessao' | 'montagem' | 'modo'>;
  height?: number;
  /** Faz o editor crescer junto com o documento, deixando a rolagem a cargo da página. */
  alturaAutomatica?: boolean;
  placeholder?: string;
  /** ID do laudo para upload de imagens. Se ausente, usa base64 (templates/cabeçalho). */
  laudoId?: string;
  /** Número da REP exibido somente acima da toolbar no modo tela cheia. */
  repNumero?: string;
  /** ID único para a instância do editor (necessário com múltiplos editores na mesma página) */
  editorId?: string;
  /** Callback disparado quando uma imagem é inserida via botão de imagem do editor */
  onImageInserted?: () => void;
  onSolicitarInsercaoFigura?: (editor: TinyMceEditorInstance) => void;
  /** Lista de chaves de placeholder válidas para auto-conversão ao digitar {{chave}} */
  placeholderChaves?: string[];
  /** Callback disparado quando o editor termina de inicializar */
  onEditorInit?: (editor: TinyMceEditorInstance) => void | Promise<void>;
  onFalhaInicializacao?: () => void;
  /** Solicita a substituição de uma figura dummy pelo fluxo de ilustrações do laudo. */
  onDummyFigureClick?: (imageId: string) => void;
  onFiguraRealClick?: () => void;
  onSolicitarBusca?: () => void;
  /** Auto-converter "XXX" digitado em span campo-reservado (apenas templates) */
  autoConverterReservados?: boolean;
  /** Toggles condicionais para o botão "Bloco Condicional" na toolbar (ex: B-602) */
  condToggles?: Array<{ id: string; label: string; subtitulo?: string; subToggles?: Array<{ id: string; label: string; subtitulo?: string }> }>;
  /** Solicita a exclusão confirmada de uma ocorrência exata de bloco condicional. */
  onSolicitarExclusaoBlocoCondicional?: (bloco: BlocoCondicionalSelecionado) => void;
  /** Reaplica a visualização de placeholders após restaurar uma tabela vinculada. */
  onTabelaPlaceholderRestaurada?: (editor: TinyMceEditorInstance) => void;
  onEstruturaTabelasAlterada?: () => void;
  onCampoReservadoDuploClique?: (campo: CampoReservadoSelecionado) => void;
}

export interface CampoReservadoSelecionado {
  editorId: string;
  elemento: HTMLElement;
}

type ToggleCondicionalFlat = { id: string; label: string; subtitulo?: string };
type UploadImagemHandler = NonNullable<RawEditorOptions['images_upload_handler']>;
type PastePostprocessHandler = NonNullable<RawEditorOptions['paste_postprocess']>;
type FilePickerHandler = NonNullable<RawEditorOptions['file_picker_callback']>;
type OpcoesAlturaEditor = Pick<RawEditorOptions, 'resize'>
  & Partial<Pick<RawEditorOptions, 'height' | 'min_height' | 'autoresize_bottom_margin'>>;
type TinymceWindow = Window & {
  tinymce?: {
    get: (id?: string) => TinyMceEditorInstance | null;
  };
};

export function criarChaveMontagemEditor(editorId: string, versao: number): string {
  return `${editorId}-${versao}`;
}
type ComandoTinyMce<T> = (_ui: boolean, data: T) => void;

const CLASSE_IDENTIFICACAO_FULLSCREEN = 'laudo-identificacao-fullscreen';
const TEMPO_LIMITE_INICIALIZACAO_MS = 8_000;
const MAX_TENTATIVAS_AUTOMATICAS = 2;

export function removerInstanciaTinyMceAnterior(editorId: string): boolean {
  const editorAnterior = (window as TinymceWindow).tinymce?.get(editorId);
  if (!editorAnterior) return false;

  try {
    editorAnterior.remove();
    return true;
  } catch {
    return false;
  }
}

export function obterRotuloIdentificacaoFullscreen(repNumero?: string): string | null {
  const numeroNormalizado = repNumero?.trim();
  return numeroNormalizado ? `Laudo · REP ${numeroNormalizado}` : null;
}

export function sincronizarIdentificacaoFullscreen(
  container: HTMLElement,
  emTelaCheia: boolean,
  repNumero?: string,
): void {
  const identificacaoExistente = container.querySelector<HTMLElement>(`.${CLASSE_IDENTIFICACAO_FULLSCREEN}`);
  const rotulo = emTelaCheia ? obterRotuloIdentificacaoFullscreen(repNumero) : null;

  if (!rotulo) {
    identificacaoExistente?.remove();
    return;
  }

  const areaEdicao = container.querySelector<HTMLElement>('.tox-edit-area');
  if (!areaEdicao) return;

  const areaUtil = areaEdicao.closest<HTMLElement>('.tox-sidebar-wrap') ?? areaEdicao;

  const identificacao = identificacaoExistente ?? document.createElement('div');
  identificacao.className = CLASSE_IDENTIFICACAO_FULLSCREEN;
  identificacao.setAttribute('role', 'status');
  identificacao.textContent = rotulo;

  if (!identificacaoExistente) {
    areaUtil.before(identificacao);
  }
}

interface PlaceholderPayload {
  chave: string;
  identificadorInsercao?: string;
}

interface ImagemLaudoPayload {
  url: string;
  id: string;
  legenda: string;
  previa?: boolean;
}

async function converterBlobImagemParaDataUri(url: string): Promise<string> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error('Não foi possível ler a imagem colada.');
  const blob = await resposta.blob();
  return await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem colada.'));
    leitor.readAsDataURL(blob);
  });
}

interface RemoverImagemPayload {
  id: string;
}

interface SubstituirImagemPayload {
  imageId?: string;
  newImageId?: string;
  figureElement?: HTMLElement;
  newUrl: string;
  imagemOrigemId?: string;
  previa?: boolean;
}

const BLOCOS_CONDICIONAIS_B602_POR_ARMA = [
  { id: 'b602_arma_N_funcionamento_eficiencia_v2', label: 'Arma (N) - Funcionamento e Eficiência', subtitulo: 'FUNCIONAMENTO E EFICIÊNCIA' },
  { id: 'b602_arma_N_coleta_padroes_v2', label: 'Arma (N) - Coleta de Padrões Balísticos', subtitulo: 'COLETA DE PADRÕES BALÍSTICOS' },
];

const BADGE_BLOCO_CONDICIONAL = 'Bloco condicional';
const PLUGINS_TINYMCE = [
  'autolink',
  'charmap',
  'image',
  'link',
  'lists',
  'searchreplace',
  'table',
  'visualblocks',
  'wordcount',
  'fullscreen',
  'nonbreaking',
  'pagebreak',
];

const FONTES_EDITOR = [
  { texto: 'Arial', familia: 'Arial, Helvetica, sans-serif' },
  { texto: 'Calibri', familia: 'Calibri, Carlito, sans-serif' },
  { texto: 'Georgia', familia: 'Georgia, serif' },
  { texto: 'Times New Roman', familia: 'Times New Roman, Times, serif' },
  { texto: 'Verdana', familia: 'Verdana, Geneva, sans-serif' },
] as const;

const FORMATOS_BLOCO_EDITOR = [
  { texto: 'Parágrafo', formato: 'p' },
  { texto: 'Título 1', formato: 'h1' },
  { texto: 'Título 2', formato: 'h2' },
  { texto: 'Título 3', formato: 'h3' },
  { texto: 'Título 4', formato: 'h4' },
  { texto: 'Título 5', formato: 'h5' },
  { texto: 'Título 6', formato: 'h6' },
  { texto: 'Pré-formatado', formato: 'pre' },
] as const;

export function obterOpcoesAlturaEditor(altura: number, alturaAutomatica: boolean): OpcoesAlturaEditor {
  if (alturaAutomatica) {
    return {
      min_height: altura,
      autoresize_bottom_margin: 24,
      resize: false,
    };
  }

  return {
    height: altura,
    resize: true,
  };
}

export function obterPluginsTinyMce(alturaAutomatica: boolean): string[] {
  return alturaAutomatica ? [...PLUGINS_TINYMCE, 'autoresize'] : [...PLUGINS_TINYMCE];
}

export function obterToolbarTinyMce(exibirControlesCondicionais: boolean, modoLaudo = false): string {
  return [
    'undo redo formatacao',
    'bold italic underline strikethrough subscript superscript',
    'fonte fontsize forecolor backcolor removeformat',
    'align bullist numlist',
    'outdent indent lineheight espacamentoparagrafo recuoprimeiralinha',
    'blockquote hr',
    'searchreplace pastetext visualblocks',
    `link ${modoLaudo ? 'inserirfiguralaudo' : 'image'} table charmap nonbreaking pagebreak fullscreen`,
    exibirControlesCondicionais ? 'condbloco suprimirblocopericial' : '',
  ].filter(Boolean).join(' | ');
}

const RESUMOS_FIXOS_BLOCO_CONDICIONAL: Record<string, string> = {
  b602_armas_toggle: 'Mostra quando: houver armas na REP',
  b602_cartuchos_toggle: 'Mostra quando: houver cartuchos na REP',
  b602_estojos_toggle: 'Mostra quando: houver estojos na REP',
  b602_arma_N_func_toggle: 'Mostra quando: Funcionamento e eficiência da arma atual',
  b602_arma_N_coleta_toggle: 'Mostra quando: Coleta de padrões balísticos da arma atual',
  b602_arma_N_funcionamento_eficiencia_v2: 'Mostra quando: a peça atual for uma arma',
  b602_arma_N_coleta_padroes_v2: 'Mostra quando: a peça atual for uma arma',
};

function getTogglesCondicionaisDisponiveis(condToggles?: TinyMceEditorProps['condToggles']): ToggleCondicionalFlat[] {
  const toggles = condToggles || [];
  const extrasB602 = toggles.some(toggle => toggle.id === 'b602_armas_toggle')
    ? BLOCOS_CONDICIONAIS_B602_POR_ARMA
    : [];

  return [
    ...toggles.map(toggle => ({ id: toggle.id, label: toggle.label, subtitulo: toggle.subtitulo })),
    ...toggles.flatMap(toggle => (toggle.subToggles || []).map(subToggle => ({
      id: subToggle.id,
      label: subToggle.label,
      subtitulo: subToggle.subtitulo,
    }))),
    ...extrasB602,
  ];
}

function getResumoCondicional(toggleId: string, condToggles?: TinyMceEditorProps['condToggles']): string {
  if (RESUMOS_FIXOS_BLOCO_CONDICIONAL[toggleId]) {
    return RESUMOS_FIXOS_BLOCO_CONDICIONAL[toggleId];
  }

  const toggle = getTogglesCondicionaisDisponiveis(condToggles).find(item => item.id === toggleId);
  if (toggle?.label) {
    return `Mostra quando: ${toggle.label}`;
  }

  return `Mostra quando: ${toggleId}`;
}

function getTituloBlocoCondicional(toggleId: string, condToggles?: TinyMceEditorProps['condToggles']): string {
  const toggle = getTogglesCondicionaisDisponiveis(condToggles).find(item => item.id === toggleId);
  return toggle?.subtitulo || toggle?.label || toggleId;
}

function criarHtmlBlocoCondicional(toggleId: string, condToggles?: TinyMceEditorProps['condToggles']): string {
  const resumo = getResumoCondicional(toggleId, condToggles);

  const blocoPericial = toggleId.endsWith('_funcionamento_eficiencia_v2')
    ? 'funcionamento'
    : toggleId.endsWith('_coleta_padroes_v2')
      ? 'coleta'
      : '';
  const atributosV2 = blocoPericial
    ? ` data-bloco-pericial="${blocoPericial}" data-cond-versao="2"`
    : '';

  return [
    `<div class="cond-bloco"`,
    ` data-cond-bloco="${toggleId}"`,
    ` data-cond-instancia="${crypto.randomUUID()}"`,
    atributosV2,
    ` data-cond-badge="${BADGE_BLOCO_CONDICIONAL}"`,
    ` data-cond-resumo="${resumo}">`,
    blocoPericial ? '<p>&nbsp;</p></div>' : `<h3>${getTituloBlocoCondicional(toggleId, condToggles)}</h3><p>&nbsp;</p></div>`,
  ].join('');
}

function normalizarBlocosCondicionais(raiz: HTMLElement | null, condToggles?: TinyMceEditorProps['condToggles']): number {
  if (!raiz) return 0;

  let alterados = 0;
  const blocos = Array.from(raiz.querySelectorAll<HTMLElement>('.cond-bloco[data-cond-bloco]'));

  for (const bloco of blocos) {
    const toggleId = bloco.getAttribute('data-cond-bloco');
    if (!toggleId) continue;

    const badge = BADGE_BLOCO_CONDICIONAL;
    const resumo = getResumoCondicional(toggleId, condToggles);

    if (bloco.hasAttribute('data-bloco-pericial')) {
      const titulo = bloco.querySelector(':scope > h3');
      if (titulo) {
        titulo.remove();
        alterados += 1;
      }

    }

    if (bloco.getAttribute('data-cond-badge') !== badge) {
      bloco.setAttribute('data-cond-badge', badge);
      alterados += 1;
    }

    if (bloco.getAttribute('data-cond-resumo') !== resumo) {
      bloco.setAttribute('data-cond-resumo', resumo);
      alterados += 1;
    }

    if (bloco.hasAttribute('title')) {
      bloco.removeAttribute('title');
      alterados += 1;
    }

    if (!bloco.getAttribute('data-cond-instancia')) {
      bloco.setAttribute('data-cond-instancia', crypto.randomUUID());
      alterados += 1;
    }

    const emEdicao = bloco.getAttribute('data-cond-em-edicao') === 'true';
    if (bloco.getAttribute('contenteditable') !== String(emEdicao)) {
      bloco.setAttribute('contenteditable', String(emEdicao));
    }
  }

  return alterados;
}

export const TinyMceEditor: React.FC<TinyMceEditorProps & Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>> = ({
  value,
  initialValue,
  onChange: aoAlterarConteudo,
  agruparAlteracoes = false,
  onAlteracaoPendente,
  somenteLeitura = false,
  diagnosticoLaudo,
  height = 300,
  alturaAutomatica = false,
  placeholder,
  laudoId,
  repNumero,
  editorId,
  onImageInserted,
  onSolicitarInsercaoFigura,
  placeholderChaves,
  onEditorInit,
  onFalhaInicializacao,
  onDummyFigureClick,
  onFiguraRealClick,
  onSolicitarBusca,
  autoConverterReservados = false,
  condToggles,
  onSolicitarExclusaoBlocoCondicional,
  onTabelaPlaceholderRestaurada,
  onEstruturaTabelasAlterada,
  onCampoReservadoDuploClique,
  className,
  ...rest
}) => {
  const { confirmar, dialogo } = useConfirmacaoConteudo();
  const [sessaoSeletor, definirSessaoSeletor] = useState<SessaoSeletorTabela | null>(null);
  const confirmarRef = useRef(confirmar);
  confirmarRef.current = confirmar;
  const idReact = useId();
  const editorIdResolvido = editorId || `tiny-editor-${idReact.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const editorRef = useRef<TinyMceEditorInstance | null>(null);
  const onFalhaInicializacaoRef = useRef(onFalhaInicializacao);
  onFalhaInicializacaoRef.current = onFalhaInicializacao;
  const aoMarcarPendenteRef = useRef(onAlteracaoPendente);
  aoMarcarPendenteRef.current = onAlteracaoPendente;
  const repNumeroRef = useRef(repNumero);
  const placeholderChavesRef = useRef<string[] | undefined>(placeholderChaves);
  const onSolicitarExclusaoBlocoCondicionalRef = useRef(onSolicitarExclusaoBlocoCondicional);
  const onTabelaPlaceholderRestauradaRef = useRef(onTabelaPlaceholderRestaurada);
  const onEstruturaTabelasAlteradaRef = useRef(onEstruturaTabelasAlterada);
  const onCampoReservadoDuploCliqueRef = useRef(onCampoReservadoDuploClique);
  const aoClicarFiguraRealRef = useRef(onFiguraRealClick);
  aoClicarFiguraRealRef.current = onFiguraRealClick;
  const aoSolicitarBuscaRef = useRef(onSolicitarBusca);
  aoSolicitarBuscaRef.current = onSolicitarBusca;
  const editorProntoParaAlteracoesRef = useRef(false);
  const onChange = useCallback((html: string, origem?: 'usuario' | 'normalizacao-inicial') => {
    aoAlterarConteudo(html, origem ?? (editorProntoParaAlteracoesRef.current ? 'usuario' : 'normalizacao-inicial'));
  }, [aoAlterarConteudo]);
  const aoSincronizarRef = useRef(onChange);
  aoSincronizarRef.current = onChange;
  const faseInicializacaoRef = useRef('aguardando_montagem');
  const [preparado, setPreparado] = useState(false);
  const [ready, setReady] = useState(false);
  const [tentativaInicializacao, setTentativaInicializacao] = useState(0);
  const [falhaInicializacao, setFalhaInicializacao] = useState<string | null>(null);

  const [stableInitialValue] = useState(initialValue);
  const isUncontrolled = initialValue !== undefined;
  const diagnosticoLaudoRef = useRef(diagnosticoLaudo);
  diagnosticoLaudoRef.current = diagnosticoLaudo;
  const registrarInicializacao = useCallback((evento: EventoEditorLaudo['evento'], dados: Pick<EventoEditorLaudo, 'tentativaInterna' | 'motivo'> = {}) => {
    const contexto = diagnosticoLaudoRef.current;
    if (contexto) registrarDiagnosticoEditorLaudo({ ...contexto, evento, ...dados });
  }, []);

  useLayoutEffect(() => {
    if (removerInstanciaTinyMceAnterior(editorIdResolvido)) registrarInicializacao('editor_anterior_removido');
    setPreparado(true);
    return () => {
      editorRef.current = null;
      editorProntoParaAlteracoesRef.current = false;
    };
  }, [editorIdResolvido, registrarInicializacao]);

  const reiniciarEditor = useCallback(() => {
    if (removerInstanciaTinyMceAnterior(editorIdResolvido)) registrarInicializacao('editor_anterior_removido', { tentativaInterna: tentativaInicializacao });
    registrarInicializacao('editor_nova_tentativa', { tentativaInterna: tentativaInicializacao + 1 });
    faseInicializacaoRef.current = 'nova_tentativa';
    editorRef.current = null;
    editorProntoParaAlteracoesRef.current = false;
    setReady(false);
    setFalhaInicializacao(null);
    setTentativaInicializacao(atual => atual + 1);
  }, [editorIdResolvido, registrarInicializacao, tentativaInicializacao]);

  useEffect(() => {
    if (!preparado || ready || falhaInicializacao) return;
    registrarInicializacao('editor_iniciando', { tentativaInterna: tentativaInicializacao });

    const timeout = window.setTimeout(() => {
      if (editorProntoParaAlteracoesRef.current || faseInicializacaoRef.current === 'pronto') return;
      const instancia = (window as TinymceWindow).tinymce?.get(editorIdResolvido);
      const documento = instancia?.getDoc();
      const folhasEstilo = documento ? Array.from(documento.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) : [];
      const detalhes = {
        tentativa: tentativaInicializacao + 1,
        limiteMs: TEMPO_LIMITE_INICIALIZACAO_MS,
        fase: faseInicializacaoRef.current,
        tamanhoInicial: stableInitialValue?.length ?? value?.length ?? 0,
        instanciaRegistrada: Boolean(instancia),
        documentoIframe: documento?.readyState ?? 'indisponivel',
        folhasEstilo: folhasEstilo.length,
        folhasEstiloPendentes: folhasEstilo.filter(folha => !folha.sheet).length,
        capturaProblemaAtiva: window.ipcAPI?.diagnosticoInterno?.capturaProblemaAtiva?.() === true,
      };
      registrarInicializacao('editor_timeout', { tentativaInterna: tentativaInicializacao, motivo: 'tempo_limite' });
      if (onFalhaInicializacaoRef.current) {
        window.ipcAPI?.logWarning('laudo', `Editor excedeu o tempo de inicialização; abrindo por seções. ${JSON.stringify(detalhes)}`);
        onFalhaInicializacaoRef.current();
        return;
      }
      if (!instancia && tentativaInicializacao + 1 < MAX_TENTATIVAS_AUTOMATICAS) {
        window.ipcAPI?.logWarning('laudo', `Editor excedeu o tempo de inicialização; nova tentativa. ${JSON.stringify(detalhes)}`);
        reiniciarEditor();
        return;
      }

      window.ipcAPI?.logError('laudo', 'Editor não concluiu a inicialização', detalhes);
      setFalhaInicializacao('O editor demorou mais que o esperado para abrir.');
    }, TEMPO_LIMITE_INICIALIZACAO_MS);

    return () => window.clearTimeout(timeout);
  }, [editorIdResolvido, falhaInicializacao, preparado, ready, reiniciarEditor, tentativaInicializacao, registrarInicializacao, stableInitialValue, value]);

  useEffect(() => {
    placeholderChavesRef.current = placeholderChaves;
  }, [placeholderChaves]);

  useEffect(() => {
    repNumeroRef.current = repNumero;
  }, [repNumero]);

  useEffect(() => {
    onSolicitarExclusaoBlocoCondicionalRef.current = onSolicitarExclusaoBlocoCondicional;
  }, [onSolicitarExclusaoBlocoCondicional]);

  useEffect(() => {
    onTabelaPlaceholderRestauradaRef.current = onTabelaPlaceholderRestaurada;
  }, [onTabelaPlaceholderRestaurada]);

  useEffect(() => {
    onEstruturaTabelasAlteradaRef.current = onEstruturaTabelasAlterada;
  }, [onEstruturaTabelasAlterada]);

  useEffect(() => {
    onCampoReservadoDuploCliqueRef.current = onCampoReservadoDuploClique;
  }, [onCampoReservadoDuploClique]);

  const imagesUploadHandler: UploadImagemHandler = (blobInfo) =>
    new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blobInfo.blob());
    });

  const prepararImagemInserida = async (editor: TinyMceEditorInstance, dataUri: string, id: string, nomeArquivo: string): Promise<string> => {
    if (!laudoId) return dataUri;
    const estagio = await window.ipcAPI.ilustracoes.estagiarImagem(laudoId, {
      id, nomeArquivo, dataUri, legenda: '', origem: 'local', sequencia: 0,
    });
    if (!estagio.success) throw new Error(estagio.error || 'Não foi possível preparar a imagem.');
    const largura = Math.max(1, editor.getBody()?.clientWidth || 800);
    const preparada = await window.ipcAPI.ilustracoes.prepararInsercao(laudoId, id, largura, largura * 0.75, window.devicePixelRatio || 1);
    if (!preparada.success || !preparada.data) throw new Error(preparada.error || 'Não foi possível gerar a prévia da imagem.');
    return preparada.data.previaDataUri;
  };

  const pastePostprocess: PastePostprocessHandler = (editor, args) => {
    const fragment = args.node;
    if (!fragment) return;
    const convertidas = processarImagensPuras(fragment);
    if (laudoId) {
      const figuras = Array.from(fragment.querySelectorAll<HTMLElement>('.laudo-figure[data-image-id]'));
      if (fragment instanceof HTMLElement && fragment.matches('.laudo-figure[data-image-id]')) figuras.unshift(fragment);
      for (const figura of figuras) {
        const imagem = figura.querySelector('img');
        const id = figura.getAttribute('data-image-id');
        const origem = imagem?.getAttribute('src') || '';
        if (!imagem || !id) continue;
        if (figura.getAttribute('data-imagem-previa') === 'true') continue;
        if (/^https?:/i.test(origem)) {
          figura.remove();
          window.alert('Para inserir uma imagem de um site, salve o arquivo e anexe-o ao laudo.');
          continue;
        }
        if (!/^(data:image\/|blob:)/i.test(origem)) continue;
        imagem.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==');
        figura.setAttribute('data-imagem-processando', 'true');
        window.requestAnimationFrame(() => {
          void (async () => {
            const dataUri = origem.startsWith('blob:') ? await converterBlobImagemParaDataUri(origem) : origem;
            const previa = await prepararImagemInserida(editor, dataUri, id, `imagem-colada-${id}`);
            const inserida = Array.from(editor.getBody().querySelectorAll<HTMLElement>('.laudo-figure[data-image-id]'))
              .find(elemento => elemento.getAttribute('data-image-id') === id);
            if (!inserida) return;
            inserida.querySelector('img')?.setAttribute('src', previa);
            inserida.setAttribute('data-imagem-previa', 'true');
            inserida.removeAttribute('data-imagem-processando');
            onChange(editor.getContent());
            onImageInserted?.();
          })().catch(error => {
            const inserida = Array.from(editor.getBody().querySelectorAll<HTMLElement>('.laudo-figure[data-image-id]'))
              .find(elemento => elemento.getAttribute('data-image-id') === id);
            inserida?.remove();
            window.alert(error instanceof Error ? error.message : 'Não foi possível inserir a imagem.');
          });
        });
      }
    }
    if (convertidas > 0) {
      if (!laudoId) window.requestAnimationFrame(() => onImageInserted?.());
    }
  };

  const filePickerCallback: FilePickerHandler = (_callback, _value, meta) => {
    if (meta.filetype === 'image') {
      const id = crypto.randomUUID();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUri = reader.result as string;
          const editor = (window as TinymceWindow).tinymce?.get(editorIdResolvido);
          if (editor) {
            void prepararImagemInserida(editor, dataUri, id, file.name).then(preview => {
              const html = buildFigureHtml(preview, id, '');
              editor.insertContent(laudoId ? html.replace('<figure ', '<figure data-imagem-previa="true" ') : html);
              onImageInserted?.();
            }).catch(error => window.alert(error instanceof Error ? error.message : 'Não foi possível inserir a imagem.'));
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  };

  return (
    <div
      className={[className, 'relative min-h-72'].filter(Boolean).join(' ')}
      data-diagnostico-id={`editor.${editorIdResolvido}`}
      {...rest}
    >
      {dialogo}
      {sessaoSeletor && <SeletorTabelaLaudo key={sessaoSeletor.id} sessao={sessaoSeletor} />}
      {!ready && (
        <div className="absolute inset-0 z-10 flex min-h-72 items-center justify-center rounded-md border border-border bg-background">
          {falhaInicializacao ? (
            <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center">
              <p className="text-sm font-medium text-foreground">{falhaInicializacao}</p>
              <p className="text-xs text-muted-foreground">O conteúdo do laudo foi preservado. Tente carregar o editor novamente.</p>
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={reiniciarEditor}
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
              Carregando editor...
            </div>
          )}
        </div>
      )}
      <div className={ready ? '' : 'invisible'}>
      {preparado && <Editor
        key={`${editorIdResolvido}-${tentativaInicializacao}`}
        id={editorIdResolvido}
        disabled={somenteLeitura}
        licenseKey="gpl"
        tinymceScriptSrc="./tinymce/tinymce.min.js"
        onScriptsLoad={() => registrarInicializacao('editor_script_carregado', { tentativaInterna: tentativaInicializacao })}
        onScriptsLoadError={(erro) => {
          registrarInicializacao('editor_script_falhou', { tentativaInterna: tentativaInicializacao, motivo: 'erro' });
          window.ipcAPI?.logError('laudo', 'Falha ao carregar recursos do editor', {
            tentativa: tentativaInicializacao + 1,
            erro: erro instanceof Error ? erro.message : 'Erro inesperado',
          });
          setFalhaInicializacao(erro instanceof Error && erro.message
            ? erro.message
            : 'Não foi possível carregar os recursos do editor.');
        }}
        {...(isUncontrolled
          ? { initialValue: stableInitialValue }
          : { value: value || '' }
        )}
        onEditorChange={agruparAlteracoes && isUncontrolled ? undefined : (html: string) => onChange(
          html,
          editorProntoParaAlteracoesRef.current ? 'usuario' : 'normalizacao-inicial',
        )}
        init={{
          init_instance_callback: editor => {
            editorRef.current = editor;
            faseInicializacaoRef.current = 'preparando_conteudo';
            const instanciaAtual = () => editorRef.current === editor && !editor.removed && !editor.destroyed;
            const concluirPreparacao = () => {
              if (!instanciaAtual()) return;
              editor.getContainer()?.querySelector('iframe.tox-edit-area__iframe')?.setAttribute('data-diagnostico-pronto', 'true');
              registrarInicializacao('editor_pronto', { tentativaInterna: tentativaInicializacao });
              faseInicializacaoRef.current = 'pronto';
              editorProntoParaAlteracoesRef.current = true;
              setFalhaInicializacao(null);
              setReady(true);
            };
            const falharPreparacao = (erro: unknown) => {
              if (!instanciaAtual()) return;
              window.ipcAPI?.logError('laudo', 'Falha ao preparar conteúdo do editor', {
                erro: erro instanceof Error ? erro.message : 'Erro inesperado',
              });
              setFalhaInicializacao('Não foi possível preparar o conteúdo do editor. Tente novamente.');
            };
            try {
              normalizarBlocosCondicionais(editor.getBody(), condToggles);
              sincronizarAcoesBlocosCondicionais(editor.getBody());
              const preparacao = onEditorInit?.(editor);
              if (preparacao) void preparacao.then(concluirPreparacao).catch(falharPreparacao);
              else concluirPreparacao();
            } catch (erro: unknown) {
              falharPreparacao(erro);
            }
          },
          ...obterOpcoesAlturaEditor(height, alturaAutomatica),
          menubar: false,
          placeholder,
          promotion: false,
          branding: false,
          statusbar: true,
          contextmenu: false,
          skin_url: './tinymce/skins/ui/oxide',
          content_css: './tinymce/skins/content/default/content.css',
          icons_url: './tinymce/icons/default/icons.min.js',
          language: 'pt_BR',
          language_url: './tinymce/langs/pt_BR.js',
          toolbar_mode: 'wrap',
          line_height_formats: '1 1.1 1.2 1.3 1.4 1.5 2',
          pagebreak_separator: MARCADOR_QUEBRA_PAGINA,
          pagebreak_split_block: true,
          formats: FORMATOS_LIMPEZA_EDITOR,
          image_advtab: true,
          image_title: true,

          // ─── Upload de imagens (converte blob→dataURI na origem) ──
          images_upload_handler: imagesUploadHandler,
          automatic_uploads: !laudoId,

          paste_data_images: true,

          // ─── Pós-processamento de conteúdo colado ──────────
          paste_postprocess: pastePostprocess,
          relative_urls: false,
          remove_script_host: false,
          convert_urls: false,
          plugins: obterPluginsTinyMce(alturaAutomatica),
          toolbar: obterToolbarTinyMce(Boolean(condToggles?.length), Boolean(laudoId && onSolicitarInsercaoFigura)),
          content_style: `
            ${ESTILOS_TABELAS_BALISTICA}
            ::highlight(laudo-busca) { background-color: Highlight; color: HighlightText; }
            body {
              --cor-texto-editor: #000000;
              ${ESTILO_TIPOGRAFIA_EDITOR_LAUDO}
              padding: 12px;
            }
            p:not(table p):not(figure p) { text-align: justify; }
            table > caption,
            table > :is(thead, tbody) > tr:first-child > th[colspan]:only-child,
            table > caption :is(p, div),
            table > :is(thead, tbody) > tr:first-child > th[colspan]:only-child :is(p, div) {
              text-align: center !important;
            }
            body.dark-content {
              --cor-texto-editor: #ffffff;
              background-color: #222f3e;
              color: #fff;
            }
            body.dark-content a { color: #4099ff; }
            body.dark-content table th,
            body.dark-content table td {
              background-color: transparent !important;
              color: #fff !important;
              border-color: #6d737b !important;
            }
            body.dark-content table[border]:not([border="0"]):not([style*="border-color"]) th,
            body.dark-content table[border]:not([border="0"]):not([style*="border-color"]) td {
              border-color: #6d737b;
            }
            body.dark-content figure figcaption { color: #8a8f97; }
            body.dark-content hr { border-color: #6d737b; }
            [data-quebra-pagina="true"] {
              display: block;
              height: 0;
              margin: 18px 0;
              border-top: 2px dashed #64748b;
              break-after: page;
            }
            [data-quebra-pagina="true"]::after {
              content: "Quebra de página";
              position: relative;
              top: -11px;
              display: table;
              margin: 0 auto;
              padding: 0 6px;
              background: #fff;
              color: #475569;
              font-size: 11px;
            }
            body.dark-content [data-quebra-pagina="true"] { border-color: #94a3b8; }
            body.dark-content [data-quebra-pagina="true"]::after { background: #222f3e; color: #cbd5e1; }
            body.dark-content code { background-color: #6d737b; }
            body.dark-content .mce-content-body:not([dir=rtl]) blockquote { border-color: #6d737b; }
            body.dark-content .mce-content-body[dir=rtl] blockquote { border-color: #6d737b; }
            .placeholder-tag {
              background-color: #e8f0fe;
              color: #1a73e8;
              border-radius: 4px;
              padding: 2px 6px;
              font-weight: 500;
              user-select: all;
              cursor: default;
            }
            body.dark-content .placeholder-tag {
              background-color: rgba(138,180,248,0.15);
              color: #8ab4f8;
            }
            .placeholder-personalizado { background-color: rgba(139,92,246,0.16); color: #6d28d9; border-bottom: 2px dotted #8b5cf6; cursor: pointer; }
            [data-b601-campo-editavel="true"] > [data-b601-campo-texto="true"] { display: none; }
            [data-b601-coleta-editavel] > [data-b601-coleta-texto] { display: none; }
            @media print {
              [data-b601-coleta-controle], [data-seletor-tabela-acionador] { display: none !important; }
              [data-b601-coleta-editavel] > [data-b601-coleta-texto] { display: inline !important; }
            }
            @media print {
              select[data-b601-campo-select="true"] { display: none !important; }
              [data-b601-campo-editavel="true"] > [data-b601-campo-texto="true"] { display: inline !important; }
            }
            body.dark-content .placeholder-personalizado { color: #c4b5fd; }
            .campo-reservado, select[data-b601-campo-select="true"].campo-reservado {
              background-color: rgba(255,193,7,0.2);
              color: #b45309;
              border-radius: 4px;
              padding: 2px 6px;
              border-bottom: 2px dotted #f59e0b;
              font-weight: 500;
            }
            .campo-reservado[data-tooltip-xxx="true"] {
              cursor: help;
            }
            body.dark-content .campo-reservado, body.dark-content select[data-b601-campo-select="true"].campo-reservado {
              background-color: rgba(255,193,7,0.15);
              color: #fbbf24;
              border-bottom-color: #f59e0b;
            }
            .cond-bloco {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              border-left: 3px solid #f59e0b;
              border-radius: 0 10px 10px 0;
              background-color: rgba(245, 158, 11, 0.08);
              padding: 10px 14px 12px;
              margin: 12px 0;
            }
            .cond-bloco > table {
              align-self: stretch;
              width: 100% !important;
            }
            .cond-bloco [data-placeholder-preview="true"] {
              align-self: stretch;
              width: 100% !important;
              max-width: 100% !important;
              min-width: 0;
              box-sizing: border-box;
            }
            .cond-bloco [data-placeholder-preview="true"] > table {
              width: 100% !important;
              max-width: 100% !important;
            }
            [data-placeholder-preview-tabela="true"]:not(.conteudo-laudo),
            [data-placeholder-tabela-personalizada="true"]:not(.conteudo-laudo) {
              font-family: Arial, Helvetica, sans-serif;
              position: relative;
              display: block;
              box-sizing: border-box;
              width: 100%;
              margin: 12px 0;
              padding: 40px 14px 12px;
              border-left: 3px solid #f59e0b;
              border-radius: 0 10px 10px 0;
              background-color: rgba(245, 158, 11, 0.08);
            }
            [data-placeholder-preview-tabela="true"]:not(.conteudo-laudo)::before,
            [data-placeholder-tabela-personalizada="true"]:not(.conteudo-laudo)::before {
              content: "Tabela do placeholder";
              display: inline-flex;
              align-items: center;
              position: absolute;
              top: 10px;
              left: 14px;
              padding: 2px 8px;
              border: 1px solid #fdba74;
              border-radius: 999px;
              background-color: #fff7ed;
              color: #9a3412;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.04em;
              line-height: 1.4;
              text-transform: uppercase;
            }
            [data-placeholder-preview-tabela="true"] > table,
            [data-placeholder-tabela-personalizada="true"] > table {
              width: 100% !important;
              max-width: 100% !important;
            }
            .acao-tabela-placeholder {
              font-family: Arial, Helvetica, sans-serif;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              position: absolute;
              top: 8px;
              right: 38px;
              min-height: 22px;
              padding: 0 6px;
              border: 1px solid #fdba74;
              border-radius: 4px;
              color: #92400e;
              background: #fff7ed;
              font-size: 11px;
              font-weight: 700;
              line-height: 1;
              cursor: pointer !important;
              user-select: none;
              white-space: nowrap;
            }
            .acao-tabela-placeholder-excluir {
              right: 10px;
              min-width: 22px;
              padding: 0;
              border-color: transparent;
              font-size: 21px;
              font-weight: 400;
            }
            .acao-tabela-placeholder:hover,
            .acao-tabela-placeholder:focus {
              background: rgba(146, 64, 14, 0.12);
              color: #7c2d12;
              outline: none;
            }
            body.dark-content [data-placeholder-preview-tabela="true"]:not(.conteudo-laudo),
            body.dark-content [data-placeholder-tabela-personalizada="true"]:not(.conteudo-laudo) {
              border-left-color: #d97706;
              background-color: rgba(245, 158, 11, 0.12);
            }
            body.dark-content [data-placeholder-preview-tabela="true"]:not(.conteudo-laudo)::before,
            body.dark-content [data-placeholder-tabela-personalizada="true"]:not(.conteudo-laudo)::before {
              border-color: rgba(251, 191, 36, 0.45);
              background-color: rgba(120, 53, 15, 0.75);
              color: #fde68a;
            }
            body.dark-content .cond-bloco {
              border-left-color: #d97706;
              background-color: rgba(245, 158, 11, 0.12);
            }
            body.dark-content [data-b601-grupo] th:not([data-b601-fotos-origem] th) {
              background-color: #374151 !important;
            }
            body.dark-content [data-b601-grupo] thead tr:first-child th[colspan]:not([data-b601-fotos-origem] th) {
              background-color: #4b5563 !important;
            }
            .cond-bloco[data-cond-suprimido="true"] {
              display: none !important;
            }
            .cond-bloco {
              position: relative;
              padding-right: 112px;
            }
            .cond-bloco .controles-bloco-condicional {
              position: absolute;
              top: 6px;
              right: 7px;
              display: inline-flex !important;
              gap: 4px;
              align-items: center;
              z-index: 4;
            }
            .cond-bloco .acao-bloco-condicional {
              display: inline-flex !important;
              align-items: center;
              justify-content: center;
              min-width: 22px;
              height: 22px;
              padding: 0 6px;
              border: 1px solid #fdba74;
              border-radius: 4px;
              background: #fff7ed;
              color: #92400e;
              cursor: pointer !important;
              font-family: Arial, sans-serif;
              font-size: 11px;
              font-weight: 700;
              line-height: 1;
              visibility: visible !important;
              opacity: 1 !important;
              pointer-events: auto !important;
            }
            .cond-bloco .acao-bloco-condicional-excluir {
              padding: 0;
              border-color: transparent;
              font-size: 21px;
              font-weight: 400;
            }
            .cond-bloco .acao-bloco-condicional:hover,
            .cond-bloco .acao-bloco-condicional:focus {
              background: rgba(146, 64, 14, 0.12);
              color: #7c2d12;
            }
            .cond-bloco::before {
              content: "Bloco condicional";
              order: -2;
              display: inline-flex;
              align-items: center;
              margin-bottom: 8px;
              padding: 2px 8px;
              border-radius: 999px;
              border: 1px solid #fdba74;
              background-color: #fff7ed;
              color: #9a3412;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.04em;
              text-transform: uppercase;
              line-height: 1.4;
            }
            .cond-bloco h1,
            .cond-bloco h2,
            .cond-bloco h3,
            .cond-bloco h4,
            .cond-bloco h5,
            .cond-bloco h6,
            .cond-bloco p:first-of-type {
              margin-top: 0;
            }
            body.dark-content .cond-bloco::before {
              border-color: rgba(251, 191, 36, 0.45);
              background-color: rgba(120, 53, 15, 0.75);
              color: #fde68a;
            }
            body.dark-content .cond-bloco::after {
              color: #fcd34d;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            [data-laudo-secao] {
              border-color: rgba(128,128,128,0.2) !important;
            }
            [data-laudo-secao-header] {
              background: rgba(128,128,128,0.08) !important;
              border-bottom-color: rgba(128,128,128,0.2) !important;
              color: inherit !important;
            }
            [data-template-secao] {
              border-color: rgba(128,128,128,0.2) !important;
            }
            [data-template-secao-header] {
              background: rgba(128,128,128,0.08) !important;
              border-bottom-color: rgba(128,128,128,0.2) !important;
              color: inherit !important;
            }
          `,

          // ─── Upload de imagens ───────────────────────────
          file_picker_callback: filePickerCallback,

          // ─── Placeholder personalizado e Proxy de ContextMenu ─────
          setup: (editor: TinyMceEditorInstance) => {
            if (laudoId) {
              editor.on('ObjectResized', evento => {
                const imagem = evento.target.tagName === 'IMG' ? evento.target as HTMLImageElement : null;
                const figura = imagem?.closest<HTMLElement>('.laudo-figure[data-imagem-previa="true"]');
                const id = figura?.getAttribute('data-image-id');
                if (!imagem || !figura || !id) return;
                void window.ipcAPI.ilustracoes.prepararInsercao(
                  laudoId, id, Math.max(1, evento.width), Math.max(1, evento.height), window.devicePixelRatio || 1,
                ).then(resultado => {
                  if (!resultado.success || !resultado.data) throw new Error(resultado.error || 'Não foi possível atualizar a prévia.');
                  if (!editor.getBody().contains(figura) || figura.getAttribute('data-image-id') !== id) return;
                  imagem.setAttribute('src', resultado.data.previaDataUri);
                  onChange(editor.getContent());
                }).catch((erro: unknown) => window.alert(erro instanceof Error ? erro.message : 'Não foi possível atualizar a prévia.'));
              });
            }
            registrarInicializacao('editor_setup_iniciado', { tentativaInterna: tentativaInicializacao });
            faseInicializacaoRef.current = 'setup';
            if (diagnosticoLaudoRef.current) instrumentarLeiturasEditorLaudo(editor, diagnosticoLaudoRef.current.modo === 'single');
            if (agruparAlteracoes && isUncontrolled) agruparAlteracoesEditorLaudo(
              editor, html => aoSincronizarRef.current(html), () => aoMarcarPendenteRef.current?.(),
              () => editorProntoParaAlteracoesRef.current,
            );
            for (const fase of ['PreInit', 'PostRender', 'SkinLoaded', 'BeforeSetContent', 'SetContent', 'LoadContent']) {
              editor.on(fase, () => { if (!editorProntoParaAlteracoesRef.current) faseInicializacaoRef.current = fase; });
            }
            editor.on('remove', () => registrarInicializacao('editor_instancia_removida', { tentativaInterna: tentativaInicializacao }));
            editor.on('Undo Redo', () => window.requestAnimationFrame(() => onImageInserted?.()));
            if (laudoId && onSolicitarInsercaoFigura) {
              editor.ui.registry.addButton('inserirfiguralaudo', {
                text: 'Inserir figura',
                tooltip: 'Inserir figura na posição do cursor',
                onAction: () => onSolicitarInsercaoFigura(editor),
              });
            }
            editor.on('FullscreenStateChanged', evento => {
              sincronizarIdentificacaoFullscreen(
                editor.getContainer(),
                evento.state,
                repNumeroRef.current,
              );
            });

            editor.ui.registry.addMenuButton('formatacao', {
              text: 'Formatação',
              tooltip: 'Formato do bloco',
              fetch: callback => callback(FORMATOS_BLOCO_EDITOR.map(({ texto, formato }) => ({
                type: 'togglemenuitem' as const,
                text: texto,
                onAction: () => editor.execCommand('FormatBlock', false, formato),
                onSetup: (api: Ui.Menu.ToggleMenuItemInstanceApi) => {
                  const sincronizar = () => api.setActive(
                    editor.queryCommandValue('FormatBlock').toLowerCase() === formato
                  );
                  sincronizar();
                  editor.on('NodeChange', sincronizar);
                  return () => editor.off('NodeChange', sincronizar);
                },
              }))),
            });

            editor.addCommand('RemoveFormat', () => limparFormatacaoEditor(editor));

            editor.ui.registry.addMenuButton('recuoprimeiralinha', {
              text: 'Parágrafo',
              tooltip: 'Recuo da primeira linha (padrão: 1,25 cm)',
              fetch: callback => callback(MEDIDAS_RECUO_PRIMEIRA_LINHA.map(({ texto, valor }) => ({
                type: 'togglemenuitem' as const,
                text: texto,
                onAction: () => aplicarRecuoPrimeiraLinha(editor, valor),
                onSetup: (api: Ui.Menu.ToggleMenuItemInstanceApi) => {
                  const sincronizar = () => api.setActive(recuoCorresponde(obterRecuoSelecionado(editor), valor));
                  sincronizar();
                  editor.on('NodeChange', sincronizar);
                  return () => editor.off('NodeChange', sincronizar);
                },
              }))),
            });

            editor.ui.registry.addMenuButton('espacamentoparagrafo', {
              text: 'Espaçamento',
              tooltip: 'Espaço antes e depois dos parágrafos',
              fetch: callback => callback((['antes', 'depois'] as const).map(lado => ({
                type: 'nestedmenuitem' as const,
                text: lado === 'antes' ? 'Antes do parágrafo' : 'Depois do parágrafo',
                getSubmenuItems: () => [undefined, ...VALORES_ESPACAMENTO_PARAGRAFO].map(valor => ({
                  type: 'togglemenuitem' as const,
                  text: valor === undefined ? 'Padrão do documento' : `${valor} pt`,
                  onAction: () => aplicarEspacamentoParagrafo(editor, lado, valor),
                  onSetup: (api: Ui.Menu.ToggleMenuItemInstanceApi) => {
                    const sincronizar = () => {
                      const estado = obterEspacamentoSelecionado(editor, lado);
                      api.setEnabled(estado.disponivel);
                      api.setActive(valor === undefined ? estado.padrao : !estado.padrao && estado.valorPt !== null && Math.abs(estado.valorPt - valor) < 0.1);
                    };
                    sincronizar();
                    editor.on('NodeChange', sincronizar);
                    return () => editor.off('NodeChange', sincronizar);
                  },
                })),
              }))),
            });

            editor.ui.registry.addMenuButton('fonte', {
              text: 'Fonte',
              tooltip: 'Selecionar fonte',
              fetch: callback => callback(FONTES_EDITOR.map(({ texto, familia }) => ({
                type: 'menuitem' as const,
                text: texto,
                onAction: () => editor.execCommand('FontName', false, familia),
              }))),
            });

            editor.addCommand('insertPlaceholder', ((_ui, placeholder) => {
              const identificador = placeholder.identificadorInsercao
                ? ` data-placeholder-inserido-id="${placeholder.identificadorInsercao}"`
                : '';
              const html = `<span contenteditable="false" class="placeholder-tag" data-placeholder="{{${placeholder.chave}}}"${identificador}>{{${placeholder.chave}}}</span>`;
              editor.insertContent(html);
            }) satisfies ComandoTinyMce<PlaceholderPayload>);

            editor.addCommand('insertLaudoImage', ((_ui, data) => {
              const html = buildFigureHtml(data.url, data.id, data.legenda);
              editor.insertContent(data.previa ? html.replace('<figure ', '<figure data-imagem-previa="true" ') : html);
            }) satisfies ComandoTinyMce<ImagemLaudoPayload>);

            editor.addCommand('reindexFiguras', () => {
              const body = editor.getBody();
              const figures = body.querySelectorAll('.laudo-figure');
              figures.forEach((figure: Element, index: number) => {
                atualizarNumeroFigura(figure, index + 1);
              });
              editor.undoManager.add();
            });

            editor.addCommand('removeLaudoImage', ((_ui, data) => {
              const body = editor.getBody();
              const figure = body.querySelector(`.laudo-figure[data-image-id="${data.id}"]`);
              if (figure) {
                const nextSibling = figure.nextElementSibling;
                figure.remove();
                if (nextSibling && (nextSibling.tagName === 'BR' || (nextSibling.tagName === 'P' && (nextSibling as HTMLElement).innerHTML === '&nbsp;'))) {
                  nextSibling.remove();
                }
              }
            }) satisfies ComandoTinyMce<RemoverImagemPayload>);

            editor.addCommand('replaceLaudoImage', ((_ui, data) => {
              editor.undoManager.transact(() => {
                const body = editor.getBody();
                let figure: HTMLElement | null = null;
                if (data.figureElement) {
                  figure = data.figureElement;
                } else if (data.imageId) {
                  figure = body.querySelector(`.laudo-figure[data-image-id="${data.imageId}"]`);
                }
                if (!figure) return;
                const img = figure.querySelector('img');
                if (img) {
                  editor.dom.setAttrib(img, 'src', data.newUrl);
                }
                if (data.newImageId) {
                  figure.setAttribute('data-image-id', data.newImageId);
                }
                if (data.previa) figure.setAttribute('data-imagem-previa', 'true');
                else figure.removeAttribute('data-imagem-previa');
                if (data.imagemOrigemId) {
                  figure.setAttribute('data-image-original-id', data.imagemOrigemId);
                  if (!figure.hasAttribute('data-figure-id')) figure.setAttribute('data-figure-id', crypto.randomUUID());
                } else {
                  figure.removeAttribute('data-image-original-id');
                }
                figure.removeAttribute('data-dummy');
                figure.style.cursor = '';
              });
            }) satisfies ComandoTinyMce<SubstituirImagemPayload>);

            editor.addCommand('insertLaudoImageDummy', () => {
              const id = crypto.randomUUID();
              const src = URL_FIGURA_DUMMY;
              const html = criarHtmlFigura(src, id, '', true) + '<br>';
              editor.insertContent(html);
            });

            editor.addCommand('scanAndWrapImages', () => {
              if (laudoId) return 0;
              const count = scanEditorForRawImages(editor);
              editor.execCommand('reindexFiguras');
              return count;
            });

            // Comando: Inserir bloco condicional
            editor.addCommand('insertCondBloco', ((_ui, toggleId) => {
              if (!toggleId || typeof toggleId !== 'string') return;
              editor.insertContent(criarHtmlBlocoCondicional(toggleId, condToggles));
              if (normalizarBlocosCondicionais(editor.getBody(), condToggles) > 0) {
                onChange(editor.getContent());
              }
            }) satisfies ComandoTinyMce<string>);

            const confirmarExclusaoBlocoCondicional = async (referencia: BlocoCondicionalSelecionado) => {
              const identificacaoArma = referencia.armaIndice
                ? ` da Arma ${String.fromCharCode(64 + referencia.armaIndice)}`
                : '';
              const confirmou = await confirmarRef.current(
                `Excluir o bloco${identificacaoArma} — ${referencia.titulo}?\n\nEle desaparecerá do laudo e não será exportado. Use Desfazer durante a edição. Não há recuperação garantida após reabrir.`,
              );
              if (!confirmou) return false;
              onSolicitarExclusaoBlocoCondicionalRef.current?.(referencia);
              return true;
            };

            const solicitarExclusaoBlocoSelecionado = (elemento?: HTMLElement) => {
              const inicio = editor.selection.getStart() as HTMLElement | null;
              const bloco = elemento?.closest<HTMLElement>('.cond-bloco[data-cond-bloco]')
                || inicio?.closest<HTMLElement>('.cond-bloco[data-cond-bloco]');
              const instanciaId = bloco?.getAttribute('data-cond-instancia');
              if (!bloco || !instanciaId) return false;
              const indiceBruto = bloco.getAttribute('data-arma-indice');
              const armaIndice = indiceBruto ? Number(indiceBruto) : undefined;
              void confirmarExclusaoBlocoCondicional({
                editorId: editor.id,
                instanciaId,
                titulo: bloco.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim()
                  || bloco.getAttribute('data-cond-bloco')
                  || 'Bloco condicional',
                resumo: bloco.getAttribute('data-cond-resumo') || '',
                armaIndice: Number.isInteger(armaIndice) ? armaIndice : undefined,
              });
            };

            editor.addCommand('excluirBlocoCondicional', () => {
              solicitarExclusaoBlocoSelecionado();
            });

            editor.ui.registry.addButton('suprimirblocopericial', {
              text: 'Excluir bloco',
              tooltip: 'Excluir o bloco condicional selecionado',
              onAction: () => editor.execCommand('excluirBlocoCondicional'),
            });

            // Registrar botão "Bloco Condicional" na toolbar
            if (condToggles && condToggles.length > 0) {
              const menuItems: Ui.Menu.MenuItemSpec[] = [];
              for (const toggle of condToggles) {
                menuItems.push({
                  type: 'menuitem',
                  text: toggle.label,
                  onAction: () => editor.execCommand('insertCondBloco', false, toggle.id),
                });
                if (toggle.subToggles) {
                  toggle.subToggles.forEach((sub) => {
                    menuItems.push({
                      type: 'menuitem',
                      text: `  ${sub.label}`,
                      onAction: () => editor.execCommand('insertCondBloco', false, sub.id),
                    });
                  });
                }
              }
              if (condToggles.some(toggle => toggle.id === 'b602_armas_toggle')) {
                for (const bloco of BLOCOS_CONDICIONAIS_B602_POR_ARMA) {
                  menuItems.push({
                    type: 'menuitem',
                    text: bloco.label,
                    onAction: () => editor.execCommand('insertCondBloco', false, bloco.id),
                  });
                }
              }
              editor.ui.registry.addMenuButton('condbloco', {
                text: 'Bloco Cond.',
                tooltip: 'Inserir bloco condicional',
                fetch: (callback) => callback(menuItems),
              });
            } else {
              editor.ui.registry.addButton('condbloco', {
                text: 'Bloco Cond.',
                tooltip: 'Bloco Condicional (sem toggles configurados)',
                onAction: () => {},
                enabled: false,
              });
            }

            // Repassar evento de clique direito para o componente pai (Shadcn ContextMenu)
            // Usamos init + listener nativo porque contextmenu:false desabilita o plugin
            // e o editor event 'contextmenu' nunca dispara.
            editor.on('init', () => {
              registrarInicializacao('editor_init_evento', { tentativaInterna: tentativaInicializacao });
              const doc = editor.getDoc();
              if (!doc) return;
              const solicitarBusca = (evento: KeyboardEvent) => {
                if (!aoSolicitarBuscaRef.current || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
                if (!(evento.ctrlKey || evento.metaKey) || evento.altKey || evento.shiftKey || evento.key.toLowerCase() !== 'f') return;
                evento.preventDefault();
                evento.stopImmediatePropagation();
                aoSolicitarBuscaRef.current();
              };
              doc.addEventListener('keydown', solicitarBusca, true);
              editor.on('remove', () => doc.removeEventListener('keydown', solicitarBusca, true));
              const body = editor.getBody();
              registrarSeletoresTabela(editor, definirSessaoSeletor);
              registrarSeletoresCamposB601(editor, html => onChange(html, 'usuario'));
              registrarColetaB601(editor, laudoId, html => onChange(html, 'usuario'));
              if (laudoId) registrarMenuPreenchimentoB601(editor, html => onChange(html, 'usuario'));

              const sincronizarAcoesBlocos = () => {
                editor.undoManager.ignore(() => {
                  const raizEditor = editor.getBody();
                  normalizarBlocosCondicionais(raizEditor, condToggles);
                  sincronizarAcoesBlocosCondicionais(raizEditor);
                });
              };


              if (normalizarBlocosCondicionais(body, condToggles) > 0) {
                onChange(editor.getContent(), 'normalizacao-inicial');
              }
              sincronizarAcoesBlocos();
              registrarPreparacaoConteudo(editor, sincronizarAcoesBlocos, -10);
              editor.on('Undo Redo', () => {
                onChange(editor.getContent());
              });

              doc.addEventListener('contextmenu', (e: MouseEvent) => {
                e.preventDefault();

                const container = editor.getContainer();
                const iframe = editor.iframeElement as HTMLIFrameElement | null;
                const iframeRect = iframe?.getBoundingClientRect() ?? container.getBoundingClientRect();

                const newEvent = new MouseEvent('contextmenu', {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  clientX: e.clientX + iframeRect.left,
                  clientY: e.clientY + iframeRect.top,
                });

                container.dispatchEvent(newEvent);
              });

              registrarConteudoInterativo(editor, {
                laudoId,
                confirmar: mensagem => confirmarRef.current(mensagem),
                aoAlterar: html => { onChange(html, 'usuario'); onEstruturaTabelasAlteradaRef.current?.(); },
                aoRestaurar: () => { onTabelaPlaceholderRestauradaRef.current?.(editor); onEstruturaTabelasAlteradaRef.current?.(); },
              });
              let conferenciaPendente: ReturnType<typeof setTimeout> | null = null;
              const observarTabelas = new MutationObserver(mutacoes => {
                const alterouEstrutura = mutacoes.some(mutacao =>
                  [...mutacao.addedNodes, ...mutacao.removedNodes].some(no =>
                    no.nodeType === Node.ELEMENT_NODE && (
                      (no as Element).matches('table') || Boolean((no as Element).querySelector('table'))
                    )
                  )
                );
                if (!alterouEstrutura || conferenciaPendente) return;
                conferenciaPendente = setTimeout(() => {
                  conferenciaPendente = null;
                  onEstruturaTabelasAlteradaRef.current?.();
                }, 0);
              });
              const bodyEditor = editor.getBody();
              if (bodyEditor) observarTabelas.observe(bodyEditor, { childList: true, subtree: true });
              editor.on('remove', () => {
                observarTabelas.disconnect();
                if (conferenciaPendente) clearTimeout(conferenciaPendente);
              });

              const solicitarPreenchimentoCampoReservado = (evento: MouseEvent) => {
                const campo = encontrarCampoReservado(evento.target);
                if (!campo || !onCampoReservadoDuploCliqueRef.current) return;
                if (!permiteEdicaoCampo(campo, editor.mode.isReadOnly())) {
                  if (!editor.mode.isReadOnly()) editor.notificationManager.open({ type: 'info', text: 'Clique em Editar para personalizar este valor.' });
                  return;
                }
                evento.preventDefault();
                evento.stopPropagation();
                onCampoReservadoDuploCliqueRef.current({ editorId: editor.id, elemento: campo });
              };

              doc.addEventListener('dblclick', solicitarPreenchimentoCampoReservado, true);
              editor.on('remove', () => {
                doc.removeEventListener('dblclick', solicitarPreenchimentoCampoReservado, true);
              });

              doc.addEventListener('click', (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                if (target.tagName === 'IMG') {
                  const figuraReal = target.closest('.laudo-figure');
                  if (figuraReal && figuraReal.getAttribute('data-dummy') !== 'true' && aoClicarFiguraRealRef.current) {
                    aoClicarFiguraRealRef.current();
                    return;
                  }
                  const figure = target.closest('.laudo-figure[data-dummy="true"]');
                  if (figure) {
                    e.preventDefault();
                    e.stopPropagation();
                    const imageId = figure.getAttribute('data-image-id');
                    if (imageId && onDummyFigureClick) {
                      onDummyFigureClick(imageId);
                      return;
                    }
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        void (async () => {
                          const id = crypto.randomUUID();
                          const previa = await prepararImagemInserida(editor, String(reader.result), id, file.name);
                          editor.execCommand('replaceLaudoImage', false, {
                            figureElement: figure as HTMLElement,
                            newImageId: id,
                            newUrl: previa,
                            previa: true,
                          });
                          onChange(editor.getContent());
                        })().catch((erro: unknown) => window.alert(erro instanceof Error ? erro.message : 'Não foi possível preparar a imagem.'));
                      };
                      reader.readAsDataURL(file);
                    };
                    input.click();
                  }
                }
              });

              // ─── Observer para imagens arrastadas/soltadas ─────
              if (body) {
                let processando = false;

                if (laudoId) {
                  const aoSoltarArquivo = (evento: DragEvent) => {
                    const arquivos = Array.from(evento.dataTransfer?.files || []).filter(arquivo => arquivo.type.startsWith('image/'));
                    if (arquivos.length === 0) {
                      if (/<img\b/i.test(evento.dataTransfer?.getData('text/html') || '')) {
                        evento.preventDefault();
                        evento.stopImmediatePropagation();
                        window.alert('Para inserir uma imagem de um site, salve o arquivo e anexe-o ao laudo.');
                      }
                      return;
                    }
                    evento.preventDefault();
                    evento.stopImmediatePropagation();
                    void (async () => {
                      for (const arquivo of arquivos) {
                        const dataUri = await new Promise<string>((resolve, reject) => {
                          const leitor = new FileReader();
                          leitor.onload = () => resolve(String(leitor.result));
                          leitor.onerror = () => reject(new Error('Não foi possível ler a imagem arrastada.'));
                          leitor.readAsDataURL(arquivo);
                        });
                        const id = crypto.randomUUID();
                        const previa = await prepararImagemInserida(editor, dataUri, id, arquivo.name);
                        editor.insertContent(buildFigureHtml(previa, id, '').replace('<figure ', '<figure data-imagem-previa="true" '));
                        onImageInserted?.();
                      }
                    })().catch(error => window.alert(error instanceof Error ? error.message : 'Não foi possível inserir a imagem.'));
                  };
                  body.addEventListener('drop', aoSoltarArquivo, true);
                  editor.on('remove', () => body.removeEventListener('drop', aoSoltarArquivo, true));
                }

                const figuraObserver = new MutationObserver((mutations) => {
                  if (processando) return;

                  const rawImages: HTMLImageElement[] = [];
                  for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                      if (node.nodeType !== 1) continue;
                      const el = node as Element;

                      if (el.tagName === 'IMG' && !el.closest('.laudo-figure') && !imagemEhMarcadorQuebraPagina(el as HTMLImageElement) && !imagemEhTemporariaEditor(el as HTMLImageElement)) {
                        const src = (el as HTMLImageElement).src;
                        if (src && (src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:'))) {
                          rawImages.push(el as HTMLImageElement);
                        }
                      }

                      el.querySelectorAll('img').forEach(nestedImg => {
                        if (!nestedImg.closest('.laudo-figure') && !imagemEhMarcadorQuebraPagina(nestedImg as HTMLImageElement) && !imagemEhTemporariaEditor(nestedImg as HTMLImageElement)) {
                          const src = (nestedImg as HTMLImageElement).src;
                          if (src && (src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:'))) {
                            rawImages.push(nestedImg as HTMLImageElement);
                          }
                        }
                      });
                    }
                  }

                  if (rawImages.length === 0) return;

                  processando = true;
                  figuraObserver.disconnect();

                  const pendentes: Array<{ id: string; origem: string }> = [];

                  editor.undoManager.transact(() => {
                    for (const img of rawImages) {
                      if (!body.contains(img) || img.closest('.laudo-figure') || imagemEhTemporariaEditor(img)) continue;
                      const origem = img.getAttribute('src') || '';
                      if (laudoId && /^https?:/i.test(origem)) {
                        img.remove();
                        window.alert('Para inserir uma imagem de um site, salve o arquivo e anexe-o ao laudo.');
                        continue;
                      }
                      if (laudoId) img.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==');
                      const figure = wrapImgAsFigure(img);
                      img.parentNode?.replaceChild(figure, img);
                      if (laudoId) {
                        const id = figure.getAttribute('data-image-id');
                        if (id) {
                          figure.setAttribute('data-imagem-processando', 'true');
                          pendentes.push({ id, origem });
                        }
                      }
                    }
                  });

                  onChange(editor.getContent());

                  figuraObserver.observe(body, { childList: true, subtree: true });
                  processando = false;
                  onImageInserted?.();
                  for (const pendente of pendentes) {
                    void (async () => {
                      const dataUri = pendente.origem.startsWith('blob:')
                        ? await converterBlobImagemParaDataUri(pendente.origem) : pendente.origem;
                      const previa = await prepararImagemInserida(editor, dataUri, pendente.id, `imagem-${pendente.id}`);
                      const figura = Array.from(body.querySelectorAll<HTMLElement>('.laudo-figure[data-image-id]'))
                        .find(elemento => elemento.getAttribute('data-image-id') === pendente.id);
                      if (!figura) return;
                      figura.querySelector('img')?.setAttribute('src', previa);
                      figura.setAttribute('data-imagem-previa', 'true');
                      figura.removeAttribute('data-imagem-processando');
                      onChange(editor.getContent());
                    })().catch((erro: unknown) => {
                      Array.from(body.querySelectorAll<HTMLElement>('.laudo-figure[data-image-id]'))
                        .find(elemento => elemento.getAttribute('data-image-id') === pendente.id)?.remove();
                      window.alert(erro instanceof Error ? erro.message : 'Não foi possível preparar a imagem.');
                    });
                  }
                });

                figuraObserver.observe(body, { childList: true, subtree: true });

                editor.on('remove', () => figuraObserver.disconnect());
              }

              // ─── Observador de tema global (Header toggle) ─────
              const estilosIndicadores = obterEstilosIndicadoresSecao();
              if (estilosIndicadores) editor.dom.addStyle(estilosIndicadores);
              const isDark = document.body.classList.contains('dark');
              aplicarTemaEditor(editor, isDark);

              const temaObserver = new MutationObserver(() => {
                const nowDark = document.body.classList.contains('dark');
                aplicarTemaEditor(editor, nowDark);
              });
              temaObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

              editor.on('remove', () => temaObserver.disconnect());
            });

            // ─── Auto-converter {{chave}} digitado manualmente em span estilizado ─────
            if (placeholderChaves && placeholderChaves.length > 0) {
              let placeholderTimer: ReturnType<typeof setTimeout> | null = null;

              const converterPlaceholderLocal = () => {
                const chavesValidas = placeholderChavesRef.current;
                if (!chavesValidas || chavesValidas.length === 0) return;

                const rng = editor.selection.getRng();
                if (!rng || !rng.startContainer) return;

                const textNode = rng.startContainer;
                if (textNode.nodeType !== 3) return;

                const parent = textNode.parentElement;
                if (parent?.classList?.contains('placeholder-tag')) return;
                if (parent?.getAttribute?.('data-placeholder')) return;

                const text = textNode.textContent || '';
                const regex = /\{\{([^{}]+)\}\}/g;
                const substituicoes: { pos: number; fim: number; chave: string }[] = [];
                let match: RegExpExecArray | null;

                while ((match = regex.exec(text)) !== null) {
                  if (placeholderChaveEhValida(match[1], chavesValidas)) {
                    substituicoes.push({ pos: match.index, fim: match.index + match[0].length, chave: match[1] });
                  }
                }

                if (substituicoes.length === 0) return;

                const bookmark = editor.selection.getBookmark(2, true);

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

                editor.selection.moveToBookmark(bookmark);
              };

              editor.on('input', () => {
                if (placeholderTimer) clearTimeout(placeholderTimer);
                placeholderTimer = setTimeout(converterPlaceholderLocal, 600);
              });

              editor.on('remove', () => {
                if (placeholderTimer) clearTimeout(placeholderTimer);
              });
            }

            // ─── Auto-converter XXX digitado manualmente em span estilizado ─────
            if (autoConverterReservados) {
              let reservadoTimer: ReturnType<typeof setTimeout> | null = null;

              const converterReservadoLocal = () => {
                const rng = editor.selection.getRng();
                if (!rng || !rng.startContainer) return;

                const textNode = rng.startContainer;
                if (textNode.nodeType !== 3) return;

                const parent = textNode.parentElement;
                if (parent?.classList?.contains('campo-reservado')) return;
                if (parent?.getAttribute?.('data-reservado')) return;

                const text = textNode.textContent || '';
                const regex = /XXX/gi;
                const substituicoes: { pos: number; fim: number; padrao: string }[] = [];
                let match: RegExpExecArray | null;

                while ((match = regex.exec(text)) !== null) {
                  substituicoes.push({ pos: match.index, fim: match.index + match[0].length, padrao: match[0] });
                }

                if (substituicoes.length === 0) return;

                const bookmark = editor.selection.getBookmark(2, true);

                const fragment = document.createDocumentFragment();
                let cursor = 0;
                for (const s of substituicoes) {
                  if (s.pos > cursor) {
                    fragment.appendChild(document.createTextNode(text.substring(cursor, s.pos)));
                  }
                  const span = document.createElement('span');
                  span.className = 'campo-reservado';
                  span.setAttribute('data-reservado', 'true');
                  span.textContent = s.padrao;
                  fragment.appendChild(span);
                  cursor = s.fim;
                }
                if (cursor < text.length) {
                  fragment.appendChild(document.createTextNode(text.substring(cursor)));
                }

                textNode.parentNode?.replaceChild(fragment, textNode);

                editor.selection.moveToBookmark(bookmark);
              };

              editor.on('input', () => {
                if (reservadoTimer) clearTimeout(reservadoTimer);
                reservadoTimer = setTimeout(converterReservadoLocal, 600);
              });

              editor.on('remove', () => {
                if (reservadoTimer) clearTimeout(reservadoTimer);
              });
            }
            registrarInicializacao('editor_setup_concluido', { tentativaInterna: tentativaInicializacao });
          },
        }}
      />}
      </div>
    </div>
  );
};
