import { executeQuery, executeNonQuery } from '../database/sqlite.js';
import { getLogger } from '../utils/logger.js';
import { safeStorageService } from './safe-storage.service.js';

const log = getLogger('configuracao');

const TIPOS_CRIPTOGRAFADOS = new Set(['senha', 'api_key']);

interface ConfiguracaoRow {
  chave: string
  valor: string | null
  tipo: string
  descricao: string | null
  created_at: string
  updated_at: string
}

class ConfiguracaoService {
  /**
   * Obter valor de uma configuração pela chave.
   * Descriptografa automaticamente se o tipo for 'senha' ou 'api_key'.
   */
  async obter(chave: string): Promise<string | null> {
    try {
      const rows = await executeQuery<ConfiguracaoRow>(
        'SELECT * FROM configuracoes WHERE chave = ?',
        [chave]
      );
      if (rows.length === 0) return null;

      const { valor, tipo } = rows[0];
      if (valor == null) return null;
      if (TIPOS_CRIPTOGRAFADOS.has(tipo)) {
        return safeStorageService.decrypt(valor);
      }
      return valor;
    } catch (error) {
      log.error('Erro ao obter configuração', { chave, error });
      throw error;
    }
  }

  /**
   * Salvar/atualizar uma configuração.
   * Criptografa automaticamente se o tipo for 'senha' ou 'api_key'.
   */
  async salvar(chave: string, valor: string, tipo: string = 'html', descricao: string = ''): Promise<void> {
    try {
      let valorArmazenado = valor;
      if (TIPOS_CRIPTOGRAFADOS.has(tipo)) {
        valorArmazenado = safeStorageService.encrypt(valor);
      }

      const existing = await executeQuery<ConfiguracaoRow>(
        'SELECT chave FROM configuracoes WHERE chave = ?',
        [chave]
      );

      if (existing.length > 0) {
        await executeNonQuery(
          'UPDATE configuracoes SET valor = ?, tipo = ?, descricao = ?, updated_at = CURRENT_TIMESTAMP WHERE chave = ?',
          [valorArmazenado, tipo, descricao, chave]
        );
        log.info('Configuração atualizada', { chave });
      } else {
        await executeNonQuery(
          'INSERT INTO configuracoes (chave, valor, tipo, descricao) VALUES (?, ?, ?, ?)',
          [chave, valorArmazenado, tipo, descricao]
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
