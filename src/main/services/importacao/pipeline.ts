import fs from 'fs/promises';
import path from 'path';
import { lerDocx } from './docx.js';
import { lerOdt } from './odt.js';
import { lerPdf } from './pdf.js';
import { transformarDocumento } from './transformacao.js';
import type { ResultadoImportacaoTemplate } from '../../../shared/types/importacao-template.types.js';

export async function executarImportacao(caminho: string): Promise<ResultadoImportacaoTemplate> {
  const estatisticas = await fs.stat(caminho);
  if (!estatisticas.isFile() || estatisticas.size > 20 * 1024 * 1024 || estatisticas.size < 4) throw new Error('Documento inválido ou acima do limite de 20 MB');
  const extensao = path.extname(caminho).toLowerCase();
  if (!['.pdf', '.docx', '.odt'].includes(extensao)) throw new Error('Use um arquivo PDF, DOCX ou ODT');
  const dados = await fs.readFile(caminho);
  if (dados.length > 20 * 1024 * 1024) throw new Error('Documento acima do limite de 20 MB');
  const formato = extensao === '.pdf' ? 'pdf' : extensao === '.docx' ? 'docx' : 'odt';
  const extraido = formato === 'pdf' ? await lerPdf(dados) : formato === 'docx' ? await lerDocx(dados) : lerOdt(dados);
  return transformarDocumento(extraido, path.basename(caminho, extensao), formato);
}
