import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enviarDigitacaoCadenciada } from './entrada.mjs';

test('digitação mantém pares de eventos nativos e intervalo programado', async () => {
  const comandos = []; const esperas = [];
  const sessao = { send: async (metodo, parametros) => { comandos.push({ metodo, parametros }); } };
  const resultado = await enviarDigitacaoCadenciada(sessao, 'a_B', 50, async ms => { esperas.push(ms); });
  assert.deepEqual(esperas, [50, 50, 50]);
  assert.deepEqual(comandos.map(item => item.parametros.type), ['keyDown', 'keyUp', 'keyDown', 'keyUp', 'keyDown', 'keyUp']);
  assert.equal(comandos[2].parametros.text, '_');
  assert.ok(comandos.every(item => item.metodo === 'Input.dispatchKeyEvent' && item.parametros.timestamp > 0));
  assert.equal(resultado.contrapressoes, 0);
});

test('limita a fila quando o aplicativo não acompanha a cadência', async () => {
  let pendentes = 0; let pico = 0;
  const sessao = { send: () => new Promise(resolver => {
    pendentes++; pico = Math.max(pico, pendentes);
    setTimeout(() => { pendentes--; resolver(); }, 2);
  }) };
  const resultado = await enviarDigitacaoCadenciada(sessao, 'a'.repeat(60), 50, async () => {});
  assert.ok(pico <= 32);
  assert.ok(resultado.contrapressoes > 0);
  assert.equal(pendentes, 0);
});

test('falha de transporte não é apresentada como digitação concluída', async () => {
  await assert.rejects(enviarDigitacaoCadenciada({ send: async () => { throw new Error('sessão encerrada'); } }, 'a', 50, async () => {}), /sessão encerrada/);
});
