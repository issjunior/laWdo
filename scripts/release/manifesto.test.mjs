import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import {
  assinarManifesto,
  normalizarManifesto,
  serializarCanonico,
  verificarManifesto,
} from './manifesto.mjs';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const chavePrivada = privateKey.export({ format: 'pem', type: 'pkcs8' });
const chavePublica = publicKey.export({ format: 'pem', type: 'spki' });

function criarManifesto() {
  return {
    versao: '0.1.1',
    commit: 'a'.repeat(40),
    dataPublicacao: '2026-07-23T20:00:00.000Z',
    canais: ['stable'],
    versaoSchema: 1,
    requerBackupCompletoImagens: false,
    notas: 'Correções de estabilidade.',
    artefatos: [
      {
        plataforma: 'linux',
        arquitetura: 'x64',
        formato: 'AppImage',
        canal: 'stable',
        nome: 'laWdo-0.1.1.AppImage',
        tamanho: 1024,
        hashSha256: 'b'.repeat(64),
        url: 'https://github.com/issjunior/laWdo/releases/download/v0.1.1/laWdo-0.1.1.AppImage',
      },
      {
        plataforma: 'windows',
        arquitetura: 'x64',
        formato: 'nsis',
        canal: 'stable',
        nome: 'laWdo-Setup-0.1.1.exe',
        tamanho: 2048,
        hashSha256: 'c'.repeat(64),
        url: 'https://github.com/issjunior/laWdo/releases/download/v0.1.1/laWdo-Setup-0.1.1.exe',
      },
    ],
  };
}

test('normaliza, ordena e assina o manifesto canônico', () => {
  const manifesto = normalizarManifesto(criarManifesto());
  const assinatura = assinarManifesto(manifesto, chavePrivada);

  assert.equal(manifesto.artefatos[0].plataforma, 'linux');
  assert.equal(manifesto.versaoManifesto, 1);
  assert.equal(verificarManifesto(manifesto, assinatura, chavePublica), true);
  assert.equal(serializarCanonico({ z: 1, a: 2 }), '{"a":2,"z":1}');
});

test('rejeita alteração posterior à assinatura e artefato inválido', () => {
  const manifesto = normalizarManifesto(criarManifesto());
  const assinatura = assinarManifesto(manifesto, chavePrivada);
  const adulterado = { ...manifesto, versao: '0.1.2' };

  assert.equal(verificarManifesto(adulterado, assinatura, chavePublica), false);
  assert.throws(
    () => normalizarManifesto({ ...criarManifesto(), artefatos: [] }),
    /ao menos um item/
  );
});
