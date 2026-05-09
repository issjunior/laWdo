import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { logError, logInfo } from '../utils/logger.js';
import { executeQuery, executeNonQuery } from '../database/sqlite.js';
import { ImagemLaudoRow } from '../types/database.js';
import { BaseService } from './base.service.js';

export class ImagemService extends BaseService<ImagemLaudoRow> {
  constructor() {
    super('imagens_laudo', 'id');
  }

  /** Diretório base onde as imagens são armazenadas */
  private getBaseDir(): string {
    return path.join(app.getPath('userData'), 'imagens');
  }

  /**
   * Salva uma imagem: copia o arquivo para userData/imagens/<laudo_id>/ e insere registro no banco.
   * Retorna o registro com o caminho relativo e URL para acesso via protocolo laudo-img://.
   */
  async salvar(laudoId: string, filePath: string): Promise<ImagemLaudoRow & { url: string }> {
    try {
      const ext = path.extname(filePath);
      const id = randomUUID();
      const filename = `${id}${ext}`;
      const dir = path.join(this.getBaseDir(), laudoId);

      // Garante que o diretório existe
      fs.mkdirSync(dir, { recursive: true });

      const destPath = path.join(dir, filename);
      fs.copyFileSync(filePath, destPath);

      // Determina o próximo número de figura e sequência
      const qtd = await executeQuery<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM imagens_laudo WHERE laudo_id = ?',
        [laudoId]
      );
      const num = (qtd[0]?.cnt ?? 0) + 1;
      const now = new Date().toISOString();

      const sql = `
        INSERT INTO imagens_laudo (id, laudo_id, caminho, legenda, numero_figura, sequencia, data_captura, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const legenda = `Figura ${num}`;
      await executeNonQuery(sql, [id, laudoId, destPath, legenda, num, num, now, now]);

      const url = `laudo-img://${laudoId}/${filename}`;

      logInfo('Imagem salva', { id, laudoId, url });

      const [registro] = await executeQuery<ImagemLaudoRow>(
        'SELECT * FROM imagens_laudo WHERE id = ?',
        [id]
      );

      return { ...registro, url };
    } catch (error) {
      logError('Erro ao salvar imagem', error);
      throw error;
    }
  }

  /** Lista todas as imagens de um laudo, ordenadas por sequência */
  async findByLaudoId(laudoId: string): Promise<(ImagemLaudoRow & { url: string })[]> {
    try {
      const rows = await executeQuery<ImagemLaudoRow>(
        'SELECT * FROM imagens_laudo WHERE laudo_id = ? ORDER BY sequencia ASC',
        [laudoId]
      );
      return rows.map(r => {
        const filename = path.basename(r.caminho);
        return { ...r, url: `laudo-img://${laudoId}/${filename}` };
      });
    } catch (error) {
      logError('Erro ao buscar imagens do laudo', error);
      throw error;
    }
  }

  /** Remove uma imagem (arquivo + registro) */
  async deletar(id: string): Promise<void> {
    try {
      const [registro] = await executeQuery<ImagemLaudoRow>(
        'SELECT * FROM imagens_laudo WHERE id = ?',
        [id]
      );

      if (registro) {
        // Remove arquivo do disco
        try {
          if (fs.existsSync(registro.caminho)) {
            fs.unlinkSync(registro.caminho);
          }
        } catch (fsError) {
          logError('Erro ao remover arquivo de imagem', fsError);
        }

        await executeNonQuery('DELETE FROM imagens_laudo WHERE id = ?', [id]);
        logInfo('Imagem removida', { id, caminho: registro.caminho });
      }
    } catch (error) {
      logError('Erro ao deletar imagem', error);
      throw error;
    }
  }
}

export const imagemService = new ImagemService();
