import type { SecaoEstruturalLaudo } from '@/lib/estrutura-laudo';

export function conteudoHtmlEhVazio(html?: string | null): boolean {
  if (!html?.trim()) return true;
  if (/<(?:img|figure|table|svg|video|audio|canvas|iframe)\b/i.test(html)) return false;
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;|&#x[aA]0;|\u00a0/gi, '')
    .trim() === '';
}

export function removerIlustracoesVazias(secoes: SecaoEstruturalLaudo[]): SecaoEstruturalLaudo[] {
  const idsComFilhos = new Set(secoes.flatMap(secao => secao.parentId ? [secao.parentId] : []));
  return secoes.filter(secao => secao.titulo.trim().toUpperCase() !== 'ILUSTRAÇÕES'
    || !conteudoHtmlEhVazio(secao.conteudo)
    || Boolean(secao.id && idsComFilhos.has(secao.id)));
}
