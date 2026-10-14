import type { AvisoImportacaoTemplate, SecaoImportadaTemplate } from '@shared/types/importacao-template.types';

export const documentoSecao = (conteudo: string): Document => new DOMParser().parseFromString(conteudo, 'text/html');

export function localizarSecoes(secoes: SecaoImportadaTemplate[], aviso: AvisoImportacaoTemplate): SecaoImportadaTemplate[] {
  return secoes.filter(secao => {
    if (!secao.incluir) return false;
    const documento = documentoSecao(secao.conteudo);
    if (aviso.elementoId) return Array.from(documento.querySelectorAll('[data-importacao-elemento]')).some(no => no.getAttribute('data-importacao-elemento') === aviso.elementoId);
    if (aviso.pagina) return Array.from(documento.querySelectorAll('[data-importacao-pagina]')).some(no => no.getAttribute('data-importacao-pagina') === String(aviso.pagina));
    return !aviso.secaoId || secao.id === aviso.secaoId;
  });
}
