import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const aplicativo = vi.hoisted(() => ({ isPackaged: false, setPath: vi.fn(), on: vi.fn() }));
vi.mock('electron', () => ({ app: aplicativo }));
import { prepararIsolamentoTesteCarga } from '../../main/utils/teste-carga';

let diretorio: string;
const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  aplicativo.isPackaged = false;
  aplicativo.setPath.mockClear();
  aplicativo.on.mockClear();
  const raiz = path.join(process.cwd(), 'tmp/teste-carga');
  mkdirSync(raiz, { recursive: true });
  diretorio = mkdtempSync(path.join(raiz, 'unitario-'));
  writeFileSync(path.join(diretorio, 'isolamento.json'), JSON.stringify({ finalidade: 'teste-carga', versao: 1 }));
  vi.stubEnv('LAWDO_TESTE_CARGA', '1');
  vi.stubEnv('LAWDO_SMOKE_JANELA', '1');
  vi.stubEnv('LAWDO_SMOKE_USER_DATA', diretorio);
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  vi.unstubAllEnvs();
  const raiz = realpathSync(path.join(process.cwd(), 'tmp/teste-carga'));
  expect(path.dirname(realpathSync(diretorio))).toBe(raiz);
  rmSync(diretorio, { recursive: true, force: true });
});

describe('isolamento do teste de carga', () => {
  it('não altera a inicialização normal', () => {
    vi.stubEnv('LAWDO_TESTE_CARGA', '');
    prepararIsolamentoTesteCarga();
    expect(aplicativo.setPath).not.toHaveBeenCalled();
    expect(globalThis.fetch).toBe(fetchOriginal);
  });

  it('recusa execução empacotada e caminhos fora da raiz', () => {
    aplicativo.isPackaged = true;
    expect(prepararIsolamentoTesteCarga).toThrow('somente em desenvolvimento');
    aplicativo.isPackaged = false;
    vi.stubEnv('LAWDO_SMOKE_USER_DATA', process.cwd());
    expect(prepararIsolamentoTesteCarga).toThrow('fora da raiz');
    expect(aplicativo.setPath).not.toHaveBeenCalled();
  });

  it('exige marcador válido antes de alterar diretórios', () => {
    writeFileSync(path.join(diretorio, 'isolamento.json'), '{}');
    expect(prepararIsolamentoTesteCarga).toThrow('não confirmado');
    expect(aplicativo.setPath).not.toHaveBeenCalled();
  });

  it('isola dados e sessão e bloqueia rede externa somente no teste', async () => {
    prepararIsolamentoTesteCarga();
    expect(aplicativo.setPath).toHaveBeenCalledWith('userData', realpathSync(diretorio));
    expect(aplicativo.setPath).toHaveBeenCalledWith('sessionData', path.join(realpathSync(diretorio), 'sessao'));
    await expect(globalThis.fetch('https://example.invalid')).rejects.toThrow('Rede externa desabilitada');
    const sessaoCriada = aplicativo.on.mock.calls.find(([evento]) => evento === 'session-created')?.[1];
    const onBeforeRequest = vi.fn();
    sessaoCriada({ webRequest: { onBeforeRequest } });
    const responder = vi.fn();
    onBeforeRequest.mock.calls[0][1]({}, responder);
    expect(responder).toHaveBeenCalledWith({ cancel: true });
  });
});
