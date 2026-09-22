import type { Editor as TinyMceEditorInstance } from 'tinymce';

export type ModoVisualizacaoPlaceholders = 'dados' | 'chaves';

export interface PlaceholderPersonalizadoVisualizacao {
  chave: string;
  descricao?: string | null;
}

export interface ValorPlaceholderVisualizacao {
  valor: string;
  preenchido: boolean;
  formato: 'texto' | 'html' | 'html-inline';
}

export interface ResultadoAplicacaoPlaceholders {
  estado: 'aplicado' | 'adiado' | 'falhou';
  processados: number;
  falhas: number;
  previasCriadas: number;
  previasRemovidas: number;
  tabelas: number;
  linhas: number;
  celulas: number;
  tabelasPersonalizadas: number;
  erro?: string;
}

interface OpcoesAplicacaoPlaceholders {
  modo: ModoVisualizacaoPlaceholders;
  valores: Record<string, ValorPlaceholderVisualizacao>;
  placeholdersPersonalizados: PlaceholderPersonalizadoVisualizacao[];
  descreverPendente: (chave: string, placeholders: PlaceholderPersonalizadoVisualizacao[], valores: Record<string, ValorPlaceholderVisualizacao>) => string;
}

interface OpcoesAgendamentoPlaceholders extends OpcoesAplicacaoPlaceholders {
  aoFalharDefinitivamente?: (resultado: ResultadoAplicacaoPlaceholders) => void;
}

const agendamentos = new WeakMap<TinyMceEditorInstance, ReturnType<typeof setTimeout>>();

const SELETOR_PREVIA_TABELA = '[data-placeholder-preview="true"][data-placeholder-preview-tabela="true"]';
const SELETOR_TABELA_PERSONALIZADA = '[data-placeholder-tabela-personalizada="true"]';
const SELETOR_ACAO_TABELA = '[data-acao-tabela-placeholder]';
let sequenciaIdentificadorTabela = 0;

function obterChavePlaceholder(valor: string): string | null {
  return valor.match(/^\{\{(.+)\}\}$/)?.[1] || null;
}

function criarIdentificadorTabela(): string {
  sequenciaIdentificadorTabela += 1;
  return `${crypto.randomUUID()}-${sequenciaIdentificadorTabela}`;
}

function encontrarAncoraTabelaPersonalizada(
  raiz: ParentNode,
  identificador: string,
): HTMLElement | null {
  return Array.from(raiz.querySelectorAll<HTMLElement>('[data-placeholder-tabela-personalizada-id]'))
    .find(ancora => ancora.getAttribute('data-placeholder-tabela-personalizada-id') === identificador) || null;
}

function prepararCelulasTabela(tabela: HTMLTableElement, editavel: boolean): void {
  tabela.querySelectorAll<HTMLElement>('th').forEach(celula => {
    celula.setAttribute('data-placeholder-celula-fixa', 'true');
    celula.setAttribute('contenteditable', 'false');
  });
  tabela.querySelectorAll<HTMLElement>('td').forEach(celula => {
    const fixa = celula.getAttribute('data-placeholder-celula-fixa') === 'true';
    if (!fixa) celula.setAttribute('data-placeholder-celula-valor', 'true');
    celula.setAttribute('contenteditable', fixa || !editavel ? 'false' : 'true');
  });
}

interface ContadoresTabelas {
  tabelas: number;
  linhas: number;
  celulas: number;
}

function prepararTabelas(raiz: HTMLElement, editavel: boolean, contadores?: ContadoresTabelas): boolean {
  const tabelas = Array.from(raiz.querySelectorAll<HTMLTableElement>('table'));
  tabelas.forEach(tabela => {
    prepararCelulasTabela(tabela, editavel);
    if (contadores) {
      contadores.tabelas += 1;
      contadores.linhas += tabela.querySelectorAll('tr').length;
      contadores.celulas += tabela.querySelectorAll('td, th').length;
    }
  });
  return tabelas.length > 0;
}

function removerAcoesTabela(raiz: HTMLElement): void {
  raiz.querySelectorAll(SELETOR_ACAO_TABELA).forEach(acao => acao.remove());
}

function adicionarAcaoTabela(
  raiz: HTMLElement,
  acao: 'personalizar' | 'restaurar',
): void {
  removerAcoesTabela(raiz);
  const documento = raiz.ownerDocument;
  const controle = documento.createElement('span');
  controle.className = 'acao-tabela-placeholder';
  controle.setAttribute('contenteditable', 'false');
  controle.setAttribute('data-mce-bogus', 'all');
  controle.setAttribute('data-acao-tabela-placeholder', acao);
  controle.setAttribute('role', 'button');
  controle.setAttribute('tabindex', '0');
  controle.setAttribute('aria-label', acao === 'personalizar' ? 'Editar' : 'Restaurar dados da REP');
  controle.setAttribute('title', acao === 'personalizar'
    ? 'Transformar esta tabela em uma cópia editável do laudo'
    : 'Descartar alterações locais e restaurar dados atuais da REP');
  controle.textContent = acao === 'personalizar' ? 'Editar' : 'Restaurar dados da REP';
  const excluir = documento.createElement('span');
  excluir.className = 'acao-tabela-placeholder acao-tabela-placeholder-excluir';
  excluir.setAttribute('contenteditable', 'false');
  excluir.setAttribute('data-mce-bogus', 'all');
  excluir.setAttribute('data-acao-tabela-placeholder', 'excluir');
  excluir.setAttribute('role', 'button');
  excluir.setAttribute('tabindex', '0');
  excluir.setAttribute('aria-label', 'Excluir tabela do placeholder');
  excluir.setAttribute('title', 'Excluir tabela do placeholder deste laudo');
  excluir.textContent = '×';
  raiz.prepend(controle, excluir);
}

function configurarTabelaPersonalizada(tabela: HTMLElement, contadores?: ContadoresTabelas): void {
  tabela.classList.add('placeholder-tabela-personalizada');
  prepararTabelas(tabela, true, contadores);
  adicionarAcaoTabela(tabela, 'restaurar');
}

function configurarPreviaTabela(tabela: HTMLElement, contadores?: ContadoresTabelas): boolean {
  const possuiTabela = prepararTabelas(tabela, false, contadores);
  if (possuiTabela) adicionarAcaoTabela(tabela, 'personalizar');
  return possuiTabela;
}

export function encontrarAcaoTabelaPlaceholder(alvo: EventTarget | null): HTMLElement | null {
  if (alvo === null || typeof alvo !== 'object' || !('closest' in alvo)) return null;
  const closest = (alvo as { closest?: unknown }).closest;
  return typeof closest === 'function'
    ? (closest.call(alvo, SELETOR_ACAO_TABELA) as HTMLElement | null)
    : null;
}

export function personalizarTabelaPlaceholder(
  editor: TinyMceEditorInstance,
  acao: HTMLElement,
): boolean {
  const previa = acao.closest<HTMLElement>(SELETOR_PREVIA_TABELA);
  const body = editor.getBody();
  if (!previa || !body) return false;

  const identificador = previa.getAttribute('data-placeholder-preview-id');
  if (!identificador) return false;
  const ancora = body.querySelector<HTMLElement>(`[data-placeholder][data-placeholder-preview-id="${identificador}"]`);
  if (!ancora) return false;

  editor.undoManager.transact(() => {
    previa.removeAttribute('data-placeholder-preview');
    previa.removeAttribute('data-placeholder-preview-for');
    previa.removeAttribute('data-placeholder-preview-tabela');
    previa.removeAttribute('contenteditable');
    previa.setAttribute('data-placeholder-tabela-personalizada', 'true');
    previa.setAttribute('data-placeholder-tabela-personalizada-id', identificador);
    ancora.setAttribute('data-placeholder-tabela-personalizada-id', identificador);
    ancora.style.display = 'none';
    configurarTabelaPersonalizada(previa);
  });
  return true;
}

export function restaurarTabelaPlaceholder(
  editor: TinyMceEditorInstance,
  acao: HTMLElement,
): boolean {
  const tabela = acao.closest<HTMLElement>(SELETOR_TABELA_PERSONALIZADA);
  const body = editor.getBody();
  if (!tabela || !body) return false;

  const identificador = tabela.getAttribute('data-placeholder-tabela-personalizada-id');
  if (!identificador) return false;
  const ancora = encontrarAncoraTabelaPersonalizada(body, identificador);
  if (!ancora) return false;

  editor.undoManager.transact(() => {
    tabela.remove();
    ancora.removeAttribute('data-placeholder-tabela-personalizada-id');
    ancora.style.removeProperty('display');
  });
  return true;
}

export function excluirTabelaPlaceholder(
  editor: TinyMceEditorInstance,
  acao: HTMLElement,
): boolean {
  const tabela = acao.closest<HTMLElement>(`${SELETOR_PREVIA_TABELA}, ${SELETOR_TABELA_PERSONALIZADA}`);
  const body = editor.getBody();
  if (!tabela || !body || !body.contains(tabela)) return false;

  const personalizada = tabela.matches(SELETOR_TABELA_PERSONALIZADA);
  const identificador = tabela.getAttribute(personalizada
    ? 'data-placeholder-tabela-personalizada-id'
    : 'data-placeholder-preview-id');
  if (!identificador) return false;
  const ancora = personalizada
    ? encontrarAncoraTabelaPersonalizada(body, identificador)
    : Array.from(body.querySelectorAll<HTMLElement>('[data-placeholder][data-placeholder-preview-id]'))
      .find(elemento => elemento.getAttribute('data-placeholder-preview-id') === identificador) || null;
  if (!ancora) return false;

  editor.undoManager.transact(() => {
    const paragrafo = ancora.parentElement;
    if (paragrafo?.tagName === 'P' && Array.from(paragrafo.childNodes).every(no =>
      no === ancora || (no.nodeType === Node.TEXT_NODE && !no.textContent?.trim()))) {
      paragrafo.remove();
    } else {
      ancora.remove();
    }
    tabela.remove();
  });
  return true;
}

function editorPronto(editor: TinyMceEditorInstance): boolean {
  const body = editor.getBody();
  return editor.initialized && !editor.destroyed && !editor.removed && Boolean(body?.isConnected);
}

function mensagemErro(erro: unknown): string {
  return erro instanceof Error && erro.message ? erro.message : 'Erro inesperado ao atualizar placeholders.';
}

function registrarFalha(chave: string, erro: unknown): void {
  console.warn('Falha ao atualizar placeholder visualmente.', {
    chave,
    erro: mensagemErro(erro),
  });
}

function criarResultado(estado: ResultadoAplicacaoPlaceholders['estado'], contadores: ResultadoAplicacaoPlaceholders, erro?: string): ResultadoAplicacaoPlaceholders {
  return { ...contadores, estado, erro };
}

function criarContadores(tabelasPersonalizadas: number): ResultadoAplicacaoPlaceholders {
  return {
    estado: 'aplicado', processados: 0, falhas: 0, previasCriadas: 0,
    previasRemovidas: 0, tabelas: 0, linhas: 0, celulas: 0, tabelasPersonalizadas,
  };
}

function registrarDesempenhoPlaceholders(
  duracaoMs: number,
  resultado: ResultadoAplicacaoPlaceholders,
  operacao: 'aplicar_visualizacao_incremental' | 'aplicar_visualizacao_completa' | 'fallback_visualizacao_completa',
  chave?: string | null,
): void {
  window.ipcAPI?.desempenho?.registrar({
    origem: 'placeholder', categoria: 'visualizacao', evento: resultado.estado,
    operacao, duracaoMs,
    metadados: {
      placeholders: resultado.processados,
      previasCriadas: resultado.previasCriadas,
      previasRemovidas: resultado.previasRemovidas,
      tabelas: resultado.tabelas,
      linhas: resultado.linhas,
      celulas: resultado.celulas,
      tabelasPersonalizadas: resultado.tabelasPersonalizadas,
      incremental: operacao === 'aplicar_visualizacao_incremental',
      tabelaB602: chave === 'b602_tabela_material_enc',
      fallback: operacao === 'fallback_visualizacao_completa',
      falhou: resultado.estado === 'falhou',
    },
  });
}

interface ContextoProcessamentoPlaceholder {
  body: HTMLElement;
  opcoes: OpcoesAplicacaoPlaceholders;
  tabelasPersonalizadas: Map<string, HTMLElement>;
  resultado: ResultadoAplicacaoPlaceholders;
}

function limparApresentacaoAncora(ancora: HTMLElement): void {
  ancora.classList.remove('campo-reservado');
  ancora.removeAttribute('data-reservado');
  ancora.removeAttribute('data-placeholder-apresentacao');
  ancora.removeAttribute('data-tooltip-xxx');
  ancora.removeAttribute('data-origem-xxx');
  ancora.removeAttribute('title');
  ancora.removeAttribute('aria-label');
  ancora.style.removeProperty('display');
}

function removerPreviaDaAncora(body: HTMLElement, ancora: HTMLElement, resultado: ResultadoAplicacaoPlaceholders): void {
  const identificador = ancora.getAttribute('data-placeholder-preview-id');
  if (!identificador) return;
  const previa = Array.from(body.querySelectorAll<HTMLElement>('[data-placeholder-preview="true"]'))
    .find(elemento => elemento.getAttribute('data-placeholder-preview-id') === identificador);
  if (previa) {
    previa.remove();
    resultado.previasRemovidas += 1;
  }
  ancora.removeAttribute('data-placeholder-preview-id');
}

function processarAncoraPlaceholder(ancora: HTMLElement, contexto: ContextoProcessamentoPlaceholder): void {
  const { body, opcoes, tabelasPersonalizadas, resultado } = contexto;
  const copiaOriginal = ancora.cloneNode(true) as HTMLElement;
  const chaveBruta = ancora.getAttribute('data-placeholder') || '';
  const chave = obterChavePlaceholder(chaveBruta);
  if (!chave) return;

  try {
    const resolvido = opcoes.valores[chave];
    const identificadorPersonalizado = ancora.getAttribute('data-placeholder-tabela-personalizada-id');
    const tabelaPersonalizada = identificadorPersonalizado
      ? tabelasPersonalizadas.get(identificadorPersonalizado)
      : null;

    if (tabelaPersonalizada) {
      if (opcoes.modo === 'chaves') {
        tabelaPersonalizada.style.display = 'none';
        ancora.textContent = chaveBruta;
        ancora.style.removeProperty('display');
      } else {
        configurarTabelaPersonalizada(tabelaPersonalizada, resultado);
        tabelaPersonalizada.style.removeProperty('display');
        ancora.style.display = 'none';
      }
      resultado.processados += 1;
      return;
    }

    limparApresentacaoAncora(ancora);
    if (opcoes.modo === 'chaves') {
      ancora.textContent = chaveBruta;
    } else if (!resolvido?.preenchido) {
      const aviso = opcoes.descreverPendente(chave, opcoes.placeholdersPersonalizados, opcoes.valores);
      ancora.textContent = 'XXX';
      ancora.classList.add('campo-reservado');
      ancora.setAttribute('data-reservado', 'true');
      ancora.setAttribute('data-placeholder-apresentacao', 'dados');
      ancora.setAttribute('data-tooltip-xxx', 'true');
      ancora.setAttribute('data-origem-xxx', 'rep');
      ancora.setAttribute('title', aviso);
      ancora.setAttribute('aria-label', aviso);
    } else if (resolvido.formato === 'html') {
      const id = criarIdentificadorTabela();
      const documento = body.ownerDocument;
      if (!documento) throw new Error('Documento do editor indisponível.');
      const preview = documento.createElement('div');
      preview.setAttribute('contenteditable', 'false');
      preview.setAttribute('data-placeholder-preview', 'true');
      preview.setAttribute('data-placeholder-preview-for', id);
      preview.setAttribute('data-placeholder-preview-id', id);
      preview.style.width = '100%';
      preview.style.maxWidth = '100%';
      preview.style.minWidth = '0';
      preview.style.alignSelf = 'stretch';
      preview.style.boxSizing = 'border-box';
      preview.innerHTML = resolvido.valor;
      preview.querySelectorAll('table').forEach(tabela => {
        tabela.setAttribute('width', '100%');
        tabela.style.setProperty('width', '100%', 'important');
        tabela.style.setProperty('max-width', '100%', 'important');
      });
      resultado.previasCriadas += 1;
      if (configurarPreviaTabela(preview, resultado)) {
        preview.setAttribute('data-placeholder-preview-tabela', 'true');
      }
      ancora.setAttribute('data-placeholder-preview-id', id);
      ancora.style.display = 'none';
      ancora.parentElement?.insertAdjacentElement('afterend', preview);
    } else if (resolvido.formato === 'html-inline') {
      ancora.innerHTML = resolvido.valor;
      ancora.setAttribute('data-placeholder-apresentacao', 'dados');
    } else {
      ancora.textContent = resolvido.valor;
      ancora.setAttribute('data-placeholder-apresentacao', 'dados');
    }
    resultado.processados += 1;
  } catch (erro) {
    ancora.replaceWith(copiaOriginal);
    resultado.falhas += 1;
    registrarFalha(chave, erro);
  }
}

function criarMapaTabelasPersonalizadas(body: HTMLElement): Map<string, HTMLElement> {
  const tabelas = new Map<string, HTMLElement>();
  body.querySelectorAll<HTMLElement>(SELETOR_TABELA_PERSONALIZADA).forEach(tabela => {
    const identificador = tabela.getAttribute('data-placeholder-tabela-personalizada-id');
    if (identificador) tabelas.set(identificador, tabela);
  });
  return tabelas;
}

export function aplicarVisualizacaoPlaceholders(
  editor: TinyMceEditorInstance,
  opcoes: OpcoesAplicacaoPlaceholders,
): ResultadoAplicacaoPlaceholders {
  const inicio = performance.now();
  if (!editorPronto(editor)) {
    return criarResultado('adiado', criarContadores(0));
  }

  const body = editor.getBody();
  if (!body) return criarResultado('adiado', criarContadores(0));

  const tabelasPersonalizadas = criarMapaTabelasPersonalizadas(body);
  const resultado = criarContadores(tabelasPersonalizadas.size);

  try {
    editor.undoManager.ignore(() => {
      const previas = body.querySelectorAll('[data-placeholder-preview="true"]');
      resultado.previasRemovidas = previas.length;
      previas.forEach(preview => preview.remove());
      body.querySelectorAll<HTMLElement>('[data-tooltip-xxx="true"]').forEach(elemento => {
        elemento.removeAttribute('data-tooltip-xxx');
        elemento.removeAttribute('data-origem-xxx');
        elemento.removeAttribute('title');
        elemento.removeAttribute('aria-label');
      });

      body.querySelectorAll<HTMLElement>('[data-placeholder]').forEach(ancora => {
        ancora.removeAttribute('data-placeholder-preview-id');
        processarAncoraPlaceholder(ancora, { body, opcoes, tabelasPersonalizadas, resultado });
      });

      body.querySelectorAll<HTMLElement>('[data-reservado="true"]:not([data-placeholder])').forEach(campo => {
        try {
          if (campo.textContent?.trim().toUpperCase() !== 'XXX') return;
          const aviso = 'Campo de preenchimento manual no template';
          campo.setAttribute('data-tooltip-xxx', 'true');
          campo.setAttribute('data-origem-xxx', 'template');
          campo.setAttribute('title', aviso);
          campo.setAttribute('aria-label', aviso);
        } catch (erro) {
          resultado.falhas += 1;
          registrarFalha('campo-manual', erro);
        }
      });
    });
  } catch (erro) {
    const mensagem = mensagemErro(erro);
    console.warn('Falha ao preparar a visualização dos placeholders.', { erro: mensagem });
    resultado.falhas += 1;
    const resultadoComErro = criarResultado('falhou', resultado, mensagem);
    registrarDesempenhoPlaceholders(performance.now() - inicio, resultadoComErro, 'aplicar_visualizacao_completa');
    return resultadoComErro;
  }

  const resultadoFinal = criarResultado(resultado.falhas ? 'falhou' : 'aplicado', resultado);
  registrarDesempenhoPlaceholders(performance.now() - inicio, resultadoFinal, 'aplicar_visualizacao_completa');
  return resultadoFinal;
}

export function aplicarVisualizacaoPlaceholder(
  editor: TinyMceEditorInstance,
  ancora: HTMLElement,
  opcoes: OpcoesAplicacaoPlaceholders,
): ResultadoAplicacaoPlaceholders {
  const inicio = performance.now();
  const chave = obterChavePlaceholder(ancora.getAttribute('data-placeholder') || '');
  if (!editorPronto(editor)) return criarResultado('adiado', criarContadores(0));

  const body = editor.getBody();
  if (!body || !body.contains(ancora)) return criarResultado('adiado', criarContadores(0));

  const tabelasPersonalizadas = criarMapaTabelasPersonalizadas(body);
  const resultado = criarContadores(tabelasPersonalizadas.size);
  try {
    editor.undoManager.ignore(() => {
      removerPreviaDaAncora(body, ancora, resultado);
      processarAncoraPlaceholder(ancora, { body, opcoes, tabelasPersonalizadas, resultado });
    });
  } catch (erro) {
    const mensagem = mensagemErro(erro);
    resultado.falhas += 1;
    const resultadoComErro = criarResultado('falhou', resultado, mensagem);
    registrarDesempenhoPlaceholders(performance.now() - inicio, resultadoComErro, 'aplicar_visualizacao_incremental', chave);
    return resultadoComErro;
  }

  const resultadoFinal = criarResultado(resultado.falhas ? 'falhou' : 'aplicado', resultado);
  registrarDesempenhoPlaceholders(performance.now() - inicio, resultadoFinal, 'aplicar_visualizacao_incremental', chave);
  return resultadoFinal;
}

export function agendarVisualizacaoPlaceholders(
  editor: TinyMceEditorInstance,
  opcoes: OpcoesAgendamentoPlaceholders,
  tentativa = 0,
): void {
  const anterior = agendamentos.get(editor);
  if (anterior) clearTimeout(anterior);

  const agendamento = setTimeout(() => {
    agendamentos.delete(editor);
    const resultado = aplicarVisualizacaoPlaceholders(editor, opcoes);
    if (tentativa > 0) window.ipcAPI?.desempenho?.registrar({ origem: 'placeholder', categoria: 'visualizacao', evento: 'tentativa_repetida', operacao: 'agendar_visualizacao', metadados: { tentativas: tentativa + 1 } });
    if ((resultado.estado === 'adiado' || resultado.estado === 'falhou') && tentativa === 0) {
      agendarVisualizacaoPlaceholders(editor, opcoes, 1);
      return;
    }
    if (resultado.estado === 'falhou') opcoes.aoFalharDefinitivamente?.(resultado);
  }, tentativa === 0 ? 0 : 150);

  agendamentos.set(editor, agendamento);
}
