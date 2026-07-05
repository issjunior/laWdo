import { BaseService } from './base.service.js';
import { TemplateRow, SecaoTemplateRow } from '../types/database.js';
import { getLogger } from '../utils/logger.js';
import { executeQuery, executeNonQuery } from '../database/sqlite.js';
import { randomUUID } from 'crypto'
const log = getLogger('template');

class TemplateService extends BaseService<TemplateRow> {
  constructor() {
    super('templates', 'id');
  }

  /** Buscar templates por tipo de exame (inclui templates genéricos com tipo_exame_id NULL) */
  async findByTipoExame(tipoExameId: string): Promise<TemplateRow[]> {
    try {
      const sql = `
        SELECT * FROM templates
        WHERE tipo_exame_id = ? OR tipo_exame_id IS NULL
        ORDER BY CASE WHEN tipo_exame_id IS NULL THEN 1 ELSE 0 END, nome ASC
      `;
      return await executeQuery<TemplateRow>(sql, [tipoExameId]);
    } catch (error) {
      log.error('Erro ao buscar templates por tipo de exame', error);
      throw error;
    }
  }

  /** Buscar todos os templates com contagem de seções */
  async findAllComSecoes(): Promise<(TemplateRow & { qtd_secoes: number; tipo_exame_nome?: string; tipo_exame_codigo?: string })[]> {
    try {
      const sql = `
        SELECT t.*, COUNT(st.id) as qtd_secoes, te.nome as tipo_exame_nome, te.codigo as tipo_exame_codigo
        FROM templates t
        LEFT JOIN secoes_template st ON st.template_id = t.id
        LEFT JOIN tipos_exame te ON te.id = t.tipo_exame_id
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `;
      return await executeQuery<TemplateRow & { qtd_secoes: number; tipo_exame_nome?: string; tipo_exame_codigo?: string }>(sql);
    } catch (error) {
      log.error('Erro ao buscar templates com seções', error);
      throw error;
    }
  }

  // ─── Seções ───────────────────────────────────────────

  /** Buscar todas as seções de um template */
  async findSecoesByTemplate(templateId: string): Promise<SecaoTemplateRow[]> {
    try {
      const sql = 'SELECT * FROM secoes_template WHERE template_id = ? ORDER BY ordem ASC';
      return await executeQuery<SecaoTemplateRow>(sql, [templateId]);
    } catch (error) {
      log.error('Erro ao buscar seções do template', error);
      throw error;
    }
  }

  /** Criar seção */
  async createSecao(data: Omit<SecaoTemplateRow, 'id' | 'created_at' | 'updated_at'>): Promise<SecaoTemplateRow> {
    try {
      const id = randomUUID();
      const sql = `
        INSERT INTO secoes_template (id, template_id, nome, ordem, parent_id, conteudo, condicao, repetir_para, repetir_titulo, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      await executeNonQuery(sql, [
        id,
        data.template_id,
        data.nome,
        data.ordem,
        data.parent_id || null,
        data.conteudo || null,
        data.condicao || null,
        data.repetir_para || null,
        data.repetir_titulo || null,
      ]);
      const rows = await executeQuery<SecaoTemplateRow>('SELECT * FROM secoes_template WHERE id = ?', [id]);
      return rows[0];
    } catch (error) {
      log.error('Erro ao criar seção do template', error);
      throw error;
    }
  }

  /** Atualizar seção */
  async updateSecao(id: string, data: Partial<Omit<SecaoTemplateRow, 'id' | 'template_id' | 'created_at' | 'updated_at'>>): Promise<SecaoTemplateRow> {
    try {
      const sets: string[] = [];
      const params: unknown[] = [];

      if (data.nome !== undefined) { sets.push('nome = ?'); params.push(data.nome); }
      if (data.ordem !== undefined) { sets.push('ordem = ?'); params.push(data.ordem); }
      if (data.parent_id !== undefined) { sets.push('parent_id = ?'); params.push(data.parent_id); }
      if (data.conteudo !== undefined) { sets.push('conteudo = ?'); params.push(data.conteudo); }
      if (data.condicao !== undefined) { sets.push('condicao = ?'); params.push(data.condicao); }
      if (data.repetir_para !== undefined) { sets.push('repetir_para = ?'); params.push(data.repetir_para); }
      if (data.repetir_titulo !== undefined) { sets.push('repetir_titulo = ?'); params.push(data.repetir_titulo); }

      if (sets.length === 0) {
        const rows = await executeQuery<SecaoTemplateRow>('SELECT * FROM secoes_template WHERE id = ?', [id]);
        return rows[0];
      }

      sets.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      await executeNonQuery(`UPDATE secoes_template SET ${sets.join(', ')} WHERE id = ?`, params);
      const rows = await executeQuery<SecaoTemplateRow>('SELECT * FROM secoes_template WHERE id = ?', [id]);
      return rows[0];
    } catch (error) {
      log.error('Erro ao atualizar seção do template', error);
      throw error;
    }
  }

  /** Excluir seção */
  async deleteSecao(id: string): Promise<void> {
    try {
      await executeNonQuery('DELETE FROM secoes_template WHERE id = ?', [id]);
    } catch (error) {
      log.error('Erro ao excluir seção do template', error);
      throw error;
    }
  }

  /** Reordenar seções (recebe array de ids na nova ordem) */
  async reordenarSecoes(templateId: string, idsOrdenados: string[]): Promise<void> {
    try {
      for (let i = 0; i < idsOrdenados.length; i++) {
        await executeNonQuery(
          'UPDATE secoes_template SET ordem = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND template_id = ?',
          [i, idsOrdenados[i], templateId]
        );
      }
    } catch (error) {
      log.error('Erro ao reordenar seções do template', error);
      throw error;
    }
  }
}

export const templateService = new TemplateService();
