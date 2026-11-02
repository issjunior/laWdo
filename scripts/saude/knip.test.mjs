import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deveRepetirAnalise } from '../check-knip.mjs';

test('repete somente a falha conhecida de alocação do parser', () => {
  const conhecida = 'RangeError: Array buffer allocation failed at node_modules/oxc-parser/src-js/raw-transfer/common.js';
  assert.equal(deveRepetirAnalise(1, conhecida), true);
  assert.equal(deveRepetirAnalise(0, conhecida), false);
  assert.equal(deveRepetirAnalise(1, 'Configuração Knip inválida'), false);
  assert.equal(deveRepetirAnalise(1, 'RangeError: Array buffer allocation failed at outro-parser'), false);
});
