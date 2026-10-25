import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const simulacao = vi.hoisted(() => ({ obter: vi.fn(), requisitar: vi.fn() }));
vi.mock('electron', () => ({
  app: { getPath: () => path.join(os.tmpdir(), 'lawdo-conexao-integracao') }, nativeImage: {},
  session: {
    defaultSession: { fetch: simulacao.requisitar, setCertificateVerifyProc: vi.fn() },
    fromPartition: () => ({ fetch: simulacao.requisitar, setCertificateVerifyProc: vi.fn(),
      clearStorageData: vi.fn().mockResolvedValue(undefined), webRequest: { onBeforeRequest: vi.fn() } }),
  },
}));
vi.mock('../../main/services/configuracao.service.js', () => ({ configuracaoService: { obter: simulacao.obter } }));
vi.mock('../../main/utils/logger.js', () => ({ getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { conexaoGdlService } from '../../main/services/gdl-conexao.service';
import { consultarRep, limparValidacaoSessao, obterValidacaoSessao, validarCredenciais } from '../../main/services/gdl.service';
import { listarPaginaMinhasRepsGdl } from '../../main/services/gdl-pagina.service';
import { notificarContextoGdlAlterado } from '../../main/services/gdl-agendamento-eventos.service';
import { aparenciaConexaoGdl } from '../../shared/gdl/conexao';

const configuracao = new Map<string, string>();
const fixture = fs.readFileSync(path.resolve('src/__tests__/fixtures/gdl/rep-190-2026.json'), 'utf8');
const credenciais = { login: 'usuario', senha: 'senha-simulada', baseUrl: 'https://gdl.exemplo/api' };
beforeEach(() => {
  configuracao.clear();
  configuracao.set('gdl_ambiente', 'producao');
  configuracao.set('gdl_url_producao', credenciais.baseUrl);
  configuracao.set('gdl_login_producao', credenciais.login);
  configuracao.set('gdl_senha_producao', credenciais.senha);
  simulacao.obter.mockReset().mockImplementation(async (chave: string) => configuracao.get(chave) ?? null);
  simulacao.requisitar.mockReset().mockImplementation(async () => new Response('[]', { status: 200 }));
  limparValidacaoSessao('producao');
  conexaoGdlService.contextoAlterado();
});

describe('observação das operações GDL existentes', () => {
  it('monitor faz somente uma leitura sem autenticação, mesmo sem configuração de credenciais', async () => {
    configuracao.delete('gdl_login_producao');
    configuracao.delete('gdl_senha_producao');
    expect(await conexaoGdlService.verificar()).toMatchObject({ rede: 'acessivel', credenciais: 'ausentes' });
    expect(simulacao.requisitar).toHaveBeenCalledTimes(1);
    expect(simulacao.requisitar).toHaveBeenCalledWith('https://gdl.exemplo/api/unidadesMedida', expect.objectContaining({
      method: 'GET', redirect: 'manual', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, signal: expect.any(AbortSignal),
    }));
  });

  it('HTTP 401 da checagem de rede não rejeita credenciais e uma checagem positiva não apaga rejeição real', async () => {
    simulacao.requisitar.mockImplementation(async () => new Response('', { status: 401 }));
    expect(await conexaoGdlService.verificar()).toMatchObject({ rede: 'acessivel', credenciais: 'pendentes' });
    await validarCredenciais('producao', credenciais, '190', '2026');
    expect((await conexaoGdlService.obterEstado()).credenciais).toBe('rejeitadas');
    simulacao.requisitar.mockImplementation(async () => new Response('[]', { status: 200 }));
    expect(await conexaoGdlService.verificar()).toMatchObject({ rede: 'acessivel', credenciais: 'rejeitadas' });
  });

  it('consulta autenticada atualiza credenciais; REP inexistente e JSON inválido não indicam queda', async () => {
    simulacao.requisitar.mockImplementation(async () => new Response(fixture, { status: 200 }));
    expect((await validarCredenciais('producao', credenciais, '190', '2026')).sucesso).toBe(true);
    expect(aparenciaConexaoGdl(await conexaoGdlService.obterEstado())).toBe('disponivel');
    simulacao.requisitar.mockImplementation(async () => new Response('', { status: 404 }));
    expect((await consultarRep('999', '2026')).erro).toContain('não encontrada');
    expect(aparenciaConexaoGdl(await conexaoGdlService.obterEstado())).toBe('disponivel');
    simulacao.requisitar.mockImplementation(async () => new Response('conteúdo inválido', { status: 200 }));
    expect((await consultarRep('190', '2026')).sucesso).toBe(false);
    expect(aparenciaConexaoGdl(await conexaoGdlService.obterEstado())).toBe('disponivel');
  });

  it('falha no acesso web não derruba a API e não é apagada pelo monitor de rede', async () => {
    simulacao.requisitar.mockImplementationOnce(async () => new Response(fixture, { status: 200 }));
    await validarCredenciais('producao', credenciais, '190', '2026');
    simulacao.requisitar.mockImplementationOnce(async () => new Response('', { status: 503 }));
    await expect(listarPaginaMinhasRepsGdl(credenciais, 1, () => undefined)).rejects.toThrow();
    expect(await conexaoGdlService.verificar()).toMatchObject({ rede: 'acessivel', credenciais: 'validadas', web: 'atencao' });
  });

  it('permissão específica HTTP 403 não invalida evidência de autenticação da API', async () => {
    simulacao.requisitar.mockImplementationOnce(async () => new Response(fixture, { status: 200 }));
    await validarCredenciais('producao', credenciais, '190', '2026');
    simulacao.requisitar.mockImplementationOnce(async () => new Response('', { status: 403 }));
    await consultarRep('190', '2026');
    expect(await conexaoGdlService.obterEstado()).toMatchObject({ rede: 'acessivel', credenciais: 'validadas' });
  });

  it('alteração de credenciais descarta validação e resposta de autenticação em andamento', async () => {
    let concluir!: (resposta: Response) => void;
    simulacao.requisitar.mockImplementationOnce(() => new Promise(resolver => { concluir = resolver; }));
    const pendente = validarCredenciais('producao', credenciais, '190', '2026');
    await vi.waitFor(() => expect(concluir).toBeTypeOf('function'));
    configuracao.set('gdl_senha_producao', 'outra-senha');
    notificarContextoGdlAlterado('gdl_senha_producao');
    expect(await conexaoGdlService.obterEstado()).toMatchObject({ rede: 'desconhecida', credenciais: 'pendentes' });
    concluir(new Response(fixture, { status: 200 }));
    await pendente;
    expect(await conexaoGdlService.obterEstado()).toMatchObject({ rede: 'desconhecida', credenciais: 'pendentes' });
    expect(obterValidacaoSessao('producao').validado).toBe(false);
  });

  it('trata timeout e falhas de servidor como indisponibilidade', async () => {
    simulacao.requisitar.mockRejectedValueOnce(new Error('Timeout'));
    expect((await conexaoGdlService.verificar()).rede).toBe('indisponivel');
    simulacao.requisitar.mockImplementationOnce(async () => new Response('', { status: 503 }));
    expect((await conexaoGdlService.verificar()).rede).toBe('indisponivel');
  });

  it('interrompe a checagem em cinco segundos sem consultar REPs', async () => {
    vi.useFakeTimers();
    try {
      let sinal: AbortSignal | undefined;
      simulacao.requisitar.mockImplementationOnce((_url: string, opcoes: RequestInit) => new Promise((_resolver, rejeitar) => {
        sinal = opcoes.signal ?? undefined;
        sinal?.addEventListener('abort', () => rejeitar(new Error('Operação abortada')), { once: true });
      }));
      const pendente = conexaoGdlService.verificar();
      await vi.advanceTimersByTimeAsync(0);
      expect(sinal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(4999);
      expect(sinal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(sinal?.aborted).toBe(true);
      expect((await pendente).rede).toBe('indisponivel');
      expect(simulacao.requisitar).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
});
