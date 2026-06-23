import { getLogger } from '../utils/logger.js';
import crypto from 'crypto';

const log = getLogger('sistema')

/**
 * Módulo de criptografia para dados sensíveis
 * Segue as melhores práticas de segurança para dados sensíveis
 */

// Chave de criptografia (em ambiente real, deve ser armazenada de forma segura)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-for-development-only';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

/**
 * Gera uma chave de criptografia a partir de uma senha usando PBKDF2
 */
const deriveKey = (password: string, salt: Buffer): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, 'sha512', (err, derivedKey) => {
      if (err) {
        reject(err);
      } else {
        resolve(derivedKey);
      }
    });
  });
};

/**
 * Criptografa um texto usando AES-256-GCM
 */
export const encrypt = async (text: string): Promise<string> => {
  try {
    log.debug('Criptografando texto...');

    // Gerar salt e IV aleatórios
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derivar chave
    const key = await deriveKey(ENCRYPTION_KEY, salt);

    // Criar cifra
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Criptografar
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Obter auth tag
    const authTag = cipher.getAuthTag();

    // Combinar tudo: salt + iv + authTag + texto criptografado
    const result = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')]);

    return result.toString('base64');
  } catch (error) {
    log.error('Erro ao criptografar texto', error);
    throw error;
  }
};

/**
 * Descriptografa um texto criptografado
 */
export const decrypt = async (encryptedData: string): Promise<string> => {
  try {
    log.debug('Descriptografando texto...');

    // Converter de base64 para buffer
    const data = Buffer.from(encryptedData, 'base64');

    // Extrair componentes
    const salt = data.slice(0, SALT_LENGTH);
    const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = data.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encryptedText = data.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // Derivar chave
    const key = await deriveKey(ENCRYPTION_KEY, salt);

    // Criar decifra
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Descriptografar
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    log.error('Erro ao descriptografar texto', error);
    throw error;
  }
};

