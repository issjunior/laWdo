import { EventEmitter } from 'node:events';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const simulacao = vi.hoisted(() => ({ app: {} }));
vi.mock('electron', () => simulacao);
let workspace = '';
let encerrar: (() => Promise<void>) | undefined;
beforeEach(async () => {
  vi.resetModules();
  workspace = await mkdtemp(path.join(os.tmpdir(), 'lawdo-gpu-bootstrap-'));
});
afterEach(async () => {
  await encerrar?.(); encerrar = undefined;
  vi.unstubAllEnvs();
  await rm(workspace, { recursive: true, force: true });
});

function criarApp(empacotado = false) {
  const app = Object.assign(new EventEmitter(), {
    isPackaged: empacotado, getAppPath: () => workspace,
    commandLine: { appendSwitch: vi.fn(), hasSwitch: () => false, getSwitchValue: () => '' },
    whenReady: () => new Promise<void>(() => undefined),
    getGPUInfo: async () => ({}), getGPUFeatureStatus: () => ({}), getAppMetrics: () => [],
  });
  simulacao.app = app;
  return app;
}

describe('bootstrap gráfico restrito ao diagnóstico', () => {
  it.each([{ modo: '', pacote: false }, { modo: '1', pacote: true }])('não instala coleta no modo $modo com pacote=$pacote', async ({ modo, pacote }) => {
    vi.stubEnv('LAWDO_MODO_DIAGNOSTICO', modo);
    const app = criarApp(pacote);
    const modulo = await import('@main/diagnostico-gpu.js');
    modulo.prepararDiagnosticoGpu(); encerrar = modulo.encerrarDiagnosticoGpu;
    expect(modulo.diagnosticoGpu).toBeNull();
    expect(app.commandLine.appendSwitch).not.toHaveBeenCalled();
    expect(app.eventNames()).toEqual([]);
    expect(await readdir(workspace)).toEqual([]);
  });

  it('prepara o arquivo antes de ready, filtra GPU e remove observadores ao encerrar', async () => {
    vi.stubEnv('LAWDO_MODO_DIAGNOSTICO', '1');
    const app = criarApp();
    const modulo = await import('@main/diagnostico-gpu.js');
    modulo.prepararDiagnosticoGpu(); encerrar = modulo.encerrarDiagnosticoGpu;
    expect(app.commandLine.appendSwitch).toHaveBeenCalledWith('enable-logging', 'file');
    expect(await readdir(modulo.preparacaoGpu!.caminhoSessao)).toContain('chromium-gpu.log');
    const registrar = vi.spyOn(modulo.diagnosticoGpu!, 'registrarFalha').mockResolvedValue(null);
    app.emit('child-process-gone', {}, { type: 'Utility', reason: 'crashed', exitCode: 9 });
    expect(registrar).not.toHaveBeenCalled();
    app.emit('child-process-gone', {}, { type: 'GPU', reason: 'abnormal-exit', exitCode: 34 });
    expect(registrar).toHaveBeenCalledWith('abnormal-exit', 34);
    await encerrar();
    expect(app.listenerCount('child-process-gone')).toBe(0);
    expect(app.listenerCount('gpu-info-update')).toBe(0);
  });
});
