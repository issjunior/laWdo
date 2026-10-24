import { describe, expect, it } from 'vitest';
import { ajustarTabelasBalistica } from '@/lib/tabelas-balistica-layout';
import { buildNumberedTable } from '@/lib/tabelas-placeholder';
import { renumerarTabelas } from '@/lib/numeracao-tabelas';
import { ESTILOS_TABELAS_BALISTICA, planejarGruposColunas } from '@shared/utils/tabelas-balistica-layout';

describe('palavras e colunas das tabelas de balística', () => {
  it('preserva palavras, fonte e texto, dando mais espaço à origem e observação', () => {
    const raiz = document.createElement('div');
    raiz.innerHTML = buildNumberedTable('TABELA 3 – ESTOJOS', ['Qtd', 'Calibre', 'Marca', 'Origem', 'Espoleta', 'Estojo', 'Observação'],
      [['2', '32 GA', 'CBC', '18ª SDP - DELEGACIA / TIBAGI', 'Niquelado', 'Polímero', 'Percutidos e deflagrados']]);
    const texto = raiz.textContent;
    ajustarTabelasBalistica(raiz, 16, true);
    expect(raiz.textContent).toBe(texto);
    expect(raiz.querySelectorAll('table')).toHaveLength(1);
    expect(raiz.querySelector('table')!.style.tableLayout).toBe('auto');
    expect(raiz.querySelector<HTMLElement>('td:last-child')!.style.fontSize).toBe('12px');
    for (const celula of raiz.querySelectorAll<HTMLElement>('th,td')) {
      expect(celula.style.wordBreak).toBe('normal');
      expect(celula.style.overflowWrap).toBe('normal');
      expect(celula.style.hyphens).toBe('none');
    }
    const colunas = Array.from(raiz.querySelectorAll('col')).map(coluna => parseFloat(coluna.style.width));
    expect(colunas[4]).toBeGreaterThan(colunas[0]);
    expect(colunas[7]).toBeGreaterThan(colunas[1]);
    expect(ESTILOS_TABELAS_BALISTICA).not.toContain('anywhere');
    expect(ESTILOS_TABELAS_BALISTICA).not.toContain('10px');
  });

  it('divide tabelas largas repetindo somente o identificador sem perder dados ou vínculos', () => {
    const raiz = document.createElement('div');
    const campos = Array.from({ length: 13 }, (_, indice) => `Campo ${indice + 1}`);
    const valores = campos.map((_, indice) => `<span data-placeholder="{{campo_${indice}}}">DELEGACIA ${indice}</span>`);
    raiz.innerHTML = buildNumberedTable('TABELA 8 – ARMAS', campos, [valores, valores.map(valor => valor.replace('DELEGACIA', 'OBSERVAÇÃO'))]);
    ajustarTabelasBalistica(raiz, 11, true);
    const tabelas = [...raiz.querySelectorAll('table')];
    expect(tabelas.length).toBeGreaterThan(1);
    for (const tabela of tabelas) {
      expect([...tabela.querySelectorAll('tbody tr')].map(linha => linha.firstElementChild?.textContent)).toEqual(['1', '2']);
      expect(tabela.querySelector('thead tr')!.textContent).toContain('parte');
    }
    expect(raiz.querySelectorAll('[data-placeholder]')).toHaveLength(26);
    campos.forEach((_, indice) => expect(raiz.querySelectorAll(`[data-placeholder="{{campo_${indice}}}"]`)).toHaveLength(2));
    renumerarTabelas(raiz);
    expect(tabelas.map(tabela => tabela.rows[0].cells[0].textContent)).toEqual(tabelas.map((_, indice) => expect.stringContaining(`TABELA ${indice + 1} – ARMAS`)));
  });

  it('não divide uma tabela personalizada nem modifica tabelas de figuras ou de outros exames', () => {
    const raiz = document.createElement('div');
    raiz.innerHTML = '<div data-placeholder-tabela-personalizada="true">' + buildNumberedTable('TABELA 1', ['Marca', 'Origem', 'Observação'], [['MARCA', 'DELEGACIA', 'deflagrados']]) + '</div><table id="figuras"><tr><td><figure><img src="imagem.png"><figcaption>Figura 01</figcaption></figure></td></tr></table><table id="outro"><tr><td>Outro exame</td></tr></table>';
    const figura = raiz.querySelector('#figuras')!.outerHTML;
    const outro = raiz.querySelector('#outro')!.outerHTML;
    const personalizada = raiz.querySelector('[data-placeholder-tabela-personalizada]')!.outerHTML;
    ajustarTabelasBalistica(raiz, 5, true);
    expect(raiz.querySelectorAll('[data-placeholder-tabela-personalizada] table')).toHaveLength(1);
    expect(raiz.querySelector('[data-placeholder-tabela-personalizada]')!.outerHTML).toBe(personalizada);
    expect(raiz.querySelector('#figuras')!.outerHTML).toBe(figura);
    expect(raiz.querySelector('#outro')!.outerHTML).toBe(outro);
  });

  it('calcula grupos conforme a largura disponível e repete a coluna identificadora', () => {
    expect(planejarGruposColunas([30, 100, 80, 110], 400)).toEqual([[0, 1, 2, 3]]);
    expect(planejarGruposColunas([30, 100, 80, 110], 220)).toEqual([[0, 1, 2], [0, 3]]);
    expect(planejarGruposColunas([30, 100, 80, 110], 150)).toEqual([[0, 1], [0, 2], [0, 3]]);
  });
});
