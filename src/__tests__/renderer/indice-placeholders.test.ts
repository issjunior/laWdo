import { describe, expect, it } from 'vitest';
import { extrairIndicePlaceholders } from '@/lib/indice-placeholders';

describe('índice de placeholders', () => {
  it('lista cada chave usada uma única vez e resolve o campo e valor correspondente', () => {
    const itens = extrairIndicePlaceholders(
      ['<p><span data-placeholder="{{perito_nome}}">{{perito_nome}}</span> {{perito_nome}}</p>'],
      {
        perito_nome: { chave: 'perito_nome', valor: 'Izaias Santos de Souza Júnior', preenchido: true, formato: 'texto' },
      },
    );

    expect(itens).toEqual([{
      chave: 'perito_nome',
      campoFormulario: 'Nome do perito',
      valor: 'Izaias Santos de Souza Júnior',
      preenchido: true,
      tabela: undefined,
    }]);
  });

  it('prioriza a tabela personalizada presente no laudo e preserva o alinhamento de cada célula', () => {
    const itens = extrairIndicePlaceholders(
      [[
        '<p><span data-placeholder="{{itens}}" data-placeholder-tabela-personalizada-id="tabela-1">{{itens}}</span></p>',
        '<div data-placeholder-tabela-personalizada="true" data-placeholder-tabela-personalizada-id="tabela-1">',
        '<table style="text-align: right"><tbody><tr><td>À direita</td><td style="text-align: center">Centralizado</td></tr></tbody></table>',
        '</div>',
      ].join('')],
      {
        itens: { chave: 'itens', valor: '<table><tbody><tr><td>Valor automático</td></tr></tbody></table>', preenchido: true, formato: 'html' },
      },
    );

    expect(itens[0]).toMatchObject({
      chave: 'itens',
      valor: '',
      preenchido: true,
      tabela: {
        linhas: [[
          { valor: 'À direita', alinhamento: 'right' },
          { valor: 'Centralizado', alinhamento: 'center' },
        ]],
      },
    });
  });

  it('aceita placeholder em texto simples e mantém valor pendente quando não houver resolução', () => {
    const itens = extrairIndicePlaceholders(['<p>{{campo_inexistente}}</p>'], {});

    expect(itens).toEqual([{
      chave: 'campo_inexistente',
      campoFormulario: 'Campo não identificado',
      valor: '',
      preenchido: false,
    }]);
  });
});
