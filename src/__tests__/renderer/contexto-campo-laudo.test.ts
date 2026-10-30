import { describe, expect, it } from 'vitest';
import { obterContextoCampoLaudo } from '@/lib/contexto-campo-laudo';
import type { MetadadoPlaceholderIndice } from '@/lib/indice-placeholders';

function consultar(html: string, metadados: MetadadoPlaceholderIndice[] = [], secao?: string) {
  const raiz = document.createElement('div');
  raiz.innerHTML = html;
  const campo = raiz.querySelector<HTMLElement>('[data-alvo]');
  if (!campo) throw new Error('Campo de teste ausente');
  const original = raiz.innerHTML;
  const contexto = obterContextoCampoLaudo(campo, metadados, secao);
  expect(raiz.innerHTML).toBe(original);
  return contexto;
}

describe('contexto visual da edição de campos do laudo', () => {
  it.each(['PQ 2', 'Estojo 3', 'Item 4', 'Arma 5'])('identifica aviso, unidade %s e seção sem misturar os controles', unidade => {
    const contexto = consultar(`<section data-laudo-secao="s1"><header data-laudo-secao-header data-titulo-base="  Exames  ">Editar seção</header>
      <p><span data-alvo data-aviso-reservado="Campo de preenchimento manual no laudo: Massa — ${unidade}">XXX</span></p></section>`);
    expect(contexto).toEqual({ nome: 'Massa', unidade, secao: 'Exames', tabela: undefined, trecho: undefined });
  });

  it.each(['data-placeholder="{{rep_numero}}"', 'data-campo-rep-pendente="rep_numero"'])(
    'resolve o nome do catálogo por %s e prioriza a seção informada', atributo => {
      expect(consultar(`<section data-laudo-secao="s"><header data-laudo-secao-header data-titulo-base="Outra seção"></header>
        <span data-alvo ${atributo}>XXX</span></section>`, [], '  Identificação  ')).toMatchObject({ nome: 'Número da REP', secao: 'Identificação' });
    });

  it('usa descrição cadastrada e dá precedência ao aviso específico da ocorrência', () => {
    const metadados = [{ chave: 'meu_campo', descricao: 'Descrição cadastrada' }];
    expect(consultar('<span data-alvo data-placeholder="{{meu_campo}}">XXX</span>', metadados).nome).toBe('Descrição cadastrada');
    expect(consultar('<span data-alvo data-placeholder="{{meu_campo}}" data-aviso-reservado="Campo pendente na REP: Diâmetro">XXX</span>', metadados).nome).toBe('Diâmetro');
  });

  it('combina cabeçalhos de linha e coluna e separa o título da tabela', () => {
    expect(consultar(`<table><tr><th colspan="3">TABELA 12 – Dimensões</th></tr>
      <tr><th>Material</th><th>Massa</th><th>Altura</th></tr>
      <tr><th>Projétil</th><td>8</td><td><span data-alvo>XXX</span></td></tr></table>`))
      .toMatchObject({ nome: 'Projétil · Altura', tabela: 'Tabela 12 · Dimensões' });
  });

  it.each([['ID', 'Item'], ['Item', 'Item'], ['Arma', 'Arma'], ['Estojo', 'Estojo']])(
    'qualifica o identificador numérico da coluna %s como %s', (cabecalho, unidade) => {
      expect(consultar(`<table><caption>TABELA 2 — Material</caption><tr><th>${cabecalho}</th><th>Massa</th></tr>
        <tr><td>7</td><td><span data-alvo>XXX</span></td></tr></table>`))
        .toMatchObject({ nome: 'Massa', unidade: `${unidade} 7`, tabela: 'Tabela 2 · Material' });
    });

  it('considera rowspan ao localizar a unidade e a coluna do campo', () => {
    expect(consultar(`<table><tr><th>Item</th><th>Medida</th><th>Valor</th></tr>
      <tr><td rowspan="2" data-placeholder-celula-fixa="true">PQ 2</td><th>Massa</th><td>8</td></tr>
      <tr><th>Altura</th><td><span data-alvo>XXX</span></td></tr></table>`))
      .toMatchObject({ nome: 'Altura · Valor', unidade: 'PQ 2' });
  });

  it('não atribui um cabeçalho parcial a um campo que ocupa duas colunas', () => {
    expect(consultar(`<table><tr><th>Item</th><th colspan="2">Dimensões</th></tr>
      <tr><th>Identificação</th><th>Altura</th><th>Largura</th></tr>
      <tr><td>PQ 4</td><td colspan="2"><span data-alvo>XXX</span></td></tr></table>`))
      .toMatchObject({ nome: 'Dimensões', unidade: 'PQ 4' });
  });

  it('aceita rowspan zero limitado ao grupo de linhas', () => {
    expect(consultar(`<table><thead><tr><th>Item</th><th>Medida</th></tr></thead>
      <tbody><tr><th rowspan="0">PQ 3</th><td>8</td></tr><tr><td><span data-alvo>XXX</span></td></tr></tbody></table>`))
      .toMatchObject({ nome: 'Medida', unidade: 'PQ 3' });
  });

  it('descarta cabeçalhos pendentes e usa o trecho visível como identificação', () => {
    const contexto = consultar(`<table><tr><th><span data-reservado="true">XXX</span></th></tr>
      <tr><td>Antes <strong><span data-alvo data-aviso-reservado="Campo de preenchimento manual no template">valor</span></strong> depois
        <select><option>Opção oculta</option></select><button>Editar</button><span hidden>Oculto</span>
        <span aria-hidden="true">Ícone</span><span data-mce-bogus="all">Controle</span>
        <span data-cond-suprimido="true">Suprimido</span><script>codigo()</script><style>css</style></td></tr></table>`);
    expect(contexto).toMatchObject({ nome: 'Texto personalizado', trecho: 'Antes valor depois' });
  });

  it('recorta texto longo em torno da ocorrência correta de XXX', () => {
    const contexto = consultar(`<p>${'Introdução '.repeat(35)}XXX anterior ${'texto '.repeat(20)}
      <em><span data-alvo>XXX</span></em> identificador do alvo ${'final '.repeat(40)}</p>`);
    expect(contexto.nome).toBe('Texto personalizado');
    expect(contexto.trecho).toContain('XXX identificador do alvo');
    expect(contexto.trecho).not.toContain('XXX anterior');
    expect(contexto.trecho).toMatch(/^….*…$/);
    expect(contexto.trecho!.length).toBeLessThanOrEqual(160);
  });
});
