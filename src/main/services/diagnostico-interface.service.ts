import { randomUUID } from 'node:crypto';
import type { BrowserWindow } from 'electron';
import { z } from 'zod';
import type { EntradaExecutarAcao } from '../../shared/diagnostico/contratos.js';

const schemaRetangulo = z.strictObject({ x: z.number().int(), y: z.number().int(), largura: z.number().int().nonnegative(), altura: z.number().int().nonnegative() });
const schemaElemento = z.strictObject({
  elementoId: z.string().min(1),
  paiId: z.string().min(1).nullable(),
  papel: z.string(),
  nome: z.string(),
  texto: z.string(),
  valor: z.string().nullable(),
  descricao: z.string().nullable(),
  habilitado: z.boolean(),
  focado: z.boolean(),
  selecionado: z.boolean().nullable(),
  expandido: z.boolean().nullable(),
  editavel: z.boolean(),
  retangulo: schemaRetangulo,
});

const schemaResultado = z.strictObject({
  rota: z.string(),
  titulo: z.string(),
  largura: z.number().int().positive(),
  altura: z.number().int().positive(),
  truncado: z.boolean(),
  motivoTruncamento: z.enum(['limite_elementos', 'profundidade_maxima']).nullable(),
  elementos: z.array(schemaElemento),
});

export type ElementoInterfaceDiagnostico = z.infer<typeof schemaElemento>;
export interface SnapshotInterfaceDiagnostico extends z.infer<typeof schemaResultado> {
  janelaId: number;
  revisao: string;
  capturadaEm: string;
}

function criarScriptInspecao(revisao: string, limiteElementos: number, profundidadeMaxima: number): string {
  return `(() => {
    const revisao = ${JSON.stringify(revisao)};
    const limite = ${limiteElementos};
    const profundidadeMaxima = ${profundidadeMaxima};
    const relevantes = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'SUMMARY', 'DIALOG']);
    const papeis = new Set(['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 'menuitem', 'tab', 'dialog', 'listbox', 'option', 'switch', 'slider']);
    const sensivel = /senha|password|token|secret|cpf|rg|email|telefone|endereco/i;
    const visivel = elemento => {
      const estilo = getComputedStyle(elemento);
      const retangulo = elemento.getBoundingClientRect();
      return estilo.display !== 'none' && estilo.visibility !== 'hidden' && Number(estilo.opacity) > 0 && retangulo.width > 0 && retangulo.height > 0;
    };
    const texto = elemento => (elemento.innerText || elemento.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 500);
    const nome = elemento => elemento.getAttribute('aria-label') || elemento.getAttribute('title') || texto(elemento).slice(0, 200);
    const resultado = [];
    let truncado = false;
    let motivoTruncamento = null;
    const visitar = (elemento, paiId, profundidade) => {
      if (resultado.length >= limite) { truncado = true; motivoTruncamento = 'limite_elementos'; return; }
      if (profundidade > profundidadeMaxima) { truncado = true; motivoTruncamento ||= 'profundidade_maxima'; return; }
      if (!(elemento instanceof HTMLElement) || !visivel(elemento)) return;
      const papel = elemento.getAttribute('role') || elemento.tagName.toLowerCase();
      const relevante = relevantes.has(elemento.tagName) || papeis.has(papel) || elemento.isContentEditable || elemento.tabIndex >= 0;
      let idPai = paiId;
      if (relevante) {
        const elementoId = 'e-' + (resultado.length + 1);
        elemento.setAttribute('data-lawdo-diagnostico', revisao + ':' + elementoId);
        const retangulo = elemento.getBoundingClientRect();
        const identificador = (elemento.getAttribute('name') || elemento.id || nome(elemento)).toLowerCase();
        const valorOriginal = 'value' in elemento && typeof elemento.value === 'string' ? elemento.value : null;
        resultado.push({
          elementoId, paiId, papel, nome: nome(elemento), texto: texto(elemento),
          valor: sensivel.test(identificador) ? '[redigido]' : valorOriginal,
          descricao: elemento.getAttribute('aria-description') || elemento.getAttribute('aria-describedby'),
          habilitado: !elemento.matches(':disabled, [aria-disabled="true"]'), focado: document.activeElement === elemento,
          selecionado: elemento.hasAttribute('aria-selected') ? elemento.getAttribute('aria-selected') === 'true' : null,
          expandido: elemento.hasAttribute('aria-expanded') ? elemento.getAttribute('aria-expanded') === 'true' : null,
          editavel: elemento.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(elemento.tagName),
          retangulo: { x: Math.round(retangulo.x), y: Math.round(retangulo.y), largura: Math.round(retangulo.width), altura: Math.round(retangulo.height) },
        });
        idPai = elementoId;
      }
      for (const filho of elemento.children) visitar(filho, idPai, profundidade + 1);
    };
    visitar(document.body, null, 0);
    return { rota: location.hash || location.pathname, titulo: document.title, largura: window.innerWidth, altura: window.innerHeight, truncado, motivoTruncamento, elementos: resultado };
  })()`;
}

export class DiagnosticoInterfaceService {
  private readonly revisoes = new Map<string, SnapshotInterfaceDiagnostico>();

  async inspecionar(janela: BrowserWindow, limiteElementos: number, profundidadeMaxima: number): Promise<SnapshotInterfaceDiagnostico> {
    if (janela.isDestroyed() || !janela.webContents.getURL()) throw new Error('JANELA_INDISPONIVEL');
    const revisao = randomUUID();
    const retorno = await janela.webContents.executeJavaScript(criarScriptInspecao(revisao, limiteElementos, profundidadeMaxima), true);
    const resultado = schemaResultado.parse(retorno);
    for (const [chave, snapshot] of this.revisoes) {
      if (snapshot.janelaId === janela.id) this.revisoes.delete(chave);
    }
    const snapshot = { ...resultado, janelaId: janela.id, revisao, capturadaEm: new Date().toISOString() };
    this.revisoes.set(revisao, snapshot);
    return snapshot;
  }

  obterElemento(janelaId: number, revisao: string, elementoId: string): ElementoInterfaceDiagnostico {
    const snapshot = this.revisoes.get(revisao);
    if (!snapshot || snapshot.janelaId !== janelaId) throw new Error('SNAPSHOT_EXPIRADO');
    const elemento = snapshot.elementos.find(item => item.elementoId === elementoId);
    if (!elemento) throw new Error('ELEMENTO_NAO_ENCONTRADO');
    return elemento;
  }

  invalidar(revisao: string): void {
    this.revisoes.delete(revisao);
  }

  async executarAcao(janela: BrowserWindow, entrada: EntradaExecutarAcao): Promise<{ rotaAntes: string; rotaDepois: string; duracaoMs: number }> {
    const elemento = this.obterElemento(entrada.janelaId, entrada.revisao, entrada.elementoId);
    if (janela.isDestroyed() || !janela.isVisible()) throw new Error('JANELA_INDISPONIVEL');
    if (!elemento.habilitado) throw new Error('ACAO_NAO_SUPORTADA');
    if (entrada.acao.tipo === 'digitar' && !elemento.editavel) throw new Error('ACAO_NAO_SUPORTADA');
    const rotaAntes = janela.webContents.getURL();
    const inicio = performance.now();
    const identificador = `${entrada.revisao}:${entrada.elementoId}`;
    const acao = JSON.stringify(entrada.acao);
    const executada = await janela.webContents.executeJavaScript(`(() => {
      const identificador = ${JSON.stringify(identificador)};
      const acao = ${acao};
      const elemento = Array.from(document.querySelectorAll('[data-lawdo-diagnostico]')).find(item => item.getAttribute('data-lawdo-diagnostico') === identificador);
      if (!(elemento instanceof HTMLElement)) return false;
      elemento.focus();
      if (acao.tipo === 'clicar') {
        const botoes = { esquerdo: 0, meio: 1, direito: 2 };
        const tipo = acao.botao === 'direito' ? 'contextmenu' : acao.botao === 'meio' ? 'auxclick' : 'click';
        for (let indice = 0; indice < acao.quantidade; indice += 1) elemento.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, button: botoes[acao.botao], detail: acao.quantidade }));
        return true;
      }
      const valorAtual = elemento instanceof HTMLInputElement || elemento instanceof HTMLTextAreaElement || elemento instanceof HTMLSelectElement ? elemento.value : elemento.textContent || '';
      const proximoValor = acao.modo === 'substituir' ? acao.texto : valorAtual + acao.texto;
      if (elemento instanceof HTMLInputElement || elemento instanceof HTMLTextAreaElement || elemento instanceof HTMLSelectElement) {
        const prototipo = Object.getPrototypeOf(elemento);
        const setter = Object.getOwnPropertyDescriptor(prototipo, 'value')?.set;
        if (setter) setter.call(elemento, proximoValor); else elemento.value = proximoValor;
      } else if (elemento.isContentEditable) {
        elemento.textContent = proximoValor;
      } else return false;
      elemento.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: acao.texto }));
      elemento.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`, true);
    if (executada !== true) throw new Error('ELEMENTO_NAO_ENCONTRADO');
    this.invalidar(entrada.revisao);
    return { rotaAntes, rotaDepois: janela.webContents.getURL(), duracaoMs: performance.now() - inicio };
  }
}
