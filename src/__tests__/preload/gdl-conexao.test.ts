import type { EstadoConexaoGdl } from '@shared/gdl/conexao';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';

interface ApiConexaoGdlTeste {
  obterEstadoConexao(): Promise<unknown>;
  verificarConexao(): Promise<unknown>;
  onEstadoConexaoAlterado(callback: (estado: EstadoConexaoGdl) => void): () => void;
}

const invocar = vi.fn();
const registrar = vi.fn();
const remover = vi.fn();
const expor = vi.fn();
let api: ApiConexaoGdlTeste;

beforeAll(async () => {
  const fonte = await readFile('src/preload/index.ts', 'utf8');
  const codigo = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(codigo, {
    exports: {}, require: (modulo: string) => {
      if (modulo !== 'electron') throw new Error(`Módulo inesperado: ${modulo}`);
      return { ipcRenderer: { invoke: invocar, on: registrar, removeListener: remover, send: vi.fn() },
        contextBridge: { exposeInMainWorld: expor } };
    }, window, document, crypto: webcrypto, performance, setTimeout, clearTimeout, HTMLElement, HTMLIFrameElement, Event,
  });
  const exposicao: unknown = expor.mock.calls.find(([nome]) => nome === 'ipcAPI')?.[1];
  if (!exposicao || typeof exposicao !== 'object' || !('gdl' in exposicao)) throw new Error('API GDL não exposta');
  api = exposicao.gdl as ApiConexaoGdlTeste;
});
beforeEach(() => { invocar.mockClear().mockResolvedValue({ success: true }); registrar.mockClear(); remover.mockClear(); });

it('expõe apenas os wrappers específicos de leitura e verificação', async () => {
  await api.obterEstadoConexao();
  await api.verificarConexao();
  expect(invocar.mock.calls).toEqual([['gdl:obter-estado-conexao'], ['gdl:verificar-conexao']]);
});

it('valida o snapshot, omite o evento Electron e remove exatamente o ouvinte registrado', () => {
  const callback = vi.fn();
  const cancelar = api.onEstadoConexaoAlterado(callback);
  expect(registrar).toHaveBeenCalledWith('gdl:estado-conexao-alterado', expect.any(Function));
  const ouvinte: unknown = registrar.mock.calls[0]?.[1];
  if (typeof ouvinte !== 'function') throw new Error('Ouvinte não registrado');
  ouvinte({ sender: 'não exposto' }, { dado: 'ignorado' });
  expect(callback).not.toHaveBeenCalled();
  const estado: EstadoConexaoGdl = { ambiente: 'producao', revisao: 0, versaoEstado: 1,
    rede: 'acessivel', redeVerificadaEm: null, credenciais: 'pendentes', credenciaisValidadasEm: null,
    web: 'disponivel', verificando: false };
  ouvinte({ sender: 'não exposto' }, estado);
  expect(callback.mock.calls).toEqual([[estado]]);
  ouvinte({}, { ...estado, versaoEstado: -1 });
  ouvinte({}, { ...estado, acessoAutenticado: { resultado: 'inventado' } });
  ouvinte({}, { ...estado, ultimoTesteRede: { sucesso: true, verificadoEm: new Date().toISOString(), duracaoMs: -1 } });
  expect(callback).toHaveBeenCalledTimes(1);
  const comTeste = { ...estado, ultimoTesteRede: { sucesso: true, verificadoEm: new Date().toISOString(), duracaoMs: 218 } };
  ouvinte({}, comTeste);
  expect(callback).toHaveBeenLastCalledWith(comTeste);
  cancelar();
  expect(remover).toHaveBeenCalledWith('gdl:estado-conexao-alterado', ouvinte);
});
