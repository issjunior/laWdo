import { executeNonQuery, executeQuery, withTransaction } from './sqlite.js';

export async function migrarEstruturaIncorporadaLaudo(): Promise<void> {
  const colunas = await executeQuery<{ name: string; notnull: number }>('PRAGMA table_info(laudos)');
  if (!colunas.some(coluna => coluna.name === 'estrutura_incorporada_json')) {
    await executeNonQuery('ALTER TABLE laudos ADD COLUMN estrutura_incorporada_json TEXT');
  }
  if (!colunas.some(coluna => coluna.name === 'template_id' && coluna.notnull === 1)) return;
  const [tabela] = await executeQuery<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'laudos'");
  if (!tabela) throw new Error('Tabela de laudos ausente na migração.');
  const definicao = tabela.sql
    .replace(/^CREATE TABLE\s+(?:"laudos"|\[laudos\]|`laudos`|laudos)/i, 'CREATE TABLE laudos_v49')
    .replace(/\btemplate_id\s+TEXT\s+NOT\s+NULL/i, 'template_id TEXT')
    .replace(/\)\s*;?\s*$/, ', CHECK (template_id IS NOT NULL OR estrutura_incorporada_json IS NOT NULL))');
  if (!definicao.startsWith('CREATE TABLE laudos_v49') || /template_id\s+TEXT\s+NOT\s+NULL/i.test(definicao)) {
    throw new Error('Definição da tabela de laudos incompatível com a migração.');
  }
  const estruturas = await executeQuery<{ sql: string }>("SELECT sql FROM sqlite_master WHERE tbl_name = 'laudos' AND type IN ('index', 'trigger') AND sql IS NOT NULL");
  await executeNonQuery('PRAGMA foreign_keys = OFF');
  try {
    await withTransaction(async () => {
      await executeNonQuery(definicao);
      await executeNonQuery('INSERT INTO laudos_v49 SELECT * FROM laudos');
      await executeNonQuery('DROP TABLE laudos');
      await executeNonQuery('ALTER TABLE laudos_v49 RENAME TO laudos');
      for (const estrutura of estruturas) await executeNonQuery(estrutura.sql);
      const violacoes = await executeQuery<unknown>('PRAGMA foreign_key_check');
      if (violacoes.length) throw new Error('Referências inválidas após migração da estrutura do laudo.');
    });
  } finally {
    await executeNonQuery('PRAGMA foreign_keys = ON');
  }
}

export async function garantirLaudoUnicoPorRep(): Promise<void> {
  const colunas = await executeQuery<{ name: string }>('PRAGMA table_info(laudos)');
  if (!colunas.some(coluna => coluna.name === 'rep_id')) throw new Error('SCHEMA_INCOMPATIVEL: coluna laudos.rep_id ausente.');
  const duplicidades = await executeQuery<{ rep_id: string; quantidade: number }>(
    'SELECT rep_id, COUNT(*) AS quantidade FROM laudos GROUP BY rep_id HAVING COUNT(*) > 1 LIMIT 1',
  );
  if (duplicidades.length) throw new Error('SCHEMA_INCOMPATIVEL: existe uma REP com mais de um laudo. Os registros foram preservados; resolva a duplicidade antes de continuar.');
  await executeNonQuery('CREATE UNIQUE INDEX IF NOT EXISTS idx_laudos_rep_unico ON laudos(rep_id)');
}
