import { describe, expect, it } from 'vitest';
import {
  buildHtml,
  expandirSecoesRepetiveis,
  filtrarSecoesAtivas,
  processarBlocosCondicionais,
} from '../../main/services/secao-builder.service';
import { laudoService } from '../../main/services/laudo.service';

describe('secao-builder.service', () => {
  it('numera as subseções de DOS EXAMES conforme as peças canônicas', () => {
    const secoes = [
      { id: 'preambulo', template_id: 'tpl-1', nome: 'PREÂMBULO', ordem: 0, conteudo: '<p>Preâmbulo</p>', created_at: '', updated_at: '' },
      { id: 'objetivo', template_id: 'tpl-1', nome: 'OBJETIVO', ordem: 1, conteudo: '<p>Objetivo</p>', created_at: '', updated_at: '' },
      { id: 'material', template_id: 'tpl-1', nome: 'MATERIAL APRESENTADO A EXAME', ordem: 2, conteudo: '<p>Material</p>', created_at: '', updated_at: '' },
      { id: 'exames', template_id: 'tpl-1', nome: 'DOS EXAMES', ordem: 3, conteudo: '<p></p>', created_at: '', updated_at: '' },
      { id: 'cartuchos', template_id: 'tpl-1', parent_id: 'exames', nome: 'DOS CARTUCHOS', ordem: 4, conteudo: '<p>Cartuchos</p>', created_at: '', updated_at: '' },
      { id: 'estojos', template_id: 'tpl-1', parent_id: 'exames', nome: 'DOS ESTOJOS', ordem: 5, conteudo: '<p>Estojos</p>', created_at: '', updated_at: '' },
      { id: 'armas', template_id: 'tpl-1', parent_id: 'exames', nome: 'DAS ARMAS', ordem: 6, repetir_para: 'armas', conteudo: '<p>Armas</p>', created_at: '', updated_at: '' },
    ];
    const pecaBase = {
      idLocal: 'peca', origem: 'gdl', alteradaLocalmente: false,
      comuns: { quantidade: 1, identificacao: '', lacreEntrada: '', observacao: '' },
      personalizados: {}, extrasGdl: {},
    };

    const cenarios = [
      { nome: 'cartuchos', pecas: [{ ...pecaBase, tipoCodigo: '17', tipoPeca: 'CARTUCHO(S)' }], titulos: ['4. DOS EXAMES', '4.1 DOS CARTUCHOS'], ausentes: ['DOS ESTOJOS', 'DAS ARMAS'] },
      { nome: 'estojos', pecas: [{ ...pecaBase, tipoCodigo: '101', tipoPeca: 'ESTOJO(S)' }], titulos: ['4. DOS EXAMES', '4.1 DOS ESTOJOS'], ausentes: ['DOS CARTUCHOS', 'DAS ARMAS'] },
      { nome: 'cartuchos e estojos', pecas: [{ ...pecaBase, tipoCodigo: '17', tipoPeca: 'CARTUCHO(S)' }, { ...pecaBase, idLocal: 'estojo', tipoCodigo: '101', tipoPeca: 'ESTOJO(S)' }], titulos: ['4. DOS EXAMES', '4.1 DOS CARTUCHOS', '4.2 DOS ESTOJOS'], ausentes: ['DAS ARMAS'] },
      { nome: 'cartuchos, estojos e armas', pecas: [{ ...pecaBase, tipoCodigo: '17', tipoPeca: 'CARTUCHO(S)' }, { ...pecaBase, idLocal: 'estojo', tipoCodigo: '101', tipoPeca: 'ESTOJO(S)' }, { ...pecaBase, idLocal: 'arma', tipoCodigo: '104', tipoPeca: 'PISTOLA(S)' }], titulos: ['4. DOS EXAMES', '4.1 DOS CARTUCHOS', '4.2 DOS ESTOJOS', '4.3 DAS ARMAS'], ausentes: [] },
      { nome: 'armas', pecas: [{ ...pecaBase, tipoCodigo: '104', tipoPeca: 'PISTOLA(S)' }], titulos: ['4. DOS EXAMES', '4.1 DAS ARMAS'], ausentes: ['DOS CARTUCHOS', 'DOS ESTOJOS'] },
      { nome: 'sem peças elegíveis', pecas: [], titulos: [], ausentes: ['DOS EXAMES'] },
    ];

    for (const cenario of cenarios) {
      const camposEspecificos = { b602: { pecas: cenario.pecas } };
      const resultado = filtrarSecoesAtivas(secoes, camposEspecificos);
      const html = buildHtml(resultado, new Map(), camposEspecificos);

      for (const titulo of cenario.titulos) expect(html, cenario.nome).toContain(titulo);
      for (const titulo of cenario.ausentes) expect(html, cenario.nome).not.toContain(titulo);
    }
  });

  it('repara DOS EXAMES antigo quando o bloco de cartuchos ainda não existia', () => {
    const htmlAtual = [
      '<h2 data-secao-id="exames" data-estrutura-nivel="2" data-titulo-base="DOS EXAMES">4. DOS EXAMES</h2>',
      '<div data-cond-bloco="b602_estojos_toggle"><p>Estojos antigos</p></div>',
    ].join('\n');
    const htmlBase = [
      '<h2 data-secao-id="exames" data-estrutura-nivel="2" data-titulo-base="DOS EXAMES" data-derivada-rep="true">4. DOS EXAMES</h2>',
      '<div data-cond-bloco="b602_cartuchos_toggle"><p>Cartuchos atuais</p></div>',
      '<div data-cond-bloco="b602_estojos_toggle"><p>Estojos atuais</p></div>',
    ].join('\n');
    const servico = laudoService as unknown as {
      _reconciliarComBase: (
        atual: string,
        base: string,
        campos: Record<string, unknown>,
      ) => string;
    };

    const resultado = servico._reconciliarComBase(htmlAtual, htmlBase, {
      b602: {
        pecas: [
          {
            idLocal: 'cartucho-1', origem: 'gdl', alteradaLocalmente: false,
            tipoCodigo: '17', tipoPeca: 'CARTUCHO(S)',
            comuns: { quantidade: 1, identificacao: '.38 SPL', lacreEntrada: '', observacao: '' },
            personalizados: {}, extrasGdl: {},
          },
          {
            idLocal: 'estojo-1', origem: 'gdl', alteradaLocalmente: false,
            tipoCodigo: '101', tipoPeca: 'ESTOJO(S)',
            comuns: { quantidade: 1, identificacao: '9mm', lacreEntrada: '', observacao: '' },
            personalizados: {}, extrasGdl: {},
          },
        ],
      },
    });

    expect(resultado).toContain('Cartuchos atuais');
    expect(resultado).toContain('Estojos atuais');
  });

  it('mantém os blocos periciais versionados para qualquer arma, independentemente do toggle legado', () => {
    const resultado = processarBlocosCondicionais(
      '<div class="cond-bloco" data-cond-bloco="b602_arma_N_funcionamento_eficiencia_v2" data-bloco-pericial="funcionamento"><h3>FUNCIONAMENTO</h3><p>&nbsp;</p></div>',
      { b602: { pecas: [] } },
      { indiceArma: 1, arma: { exibeBlocosPericiais: true, func_toggle: 'off' } }
    );

    expect(resultado).toContain('b602_arma_1_funcionamento_eficiencia_v2');
    expect(resultado).not.toContain('<h3>FUNCIONAMENTO</h3>');
  });

  it('remove os blocos periciais versionados quando a peça não é elegível', () => {
    const resultado = processarBlocosCondicionais(
      '<div class="cond-bloco" data-cond-bloco="b602_arma_N_coleta_padroes_v2" data-bloco-pericial="coleta"><h3>COLETA</h3><p>&nbsp;</p></div>',
      { b602: { pecas: [] } },
      { indiceArma: 1, arma: { exibeBlocosPericiais: false } }
    );

    expect(resultado).toBe('');
  });

  it('mantém o marcador legado de coleta para uma arma canônica elegível', () => {
    const resultado = processarBlocosCondicionais(
      '<div class="cond-bloco" data-cond-bloco="b602_arma_N_coleta_toggle"><h3>COLETA</h3><p>&nbsp;</p></div>',
      {
        b602: {
          pecas: [{
            idLocal: 'arma-pressao', origem: 'manual', alteradaLocalmente: false,
            tipoCodigo: '613', tipoPeca: 'ARMA(S) DE PRESSÃO',
            comuns: { quantidade: 1, identificacao: '', lacreEntrada: '' },
            personalizados: {}, extrasGdl: {},
          }],
        },
      },
      { indiceArma: 1, arma: { exibeBlocosPericiais: true } }
    );

    expect(resultado).toContain('COLETA');
  });

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
    expect(html).not.toContain('data-titulo-base="ARMA {{b602_arma_2_tipo}}"');
    expect(html).toContain('data-repeat-item="arma"');
    expect(html).toContain('data-cond-bloco="b602_arma_1_func_toggle"');
    expect(html).not.toContain('data-cond-bloco="b602_arma_2_func_toggle"');
  });

  it('expande armas derivadas da coleção canônica de peças', () => {
    const secoes = [
      {
        id: 'sec-canonica',
        template_id: 'tpl-1',
        nome: 'DA ARMA',
        ordem: 0,
        repetir_para: 'armas',
        repetir_titulo: 'ARMA {{b602_arma_1_tipo}}',
        conteudo: `
          <div data-cond-bloco="b602_armas_toggle">
            <p>{{b602_arma_1_marca}}</p>
            <div data-cond-bloco="b602_arma_N_func_toggle">
              <p>Funcionamento confirmado</p>
            </div>
          </div>
        `,
        created_at: '',
        updated_at: '',
      },
    ];

    const resultado = expandirSecoesRepetiveis(secoes, {
      b602: {
        pecas: [{
          idLocal: 'arma-1',
          origem: 'gdl',
          alteradaLocalmente: false,
          tipoCodigo: '104',
          tipoPeca: 'PISTOLA(S)',
          comuns: { quantidade: 1, identificacao: 'Pistola', lacreEntrada: 'L1' },
          personalizados: {
            '104:marca_arma': '2',
            '104:funcionamento': 'Eficiente',
          },
          extrasGdl: {},
        }],
      },
    });

    const html = resultado.get('armas') || '';
    expect(html).toContain('ARMA {{b602_arma_1_tipo}}');
    expect(html).toContain('Funcionamento confirmado');
    expect(html).toContain('data-cond-bloco="b602_arma_1_func_toggle"');
  });

  it('atribui identificadores distintos às figuras dummy de cada arma repetida', () => {
    const secoes = [{
      id: 'sec-armas', template_id: 'tpl-1', nome: 'DA ARMA', ordem: 0,
      repetir_para: 'armas', repetir_titulo: 'ARMA {{b602_arma_1_tipo}}',
      conteudo: '<figure class="laudo-figure" data-image-id="dummy" data-dummy="true"><img src="x"/></figure>',
      created_at: '', updated_at: '',
    }];

    const html = expandirSecoesRepetiveis(secoes, {
      b602: { armas: [{ tipo: 'Pistola' }, { tipo: 'Revólver' }] },
    }).get('armas') || '';

    expect(html).toContain('data-image-id="dummy-sec-armas-1-1"');
    expect(html).toContain('data-image-id="dummy-sec-armas-2-1"');
  });
});
