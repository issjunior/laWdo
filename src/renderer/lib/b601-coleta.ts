import type { Editor } from 'tinymce';
import { codigoColetaPorOrigem, esquemaRepsMesmoCasoGdl, sugerirRepColeta, formatarReferenciaColeta } from '@shared/gdl/reps-mesmo-caso';
import type { RepsMesmoCasoGdl } from '@shared/gdl/reps-mesmo-caso';
import { CATALOGO_TIPOS_PECA_B601 } from '@shared/catalogos/b601.catalogo';
import { opcoesOrigemColeta } from '@shared/catalogos/balistica-opcoes.catalogo';
import { prepararApresentacaoSeletorTabela } from './seletores-tabela-laudo';
import { personalizarTabelaPlaceholder } from './apresentacao-placeholders';

const seletorCampo = '[data-b601-exame-coleta="true"]';
const seletorCampoEditavel = `${seletorCampo}, [data-b601-campo-coleta]`;
const seletorTexto = '[data-b601-coleta-texto="true"]';
const seletorControle = '[data-b601-coleta-controle]';

function lerReferencias(tabela: HTMLElement): RepsMesmoCasoGdl | undefined {
  try {
    const valor: unknown = JSON.parse(tabela.getAttribute('data-b601-referencias') || 'null');
    const resultado = esquemaRepsMesmoCasoGdl.safeParse(valor);
    return resultado.success ? resultado.data : undefined;
  } catch { return undefined; }
}

export function limparInteracaoColetaB601(raiz: ParentNode): void {
  raiz.querySelectorAll(seletorControle).forEach(controle => controle.remove());
  raiz.querySelectorAll<HTMLElement>(seletorCampoEditavel).forEach(campo => {
    campo.querySelectorAll(seletorTexto).forEach(texto => texto.replaceWith(...Array.from(texto.childNodes)));
    campo.removeAttribute('contenteditable');
    campo.removeAttribute('data-b601-coleta-editavel');
  });
}

export function aplicarReferenciasColetaB601(raiz: ParentNode, referencias: RepsMesmoCasoGdl): number {
  const tabelas = raiz.querySelectorAll<HTMLElement>('[data-b601-coleta="true"]');
  tabelas.forEach(tabela => {
    tabela.setAttribute('data-b601-referencias', JSON.stringify(referencias));
    tabela.querySelectorAll<HTMLElement>(seletorCampo).forEach(campo => {
      const texto = campo.querySelector<HTMLElement>(seletorTexto) || campo;
      if (texto.textContent?.trim() && texto.textContent.trim() !== 'XXX') return;
      const sugestao = sugerirRepColeta(campo.getAttribute('data-b601-origem') || '', referencias);
      if (sugestao) texto.textContent = sugestao;
    });
  });
  return tabelas.length;
}

export function sincronizarCacheColetaB601(raiz: HTMLElement, htmlPadrao: string, somenteLeitura = false): void {
  const modelo = raiz.ownerDocument.createElement('div');
  modelo.innerHTML = htmlPadrao;
  const tabela = modelo.querySelector<HTMLElement>('[data-b601-coleta="true"]');
  const referencias = tabela ? lerReferencias(tabela) : undefined;
  if (referencias) aplicarReferenciasColetaB601(raiz, referencias);
  else raiz.querySelectorAll('[data-b601-referencias]').forEach(elemento => elemento.removeAttribute('data-b601-referencias'));
  prepararColetaB601(raiz, somenteLeitura);
}

export function atualizarReferenciasEditorColetaB601(editor: Editor, referencias: RepsMesmoCasoGdl): string {
  editor.undoManager.transact(() => {
    aplicarReferenciasColetaB601(editor.getBody(), referencias);
  });
  prepararColetaB601(editor.getBody(), editor.mode.isReadOnly());
  editor.nodeChanged();
  return editor.getContent();
}

export function prepararColetaB601(raiz: HTMLElement, somenteLeitura = false): void {
  limparInteracaoColetaB601(raiz);
  if (somenteLeitura) return;
  const criarBotao = (pai: HTMLElement, acao: string, rotulo: string) => {
    const botao = raiz.ownerDocument.createElement('button');
    botao.type = 'button';
    botao.textContent = rotulo;
    botao.className = 'acao-tabela-placeholder';
    botao.setAttribute('data-b601-coleta-controle', acao);
    botao.setAttribute('data-mce-bogus', 'all');
    botao.setAttribute('contenteditable', 'false');
    pai.prepend(botao);
  };
  raiz.querySelectorAll<HTMLElement>('[data-b601-coleta="true"]').forEach(tabela => {
    const referencias = lerReferencias(tabela);
    tabela.querySelectorAll<HTMLElement>(seletorCampoEditavel).forEach(campo => {
      const texto = raiz.ownerDocument.createElement('span');
      texto.setAttribute('data-b601-coleta-texto', 'true');
      texto.append(...Array.from(campo.childNodes));
      campo.append(texto);
      const atual = texto.textContent?.trim() || 'XXX';
      const controle = raiz.ownerDocument.createElement('select');
      controle.setAttribute('data-b601-coleta-controle', 'selecionar');
      controle.setAttribute('data-mce-bogus', 'all');
      const tipo = campo.getAttribute('data-b601-campo-coleta') || 'exame';
      const rotulo = tipo === 'tipo' ? 'Tipo' : tipo === 'quantidade' ? 'Qtde' : tipo === 'origem' ? 'Origem' : 'Nº Exame Coleta';
      controle.setAttribute('aria-label', rotulo);
      const valores = new Map<string, string>([[atual, atual]]);
      if (tipo === 'tipo') {
        CATALOGO_TIPOS_PECA_B601.forEach(opcao => valores.set(opcao.label, opcao.label));
      } else if (tipo === 'origem') {
        opcoesOrigemColeta.forEach(opcao => valores.set(opcao.label, opcao.label));
      } else if (tipo === 'quantidade') {
        const original = campo.getAttribute('data-b601-quantidade-original');
        if (original) valores.set(original, original);
      } else {
        const codigoOrigem = codigoColetaPorOrigem(campo.getAttribute('data-b601-origem') || '');
        referencias?.reps.filter(rep => rep.codigoNatureza === codigoOrigem)
          .forEach(rep => valores.set(formatarReferenciaColeta(rep), formatarReferenciaColeta(rep)));
      }
      valores.set('__manual__', 'Preencher manualmente');
      valores.forEach((rotulo, valor) => {
        const opcao = raiz.ownerDocument.createElement('option');
        opcao.value = valor;
        opcao.textContent = rotulo;
        controle.append(opcao);
      });
      prepararApresentacaoSeletorTabela(controle);
      controle.value = atual;
      controle.classList.toggle('campo-reservado', atual === 'XXX');
      campo.setAttribute('contenteditable', 'false');
      campo.setAttribute('data-b601-coleta-editavel', 'true');
      campo.append(controle);
    });
  });
  raiz.querySelectorAll<HTMLElement>('[data-b601-sinab="opcional"]').forEach(bloco => {
    criarBotao(bloco, 'sinab', bloco.querySelector('[data-b601-sinab-texto]') ? 'Remover encaminhamento BNPB/SINAB' : 'Incluir encaminhamento BNPB/SINAB');
  });
}

export function registrarColetaB601(editor: Editor, _laudoId: string | undefined, aoAlterar: (html: string) => void): void {
  const documento = editor.getDoc();
  const janela = documento.defaultView;
  if (!janela) return;
  let encerrado = false;
  const sincronizar = () => editor.undoManager.ignore(() => prepararColetaB601(editor.getBody(), editor.mode.isReadOnly()));
  const salvar = () => { sincronizar(); editor.nodeChanged(); aoAlterar(editor.getContent()); };
  const materializar = (elemento: HTMLElement) => {
    if (elemento.closest('[data-placeholder-preview="true"]')) personalizarTabelaPlaceholder(editor, elemento);
  };
  const preencher = (campo: HTMLElement, valor: string) => {
    if (encerrado || editor.mode.isReadOnly() || !campo.isConnected) return;
    editor.undoManager.transact(() => {
      materializar(campo);
      const texto = campo.querySelector(seletorTexto);
      if (texto) texto.textContent = valor.trim() || 'XXX';
      if (campo.getAttribute('data-b601-campo-coleta') === 'origem') {
        const exame = campo.closest('tr')?.querySelector<HTMLElement>(seletorCampo);
        if (exame) {
          exame.setAttribute('data-b601-origem', valor);
          const referencias = campo.closest<HTMLElement>('[data-b601-coleta="true"]');
          const numero = sugerirRepColeta(valor, referencias ? lerReferencias(referencias) : undefined) || 'XXX';
          const textoExame = exame.querySelector(seletorTexto) || exame;
          textoExame.textContent = numero;
        }
      }
    });
    salvar();
  };
  const alterar = (evento: Event) => {
    const alvo = evento.target;
    if (!(alvo instanceof janela.HTMLSelectElement) || !alvo.matches(seletorControle) || editor.mode.isReadOnly()) return;
    const campo = alvo.closest<HTMLElement>(seletorCampoEditavel);
    if (!campo) return;
    evento.stopImmediatePropagation();
    if (alvo.value === '__manual__') {
      const atual = campo.querySelector(seletorTexto)?.textContent?.trim() || '';
      sincronizar();
      const tipo = campo.getAttribute('data-b601-campo-coleta') || 'exame';
      const rotulo = tipo === 'quantidade' ? 'Qtde' : tipo === 'origem' ? 'Origem' : tipo === 'tipo' ? 'Tipo' : 'Nº Exame Coleta';
      const unidade = campo.getAttribute('data-b601-unidade') || '';
      const inicial = tipo === 'quantidade' && unidade && atual.endsWith(` ${unidade}`) ? atual.slice(0, -(unidade.length + 1)) : atual;
      editor.windowManager.open({ title: rotulo, body: { type: 'panel', items: [{ type: 'input', name: 'valor', label: tipo === 'quantidade' ? `Quantidade (${unidade})` : rotulo }] },
        initialData: { valor: atual === 'XXX' ? '' : inicial }, buttons: [{ type: 'cancel', text: 'Cancelar' }, { type: 'submit', text: 'Aplicar', primary: true }],
        onSubmit: api => {
          let valor = api.getData().valor.trim();
          if (tipo === 'quantidade') {
            const numero = Number(valor.replace(',', '.'));
            if (!/^\d+(?:[.,]\d+)?$/.test(valor) || !Number.isFinite(numero) || numero <= 0 || (unidade === 'UNIDADES' && !Number.isInteger(numero))) {
              editor.notificationManager.open({ type: 'error', text: unidade === 'UNIDADES' ? 'Informe uma quantidade inteira maior que zero.' : 'Informe uma quantidade maior que zero.' });
              return;
            }
            valor = `${String(numero).replace('.', ',')} ${unidade}`.trim();
          } else if (tipo === 'exame' && valor && valor !== 'XXX') {
            const identificacao = valor.match(/^([\d.]+)\s*\/\s*(\d{4})$/);
            if (!identificacao) {
              editor.notificationManager.open({ type: 'error', text: 'Informe o número do exame no formato 39.253/2022.' });
              return;
            }
            valor = formatarReferenciaColeta({ numero: identificacao[1].replace(/\D/g, ''), ano: identificacao[2] });
          }
          preencher(campo, valor);
          api.close();
        } });
    } else if (Array.from(alvo.options).some(opcao => opcao.value === alvo.value)) preencher(campo, alvo.value);
  };
  const clicar = (evento: MouseEvent) => {
    const alvo = evento.target;
    if (!(alvo instanceof janela.HTMLElement) || editor.mode.isReadOnly()) return;
    const controle = alvo.closest<HTMLElement>(seletorControle);
    if (!controle) return;
    if (controle.tagName === 'SELECT') { evento.stopImmediatePropagation(); return; }
    if (controle.tagName !== 'BUTTON') return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    if (controle.getAttribute('data-b601-coleta-controle') === 'sinab') {
      const bloco = controle.parentElement;
      if (!bloco) return;
      editor.undoManager.transact(() => {
        const texto = bloco.querySelector('[data-b601-sinab-texto]');
        if (texto) texto.remove();
        else {
          const paragrafo = documento.createElement('p');
          paragrafo.setAttribute('data-b601-sinab-texto', 'true');
          paragrafo.textContent = 'Cumpre ressaltar que o material é elegível para inclusão no Banco Nacional de Perfis Balísticos (BNPB) e deverá ser submetido aos exames e prazos de custódia definidos no Procedimento Operacional do Sistema Nacional de Análise Balística (SINAB), motivo pelo qual foi gerada a Requisição de Exame Complementar (REP) nº XXX, solicitada à Seção de Balística Forense, que conta com os recursos necessários para execução deste tipo de exame.';
          bloco.append(paragrafo);
        }
      });
      salvar();
      return;
    }
  };
  const preservar = (evento: Event) => {
    const alvo = evento.target;
    if (evento instanceof janela.KeyboardEvent && (evento.ctrlKey || evento.metaKey)) return;
    if (alvo instanceof janela.Element && alvo.closest(`select${seletorControle}`)) evento.stopImmediatePropagation();
  };
  sincronizar();
  documento.addEventListener('change', alterar, true);
  documento.addEventListener('click', clicar, true);
  documento.addEventListener('mousedown', preservar, true);
  documento.addEventListener('keydown', preservar, true);
  editor.on('SetContent LoadContent Undo Redo SwitchMode PlaceholdersAplicados', sincronizar);
  editor.on('PreProcess', evento => limparInteracaoColetaB601(evento.node));
  editor.on('remove', () => {
    encerrado = true;
    documento.removeEventListener('change', alterar, true);
    documento.removeEventListener('click', clicar, true);
    documento.removeEventListener('mousedown', preservar, true);
    documento.removeEventListener('keydown', preservar, true);
    editor.off('SetContent LoadContent Undo Redo SwitchMode PlaceholdersAplicados', sincronizar);
  });
}
