import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { esquemaEstadoConexaoGdl, type EstadoConexaoGdl } from '../../shared/gdl/conexao';

type Remetente = { id: number; isDestroyed: () => boolean; send: ReturnType<typeof vi.fn>; once: ReturnType<typeof vi.fn> };
type Tratador = (evento: { sender: Remetente }) => Promise<unknown>;
const handlers = new Map<string, Tratador>();
const exigir = vi.fn();
const obter = vi.fn();
const verificar = vi.fn();
const observar = vi.fn();
let notificar: () => void;
let estado: EstadoConexaoGdl;
beforeAll(async () => {
  const fonte = await readFile('src/main/ipc/handlers/gdl.handlers.ts', 'utf8');
  const codigo = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exportacoes: Record<string, unknown> = {};
  runInNewContext(codigo, { exports: exportacoes, Error, require: (modulo: string) => {
    if (modulo === 'electron') return { ipcMain: { handle: (canal: string, handler: Tratador) => handlers.set(canal, handler) } };
    if (modulo.endsWith('/auth-sessao.service.js')) return { authSessaoService: { exigir } };
    if (modulo.endsWith('/gdl-conexao.service.js')) return { conexaoGdlService: { obterEstado: obter, verificar, observar } };
    if (modulo.endsWith('/conexao.js')) return { esquemaEstadoConexaoGdl };
    return {};
  } });
  if (typeof exportacoes.registerGdlHandlers !== 'function') throw new Error('Registro de handlers indisponível');
  exportacoes.registerGdlHandlers();
});
beforeEach(() => {
  estado = { ambiente: 'producao', revisao: 0, rede: 'desconhecida', redeVerificadaEm: null,
    credenciais: 'pendentes', credenciaisValidadasEm: null, web: 'desconhecida', verificando: false };
  exigir.mockReset().mockReturnValue('usuario-a');
  obter.mockReset().mockImplementation(async () => estado);
  verificar.mockReset().mockImplementation(async () => estado);
  observar.mockImplementation((ouvinte: () => void) => { notificar = ouvinte; return () => undefined; });
});
let proximoId = 0;
const remetente = (): Remetente => ({ id: ++proximoId, isDestroyed: () => false, send: vi.fn(), once: vi.fn() });

it('exige autenticação antes de ler ou iniciar rede e valida a resposta do main', async () => {
  const evento = { sender: remetente() };
  expect(await handlers.get('gdl:obter-estado-conexao')?.(evento)).toEqual({ success: true, data: estado });
  expect(verificar).not.toHaveBeenCalled();
  expect(await handlers.get('gdl:verificar-conexao')?.(evento)).toEqual({ success: true, data: estado });
  expect(verificar).toHaveBeenCalledTimes(1);
  obter.mockResolvedValueOnce({ ...estado, rede: 'inválida', senha: 'não deve sair' });
  expect(await handlers.get('gdl:obter-estado-conexao')?.(evento)).toMatchObject({ success: false });
  exigir.mockImplementationOnce(() => { throw new Error('Sessão ausente'); });
  expect(await handlers.get('gdl:verificar-conexao')?.(evento)).toMatchObject({ success: false });
  expect(verificar).toHaveBeenCalledTimes(1);
});

it('descarta resposta quando o usuário muda durante a operação', async () => {
  exigir.mockReturnValueOnce('usuario-a').mockReturnValueOnce('usuario-b');
  expect(await handlers.get('gdl:verificar-conexao')?.({ sender: remetente() })).toMatchObject({ success: false });
});

it('envia apenas notificação de mudança e deixa de enviar para sessão encerrada', async () => {
  const janela = remetente();
  await handlers.get('gdl:obter-estado-conexao')?.({ sender: janela });
  notificar();
  expect(janela.send).toHaveBeenCalledWith('gdl:estado-conexao-alterado');
  janela.send.mockClear();
  exigir.mockImplementation(() => { throw new Error('Sessão encerrada'); });
  notificar();
  expect(janela.send).not.toHaveBeenCalled();
});
