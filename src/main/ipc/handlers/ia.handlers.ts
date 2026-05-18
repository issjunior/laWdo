import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { logError, logInfo } from '../../utils/logger.js';
import { configuracaoService } from '../../services/configuracao.service.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const MODELOS_DISPONIVEIS = [
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
];

const MODELO_PADRAO = 'llama-3.3-70b-versatile';
const MODELO_VISION = 'meta-llama/llama-4-scout-17b-16e-instruct';

async function obterConfigIA(): Promise<{ apiKey: string | null; modelo: string }> {
  const apiKey = await configuracaoService.obter('api_key_groq');
  const modeloSalvo = await configuracaoService.obter('modelo_ia_padrao');
  const modelo = modeloSalvo && MODELOS_DISPONIVEIS.includes(modeloSalvo)
    ? modeloSalvo
    : MODELO_PADRAO;
  return { apiKey, modelo };
}

async function chamarGroq(
  messages: Array<{ role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }>,
  modelo?: string
): Promise<string> {
  const { apiKey, modelo: modeloPadrao } = await obterConfigIA();

  if (!apiKey) {
    throw new Error('Chave de API Groq não configurada. Configure em Configurações → Modelos IA.');
  }

  const resposta = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelo || modeloPadrao,
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

function obterMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png': return 'image/png';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.bmp': return 'image/bmp';
    default: return 'image/jpeg';
  }
}

/**
 * Registra handlers IPC para integração com IA (Groq)
 */
export const registerIAHandlers = (): void => {
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

      logInfo('IA: Revisando ortografia', { textoLength: texto.length });

      const prompt = `Você é um revisor de textos jurídico-periciais. Revisa APENAS a ortografia, gramática e pontuação do texto abaixo. NÃO altere o conteúdo técnico, nomes próprios, números de documentos, placeholders {{...}} nem a estrutura do texto. Retorne APENAS o texto revisado, sem comentários adicionais, sem explicações.

Texto:
${texto}`;

      const resposta = await chamarGroq([
        { role: 'system', content: 'Você é um assistente de revisão textual para peritos criminais. Responda apenas com o texto revisado.' },
        { role: 'user', content: prompt },
      ]);

      return { success: true, data: resposta };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Erro ao revisar ortografia';
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

      logInfo('IA: Adequando escrita', { textoLength: texto.length });

      const prompt = `Você é um perito criminal forense com 20 anos de experiência. Reescreva o texto abaixo em linguagem técnica, formal e objetiva, adequada a um laudo pericial oficial da Polícia Científica. Mantenha todos os placeholders {{...}} intactos. Retorne APENAS o texto reescrito, sem comentários.

Texto original:
${texto}`;

      const resposta = await chamarGroq([
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
   * Descrever imagens usando visão
   * Recebe array de objetos { src: string, alt?: string }
   * O renderer deve extrair as imagens do HTML e converter para base64/data-URI
   */
  ipcMain.handle('ia:descreverImagem', async (_event, imagens: Array<{ src: string; alt?: string }>) => {
    try {
      if (!imagens || !Array.isArray(imagens) || imagens.length === 0) {
        return { success: false, error: 'Nenhuma imagem fornecida' };
      }

      logInfo('IA: Descrevendo imagens', { count: imagens.length });

      // Construir mensagem com imagens
      const content: { type: string; text?: string; image_url?: { url: string } }[] = [
        {
          type: 'text',
          text: 'Você é um perito criminal descrevendo evidências fotográficas para um laudo pericial. Descreva a(s) imagem(ns) abaixo de forma técnica, objetiva e detalhada, como seria inserida na seção de exames ou constatações de um laudo oficial. Retorne APENAS a descrição, sem comentários.',
        },
      ];

      // Adicionar cada imagem como image_url
      for (const img of imagens) {
        if (img.src.startsWith('data:')) {
          content.push({
            type: 'image_url',
            image_url: { url: img.src },
          });
        } else if (img.src.startsWith('http://') || img.src.startsWith('https://')) {
          content.push({
            type: 'image_url',
            image_url: { url: img.src },
          });
        } else if (img.src.startsWith('laudo-img://')) {
          try {
            const matches = img.src.match(/^laudo-img:\/\/([^/]+)\/(.+)$/);
            if (matches) {
              const laudoId = matches[1];
              const filename = matches[2];
              const filePath = path.join(app.getPath('userData'), 'imagens', laudoId, filename);
              if (fs.existsSync(filePath)) {
                const ext = path.extname(filePath);
                const mime = obterMimeType(ext);
                const base64 = fs.readFileSync(filePath, { encoding: 'base64' });
                content.push({
                  type: 'image_url',
                  image_url: { url: `data:${mime};base64,${base64}` },
                });
              }
            }
          } catch (err) {
            logError('Erro ao converter laudo-img:// para base64', err);
          }
        }
      }

      if (content.length === 1) {
        return { success: false, error: 'Nenhuma imagem válida para descrição (apenas data-URI, URLs HTTP/HTTPS ou imagens do laudo são suportadas)' };
      }

      const resposta = await chamarGroq(
        [
          { role: 'system', content: 'Você é um perito criminal especialista em descrição de evidências fotográficas. Responda apenas com a descrição técnica.' },
          { role: 'user', content: content },
        ],
        MODELO_VISION
      );

      return { success: true, data: resposta };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Erro ao descrever imagem';
      logError('Erro ao descrever imagem', { error: errMsg });
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

      logInfo('IA: Pergunta livre', { perguntaLength: pergunta.length });

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

      const resposta = await chamarGroq(messages);
      return { success: true, data: resposta };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Erro ao processar pergunta';
      logError('Erro ao perguntar IA', { error: errMsg });
      return { success: false, error: errMsg };
    }
  });
};
