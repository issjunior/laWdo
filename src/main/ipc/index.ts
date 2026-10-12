import { ipcMain, BrowserWindow, app } from 'electron';
import { getLogger, type LogModule } from '../utils/logger.js'
const log = getLogger('ipc');
import { sanitizeInput } from '../security/index.js';
import { validarCredenciaisLogin } from '../security/autenticacao.js';
import { auditLogin } from '../services/audit-log.service.js';
import { registerUserHandlers, registerVerifyPasswordHandler } from './handlers/user.handlers.js';
import { registerSolicitanteHandlers } from './handlers/solicitante.handlers.js';
import { registerTipoExameHandlers } from './handlers/tipo-exame.handlers.js';
import { registerConfiguracaoHandlers } from './handlers/configuracao.handlers.js';
import { registerRepHandlers } from './handlers/rep.handlers.js';
import { registerPlaceholderHandlers } from './handlers/placeholder.handlers.js';
import { registerCategoriaHandlers } from './handlers/categoria-placeholder.handlers.js';
import { registerTemplateHandlers } from './handlers/template.handlers.js';
import { registerImportacaoHandlers } from './handlers/importacao.handlers.js';
import { authSessaoService } from '../services/auth-sessao.service.js';
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
import { registerDashboardHandlers } from './handlers/dashboard.handlers.js';
import { registerAtualizacaoHandlers } from './handlers/atualizacao.handlers.js';
import { registerDesempenhoHandlers } from './handlers/desempenho.handlers.js';
import { registerCapturaLogsHandlers } from './handlers/captura-logs.handlers.js';
import { registerProjetilHandlers } from './handlers/projetil.handlers.js';
import { getSchemaVersion } from '../database/index.js';
import { userService } from '../services/user.service.js';
import {
  atualizarContextoRendererDiagnostico,
  registrarErroFatalRendererDiagnostico,
} from '../services/diagnostico-state.service.js';

type LogRendererEntry = {
  module: string;
  level: string;
  message: string;
  error?: unknown;
};

/**
 * Registra todos os handlers IPC para comunicação entre main e renderer processes
 */

/**
 * Registra todos os handlers IPC
 */
export const registerIpcHandlers = (options: {
  preloadPath: string;
  rendererHtmlPath: string;
  isDev: boolean;
}): void => {
  log.debug('Registrando handlers IPC...');

  // Utilitários
  registerUtilityHandlers();

  // Logs
  registerLogHandlers();

  // Diagnóstico interno
  registerDiagnosticoInternoHandlers();

  // Sistema
  registerSystemHandlers();

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
  registerIAHandlers(options);
  registerBackupHandlers();
  registerLogSystemHandlers();
  registerDesempenhoHandlers();
  registerCapturaLogsHandlers();
  registerIlustracoesHandlers(options);
  registerWizardHandlers();
  registerPecaHandlers();
  registerCategoriaPecaHandlers();
  registerRegraWizardHandlers();
  registerGdlHandlers();
  registerDashboardHandlers();
  registerAtualizacaoHandlers();
  registerProjetilHandlers();

  log.debug('Handlers IPC registrados com sucesso');
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
      version: app.getVersion(),
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

  ipcMain.on('log-error', (_event, module: string, message: string, error?: unknown) => {
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

  ipcMain.on('log-batch', (_event, entries: LogRendererEntry[]) => {
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

const registerDiagnosticoInternoHandlers = (): void => {
  ipcMain.on('diagnostico:atualizar-contexto-renderer', (_event, contexto: Record<string, unknown>) => {
    atualizarContextoRendererDiagnostico(contexto);
  });

  ipcMain.on('diagnostico:erro-fatal-renderer', (_event, erro: Record<string, unknown>) => {
    const snapshotPath = registrarErroFatalRendererDiagnostico({
      message: typeof erro.message === 'string' ? erro.message : 'Erro fatal no renderer',
      stack: typeof erro.stack === 'string' ? erro.stack : undefined,
      source: typeof erro.source === 'string' ? erro.source : undefined,
      lineno: typeof erro.lineno === 'number' ? erro.lineno : undefined,
      colno: typeof erro.colno === 'number' ? erro.colno : undefined,
      tipo: erro.tipo === 'unhandledrejection' ? 'unhandledrejection' : 'error',
    });

    getLogger('renderer').error('Erro fatal reportado pelo renderer', {
      erro: sanitizeInput(JSON.stringify(erro)),
      snapshotPath,
    });
  });
};

/**
 * Handlers do sistema
 */
const registerSystemHandlers = (): void => {
  ipcMain.handle('janela:atualizar-barra-titulo', (event, cores: unknown) => {
    if (process.platform !== 'win32' && process.platform !== 'linux') return;
    if (!cores || typeof cores !== 'object') return;
    const { cor, corSimbolo } = cores as Record<string, unknown>;
    const corHslValida = (valor: unknown): valor is string => typeof valor === 'string'
      && /^hsl\(\d{1,3}\s+\d{1,3}%\s+\d{1,3}%\)$/.test(valor);
    if (!corHslValida(cor) || !corHslValida(corSimbolo)) return;

    BrowserWindow.fromWebContents(event.sender)?.setTitleBarOverlay({
      color: cor,
      symbolColor: corSimbolo,
      height: 44,
    });
  });

  // Reiniciar aplicativo
  ipcMain.handle('restart-app', async () => {
    log.debug('Reiniciando aplicativo...');
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
      log.debug('DevTools abertos');
    }
  });

  // Fechar aplicativo
  ipcMain.handle('close-app', async () => {
    log.debug('Fechando aplicativo...');
    setImmediate(() => app.quit());
    return { success: true };
  });
};

/**
 * Handlers de autenticação
 */
const registerAuthHandlers = (): void => {
  // Login
  ipcMain.handle('login', async (event, username: string, password: string) => {
    try {
      const credenciais = validarCredenciaisLogin(username, password);
      const sanitizedUsername = sanitizeInput(credenciais.username);

      log.info(`Tentativa de login: ${sanitizedUsername}`);

      const user = await userService.authenticate(credenciais.username, credenciais.password)
      if (user) {
        authSessaoService.iniciar(event.sender.id, user.id);
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
            forma_tratamento: user.forma_tratamento,
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
  ipcMain.handle('logout', async event => {
    authSessaoService.encerrar(event.sender.id);
    log.info('Logout solicitado');
    return { success: true };
  });

};


