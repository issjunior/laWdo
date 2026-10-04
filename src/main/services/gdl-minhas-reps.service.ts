import { DomUtils, parseDocument } from 'htmlparser2';
import type { MinhaRepGdl, PaginaMinhasRepsGdl, StatusMinhaRepGdl } from '../../shared/types/gdl-minhas-reps.types.js';

type ElementoHtml = NonNullable<ReturnType<typeof DomUtils.findOne>>;

const ALVO_GRADE = 'ctl00$Content$gridSearchMyRequests';
const ALVO_FILTRO = 'ctl00$Content$btnFilterReports';
const CAMPOS_ESTADO = /^__(?:EVENTTARGET|EVENTARGUMENT|VIEWSTATE\d*|VIEWSTATEFIELDCOUNT|VIEWSTATEGENERATOR|PREVIOUSPAGE|EVENTVALIDATION)$/;
const CAMPOS_OCULTOS_INERTES = new Set([
  'ctl00$Content$hdnExaminationReportId',
  'ctl00$Content$hdnFileName',
  'ctl00$Content$hdnNeedReturn',
  'ctl00$Content$hdnReturnDate',
  'ctl00$Content$hdnReturnWithMedicalRecord',
]);

function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function obterDataDesignacao(texto: string): string | null {
  const valor = texto.replace(/\s+/g, ' ').trim();
  if (!valor) return null;
  const partes = valor.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!partes) throw new Error('Data de designação da REP em formato inesperado.');
  const [, dia, mes, ano, hora, minuto, segundo] = partes;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  if (data.getUTCFullYear() !== Number(ano) || data.getUTCMonth() + 1 !== Number(mes)
    || data.getUTCDate() !== Number(dia) || Number(hora) > 23 || Number(minuto) > 59
    || (segundo !== undefined && Number(segundo) > 59)) {
    throw new Error('Data de designação da REP inválida.');
  }
  return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
}

function obterQuantidadeFotos(texto: string): number | null {
  const valor = texto.trim();
  if (!valor) return null;
  if (!/^\d+$/.test(valor) || !Number.isSafeInteger(Number(valor))) {
    throw new Error('Quantidade de fotos da REP em formato inesperado.');
  }
  return Number(valor);
}

function buscarPorId(raiz: ReturnType<typeof parseDocument> | ElementoHtml, id: string): ElementoHtml | null {
  return DomUtils.findOne(elemento => elemento.attribs.id === id, raiz);
}

function filhosComNome(elemento: ElementoHtml, nome: string): ElementoHtml[] {
  return elemento.children.filter((filho): filho is ElementoHtml => DomUtils.isTag(filho) && filho.name === nome);
}

function obterStatus(celula: ElementoHtml): StatusMinhaRepGdl | null {
  const imagem = DomUtils.findOne(elemento => elemento.name === 'img', celula);
  let caminhoImagem = imagem?.attribs.src ?? '';
  try {
    caminhoImagem = decodeURIComponent(caminhoImagem);
  } catch {
    caminhoImagem = '';
  }
  const rotulo = normalizarTexto([
    imagem?.attribs.alt ?? '',
    imagem?.attribs.title ?? '',
    caminhoImagem.replace(/[_-]/g, ' '),
    DomUtils.textContent(celula),
  ].join(' '));
  if (rotulo.includes('aberta e distribuida')) return 'Aberta e Distribuída';
  if (rotulo.includes('laudo em execucao')) return 'Laudo em Execução';
  if (rotulo.includes('concluida e nao remetida')) return 'Concluída e Não Remetida';
  return null;
}

function obterGrade(html: string): ElementoHtml {
  const grade = buscarPorId(parseDocument(html), 'Content_gridSearchMyRequests');
  if (!grade || grade.name !== 'table') throw new Error('A grade Minhas REPs não foi encontrada na resposta do GDL.');
  return grade;
}

function obterLinhasDaGrade(grade: ElementoHtml): ElementoHtml[] {
  const corpo = filhosComNome(grade, 'tbody')[0] ?? grade;
  return filhosComNome(corpo, 'tr');
}

function obterEventosDePagina(grade: ElementoHtml): string[] {
  const eventos: string[] = [];
  for (const ancora of DomUtils.findAll(elemento => elemento.name === 'a', grade)) {
    const href = ancora.attribs.href ?? '';
    const correspondencia = href.match(/__doPostBack\(['"]ctl00\$Content\$gridSearchMyRequests['"],\s*['"](Page\$(?:\d+|Next|Prev))['"]\)/i);
    if (correspondencia) eventos.push(correspondencia[1]);
  }
  return eventos;
}

export function interpretarMinhasRepsGdl(html: string, paginaAtual: number): Omit<PaginaMinhasRepsGdl, 'listagemId'> {
  const grade = obterGrade(html);
  const linhas = obterLinhasDaGrade(grade);
  const cabecalho = linhas.find(linha => filhosComNome(linha, 'th').length > 0);
  if (!cabecalho) throw new Error('Cabeçalho da grade Minhas REPs não reconhecido.');
  const titulos = filhosComNome(cabecalho, 'th').map(coluna => normalizarTexto(DomUtils.textContent(coluna)));
  const indiceNumero = titulos.findIndex(titulo => titulo.includes('numero/ano da rep'));
  const indiceStatus = titulos.findIndex(titulo => titulo === 'status');
  const indiceNatureza = titulos.findIndex(titulo => titulo.includes('natureza do exame'));
  const indiceDataDesignacao = titulos.findIndex(titulo => titulo.includes('data/hora da designacao'));
  const indiceFotos = titulos.findIndex(titulo => titulo.includes('quant. fotos'));
  if ([indiceNumero, indiceStatus, indiceNatureza, indiceDataDesignacao, indiceFotos].some(indice => indice < 0)) {
    throw new Error('Colunas necessárias da grade Minhas REPs não reconhecidas.');
  }

  const reps: MinhaRepGdl[] = [];
  for (const linha of linhas) {
    const celulas = filhosComNome(linha, 'td');
    if (celulas.length <= Math.max(indiceNumero, indiceStatus, indiceNatureza, indiceDataDesignacao, indiceFotos)) continue;
    const status = obterStatus(celulas[indiceStatus]);
    if (!status) continue;
    const ancoraNumero = DomUtils.findOne(elemento => elemento.name === 'a'
      && /\/REP\/Default\.aspx\?rep_id=\d+/i.test(elemento.attribs.href ?? ''), celulas[indiceNumero]);
    const idGdl = Number(ancoraNumero?.attribs.href?.match(/\/REP\/Default\.aspx\?rep_id=([1-9]\d*)$/i)?.[1]);
    const identificacao = DomUtils.textContent(ancoraNumero ?? celulas[indiceNumero]).match(/([\d.]+)\s*\/\s*(\d{4})/);
    const naturezaExame = DomUtils.textContent(celulas[indiceNatureza]).replace(/\s+/g, ' ').trim();
    if (!Number.isSafeInteger(idGdl) || idGdl <= 0 || !identificacao || !naturezaExame) {
      throw new Error('REP da grade GDL sem identificação ou natureza de exame.');
    }
    reps.push({
      idGdl,
      numero: identificacao[1].replace(/\D/g, ''),
      ano: identificacao[2],
      naturezaExame,
      naturezaExameComCodigo: null,
      status,
      dataDesignacao: obterDataDesignacao(DomUtils.textContent(celulas[indiceDataDesignacao])),
      quantidadeFotos: obterQuantidadeFotos(DomUtils.textContent(celulas[indiceFotos])),
    });
  }
  const eventos = obterEventosDePagina(grade);
  return {
    reps,
    paginaAtual,
    temAnterior: eventos.includes('Page$Prev') || eventos.includes(`Page$${paginaAtual - 1}`),
    temProxima: eventos.includes('Page$Next') || eventos.includes(`Page$${paginaAtual + 1}`),
  };
}

export function obterNaturezaExameDaRepGdl(html: string): string | null {
  const seletor = buscarPorId(parseDocument(html), 'Content_RepMain_ddlNatureExam');
  if (!seletor || seletor.name !== 'select') return null;
  const selecionada = DomUtils.findOne(elemento => elemento.name === 'option'
    && Object.hasOwn(elemento.attribs, 'selected'), seletor);
  const texto = selecionada ? DomUtils.textContent(selecionada).trim() : '';
  return texto || null;
}

export async function complementarNaturezasMinhasRepsGdl(
  reps: MinhaRepGdl[],
  consultarDetalhe: (idGdl: number) => Promise<string | null>,
  registrarFalha: (erro: unknown, duracaoMs: number) => void,
  continuar: () => boolean = () => true,
): Promise<void> {
  for (let indice = 0; indice < reps.length; indice += 2) {
    if (!continuar()) return;
    await Promise.all(reps.slice(indice, indice + 2).map(async rep => {
      const inicio = performance.now();
      try {
        rep.naturezaExameComCodigo = await consultarDetalhe(rep.idGdl);
      } catch (erro: unknown) {
        registrarFalha(erro, Math.round(performance.now() - inicio));
      }
    }));
  }
}

export function obterEventoNavegacaoMinhasReps(html: string, paginaAtual: number, paginaDesejada: number): string {
  const eventos = obterEventosDePagina(obterGrade(html));
  const candidatos = paginaDesejada > paginaAtual
    ? [`Page$${paginaDesejada}`, 'Page$Next']
    : [`Page$${paginaDesejada}`, 'Page$Prev'];
  const evento = candidatos.find(candidato => eventos.includes(candidato));
  if (!evento || Math.abs(paginaDesejada - paginaAtual) !== 1) {
    throw new Error('A página solicitada não está disponível na grade do GDL.');
  }
  return evento;
}

export function montarFormularioMinhasRepsGdl(html: string, urlPagina: string, evento: string): string {
  if (evento !== 'filtrar' && !/^Page\$(?:[1-9]\d*|Next|Prev)$/.test(evento)) {
    throw new Error('Evento de Minhas REPs não permitido.');
  }
  const documento = parseDocument(html);
  const formulario = DomUtils.findOne(elemento => elemento.name === 'form', documento);
  if (!formulario || normalizarTexto(formulario.attribs.method ?? '') !== 'post'
    || new URL(formulario.attribs.action || urlPagina, urlPagina).href !== urlPagina) {
    throw new Error('Formulário Minhas REPs não reconhecido.');
  }
  const corpo = new URLSearchParams();
  for (const entrada of DomUtils.findAll(elemento => elemento.name === 'input', formulario)) {
    const nome = entrada.attribs.name ?? '';
    if (CAMPOS_ESTADO.test(nome)) corpo.set(nome, entrada.attribs.value ?? '');
    if (CAMPOS_OCULTOS_INERTES.has(nome)) {
      const valor = entrada.attribs.value ?? '';
      if (valor !== '' && !(nome.endsWith('hdnReturnWithMedicalRecord') && valor.toLowerCase() === 'false')) {
        throw new Error('O formulário Minhas REPs contém uma ação pendente e não será enviado.');
      }
      corpo.set(nome, valor);
    }
  }
  if (!corpo.has('__VIEWSTATE') || !corpo.has('__EVENTVALIDATION')) {
    throw new Error('Estado do formulário Minhas REPs incompleto.');
  }
  for (const [id, nome] of [
    ['Content_ddlYear', 'ctl00$Content$ddlYear'],
    ['Content_ddlStatus', 'ctl00$Content$ddlStatus'],
    ['Content_ddlUnit', 'ctl00$Content$ddlUnit'],
  ]) {
    const seletor = buscarPorId(formulario, id);
    const opcaoTodos = seletor && DomUtils.findOne(elemento => elemento.name === 'option'
      && /\btod[oa]s\b/.test(normalizarTexto(DomUtils.textContent(elemento))), seletor);
    if (!opcaoTodos || opcaoTodos.attribs.value === undefined) {
      throw new Error('Filtro geral de Minhas REPs não reconhecido.');
    }
    corpo.set(nome, opcaoTodos.attribs.value);
  }
  corpo.set('ctl00$Content$txtRepNumber', '');
  corpo.set('__EVENTTARGET', evento === 'filtrar' ? ALVO_FILTRO : ALVO_GRADE);
  corpo.set('__EVENTARGUMENT', evento === 'filtrar' ? '' : evento);
  return corpo.toString();
}
