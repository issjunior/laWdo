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
        const chave = chaveBruta.match(/^\{\{(.+)\}\}$/)?.[1];
        if (!chave) return;

        try {
          const resolvido = opcoes.valores[chave];
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
            const id = `placeholder-preview-${chave.replace(/[^a-z0-9_-]/gi, '-')}`;
            const documento = body.ownerDocument;
            if (!documento) throw new Error('Documento do editor indisponível.');
            const preview = documento.createElement('div');
            preview.setAttribute('contenteditable', 'false');
            preview.setAttribute('data-placeholder-preview', 'true');
            preview.setAttribute('data-placeholder-preview-for', id);
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
