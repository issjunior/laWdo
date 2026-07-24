import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { assinarManifesto, normalizarManifesto } from './manifesto.mjs';

const executarArquivo = promisify(execFile);
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const chavePrivada = privateKey.export({ format: 'pem', type: 'pkcs8' });
const chavePublica = publicKey.export({ format: 'pem', type: 'spki' });

function criarManifesto(versao, plataforma = 'windows') {
  return normalizarManifesto({
    versao,
    commit: 'a'.repeat(40),
    dataPublicacao: '2026-07-24T12:00:00.000Z',
    canais: ['stable'],
    versaoSchema: 30,
    requerBackupCompletoImagens: false,
    notas: 'Correções de estabilidade.',
    artefatos: [{
      plataforma,
      arquitetura: 'x64',
      formato: plataforma === 'windows' ? 'nsis' : 'AppImage',
      canal: 'stable',
      nome: `${plataforma}-${versao}.${plataforma === 'windows' ? 'exe' : 'AppImage'}`,
      tamanho: 42,
      hashSha256: 'b'.repeat(64),
      url: `https://github.com/issjunior/laWdo/releases/download/v${versao}/${plataforma}-${versao}.${plataforma === 'windows' ? 'exe' : 'AppImage'}`,
    }],
  });
}

function criarNotasValidas(manifesto) {
  return `# laWdo v${manifesto.versao}

## Resumo

Correções de estabilidade.

## Disponibilidade

windows x64 nsis

## Alterações

Nenhuma alteração adicional.

## Correções

Validação da release.

## Dados, backup e compatibilidade

Sem alteração de compatibilidade.

## Como atualizar

Baixe o instalador correspondente.

## Limitações conhecidas

Nenhuma limitação adicional.

## Integridade e origem

Commit: \`${manifesto.commit}\`

Manifesto: \`manifesto.json\`
Assinatura: \`manifesto.json.sig\`
`;
}

test('gera um feed completo preservando a versão mais recente por plataforma', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'lawdo-feed-'));
  const publicacoes = join(raiz, 'publicacoes');
  const saida = join(raiz, 'feed');
  const chave = join(raiz, 'chave-publica.pem');
  await writeFile(chave, chavePublica);
  for (const [nome, manifesto] of [['v0.1.1', criarManifesto('0.1.1')], ['v0.1.2', criarManifesto('0.1.2')], ['linux', criarManifesto('0.1.1', 'linux')]]) {
    const pasta = join(publicacoes, nome);
    await (await import('node:fs/promises')).mkdir(pasta, { recursive: true });
    await writeFile(join(pasta, 'manifesto.json'), JSON.stringify(manifesto));
    await writeFile(join(pasta, 'manifesto.json.sig'), assinarManifesto(manifesto, chavePrivada));
  }
  await executarArquivo(process.execPath, ['scripts/release/gerar-feed.mjs', '--diretorio', publicacoes, '--saida', saida, '--chave-publica', chave], {
    env: { ...process.env, CHAVE_PRIVADA_ASSINATURA: chavePrivada },
  });
  const indiceWindows = JSON.parse(await readFile(join(saida, 'stable', 'windows-x64.json'), 'utf8'));
  const indiceLinux = JSON.parse(await readFile(join(saida, 'stable', 'linux-x64.json'), 'utf8'));
  const paginaInicial = await readFile(join(saida, 'index.html'), 'utf8');
  const logo = await readFile(join(saida, 'logo.png'));
  assert.equal(indiceWindows.versao, '0.1.2');
  assert.equal(indiceLinux.versao, '0.1.1');
  assert.match(paginaInicial, /Menos retrabalho/);
  assert.match(paginaInicial, /integração com o GDL/i);
  assert.match(paginaInicial, /logo.png/);
  assert.ok(logo.length > 0);
});

test('não anuncia uma release suspensa e preserva a versão anterior no feed', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'lawdo-suspensao-'));
  const publicacoes = join(raiz, 'publicacoes');
  const saida = join(raiz, 'feed');
  const chave = join(raiz, 'chave-publica.pem');
  await writeFile(chave, chavePublica);
  for (const [nome, manifesto] of [['v0.1.1', criarManifesto('0.1.1')], ['v0.1.2', criarManifesto('0.1.2')]]) {
    const pasta = join(publicacoes, nome);
    await (await import('node:fs/promises')).mkdir(pasta, { recursive: true });
    await writeFile(join(pasta, 'manifesto.json'), JSON.stringify(manifesto));
    await writeFile(join(pasta, 'manifesto.json.sig'), assinarManifesto(manifesto, chavePrivada));
  }
  await writeFile(join(publicacoes, 'v0.1.2', '.suspensa'), '');
  await executarArquivo(process.execPath, ['scripts/release/gerar-feed.mjs', '--diretorio', publicacoes, '--saida', saida, '--chave-publica', chave], {
    env: { ...process.env, CHAVE_PRIVADA_ASSINATURA: chavePrivada },
  });
  const indice = JSON.parse(await readFile(join(saida, 'stable', 'windows-x64.json'), 'utf8'));
  assert.equal(indice.versao, '0.1.1');
});

test('bloqueia notas incompletas antes da promoção', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'lawdo-promocao-'));
  const manifesto = criarManifesto('0.1.1');
  const manifestoPath = join(raiz, 'manifesto.json');
  const assinaturaPath = join(raiz, 'manifesto.json.sig');
  const chavePath = join(raiz, 'chave-publica.pem');
  const notasPath = join(raiz, 'notas.md');
  const assetsPath = join(raiz, 'assets.json');
  await writeFile(manifestoPath, JSON.stringify(manifesto));
  await writeFile(assinaturaPath, assinarManifesto(manifesto, chavePrivada));
  await writeFile(chavePath, chavePublica);
  await writeFile(notasPath, '# laWdo v0.1.1\n\n## Resumo\n\nPENDENTE\n');
  await writeFile(assetsPath, JSON.stringify(manifesto.artefatos.map(artefato => ({
    name: artefato.nome,
    size: artefato.tamanho,
    browser_download_url: artefato.url,
  }))));
  await assert.rejects(
    executarArquivo(process.execPath, [
      'scripts/release/validar-promocao.mjs',
      '--versao', '0.1.1',
      '--manifesto', manifestoPath,
      '--assinatura', assinaturaPath,
      '--notas', notasPath,
      '--assets', assetsPath,
      '--chave-publica', chavePath,
    ]),
    /placeholders pendentes/
  );
});

test('aceita a URL temporária do GitHub enquanto a release está em rascunho', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'lawdo-rascunho-'));
  const manifesto = criarManifesto('0.1.1');
  const manifestoPath = join(raiz, 'manifesto.json');
  const assinaturaPath = join(raiz, 'manifesto.json.sig');
  const chavePath = join(raiz, 'chave-publica.pem');
  const notasPath = join(raiz, 'notas.md');
  const assetsPath = join(raiz, 'assets.json');
  await writeFile(manifestoPath, JSON.stringify(manifesto));
  await writeFile(assinaturaPath, assinarManifesto(manifesto, chavePrivada));
  await writeFile(chavePath, chavePublica);
  await writeFile(notasPath, criarNotasValidas(manifesto));
  await writeFile(assetsPath, JSON.stringify(manifesto.artefatos.map(artefato => ({
    name: artefato.nome,
    size: artefato.tamanho,
    url: artefato.url.replace(`/v${manifesto.versao}/`, '/untagged-0123456789abcdef/'),
  }))));
  await executarArquivo(process.execPath, [
    'scripts/release/validar-promocao.mjs',
    '--versao', '0.1.1',
    '--manifesto', manifestoPath,
    '--assinatura', assinaturaPath,
    '--notas', notasPath,
    '--assets', assetsPath,
    '--chave-publica', chavePath,
  ]);
});
