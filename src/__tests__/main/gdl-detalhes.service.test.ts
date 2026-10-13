import { describe, expect, it } from 'vitest';
import { interpretarDetalhesRepGdl } from '../../main/services/gdl-detalhes.service';

const pagina = (campos: string, numero = '109.026/2026', id = '123') => `<form action="./Default.aspx?rep_id=${id}"><div id="TitleContainer">Atualizar REP de Número: ${numero}</div>${campos}</form>`;
const natureza = '<select id="Content_RepMain_ddlNatureExam"><option value="1013" selected>I806 - EXAME DE CONSTATAÇÃO</option></select>';

describe('leitura validada dos detalhes da REP', () => {
  it('lê exclusivamente a natureza selecionada, quesito e data da solicitação', () => {
    const dados = interpretarDetalhesRepGdl(pagina(`${natureza}<textarea id="Content_RepMain_txtOpenQuestion">Quesito &amp; resposta</textarea><input id="Content_RepMain_txtDateEntry" value="21/08/2026"><input id="dataPeca" value="22/08/2026">`), 123, '109026', '2026');
    expect(dados).toEqual({ natureza: 'I806 - EXAME DE CONSTATAÇÃO', quesito: { estado: 'presente', valor: 'Quesito & resposta' }, dataSolicitacao: { estado: 'presente', valor: '2026-08-21' } });
  });
  it('distingue campo vazio de ausente sem usar outra data', () => {
    expect(interpretarDetalhesRepGdl(pagina(`${natureza}<textarea id="Content_RepMain_txtOpenQuestion"></textarea>`), 123, '109026', '2026')).toMatchObject({ quesito: { estado: 'vazio' }, dataSolicitacao: { estado: 'ausente' } });
  });
  it('não interpreta controles de formato desconhecido como valores vazios', () => {
    expect(interpretarDetalhesRepGdl(pagina(`${natureza}<div id="Content_RepMain_txtOpenQuestion"></div><span id="Content_RepMain_txtDateEntry"></span>`), 123, '109026', '2026')).toMatchObject({ quesito: { estado: 'ausente' }, dataSolicitacao: { estado: 'ausente' } });
  });
  it('rejeita outra REP, página sem controles e data inválida', () => {
    expect(() => interpretarDetalhesRepGdl(pagina(natureza, '109.027/2026'), 123, '109026', '2026')).toThrow('não corresponde');
    expect(() => interpretarDetalhesRepGdl(pagina(natureza, '109.026/2026', '456'), 123, '109026', '2026')).toThrow('não corresponde');
    expect(() => interpretarDetalhesRepGdl(pagina(''), 123, '109026', '2026')).toThrow('controles');
    expect(() => interpretarDetalhesRepGdl(pagina(`${natureza}<input id="Content_RepMain_txtDateEntry" value="31/02/2026">`), 123, '109026', '2026')).toThrow('inválida');
  });
});
