import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagnosticoSessaoService } from '@main/services/diagnostico-sessao.service.js';

const diretorios: string[] = [];

afterEach(async () => {
  await Promise.all(diretorios.splice(0).map(diretorio => rm(diretorio, { recursive: true, force: true })));
});

describe('encerramento da sessão diagnóstica', () => {
  it('remove a credencial mesmo que o registro final de evento falhe', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'lawdo-encerramento-'));
    diretorios.push(workspace);
    const servico = new DiagnosticoSessaoService({
      obterCaminhoWorkspace: () => workspace,
      empacotado: () => false,
      ambiente: { LAWDO_MODO_DIAGNOSTICO: '1' },
      plataforma: 'linux',
      pid: 999_999_999,
    });
    await servico.iniciar();
    const caminhoAtivo = path.join(workspace, 'tmp', 'diagnostico-agente', 'sessao-ativa.json');
    const eventos = servico.servicoEventos;
    if (!eventos) throw new Error('Serviço de eventos ausente');
    vi.spyOn(eventos, 'registrar').mockRejectedValue(new Error('falha simulada'));
    await expect(servico.encerrar()).rejects.toThrow('falha simulada');
    await expect(readFile(caminhoAtivo, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
