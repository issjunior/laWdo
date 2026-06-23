import { BaseService } from './base.service.js';
import { getLogger } from '../utils/logger.js';
import { withTransaction, executeNonQuery, executeQuery } from '../database/sqlite.js'
const log = getLogger('placeholder');

export interface CategoriaPlaceholderRow {
  id: string;
  chave: string;
  label: string;
  descricao: string | null;
  cor: string | null;
  icone: string | null;
  parent_id: string | null;
  is_sistema: number;
  ordem: number;
  created_at: string;
  updated_at: string;
}

class CategoriaService extends BaseService<CategoriaPlaceholderRow> {
  constructor() {
    super('categorias_placeholders', 'id');
  }

  /**
   * Atualizar uma categoria com proteção para as de sistema
   */
  async update(id: string, data: Partial<CategoriaPlaceholderRow>): Promise<CategoriaPlaceholderRow | null> {
    const row = await this.findById(id);
    if (!row) return null;

    if (row.is_sistema === 1) {
      // Whitelist: apenas cor e icone podem ser atualizados
      const allowedData: Partial<CategoriaPlaceholderRow> = {};
      if (data.cor !== undefined) allowedData.cor = data.cor;
      if (data.icone !== undefined) allowedData.icone = data.icone;
      return super.update(id, allowedData);
    }

    return super.update(id, data);
  }

  /**
   * Excluir uma categoria (apenas se não for do sistema) e mover placeholders associados
   */
  async delete(id: string): Promise<boolean> {
    const row = await this.findById(id);
    if (!row) return false;

    if (row.is_sistema === 1) {
      throw new Error('Categorias do sistema não podem ser excluídas.');
    }

    try {
      await withTransaction(async () => {
        // 1. Mover subcategorias para raiz
        await executeNonQuery(
          'UPDATE categorias_placeholders SET parent_id = NULL, updated_at = ? WHERE parent_id = ?',
          [new Date().toISOString(), id]
        );

        // 2. Move os placeholders para a categoria "Sem Categoria" ('cat-sem-categoria')
        await executeNonQuery(
          'UPDATE placeholders SET categoria_id = ?, updated_at = ? WHERE categoria_id = ?',
          ['cat-sem-categoria', new Date().toISOString(), id]
        );

        // 3. Exclui a categoria
        await executeNonQuery('DELETE FROM categorias_placeholders WHERE id = ?', [id]);
      });

      log.info(`Categoria ${id} excluída com sucesso e placeholders movidos.`);
      return true;
    } catch (error) {
      log.error('Erro ao excluir categoria (transação falhou)', error);
      throw error;
    }
  }

  async findAllOrdered(): Promise<CategoriaPlaceholderRow[]> {
    const rows = await executeQuery<CategoriaPlaceholderRow>(
      'SELECT * FROM categorias_placeholders ORDER BY is_sistema DESC, ordem ASC, label ASC'
    );
    return rows;
  }

  async findSubcategorias(parentId: string): Promise<CategoriaPlaceholderRow[]> {
    return executeQuery<CategoriaPlaceholderRow>(
      'SELECT * FROM categorias_placeholders WHERE parent_id = ? ORDER BY ordem ASC, label ASC',
      [parentId]
    );
  }

  async findArvore(): Promise<(CategoriaPlaceholderRow & { subcategorias: CategoriaPlaceholderRow[] })[]> {
    const todas = await this.findAllOrdered();
    const build = (parentId: string | null): (CategoriaPlaceholderRow & { subcategorias: CategoriaPlaceholderRow[] })[] =>
      todas
        .filter(c => (parentId === null ? !c.parent_id : c.parent_id === parentId))
        .map(c => ({ ...c, subcategorias: build(c.id) }));
    return build(null);
  }

  async findWithDescendants(categoriaId: string): Promise<CategoriaPlaceholderRow[]> {
    const result: CategoriaPlaceholderRow[] = [];
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
}

export const categoriaService = new CategoriaService();
