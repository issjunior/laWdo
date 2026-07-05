import { getLogger } from '../utils/logger.js';
import { executeNonQuery, executeQuery } from '../database/sqlite.js';

const log = getLogger('sistema');

interface CreateAuditInput {
  usuario_id?: string | null;
  acao: string;
  tipo_acao: string;
  modulo: string;
  entidade: string;
  entidade_id?: string | null;
  nivel?: 'info' | 'warning' | 'error' | 'debug';
  mensagem?: string | null;
  dados_anteriores?: string | null;
  dados_novos?: string | null;
  detalhes?: string | null;
}

function insertAuditLog(input: CreateAuditInput): void {
  const sql = `
    INSERT INTO logs_auditoria
      (usuario_id, acao, tipo_acao, modulo, entidade, entidade_id, nivel, mensagem, dados_anteriores, dados_novos, detalhes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    input.usuario_id ?? null,
    input.acao,
    input.tipo_acao,
    input.modulo,
    input.entidade,
    input.entidade_id ?? null,
    input.nivel ?? 'info',
    input.mensagem ?? null,
    input.dados_anteriores ?? null,
    input.dados_novos ?? null,
    input.detalhes ?? null,
  ];

  executeNonQuery(sql, params).catch(err => {
    log.error('Falha ao persistir log de auditoria', err);
  });
}

export function auditLogin(
  usuarioId: string,
  sucesso: boolean,
  ip?: string,
): void {
  insertAuditLog({
    usuario_id: usuarioId,
    acao: sucesso ? 'Login bem-sucedido' : 'Tentativa de login falhou',
    tipo_acao: 'login',
    modulo: 'autenticacao',
    entidade: 'users',
    entidade_id: usuarioId,
    nivel: sucesso ? 'info' : 'warning',
    detalhes: ip ? `IP: ${ip}` : null,
  });
}

export function auditDelete(
  usuarioId: string,
  entidade: string,
  entidadeId: string,
  mensagem?: string,
  detalhes?: string | null,
): void {
  insertAuditLog({
    usuario_id: usuarioId,
    acao: mensagem ?? `Exclusão em ${entidade}`,
    tipo_acao: 'exclusao',
    modulo: entidade as CreateAuditInput['modulo'],
    entidade,
    entidade_id: entidadeId,
    nivel: 'warning',
    detalhes,
  });
}

export function auditExport(
  usuarioId: string,
  tipo: string,
  detalhes?: string,
): void {
  insertAuditLog({
    usuario_id: usuarioId,
    acao: `Exportação: ${tipo}`,
    tipo_acao: 'exportacao',
    modulo: 'exportacao',
    entidade: 'sistema',
    detalhes: detalhes ?? null,
  });
}

export function auditBackup(
  usuarioId: string,
  tipo: 'criar' | 'restaurar',
  destino?: string,
): void {
  insertAuditLog({
    usuario_id: usuarioId,
    acao: tipo === 'criar' ? 'Backup criado' : 'Backup restaurado',
    tipo_acao: tipo === 'criar' ? 'backup' : 'restauracao',
    modulo: 'backup',
    entidade: 'sistema',
    nivel: 'warning',
    detalhes: destino ?? null,
  });
}

export function auditCicloVida(
  usuarioId: string,
  modulo: 'rep' | 'laudo',
  entidadeId: string,
  tipoAcao: 'criacao' | 'atualizacao' | 'exclusao' | 'transicao_status',
  mensagem: string,
  dadosAnteriores?: Record<string, unknown> | null,
  dadosNovos?: Record<string, unknown> | null,
): void {
  insertAuditLog({
    usuario_id: usuarioId,
    acao: mensagem,
    tipo_acao: tipoAcao,
    modulo,
    entidade: modulo === 'rep' ? 'reps' : 'laudos',
    entidade_id: entidadeId,
    nivel: tipoAcao === 'exclusao' ? 'warning' : 'info',
    dados_anteriores: dadosAnteriores ? JSON.stringify(dadosAnteriores) : null,
    dados_novos: dadosNovos ? JSON.stringify(dadosNovos) : null,
  });
}

export function auditLimpezaLogs(usuarioId: string): void {
  insertAuditLog({
    usuario_id: usuarioId,
    acao: 'Limpeza de logs executada',
    tipo_acao: 'limpeza_logs',
    modulo: 'sistema',
    entidade: 'sistema',
    nivel: 'warning',
  });
}

export interface AuditFilters {
  usuario_id?: string;
  modulo?: string;
  tipo_acao?: string;
  nivel?: string;
  entidade?: string;
  entidade_id?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listAuditLogs(
  filters: AuditFilters = {},
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.usuario_id) {
    conditions.push('usuario_id = ?');
    params.push(filters.usuario_id);
  }
  if (filters.modulo) {
    conditions.push('modulo = ?');
    params.push(filters.modulo);
  }
  if (filters.tipo_acao) {
    conditions.push('tipo_acao = ?');
    params.push(filters.tipo_acao);
  }
  if (filters.nivel) {
    conditions.push('nivel = ?');
    params.push(filters.nivel);
  }
  if (filters.entidade) {
    conditions.push('entidade = ?');
    params.push(filters.entidade);
  }
  if (filters.entidade_id) {
    conditions.push('entidade_id = ?');
    params.push(filters.entidade_id);
  }
  if (filters.startDate) {
    conditions.push('created_at >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('created_at <= ?');
    params.push(filters.endDate);
  }
  if (filters.search) {
    conditions.push('(acao LIKE ? OR mensagem LIKE ? OR detalhes LIKE ?)');
    const s = `%${filters.search}%`;
    params.push(s, s, s);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(filters.limit ?? 200, 1000);
  const offset = filters.offset ?? 0;

  const [data, countResult] = await Promise.all([
    executeQuery<Record<string, unknown>>(
      `SELECT * FROM logs_auditoria ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ),
    executeQuery<{ total: number }>(
      `SELECT COUNT(*) as total FROM logs_auditoria ${where}`,
      params,
    ),
  ]);

  return { data, total: countResult[0]?.total ?? 0 };
}

export async function clearAuditLogs(): Promise<{ success: boolean; count: number }> {
  try {
    const before = await executeQuery<{ total: number }>(
      'SELECT COUNT(*) as total FROM logs_auditoria',
    );
    await executeNonQuery('DELETE FROM logs_auditoria');
    return { success: true, count: before[0]?.total ?? 0 };
  } catch (err) {
    log.error('Erro ao limpar logs de auditoria', err instanceof Error ? err : new Error(String(err)));
    return { success: false, count: 0 };
  }
}

export async function getTimelineRep(
  repId: string,
): Promise<{ success: boolean; data?: Record<string, unknown>[]; error?: string }> {
  try {
    const sql = `
      SELECT la.*, 'REP' as origem FROM logs_auditoria la
      WHERE la.modulo IN ('rep', 'reps') AND la.entidade_id = ?
      UNION ALL
      SELECT la.*, 'Laudo' as origem FROM logs_auditoria la
      LEFT JOIN laudos ld ON la.entidade_id = ld.id
      WHERE ld.rep_id = ?
         OR (la.modulo IN ('laudo', 'laudos') AND la.entidade_id = ?)
      ORDER BY created_at ASC
    `;
    const data = await executeQuery<Record<string, unknown>>(sql, [repId, repId, repId]);
    return { success: true, data };
  } catch (err) {
    log.error('Erro ao buscar timeline da REP', err instanceof Error ? err : new Error(String(err)));
    return { success: false, error: String(err) };
  }
}

export async function countAuditLogs(): Promise<number> {
  try {
    const result = await executeQuery<{ total: number }>(
      'SELECT COUNT(*) as total FROM logs_auditoria',
    );
    return result[0]?.total ?? 0;
  } catch {
    return 0;
  }
}
