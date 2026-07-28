import { describe, expect, it } from 'vitest';
import { atualizarMarcadoresTemplateB602 } from '../../main/database/template-b602.migration';

describe('migration do template padrão B-602', () => {
  it('versiona os dois blocos periciais sem alterar a redação', () => {
    const original = [
      '<p>Identificação da arma.</p>',
      '<div class="cond-bloco" data-cond-bloco="b602_arma_N_func_toggle"><p>Funcionamento.</p></div>',
      '<div class="cond-bloco" data-cond-bloco="b602_arma_N_coleta_toggle"><p>Coleta.</p></div>',
    ].join('');

    const resultado = atualizarMarcadoresTemplateB602(original);

    expect(resultado).toContain('b602_arma_N_funcionamento_eficiencia_v2');
    expect(resultado).toContain('data-bloco-pericial="funcionamento"');
    expect(resultado).toContain('b602_arma_N_coleta_padroes_v2');
    expect(resultado).toContain('data-bloco-pericial="coleta"');
    expect(resultado).toContain('Identificação da arma.')
    expect(resultado).toContain('Funcionamento.')
    expect(resultado).toContain('Coleta.')
  });

  it('é idempotente para marcadores já versionados', () => {
    const versionado = '<div class="cond-bloco" data-cond-bloco="b602_arma_N_funcionamento_eficiencia_v2" data-bloco-pericial="funcionamento" data-cond-versao="2"><p>Texto.</p></div>';

    expect(atualizarMarcadoresTemplateB602(versionado)).toBe(versionado);
  });
});
