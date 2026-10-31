import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultadoImportacaoTemplate } from '../../shared/types/importacao-template.types';

const simulacao = vi.hoisted(() => ({ criar: vi.fn() }));
vi.mock('worker_threads', () => {
  const Worker = vi.fn(class {
    constructor() { return simulacao.criar(); }
  });
  return { Worker, default: { Worker } };
});

import { importarDocumento } from '../../main/services/importacao.service';

const resultado: ResultadoImportacaoTemplate = {
  nomeArquivo: 'Documento sintético', formato: 'docx',
  secoes: [{ id: 'secao', nome: 'Exame', conteudo: '<p>Texto</p>', incluir: true }],
  avisos: [], resumo: { tabelas: 0, figuras: 0 },
};

let trabalhador: EventEmitter & { terminate: ReturnType<typeof vi.fn> };
beforeEach(() => {
  vi.useFakeTimers();
  simulacao.criar.mockImplementation(() => {
    trabalhador = Object.assign(new EventEmitter(), { terminate: vi.fn().mockResolvedValue(0) });
    return trabalhador;
  });
});
afterEach(() => vi.useRealTimers());

async function conferirNovaTentativa() {
  const tentativa = importarDocumento('nova-tentativa.docx');
  trabalhador.emit('message', { success: true, data: resultado });
  await expect(tentativa).resolves.toEqual(resultado);
  expect(vi.getTimerCount()).toBe(0);
}

describe('ciclo do leitor isolado de documentos', () => {
  it('recusa concorrência e ignora encerramento tardio após entregar o resultado', async () => {
    const primeira = importarDocumento('primeiro.docx');
    await expect(importarDocumento('concorrente.docx')).rejects.toThrow('já está em andamento');
    expect(simulacao.criar).toHaveBeenCalledTimes(1);
    trabalhador.emit('message', { success: true, data: resultado });
    trabalhador.emit('exit', 0);
    await expect(primeira).resolves.toEqual(resultado);
    expect(trabalhador.terminate).toHaveBeenCalledTimes(1);
    await conferirNovaTentativa();
  });

  it.each([
    { evento: 'message', dado: { success: true, data: { ...resultado, resumo: { tabelas: -1, figuras: 0 } } }, erro: 'Resposta inválida' },
    { evento: 'message', dado: { success: false, error: 'Documento corrompido' }, erro: 'Documento corrompido' },
    { evento: 'error', dado: new Error('Falha interna'), erro: 'Falha no leitor' },
    { evento: 'exit', dado: 1, erro: 'encerrado sem resultado' },
  ])('libera nova tentativa após $evento: $erro', async ({ evento, dado, erro }) => {
    const tentativa = importarDocumento('invalido.docx');
    const rejeicao = expect(tentativa).rejects.toThrow(erro);
    trabalhador.emit(evento, dado);
    await rejeicao;
    expect(trabalhador.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await conferirNovaTentativa();
  });

  it('interrompe no limite exato, ignora resposta antiga e recupera o bloqueio', async () => {
    const tentativa = importarDocumento('lento.docx');
    const antigo = trabalhador;
    const rejeicao = expect(tentativa).rejects.toThrow('excedeu 60 segundos');
    await vi.advanceTimersByTimeAsync(59_999);
    expect(trabalhador.terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await rejeicao;
    expect(antigo.terminate).toHaveBeenCalledTimes(1);
    const nova = importarDocumento('nova-tentativa.docx');
    antigo.emit('message', { success: true, data: resultado });
    await expect(importarDocumento('concorrente.docx')).rejects.toThrow('já está em andamento');
    trabalhador.emit('message', { success: true, data: resultado });
    await expect(nova).resolves.toEqual(resultado);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('recupera o bloqueio se nem conseguir criar o worker', async () => {
    simulacao.criar.mockImplementationOnce(() => { throw new Error('Sem recursos'); });
    await expect(importarDocumento('arquivo.docx')).rejects.toThrow('Sem recursos');
    await conferirNovaTentativa();
  });
});
