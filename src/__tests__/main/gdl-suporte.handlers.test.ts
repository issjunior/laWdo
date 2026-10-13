import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import ts from 'typescript';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { EMAIL_SUPORTE_LAWDO } from '../../shared/gdl/suporte';

const escrever = vi.fn();
const exigirSessao = vi.fn();
type TratadorSuporte = (evento: { sender: { id: number } }, ...argumentos: unknown[]) => Promise<unknown>;
const handlers = new Map<string, TratadorSuporte>();

beforeAll(async () => {
  const fonte = await readFile(path.resolve('src/main/ipc/handlers/gdl.handlers.ts'), 'utf8');
  const codigo = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exportacoes: Record<string, unknown> = {};
  runInNewContext(codigo, { exports: exportacoes, Error, require: (modulo: string) => {
    if (modulo === 'electron') return { clipboard: { writeText: escrever }, ipcMain: { handle: (canal: string, handler: TratadorSuporte) => handlers.set(canal, handler) } };
    if (modulo.endsWith('/auth-sessao.service.js')) return { authSessaoService: { exigir: exigirSessao } };
    if (modulo.endsWith('/suporte.js')) return { EMAIL_SUPORTE_LAWDO };
    return {};
  } });
  if (typeof exportacoes.registerGdlHandlers !== 'function') throw new Error('Registro de handlers indisponível');
  exportacoes.registerGdlHandlers();
});
beforeEach(() => {
  escrever.mockReset().mockResolvedValue(undefined);
  exigirSessao.mockReset().mockReturnValue('usuario-teste');
});
it('copia exclusivamente o e-mail fixo pelo processo principal', async () => {
  expect(await handlers.get('gdl:copiar-email-suporte')?.({ sender: { id: 7 } }, 'texto arbitrário')).toEqual({ success: true, data: { email: EMAIL_SUPORTE_LAWDO } });
  expect(exigirSessao).toHaveBeenCalledWith(7);
  expect(escrever).toHaveBeenCalledWith(EMAIL_SUPORTE_LAWDO);
});
it('não escreve na área de transferência sem sessão e informa falha nativa', async () => {
  exigirSessao.mockImplementationOnce(() => { throw new Error('Sessão encerrada'); });
  expect(await handlers.get('gdl:copiar-email-suporte')?.({ sender: { id: 7 } })).toEqual({ success: false, error: 'Sessão encerrada' });
  expect(escrever).not.toHaveBeenCalled();
  escrever.mockRejectedValueOnce(new Error('Área de transferência indisponível'));
  expect(await handlers.get('gdl:copiar-email-suporte')?.({ sender: { id: 7 } })).toEqual({ success: false, error: 'Área de transferência indisponível' });
});
