import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { AtualizacaoService } from '../../main/services/atualizacao.service';
import type { AtualizacaoDisponivel, EstadoAtualizacao } from '../../shared/atualizacao/atualizacao.types';

const fetchOriginal = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

describe('AtualizacaoService', () => {
  it('deve iniciar em estado ocioso', () => {
    const service = new AtualizacaoService();

    expect(service.obterEstado()).toMatchObject({
      estado: 'ociosa',
      versaoInstalada: '0.1.0-test',
    });
  });

  it('deve registrar falha quando o índice não estiver disponível', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    const service = new AtualizacaoService();

    const estado = await service.verificar(true);

    expect(estado.estado).toBe('falhou');
    expect(estado.erro).toBe('Índice de atualização indisponível.');
  });

  it('deve recusar download sem uma atualização disponível', async () => {
    const service = new AtualizacaoService();

    await expect(service.baixar()).rejects.toThrow('Não há atualização disponível para download.');
  });

  it('deve recusar atualização offline com assinatura inválida', async () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-atualizacao-offline-'));
    const caminhoManifesto = path.join(diretorio, 'manifesto.json');
    fs.writeFileSync(caminhoManifesto, JSON.stringify({
      versao: '0.1.2',
      commit: 'a'.repeat(40),
      dataPublicacao: '2026-07-24T00:00:00.000Z',
      canais: ['stable'],
      versaoSchema: 1,
      requerBackupCompletoImagens: false,
      notas: 'Teste offline',
      artefatos: [{
        plataforma: 'windows', arquitetura: 'x64', formato: 'nsis', canal: 'stable',
        nome: 'laWdo-0.1.2-setup.exe', tamanho: 1, hashSha256: 'a'.repeat(64),
        url: 'https://example.invalid/laWdo-0.1.2-setup.exe',
      }],
    }), 'utf8');
    fs.writeFileSync(`${caminhoManifesto}.sig`, 'assinatura-invalida', 'utf8');
    const service = new AtualizacaoService();

    const estado = await service.carregarAtualizacaoOffline(caminhoManifesto);

    expect(estado).toMatchObject({
      estado: 'falhou',
      erro: 'Assinatura do manifesto offline inválida.',
    });
    fs.rmSync(diretorio, { recursive: true, force: true });
  });

  it('deve persistir apenas um pacote automático já validado para a próxima inicialização', () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-atualizacao-'));
    vi.mocked(app.getPath).mockReturnValue(diretorio);
    const nome = 'laWdo-0.1.2-setup.exe';
    const conteudo = Buffer.from('instalador validado');
    const hashSha256 = createHash('sha256').update(conteudo).digest('hex');
    const diretorioAtualizacoes = path.join(diretorio, 'atualizacoes');
    fs.mkdirSync(diretorioAtualizacoes, { recursive: true });
    const caminhoDownload = path.join(diretorioAtualizacoes, nome);
    fs.writeFileSync(caminhoDownload, conteudo);
    const service = new AtualizacaoService();
    const interno = service as unknown as {
      estado: EstadoAtualizacao;
      atualizacaoDisponivel: AtualizacaoDisponivel;
      caminhoDownload: string;
    };
    interno.estado = 'baixada';
    interno.caminhoDownload = caminhoDownload;
    interno.atualizacaoDisponivel = {
      versao: '0.1.2', dataPublicacao: '2026-07-24T00:00:00.000Z', notas: 'Teste', versaoSchema: 1,
      requerBackupCompletoImagens: false,
      artefato: { plataforma: 'windows', arquitetura: 'x64', formato: 'nsis', canal: 'stable', nome, tamanho: conteudo.length, hashSha256, url: 'https://example.invalid/arquivo' },
    };

    const estado = service.agendarParaProximaInicializacao();

    expect(estado.estado).toBe('aguardando_reinicio');
    expect(JSON.parse(fs.readFileSync(path.join(diretorio, 'atualizacao-pendente.json'), 'utf8'))).toMatchObject({ nome, hashSha256, versao: '0.1.2' });
    fs.rmSync(diretorio, { recursive: true, force: true });
  });
});
