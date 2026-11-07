import { VERSAO_CAMPOS_TABELA_B601 } from '@shared/catalogos/b601-tabelas.catalogo';
import type { Editor } from 'tinymce';
import { edicaoDiretaLaudoAtiva } from './politica-edicao-conteudo';
import { personalizarTabelaPlaceholder, restaurarTabelaPlaceholder, excluirTabelaPlaceholder } from './apresentacao-placeholders';
import { gerarDescricaoAgrupadaB601, gerarDescricaoColetaB601 } from '@shared/utils/b601-descricao-agrupada';

export const SELETOR_SELECAO_PONTUAL = `[data-b601-campos-versao="${VERSAO_CAMPOS_TABELA_B601}"] [data-b601-campo], [data-b601-exame-coleta="true"], [data-b601-modelo-coleta="true"] [data-b601-campo-projetil="tipo"], [data-b601-modelo-coleta="true"] [data-b601-campo-projetil="tipo_raiamento"], [data-b601-campo-projetil="calibre_nominal_provavel"]`;

interface AdaptadorConteudo {
  seletor: string;
  categoria: 'rep' | 'condicional' | 'descricao';
  permiteExcluir: boolean;
  agrupaDescendentes?: boolean;
  permiteRestaurar: (alvo: HTMLElement, laudoId?: string) => boolean;
  prepararRestauracao?: (editor: Editor, alvo: HTMLElement, laudoId?: string) => Promise<HTMLElement>;
  liberar: (editor: Editor, alvo: HTMLElement) => boolean;
  aplicar: (editor: Editor, alvo: HTMLElement, acao: 'excluir' | 'restaurar') => boolean;
}

async function restaurarDescricao(editor: Editor, alvo: HTMLElement, laudoId?: string): Promise<HTMLElement> {
  if (!laudoId) throw new Error('A restauração requer um laudo vinculado à REP.');
  const laudo = await window.ipcAPI.laudo.findById(laudoId);
  if (!laudo.success || !laudo.data) throw new Error('Não foi possível consultar o laudo.');
  const rep = await window.ipcAPI.rep.findById(laudo.data.rep_id);
  if (!rep.success || !rep.data) throw new Error('Não foi possível consultar a REP local.');
  const dados: unknown = JSON.parse(rep.data.campos_especificos || '{}');
  if (!dados || typeof dados !== 'object' || !('b601' in dados)) throw new Error('Dados B-601 indisponíveis na REP.');
  const tipo = alvo.getAttribute('data-b601-grupo');
  if (tipo !== '105' && tipo !== '101') throw new Error('Grupo descritivo desconhecido.');
  const dono = alvo.getAttribute('data-repeat-owner');
  if (!dono) throw new Error('Não foi possível identificar a origem do grupo.');
  const html = alvo.hasAttribute('data-b601-modelo-coleta') ? gerarDescricaoColetaB601(dados.b601, tipo, dono) : gerarDescricaoAgrupadaB601(dados.b601, tipo, dono);
  const recipiente = editor.getDoc().createElement('div'); recipiente.innerHTML = html;
  const novoGrupo = recipiente.querySelector<HTMLElement>('[data-b601-grupo]') || undefined;
  if (!novoGrupo) throw new Error('A REP não possui material elegível para recriar este grupo.');
  novoGrupo.querySelectorAll('[data-b601-complemento]').forEach(no => no.remove());
  const complementos = Array.from(alvo.querySelectorAll<HTMLElement>('[data-b601-complemento]')).filter(no => !no.parentElement?.closest('[data-b601-complemento]'));
  if (alvo.querySelectorAll('figure').length !== complementos.reduce((total, no) => total + no.querySelectorAll('figure').length, 0)) throw new Error('Há figuras fora dos complementos reconhecidos. O conteúdo foi preservado.');
  complementos.forEach(no => novoGrupo?.append(no.cloneNode(true)));
  return novoGrupo;
}

async function restaurarBlocoCondicional(editor: Editor, alvo: HTMLElement, laudoId?: string): Promise<HTMLElement> {
  const origem = alvo.getAttribute('data-cond-origem');
  if (!laudoId || !origem) throw new Error('Este bloco não possui origem vinculada ao modelo.');
  const resposta = await window.ipcAPI.laudo.obterBlocoCondicionalOriginal(laudoId, origem);
  if (!resposta.success || typeof resposta.data !== 'string') throw new Error(resposta.error || 'Não foi possível consultar o bloco original.');
  const recipiente = editor.getDoc().createElement('div');
  recipiente.innerHTML = resposta.data;
  const bloco = recipiente.firstElementChild as HTMLElement | null;
  if (!bloco || recipiente.childElementCount !== 1 || !bloco.matches('.cond-bloco[data-cond-bloco]') || bloco.getAttribute('data-cond-origem') !== origem) {
    throw new Error('O modelo retornou um bloco inválido.');
  }
  const instancia = alvo.getAttribute('data-cond-instancia');
  if (instancia) bloco.setAttribute('data-cond-instancia', instancia);
  return bloco;
}

const adaptadores: readonly AdaptadorConteudo[] = [
  { seletor: '[data-b601-grupo]', categoria: 'descricao', permiteExcluir: false, agrupaDescendentes: true,
    permiteRestaurar: (_alvo, laudoId) => Boolean(laudoId), prepararRestauracao: restaurarDescricao,
    liberar: () => true, aplicar: () => false },
  { seletor: '.cond-bloco[data-cond-bloco]', categoria: 'condicional', permiteExcluir: true,
    permiteRestaurar: (alvo, laudoId) => Boolean(laudoId && alvo.getAttribute('data-cond-origem')),
    prepararRestauracao: restaurarBlocoCondicional, liberar: () => true,
    aplicar: (_editor, alvo, acao) => { if (acao !== 'excluir') return false; alvo.setAttribute('data-cond-suprimido', 'true'); return true; } },
  { seletor: '[data-placeholder-preview-tabela="true"], [data-placeholder-tabela-personalizada="true"]', categoria: 'rep', permiteExcluir: true,
    permiteRestaurar: alvo => alvo.hasAttribute('data-placeholder-tabela-personalizada'),
    liberar: (editor, alvo) => !alvo.hasAttribute('data-placeholder-preview-tabela') || personalizarTabelaPlaceholder(editor, alvo),
    aplicar: (editor, alvo, acao) => acao === 'excluir' ? excluirTabelaPlaceholder(editor, alvo) : restaurarTabelaPlaceholder(editor, alvo) },
];

export function obterAdaptadorConteudo(alvo: HTMLElement): AdaptadorConteudo | undefined {
  return adaptadores.find(adaptador => alvo.matches(adaptador.seletor));
}

export function materializarEdicaoPontual(editor: Editor, campo: HTMLElement): boolean {
  const previa = campo.closest<HTMLElement>('[data-placeholder-preview="true"]');
  if (!previa) return true;
  if (!personalizarTabelaPlaceholder(editor, campo)) return false;
  if (!edicaoDiretaLaudoAtiva(previa) && !previa.classList.contains('conteudo-laudo-editando')) {
    previa.querySelectorAll('td, th').forEach(celula => celula.setAttribute('contenteditable', 'false'));
  }
  return true;
}
