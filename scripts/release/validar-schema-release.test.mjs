import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { versaoSchemaAtual } from './versao-schema.mjs';

const executarArquivo = promisify(execFile);

test('valida que a versão atual corresponde à maior migration registrada', async () => {
  const { stdout } = await executarArquivo(process.execPath, ['scripts/release/validar-schema-release.mjs']);
  assert.equal(stdout, `Schema ${versaoSchemaAtual} validado.\n`);
});

test('rejeita manifesto cujo schema diverge do aplicativo', async () => {
  const schemaDivergente = versaoSchemaAtual - 1;
  const diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-manifesto-schema-'));
  const caminhoManifesto = path.join(diretorio, 'manifesto.json');
  await writeFile(caminhoManifesto, JSON.stringify({
    versao: '0.1.9',
    commit: 'a'.repeat(40),
    dataPublicacao: '2026-09-04T00:00:00.000Z',
    canais: ['stable'],
    versaoSchema: schemaDivergente,
    requerBackupCompletoImagens: false,
    notas: 'Teste de divergência.',
    artefatos: [{
      plataforma: 'windows', arquitetura: 'x64', formato: 'nsis', canal: 'stable',
      nome: 'laWdo-Setup.exe', tamanho: 1, hashSha256: 'b'.repeat(64), url: 'https://example.test/laWdo-Setup.exe',
    }],
  }));

  try {
    await assert.rejects(
      executarArquivo(process.execPath, ['scripts/release/validar-schema-release.mjs', '--manifesto', caminhoManifesto]),
      new RegExp(`Manifesto informa schema ${schemaDivergente}, mas o aplicativo informa ${versaoSchemaAtual}`),
    );
  } finally {
    await rm(diretorio, { recursive: true, force: true });
  }
});
