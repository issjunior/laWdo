import fs from 'fs';
import crypto, { randomUUID } from 'crypto';
import AdmZip from 'adm-zip';
import { executeNonQuery, executeQuery, withTransaction } from '../database/sqlite.js';
import { getLogger } from '../utils/logger.js';
import type { PacoteTemplate, PreviaPacoteTemplate, SecaoPacoteTemplate } from '@shared/types/template-pacote.types.js';
import type { SecaoTemplateRow, TemplateRow, TipoExameRow } from '../types/database.js';

const log = getLogger('template');
const LIMITE_BYTES = 20 * 1024 * 1024;
const ARQUIVOS_ESPERADOS = new Set(['manifest.json', 'template.json']);

type ManifestoPacote = { tipo: 'template'; versao: 1; criado_em: string; checksum: string };

const checksum = (conteudo: Buffer) => crypto.createHash('sha256').update(conteudo).digest('hex');
const objeto = (valor: unknown): valor is Record<string, unknown> => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const texto = (valor: unknown, campo: string, obrigatorio = false): string | null => {
  if (valor == null && !obrigatorio) return null;
  if (typeof valor !== 'string' || (obrigatorio && !valor.trim())) throw new Error(`Pacote inválido: ${campo} é obrigatório`);
  return valor;
};

function validarPacote(valor: unknown): PacoteTemplate {
  if (!objeto(valor) || !objeto(valor.template) || !objeto(valor.tipo_exame) || !Array.isArray(valor.secoes)) {
    throw new Error('Pacote inválido: estrutura do template não reconhecida');
  }
  const nome = texto(valor.template.nome, 'nome do template', true)!;
  const codigo = texto(valor.tipo_exame.codigo, 'código do tipo de exame', true)!;
  const nomeTipo = texto(valor.tipo_exame.nome, 'nome do tipo de exame', true)!;
  const ids = new Set<string>();
  const secoes = valor.secoes.map((secao, indice): SecaoPacoteTemplate => {
    if (!objeto(secao)) throw new Error(`Pacote inválido: seção ${indice + 1}`);
    const id = texto(secao.id_origem, `id da seção ${indice + 1}`, true)!;
    if (ids.has(id)) throw new Error('Pacote inválido: IDs de seções duplicados');
    ids.add(id);
    const ordem = secao.ordem;
    if (typeof ordem !== 'number' || !Number.isInteger(ordem) || ordem < 0) throw new Error(`Pacote inválido: ordem da seção ${indice + 1}`);
    return { id_origem: id, parent_id_origem: texto(secao.parent_id_origem, `pai da seção ${indice + 1}`), nome: texto(secao.nome, `nome da seção ${indice + 1}`, true)!, ordem, conteudo: texto(secao.conteudo, `conteúdo da seção ${indice + 1}`), condicao: texto(secao.condicao, `condição da seção ${indice + 1}`), repetir_para: texto(secao.repetir_para, `repetição da seção ${indice + 1}`), repetir_titulo: texto(secao.repetir_titulo, `título de repetição da seção ${indice + 1}`) };
  });
  if (secoes.some(s => s.parent_id_origem && !ids.has(s.parent_id_origem))) throw new Error('Pacote inválido: seção pai não encontrada');
  return { template: { nome, descricao: texto(valor.template.descricao, 'descrição') }, tipo_exame: { codigo, nome: nomeTipo, descricao: texto(valor.tipo_exame.descricao, 'descrição do tipo') }, secoes };
}

async function lerPacote(caminho: string): Promise<PacoteTemplate> {
  if (!fs.existsSync(caminho)) throw new Error('Arquivo de template não encontrado');
  if (fs.statSync(caminho).size > LIMITE_BYTES) throw new Error('O arquivo de template excede o limite de 20 MB');
  const zip = new AdmZip(caminho);
  const entradas = zip.getEntries();
  if (entradas.some(e => !ARQUIVOS_ESPERADOS.has(e.entryName) || e.entryName.includes('..') || e.isDirectory)) throw new Error('Pacote inválido: contém arquivos não permitidos');
  const manifestoEntry = zip.getEntry('manifest.json');
  const payloadEntry = zip.getEntry('template.json');
  if (!manifestoEntry || !payloadEntry) throw new Error('Pacote inválido: arquivos obrigatórios ausentes');
  let manifesto: unknown;
  let payload: unknown;
  const payloadBytes = payloadEntry.getData();
  try { manifesto = JSON.parse(manifestoEntry.getData().toString('utf-8')); payload = JSON.parse(payloadBytes.toString('utf-8')); } catch { throw new Error('Pacote inválido: JSON malformado'); }
  if (!objeto(manifesto) || manifesto.tipo !== 'template' || manifesto.versao !== 1 || typeof manifesto.checksum !== 'string') throw new Error('Pacote inválido ou versão não compatível');
  if (checksum(payloadBytes) !== manifesto.checksum) throw new Error('Pacote inválido: verificação de integridade falhou');
  return validarPacote(payload);
}

export async function exportarPacoteTemplate(templateId: string, destino: string): Promise<{ success: boolean; error?: string }> {
  try {
    const templates = await executeQuery<TemplateRow>('SELECT * FROM templates WHERE id = ?', [templateId]);
    const template = templates[0];
    if (!template?.tipo_exame_id) throw new Error('Template ou tipo de exame não encontrado');
    const tipos = await executeQuery<TipoExameRow>('SELECT * FROM tipos_exame WHERE id = ?', [template.tipo_exame_id]);
    const tipo = tipos[0];
    if (!tipo) throw new Error('Tipo de exame do template não encontrado');
    const secoes = await executeQuery<SecaoTemplateRow>('SELECT * FROM secoes_template WHERE template_id = ? ORDER BY ordem', [templateId]);
    const pacote: PacoteTemplate = { template: { nome: template.nome, descricao: template.descricao ?? null }, tipo_exame: { codigo: tipo.codigo, nome: tipo.nome, descricao: tipo.descricao ?? null }, secoes: secoes.map(s => ({ id_origem: s.id, parent_id_origem: s.parent_id ?? null, nome: s.nome, ordem: s.ordem, conteudo: s.conteudo ?? null, condicao: s.condicao ?? null, repetir_para: s.repetir_para ?? null, repetir_titulo: s.repetir_titulo ?? null })) };
    const dados = Buffer.from(JSON.stringify(pacote, null, 2), 'utf-8');
    const zip = new AdmZip();
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({ tipo: 'template', versao: 1, criado_em: new Date().toISOString(), checksum: checksum(dados) } satisfies ManifestoPacote, null, 2), 'utf-8'));
    zip.addFile('template.json', dados);
    zip.writeZip(destino);
    return { success: true };
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'Erro ao exportar template';
    log.error('Falha ao exportar pacote de template', error);
    return { success: false, error: motivo };
  }
}

export async function lerPreviaPacoteTemplate(caminho: string): Promise<PreviaPacoteTemplate> {
  const pacote = await lerPacote(caminho);
  const tipos = await executeQuery<{ id: string }>('SELECT id FROM tipos_exame WHERE codigo = ?', [pacote.tipo_exame.codigo]);
  return { ...pacote, caminho, tipoExameExiste: tipos.length > 0 };
}

export async function importarPacoteTemplate(caminho: string, criarTipo: boolean): Promise<{ success: boolean; nome?: string; error?: string }> {
  try {
    const pacote = await lerPacote(caminho);
    let nomeImportado = pacote.template.nome;
    await withTransaction(async () => {
      const tipos = await executeQuery<TipoExameRow>('SELECT * FROM tipos_exame WHERE codigo = ?', [pacote.tipo_exame.codigo]);
      let tipo = tipos[0];
      if (!tipo) {
        if (!criarTipo) throw new Error(`O tipo de exame ${pacote.tipo_exame.codigo} não existe. Cadastre-o ou escolha “Criar tipo de exame e importar”.`);
        const id = randomUUID();
        await executeNonQuery('INSERT INTO tipos_exame (id, codigo, nome, descricao, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [id, pacote.tipo_exame.codigo, pacote.tipo_exame.nome, pacote.tipo_exame.descricao ?? null]);
        tipo = { id, ...pacote.tipo_exame, created_at: '' };
      }
      const base = `${pacote.template.nome} (Importado)`;
      nomeImportado = base;
      let contador = 2;
      while ((await executeQuery<{ id: string }>('SELECT id FROM templates WHERE tipo_exame_id = ? AND nome = ?', [tipo.id, nomeImportado])).length > 0) nomeImportado = `${base} ${contador++}`;
      const templateId = randomUUID();
      await executeNonQuery('INSERT INTO templates (id, tipo_exame_id, nome, descricao, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [templateId, tipo.id, nomeImportado, pacote.template.descricao ?? null]);
      const ids = new Map(pacote.secoes.map(secao => [secao.id_origem, randomUUID()]));
      for (const secao of pacote.secoes) {
        await executeNonQuery('INSERT INTO secoes_template (id, template_id, nome, ordem, parent_id, conteudo, condicao, repetir_para, repetir_titulo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [ids.get(secao.id_origem), templateId, secao.nome, secao.ordem, secao.parent_id_origem ? ids.get(secao.parent_id_origem) : null, secao.conteudo ?? null, secao.condicao ?? null, secao.repetir_para ?? null, secao.repetir_titulo ?? null]);
      }
    });
    return { success: true, nome: nomeImportado };
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'Erro ao importar template';
    log.error('Falha ao importar pacote de template; alterações revertidas', error);
    return { success: false, error: `${motivo}. Nenhuma alteração foi aplicada.` };
  }
}
