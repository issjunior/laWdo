import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecuperacaoAtualizacaoService, formatarRelatoRecuperacao } from '../../main/services/recuperacao-atualizacao.service';

const criarBackupConsistenteMock = vi.fn();
const getSchemaVersionMock = vi.fn().mockResolvedValue(50);
const diretorios: string[] = [];

function criarBanco(caminho: string): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    const banco = new sqlite3.Database(caminho);
    banco.exec('CREATE TABLE dados (valor TEXT); INSERT INTO dados VALUES (\'origem\');', erro => {
      banco.close(erroFechamento => erro ?? erroFechamento ? rejeitar(erro ?? erroFechamento) : resolver());
    });
  });
}

vi.mock('../../main/database/sqlite.js', () => ({
  criarBackupConsistente: (...args: unknown[]) => criarBackupConsistenteMock(...args),
}));

vi.mock('../../main/database/index.js', () => ({
  getSchemaVersion: (...args: unknown[]) => getSchemaVersionMock(...args),
}));

afterEach(() => {
  criarBackupConsistenteMock.mockReset();
  getSchemaVersionMock.mockReset();
  getSchemaVersionMock.mockResolvedValue(50);
  for (const diretorio of diretorios.splice(0)) fs.rmSync(diretorio, { recursive: true, force: true });
});

describe('RecuperacaoAtualizacaoService', () => {
  it('restaura banco e dados locais quando a primeira abertura da versão nova é interrompida', async () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-recuperacao-atualizacao-'));
    diretorios.push(diretorio);
    const banco = path.join(diretorio, 'laudopericial.db');
    await criarBanco(banco);
    fs.mkdirSync(path.join(diretorio, 'imagens', 'laudos'), { recursive: true });
    fs.mkdirSync(path.join(diretorio, 'avatars'), { recursive: true });
    fs.mkdirSync(path.join(diretorio, 'gdl'), { recursive: true });
    fs.writeFileSync(path.join(diretorio, 'imagens', 'laudos', 'foto.png'), 'imagem-origem');
    fs.writeFileSync(path.join(diretorio, 'avatars', 'perito.png'), 'avatar-origem');
    fs.writeFileSync(path.join(diretorio, 'gdl', 'cache.json'), 'cache-origem');
    criarBackupConsistenteMock.mockImplementation(async (destino: string) => fs.copyFileSync(banco, destino));
    const service = new RecuperacaoAtualizacaoService(diretorio, '0.1.23');

    await service.preparar('0.1.24');
    const versaoNova = new RecuperacaoAtualizacaoService(diretorio, '0.1.24');
    versaoNova.iniciarVersaoDestino();
    fs.writeFileSync(banco, 'banco-alterado');
    fs.writeFileSync(path.join(diretorio, 'imagens', 'laudos', 'foto.png'), 'imagem-alterada');
    fs.writeFileSync(path.join(diretorio, 'avatars', 'perito.png'), 'avatar-alterado');
    fs.writeFileSync(path.join(diretorio, 'gdl', 'cache.json'), 'cache-alterado');

    const relato = await versaoNova.restaurarSeInterrompida();

    expect(relato).toMatchObject({ codigo: 'ATUALIZACAO_REVERTIDA', versaoOrigem: '0.1.23', versaoDestino: '0.1.24', resultado: 'restaurada' });
    expect(fs.readFileSync(banco).subarray(0, 16).toString('utf8')).toBe('SQLite format 3\u0000');
    expect(fs.readFileSync(path.join(diretorio, 'imagens', 'laudos', 'foto.png'), 'utf8')).toBe('imagem-origem');
    expect(fs.readFileSync(path.join(diretorio, 'avatars', 'perito.png'), 'utf8')).toBe('avatar-origem');
    expect(fs.readFileSync(path.join(diretorio, 'gdl', 'cache.json'), 'utf8')).toBe('cache-origem');
    expect(fs.existsSync(path.join(diretorio, 'recuperacao-atualizacao-pendente.json'))).toBe(false);
  });

  it('só descarta o marcador depois da confirmação de saúde', async () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-recuperacao-atualizacao-'));
    diretorios.push(diretorio);
    const banco = path.join(diretorio, 'laudopericial.db');
    await criarBanco(banco);
    criarBackupConsistenteMock.mockImplementation(async (destino: string) => fs.copyFileSync(banco, destino));
    const service = new RecuperacaoAtualizacaoService(diretorio, '0.1.24');

    await service.preparar('0.1.24');
    service.iniciarVersaoDestino();
    expect(fs.existsSync(path.join(diretorio, 'recuperacao-atualizacao-pendente.json'))).toBe(true);
    service.confirmarSaude(51);
    expect(fs.existsSync(path.join(diretorio, 'recuperacao-atualizacao-pendente.json'))).toBe(false);
  });

  it('não substitui os dados ativos quando o snapshot foi corrompido', async () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-recuperacao-atualizacao-'));
    diretorios.push(diretorio);
    const banco = path.join(diretorio, 'laudopericial.db');
    await criarBanco(banco);
    criarBackupConsistenteMock.mockImplementation(async (destino: string) => fs.copyFileSync(banco, destino));
    const service = new RecuperacaoAtualizacaoService(diretorio, '0.1.23');

    await service.preparar('0.1.24');
    const marcador = JSON.parse(fs.readFileSync(path.join(diretorio, 'recuperacao-atualizacao-pendente.json'), 'utf8')) as { diretorioSnapshot: string };
    fs.writeFileSync(path.join(marcador.diretorioSnapshot, 'laudopericial.db'), 'snapshot-corrompido');
    const versaoNova = new RecuperacaoAtualizacaoService(diretorio, '0.1.24');
    versaoNova.iniciarVersaoDestino();
    fs.writeFileSync(banco, 'dados-ativos');

    await expect(versaoNova.restaurarSeInterrompida()).rejects.toThrow('file is not a database');
    expect(fs.readFileSync(banco, 'utf8')).toBe('dados-ativos');
    expect(fs.existsSync(path.join(diretorio, 'recuperacao-atualizacao-pendente.json'))).toBe(true);
  });

  it('gera relato copiável sem conteúdo do usuário e com o canal de suporte', () => {
    const relato = formatarRelatoRecuperacao({
      codigo: 'ATUALIZACAO_REVERTIDA', ocorridoEm: '2026-11-22T12:00:00.000Z', versaoOrigem: '0.1.23',
      versaoDestino: '0.1.24', schemaOrigem: 50, schemaDestino: 51, resultado: 'restaurada',
    });

    expect(relato).toContain('izaias.santos@policiacientifica.pr.gov.br');
    expect(relato).toContain('https://github.com/issjunior/laWdo');
    expect(relato).not.toContain('REP-');
  });
});
