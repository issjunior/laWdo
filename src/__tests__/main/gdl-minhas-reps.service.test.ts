import { describe, expect, it } from 'vitest';
import {
  complementarNaturezasMinhasRepsGdl,
  interpretarMinhasRepsGdl,
  montarFormularioMinhasRepsGdl,
  obterEventoNavegacaoMinhasReps,
  obterNaturezaExameDaRepGdl,
} from '../../main/services/gdl-minhas-reps.service';

const urlPagina = 'https://gdl.example/SAC/GDL_IC_NET/REP/MinhasReps.aspx';
const linha = (numero: string, status: string, natureza: string, data = '19/07/2026 14:30', fotos = '5') => `
  <tr><td><a href="/REP/Concluir_REP.aspx?cod_rep=1">Concluir</a></td>
  <td><a href="/REP/Default.aspx?rep_id=${numero.split('/')[0]}">${numero}</a></td>
  <td>${data}</td><td><img alt="${status}" /></td><td>${natureza}</td><td>${fotos}</td></tr>`;

const html = `
  <form method="post" action="./MinhasReps.aspx">
    <input type="hidden" name="__VIEWSTATE" value="estado&amp;seguro" />
    <input type="hidden" name="__EVENTVALIDATION" value="validacao" />
    <input type="hidden" name="ctl00$Content$hdnNeedReturn" value="" />
    <select id="Content_ddlYear"><option value="0">Todos</option></select>
    <select id="Content_ddlStatus"><option value="-1">Todos</option></select>
    <select id="Content_ddlUnit"><option value="-1">Todos</option></select>
    <table id="Content_gridSearchMyRequests">
      <tr><th>Ação</th><th>Número/Ano da REP</th><th>Data/Hora da Designação</th><th>Status</th><th>Natureza do Exame</th><th>Quant. Fotos</th></tr>
      ${linha('123/2026', 'ABERTA E DISTRIBUÍDA', 'B-602 - EXAME')}
      ${linha('124/2026', 'LAUDO EM EXECUÇÃO', 'B-602 - EXAME', '', '')}
      ${linha('125/2026', 'CONCLUÍDA E NÃO REMETIDA', 'B-602 - EXAME', '20/07/2026 09:00', '0')}
      ${linha('126/2026', 'CANCELADA', 'B-602 - EXAME')}
      <tr><td colspan="6"><a href="javascript:__doPostBack('ctl00$Content$gridSearchMyRequests','Page$2')">2</a></td></tr>
    </table>
  </form>`;

describe('listagem de Minhas REPs do GDL', () => {
  it('inclui somente os três status permitidos e identifica paginação', () => {
    const pagina = interpretarMinhasRepsGdl(html, 1);
    expect(pagina.reps.map(rep => rep.status)).toEqual([
      'Aberta e Distribuída', 'Laudo em Execução', 'Concluída e Não Remetida',
    ]);
    expect(pagina.reps[0]).toMatchObject({ idGdl: 123, numero: '123', ano: '2026', naturezaExame: 'B-602 - EXAME', naturezaExameComCodigo: null });
    expect(pagina.reps[0]).toMatchObject({ dataDesignacao: '2026-07-19T14:30', quantidadeFotos: 5 });
    expect(pagina.reps[1]).toMatchObject({ dataDesignacao: null, quantidadeFotos: null });
    expect(pagina.reps[2]).toMatchObject({ dataDesignacao: '2026-07-20T09:00', quantidadeFotos: 0 });
    expect(pagina.temAnterior).toBe(false);
    expect(pagina.temProxima).toBe(true);
    expect(obterEventoNavegacaoMinhasReps(html, 1, 2)).toBe('Page$2');
    expect(() => obterEventoNavegacaoMinhasReps(html, 1, 3)).toThrow();
  });

  it('submete somente filtros gerais e postbacks de leitura', () => {
    const filtro = new URLSearchParams(montarFormularioMinhasRepsGdl(html, urlPagina, 'filtrar'));
    expect(filtro.get('__VIEWSTATE')).toBe('estado&seguro');
    expect(filtro.get('__EVENTTARGET')).toBe('ctl00$Content$btnFilterReports');
    expect(filtro.get('ctl00$Content$ddlStatus')).toBe('-1');
    expect(filtro.get('ctl00$Content$hdnNeedReturn')).toBe('');
    const pagina = new URLSearchParams(montarFormularioMinhasRepsGdl(html, urlPagina, 'Page$2'));
    expect(pagina.get('__EVENTTARGET')).toBe('ctl00$Content$gridSearchMyRequests');
    expect(pagina.get('__EVENTARGUMENT')).toBe('Page$2');
  });

  it('rejeita formulário ou grade inesperados', () => {
    expect(() => montarFormularioMinhasRepsGdl(html.replace('./MinhasReps.aspx', './Concluir_REP.aspx'), urlPagina, 'filtrar')).toThrow();
    expect(() => montarFormularioMinhasRepsGdl(html.replace('name="ctl00$Content$hdnNeedReturn" value=""', 'name="ctl00$Content$hdnNeedReturn" value="true"'), urlPagina, 'filtrar')).toThrow();
    expect(() => montarFormularioMinhasRepsGdl(html, urlPagina, 'Delete$1')).toThrow();
    expect(() => interpretarMinhasRepsGdl('<table></table>', 1)).toThrow();
  });

  it('rejeita data e quantidade de fotos inválidas', () => {
    expect(() => interpretarMinhasRepsGdl(html.replace('19/07/2026 14:30', '32/07/2026 14:30'), 1)).toThrow();
    expect(() => interpretarMinhasRepsGdl(html.replace('<td>5</td>', '<td>muitas</td>'), 1)).toThrow();
  });

  it('lê exatamente a opção selecionada da natureza da própria REP', () => {
    const detalhe = (codigo: string) => `<select id="Content_RepMain_ddlNatureExam">
      <option value="">Selecione</option>
      <option value="B601" ${codigo === 'B601' ? 'selected="selected"' : ''}>B601 - EXAME DE CONSTATAÇÃO</option>
      <option value="I806" ${codigo === 'I806' ? 'selected="selected"' : ''}>I806 - EXAME DE CONSTATAÇÃO</option>
    </select>`;
    expect(obterNaturezaExameDaRepGdl(detalhe('B601'))).toBe('B601 - EXAME DE CONSTATAÇÃO');
    expect(obterNaturezaExameDaRepGdl(detalhe('I806'))).toBe('I806 - EXAME DE CONSTATAÇÃO');
    expect(obterNaturezaExameDaRepGdl(detalhe(''))).toBeNull();
  });

  it('preserva a lista e a ordem quando uma consulta de detalhe é abortada', async () => {
    const reps = interpretarMinhasRepsGdl(html, 1).reps;
    const falhas: unknown[] = [];
    let ativas = 0;
    let maximoSimultaneo = 0;
    await complementarNaturezasMinhasRepsGdl(reps, async idGdl => {
      ativas += 1;
      maximoSimultaneo = Math.max(maximoSimultaneo, ativas);
      await new Promise(resolver => setTimeout(resolver, 0));
      ativas -= 1;
      if (idGdl === 124) throw new DOMException('The operation was aborted', 'AbortError');
      return `${idGdl} - NATUREZA INFORMADA PELO GDL`;
    }, erro => { falhas.push(erro); });
    expect(maximoSimultaneo).toBe(2);
    expect(reps.map(rep => rep.idGdl)).toEqual([123, 124, 125]);
    expect(reps.map(rep => rep.naturezaExameComCodigo)).toEqual([
      '123 - NATUREZA INFORMADA PELO GDL', null, '125 - NATUREZA INFORMADA PELO GDL',
    ]);
    expect(reps[1].naturezaExame).toBe('B-602 - EXAME');
    expect(falhas).toHaveLength(1);
    expect(falhas[0]).toMatchObject({ name: 'AbortError' });
  });
});
