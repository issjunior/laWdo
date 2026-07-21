import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { createHash } from 'crypto';
import sqlite3 from 'sqlite3';
import AdmZip from 'adm-zip';
import { getLogger } from '../utils/logger.js';
import { closeDatabase, executeNonQuery, executeQuery } from '../database/sqlite.js';
const log = getLogger('backup');

// Diretório do banco de dados
const DB_DIR = app.getPath('userData');
const DB_PATH = path.join(DB_DIR, 'laudopericial.db');
const IMAGES_DIR = path.join(DB_DIR, 'imagens');

interface ImagemBackupRow {
  caminho_relativo: string;
  sha256: string;
  tamanho: number;
}

interface ManifestoBackup {
  formato: 2;
  criadoEm: string;
  imagens: Array<{ caminho: string; sha256: string; tamanho: number }>;
}

function caminhoImagemAbsoluto(caminhoRelativo: string): string {
  const absoluto = path.resolve(DB_DIR, caminhoRelativo);
  const raiz = path.resolve(IMAGES_DIR);
  if (!absoluto.startsWith(`${raiz}${path.sep}`)) throw new Error('O banco contém um caminho de imagem inválido.');
  return absoluto;
}

async function criarManifestoBackup(): Promise<ManifestoBackup> {
  const imagens = await executeQuery<ImagemBackupRow>(
    'SELECT caminho_relativo, sha256, tamanho FROM imagens_laudo ORDER BY laudo_id, sequencia',
  );
  for (const imagem of imagens) {
    if (!fs.existsSync(caminhoImagemAbsoluto(imagem.caminho_relativo))) {
      throw new Error(`Imagem registrada não encontrada: ${imagem.caminho_relativo}`);
    }
  }
  return {
    formato: 2,
    criadoEm: new Date().toISOString(),
    imagens: imagens.map(imagem => ({
      caminho: imagem.caminho_relativo.replace(/\\/g, '/'),
      sha256: imagem.sha256,
      tamanho: imagem.tamanho,
    })),
  };
}

function validarEntradasZip(entries: AdmZip.IZipEntry[]): void {
  for (const entry of entries) {
    const nome = entry.entryName.replace(/\\/g, '/');
    if (nome.startsWith('/') || /^[a-zA-Z]:/.test(nome) || nome.split('/').includes('..')) {
      throw new Error('Arquivo de backup contém um caminho inválido.');
    }
  }
}

function validarImagensExtraidas(tempExtractDir: string, manifesto: ManifestoBackup | null): void {
  if (!manifesto) return;
  if (manifesto.formato !== 2 || !Array.isArray(manifesto.imagens)) throw new Error('Manifesto do backup inválido.');
  for (const imagem of manifesto.imagens) {
    if (!imagem || typeof imagem.caminho !== 'string' || typeof imagem.sha256 !== 'string' || typeof imagem.tamanho !== 'number') {
      throw new Error('Manifesto do backup contém uma imagem inválida.');
    }
    const caminho = path.resolve(tempExtractDir, imagem.caminho);
    const raiz = path.resolve(tempExtractDir, 'imagens');
    if (!caminho.startsWith(`${raiz}${path.sep}`) || !fs.existsSync(caminho)) {
      throw new Error(`Imagem ausente no backup: ${imagem.caminho}`);
    }
    const bytes = fs.readFileSync(caminho);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== imagem.tamanho || sha256 !== imagem.sha256) {
      throw new Error(`Imagem corrompida no backup: ${imagem.caminho}`);
    }
  }
}

/**
 * Cria um arquivo ZIP de backup contendo o banco de dados e todas as imagens.
 * @param destino Caminho completo onde o arquivo ZIP será salvo.
 * @returns Objeto com success e path do arquivo gerado.
 */
export const criarBackup = async (destino: string): Promise<{ success: boolean; path?: string; error?: string }> => {
  const tempDbPath = path.join(DB_DIR, `_backup_temp_${Date.now()}.db`);
  try {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('Banco de dados não encontrado para backup');
    }

    await executeNonQuery('PRAGMA wal_checkpoint(FULL)');
    const manifesto = await criarManifestoBackup();
    const zip = new AdmZip();

    fs.copyFileSync(DB_PATH, tempDbPath);
    log.debug('Cópia temporária do banco criada para limpeza de auditoria');

    const tempDb = new sqlite3.Database(tempDbPath);
    await new Promise<void>((resolve, reject) => {
      tempDb.run('DELETE FROM logs_auditoria WHERE modulo NOT IN (\'rep\', \'laudo\')', (err) => {
        if (err) { reject(err); } else { resolve(); }
      });
    });
    log.debug('Registros de auditoria (exceto REPs e Laudos) removidos da cópia de backup');

    await new Promise<void>((resolve, reject) => {
      tempDb.run('VACUUM', (err) => {
        if (err) { reject(err); } else { resolve(); }
      });
    });
    tempDb.close();

    zip.addLocalFile(tempDbPath, '', 'laudopericial.db');
    zip.addFile('manifesto.json', Buffer.from(JSON.stringify(manifesto, null, 2), 'utf8'));
    log.debug('Banco de dados (sem auditoria) adicionado ao ZIP de backup');

    const caminhosAdicionados = new Set<string>();
    for (const imagem of manifesto.imagens) {
      if (caminhosAdicionados.has(imagem.caminho)) continue;
      caminhosAdicionados.add(imagem.caminho);
      const caminhoNoZip = imagem.caminho.replace(/\\/g, '/');
      zip.addLocalFile(
        caminhoImagemAbsoluto(imagem.caminho),
        path.posix.dirname(caminhoNoZip),
        path.posix.basename(caminhoNoZip),
      );
    }
    log.debug('Imagens referenciadas adicionadas ao ZIP de backup', { quantidade: caminhosAdicionados.size });

    // Gravar arquivo ZIP
    zip.writeZip(destino);

    log.debug('Backup ZIP criado com sucesso', { destino });
    return { success: true, path: destino };
  } catch (error) {
    log.error('Erro ao criar backup ZIP', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao criar backup',
    };
  } finally {
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
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
    validarEntradasZip(entries);

    // Validar conteúdo mínimo do ZIP
    const hasDb = entries.some(e => e.entryName === 'laudopericial.db');
    if (!hasDb) {
      throw new Error('Arquivo de backup inválido: não contém laudopericial.db');
    }

    // Criar pré-backup do estado atual antes de sobrescrever
    const preRestorePath = path.join(DB_DIR, `pre_restore_${Date.now()}.zip`);
    const preBackup = await criarBackup(preRestorePath);
    if (!preBackup.success) throw new Error(`Não foi possível criar o pré-backup: ${preBackup.error || 'erro desconhecido'}`);
    log.debug('Pré-backup do estado atual criado antes da restauração', { preRestorePath });

    // Fechar conexão com o banco de dados
    await closeDatabase();
    log.debug('Conexão com banco de dados fechada para restauração');

    // Extrair ZIP para diretório temporário
    const tempExtractDir = path.join(DB_DIR, `restore_${Date.now()}`);
    fs.mkdirSync(tempExtractDir, { recursive: true });
    zip.extractAllTo(tempExtractDir, true);
    log.debug('Backup extraído para diretório temporário', { tempExtractDir });

    const manifestoEntry = entries.find(entry => entry.entryName === 'manifesto.json');
    let manifesto: ManifestoBackup | null = null;
    if (manifestoEntry) {
      try {
        manifesto = JSON.parse(manifestoEntry.getData().toString('utf8')) as ManifestoBackup;
      } catch {
        throw new Error('Manifesto do backup não contém JSON válido.');
      }
    }
    validarImagensExtraidas(tempExtractDir, manifesto);

    // Substituir banco de dados
    const extractedDbPath = path.join(tempExtractDir, 'laudopericial.db');
    if (fs.existsSync(extractedDbPath)) {
      fs.copyFileSync(extractedDbPath, DB_PATH);
      log.debug('Banco de dados substituído');
    }

    // Substituir pasta de imagens
    const extractedImagesPath = path.join(tempExtractDir, 'imagens');
    if (fs.existsSync(IMAGES_DIR)) {
      fs.rmSync(IMAGES_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(extractedImagesPath)) {
      fs.mkdirSync(path.dirname(IMAGES_DIR), { recursive: true });
      fs.renameSync(extractedImagesPath, IMAGES_DIR);
      log.debug('Pasta de imagens substituída');
    } else {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
      log.debug('Backup sem imagens; pasta de imagens atual foi limpa');
    }

    // Limpar diretório temporário
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
    log.debug('Diretório temporário de restauração removido');

    // Reiniciar aplicação
    log.debug('Restauração concluída. Reiniciando aplicação...');
    app.relaunch();
    app.exit(0);

    return { success: true };
  } catch (error) {
    log.error('Erro ao restaurar backup', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao restaurar backup',
    };
  }
};
