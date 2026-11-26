import { notificarContextoGdlAlterado } from './gdl-agendamento-eventos.service.js';
import { CHAVE_CABECALHO_DOCUMENTO, CHAVE_FECHAMENTO_LAUDO, esquemaCabecalhoLaudo, esquemaFechamentoLaudo } from '../../shared/configuracoes/apresentacao-laudo.js';
import { executeQuery, executeNonQuery } from '../database/sqlite.js';
import { getLogger } from '../utils/logger.js';
import { safeStorageService } from './safe-storage.service.js';
import { notificarAvisosGdlAlterados } from './gdl-avisos-eventos.service.js';
import type { AmbienteGdl } from '../../shared/gdl/ambiente.js';

const log = getLogger('configuracao');

const TIPOS_CRIPTOGRAFADOS = new Set(['senha', 'api_key']);

function validarCpf(valor: string): boolean {
  if (!/^\d{11}$/.test(valor) || /^(\d)\1{10}$/.test(valor)) return false;
  for (let posicao = 9; posicao <= 10; posicao += 1) {
    let soma = 0;
    for (let indice = 0; indice < posicao; indice += 1) soma += Number(valor[indice]) * (posicao + 1 - indice);
    const resto = soma % 11;
    if (Number(valor[posicao]) !== (resto < 2 ? 0 : 11 - resto)) return false;
  }
  return true;
}

interface ConfiguracaoRow {
  chave: string
  valor: string | null
  tipo: string
  descricao: string | null
  created_at: string
  updated_at: string
}

class ConfiguracaoService {
  async obterEstadoCredenciaisGdl(ambiente: AmbienteGdl): Promise<{ configuradas: boolean; cpfValido: boolean }> {
    const [login, senha, cpfUsuario] = await Promise.all([
      this.obter(`gdl_login_${ambiente}`),
      this.obter(`gdl_senha_${ambiente}`),
      this.obter(`gdl_cpf_usuario_${ambiente}`),
    ]);
    return { configuradas: Boolean(login && senha), cpfValido: Boolean(cpfUsuario && validarCpf(cpfUsuario)) };
  }

  async salvarCredenciaisGdl(ambiente: AmbienteGdl, credenciais: { login: string; senha: string; cpfUsuario: string }): Promise<void> {
    await Promise.all([
      this.salvar(`gdl_login_${ambiente}`, credenciais.login, 'senha', `Login GDL (${ambiente})`),
      this.salvar(`gdl_senha_${ambiente}`, credenciais.senha, 'senha', `Senha GDL (${ambiente})`),
      this.salvar(`gdl_cpf_usuario_${ambiente}`, credenciais.cpfUsuario, 'senha', `CPF usuário GDL (${ambiente})`),
    ]);
  }

  async excluirCredenciaisGdl(ambiente: AmbienteGdl): Promise<void> {
    await executeNonQuery('DELETE FROM configuracoes WHERE chave IN (?, ?, ?)', [
      `gdl_login_${ambiente}`, `gdl_senha_${ambiente}`, `gdl_cpf_usuario_${ambiente}`,
    ]);
    notificarContextoGdlAlterado(`gdl_login_${ambiente}`);
    notificarAvisosGdlAlterados(true);
  }

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
      if (chave === CHAVE_CABECALHO_DOCUMENTO || chave === CHAVE_FECHAMENTO_LAUDO) {
        const dados: unknown = JSON.parse(valor);
        valor = JSON.stringify(chave === CHAVE_CABECALHO_DOCUMENTO ? esquemaCabecalhoLaudo.parse(dados) : esquemaFechamentoLaudo.parse(dados));
      }
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
      if (chave.startsWith('gdl_')) {
        notificarContextoGdlAlterado(chave);
        notificarAvisosGdlAlterados(true);
      }
    } catch (error) {
      log.error('Erro ao salvar configuração', { chave, error });
      throw error;
    }
  }
}

export const configuracaoService = new ConfiguracaoService();
