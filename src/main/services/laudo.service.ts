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

  /** Listar todos os laudos com dados da REP e template */
  async findAllComRep(): Promise<
    Array<
      LaudoRow & {
        rep_numero: string;
        template_nome: string;
        status_rep: string;
        tipo_exame_nome?: string;
        nome_envolvido?: string;
        data_requisicao?: string;
        tipo_solicitacao?: string;
        numero_documento?: string;
      }
    >
  > {
    try {
      const sql = `
        SELECT
          l.*,
          r.numero AS rep_numero,
          r.status AS status_rep,
          r.nome_envolvido,
          r.data_requisicao,
          r.tipo_solicitacao,
          r.numero_documento,
          t.nome AS template_nome,
          te.nome AS tipo_exame_nome
        FROM laudos l
        JOIN reps r ON r.id = l.rep_id
        LEFT JOIN templates t ON t.id = l.template_id
        LEFT JOIN tipos_exame te ON te.id = r.tipo_exame_id
        ORDER BY l.updated_at DESC
      `;
      return await executeQuery<any>(sql);
    } catch (error) {
      logError('Erro ao buscar laudos com REPs', error);
      throw error;
    }
  }

  /** Atualizar conteúdo HTML do laudo */
  async updateConteudo(id: string, conteudo: string): Promise<LaudoRow> {
    try {
      const sql = `
        UPDATE laudos
        SET conteudo = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      await executeNonQuery(sql, [conteudo, id]);
      const rows = await executeQuery<LaudoRow>('SELECT * FROM laudos WHERE id = ?', [id]);
      return rows[0];
    } catch (error) {
      logError('Erro ao atualizar conteúdo do laudo', error);
      throw error;
    }
  }

  /** Deletar laudo vinculado a uma REP (usado antes de excluir a REP). */
  async deletarPorRepId(repId: string): Promise<void> {
    try {
      // Remove imagens órfãs de bancos legados que ainda possuem a tabela imagens_laudo
      const laudo = await executeQuery<LaudoRow>('SELECT id FROM laudos WHERE rep_id = ?', [repId]);
      if (laudo[0]?.id) {
        await executeNonQuery('DELETE FROM imagens_laudo WHERE laudo_id = ?', [laudo[0].id]);
      }
      await executeNonQuery('DELETE FROM laudos WHERE rep_id = ?', [repId]);
    } catch (error) {
      logError('Erro ao deletar laudo por rep_id', { repId, error });
      throw error;
    }
  }

  /** Deletar um laudo pelo ID e retornar o rep_id para resetar o status da REP. */
  async deletar(laudoId: string): Promise<{ rep_id: string }> {
    try {
      const laudo = await this.findById(laudoId);
      if (!laudo) throw new Error('Laudo não encontrado');

      // Remove imagens órfãs de bancos legados que ainda possuem a tabela imagens_laudo
      await executeNonQuery('DELETE FROM imagens_laudo WHERE laudo_id = ?', [laudoId]);

      await this.delete(laudoId);

      logInfo('Laudo excluído', { laudoId, repId: laudo.rep_id });
      return { rep_id: laudo.rep_id };
    } catch (error) {
      logError('Erro ao deletar laudo', { laudoId, error });
      throw error;
    }
  }
}

export const laudoService = new LaudoService();
