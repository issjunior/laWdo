/**
 * Serviço de importação de documentos (PDF/DOCX) para templates
 * Executa no main process do Electron
 */

import { extractText } from 'unpdf';
import mammoth from 'mammoth';
import sanitizeHtml from 'sanitize-html';
import path from 'path';
import fs from 'fs';
import { getLogger } from '../utils/logger.js'
const log = getLogger('laudo');

interface SecaoImportada {
  nome: string;
  conteudo: string;
  incluir: boolean;
}

export interface ResultadoImportacao {
  nomeArquivo: string;
  secoes: SecaoImportada[];
}

// ─── Constantes ───────────────────────────────────────────

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];
const PALAVRAS_CHAVE_PERICIAIS = new Set([
  'PREÂMBULO', 'HISTÓRICO', 'DO HISTÓRICO', 'INTRODUÇÃO', 'METODOLOGIA',
  'DO EXAME', 'EXAME', 'ANÁLISE', 'CONCLUSÃO', 'RESULTADO', 'CONSIDERAÇÕES',
  'OBJETO', 'OBJETIVO', 'DO OBJETIVO PERICIAL', 'QUESITOS',
  'RESPOSTA AOS QUESITOS', 'ENCERRAMENTO', 'CONSIDERAÇÕES FINAIS',
  'MOTIVO DA PERÍCIA', 'MATERIAL APRESENTADO A EXAME',
  'DO VEÍCULO', 'ISOLAMENTO E PRESERVAÇÃO DO LOCAL',
  'DAS INFORMAÇÕES', 'DO LOCAL', 'DO CADÁVER', 'DOS VESTÍGIOS',
  'DISCUSSÃO', 'DINÂMICA DO EVENTO', 'ILUSTRAÇÕES',
]);

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 's', 'ol', 'ul', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'td', 'th', 'blockquote',
    'span', 'a', 'img',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    span: ['style', 'class'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'data'],
  disallowedTagsMode: 'discard',
};

// ─── Validação de Arquivo ─────────────────────────────────

function validarArquivo(filePath: string): { valido: boolean; erro?: string } {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE_BYTES) {
      return { valido: false, erro: `Arquivo excede o limite de ${MAX_FILE_SIZE_MB} MB` };
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return { valido: false, erro: 'Tipo de arquivo não suportado. Use PDF ou DOCX.' };
    }

    // MIME type não é confiável no Windows; usamos extensão como primary check
    return { valido: true };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro inesperado';
    return { valido: false, erro: `Erro ao acessar arquivo: ${mensagem}` };
  }
}

// ─── Pipeline de Placeholders ─────────────────────────────

/**
 * Detecta placeholders {{...}}, sanitiza o HTML, preserva placeholders
 */
function sanitizarComPlaceholders(html: string): string {
  const placeholderRegex = /\{\{[^}]+\}\}/g;
  const placeholders: string[] = [];
  let counter = 0;

  // Substituir placeholders por tokens seguros antes da sanitização
  const comTokens = html.replace(placeholderRegex, (match) => {
    const token = `«PH${counter++}»`;
    placeholders.push(match);
    return token;
  });

  // Sanitizar
  const sanitizado = sanitizeHtml(comTokens, SANITIZE_OPTIONS);

  // Restaurar placeholders
  let resultado = sanitizado;
  placeholders.forEach((ph, idx) => {
    resultado = resultado.replace(`«PH${idx}»`, ph);
  });

  return resultado;
}

// ─── Detecção de Títulos ──────────────────────────────────

function isTituloCandidato(linha: string): boolean {
  const texto = linha.trim();
  if (!texto || texto.length > 120) return false;

  const maiusculas = texto === texto.toUpperCase() && texto.length > 3 && texto.length < 120;
  const temPalavraChave = Array.from(PALAVRAS_CHAVE_PERICIAIS).some(
    (kw) => texto.toUpperCase().includes(kw)
  );

  return maiusculas || temPalavraChave;
}

// ─── Processamento PDF ────────────────────────────────────

async function processarPDF(filePath: string): Promise<SecaoImportada[]> {
  log.info(`Iniciando extração de PDF: ${filePath}`);

  const result = await extractText(filePath);
  const textoBruto = result.text.join('\n');
  log.info(`Texto extraído do PDF: ${textoBruto.length} caracteres`);

  const linhas = textoBruto.split(/\r?\n/);
  const secoes: { nome: string; linhas: string[] }[] = [];
  let secaoAtual: { nome: string; linhas: string[] } | null = null;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;

    // Concatenar linhas consecutivas em maiúsculas curtas que parecem título quebrado
    let linhaConcatenada = linha;
    while (
      i + 1 < linhas.length &&
      linhas[i + 1].trim() &&
      linhas[i + 1].trim().toUpperCase() === linhas[i + 1].trim() &&
      linhas[i + 1].trim().length < 50 &&
      linhaConcatenada.length < 120
    ) {
      i++;
      linhaConcatenada += ' ' + linhas[i].trim();
    }

    if (isTituloCandidato(linhaConcatenada)) {
      if (secaoAtual && secaoAtual.linhas.length > 0) {
        secoes.push(secaoAtual);
      }
      secaoAtual = { nome: linhaConcatenada, linhas: [] };
    } else if (secaoAtual) {
      secaoAtual.linhas.push(linha);
    } else {
      // Texto antes do primeiro título — criar seção introdutória
      secaoAtual = { nome: 'INTRODUÇÃO', linhas: [linha] };
    }
  }

  if (secaoAtual && secaoAtual.linhas.length > 0) {
    secoes.push(secaoAtual);
  }

  if (secoes.length === 0) {
    // Fallback: documento inteiro como uma seção
    const textoFallback = result.text.join('\n');
    return [{
      nome: 'Documento Completo',
      conteudo: sanitizarComPlaceholders(
        textoFallback.split(/\r?\n/)
          .filter(Boolean)
          .map((l: string) => `<p>${escapeHtml(l)}</p>`)
          .join('')
      ),
      incluir: true,
    }];
  }

  return secoes.map((s) => {
    const htmlParagrafos = s.linhas
      .filter((l) => l.trim())
      .map((l) => `<p>${escapeHtml(l)}</p>`)
      .join('');
    return {
      nome: s.nome,
      conteudo: sanitizarComPlaceholders(htmlParagrafos),
      incluir: true,
    };
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Processamento DOCX ───────────────────────────────────

async function processarDOCX(filePath: string): Promise<SecaoImportada[]> {
  log.info(`Iniciando extração de DOCX: ${filePath}`);

  const result = await mammoth.convertToHtml({ path: filePath });
  const rawText = (await mammoth.extractRawText({ path: filePath })).value;
  log.info(`HTML extraído do DOCX: ${result.value.length} caracteres`);

  const html = result.value;

  // Estratégia 1: extrair headings
  const headingRegex = /<(h[1-3])[^>]*>(.*?)<\/\1>/gi;
  const headings: { tag: string; texto: string; index: number }[] = [];
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({ tag: match[1], texto: stripHtmlTags(match[2]).trim(), index: match.index });
  }

  const secoes: SecaoImportada[] = [];

  if (headings.length > 0) {
    for (let i = 0; i < headings.length; i++) {
      const start = headings[i].index;
      const end = i + 1 < headings.length ? headings[i + 1].index : html.length;
      const conteudoHtml = html.substring(start, end);
      // Remover o próprio heading do conteúdo
      const headingLength = `<${headings[i].tag}`.length + html.substring(start).indexOf(`</${headings[i].tag}>`) + `</${headings[i].tag}>`.length;
      const conteudoSemHeading = conteudoHtml.substring(headingLength);

      secoes.push({
        nome: headings[i].texto,
        conteudo: sanitizarComPlaceholders(conteudoSemHeading),
        incluir: true,
      });
    }
  }

  // Estratégia 2: se headings não capturaram nada ou pouco, usar palavras-chave no texto bruto
  if (secoes.length === 0 || secoes.length < 2) {
    const linhas = rawText.split(/\r?\n/);
    const secoesKeyword: { nome: string; linhas: string[] }[] = [];
    let secaoAtual: { nome: string; linhas: string[] } | null = null;

    for (const linha of linhas) {
      const trimmed = linha.trim();
      if (!trimmed) continue;

      if (isTituloCandidato(trimmed)) {
        if (secaoAtual && secaoAtual.linhas.length > 0) {
          secoesKeyword.push(secaoAtual);
        }
        secaoAtual = { nome: trimmed, linhas: [] };
      } else if (secaoAtual) {
        secaoAtual.linhas.push(trimmed);
      } else {
        secaoAtual = { nome: 'INTRODUÇÃO', linhas: [trimmed] };
      }
    }

    if (secaoAtual && secaoAtual.linhas.length > 0) {
      secoesKeyword.push(secaoAtual);
    }

    if (secoesKeyword.length > 0) {
      return secoesKeyword.map((s) => ({
        nome: s.nome,
        conteudo: sanitizarComPlaceholders(s.linhas.map((l) => `<p>${escapeHtml(l)}</p>`).join('')),
        incluir: true,
      }));
    }
  }

  if (secoes.length === 0) {
    return [{
      nome: 'Documento Completo',
      conteudo: sanitizarComPlaceholders(html),
      incluir: true,
    }];
  }

  return secoes;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

// ─── API Pública ──────────────────────────────────────────

export async function importarDocumento(filePath: string): Promise<ResultadoImportacao> {
  const validacao = validarArquivo(filePath);
  if (!validacao.valido) {
    throw new Error(validacao.erro);
  }

  const ext = path.extname(filePath).toLowerCase();
  const nomeArquivo = path.basename(filePath, ext);

  let secoes: SecaoImportada[];

  if (ext === '.pdf') {
    secoes = await processarPDF(filePath);
  } else if (ext === '.docx') {
    secoes = await processarDOCX(filePath);
  } else {
    throw new Error('Formato não suportado');
  }

  log.info(`Importação concluída: ${nomeArquivo} — ${secoes.length} seções detectadas`);
  return { nomeArquivo, secoes };
}
