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

function obterChavePlaceholder(valor: string): string | null {
  return valor.match(/^\{\{(.+)\}\}$/)?.[1] || null;
}

function criarIdentificadorTabela(): string {
  return crypto.randomUUID();
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

function prepararTabelas(raiz: HTMLElement, editavel: boolean): boolean {
  const tabelas = Array.from(raiz.querySelectorAll<HTMLTableElement>('table'));
  tabelas.forEach(tabela => prepararCelulasTabela(tabela, editavel));
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
  controle.setAttribute('aria-label', acao === 'personalizar' ? 'Personalizar tabela' : 'Restaurar dados da REP');
  controle.setAttribute('title', acao === 'personalizar'
    ? 'Transformar esta tabela em uma cópia editável do laudo'
    : 'Descartar alterações locais e restaurar dados atuais da REP');
  controle.textContent = acao === 'personalizar' ? 'Personalizar tabela' : 'Restaurar dados da REP';
  raiz.prepend(controle);
}

function configurarTabelaPersonalizada(tabela: HTMLElement): void {
  tabela.classList.add('placeholder-tabela-personalizada');
  prepararTabelas(tabela, true);
  adicionarAcaoTabela(tabela, 'restaurar');
}

function configurarPreviaTabela(tabela: HTMLElement): boolean {
  const possuiTabela = prepararTabelas(tabela, false);
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

export function aplicarVisualizacaoPlaceholders(
  editor: TinyMceEditorInstance,
  opcoes: OpcoesAplicacaoPlaceholders,
): ResultadoAplicacaoPlaceholders {
  if (!editorPronto(editor)) {
    return { estado: 'adiado', processados: 0, falhas: 0 };
  }

  const body = editor.getBody();
  if (!body) return { estado: 'adiado', processados: 0, falhas: 0 };

  let processados = 0;
  let falhas = 0;

  try {
    editor.undoManager.ignore(() => {
      body.querySelectorAll('[data-placeholder-preview="true"]').forEach(preview => preview.remove());
      body.querySelectorAll<HTMLElement>('[data-tooltip-xxx="true"]').forEach(elemento => {
        elemento.removeAttribute('data-tooltip-xxx');
        elemento.removeAttribute('data-origem-xxx');
        elemento.removeAttribute('title');
        elemento.removeAttribute('aria-label');
      });

      body.querySelectorAll<HTMLElement>('[data-placeholder]').forEach(ancora => {
        const copiaOriginal = ancora.cloneNode(true) as HTMLElement;
        const chaveBruta = ancora.getAttribute('data-placeholder') || '';
        const chave = obterChavePlaceholder(chaveBruta);
        if (!chave) return;

        try {
          const resolvido = opcoes.valores[chave];
          const identificadorPersonalizado = ancora.getAttribute('data-placeholder-tabela-personalizada-id');
          const tabelaPersonalizada = identificadorPersonalizado
            ? Array.from(body.querySelectorAll<HTMLElement>(SELETOR_TABELA_PERSONALIZADA))
              .find(tabela => tabela.getAttribute('data-placeholder-tabela-personalizada-id') === identificadorPersonalizado)
            : null;

          if (tabelaPersonalizada) {
            if (opcoes.modo === 'chaves') {
              tabelaPersonalizada.style.display = 'none';
              ancora.textContent = chaveBruta;
              ancora.style.removeProperty('display');
            } else {
              configurarTabelaPersonalizada(tabelaPersonalizada);
              tabelaPersonalizada.style.removeProperty('display');
              ancora.style.display = 'none';
            }
            processados += 1;
            return;
          }

          ancora.classList.remove('campo-reservado');
          ancora.removeAttribute('data-reservado');
          ancora.removeAttribute('data-placeholder-apresentacao');
          ancora.style.removeProperty('display');

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
            if (configurarPreviaTabela(preview)) {
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
          processados += 1;
        } catch (erro) {
          ancora.replaceWith(copiaOriginal);
          falhas += 1;
          registrarFalha(chave, erro);
        }
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
          falhas += 1;
          registrarFalha('campo-manual', erro);
        }
      });
    });
  } catch (erro) {
    const mensagem = mensagemErro(erro);
    console.warn('Falha ao preparar a visualização dos placeholders.', { erro: mensagem });
    return { estado: 'falhou', processados, falhas: falhas + 1, erro: mensagem };
  }

  return { estado: falhas ? 'falhou' : 'aplicado', processados, falhas };
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
    if ((resultado.estado === 'adiado' || resultado.estado === 'falhou') && tentativa === 0) {
      agendarVisualizacaoPlaceholders(editor, opcoes, 1);
      return;
    }
    if (resultado.estado === 'falhou') opcoes.aoFalharDefinitivamente?.(resultado);
  }, tentativa === 0 ? 0 : 150);

  agendamentos.set(editor, agendamento);
}
