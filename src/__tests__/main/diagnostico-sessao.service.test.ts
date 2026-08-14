import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  criarNomePipeDiagnostico,
  DiagnosticoSessaoService,
  modoDiagnosticoHabilitado,
} from '@main/services/diagnostico-sessao.service.js';

const diretorios: string[] = [];

async function criarServico(plataforma: NodeJS.Platform = 'linux'): Promise<DiagnosticoSessaoService> {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'lawdo-workspace-'));
  diretorios.push(workspace);
  return new DiagnosticoSessaoService({
    obterCaminhoWorkspace: () => workspace,
    empacotado: () => false,
    ambiente: { LAWDO_MODO_DIAGNOSTICO: '1' },
    plataforma,
    pid: 999_999_999,
    protegerArquivoWindows: vi.fn().mockResolvedValue(undefined),
  });
}

afterEach(async () => {
  await Promise.all(diretorios.splice(0).map(diretorio => rm(diretorio, { recursive: true, force: true })));
});

describe('DiagnosticoSessaoService', () => {
  it('só habilita o modo por variável explícita fora do pacote', () => {
    expect(modoDiagnosticoHabilitado(false, { LAWDO_MODO_DIAGNOSTICO: '1' })).toBe(true);
    expect(modoDiagnosticoHabilitado(true, { LAWDO_MODO_DIAGNOSTICO: '1' })).toBe(false);
    expect(modoDiagnosticoHabilitado(false, {})).toBe(false);
  });

  it('deriva um pipe estável sem abrir porta TCP', () => {
    expect(criarNomePipeDiagnostico('a'.repeat(64), 'win32', 'C:\\tmp')).toBe('\\\\.\\pipe\\lawdo-diagnostico-aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(criarNomePipeDiagnostico('a'.repeat(64), 'linux', '/tmp')).toBe('/tmp/lawdo-diagnostico-aaaaaaaaaaaaaaaaaaaaaaaa.sock');
  });

  it('cria credencial somente em arquivo e a invalida no encerramento', async () => {
    const servico = await criarServico();
    const sessao = await servico.iniciar();
    expect(sessao).not.toBeNull();
    const caminhoAtivo = path.join((servico as unknown as { caminhoRaiz: string }).caminhoRaiz, 'sessao-ativa.json');
    const descoberta = JSON.parse(await readFile(caminhoAtivo, 'utf8')) as { token: string; sessionId: string };
    expect(descoberta.token).toMatch(/^[a-f0-9]{64}$/);
    expect(descoberta.sessionId).toBe(sessao?.sessionId);
    await servico.encerrar();
    await expect(readFile(caminhoAtivo, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
