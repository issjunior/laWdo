import { normalizarOpcoesTabelaB601, obterCampoTabelaB601, obterOpcoesCampoTabelaB601, VALOR_MANUAL_TABELA_B601, VERSAO_CAMPOS_TABELA_B601 } from '@shared/catalogos/b601-tabelas.catalogo';
import { permiteEdicaoCampo } from './politica-edicao-conteudo';
import { SELETOR_SELECAO_PONTUAL } from './adaptadores-conteudo-laudo';
import { registrarPreparacaoConteudo } from './preparacao-conteudo-editor';
import { editorBloqueadoParaSeletores, limparApresentacaoSeletoresTabela, prepararApresentacaoSeletorTabela } from './seletores-tabela-laudo';
import type { Editor } from 'tinymce';
import { opcoesCalibreNominalCartucho, opcoesMarcaCartucho, opcoesOrigemColeta } from '@shared/catalogos/balistica-opcoes.catalogo';
import { catalogoProjeteis } from '@shared/catalogos/projeteis.catalogo';
import { criarOpcoesFormatoProjetil, normalizarFormatoProjetil } from '@shared/utils/formato-projetil';
import { OPCOES_TIPO_PROJETIL_B601, OPCOES_TIPO_RAIAMENTO_B601 } from '@shared/catalogos/b601.catalogo';
import { criarHtmlCampoReservado } from '@shared/utils/campo-reservado';
import { consultarProjeteis, converterMedidaProjetil, obterErroMedidasProjetil, referenciaProjetilPersonalizadaValida } from '@shared/utils/consulta-projeteis';
import { LIMITE_PROXIMIDADE_PERCENTUAL } from '@shared/utils/proximidade-medida';
import type { FormularioMedidasProjetil, ProjetilReferencia } from '@shared/types/projetil.types';

const seletorCampo = '[data-b601-grupo="105"] [data-b601-origem-projetil="true"], [data-b601-grupo="105"] [data-b601-campo-projetil], [data-b601-grupo="101"] [data-b601-campo-estojo]';
const seletorControle = 'select[data-b601-campo-select="true"]';
const seletorTexto = '[data-b601-campo-texto="true"]';
const seletorLegenda = '[data-b601-legenda-formatos="automatica"], [data-b601-legenda-tipos="automatica"]';
const seletorIdentificacao = 'button[data-b601-identificar-projetil="true"]';
const siglasPadrao = [...new Set(catalogoProjeteis.flatMap(item => item.sigla ? [item.sigla] : []))];
let carregamentoPersonalizados: Promise<ProjetilReferencia[]> | undefined;

export interface SolicitacaoIdentificacaoProjetilB601 {
  identificador: string;
  medidas: FormularioMedidasProjetil;
  restaurarFoco: () => void;
}

interface OpcoesCamposProjeteisB601 {
  habilitarClassificacao?: boolean;
}

function carregarFormatosPersonalizados(): Promise<ProjetilReferencia[]> {
  if (!carregamentoPersonalizados) {
    carregamentoPersonalizados = (async () => {
      const resposta = await window.ipcAPI.projetil.listarPersonalizados();
      if (!resposta.success || !Array.isArray(resposta.data)) throw new Error(resposta.error || 'Resposta inválida ao carregar formatos de projéteis.');
      return (resposta.data as unknown[]).filter(referenciaProjetilPersonalizadaValida);
    })().finally(() => { carregamentoPersonalizados = undefined; });
  }
  return carregamentoPersonalizados;
}

function normalizarRotuloMedida(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    .replace(/\s*\([^)]*\)\s*$/, '').trim().replace(/\s+/g, ' ');
}

function textoPersistivelCelula(celula: Element | undefined): string {
  if (!celula) return '';
  const copia = celula.cloneNode(true) as HTMLElement;
  copia.querySelectorAll('[data-mce-bogus="all"], select, button').forEach(elemento => elemento.remove());
  const texto = copia.textContent?.trim() || '';
  return texto === 'XXX' ? '' : texto;
}

export function lerMedidasCampoCalibreB601(campo: HTMLElement): FormularioMedidasProjetil {
  const celula = campo.closest<HTMLTableCellElement>('td, th');
  const tabela = campo.closest<HTMLTableElement>('table');
  const vazio: FormularioMedidasProjetil = { calibreRealMm: '', alturaMaximaMm: '', massaGramas: '' };
  if (!celula || !tabela || celula.cellIndex <= 0) return vazio;
  const linhas = Array.from(tabela.querySelectorAll<HTMLTableRowElement>('tbody tr'));
  const ler = (chave: string) => {
    const linha = linhas.find(item => normalizarRotuloMedida(item.firstElementChild?.textContent || '') === chave);
    return textoPersistivelCelula(linha?.children[celula.cellIndex]);
  };
  return { massaGramas: ler('massa'), calibreRealMm: ler('diametro medio'), alturaMaximaMm: ler('altura') };
}

function identidadeCalibre(valor: string): string {
  return valor.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function ordenarCalibresPorMedidas(campo: HTMLElement, referencias: readonly ProjetilReferencia[]): string[] | null {
  const medidas = lerMedidasCampoCalibreB601(campo);
  if (obterErroMedidasProjetil(medidas)) return null;
  const consulta = {
    calibreRealMm: converterMedidaProjetil(medidas.calibreRealMm),
    alturaMaximaMm: converterMedidaProjetil(medidas.alturaMaximaMm),
    massaGramas: converterMedidaProjetil(medidas.massaGramas),
    medidaPrioritaria: 'massaGramas' as const,
    perdaMaterial: false,
    limiteProximidadePercentual: LIMITE_PROXIMIDADE_PERCENTUAL,
    sigla: null,
  };
  if (consulta.calibreRealMm === null && consulta.alturaMaximaMm === null && consulta.massaGramas === null) return null;
  const calibres = new Map<string, string>();
  for (const resultado of consultarProjeteis([...referencias], consulta)) {
    const calibre = resultado.projetil.calibre.trim();
    const identidade = identidadeCalibre(calibre);
    if (calibre && !calibres.has(identidade)) calibres.set(identidade, calibre);
  }
  return [...calibres.values()];
}

function obterDefinicaoCampo(campo: HTMLElement) {
  const grupo = campo.closest('[data-b601-grupo]');
  if (campo.getAttribute('data-b601-campo-projetil') === 'aderencias') return obterCampoTabelaB601('105', 'aderencias');
  if (grupo?.getAttribute('data-b601-campos-versao') !== VERSAO_CAMPOS_TABELA_B601) return undefined;
  const definicao = obterCampoTabelaB601(grupo.getAttribute('data-b601-grupo'), campo.getAttribute('data-b601-campo'));
  return definicao?.fonte ? definicao : undefined;
}

function obterOpcoes(campo: HTMLElement, personalizados: readonly ProjetilReferencia[], atual: string, classificarCalibre: boolean): { texto: string; valor: string }[] {
  const definicao = obterDefinicaoCampo(campo);
  const tipo = campo.getAttribute('data-b601-campo-projetil');
  if (tipo === 'calibre_nominal_provavel' && classificarCalibre) {
    const referencias = [...catalogoProjeteis, ...personalizados];
    const ordenados = ordenarCalibresPorMedidas(campo, referencias);
    const calibres = ordenados ?? [...new Map(referencias.map(item => [identidadeCalibre(item.calibre), item.calibre.trim()])).values()]
      .filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (atual && atual !== 'XXX' && atual !== 'Prejudicado' && !calibres.some(valor => identidadeCalibre(valor) === identidadeCalibre(atual))) {
      calibres.push(atual);
    }
    const opcoes = calibres.map(valor => ({ texto: valor, valor }));
    opcoes.push({ texto: 'Prejudicado', valor: 'Prejudicado' });
    if (definicao) opcoes.push({ texto: 'Preenchimento manual…', valor: VALOR_MANUAL_TABELA_B601 });
    return opcoes;
  }
  if (definicao) return obterOpcoesCampoTabelaB601(definicao, personalizados, atual);
  const campoEstojo = campo.getAttribute('data-b601-campo-estojo');
  if (campoEstojo) {
    if (campoEstojo === 'marca') return opcoesMarcaCartucho.map(opcao => ({ texto: opcao.label, valor: opcao.label }));
    if (campoEstojo === 'calibre_nominal') return opcoesCalibreNominalCartucho.map(opcao => ({ texto: opcao.label, valor: opcao.label }));
    return ['composicao', 'espoleta'].includes(campoEstojo)
      ? ['Latonado', 'Niquelado'].map(valor => ({ texto: valor, valor })) : [];
  }
  if (tipo === 'tipo') return OPCOES_TIPO_PROJETIL_B601.map(opcao => ({ texto: opcao.valor, valor: opcao.valor }));
  if (tipo === 'tipo_raiamento') return OPCOES_TIPO_RAIAMENTO_B601.map(valor => ({ texto: valor, valor }));
  if (tipo === 'calibre_nominal_provavel') {
    const calibres = new Map<string, string>();
    for (const valor of [...catalogoProjeteis.map(item => item.calibre), ...personalizados.map(item => item.calibre || '')]) {
      const texto = valor.trim();
      const chave = texto.replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
      if (texto && chave !== 'prejudicado' && !calibres.has(chave)) calibres.set(chave, texto);
    }
    return ['Prejudicado', ...Array.from(calibres.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))]
      .map(valor => ({ texto: valor, valor }));
  }
  return tipo === 'constituicao_formato'
    ? criarOpcoesFormatoProjetil([...siglasPadrao, ...personalizados.flatMap(item => item.sigla ? [item.sigla] : [])], personalizados.map(item => item.tipo), atual)
      .map(opcao => ({ texto: opcao.rotulo, valor: opcao.valor }))
    : opcoesOrigemColeta.map(opcao => ({ texto: opcao.label, valor: opcao.label }));
}

function atualizarLegendaFormatos(grupo: HTMLElement, personalizados: readonly ProjetilReferencia[]): void {
  const siglas = [...siglasPadrao, ...personalizados.flatMap(item => item.sigla ? [item.sigla] : [])];
  const opcoes = criarOpcoesFormatoProjetil(siglas, personalizados.map(item => item.tipo));
  const legendaAntiga = 'LEGENDA: CHOG = Chumbo Ogival; ETOG = Encamisado Total Ogival; EXPO = Expansivo Ponta Oca.';
  grupo.querySelectorAll(seletorLegenda).forEach(legenda => legenda.remove());
  Array.from(grupo.children).filter(elemento => elemento.tagName === 'P' && elemento.textContent?.trim() === legendaAntiga)
    .forEach(elemento => elemento.remove());
  grupo.querySelectorAll<HTMLTableElement>('table').forEach(tabela => {
    const entradas = new Map<string, string>();
    tabela.querySelectorAll<HTMLElement>('[data-b601-campo-projetil="constituicao_formato"]').forEach(campo => {
      if (campo.closest('table') !== tabela) return;
      const valor = (campo.querySelector(seletorTexto) || campo).textContent?.trim() || '';
      const opcao = opcoes.find(item => normalizarFormatoProjetil(item.valor) === normalizarFormatoProjetil(valor));
      if (opcao && siglas.includes(opcao.valor)) entradas.set(opcao.valor, opcao.descricao);
    });
    if (!entradas.size) return;
    const legenda = grupo.ownerDocument.createElement('p');
    legenda.setAttribute('data-b601-legenda-formatos', 'automatica');
    legenda.textContent = `LEGENDA: ${Array.from(entradas, ([sigla, descricao]) => `${sigla} = ${descricao}`).join('; ')}.`;
    legenda.setAttribute('contenteditable', 'false');
    tabela.after(legenda);
  });
}

function lerUnidades(grupo: HTMLElement): { pecaId: string; unidade: number }[] {
  try {
    const assinatura: unknown = JSON.parse(grupo.getAttribute('data-b601-assinatura') || '');
    if (!Array.isArray(assinatura)) return [];
    const itens: unknown[] = assinatura;
    const unidades: { pecaId: string; unidade: number }[] = [];
    const limite = grupo.querySelectorAll('thead tr:last-child th').length;
    for (const item of itens) {
      if (!item || typeof item !== 'object' || !('id' in item) || typeof item.id !== 'string'
        || !('quantidade' in item) || typeof item.quantidade !== 'number'
        || !Number.isSafeInteger(item.quantidade) || item.quantidade <= 0) return [];
      for (let indice = 1; indice <= item.quantidade && unidades.length < limite; indice++) {
        unidades.push({ pecaId: item.id, unidade: indice });
      }
      if (unidades.length >= limite) break;
    }
    return unidades;
  } catch {
    return [];
  }
}

function prepararAcaoIdentificacao(campo: HTMLElement, identificador: string, habilitar: boolean): void {
  campo.querySelectorAll(seletorIdentificacao).forEach(botao => botao.remove());
  if (!habilitar || campo.getAttribute('data-b601-campo-projetil') !== 'calibre_nominal_provavel') return;
  const acionador = campo.querySelector<HTMLButtonElement>('[data-seletor-tabela-acionador]');
  if (!acionador) return;
  const botao = campo.ownerDocument.createElement('button');
  botao.type = 'button';
  botao.className = 'seletor-tabela-identificar-projetil';
  botao.setAttribute('data-b601-identificar-projetil', 'true');
  botao.setAttribute('data-mce-bogus', 'all');
  botao.setAttribute('contenteditable', 'false');
  botao.setAttribute('aria-label', `Abrir identificação de projéteis com as medidas de ${identificador}`);
  botao.title = `Identificar ${identificador} pelas medidas da tabela`;
  const medidas = lerMedidasCampoCalibreB601(campo);
  botao.disabled = Object.values(medidas).every(valor => !valor.trim());
  const icone = campo.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icone.setAttribute('viewBox', '0 0 24 24');
  icone.setAttribute('aria-hidden', 'true');
  const circulo = campo.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circulo.setAttribute('cx', '12');
  circulo.setAttribute('cy', '12');
  circulo.setAttribute('r', '3');
  const caminho = campo.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path');
  caminho.setAttribute('d', 'M12 2v4m0 12v4M2 12h4m12 0h4');
  icone.append(circulo, caminho);
  botao.append(icone);
  acionador.after(botao);
}

export function prepararCamposProjeteisB601(raiz: HTMLElement, somenteLeitura = false, personalizados: readonly ProjetilReferencia[] = [], opcoes: OpcoesCamposProjeteisB601 = {}): void {
  raiz.querySelectorAll<HTMLElement>('[data-b601-grupo="105"]').forEach(grupo => {
    const versionado = grupo.hasAttribute('data-b601-campos-versao');
    const unidades = lerUnidades(grupo);
    grupo.querySelectorAll<HTMLTableElement>('table').forEach(tabela => {
      const cabecalhos = Array.from(tabela.querySelectorAll<HTMLElement>('thead tr:last-child th')).slice(1);
      const linhas = Array.from(tabela.querySelectorAll<HTMLTableRowElement>('tbody tr'))
        .filter(candidata => ['Origem', 'Tipo', 'Constituição e formato', 'Calibre nominal (provável)', 'Aderências'].includes(candidata.firstElementChild?.textContent?.trim() || '')
          || /^tipo(?: de)? raiamento$/i.test(candidata.firstElementChild?.textContent?.trim().replace(/\s+/g, ' ') || ''));
      linhas.forEach(linha => {
        if (versionado && linha.firstElementChild?.textContent?.trim() !== 'Aderências') return;
        if (linha.children.length !== cabecalhos.length + 1) return;
        const rotulo = linha.firstElementChild?.textContent?.trim();
        const tipo = rotulo === 'Aderências' ? 'aderencias' : rotulo === 'Calibre nominal (provável)' ? 'calibre_nominal_provavel'
          : /^tipo(?: de)? raiamento$/i.test(rotulo?.replace(/\s+/g, ' ') || '') ? 'tipo_raiamento'
          : rotulo === 'Tipo' ? 'tipo' : rotulo === 'Constituição e formato' ? 'constituicao_formato' : 'origem';
        Array.from(linha.children).slice(1).forEach((celula, indice) => {
          if (celula.querySelector('[data-b601-origem-projetil], [data-b601-campo-projetil]')) return;
          const pq = cabecalhos[indice]?.textContent?.trim().match(/^(PQ(\d+))(?:\s*·\s*Item\s+\d+)?$/);
          const referencia = Array.from(tabela.querySelectorAll<HTMLTableRowElement>('tbody tr'))
            .map(outra => outra.children[indice + 1]?.querySelector<HTMLElement>('[data-b601-peca-id][data-b601-unidade]'))
            .find(Boolean);
          const unidade = referencia ? { pecaId: referencia.getAttribute('data-b601-peca-id') || '', unidade: Number(referencia.getAttribute('data-b601-unidade')) }
            : pq ? unidades[Number(pq[2]) - 1] : undefined;
          if (!pq || !unidade) return;
          const campo = raiz.ownerDocument.createElement('span');
          campo.setAttribute('data-b601-campo-projetil', tipo);
          if (versionado) campo.setAttribute('data-b601-campo', tipo);
          campo.setAttribute('data-b601-peca-id', unidade.pecaId);
          campo.setAttribute('data-b601-unidade', String(unidade.unidade));
          campo.setAttribute('data-b601-pq', pq[1]);
          campo.append(...Array.from(celula.childNodes));
          celula.append(campo);
        });
      });
    });
  });
  if (somenteLeitura) {
    limparInteracaoCamposB601(raiz);
    return;
  }
  raiz.querySelectorAll<HTMLElement>(seletorLegenda).forEach(legenda => legenda.setAttribute('contenteditable', 'false'));
  raiz.querySelectorAll<HTMLElement>(seletorCampo).forEach(campo => {
    const definicao = obterDefinicaoCampo(campo);
    const campoAposentado = campo.hasAttribute('data-b601-campo')
      && Boolean(campo.closest(`[data-b601-campos-versao="${VERSAO_CAMPOS_TABELA_B601}"]`));
    const campoColetaNaoSuportado = Boolean(campo.closest('[data-b601-modelo-coleta="true"]'))
      && !['tipo', 'tipo_raiamento', 'calibre_nominal_provavel'].includes(campo.getAttribute('data-b601-campo-projetil') || '');
    if (!definicao && (campoAposentado || campoColetaNaoSuportado)) {
      limparApresentacaoSeletoresTabela(campo);
      campo.querySelectorAll(seletorControle).forEach(controle => controle.remove());
      campo.querySelectorAll(seletorTexto).forEach(texto => texto.replaceWith(...Array.from(texto.childNodes)));
      for (const atributo of ['contenteditable', 'tabindex', 'role', 'title', 'aria-label', 'data-b601-campo-editavel']) campo.removeAttribute(atributo);
      return;
    }
    let texto = campo.querySelector<HTMLElement>(seletorTexto);
    if (!texto) {
      texto = raiz.ownerDocument.createElement('span');
      texto.setAttribute('data-b601-campo-texto', 'true');
      texto.append(...Array.from(campo.childNodes));
      campo.append(texto);
    }
    const textoAtual = texto.textContent?.trim() || '';
    const tipo = campo.getAttribute('data-b601-campo-projetil');
    const atual = textoAtual === 'XXX' ? '' : textoAtual;
    const identificador = campo.getAttribute('data-b601-pq') || campo.getAttribute('data-b601-identificador') || 'projétil';
    const campoEstojo = campo.getAttribute('data-b601-campo-estojo');
    const rotulosEstojos: Record<string, string> = { marca: 'Marca', calibre_nominal: 'Calibre Nominal', composicao: 'Composição do Estojo', espoleta: 'Espoleta' };
    const ehFormato = tipo === 'constituicao_formato';
    const ehCalibre = tipo === 'calibre_nominal_provavel';
    const rotulo = definicao?.rotulo || (campoEstojo ? rotulosEstojos[campoEstojo] || campoEstojo : ehFormato ? 'Constituição e formato' : ehCalibre ? 'Calibre nominal (provável)' : tipo === 'tipo_raiamento' ? 'Tipo de Raiamento' : tipo === 'tipo' ? 'Tipo' : 'Origem/coleta');
    const aviso = atual ? `${rotulo} de ${identificador}`
      : texto.querySelector('[data-aviso-reservado]')?.getAttribute('data-aviso-reservado')
        || (tipo === 'tipo' || tipo === 'tipo_raiamento' || ehCalibre || ehFormato || campoEstojo ? `Campo de preenchimento manual no laudo: ${rotulo} — ${identificador}` : `Campo pendente na REP: ORIGEM/COLETA — ${identificador}`);
    let controle = campo.querySelector<HTMLSelectElement>(seletorControle);
    if (!controle) {
      controle = raiz.ownerDocument.createElement('select');
      controle.setAttribute('data-b601-campo-select', 'true');
      controle.setAttribute('data-mce-bogus', 'all');
      controle.disabled = !permiteEdicaoCampo(campo, somenteLeitura, campo.matches(SELETOR_SELECAO_PONTUAL));
      campo.append(controle);
    }
    const chave = definicao?.chave || campoEstojo || tipo || 'origem';
    const opcoesCampo = normalizarOpcoesTabelaB601(obterOpcoes(campo, personalizados, atual, opcoes.habilitarClassificacao === true), chave);
    const assinaturaOpcoes = JSON.stringify(opcoesCampo);
    if (controle.getAttribute('data-opcoes') !== assinaturaOpcoes) {
    controle.setAttribute('data-opcoes', assinaturaOpcoes);
    controle.replaceChildren(...opcoesCampo.map(opcao => {
      const elemento = raiz.ownerDocument.createElement('option');
      elemento.value = opcao.valor;
      if (ehCalibre) elemento.label = opcao.texto;
      else elemento.textContent = opcao.texto;
      elemento.disabled = !opcao.valor;
      return elemento;
    }));
    }
    controle.disabled = !permiteEdicaoCampo(campo, somenteLeitura, campo.matches(SELETOR_SELECAO_PONTUAL));
    controle.value = atual;
    controle.classList.toggle('campo-reservado', !atual);
    controle.setAttribute('aria-label', `${rotulo} de ${identificador}`);
    controle.setAttribute('title', aviso);
    controle.setAttribute('data-valor-livre', atual);
    const textoApresentado = normalizarOpcoesTabelaB601([{ valor: atual, texto: atual }], chave)[0]?.texto;
    prepararApresentacaoSeletorTabela(controle, textoApresentado || 'XXX');
    prepararAcaoIdentificacao(campo, identificador, opcoes.habilitarClassificacao === true);
    campo.setAttribute('data-b601-campo-editavel', 'true');
    campo.setAttribute('contenteditable', 'false');
    for (const atributo of ['tabindex', 'role', 'title', 'aria-label']) campo.removeAttribute(atributo);
  });
}

export function limparInteracaoCamposB601(raiz: ParentNode): void {
  limparApresentacaoSeletoresTabela(raiz);
  raiz.querySelectorAll(seletorIdentificacao).forEach(botao => botao.remove());
  raiz.querySelectorAll(seletorLegenda).forEach(legenda => legenda.removeAttribute('contenteditable'));
  raiz.querySelectorAll<HTMLElement>(seletorCampo).forEach(campo => {
    campo.querySelectorAll(seletorControle).forEach(controle => controle.remove());
    campo.querySelectorAll(seletorTexto).forEach(texto => texto.replaceWith(...Array.from(texto.childNodes)));
    for (const atributo of ['contenteditable', 'tabindex', 'role', 'title', 'aria-label', 'data-b601-campo-editavel']) campo.removeAttribute(atributo);
  });
}

export function registrarSeletoresCamposB601(
  editor: Editor,
  aoAlterar: (html: string) => void,
  aoSolicitarIdentificacao?: (solicitacao: SolicitacaoIdentificacaoProjetilB601) => void,
): void {
  const documento = editor.getDoc();
  const janela = documento.defaultView;
  if (!janela) return;
  let personalizados: ProjetilReferencia[] = [];
  let carregouFormatos = false;
  let encerrado = false;
  const sincronizar = () => {
    editor.undoManager.ignore(() => prepararCamposProjeteisB601(
      editor.getBody(), editorBloqueadoParaSeletores(editor), personalizados,
      { habilitarClassificacao: Boolean(aoSolicitarIdentificacao) },
    ));
    if (!carregouFormatos && editor.getBody().querySelector('[data-b601-grupo="105"]')) {
      carregouFormatos = true;
      void carregarFormatosPersonalizados().then(formatos => {
        if (encerrado) return;
        personalizados = formatos;
        sincronizar();
      }).catch((erro: unknown) => {
        console.warn('Não foi possível carregar os formatos personalizados de projéteis.', erro instanceof Error ? erro.message : 'Erro inesperado');
      });
    }
  };
  const alterar = (evento: Event) => {
    const alvo = evento.target;
    if (!(alvo instanceof janela.HTMLSelectElement) || !alvo.matches(seletorControle)) return;
    const preenchimentoRapido = evento instanceof janela.CustomEvent && evento.detail === 'preenchimento-rapido-b601';
    const campo = alvo.closest<HTMLElement>(seletorCampo);
    if (!campo || editorBloqueadoParaSeletores(editor) || !permiteEdicaoCampo(campo, editorBloqueadoParaSeletores(editor), campo.matches(SELETOR_SELECAO_PONTUAL))) return;
    evento.stopImmediatePropagation();
    const texto = campo.querySelector<HTMLElement>(seletorTexto);
    const definicao = obterDefinicaoCampo(campo);
    const atual = texto?.textContent?.trim() || '';
    const valor = (alvo.value || alvo.getAttribute('data-valor-livre') || '').trim();
    const podeAplicar = () => !encerrado && !editor.removed && !editor.destroyed && editor.getBody().contains(campo)
      && campo.querySelector(seletorTexto) === texto && (texto?.textContent?.trim() || '') === atual
      && permiteEdicaoCampo(campo, editorBloqueadoParaSeletores(editor), campo.matches(SELETOR_SELECAO_PONTUAL));
    const aplicar = (novo: string) => {
      if (novo === 'XXX') novo = '';
      if (!texto || !podeAplicar()) return;
      if (novo === (atual === 'XXX' ? '' : atual)) { sincronizar(); return; }
      editor.undoManager.transact(() => {
        if (!novo) texto.innerHTML = criarHtmlCampoReservado(`Campo de preenchimento manual no laudo: ${definicao?.rotulo || 'Calibre nominal (provável)'} — ${campo.getAttribute('data-b601-pq') || campo.getAttribute('data-b601-identificador') || 'projétil'}`);
        else texto.textContent = novo;
        const grupo = campo.closest<HTMLElement>('[data-b601-grupo="105"]');
        if (grupo && campo.getAttribute('data-b601-campo-projetil') === 'constituicao_formato') atualizarLegendaFormatos(grupo, personalizados);
      });
      sincronizar();
      if (!preenchimentoRapido) {
        editor.nodeChanged();
        aoAlterar(editor.getContent());
      }
    };
    if (definicao && valor === VALOR_MANUAL_TABELA_B601) {
      sincronizar();
      editor.windowManager.open({ title: definicao.rotulo,
        body: { type: 'panel', items: [{ type: 'input', name: 'valor', label: definicao.rotulo }] },
        initialData: { valor: atual === 'XXX' ? '' : atual },
        buttons: [{ type: 'cancel', text: 'Cancelar' }, { type: 'submit', text: 'Aplicar', primary: true }],
        onClose: () => {
          if (!encerrado && editor.getBody().contains(campo) && !editorBloqueadoParaSeletores(editor)) {
            campo.querySelector<HTMLButtonElement>('[data-seletor-tabela-acionador]')?.focus({ preventScroll: true });
          }
        },
        onSubmit: api => {
          const novo = api.getData().valor.trim();
          if (novo === VALOR_MANUAL_TABELA_B601) return;
          aplicar(novo);
          api.close();
        },
      });
      return;
    }
    if (!texto) return;
    aplicar(valor);
  };
  const preservarInteracao = (evento: MouseEvent | KeyboardEvent) => {
    const alvo = evento.target;
    if (!(alvo instanceof janela.Element)) return;
    if (alvo.closest(seletorIdentificacao)) {
      evento.stopImmediatePropagation();
      return;
    }
    const controle = alvo.closest<HTMLSelectElement>(seletorControle);
    if (!controle) return;
    if (evento instanceof janela.KeyboardEvent && (evento.ctrlKey || evento.metaKey)) return;
    evento.stopImmediatePropagation();
  };
  const solicitarIdentificacao = (evento: MouseEvent) => {
    const alvo = evento.target;
    const botao = alvo instanceof janela.Element ? alvo.closest<HTMLButtonElement>(seletorIdentificacao) : null;
    if (!botao || botao.disabled || !aoSolicitarIdentificacao) return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    const campo = botao.closest<HTMLElement>('[data-b601-campo-projetil="calibre_nominal_provavel"]');
    if (!campo || !editor.getBody().contains(campo)) return;
    aoSolicitarIdentificacao({
      identificador: campo.getAttribute('data-b601-pq') || 'projétil',
      medidas: lerMedidasCampoCalibreB601(campo),
      restaurarFoco: () => {
        if (!encerrado && editor.getBody().contains(botao)) botao.focus({ preventScroll: true });
      },
    });
  };
  const atualizarClassificacao = () => {
    if (aoSolicitarIdentificacao) agendarSincronizacao();
  };
  sincronizar();
  documento.addEventListener('change', alterar, true);
  documento.addEventListener('click', solicitarIdentificacao, true);
  documento.addEventListener('mousedown', preservarInteracao, true);
  documento.addEventListener('click', preservarInteracao, true);
  documento.addEventListener('keydown', preservarInteracao, true);
  const agendarSincronizacao = registrarPreparacaoConteudo(editor, sincronizar);
  documento.addEventListener('input', atualizarClassificacao, true);
  editor.on('PreProcess', evento => limparInteracaoCamposB601(evento.node));
  editor.on('remove', () => {
    encerrado = true;
    documento.removeEventListener('change', alterar, true);
    documento.removeEventListener('click', solicitarIdentificacao, true);
    documento.removeEventListener('mousedown', preservarInteracao, true);
    documento.removeEventListener('click', preservarInteracao, true);
    documento.removeEventListener('keydown', preservarInteracao, true);
    documento.removeEventListener('input', atualizarClassificacao, true);
    editor.off('ConteudoInterativoAlterado SetContent LoadContent Undo Redo SwitchMode', sincronizar);
  });
}
