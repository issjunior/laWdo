import { createHash } from 'crypto';
import type { DefinicaoTemplateIntegrado } from './tipos.js';

const normalizarHtml = (conteudo: string): string => conteudo
  .replace(/\sdata-image-id="[^"]*"/gi, '')
  .replace(/<table\b[^>]*>[\s\S]*?data-dummy="true"[\s\S]*?<\/table>/gi, '')
  .replace(/<figure\b[^>]*\bdata-dummy="true"[^>]*>[\s\S]*?<\/figure>/gi, '')
  .replace(/\r\n/g, '\n')
  .trim();

export const serializarTemplateIntegrado = (template: DefinicaoTemplateIntegrado): string => JSON.stringify({
  chave: template.chave,
  versao: template.versao,
  versaoFormato: template.versaoFormato,
  nome: template.nome,
  descricao: template.descricao ?? null,
  tipoExame: template.tipoExame,
  secoes: [...template.secoes]
    .sort((a, b) => a.ordem - b.ordem || a.chave.localeCompare(b.chave))
    .map(secao => ({
      chave: secao.chave,
      nome: secao.nome,
      ordem: secao.ordem,
      chavePai: secao.chavePai ?? null,
      conteudo: normalizarHtml(secao.conteudo),
      condicao: secao.condicao ?? null,
      repetirPara: secao.repetirPara ?? null,
      repetirTitulo: secao.repetirTitulo ?? null,
    })),
});

export const calcularChecksumTemplateIntegrado = (template: DefinicaoTemplateIntegrado): string =>
  createHash('sha256').update(serializarTemplateIntegrado(template), 'utf8').digest('hex');
