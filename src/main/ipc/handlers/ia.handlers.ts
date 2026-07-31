import { BrowserWindow, clipboard, ipcMain } from 'electron';
import { logDebug, logError } from '../../utils/logger.js';
import { configuracaoService } from '../../services/configuracao.service.js';
import { iaExecucaoService } from '../../services/ia-execucao.service.js';
import { comandoPainelIaValido } from '../../../shared/types/ia.types.js';
import type {
  PerfilRespostaIa,
  SolicitacaoDescricaoImagemIa,
  SolicitacaoIa,
} from '../../../shared/types/ia.types.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
];

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
];

const MODELO_PADRAO_GROQ = 'llama-3.3-70b-versatile';
const MODELO_PADRAO_GEMINI = 'gemini-2.5-flash';

function solicitacaoDescricaoImagemValida(valor: unknown): valor is SolicitacaoDescricaoImagemIa {
  if (!valor || typeof valor !== 'object') return false;
  const registro = valor as Record<string, unknown>;
  const chaves = Object.keys(registro).sort();
  return chaves.length === 3
    && chaves[0] === 'imagemId'
    && chaves[1] === 'laudoId'
    && chaves[2] === 'operationId'
    && typeof registro.operationId === 'string'
    && registro.operationId.length > 0
    && typeof registro.laudoId === 'string'
    && registro.laudoId.length > 0
    && typeof registro.imagemId === 'string'
    && registro.imagemId.length > 0;
}

async function obterConfigGroq(): Promise<{ apiKey: string | null; modelo: string }> {
  const apiKey = await configuracaoService.obter('api_key_groq');
  const modeloSalvo = await configuracaoService.obter('modelo_ia_padrao');
  const modelo = modeloSalvo && GROQ_MODELS.includes(modeloSalvo)
    ? modeloSalvo
    : MODELO_PADRAO_GROQ;
  return { apiKey, modelo };
}

async function obterConfigGemini(): Promise<{ apiKey: string | null; modelo: string }> {
  const apiKey = await configuracaoService.obter('api_key_gemini');
  const modeloSalvo = await configuracaoService.obter('modelo_gemini_padrao');
  const modelo = modeloSalvo && GEMINI_MODELS.includes(modeloSalvo)
    ? modeloSalvo
    : MODELO_PADRAO_GEMINI;
  return { apiKey, modelo };
}

async function chamarGroq(
  messages: Array<{ role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }>,
  modelo?: string
): Promise<string> {
  const { apiKey, modelo: modeloPadrao } = await obterConfigGroq();

  if (!apiKey) {
    throw new Error('Chave de API Groq não configurada. Configure em Configurações → Modelos IA.');
  }

  const modeloFinal = modelo && GROQ_MODELS.includes(modelo) ? modelo : modeloPadrao;

  const resposta = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modeloFinal,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!resposta.ok) {
    const erroTexto = await resposta.text();
    throw new Error(`Erro da API Groq (${resposta.status}): ${erroTexto}`);
  }

  const json = (await resposta.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content || '';
}

async function chamarGemini(
  messages: Array<{ role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }>,
  modelo?: string
): Promise<string> {
  const { apiKey, modelo: modeloPadrao } = await obterConfigGemini();

  if (!apiKey) {
    throw new Error('Chave de API Gemini não configurada. Configure em Configurações → Modelos IA.');
  }

  const modeloFinal = modelo && GEMINI_MODELS.includes(modelo) ? modelo : modeloPadrao;

  const resposta = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modeloFinal,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!resposta.ok) {
    const erroTexto = await resposta.text();
    throw new Error(`Erro da API Gemini (${resposta.status}): ${erroTexto}`);
  }

  const json = (await resposta.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content || '';
}

async function chamarIA(
  messages: Array<{ role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }>,
  modelo?: string
): Promise<string> {
  const provedor = (await configuracaoService.obter('provedor_ia')) || 'groq';
  if (provedor === 'gemini') {
    return chamarGemini(messages, modelo);
  }
  return chamarGroq(messages, modelo);
}

/** Extrai texto puro do HTML, ignorando spans de placeholder (usando regex — DOMParser não disponível no Node.js do processo main) */
function extrairTextoDoHtml(html: string): string {
  // 1. Remover spans de placeholder
  let texto = html.replace(/<span[^>]*data-placeholder[^>]*>[\s\S]*?<\/span>/gi, ' ');
  // 2. Remover todas as tags HTML
  texto = texto.replace(/<[^>]*>/g, ' ');
  // 3. Normalizar espaços
  texto = texto.replace(/\s+/g, ' ').trim();
  return texto || '';
}

/**
 * Registra handlers IPC para integração com IA (Groq / Gemini)
 */
interface IaHandlerOptions {
  preloadPath: string;
  rendererHtmlPath: string;
  isDev: boolean;
}

let janelaPainelIa: BrowserWindow | null = null;
let sessaoPainelIa: { id: string; proprietarioId: number } | null = null;

export const registerIAHandlers = (opcoes: IaHandlerOptions): void => {
  const fecharJanelaPainelIa = (notificarProprietario: boolean) => {
    const sessao = sessaoPainelIa;
    if (janelaPainelIa && !janelaPainelIa.isDestroyed()) janelaPainelIa.close();
    janelaPainelIa = null;
    sessaoPainelIa = null;
    if (notificarProprietario && sessao) {
      const proprietario = BrowserWindow.fromId(sessao.proprietarioId);
      if (proprietario && !proprietario.isDestroyed()) proprietario.webContents.send('ia:painel-fechado', sessao.id);
    }
  };

  ipcMain.on('ia:painel-abrir', (event, sessionId: unknown) => {
    if (typeof sessionId !== 'string' || !sessionId.trim()) return;
    const proprietario = BrowserWindow.fromWebContents(event.sender);
    if (!proprietario) return;
    if (janelaPainelIa && !janelaPainelIa.isDestroyed()) {
      if (sessaoPainelIa?.proprietarioId === proprietario.id && sessaoPainelIa.id === sessionId) janelaPainelIa.focus();
      return;
    }
    sessaoPainelIa = { id: sessionId, proprietarioId: proprietario.id };
    janelaPainelIa = new BrowserWindow({
      width: 460,
      height: 720,
      minWidth: 360,
      minHeight: 480,
      title: 'Assistente IA',
      show: false,
      webPreferences: { preload: opcoes.preloadPath, nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    const destino = opcoes.isDev
      ? `http://localhost:3000#/painel-ia?sessionId=${encodeURIComponent(sessionId)}`
      : `file://${opcoes.rendererHtmlPath}#/painel-ia?sessionId=${encodeURIComponent(sessionId)}`;
    janelaPainelIa.loadURL(destino);
    janelaPainelIa.once('ready-to-show', () => janelaPainelIa?.show());
    janelaPainelIa.on('closed', () => fecharJanelaPainelIa(true));
    proprietario.once('closed', () => fecharJanelaPainelIa(false));
  });

  ipcMain.on('ia:painel-pronto', event => {
    if (!janelaPainelIa || event.sender.id !== janelaPainelIa.webContents.id || !sessaoPainelIa) return;
    const proprietario = BrowserWindow.fromId(sessaoPainelIa.proprietarioId);
    if (proprietario && !proprietario.isDestroyed()) proprietario.webContents.send('ia:painel-pronto', sessaoPainelIa.id);
  });

  ipcMain.on('ia:painel-publicar', (event, sessionId: unknown, estado: unknown) => {
    const proprietario = BrowserWindow.fromWebContents(event.sender);
    if (!sessaoPainelIa || !janelaPainelIa || proprietario?.id !== sessaoPainelIa.proprietarioId || sessionId !== sessaoPainelIa.id) return;
    janelaPainelIa.webContents.send('ia:painel-estado', estado);
  });

  ipcMain.on('ia:painel-comando', (event, comando: unknown) => {
    if (!sessaoPainelIa || !janelaPainelIa || event.sender.id !== janelaPainelIa.webContents.id || !comandoPainelIaValido(comando)) return;
    const proprietario = BrowserWindow.fromId(sessaoPainelIa.proprietarioId);
    if (proprietario && !proprietario.isDestroyed()) proprietario.webContents.send('ia:painel-comando', comando);
  });

  ipcMain.on('ia:painel-reencaixar', event => {
    if (!sessaoPainelIa || !janelaPainelIa || event.sender.id !== janelaPainelIa.webContents.id) return;
    const proprietario = BrowserWindow.fromId(sessaoPainelIa.proprietarioId);
    if (proprietario && !proprietario.isDestroyed()) proprietario.webContents.send('ia:painel-reencaixar', sessaoPainelIa.id);
    fecharJanelaPainelIa(false);
  });

  ipcMain.on('ia:painel-fechar', event => {
    const proprietario = BrowserWindow.fromWebContents(event.sender);
    if (!sessaoPainelIa || proprietario?.id !== sessaoPainelIa.proprietarioId) return;
    fecharJanelaPainelIa(false);
  });

  ipcMain.handle('ia:copiar-resposta', (event, texto: unknown) => {
    if (typeof texto !== 'string' || !texto.trim() || texto.length > 100_000 || !BrowserWindow.fromWebContents(event.sender)) {
      return { success: false, error: 'Texto inválido para cópia.' };
    }
    clipboard.writeText(texto);
    return { success: true };
  });

  ipcMain.handle('ia:obter-contexto', async () => {
    try {
      return { success: true, data: await iaExecucaoService.obterContexto() };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao obter contexto da IA' };
    }
  });

  ipcMain.handle('ia:obter-perfil', async () => {
    try {
      return { success: true, data: await iaExecucaoService.obterPerfil() };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao obter preferências da IA' };
    }
  });

  ipcMain.handle('ia:salvar-perfil', async (_event, perfil: unknown) => {
    try {
      await iaExecucaoService.salvarPerfil(perfil as PerfilRespostaIa);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao salvar preferências da IA' };
    }
  });

  ipcMain.handle('ia:executar', async (_event, solicitacao: unknown) => {
    try {
      if (!solicitacao || typeof solicitacao !== 'object') return { success: false, error: 'ENTRADA_INVALIDA' };
      return { success: true, data: await iaExecucaoService.executar(solicitacao as SolicitacaoIa) };
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : 'ERRO_INTERNO';
      logError('Erro ao executar IA', { codigo: mensagem.split(':')[0] });
      return { success: false, error: mensagem };
    }
  });

  ipcMain.handle('ia:descrever-imagem', async (_event, solicitacao: unknown) => {
    try {
      if (!solicitacaoDescricaoImagemValida(solicitacao)) return { success: false, error: 'ENTRADA_INVALIDA' };
      return { success: true, data: await iaExecucaoService.descreverImagem(solicitacao) };
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : 'ERRO_INTERNO';
      logError('Erro ao descrever imagem com IA', { codigo: mensagem.split(':')[0] });
      return { success: false, error: mensagem };
    }
  });

  ipcMain.handle('ia:cancelar', async (_event, operationId: unknown) => {
    if (typeof operationId !== 'string' || !operationId) return { success: false, error: 'ENTRADA_INVALIDA' };
    iaExecucaoService.cancelar(operationId);
    return { success: true };
  });

  ipcMain.handle('ia:testar-conexao', async () => {
    const contexto = await iaExecucaoService.obterContexto();
    return contexto.configurado ? { success: true, data: contexto } : { success: false, error: 'CONFIGURACAO_AUSENTE' };
  });
  /**
   * Revisar ortografia de um texto HTML
   */
  ipcMain.handle('ia:revisarOrtografia', async (_event, textoHtml: string) => {
    try {
      if (!textoHtml || typeof textoHtml !== 'string') {
        return { success: false, error: 'Texto inválido' };
      }

      const texto = extrairTextoDoHtml(textoHtml);
      if (!texto) {
        return { success: false, error: 'Texto vazio após extrair do HTML' };
      }

      logDebug('IA: Revisando ortografia', { textoLength: texto.length });

      const prompt = `Você é um revisor de textos jurídico-periciais. Revisa APENAS a ortografia, gramática e pontuação do texto abaixo. NÃO altere o conteúdo técnico, nomes próprios, números de documentos, placeholders {{...}} nem a estrutura do texto. Retorne APENAS o texto revisado, sem comentários adicionais, sem explicações.

Texto:
${texto}`;

      const resposta = await chamarIA([
        { role: 'system', content: 'Você é um assistente de revisão textual para peritos criminais. Responda apenas com o texto revisado.' },
        { role: 'user', content: prompt },
      ]);

      return { success: true, data: resposta };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Erro ao revisar ortografia';
      logError('Erro ao revisar ortografia', { error: errMsg });
      return { success: false, error: errMsg };
    }
  });

  /**
   * Adequar escrita para tom pericial formal
   */
  ipcMain.handle('ia:adequarEscrita', async (_event, textoHtml: string) => {
    try {
      if (!textoHtml || typeof textoHtml !== 'string') {
        return { success: false, error: 'Texto inválido' };
      }

      const texto = extrairTextoDoHtml(textoHtml);
      if (!texto) {
        return { success: false, error: 'Texto vazio após extrair do HTML' };
      }

      logDebug('IA: Adequando escrita', { textoLength: texto.length });

      const prompt = `Você é um perito criminal forense com 20 anos de experiência. Reescreva o texto abaixo em linguagem técnica, formal e objetiva, adequada a um laudo pericial oficial da Polícia Científica. Mantenha todos os placeholders {{...}} intactos. Retorne APENAS o texto reescrito, sem comentários.

Texto original:
${texto}`;

      const resposta = await chamarIA([
        { role: 'system', content: 'Você é um perito criminal forense experiente. Reescreva textos em linguagem técnica pericial formal. Responda apenas com o texto reescrito.' },
        { role: 'user', content: prompt },
      ]);

      return { success: true, data: resposta };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Erro ao adequar escrita';
      logError('Erro ao adequar escrita', { error: errMsg });
      return { success: false, error: errMsg };
    }
  });

  /**
   * Perguntar livremente com contexto da seção
   */
  ipcMain.handle('ia:perguntar', async (_event, pergunta: string, contexto?: string) => {
    try {
      if (!pergunta || typeof pergunta !== 'string') {
        return { success: false, error: 'Pergunta inválida' };
      }

      logDebug('IA: Pergunta livre', { perguntaLength: pergunta.length });

      const messages: Array<{ role: string; content: string }> = [
        {
          role: 'system',
          content: `Você é um assistente especializado em perícia criminal da Polícia Científica do Paraná.
Você auxilia peritos na redação de laudos periciais, oferecendo sugestões técnicas, revisões e informações jurídico-periciais.
Responda de forma clara, objetiva e profissional. Quando apropriado, sugira estruturas e terminologia técnica pericial.
${contexto ? `\nContexto da seção atual do laudo:\n${contexto}` : ''}`,
        },
        { role: 'user', content: pergunta },
      ];

      const resposta = await chamarIA(messages);
      return { success: true, data: resposta };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Erro ao processar pergunta';
      logError('Erro ao perguntar IA', { error: errMsg });
      return { success: false, error: errMsg };
    }
  });
};
