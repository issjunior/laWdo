import { medirOperacaoEditorLaudo } from './desempenho-editor-laudo';
import { limparConteudoInterativo } from './conteudo-interativo-limpeza';
import type { Editor } from 'tinymce';
import { toast } from 'sonner';
import { obterAdaptadorConteudo, SELETOR_SELECAO_PONTUAL } from './adaptadores-conteudo-laudo';
import { permiteEdicaoCampo, SELETOR_BLOCO_PROTEGIDO } from './politica-edicao-conteudo';
import { registrarPreparacaoConteudo } from './preparacao-conteudo-editor';

export type ResultadoAcaoConteudo = 'aplicada' | 'cancelada' | 'indisponivel' | 'falha';
const seletor = SELETOR_BLOCO_PROTEGIDO;
const estilos = new WeakMap<Document, string>();
function instalarEstilos(editor: Editor) {
  const origem = document;
  let css = estilos.get(origem);
  if (!css) {
    const regras: string[] = [];
    const visitar = (lista: CSSRuleList) => {
      for (const regra of Array.from(lista)) {
        if (regra instanceof CSSStyleRule && regra.selectorText.includes('conteudo-laudo')) regras.push(regra.cssText);
        else if ('cssRules' in regra) visitar((regra as CSSGroupingRule).cssRules);
      }
    };
    for (const folha of Array.from(origem.styleSheets)) { try { visitar(folha.cssRules); } catch { continue; } }
    css = regras.join('\n');
    if (css) estilos.set(origem, css);
  }
  editor.dom.addStyle(css);
}

export function registrarConteudoInterativo(editor: Editor, opcoes: {
  laudoId?: string;
  confirmar: (mensagem: string) => Promise<boolean>;
  aoAlterar: (html: string) => void;
  aoRestaurar: () => void;
}) {
  instalarEstilos(editor);
  const edicoes = new WeakSet<HTMLElement>();
  const identidades = new WeakMap<HTMLElement, string>();
  let encerrado = false;
  let processando = false;
  const documento = editor.getDoc();
  const janela = documento.defaultView;
  if (!janela) return;
  const identidade = (alvo: HTMLElement) => {
    let id = identidades.get(alvo);
    if (!id) { id = crypto.randomUUID(); identidades.set(alvo, id); }
    return id;
  };
  const sincronizar = (raiz = editor.getBody()) => medirOperacaoEditorLaudo('sincronizar_conteudo_interativo', () => {
    if (encerrado) return;
    editor.undoManager.ignore(() => {
      const alvos = [...(raiz.matches(seletor) ? [raiz] : []), ...raiz.querySelectorAll<HTMLElement>(seletor)];
      alvos.forEach(alvo => {
        const adaptador = obterAdaptadorConteudo(alvo);
        if (!adaptador) return;
        const condicional = adaptador.categoria === 'condicional';
        const grupo = adaptador.categoria === 'descricao';
        if (adaptador.agrupaDescendentes && alvo.parentElement?.closest(adaptador.seletor)) return;
        const editando = edicoes.has(alvo);
        const leitura = editor.mode.isReadOnly();
        alvo.classList.add('conteudo-laudo');
        alvo.classList.toggle('conteudo-laudo-rep', !condicional && !grupo);
        alvo.classList.toggle('conteudo-laudo-condicional', condicional);
        alvo.classList.toggle('conteudo-laudo-editando', editando);
        alvo.querySelectorAll(':scope > [data-acao-tabela-placeholder], :scope > [data-controles-bloco-condicional]').forEach(no => no.remove());
        alvo.setAttribute('contenteditable', String(editando && !leitura));
        if (condicional) { if (editando) alvo.setAttribute('data-cond-em-edicao', 'true'); else alvo.removeAttribute('data-cond-em-edicao'); }
        alvo.querySelectorAll<HTMLElement>('td, th, select').forEach(celula => {
          if (celula.closest('.conteudo-laudo') !== alvo || celula.closest('[data-b601-complemento]')) return;
          if (celula.tagName === 'SELECT') (celula as HTMLSelectElement).disabled = !permiteEdicaoCampo(celula.parentElement || celula, leitura, Boolean(celula.closest(SELETOR_SELECAO_PONTUAL)));
          else celula.setAttribute('contenteditable', String(!leitura && editando && celula.tagName !== 'TH' && celula.getAttribute('data-placeholder-celula-fixa') !== 'true'));
        });
        let controles = alvo.querySelector<HTMLElement>(':scope > [data-controles-conteudo]');
        const assinatura = `${editando}:${leitura}:${processando}:${condicional}:${grupo}:${alvo.hasAttribute('data-placeholder-tabela-personalizada')}`;
        if (controles?.getAttribute('data-estado') === assinatura) return;
        controles?.remove();
        controles = documento.createElement('span');
        controles.className = 'conteudo-laudo-controles';
        controles.setAttribute('data-controles-conteudo', 'true');
        controles.setAttribute('data-mce-bogus', 'all');
        controles.setAttribute('contenteditable', 'false');
        controles.setAttribute('data-estado', assinatura);
        const estado = documento.createElement('span');
        estado.textContent = editando ? 'Em edição' : condicional ? 'Bloco condicional' : grupo ? 'Descrição pericial' : 'Dados da REP';
        controles.append(estado);
        for (const acao of ['editar', 'restaurar', 'excluir'] as const) {
          const botao = documento.createElement('button');
          botao.type = 'button';
          botao.textContent = acao === 'editar' ? editando ? 'Concluir' : 'Editar' : acao === 'restaurar' ? 'Restaurar dados da REP' : 'Excluir';
          const motivo = alvo.parentElement?.closest('.conteudo-laudo:not(.conteudo-laudo-editando)') ? 'Conclua a liberação do bloco que contém este conteúdo.' : leitura ? 'Laudo em modo somente leitura.' : processando ? 'Aguarde a operação atual.' : acao === 'restaurar' && !adaptador.permiteRestaurar(alvo, opcoes.laudoId) && grupo ? 'A restauração requer um laudo vinculado à REP.' : acao === 'restaurar' && condicional ? 'Este bloco não possui restauração vinculada à REP.' : acao === 'excluir' && !adaptador.permiteExcluir ? 'A exclusão de grupos descritivos não está disponível.' : acao === 'restaurar' && !grupo && !alvo.hasAttribute('data-placeholder-tabela-personalizada') ? 'Esta tabela já utiliza os dados da REP.' : '';
          botao.disabled = Boolean(motivo);
          botao.title = motivo || botao.textContent;
          botao.setAttribute('aria-label', botao.title);
          botao.setAttribute('data-acao-conteudo', acao);
          controles.append(botao);
        }
        alvo.prepend(controles);
      });
    });
  });
  const executar = async (alvo: HTMLElement, acao: string): Promise<ResultadoAcaoConteudo> => {
    const adaptador = obterAdaptadorConteudo(alvo);
    if (!adaptador || processando || editor.mode.isReadOnly() || (acao !== 'editar' && acao !== 'restaurar' && acao !== 'excluir')) return 'indisponivel';
    if (acao === 'excluir' && !adaptador.permiteExcluir || acao === 'restaurar' && !adaptador.permiteRestaurar(alvo, opcoes.laudoId)) return 'indisponivel';
    const id = identidade(alvo);
    const valido = () => !encerrado && !editor.removed && !editor.destroyed && editor.getBody().contains(alvo) && identidade(alvo) === id && !editor.mode.isReadOnly();
    const conteudo = () => {
      const copia = alvo.cloneNode(true) as HTMLElement;
      copia.querySelectorAll('[data-mce-bogus="all"]').forEach(no => no.remove());
      for (const bloco of [copia, ...copia.querySelectorAll<HTMLElement>(seletor)]) {
        bloco.classList.remove('conteudo-laudo', 'conteudo-laudo-rep', 'conteudo-laudo-condicional', 'conteudo-laudo-editando');
        if (!bloco.className) bloco.removeAttribute('class');
        bloco.removeAttribute('contenteditable');
        bloco.removeAttribute('data-cond-em-edicao');
      }
      copia.querySelectorAll<HTMLElement>('td, th').forEach(celula => {
        if (celula.closest(seletor) && !celula.closest('[data-b601-complemento]')) celula.removeAttribute('contenteditable');
      });
      return copia.innerHTML;
    };
    const anterior = conteudo();
    processando = true;
    try {
      sincronizar(alvo);
      if (acao !== 'editar' && !await opcoes.confirmar(acao === 'excluir'
        ? 'Excluir este conteúdo do laudo? A ação pode ser desfeita durante a edição. Não há recuperação garantida após fechar e reabrir.'
        : adaptador.categoria === 'descricao'
          ? 'Restaurar os dados atuais da REP? Os preenchimentos e escolhas locais serão descartados. Fotos, legendas e complementos dos grupos descritivos serão preservados.'
          : 'Restaurar os dados da REP nesta tabela? As edições locais desta tabela serão descartadas.')) return 'cancelada';
      if (!valido() || conteudo() !== anterior) throw new Error('O conteúdo selecionado mudou ou não está mais disponível. Tente novamente.');
      const novoGrupo = acao === 'restaurar' ? await adaptador.prepararRestauracao?.(editor, alvo, opcoes.laudoId) : undefined;
      if (!valido() || conteudo() !== anterior) throw new Error('O conteúdo mudou durante a operação. Nenhuma alteração foi aplicada.');
      editor.undoManager.transact(() => {
        if (acao === 'editar') {
          if (edicoes.has(alvo)) edicoes.delete(alvo);
          else { if (!adaptador.liberar(editor, alvo)) throw new Error('Não foi possível liberar o conteúdo.'); edicoes.add(alvo); }
        } else if (novoGrupo) alvo.replaceWith(novoGrupo);
        else {
          if (!adaptador.aplicar(editor, alvo, acao)) throw new Error('Não foi possível localizar o vínculo deste conteúdo.');
          edicoes.delete(alvo);
        }
      });
      if (acao === 'editar') { sincronizar(alvo); editor.dispatch('ConteudoInterativoAlterado'); }
      else { opcoes.aoAlterar(editor.getContent()); if (acao === 'restaurar') opcoes.aoRestaurar(); toast.success(acao === 'excluir' ? 'Conteúdo excluído do laudo.' : 'Dados da REP restaurados no rascunho.'); }
      return 'aplicada';
    } catch (erro: unknown) { toast.error(erro instanceof Error ? erro.message : 'Não foi possível alterar o conteúdo.'); return 'falha'; }
    finally { processando = false; sincronizar(alvo.isConnected ? alvo : editor.getBody()); }
  };
  const clicar = (evento: MouseEvent) => {
    const alvoEvento = evento.target;
    if (!alvoEvento || typeof alvoEvento !== 'object' || !('closest' in alvoEvento) || typeof alvoEvento.closest !== 'function') return;
    const botao = alvoEvento.closest('[data-acao-conteudo]') as HTMLButtonElement | null;
    const alvo = botao?.closest<HTMLElement>(seletor);
    if (!botao || !alvo) return;
    evento.preventDefault(); evento.stopImmediatePropagation();
    if (!botao.disabled) void executar(alvo, botao.getAttribute('data-acao-conteudo') || '');
  };
  editor.on('PreProcess', evento => limparConteudoInterativo(evento.node));
  sincronizar();
  documento.addEventListener('click', clicar, true);
  registrarPreparacaoConteudo(editor, sincronizar, 0);
  editor.on('remove', () => { encerrado = true; documento.removeEventListener('click', clicar, true); });
}
