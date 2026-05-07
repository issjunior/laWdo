import { ipcMain, BrowserWindow, app } from 'electron';
import { logInfo, logError, logDebug, logWarning } from '../utils/logger.js';
import { sanitizeInput, validateSqlQuery } from '../security/index.js';
import { registerUserHandlers } from './handlers/user.handlers.js';
import { registerSolicitanteHandlers } from './handlers/solicitante.handlers.js';
import { registerTipoExameHandlers } from './handlers/tipo-exame.handlers.js';
import { registerConfiguracaoHandlers } from './handlers/configuracao.handlers.js';
import { registerRepHandlers } from './handlers/rep.handlers.js';
import { userService } from '../services/user.service.js';

/**
 * Registra todos os handlers IPC para comunicação entre main e renderer processes
 */

// Cache para a janela principal
let mainWindow: BrowserWindow | null = null;

/**
 * Registra todos os handlers IPC
 */
export const registerIpcHandlers = (): void => {
  logInfo('Registrando handlers IPC...');

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
  registerSolicitanteHandlers();
  registerTipoExameHandlers();
  registerConfiguracaoHandlers();
  registerRepHandlers();

  logInfo('Handlers IPC registrados com sucesso');
};

/**
 * Handlers utilitários
 */
const registerUtilityHandlers = (): void => {
  // Ping - teste de conexão
  ipcMain.handle('ping', async (): Promise<string> => {
    logDebug('Ping recebido');
    return 'pong';
  });

  // Informações do aplicativo
  ipcMain.handle('get-app-info', async () => {
    return {
      version: '0.1.0',
      name: 'Laudo Pericial PCP',
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      platform: process.platform,
    };
  });
};

/**
 * Handlers de log
 */
const registerLogHandlers = (): void => {
  // Log de informação
  ipcMain.on('log-info', (event, message: string) => {
    if (typeof message === 'string') {
      logInfo(`[Renderer] ${sanitizeInput(message)}`);
    } else {
      logError('Tentativa de log com mensagem inválida', message);
    }
  });

  // Log de erro
  ipcMain.on('log-error', (event, message: string, error?: any) => {
    if (typeof message === 'string') {
      logError(`[Renderer] ${sanitizeInput(message)}`, error);
    } else {
      logError('Tentativa de log de erro com mensagem inválida', { message, error });
    }
  });

  // Log de warning
  ipcMain.on('log-warning', (event, message: string) => {
    if (typeof message === 'string') {
      logWarning(`[Renderer] ${sanitizeInput(message)}`);
    } else {
      logError('Tentativa de log de warning com mensagem inválida', message);
    }
  });
};

/**
 * Handlers do sistema
 */
const registerSystemHandlers = (): void => {
  // Reiniciar aplicativo
  ipcMain.handle('restart-app', async () => {
    logInfo('Reiniciando aplicativo...');
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
      logInfo('DevTools abertos');
    }
  });

  // Fechar aplicativo
  ipcMain.handle('close-app', async () => {
    logInfo('Fechando aplicativo...');
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
        logError('Query rejeitada por validação de segurança', query);
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

      logDebug(`Executando query: ${query.substring(0, 50)}...`, {
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
      logError('Erro ao executar query', { query, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });

  // Backup do banco de dados
  ipcMain.handle('backup-database', async () => {
    logInfo('Backup do banco de dados solicitado');
    // TODO: Implementar backup real
    return {
      success: true,
      message: 'Backup em desenvolvimento',
      timestamp: new Date().toISOString(),
    };
  });

  // Restaurar banco de dados
  ipcMain.handle('restore-database', async (event, backupData: any) => {
    logInfo('Restauração do banco de dados solicitada');
    // TODO: Implementar restauração real
    return {
      success: true,
      message: 'Restauração em desenvolvimento',
      timestamp: new Date().toISOString(),
    };
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

      logInfo(`Tentativa de login: ${sanitizedUsername}`);

      const user = await userService.authenticate(sanitizedUsername, sanitizedPassword)
      if (user) {
        logInfo(`Login bem-sucedido: ${sanitizedUsername}`);
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
          },
        };
      }

      logWarning(`Login falhou: ${sanitizedUsername}`);
      return {
        success: false,
        error: 'Usuário ou senha incorretos',
      };
    } catch (error) {
      logError('Erro no processo de login', error);
      return {
        success: false,
        error: 'Erro interno no servidor',
      };
    }
  });

  // Logout
  ipcMain.handle('logout', async () => {
    logInfo('Logout solicitado');
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
    logError('Janela principal não disponível para enviar mensagem', { channel });
  }
};

// Exportar funções principais
export const ipc = {
  registerIpcHandlers,
  setMainWindow,
  sendToRenderer,
};

