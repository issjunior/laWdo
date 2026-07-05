import { BaseService } from './base.service.js';
import { PecaRow } from '../types/database.js';
import { executeQuery } from '../database/sqlite.js';
import { categoriaPecaService } from './categoria-peca.service.js';

class PecaService extends BaseService<PecaRow> {
  constructor() {
    super('pecas', 'id');
  }

  async search(query: string): Promise<PecaRow[]> {
    const like = `%${query}%`;
    const sql = `
      SELECT * FROM pecas
      WHERE ativo = 1
        AND (nome LIKE ? OR tags LIKE ? OR descricao LIKE ?)
      ORDER BY nome ASC
    `;
    return executeQuery<PecaRow>(sql, [like, like, like]);
  }

  async findByCategoria(categoriaId: string): Promise<PecaRow[]> {
    return executeQuery<PecaRow>(
      'SELECT * FROM pecas WHERE categoria_id = ? AND ativo = 1 ORDER BY nome ASC',
      [categoriaId]
    );
  }

  async findByCategoriaRecursiva(categoriaId: string): Promise<PecaRow[]> {
    const categorias = await categoriaPecaService.findWithDescendants(categoriaId);
    const ids = categorias.map(c => c.id);

    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(', ');
    return executeQuery<PecaRow>(
      `SELECT * FROM pecas WHERE categoria_id IN (${placeholders}) AND ativo = 1 ORDER BY nome ASC`,
      ids
    );
  }

  async findAllComCategoria(): Promise<(PecaRow & { categoria_label?: string; categoria_cor?: string; categoria_icone?: string })[]> {
    const sql = `
      SELECT p.*, cp.label AS categoria_label, cp.cor AS categoria_cor, cp.icone AS categoria_icone
      FROM pecas p
      LEFT JOIN categorias_pecas cp ON p.categoria_id = cp.id
      WHERE p.ativo = 1
      ORDER BY p.nome ASC
    `;
    return executeQuery(sql);
  }
}

export const pecaService = new PecaService();
