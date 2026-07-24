import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackupAtualizacaoService } from '../../main/services/backup-atualizacao.service';

const executeNonQueryMock = vi.fn().mockResolvedValue(undefined);
const getSchemaVersionMock = vi.fn().mockResolvedValue(30);
const diretoriosCriados: string[] = [];

vi.mock('../../main/database/sqlite.js', () => ({
  executeNonQuery: (...args: unknown[]) => executeNonQueryMock(...args),
}));

vi.mock('../../main/database/index.js', () => ({
  getSchemaVersion: (...args: unknown[]) => getSchemaVersionMock(...args),
}));

function criarBanco(caminho: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const banco = new sqlite3.Database(caminho);
    banco.run('CREATE TABLE teste (id INTEGER PRIMARY KEY, valor TEXT)', erro => {
      if (erro) {
        reject(erro);
        return;
      }
      banco.run("INSERT INTO teste (valor) VALUES ('ok')", erroInsercao => {
        banco.close(() => erroInsercao ? reject(erroInsercao) : resolve());
      });
    });
  });
}

afterEach(() => {
  executeNonQueryMock.mockClear();
  getSchemaVersionMock.mockClear();
  for (const diretorio of diretoriosCriados.splice(0)) fs.rmSync(diretorio, { recursive: true, force: true });
});

describe('BackupAtualizacaoService', () => {
  it('deve criar snapshot íntegro com metadados da atualização', async () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-backup-atualizacao-'));
    diretoriosCriados.push(diretorio);
    await criarBanco(path.join(diretorio, 'laudopericial.db'));
    const service = new BackupAtualizacaoService(diretorio, '0.1.1');

    const resultado = await service.criarSnapshot('0.1.2');
    const manifesto = JSON.parse(fs.readFileSync(resultado.caminhoManifesto, 'utf8')) as Record<string, unknown>;

    expect(executeNonQueryMock).toHaveBeenCalledWith('PRAGMA wal_checkpoint(FULL)');
    expect(fs.existsSync(resultado.caminhoBanco)).toBe(true);
    expect(manifesto).toMatchObject({ versaoOrigem: '0.1.1', versaoDestino: '0.1.2', versaoSchema: 30 });
    expect(typeof manifesto.hashSha256Banco).toBe('string');
  });

  it('deve criar e validar backup completo quando houver imagens', async () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-backup-atualizacao-'));
    diretoriosCriados.push(diretorio);
    await criarBanco(path.join(diretorio, 'laudopericial.db'));
    const caminhoImagem = path.join(diretorio, 'imagens', 'laudos', 'laudo-1', 'foto.png');
    fs.mkdirSync(path.dirname(caminhoImagem), { recursive: true });
    fs.writeFileSync(caminhoImagem, 'imagem de teste');
    const service = new BackupAtualizacaoService(diretorio, '0.1.1');

    const resultado = await service.criarBackupCompleto('0.1.2');
    const manifesto = JSON.parse(fs.readFileSync(resultado.caminhoManifestoCompleto, 'utf8')) as { imagens: Array<{ caminho: string }> };

    expect(fs.existsSync(resultado.caminhoBackupCompleto)).toBe(true);
    expect(manifesto.imagens).toEqual([expect.objectContaining({ caminho: 'imagens/laudos/laudo-1/foto.png' })]);
  });

});
