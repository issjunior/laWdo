import { ipcMain, BrowserWindow, app } from 'electron';
import { getLogger, type LogModule } from '../utils/logger.js'
const log = getLogger('ipc');
import { sanitizeInput, validateSqlQuery } from '../security/index.js';
import { auditLogin, auditLogout } from '../services/audit-log.service.js';
import { registerUserHandlers, registerVerifyPasswordHandler } from './handlers/user.handlers.js';
import { registerSolicitanteHandlers } from './handlers/solicitante.handlers.js';
import { registerTipoExameHandlers } from './handlers/tipo-exame.handlers.js';
import { registerConfiguracaoHandlers } from './handlers/configuracao.handlers.js';
import { registerRepHandlers } from './handlers/rep.handlers.js';
import { registerPlaceholderHandlers } from './handlers/placeholder.handlers.js';
import { registerCategoriaHandlers } from './handlers/categoria-placeholder.handlers.js';
import { registerTemplateHandlers } from './handlers/template.handlers.js';
import { registerImportacaoHandlers } from './handlers/importacao.handlers.js';
import { registerLaudoHandlers } from './handlers/laudo.handlers.js';
import { registerIAHandlers } from './handlers/ia.handlers.js';
import { registerBackupHandlers } from './handlers/backup.handlers.js';
import { registerLogSystemHandlers } from './handlers/log.handlers.js';
import { registerIlustracoesHandlers } from './handlers/ilustracoes.handlers.js';
import { registerWizardHandlers } from './handlers/wizard.handlers.js';
import { registerPecaHandlers } from './handlers/peca.handlers.js';
import { registerCategoriaPecaHandlers } from './handlers/categoria-peca.handlers.js';
import { registerRegraWizardHandlers } from './handlers/regra-wizard.handlers.js';
import { registerGdlHandlers } from './handlers/gdl.handlers.js';
import { getSchemaVersion } from '../database/index.js';
import { userService } from '../services/user.service.js';

/**
 * Registra todos os handlers IPC para comunicação entre main e renderer processes
 */

// Cache para a janela principal
let mainWindow: BrowserWindow | null = null;

/**
 * Registra todos os handlers IPC
 */
export const registerIpcHandlers = (options: {
  preloadPath: string;
  rendererHtmlPath: string;
  isDev: boolean;
}): void => {
  log.info('Registrando handlers IPC...');

  // Utilitários
  registerUtilityHandlers();

  // Logs
  registerLogHandlers();

  // Sistema
  registerSystemHandlers();

  // Banco de dados (básico por enquanto)
  registerDatabaseHandlers();

  // Autenticação
  registerAuthHandlers();

  // Handlers específicos por entidade
  registerUserHandlers();
  registerVerifyPasswordHandler();
  registerSolicitanteHandlers();
  registerTipoExameHandlers();
  registerConfiguracaoHandlers();
  registerRepHandlers();
  registerPlaceholderHandlers();
  registerCategoriaHandlers();
  registerTemplateHandlers();
  registerImportacaoHandlers();
  registerLaudoHandlers();
  registerIAHandlers();
  registerBackupHandlers();
  registerLogSystemHandlers();
  registerIlustracoesHandlers(options);
  registerWizardHandlers();
  registerPecaHandlers();
  registerCategoriaPecaHandlers();
  registerRegraWizardHandlers();
  registerGdlHandlers();

  log.info('Handlers IPC registrados com sucesso');
};

/**
 * Handlers utilitários
 */
const registerUtilityHandlers = (): void => {
  // Ping - teste de conexão
  ipcMain.handle('ping', async (): Promise<string> => {
    log.debug('Ping recebido');
    return 'pong';
  });

  // Informações do aplicativo
  ipcMain.handle('get-app-info', async () => {
    const os = await import('os');
    const totalMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));

    const dbVersion = await getSchemaVersion();

    return {
      version: '0.1.0',
      name: 'laWdo',
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      platform: process.platform === 'win32' ? 'Windows' : process.platform,
      osVersion: os.version(),
      arch: process.arch === 'x64' ? '64-bit' : process.arch,
      memory: `${totalMemoryGB} GB`,
      dbVersion,
    };
  });
};

/**
 * Handlers de log
 */
const registerLogHandlers = (): void => {
  const defaultLogger = getLogger('sistema');

  ipcMain.on('log-info', (_event, module: string, message: string) => {
    if (typeof message === 'string') {
      const logger = (module && typeof module === 'string') ? getLogger(module as LogModule) : defaultLogger;
      logger.info(`[Renderer] ${sanitizeInput(message)}`);
    }
  });

  ipcMain.on('log-error', (_event, module: string, message: string, error?: any) => {
    if (typeof message === 'string') {
      const logger = (module && typeof module === 'string') ? getLogger(module as LogModule) : defaultLogger;
      logger.error(`[Renderer] ${sanitizeInput(message)}`, error);
    }
  });

  ipcMain.on('log-warning', (_event, module: string, message: string) => {
    if (typeof message === 'string') {
      const logger = (module && typeof module === 'string') ? getLogger(module as LogModule) : defaultLogger;
      logger.warn(`[Renderer] ${sanitizeInput(message)}`);
    }
  });

  ipcMain.on('log-batch', (_event, entries: Array<{ module: string; level: string; message: string; error?: any }>) => {
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      if (typeof entry.message !== 'string') continue;
      const module = (entry.module && typeof entry.module === 'string') ? entry.module as LogModule : 'renderer';
      const logger = getLogger(module);
      const msg = `[Renderer] ${sanitizeInput(entry.message)}`;
      switch (entry.level) {
        case 'error': logger.error(msg, entry.error); break;
        case 'warn': logger.warn(msg); break;
        case 'debug': logger.debug(msg); break;
        default: logger.info(msg);
      }
    }
  });
};

/**
 * Handlers do sistema
 */
const registerSystemHandlers = (): void => {
  // Reiniciar aplicativo
  ipcMain.handle('restart-app', async () => {
    log.info('Reiniciando aplicativo...');
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 1000);
    return { success: true };
  });

  // Abrir DevTools
  ipcMain.on('open-dev-tools', event => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.webContents.openDevTools({ mode: 'detach' });
      log.info('DevTools abertos');
    }
  });

  // Fechar aplicativo
  ipcMain.handle('close-app', async () => {
    log.info('Fechando aplicativo...');
    app.quit();
    return { success: true };
  });
};

/**
 * Handlers de banco de dados (básico)
 */
const registerDatabaseHandlers = (): void => {
  // Executar query (protegida)
  ipcMain.handle('execute-query', async (event, query: string, params: any[] = []) => {
    try {
      // Validação de segurança
      if (!validateSqlQuery(query)) {
        log.error('Query rejeitada por validação de segurança', query);
        return {
          success: false,
          error: 'Query rejeitada por motivos de segurança',
          query: query.substring(0, 100) + '...',
        };
      }

      // Sanitizar parâmetros
      const sanitizedParams = params.map(param => {
        if (typeof param === 'string') {
          return sanitizeInput(param);
        }
        return param;
      });

      log.debug(`Executando query: ${query.substring(0, 50)}...`, {
        params: sanitizedParams,
      });

      // TODO: Implementar conexão real com SQLite
      // Por enquanto, retornar mock
      return {
        success: true,
        data: [],
        message: 'Banco de dados em configuração',
        queryExecuted: query.substring(0, 100) + '...',
      };
    } catch (error) {
      log.error('Erro ao executar query', { query, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });
};

/**
 * Handlers de autenticação
 */
const registerAuthHandlers = (): void => {
  // Login
  ipcMain.handle('login', async (event, username: string, password: string) => {
    try {
      // Validação básica
      if (!username || !password) {
        return {
          success: false,
          error: 'Usuário e senha são obrigatórios',
        };
      }

      // Sanitizar entrada
      const sanitizedUsername = sanitizeInput(username);
      const sanitizedPassword = sanitizeInput(password);

      log.info(`Tentativa de login: ${sanitizedUsername}`);

      const user = await userService.authenticate(sanitizedUsername, sanitizedPassword)
      if (user) {
        log.info(`Login bem-sucedido: ${sanitizedUsername}`);
        auditLogin(user.id, true);
        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.nome,
            nome: user.nome, // kept for compatibility with PerfilPage.tsx checking user.nome
            role: user.cargo || 'perito',
            cargo: user.cargo,
            lotacao: user.lotacao,
            email: user.email,
            foto_url: user.foto_url || null,
          },
        };
      }

      log.warn(`Login falhou: ${sanitizedUsername}`);
      auditLogin('', false);
      return {
        success: false,
        error: 'Usuário ou senha incorretos',
      };
    } catch (error) {
      log.error('Erro no processo de login', error);
      return {
        success: false,
        error: 'Erro interno no servidor',
      };
    }
  });

  // Logout
  ipcMain.handle('logout', async () => {
    log.info('Logout solicitado');
    return { success: true };
  });

  // Verificar sessão
  ipcMain.handle('check-session', async () => {
    // TODO: Implementar verificação real de sessão
    return {
      authenticated: false,
      user: null,
    };
  });
};

/**
 * Configurar referência para a janela principal
 */
export const setMainWindow = (window: BrowserWindow): void => {
  mainWindow = window;
};

/**
 * Enviar mensagem para o renderer process
 */
export const sendToRenderer = (channel: string, data: any): void => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  } else {
    log.error('Janela principal não disponível para enviar mensagem', { channel });
  }
};

// Exportar funções principais
export const ipc = {
  registerIpcHandlers,
  setMainWindow,
  sendToRenderer,
};

