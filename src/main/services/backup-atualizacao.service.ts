import { app } from 'electron';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { executeNonQuery } from '../database/sqlite.js';
import { getSchemaVersion } from '../database/index.js';
import { getLogger } from '../utils/logger.js';

const log = getLogger('backup');
const NOME_BANCO = 'laudopericial.db';
const RETENCAO_SNAPSHOTS = 2;

export interface ResultadoBackupAtualizacao {
  caminhoBanco: string;
  caminhoManifesto: string;
  versaoOrigem: string;
  versaoDestino: string;
  versaoSchema: number;
}

export interface ResultadoBackupCompletoAtualizacao extends ResultadoBackupAtualizacao {
  caminhoBackupCompleto: string;
  caminhoManifestoCompleto: string;
}

interface ManifestoBackupAtualizacao extends ResultadoBackupAtualizacao {
  formato: 1;
  criadoEm: string;
  tamanhoBanco: number;
  hashSha256Banco: string;
}

interface ManifestoBackupCompletoAtualizacao extends ResultadoBackupAtualizacao {
  formato: 1;
  criadoEm: string;
  imagens: Array<{ caminho: string; tamanho: number; hashSha256: string }>;
}


function calcularHash(caminho: string): string {
  return createHash('sha256').update(fs.readFileSync(caminho)).digest('hex');
}


function executarIntegridade(caminhoBanco: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const banco = new sqlite3.Database(caminhoBanco, sqlite3.OPEN_READONLY, erroAbertura => {
      if (erroAbertura) {
        reject(erroAbertura);
        return;
      }
      banco.get<{ integrity_check: string }>('PRAGMA integrity_check', (erro, linha) => {
        banco.close(() => undefined);
        if (erro) {
          reject(erro);
          return;
        }
        if (linha?.integrity_check !== 'ok') {
          reject(new Error('A verificação de integridade do snapshot falhou.'));
          return;
        }
        resolve();
      });
    });
  });
}

function listarArquivos(diretorio: string): string[] {
  if (!fs.existsSync(diretorio)) return [];
  return fs.readdirSync(diretorio, { withFileTypes: true }).flatMap(entrada => {
    const caminho = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) return listarArquivos(caminho);
    return entrada.isFile() ? [caminho] : [];
  });
}

export class BackupAtualizacaoService {
  constructor(
    private readonly diretorioDados = app.getPath('userData'),
    private readonly versaoAplicativo = app.getVersion(),
  ) {}

  async criarSnapshot(versaoDestino: string): Promise<ResultadoBackupAtualizacao> {
    const bancoOrigem = path.join(this.diretorioDados, NOME_BANCO);
    if (!fs.existsSync(bancoOrigem)) throw new Error('Banco de dados não encontrado para o backup pré-atualização.');

    await executeNonQuery('PRAGMA wal_checkpoint(FULL)');
    const versaoSchema = await getSchemaVersion();
    const diretorioSnapshots = path.join(this.diretorioDados, 'backups-atualizacao');
    fs.mkdirSync(diretorioSnapshots, { recursive: true });

    const identificador = new Date().toISOString().replace(/[:.]/g, '-');
    const base = `pre-atualizacao_${identificador}_${this.versaoAplicativo}_para_${versaoDestino}`;
    const caminhoBanco = path.join(diretorioSnapshots, `${base}.db`);
    const caminhoManifesto = path.join(diretorioSnapshots, `${base}.json`);

    try {
      fs.copyFileSync(bancoOrigem, caminhoBanco, fs.constants.COPYFILE_EXCL);
      await executarIntegridade(caminhoBanco);
      const estatisticas = fs.statSync(caminhoBanco);
      const manifesto: ManifestoBackupAtualizacao = {
        formato: 1,
        criadoEm: new Date().toISOString(),
        caminhoBanco,
        caminhoManifesto,
        versaoOrigem: this.versaoAplicativo,
        versaoDestino,
        versaoSchema,
        tamanhoBanco: estatisticas.size,
        hashSha256Banco: calcularHash(caminhoBanco),
      };
      fs.writeFileSync(caminhoManifesto, JSON.stringify(manifesto, null, 2), 'utf8');
      this.aplicarRetencao(diretorioSnapshots);
      log.info('Snapshot pré-atualização criado e validado.', { versaoDestino, versaoSchema });
      return { caminhoBanco, caminhoManifesto, versaoOrigem: this.versaoAplicativo, versaoDestino, versaoSchema };
    } catch (erro) {
      fs.rmSync(caminhoBanco, { force: true });
      fs.rmSync(caminhoManifesto, { force: true });
      throw erro;
    }
  }

  async criarBackupCompleto(versaoDestino: string): Promise<ResultadoBackupCompletoAtualizacao> {
    const snapshot = await this.criarSnapshot(versaoDestino);
    const diretorioSnapshots = path.dirname(snapshot.caminhoBanco);
    const identificador = new Date().toISOString().replace(/[:.]/g, '-');
    const base = `pre-atualizacao_completo_${identificador}_${this.versaoAplicativo}_para_${versaoDestino}`;
    const caminhoBackupCompleto = path.join(diretorioSnapshots, base);
    const caminhoManifestoCompleto = path.join(caminhoBackupCompleto, 'manifesto.json');
    const diretorioImagens = path.join(this.diretorioDados, 'imagens');

    try {
      const imagens = listarArquivos(diretorioImagens).map(caminho => {
        const caminhoRelativo = path.relative(this.diretorioDados, caminho).replace(/\\/g, '/');
        const estatisticas = fs.statSync(caminho);
        return { caminho: caminhoRelativo, tamanho: estatisticas.size, hashSha256: calcularHash(caminho) };
      });
      const manifesto: ManifestoBackupCompletoAtualizacao = {
        ...snapshot,
        formato: 1,
        criadoEm: new Date().toISOString(),
        imagens,
      };
      fs.mkdirSync(caminhoBackupCompleto, { recursive: true });
      const caminhoBancoCompleto = path.join(caminhoBackupCompleto, NOME_BANCO);
      fs.copyFileSync(snapshot.caminhoBanco, caminhoBancoCompleto, fs.constants.COPYFILE_EXCL);
      for (const imagem of imagens) {
        const origem = path.join(this.diretorioDados, imagem.caminho);
        const destino = path.join(caminhoBackupCompleto, imagem.caminho);
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.copyFileSync(origem, destino, fs.constants.COPYFILE_EXCL);
        if (fs.statSync(destino).size !== imagem.tamanho || calcularHash(destino) !== imagem.hashSha256) {
          throw new Error(`Imagem inválida no backup completo: ${imagem.caminho}`);
        }
      }
      if (calcularHash(caminhoBancoCompleto) !== calcularHash(snapshot.caminhoBanco)) throw new Error('Banco inválido no backup completo.');
      fs.writeFileSync(caminhoManifestoCompleto, JSON.stringify(manifesto, null, 2), 'utf8');
      log.info('Backup completo pré-atualização criado e validado.', { versaoDestino, quantidadeImagens: imagens.length });
      return { ...snapshot, caminhoBackupCompleto, caminhoManifestoCompleto };
    } catch (erro) {
      fs.rmSync(caminhoBackupCompleto, { recursive: true, force: true });
      throw erro;
    }
  }

  private aplicarRetencao(diretorio: string): void {
    const manifestos = fs.readdirSync(diretorio)
      .filter(nome => nome.startsWith('pre-atualizacao_') && nome.endsWith('.json'))
      .map(nome => ({ nome, caminho: path.join(diretorio, nome), estatisticas: fs.statSync(path.join(diretorio, nome)) }))
      .sort((primeiro, segundo) => segundo.estatisticas.mtimeMs - primeiro.estatisticas.mtimeMs);

    for (const manifesto of manifestos.slice(RETENCAO_SNAPSHOTS)) {
      try {
        const conteudo = JSON.parse(fs.readFileSync(manifesto.caminho, 'utf8')) as Partial<ManifestoBackupAtualizacao>;
        if (typeof conteudo.caminhoBanco === 'string' && path.dirname(conteudo.caminhoBanco) === diretorio) {
          fs.rmSync(conteudo.caminhoBanco, { force: true });
        }
        fs.rmSync(manifesto.caminho, { force: true });
      } catch (erro) {
        log.warn('Não foi possível remover snapshot antigo de atualização.', { manifesto: manifesto.nome, erro: erro instanceof Error ? erro.message : 'Erro inesperado' });
      }
    }
  }
}

export const backupAtualizacaoService = new BackupAtualizacaoService();
