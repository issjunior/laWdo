import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import ts from 'typescript';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const electronSimulado = ({
  enviar: vi.fn(),
  invocar: vi.fn(),
  registrar: vi.fn(),
  expor: vi.fn(),
});

interface ApiTeste {
  laudo: { selecionarBkp(): Promise<unknown> };
  gdl: { copiarEmailSuporte(): Promise<unknown>; atualizarMinhasRepsCache(forcar: boolean): Promise<unknown> };
  configuracao: { obter(chave: string): Promise<unknown> };
}

let ipcAPI: ApiTeste;

function eventosDiagnosticos(): Array<Record<string, unknown>> {
  return electronSimulado.enviar.mock.calls
    .filter(([canal]) => canal === 'diagnostico:registrar-evento')
    .map(([, evento]) => evento as Record<string, unknown>);
}

describe('classificação do resultado IPC no preload', () => {
  beforeAll(async () => {
    const fonte = await readFile(path.resolve('src/preload/index.ts'), 'utf8');
    const codigo = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(codigo, {
      exports: {},
      require: (modulo: string) => {
        if (modulo !== 'electron') throw new Error(`Módulo inesperado: ${modulo}`);
        return {
          ipcRenderer: { send: electronSimulado.enviar, invoke: electronSimulado.invocar, on: electronSimulado.registrar },
          contextBridge: { exposeInMainWorld: electronSimulado.expor },
        };
      },
      window,
      document,
      crypto: webcrypto,
      performance,
      setTimeout,
      clearTimeout,
      HTMLElement,
      HTMLIFrameElement,
      Event,
    });
    const exposicao = electronSimulado.expor.mock.calls.find(([nome]) => nome === 'ipcAPI');
    if (!exposicao) throw new Error('API IPC não exposta');
    ipcAPI = exposicao[1] as ApiTeste;
  });

  beforeEach(() => {
    electronSimulado.enviar.mockClear();
    electronSimulado.invocar.mockReset();
  });

  it('preserva a resposta positiva e registra um único desfecho correlacionado', async () => {
    const resposta = { success: true, data: 'valor' };
    electronSimulado.invocar.mockResolvedValue(resposta);

    expect(await ipcAPI.configuracao.obter('teste')).toBe(resposta);

    const eventos = eventosDiagnosticos();
    expect(eventos).toHaveLength(2);
    expect(eventos[0]).toMatchObject({ fase: 'inicio', canal: 'configuracao:obter' });
    expect(eventos[1]).toMatchObject({ fase: 'sucesso', resultadoFuncional: 'sucesso', canal: 'configuracao:obter', correlacaoId: eventos[0]?.correlacaoId });
  });

  it('expõe somente a ação específica para copiar o e-mail sem argumentos', async () => {
    electronSimulado.invocar.mockResolvedValue({ success: true });
    await ipcAPI.gdl.copiarEmailSuporte();
    expect(electronSimulado.invocar).toHaveBeenCalledWith('gdl:copiar-email-suporte');
  });

  it('registra resposta negativa como falha funcional sem rejeitar a chamada', async () => {
    const resposta = { success: false, error: 'detalhe sensível' };
    electronSimulado.invocar.mockResolvedValue(resposta);

    expect(await ipcAPI.configuracao.obter('teste')).toBe(resposta);

    const eventos = eventosDiagnosticos();
    expect(eventos).toHaveLength(2);
    expect(eventos[1]).toMatchObject({ fase: 'falha_funcional', resultadoFuncional: 'falha', correlacaoId: eventos[0]?.correlacaoId });
    expect(JSON.stringify(eventos)).not.toContain('detalhe sensível');
    expect(electronSimulado.enviar).toHaveBeenCalledWith('desempenho:registrar', expect.objectContaining({
      evento: 'falhou', metadados: expect.objectContaining({ sucesso: false, falhou: true }),
    }));
  });

  it.each([null, 'pong', { success: 'false' }, { data: 1 }])('classifica resposta sem envelope válido como indeterminada: %s', async resposta => {
    electronSimulado.invocar.mockResolvedValue(resposta);

    expect(await ipcAPI.configuracao.obter('teste')).toBe(resposta);

    const eventos = eventosDiagnosticos();
    expect(eventos).toHaveLength(2);
    expect(eventos[1]).toMatchObject({ fase: 'resposta_indeterminada', resultadoFuncional: 'indeterminado', correlacaoId: eventos[0]?.correlacaoId });
    expect(electronSimulado.enviar.mock.calls.filter(([canal, evento]) => canal === 'desempenho:registrar' && evento.evento === 'falhou')).toHaveLength(0);
  });

  it('preserva a rejeição e registra falha de transporte sem expor a mensagem', async () => {
    const erro = new Error('detalhe sensível');
    electronSimulado.invocar.mockRejectedValue(erro);

    await expect(ipcAPI.configuracao.obter('teste')).rejects.toBe(erro);

    const eventos = eventosDiagnosticos();
    expect(eventos).toHaveLength(2);
    expect(eventos[1]).toMatchObject({ fase: 'erro', resultadoFuncional: 'indeterminado', tipoFalha: 'transporte', correlacaoId: eventos[0]?.correlacaoId });
    expect(JSON.stringify(eventos)).not.toContain('detalhe sensível');
    expect(electronSimulado.enviar).toHaveBeenCalledWith('desempenho:registrar', expect.objectContaining({
      evento: 'falhou', metadados: expect.objectContaining({ sucesso: false, falhou: true }),
    }));
  });
  it('registra somente metadados seguros de falha GDL junto ao desfecho correlacionado', async () => {
    const referencia = '12e30e43-780b-4891-bef6-f149baeb5d4b';
    electronSimulado.invocar.mockResolvedValue({ success: false, error: 'senha=segredo', falha: {
      codigo: 'rede', etapa: 'carregar_formulario', codigoSistema: 'ECONNREFUSED', referencia,
      bloqueioTemporario: true, tentarNovamenteEmSegundos: 42,
      detalhes: 'https://usuario:segredo@servidor', token: 'segredo',
    } });
    await ipcAPI.gdl.atualizarMinhasRepsCache(true);
    const eventos = eventosDiagnosticos();
    expect(eventos[1]).toMatchObject({ fase: 'falha_funcional', falha: { codigo: 'rede', etapa: 'carregar_formulario', codigoSistema: 'ECONNREFUSED', referencia, bloqueioTemporario: true, tentarNovamenteEmSegundos: 42 }, correlacaoId: eventos[0]?.correlacaoId });
    expect(JSON.stringify(eventos)).not.toMatch(/segredo|https:/);
  });

  it('descarta classificações e campos técnicos externos não reconhecidos', async () => {
    electronSimulado.invocar.mockResolvedValue({ success: false, falha: { codigo: 'externo', etapa: 'segredo', codigoSistema: 'segredo' } });
    await ipcAPI.gdl.atualizarMinhasRepsCache(true);
    expect(eventosDiagnosticos()[1]).not.toHaveProperty('falha');
  });

it('preserva cancelamento explícito sem classificá-lo como falha', async () => {
  const resposta = { success: false, canceled: true };
  electronSimulado.invocar.mockResolvedValue(resposta);
  expect(await ipcAPI.laudo.selecionarBkp()).toBe(resposta);
  expect(eventosDiagnosticos().at(-1)).toMatchObject({ fase: 'cancelado', resultadoFuncional: 'cancelado' });
});

it.each([
  { success: false, error: 'Operação cancelada' },
  { success: false, canceled: 'true' },
  { success: false, canceled: true, error: 'Falha real' },
])('não infere cancelamento por texto ou contrato inválido: %s', async resposta => {
  electronSimulado.invocar.mockResolvedValue(resposta);
  await ipcAPI.laudo.selecionarBkp();
  expect(eventosDiagnosticos().at(-1)).toMatchObject({ resultadoFuncional: 'falha' });
});

it('aceita a condição institucional somente com metadados técnicos GDL válidos', async () => {
  electronSimulado.invocar.mockResolvedValue({ success: false, falha: {
    codigo: 'rede', etapa: 'rede_gdl', codigoSistema: 'ENOTFOUND', referencia: 'f0d43c3b-5ff8-4e40-bef2-09444f6693ca', condicaoEsperada: 'acesso_rede_institucional',
  } });
  await ipcAPI.gdl.atualizarMinhasRepsCache(false);
  expect(eventosDiagnosticos().at(-1)).toMatchObject({ fase: 'indisponivel', resultadoFuncional: 'indisponivel' });
});

  it('mantém HTTP 503 como falha mesmo quando a consulta de conectividade usa envelope positivo', async () => {
    electronSimulado.invocar.mockResolvedValue({ success: true, data: { sucesso: false }, falha: {
      codigo: 'servidor', etapa: 'rede_gdl', statusHttp: 503, referencia: 'f0d43c3b-5ff8-4e40-bef2-09444f6693ca',
    } });
    await ipcAPI.gdl.atualizarMinhasRepsCache(false);
    expect(eventosDiagnosticos().at(-1)).toMatchObject({ resultadoFuncional: 'falha' });
  });

  it('mantém o catálogo de diálogos do preload alinhado ao compartilhado', async () => {
    const { CANAIS_COM_INTERACAO_USUARIO } = await import('../../shared/diagnostico/canais');
    const fonte = await readFile(path.resolve('src/preload/index.ts'), 'utf8');
    const catalogo = fonte.match(/const interacaoUsuario = (\[[^;]+\]).includes\(canal\)/)?.[1];
    expect(catalogo?.match(/'([^']+)'/g)?.map(item => item.slice(1, -1))).toEqual([...CANAIS_COM_INTERACAO_USUARIO]);
  });

});
