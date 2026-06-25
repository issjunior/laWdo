import { describe, expect, it } from 'vitest';
import {
  expandirSecoesRepetiveis,
  processarBlocosCondicionais,
} from '../../main/services/secao-builder.service';

describe('secao-builder.service', () => {
  it('remove bloco condicional por arma quando o toggle da arma estiver off', () => {
    const html = `
      <div data-cond-bloco="b602_arma_N_func_toggle" class="cond-bloco">
        <h3>FUNCIONAMENTO E EFICIENCIA</h3>
        <p>Texto</p>
      </div>
    `;

    const resultado = processarBlocosCondicionais(
      html,
      {
        b602: {
          armas: [{ func_toggle: 'off' }],
        },
      },
      { indiceArma: 1, arma: { func_toggle: 'off' } }
    );

    expect(resultado).not.toContain('FUNCIONAMENTO E EFICIENCIA');
    expect(resultado).not.toContain('data-cond-bloco');
  });

  it('processa bloco condicional por arma mesmo com data-cond-bloco fora da primeira posicao', () => {
    const html = `
      <div class="cond-bloco" data-cond-bloco="b602_arma_N_func_toggle">
        <h3>FUNCIONAMENTO E EFICIENCIA</h3>
        <p>Texto</p>
      </div>
    `;

    const desligado = processarBlocosCondicionais(
      html,
      {
        b602: {
          armas: [{ func_toggle: 'off' }],
        },
      },
      { indiceArma: 1, arma: { func_toggle: 'off' } }
    );

    const ligado = processarBlocosCondicionais(
      html,
      {
        b602: {
          armas: [{ func_toggle: 'on' }],
        },
      },
      { indiceArma: 1, arma: { func_toggle: 'on' } }
    );

    expect(desligado).not.toContain('FUNCIONAMENTO E EFICIENCIA');
    expect(ligado).toContain('FUNCIONAMENTO E EFICIENCIA');
    expect(ligado).toContain('data-cond-bloco="b602_arma_1_func_toggle"');
  });

  it('remove bloco interno de funcionamento mesmo quando a secao inteira esta dentro de um bloco condicional de armas', () => {
    const html = `
      <div class="cond-bloco" data-cond-bloco="b602_armas_toggle">
        <h3><strong>a) Identificacao da arma:</strong></h3>
        <p>Texto base</p>
        <div class="cond-bloco" data-cond-bloco="b602_arma_N_func_toggle">
          <h3>FUNCIONAMENTO E EFICIENCIA</h3>
          <p>Texto funcionamento</p>
        </div>
        <div class="cond-bloco" data-cond-bloco="b602_arma_N_coleta_toggle">
          <h3>COLETA DE PADROES BALISTICOS</h3>
          <p>Texto coleta</p>
        </div>
      </div>
    `;

    const resultado = processarBlocosCondicionais(
      html,
      {
        b602: {
          armas_toggle: 'on',
          armas: [{ func_toggle: 'off', coleta_toggle: 'on' }],
        },
      },
      { indiceArma: 1, arma: { func_toggle: 'off', coleta_toggle: 'on' } }
    );

    expect(resultado).toContain('Identificacao da arma');
    expect(resultado).not.toContain('FUNCIONAMENTO E EFICIENCIA');
    expect(resultado).toContain('COLETA DE PADROES BALISTICOS');
  });

  it('expande a secao repetivel respeitando o toggle de cada arma', () => {
    const secoes = [
      {
        id: 'sec-1',
        template_id: 'tpl-1',
        nome: 'DA ARMA',
        ordem: 0,
        repetir_para: 'armas',
        repetir_titulo: 'ARMA {{b602_arma_1_tipo}}',
        conteudo: `
          <p>{{b602_arma_1_marca}}</p>
          <div class="cond-bloco" data-cond-bloco="b602_arma_N_func_toggle">
            <h3>FUNCIONAMENTO E EFICIENCIA</h3>
          </div>
        `,
        created_at: '',
        updated_at: '',
      },
    ];

    const resultado = expandirSecoesRepetiveis(secoes, {
      b602: {
        armas_toggle: 'on',
        armas: [
          { tipo: 'Pistola', marca: 'Taurus', func_toggle: 'on' },
          { tipo: 'Revolver', marca: 'Rossi', func_toggle: 'off' },
        ],
      },
    });

    const html = resultado.get('armas') || '';

    expect(html).toContain('ARMA {{b602_arma_1_tipo}}');
    expect(html).toContain('ARMA {{b602_arma_2_tipo}}');
    expect(html).toContain('data-cond-bloco="b602_arma_1_func_toggle"');
    expect(html).not.toContain('data-cond-bloco="b602_arma_2_func_toggle"');
  });
});
