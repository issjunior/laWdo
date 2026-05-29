import { executeQuery, executeNonQuery } from '../database/sqlite.js';
import { getLogger } from '../utils/logger.js'
const log = getLogger('configuracao');

export interface ConfiguracaoRow {
  chave: string
  valor: string | null
  tipo: string
  descricao: string | null
  created_at: string
  updated_at: string
}

class ConfiguracaoService {
  /**
   * Obter valor de uma configuração pela chave
   */
  async obter(chave: string): Promise<string | null> {
    try {
      const rows = await executeQuery<ConfiguracaoRow>(
        'SELECT * FROM configuracoes WHERE chave = ?',
        [chave]
      );
      return rows.length > 0 ? rows[0].valor : null;
    } catch (error) {
      log.error('Erro ao obter configuração', { chave, error });
      throw error;
    }
  }

  /**
   * Salvar/atualizar uma configuração
   */
  async salvar(chave: string, valor: string, tipo: string = 'html', descricao: string = ''): Promise<void> {
    try {
      const existing = await executeQuery<ConfiguracaoRow>(
        'SELECT chave FROM configuracoes WHERE chave = ?',
        [chave]
      );

      if (existing.length > 0) {
        await executeNonQuery(
          'UPDATE configuracoes SET valor = ?, tipo = ?, descricao = ?, updated_at = CURRENT_TIMESTAMP WHERE chave = ?',
          [valor, tipo, descricao, chave]
        );
        log.info('Configuração atualizada', { chave });
      } else {
        await executeNonQuery(
          'INSERT INTO configuracoes (chave, valor, tipo, descricao) VALUES (?, ?, ?, ?)',
          [chave, valor, tipo, descricao]
        );
        log.info('Configuração criada', { chave });
      }
    } catch (error) {
      log.error('Erro ao salvar configuração', { chave, error });
      throw error;
    }
  }
}

export const configuracaoService = new ConfiguracaoService();
export default configuracaoService;
