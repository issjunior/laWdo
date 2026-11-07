import type { Editor } from 'tinymce';
import { personalizarTabelaPlaceholder } from './apresentacao-placeholders';
import { normalizarConteudoComparavel } from './conteudo-comparavel-laudo';
import { registrarPreparacaoConteudo } from './preparacao-conteudo-editor';

const SELETOR_PREVIA = '[data-placeholder-preview-tabela="true"]';

export function registrarEdicaoDiretaLaudo(editor: Editor): void {
  const corpo = editor.getBody();
  corpo.setAttribute('data-laudo-edicao-direta', 'true');
  const referencias = new Map<HTMLElement, { html: string; ancora: HTMLElement | null }>();
  const alteradas = new Set<HTMLElement>();
  let pronto = false;
  let processando = false;
  let encerrado = false;
  const assinatura = (previa: HTMLElement) => {
    const copia = previa.cloneNode(true) as HTMLElement;
    copia.querySelectorAll('[data-mce-bogus="all"], [data-controles-conteudo], [data-acao-tabela-placeholder]').forEach(no => no.remove());
    copia.querySelectorAll('[contenteditable]').forEach(no => no.removeAttribute('contenteditable'));
    return normalizarConteudoComparavel(copia.innerHTML);
  };
  const atualizarReferencias = () => {
    referencias.clear();
    alteradas.clear();
    corpo.querySelectorAll<HTMLElement>(SELETOR_PREVIA).forEach(previa => {
      const id = previa.getAttribute('data-placeholder-preview-id');
      const ancora = Array.from(corpo.querySelectorAll<HTMLElement>('[data-placeholder][data-placeholder-preview-id]'))
        .find(item => item.getAttribute('data-placeholder-preview-id') === id) ?? null;
      referencias.set(previa, { html: assinatura(previa), ancora });
    });
  };
  const coletar = (registros: MutationRecord[]) => {
    for (const registro of registros) {
      const elemento = registro.target.nodeType === 1 ? registro.target as Element : registro.target.parentElement;
      const previa = elemento?.closest<HTMLElement>(SELETOR_PREVIA);
      if (previa && referencias.has(previa)) alteradas.add(previa);
    }
  };
  const observador = new MutationObserver(coletar);
  observador.observe(corpo, { subtree: true, childList: true, characterData: true, attributes: true });

  const materializar = (): boolean => {
    if (encerrado || processando || editor.mode.isReadOnly()) return false;
    coletar(observador.takeRecords());
    if (!pronto) { atualizarReferencias(); return false; }
    let alterou = false;
    processando = true;
    try {
      editor.undoManager.ignore(() => {
        for (const [previa, referencia] of referencias) {
          if (!previa.matches(SELETOR_PREVIA)) { referencias.delete(previa); continue; }
          if (!corpo.contains(previa)) {
            // Excluir toda a prévia também precisa excluir sua âncora para não recriá-la ao reabrir.
            if (referencia.ancora && corpo.contains(referencia.ancora)) referencia.ancora.remove();
            referencias.delete(previa);
            alterou = true;
          } else if (alteradas.has(previa) && assinatura(previa) !== referencia.html) {
            if (!personalizarTabelaPlaceholder(editor, previa)) throw new Error('Não foi possível preservar a edição da tabela no laudo.');
            referencias.delete(previa);
            alterou = true;
          }
        }
      });
      alteradas.clear();
      if (alterou) editor.dispatch('ConteudoInterativoAlterado');
      return alterou;
    } finally { processando = false; }
  };

  const preparar = () => {
    if (encerrado) return;
    // Recriações de apresentação e restaurações do undo estabelecem novas referências por identidade.
    observador.takeRecords();
    atualizarReferencias();
  };
  editor.on('LaudoPreparado', () => { preparar(); pronto = true; });
  editor.on('SetContent', evento => {
    if (evento.selection) materializar();
    else preparar();
  });
  editor.on('LoadContent PlaceholdersAplicados', preparar);
  editor.on('BeforeGetContent', () => { materializar(); });
  editor.on('BeforeAddUndo', evento => {
    if (!materializar()) return;
    // O nível original foi capturado antes da materialização; recriá-lo agrega vínculo e edição no mesmo undo.
    evento.preventDefault();
    editor.undoManager.add(undefined, evento.originalEvent);
  });
  const aoDigitar = () => { materializar(); };
  editor.getDoc().addEventListener('input', aoDigitar, true);
  registrarPreparacaoConteudo(editor, () => {
    if (encerrado) return;
    corpo.querySelectorAll<HTMLElement>(SELETOR_PREVIA).forEach(previa => {
      if (!referencias.has(previa)) {
        const id = previa.getAttribute('data-placeholder-preview-id');
        referencias.set(previa, { html: assinatura(previa), ancora: Array.from(corpo.querySelectorAll<HTMLElement>('[data-placeholder]'))
          .find(item => item.getAttribute('data-placeholder-preview-id') === id) ?? null });
      }
    });
  }, 20);
  preparar();
  editor.on('remove', () => {
    encerrado = true;
    observador.disconnect();
    editor.getDoc().removeEventListener('input', aoDigitar, true);
    referencias.clear();
    alteradas.clear();
  });
}
