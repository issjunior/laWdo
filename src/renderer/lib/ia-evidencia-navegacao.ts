import type { BlocoContextoIa } from '@shared/types/ia.types';

export type ModoEditorLaudo = 'single' | 'multi';

interface EditorNavegacaoEvidencia {
  getBody: () => HTMLElement | null;
}

interface OpcoesNavegacaoEvidenciaIa {
  modoEditor: ModoEditorLaudo;
  evidencia: BlocoContextoIa;
  obterEditor: (editorId: string) => EditorNavegacaoEvidencia | null | undefined;
  expandirSecao: (indice: number) => void;
  agendar: (callback: () => void) => void;
}

const SELETOR_BLOCOS_EVIDENCIA = 'h1,h2,h3,h4,h5,h6,p,li,table,figure,figcaption,[data-bloco-pericial]';

function localizarAlvoEvidencia(corpo: HTMLElement, evidencia: BlocoContextoIa): HTMLElement {
  const alvoIdentificado = Array.from(corpo.querySelectorAll<HTMLElement>('[id], [data-arma-chave], [data-arma-indice]'))
    .find(elemento => elemento.id === evidencia.ancora
      || elemento.getAttribute('data-arma-chave') === evidencia.ancora
      || elemento.getAttribute('data-arma-indice') === evidencia.ancora);
  if (alvoIdentificado) return alvoIdentificado;

  const prefixoAncoraReserva = `${evidencia.secaoId}-`;
  if (!evidencia.ancora.startsWith(prefixoAncoraReserva)) return corpo;
  const indiceReserva = Number(evidencia.ancora.slice(prefixoAncoraReserva.length));
  if (!Number.isInteger(indiceReserva) || indiceReserva < 1) return corpo;
  return corpo.querySelectorAll<HTMLElement>(SELETOR_BLOCOS_EVIDENCIA)[indiceReserva - 1] || corpo;
}

export function obterEditorIdParaEvidenciaIa(modoEditor: ModoEditorLaudo, secaoId: string): string {
  const indice = secaoId.match(/^secao-(\d+)$/)?.[1];
  if (modoEditor === 'single' || indice === undefined || Number(indice) === -1) {
    return 'laudo-single-editor';
  }
  return `secao-${Number(indice)}`;
}

export function obterIndiceSecaoDaEvidenciaIa(secaoId: string): number | null {
  const indice = secaoId.match(/^secao-(\d+)$/)?.[1];
  return indice === undefined ? null : Number(indice);
}

export function navegarParaEvidenciaIa({
  modoEditor,
  evidencia,
  obterEditor,
  expandirSecao,
  agendar,
}: OpcoesNavegacaoEvidenciaIa): void {
  const indiceSecao = obterIndiceSecaoDaEvidenciaIa(evidencia.secaoId);
  if (modoEditor === 'multi' && indiceSecao !== null) expandirSecao(indiceSecao);

  agendar(() => {
    const editor = obterEditor(obterEditorIdParaEvidenciaIa(modoEditor, evidencia.secaoId));
    const corpo = editor?.getBody();
    if (!corpo) return;
    const alvo = localizarAlvoEvidencia(corpo, evidencia);
    alvo.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
    alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => alvo.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2_000);
  });
}
