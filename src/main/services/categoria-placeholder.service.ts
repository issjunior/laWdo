import { BaseService } from './base.service.js';
import { getLogger } from '../utils/logger.js';
import { withTransaction, executeNonQuery } from '../database/sqlite.js'
const log = getLogger('placeholder');

export interface CategoriaPlaceholderRow {
  id: string;
  chave: string;
  label: string;
  descricao: string | null;
  cor: string | null;
  icone: string | null;
  is_sistema: number;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export type CategoriaPlaceholderCreateData = Omit<CategoriaPlaceholderRow, 'id' | 'created_at' | 'updated_at' | 'is_sistema'> & { is_sistema?: number };

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
        // 1. Move os placeholders para a categoria "Sem Categoria" ('cat-sem-categoria')
        await executeNonQuery(
          'UPDATE placeholders SET categoria_id = ?, updated_at = ? WHERE categoria_id = ?',
          ['cat-sem-categoria', new Date().toISOString(), id]
        );

        // 2. Exclui a categoria
        await executeNonQuery('DELETE FROM categorias_placeholders WHERE id = ?', [id]);
      });

      log.info(`Categoria ${id} excluída com sucesso e placeholders movidos.`);
      return true;
    } catch (error) {
      log.error('Erro ao excluir categoria (transação falhou)', error);
      throw error;
    }
  }
}

export const categoriaService = new CategoriaService();
export default categoriaService;
