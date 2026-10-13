import { parseDocument, DomUtils } from 'htmlparser2';
import type { Element } from 'domhandler';
import type { CampoDetalheGdl, DetalhesRepGdl } from '../../shared/gdl/natureza-exame.js';

export function interpretarDetalhesRepGdl(html: string, id: number, numero: string, ano: string): DetalhesRepGdl {
  const documento = parseDocument(html);
  const porId = (nome: string) => DomUtils.findOne(elemento => elemento.attribs.id === nome, documento.children, true);
  const titulo = porId('TitleContainer');
  const identidade = titulo && DomUtils.textContent(titulo).match(/([\d.]+)\s*\/\s*(\d{4})/);
  const formulario = DomUtils.findOne(elemento => elemento.name === 'form', documento.children, true);
  const idPagina = formulario?.attribs.action?.match(/[?&]rep_id=(\d+)(?:&|$)/i);
  if (!identidade || identidade[1].replace(/\D/g, '') !== numero.replace(/\D/g, '') || identidade[2] !== ano
    || !idPagina || Number(idPagina[1]) !== id) throw new Error('A página retornada não corresponde à REP consultada.');
  const lerCampo = (elemento: Element | null): CampoDetalheGdl => {
    if (!elemento || !['input', 'textarea'].includes(elemento.name)) return { estado: 'ausente', valor: '' };
    const texto = elemento.name === 'textarea' ? DomUtils.textContent(elemento) : elemento.attribs.value ?? '';
    const valor = (elemento.name === 'textarea'
      ? DomUtils.textContent(parseDocument(`<div>${texto.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`)) : texto).trim();
    return { estado: valor ? 'presente' : 'vazio', valor };
  };
  const quesito = lerCampo(porId('Content_RepMain_txtOpenQuestion'));
  const dataSolicitacao = lerCampo(porId('Content_RepMain_txtDateEntry'));
  if (dataSolicitacao.estado === 'presente') {
    const partes = dataSolicitacao.valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!partes) throw new Error('Formato da data de solicitação não reconhecido.');
    const [, dia, mes, anoData] = partes;
    const data = new Date(Date.UTC(Number(anoData), Number(mes) - 1, Number(dia)));
    if (data.getUTCFullYear() !== Number(anoData) || data.getUTCMonth() + 1 !== Number(mes) || data.getUTCDate() !== Number(dia)) throw new Error('Data de solicitação inválida.');
    dataSolicitacao.valor = `${anoData}-${mes}-${dia}`;
  }
  const seletor = porId('Content_RepMain_ddlNatureExam');
  const selecionada = seletor?.name === 'select' && DomUtils.findOne(elemento => elemento.name === 'option' && 'selected' in elemento.attribs, seletor.children, true);
  const natureza = selecionada && /^\d+$/.test(selecionada.attribs.value ?? '') && Number(selecionada.attribs.value) > 0
    ? DomUtils.textContent(selecionada).trim() : null;
  if (!seletor && quesito.estado === 'ausente' && dataSolicitacao.estado === 'ausente') throw new Error('Os controles da página da REP não foram reconhecidos.');
  return { natureza, quesito, dataSolicitacao };
}
