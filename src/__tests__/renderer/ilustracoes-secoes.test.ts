import { describe, expect, it } from 'vitest';
import { removerIlustracoesVazias } from '@/lib/ilustracoes-secoes';
import type { SecaoEstruturalLaudo } from '@/lib/estrutura-laudo';

const secao = (conteudo: string): SecaoEstruturalLaudo => ({
  nivel: 2, titulo: 'ILUSTRAÇÕES', conteudo,
});

describe('remoção da seção de ilustrações', () => {
  it('remove seção vazia e preserva o conteúdo das seções seguintes', () => {
    const seguinte: SecaoEstruturalLaudo = { nivel: 2, titulo: 'CONCLUSÃO', conteudo: '<p>Texto final</p>' };
    expect(removerIlustracoesVazias([secao('<p>&nbsp;</p><br>'), seguinte])).toEqual([seguinte]);
  });

  it.each([
    '<figure class="laudo-figure" data-dummy="true"><img></figure>',
    '<table><tbody><tr><td></td></tr></tbody></table>',
    '<p>Descrição complementar</p>',
  ])('preserva a seção com conteúdo significativo: %s', conteudo => {
    expect(removerIlustracoesVazias([secao(conteudo)])).toHaveLength(1);
  });
});
