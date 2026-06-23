import { BaseService } from './base.service.js';
import { CategoriaPecaRow } from '../types/database.js';
import { getLogger } from '../utils/logger.js';
import { withTransaction, executeNonQuery, executeQuery } from '../database/sqlite.js';

const log = getLogger('peca');

class CategoriaPecaService extends BaseService<CategoriaPecaRow> {
  constructor() {
    super('categorias_pecas', 'id');
  }

  async findAllOrdered(): Promise<CategoriaPecaRow[]> {
    const rows = await executeQuery<CategoriaPecaRow>(
      'SELECT * FROM categorias_pecas ORDER BY is_sistema DESC, ordem ASC, label ASC'
    );
    return rows;
  }

  async findSubcategorias(parentId: string): Promise<CategoriaPecaRow[]> {
    return executeQuery<CategoriaPecaRow>(
      'SELECT * FROM categorias_pecas WHERE parent_id = ? ORDER BY ordem ASC, label ASC',
      [parentId]
    );
  }

  async findArvore(): Promise<(CategoriaPecaRow & { subcategorias: CategoriaPecaRow[] })[]> {
    const todas = await this.findAllOrdered();
    const build = (parentId: string | null): (CategoriaPecaRow & { subcategorias: CategoriaPecaRow[] })[] =>
      todas
        .filter(c => (parentId === null ? !c.parent_id : c.parent_id === parentId))
        .map(c => ({ ...c, subcategorias: build(c.id) }));
    return build(null);
  }

  async findWithDescendants(categoriaId: string): Promise<CategoriaPecaRow[]> {
    const result: CategoriaPecaRow[] = [];
    const fila = [categoriaId];
    while (fila.length > 0) {
      const id = fila.shift()!;
      const cat = await this.findById(id);
      if (cat) {
        result.push(cat);
        const subs = await this.findSubcategorias(id);
        fila.push(...subs.map(s => s.id));
      }
    }
    return result;
  }

  async update(id: string, data: Partial<CategoriaPecaRow>): Promise<CategoriaPecaRow | null> {
    const row = await this.findById(id);
    if (!row) return null;

    if (row.is_sistema === 1) {
      const allowedData: Partial<CategoriaPecaRow> = {};
      if (data.cor !== undefined) allowedData.cor = data.cor;
      if (data.icone !== undefined) allowedData.icone = data.icone;
      return super.update(id, allowedData);
    }

    return super.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    const row = await this.findById(id);
    if (!row) return false;

    if (row.is_sistema === 1) {
      throw new Error('Categorias do sistema não podem ser excluídas.');
    }

    try {
      await withTransaction(async () => {
        // 1. Mover peças para "Sem categoria"
        await executeNonQuery(
          'UPDATE pecas SET categoria_id = ?, updated_at = ? WHERE categoria_id = ?',
          ['cat-peca-sem-categoria', new Date().toISOString(), id]
        );

        // 2. Mover subcategorias para raiz (parent_id = NULL)
        await executeNonQuery(
          'UPDATE categorias_pecas SET parent_id = NULL, updated_at = ? WHERE parent_id = ?',
          [new Date().toISOString(), id]
        );

        // 3. Excluir a categoria
        await executeNonQuery('DELETE FROM categorias_pecas WHERE id = ?', [id]);
      });

      log.info(`Categoria de peça ${id} excluída com sucesso.`);
      return true;
    } catch (error) {
      log.error('Erro ao excluir categoria de peça', error);
      throw error;
    }
  }
}

export const categoriaPecaService = new CategoriaPecaService();
