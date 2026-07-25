import assert from 'node:assert/strict';
import test from 'node:test';

import {
  incrementarVersaoPatch,
  obterVersaoProjeto,
  planejarVersaoProjeto,
} from './versao-projeto.mjs';

function criarMetadados(versao) {
  return {
    pacote: { version: versao },
    lock: {
      version: versao,
      packages: {
        '': { version: versao },
      },
    },
  };
}

test('incrementa somente o patch da última versão publicada', () => {
  assert.equal(incrementarVersaoPatch('0.1.2'), '0.1.3');
  assert.equal(incrementarVersaoPatch('2.9.99'), '2.9.100');
});

test('planeja incremento automático ao criar uma release', () => {
  assert.deepEqual(
    planejarVersaoProjeto({
      versaoProjeto: '0.1.2',
      ultimaVersaoPublicada: '0.1.2',
      modo: 'criar',
    }),
    { versao: '0.1.3', incrementar: true }
  );
});

test('não incrementa novamente ao repetir uma preparação interrompida', () => {
  assert.deepEqual(
    planejarVersaoProjeto({
      versaoProjeto: '0.1.3',
      ultimaVersaoPublicada: '0.1.2',
      modo: 'criar',
    }),
    { versao: '0.1.3', incrementar: false }
  );
});

test('retoma somente uma versão que já foi preparada', () => {
  assert.deepEqual(
    planejarVersaoProjeto({
      versaoProjeto: '0.1.3',
      ultimaVersaoPublicada: '0.1.2',
      modo: 'retomar',
    }),
    { versao: '0.1.3', incrementar: false }
  );

  assert.throws(
    () => planejarVersaoProjeto({
      versaoProjeto: '0.1.2',
      ultimaVersaoPublicada: '0.1.2',
      modo: 'retomar',
    }),
    /Não há versão preparada/
  );
});

test('bloqueia divergência entre package.json e os dois campos do lockfile', () => {
  const { pacote, lock } = criarMetadados('0.1.2');
  assert.equal(obterVersaoProjeto(pacote, lock), '0.1.2');

  lock.packages[''].version = '0.1.1';
  assert.throws(() => obterVersaoProjeto(pacote, lock), /Versões divergentes/);
});
