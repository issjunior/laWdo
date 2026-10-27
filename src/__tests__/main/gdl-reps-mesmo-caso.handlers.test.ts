import { esquemaRepsMesmoCasoGdl } from '../../shared/gdl/reps-mesmo-caso';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import ts from 'typescript';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';

const sessao = vi.fn();
const identidade = vi.fn();
const buscarLaudo = vi.fn();
const buscarRep = vi.fn();
const consultar = vi.fn();
const salvar = vi.fn();
const referencias = { ambiente: 'producao', numeroRep: '100', anoRep: '2026', numeroCaso: '42', consultadoEm: new Date().toISOString(), reps: [] };
type Tratador = (evento: { sender: { id: number } }, laudoId: unknown) => Promise<unknown>;
const handlers = new Map<string, Tratador>();

beforeAll(async () => {
  const fonte = await readFile(path.resolve('src/main/ipc/handlers/gdl.handlers.ts'), 'utf8');
  const codigo = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exportacoes: { registerGdlHandlers?: () => void } = {};
  const importar = createRequire(import.meta.url);
  runInNewContext(codigo, { Error, exports: exportacoes, require: (nome: string) => {
    if (nome === 'electron') return { ipcMain: { handle: (canal: string, tratador: Tratador) => handlers.set(canal, tratador) } };
    if (nome.endsWith('/auth-sessao.service.js')) return { authSessaoService: { exigir: sessao } };
    if (nome.endsWith('/gdl.service.js')) return { obterIdentidadeMinhasReps: identidade, consultarRepsMesmoCaso: consultar };
    if (nome.endsWith('/laudo.service.js')) return { laudoService: { findById: buscarLaudo } };
    if (nome.endsWith('/rep.service.js')) return { repService: { findById: buscarRep, salvarReferenciasMesmoCaso: salvar } };
    if (nome.endsWith('/reps-mesmo-caso.js')) return { esquemaRepsMesmoCasoGdl };
    if (nome === 'crypto') return importar(nome);
    return {};
  } });
  exportacoes.registerGdlHandlers?.();
});
beforeEach(() => {
  vi.resetAllMocks();
  sessao.mockReturnValue('usuario-1'); identidade.mockResolvedValue('conexao-1');
  buscarLaudo.mockResolvedValue({ rep_id: 'rep-1' }); buscarRep.mockResolvedValue({ numero: '100/2026' });
  consultar.mockResolvedValue(referencias);
  salvar.mockImplementation(async (_id, _numero, _referencias, validar) => validar());
});

it('deriva número/ano da REP local e retorna somente a consulta autenticada', async () => {
  expect(await handlers.get('gdl:consultar-reps-mesmo-caso')?.({ sender: { id: 7 } }, 'laudo-1'))
    .toEqual({ success: true, data: referencias });
  expect(buscarLaudo).toHaveBeenCalledWith('laudo-1');
  expect(buscarRep).toHaveBeenCalledWith('rep-1');
  expect(consultar).toHaveBeenCalledWith('100', '2026');
});

it('não consulta sem sessão ou com laudo inválido', async () => {
  sessao.mockImplementationOnce(() => { throw new Error('Sessão encerrada'); });
  expect(await handlers.get('gdl:consultar-reps-mesmo-caso')?.({ sender: { id: 7 } }, 'laudo-1')).toEqual({ success: false, error: 'Sessão encerrada' });
  expect(consultar).not.toHaveBeenCalled();
  expect(await handlers.get('gdl:consultar-reps-mesmo-caso')?.({ sender: { id: 7 } }, { numero: '999/2026' })).toEqual({ success: false, error: 'Laudo inválido.' });
  expect(consultar).not.toHaveBeenCalled();
});

it('descarta resposta se a conexão muda durante a consulta', async () => {
  identidade.mockResolvedValueOnce('conexao-1').mockResolvedValueOnce('conexao-2');
  expect(await handlers.get('gdl:consultar-reps-mesmo-caso')?.({ sender: { id: 7 } }, 'laudo-1'))
    .toEqual({ success: false, error: 'A sessão ou configuração GDL mudou. Consulte novamente.' });
});

it('persiste as referências validadas na REP local', async () => {
  await handlers.get('gdl:consultar-reps-mesmo-caso')?.({ sender: { id: 7 } }, 'laudo-1');
  expect(salvar).toHaveBeenCalledWith('rep-1', '100/2026', referencias, expect.any(Function));
});

it('não grava resposta inválida ou de outra REP', async () => {
  consultar.mockResolvedValueOnce({ ...referencias, numeroRep: '999' });
  expect(await handlers.get('gdl:consultar-reps-mesmo-caso')?.({ sender: { id: 7 } }, 'laudo-1')).toMatchObject({ success: false });
  consultar.mockResolvedValueOnce({ reps: [] });
  expect(await handlers.get('gdl:consultar-reps-mesmo-caso')?.({ sender: { id: 7 } }, 'laudo-1')).toMatchObject({ success: false });
  expect(salvar).not.toHaveBeenCalled();
});

it('descarta resposta após troca da REP ou encerramento da sessão', async () => {
  buscarLaudo.mockResolvedValueOnce({ rep_id: 'rep-1' }).mockResolvedValue({ rep_id: 'rep-2' });
  expect(await handlers.get('gdl:consultar-reps-mesmo-caso')?.({ sender: { id: 7 } }, 'laudo-1')).toMatchObject({ success: false });
  expect(salvar).not.toHaveBeenCalled();
  buscarLaudo.mockResolvedValue({ rep_id: 'rep-1' });
  sessao.mockReturnValueOnce('usuario-1').mockReturnValue('usuario-2');
  expect(await handlers.get('gdl:consultar-reps-mesmo-caso')?.({ sender: { id: 7 } }, 'laudo-1')).toMatchObject({ success: false });
  expect(salvar).not.toHaveBeenCalled();
});

it('compartilha consultas simultâneas e permite nova tentativa após falha', async () => {
  let rejeitar: (erro: Error) => void = () => undefined;
  consultar.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejeitar = reject; }));
  const executar = () => handlers.get('gdl:consultar-reps-mesmo-caso')!({ sender: { id: 7 } }, 'laudo-1');
  const primeira = executar();
  const segunda = executar();
  await vi.waitFor(() => expect(consultar).toHaveBeenCalledTimes(1));
  rejeitar(new Error('Sem rede'));
  expect(await primeira).toMatchObject({ success: false, error: 'Sem rede' });
  expect(await segunda).toMatchObject({ success: false, error: 'Sem rede' });
  expect(await executar()).toMatchObject({ success: true });
  expect(consultar).toHaveBeenCalledTimes(2);
});
