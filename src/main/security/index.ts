import { getLogger } from '../utils/logger.js'

const log = getLogger('sistema')

import { app, session, shell } from 'electron'
import { urlExternaPermitida } from './navegacao.js'


/**
 * Configuração de segurança para a aplicação Electron
 * Segue as melhores práticas de segurança do Electron
 * https://www.electronjs.org/docs/latest/tutorial/security
 */

export const setupSecurity = (): void => {
  log.info('Configurando medidas de segurança...');

  // 1. Configurar permissões da sessão
  setupSessionPermissions();

  // 2. Configurar headers de segurança
  setupSecurityHeaders();

  // 3. Configurar proteções adicionais
  setupAdditionalProtections();

  log.info('Medidas de segurança configuradas com sucesso');
};

const contentSecurityPolicy = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' data: https://fonts.gstatic.com;
    img-src 'self' data: blob:;
    connect-src 'self' blob:;
    frame-src 'self' data: blob: chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai;
    object-src 'self' data: blob:;
    base-uri 'self';
    form-action 'self';
  `
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Configura permissões da sessão
 */
const setupSessionPermissions = (): void => {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    log.warn(`Permissão ${permission} solicitada - negada por padrão`);
    callback(false);
  });

  log.info('Permissões da sessão configuradas');
};

/**
 * Configura headers de segurança HTTP
 */
const setupSecurityHeaders = (): void => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType !== 'mainFrame') {
      callback({});
      return;
    }

    const securityHeaders = {
      'Content-Security-Policy': [contentSecurityPolicy],
      'X-Content-Type-Options': ['nosniff'],
      'X-Frame-Options': ['DENY'],
      'X-XSS-Protection': ['1; mode=block'],
      'Referrer-Policy': ['strict-origin-when-cross-origin'],
      'Permissions-Policy': ['geolocation=(), microphone=(), camera=(), payment=()'],
    };

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        ...securityHeaders,
      },
    });
  });

  log.info('Headers de segurança configurados');
};

/**
 * Configura proteções adicionais
 */
const setupAdditionalProtections = (): void => {
  // Habilitar sandbox para processos de renderização
  app.commandLine.appendSwitch('enable-sandbox');

  // Configurar limitações de nodeIntegration
  app.commandLine.appendSwitch('disable-node-integration-in-workers', 'true');
  app.commandLine.appendSwitch('disable-node-integration-in-subframes', 'true');

  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (urlExternaPermitida(url)) {
        setImmediate(() => void shell.openExternal(url).catch(erro => {
          log.error('Não foi possível abrir URL externa', { url, erro });
        }));
      } else {
        log.warn('Abertura de URL externa bloqueada', { url });
      }
      return { action: 'deny' };
    });
  });

  log.info('Proteções adicionais configuradas');
};

/**
 * Valida entrada de dados (proteção contra injeção)
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }

  // Remover caracteres potencialmente perigosos
  return input
    .replace(/[<>]/g, '') // Remove < e >
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/data:/gi, '') // Remove data:
    .trim()
    .substring(0, 1000); // Limitar comprimento
};

