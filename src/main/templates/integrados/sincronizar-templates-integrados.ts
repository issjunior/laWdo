import { randomUUID } from 'crypto';
import { executeNonQuery, executeQuery, withTransaction } from '../../database/sqlite.js';
import { getLogger } from '../../utils/logger.js';
import { catalogoTemplatesIntegrados } from './catalogo.js';
import { calcularChecksumTemplateIntegrado } from './serializar-template-integrado.js';
import { validarTemplateIntegrado } from './validar-template-integrado.js';
import type { DefinicaoTemplateIntegrado, ResultadoSincronizacaoTemplateIntegrado } from './tipos.js';

const log = getLogger('template');
let ultimoResultado: ResultadoSincronizacaoTemplateIntegrado[] = [];

export const obterEstadoTemplatesIntegrados = (): ResultadoSincronizacaoTemplateIntegrado[] => [...ultimoResultado];

interface TipoExamePersistido {
  id: string;
  ativo: number | boolean;
}

interface TemplatePersistido {
  id: string;
  nome: string;
  descricao: string | null;
  tipo_exame_id: string | null;
  checksum_integrado: string | null;
}

interface SecaoPersistida {
  id: string;
  nome: string;
  ordem: number;
  parent_id: string | null;
  conteudo: string | null;
  condicao: string | null;
  repetir_para: string | null;
  repetir_titulo: string | null;
}

const criarDefinicaoPersistida = (
  template: TemplatePersistido,
  tipo: DefinicaoTemplateIntegrado['tipoExame'],
  secoes: SecaoPersistida[],
  referencia: DefinicaoTemplateIntegrado,
): DefinicaoTemplateIntegrado | null => {
  if (secoes.length !== referencia.secoes.length) return null;
  const porId = new Map(secoes.map(secao => [secao.id, secao]));
  const porOrdem = [...secoes].sort((a, b) => a.ordem - b.ordem);
  const secoesNormalizadas = referencia.secoes.map((secaoReferencia, indice) => {
    const secao = porOrdem[indice];
    if (!secao || secao.nome !== secaoReferencia.nome || secao.ordem !== secaoReferencia.ordem) return null;
    const pai = secao.parent_id ? porId.get(secao.parent_id) : undefined;
    const chavePai = pai ? referencia.secoes.find(item => item.nome === pai.nome && item.ordem === pai.ordem)?.chave : undefined;
    return {
      chave: secaoReferencia.chave,
      nome: secao.nome,
      ordem: secao.ordem,
      chavePai,
      conteudo: secao.conteudo ?? '',
      condicao: secao.condicao ?? undefined,
      repetirPara: secao.repetir_para ?? undefined,
      repetirTitulo: secao.repetir_titulo ?? undefined,
    };
  });
  if (secoesNormalizadas.some(secao => secao === null)) return null;
  return {
    chave: referencia.chave,
    versao: referencia.versao,
    versaoFormato: 1,
    nome: template.nome,
    descricao: template.descricao ?? undefined,
    tipoExame: tipo,
    secoes: secoesNormalizadas as DefinicaoTemplateIntegrado['secoes'],
  };
};

async function obterOuCriarTipo(template: DefinicaoTemplateIntegrado): Promise<TipoExamePersistido> {
  const existentes = await executeQuery<TipoExamePersistido>('SELECT id, ativo FROM tipos_exame WHERE codigo = ?', [template.tipoExame.codigo]);
  if (existentes[0]) return existentes[0];
  const id = randomUUID();
  await executeNonQuery(
    'INSERT INTO tipos_exame (id, codigo, nome, descricao, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    [id, template.tipoExame.codigo, template.tipoExame.nome, template.tipoExame.descricao ?? null],
  );
  return { id, ativo: 1 };
}

async function inserirTemplateIntegrado(template: DefinicaoTemplateIntegrado, tipo: TipoExamePersistido, checksum: string): Promise<void> {
  const templateId = randomUUID();
  const disponivel = Number(tipo.ativo) === 1 ? 1 : 0;
  await executeNonQuery(
    `INSERT INTO templates (
      id, tipo_exame_id, nome, descricao, origem, chave_integrada, versao_integrada,
      checksum_integrado, disponivel_novos_laudos, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'integrado', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [templateId, tipo.id, template.nome, template.descricao ?? null, template.chave, template.versao, checksum, disponivel],
  );
  await inserirSecoesTemplateIntegrado(template, templateId);
}

async function inserirSecoesTemplateIntegrado(template: DefinicaoTemplateIntegrado, templateId: string): Promise<void> {
  const ids = new Map(template.secoes.map(secao => [secao.chave, randomUUID()]));
  for (const secao of template.secoes) {
    await executeNonQuery(
      `INSERT INTO secoes_template (
        id, template_id, nome, ordem, parent_id, conteudo, condicao, repetir_para,
        repetir_titulo, chave_integrada, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        ids.get(secao.chave), templateId, secao.nome, secao.ordem,
        secao.chavePai ? ids.get(secao.chavePai) : null, secao.conteudo,
        secao.condicao ?? null, secao.repetirPara ?? null, secao.repetirTitulo ?? null, secao.chave,
      ],
    );
  }
}

async function atualizarTemplateIntegrado(template: DefinicaoTemplateIntegrado, tipo: TipoExamePersistido, checksum: string, templateId: string): Promise<void> {
  await executeNonQuery(
    `UPDATE templates SET tipo_exame_id = ?, nome = ?, descricao = ?, checksum_integrado = ?,
      disponivel_novos_laudos = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [tipo.id, template.nome, template.descricao ?? null, checksum, Number(tipo.ativo) === 1 ? 1 : 0, templateId],
  );
  await executeNonQuery('DELETE FROM secoes_template WHERE template_id = ?', [templateId]);
  await inserirSecoesTemplateIntegrado(template, templateId);
}

async function adotarLegado(template: DefinicaoTemplateIntegrado, tipo: TipoExamePersistido, checksum: string): Promise<boolean> {
  const candidatos = await executeQuery<TemplatePersistido>(
    `SELECT t.id, t.nome, t.descricao, t.tipo_exame_id, t.checksum_integrado
     FROM templates t JOIN tipos_exame te ON te.id = t.tipo_exame_id
     WHERE te.codigo = ? AND t.origem = 'usuario'`,
    [template.tipoExame.codigo],
  );
  const compativeis: TemplatePersistido[] = [];
  for (const candidato of candidatos) {
    const secoes = await executeQuery<SecaoPersistida>(
      'SELECT id, nome, ordem, parent_id, conteudo, condicao, repetir_para, repetir_titulo FROM secoes_template WHERE template_id = ? ORDER BY ordem',
      [candidato.id],
    );
    const definicao = criarDefinicaoPersistida(candidato, template.tipoExame, secoes, template);
    if (definicao && calcularChecksumTemplateIntegrado(definicao) === checksum) compativeis.push(candidato);
  }
  if (compativeis.length !== 1) return false;

  const legado = compativeis[0];
  await executeNonQuery(
    `UPDATE templates SET origem = 'integrado', chave_integrada = ?, versao_integrada = ?,
      checksum_integrado = ?, disponivel_novos_laudos = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [template.chave, template.versao, checksum, Number(tipo.ativo) === 1 ? 1 : 0, legado.id],
  );
  const secoes = await executeQuery<{ id: string }>('SELECT id FROM secoes_template WHERE template_id = ? ORDER BY ordem', [legado.id]);
  for (const [indice, secao] of secoes.entries()) {
    await executeNonQuery('UPDATE secoes_template SET chave_integrada = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [template.secoes[indice].chave, secao.id]);
  }
  return true;
}

async function sincronizarTemplate(template: DefinicaoTemplateIntegrado, sobrescreverIntegrados: boolean): Promise<ResultadoSincronizacaoTemplateIntegrado> {
  validarTemplateIntegrado(template);
  const checksum = calcularChecksumTemplateIntegrado(template);
  return withTransaction(async () => {
    const tipo = await obterOuCriarTipo(template);
    const atuais = await executeQuery<TemplatePersistido>(
      'SELECT id, nome, descricao, tipo_exame_id, checksum_integrado FROM templates WHERE chave_integrada = ? AND versao_integrada = ?',
      [template.chave, template.versao],
    );
    const disponivel = Number(tipo.ativo) === 1 ? 1 : 0;
    if (atuais[0]) {
      if (atuais[0].checksum_integrado !== checksum) {
        if (!sobrescreverIntegrados) throw new Error(`Checksum divergente na versão integrada ${template.chave} v${template.versao}; a versão anterior foi preservada`);
        await atualizarTemplateIntegrado(template, tipo, checksum, atuais[0].id);
      }
      await executeNonQuery('UPDATE templates SET disponivel_novos_laudos = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [disponivel, atuais[0].id]);
      await executeNonQuery(
        'UPDATE templates SET disponivel_novos_laudos = 0, updated_at = CURRENT_TIMESTAMP WHERE origem = ? AND chave_integrada = ? AND versao_integrada <> ?',
        ['integrado', template.chave, template.versao],
      );
      return { chave: template.chave, versao: template.versao, status: disponivel ? 'ja_atualizado' : 'indisponivel', mensagem: disponivel ? undefined : 'Tipo de exame inativo' };
    }
    const adotado = await adotarLegado(template, tipo, checksum);
    if (!adotado) await inserirTemplateIntegrado(template, tipo, checksum);
    await executeNonQuery(
      'UPDATE templates SET disponivel_novos_laudos = 0, updated_at = CURRENT_TIMESTAMP WHERE origem = ? AND chave_integrada = ? AND versao_integrada <> ?',
      ['integrado', template.chave, template.versao],
    );
    return { chave: template.chave, versao: template.versao, status: adotado ? 'adotado' : (disponivel ? 'instalado' : 'indisponivel'), mensagem: disponivel ? undefined : 'Tipo de exame inativo' };
  });
}

export async function sincronizarTemplatesIntegrados(opcoes: { sobrescreverIntegrados?: boolean } = {}): Promise<ResultadoSincronizacaoTemplateIntegrado[]> {
  const inicio = Date.now();
  const resultados: ResultadoSincronizacaoTemplateIntegrado[] = [];
  const chaves = new Set<string>();
  for (const template of catalogoTemplatesIntegrados) {
    try {
      if (chaves.has(template.chave)) throw new Error(`Chave integrada duplicada: ${template.chave}`);
      chaves.add(template.chave);
      resultados.push(await sincronizarTemplate(template, opcoes.sobrescreverIntegrados === true));
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro inesperado';
      log.error('Falha ao sincronizar template integrado', { chave: template.chave, versao: template.versao, error });
      resultados.push({ chave: template.chave, versao: template.versao, status: 'falha', mensagem });
    }
  }
  log.info('Sincronização de templates integrados concluída', { duracaoMs: Date.now() - inicio, resultados });
  ultimoResultado = resultados;
  return resultados;
}
