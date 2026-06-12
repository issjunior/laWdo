import { safeStorage } from 'electron';
import { getLogger } from '../utils/logger.js';

const log = getLogger('configuracao');

class SafeStorageService {
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  encrypt(plaintext: string): string {
    if (!this.isAvailable()) {
      log.warn('safeStorage indisponível, armazenando sem criptografia');
      return plaintext;
    }
    const buffer = safeStorage.encryptString(plaintext);
    return buffer.toString('base64');
  }

  decrypt(encoded: string): string {
    if (!this.isAvailable()) {
      return encoded;
    }
    try {
      const buffer = Buffer.from(encoded, 'base64');
      return safeStorage.decryptString(buffer);
    } catch {
      log.warn('Falha ao descriptografar com safeStorage, retornando valor bruto');
      return encoded;
    }
  }
}

export const safeStorageService = new SafeStorageService();
export default safeStorageService;
