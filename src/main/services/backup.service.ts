import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { logError, logInfo } from '../utils/logger.js';
import { closeDatabase } from '../database/sqlite.js';

// Diretório do banco de dados
const DB_DIR = app.getPath('userData');
const DB_PATH = path.join(DB_DIR, 'laudopericial.db');
const IMAGES_DIR = path.join(DB_DIR, 'imagens');

/**
 * Cria um arquivo ZIP de backup contendo o banco de dados e todas as imagens.
 * @param destino Caminho completo onde o arquivo ZIP será salvo.
 * @returns Objeto com success e path do arquivo gerado.
 */
export const criarBackup = async (destino: string): Promise<{ success: boolean; path?: string; error?: string }> => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('Banco de dados não encontrado para backup');
    }

    const zip = new AdmZip();

    // Adicionar banco de dados ao ZIP
    zip.addLocalFile(DB_PATH, '', 'laudopericial.db');
    logInfo('Banco de dados adicionado ao ZIP de backup', { dbPath: DB_PATH });

    // Adicionar pasta de imagens ao ZIP (recursivamente)
    if (fs.existsSync(IMAGES_DIR)) {
      zip.addLocalFolder(IMAGES_DIR, 'imagens');
      logInfo('Pasta de imagens adicionada ao ZIP de backup', { imagesDir: IMAGES_DIR });
    } else {
      logInfo('Pasta de imagens não existe; backup conterá apenas o banco de dados');
    }

    // Gravar arquivo ZIP
    zip.writeZip(destino);

    logInfo('Backup ZIP criado com sucesso', { destino });
    return { success: true, path: destino };
  } catch (error) {
    logError('Erro ao criar backup ZIP', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao criar backup',
    };
  }
};

/**
 * Restaura o estado da aplicação a partir de um arquivo ZIP de backup.
 * Fecha o banco, cria pré-backup do estado atual, extrai o ZIP e reinicia o app.
 * @param origem Caminho completo do arquivo ZIP de backup.
 * @returns Objeto com success. Em caso de sucesso, a aplicação será reiniciada.
 */
export const restaurarBackup = async (origem: string): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!fs.existsSync(origem)) {
      throw new Error('Arquivo de backup não encontrado');
    }

    const zip = new AdmZip(origem);
    const entries = zip.getEntries();

    // Validar conteúdo mínimo do ZIP
    const hasDb = entries.some(e => e.entryName === 'laudopericial.db');
    if (!hasDb) {
      throw new Error('Arquivo de backup inválido: não contém laudopericial.db');
    }

    // Criar pré-backup do estado atual antes de sobrescrever
    const preRestorePath = path.join(DB_DIR, `pre_restore_${Date.now()}.zip`);
    await criarBackup(preRestorePath);
    logInfo('Pré-backup do estado atual criado antes da restauração', { preRestorePath });

    // Fechar conexão com o banco de dados
    await closeDatabase();
    logInfo('Conexão com banco de dados fechada para restauração');

    // Extrair ZIP para diretório temporário
    const tempExtractDir = path.join(DB_DIR, `restore_${Date.now()}`);
    fs.mkdirSync(tempExtractDir, { recursive: true });
    zip.extractAllTo(tempExtractDir, true);
    logInfo('Backup extraído para diretório temporário', { tempExtractDir });

    // Substituir banco de dados
    const extractedDbPath = path.join(tempExtractDir, 'laudopericial.db');
    if (fs.existsSync(extractedDbPath)) {
      fs.copyFileSync(extractedDbPath, DB_PATH);
      logInfo('Banco de dados substituído');
    }

    // Substituir pasta de imagens
    const extractedImagesPath = path.join(tempExtractDir, 'imagens');
    if (fs.existsSync(extractedImagesPath)) {
      if (fs.existsSync(IMAGES_DIR)) {
        fs.rmSync(IMAGES_DIR, { recursive: true, force: true });
      }
      fs.mkdirSync(path.dirname(IMAGES_DIR), { recursive: true });
      fs.renameSync(extractedImagesPath, IMAGES_DIR);
      logInfo('Pasta de imagens substituída');
    }

    // Limpar diretório temporário
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
    logInfo('Diretório temporário de restauração removido');

    // Reiniciar aplicação
    logInfo('Restauração concluída. Reiniciando aplicação...');
    app.relaunch();
    app.exit(0);

    return { success: true };
  } catch (error) {
    logError('Erro ao restaurar backup', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao restaurar backup',
    };
  }
};
