import { getLogger } from '../utils/logger.js'

const log = getLogger('sistema')

import { app, session } from 'electron'


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
  // Revogar permissões desnecessárias
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'geolocation', 'notifications', 'midiSysex'];

    if (allowedPermissions.includes(permission)) {
      log.warn(`Permissão ${permission} solicitada - negada por padrão`);
      callback(false); // Negar todas as permissões por padrão
    } else {
      log.warn(`Permissão desconhecida ${permission} solicitada - negada`);
      callback(false);
    }
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
  // Desabilitar funcionalidades perigosas
  app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicy');

  // Habilitar sandbox para processos de renderização
  app.commandLine.appendSwitch('enable-sandbox');

  // Configurar limitações de nodeIntegration
  app.commandLine.appendSwitch('disable-node-integration-in-workers', 'true');
  app.commandLine.appendSwitch('disable-node-integration-in-subframes', 'true');

  // Configurar política de origem cruzada
  app.commandLine.appendSwitch('disable-site-isolation-trials', 'true');

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

/**
 * Valida se uma query SQL é segura (proteção básica)
 */
export const validateSqlQuery = (query: string): boolean => {
  if (typeof query !== 'string') {
    return false;
  }

  const trimmedQuery = query.trim().toUpperCase();

  // Lista de comandos perigosos
  const dangerousCommands = [
    'DROP',
    'DELETE',
    'UPDATE',
    'INSERT',
    'ALTER',
    'TRUNCATE',
    'CREATE',
    'EXEC',
    'EXECUTE',
    'SHUTDOWN',
    'GRANT',
    'REVOKE',
  ];

  // Verificar se a query contém comandos perigosos
  const containsDangerousCommand = dangerousCommands.some(
    cmd => trimmedQuery.includes(cmd) && !trimmedQuery.includes(`-- ${cmd}`) // Ignorar comentários
  );

  if (containsDangerousCommand) {
    log.warn(`Query potencialmente perigosa detectada: ${query.substring(0, 100)}`);
    return false;
  }

  return true;
};

