import { BaseService } from './base.service.js';
import { LaudoRow } from '../types/database.js';
import { logError, logInfo } from '../utils/logger.js';
import { executeQuery, executeNonQuery } from '../database/sqlite.js';
import { randomUUID } from 'crypto';

export class LaudoService extends BaseService<LaudoRow> {
  constructor() {
    super('laudos', 'id');
  }

  /**
   * Cria um laudo automaticamente ao criar uma REP.
   * O laudo "nasce" com status "Em andamento" e conteúdo inicial do template.
   */
  async criarLaudoInicial(params: {
    rep_id: string;
    perito_id: string;
    template_id: string;
  }): Promise<LaudoRow> {
    try {
      // Monta o conteúdo inicial com as seções do template
      const secoesSql = `
        SELECT nome, conteudo
        FROM secoes_template
        WHERE template_id = ?
        ORDER BY ordem ASC
      `;
      const secoes = await executeQuery<{ nome: string; conteudo?: string }>(secoesSql, [params.template_id]);

      const conteudo = secoes
        .map((s, i) => `<h2>${i + 1}. ${s.nome}</h2>${s.conteudo || '<p>&nbsp;</p>'}`)
        .join('\n');

      const id = randomUUID();
      const now = new Date().toISOString();

      const sql = `
        INSERT INTO laudos (id, rep_id, perito_id, template_id, conteudo, status, data_inicio, versao, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'Em andamento', ?, 1, ?, ?)
      `;

      await executeNonQuery(sql, [
        id,
        params.rep_id,
        params.perito_id,
        params.template_id,
        conteudo || '<p>Laudo em elaboração.</p>',
        now,
        now,
        now,
      ]);

      logInfo(`Laudo criado automaticamente para REP ${params.rep_id}`, { laudoId: id, templateId: params.template_id });

      const [laudo] = await executeQuery<LaudoRow>(
        'SELECT * FROM laudos WHERE id = ?',
        [id],
      );
      return laudo;
    } catch (error) {
      logError('Erro ao criar laudo inicial', error);
      throw error;
    }
  }

  /** Buscar laudo por REP */
  async findByRepId(repId: string): Promise<LaudoRow | null> {
    try {
      const rows = await executeQuery<LaudoRow>(
        'SELECT * FROM laudos WHERE rep_id = ?',
        [repId],
      );
      return rows[0] || null;
    } catch (error) {
      logError('Erro ao buscar laudo por REP', error);
      throw error;
    }
  }

  /** Deletar laudo vinculado a uma REP (usado antes de excluir a REP) */
  async deletarPorRepId(repId: string): Promise<void> {
    try {
      await executeNonQuery('DELETE FROM laudos WHERE rep_id = ?', [repId]);
    } catch (error) {
      logError('Erro ao deletar laudo por rep_id', { repId, error });
      // Não lança erro — a REP pode não ter laudo vinculado
    }
  }
}

export const laudoService = new LaudoService();
