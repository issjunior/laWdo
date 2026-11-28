import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app, shell } from 'electron';
import { AtualizacaoService } from '../../main/services/atualizacao.service';
import type { ArtefatoAtualizacao, AtualizacaoDisponivel, EstadoAtualizacao, ManifestoAtualizacao, PlataformaAtualizacao } from '../../shared/atualizacao/atualizacao.types';

const mocks = vi.hoisted(() => ({ verificarAssinatura: vi.fn(() => true) }));

vi.mock('node:crypto', async importarOriginal => ({
  ...await importarOriginal<typeof import('node:crypto')>(),
  verify: mocks.verificarAssinatura,
}));

const fetchOriginal = globalThis.fetch;
const assinaturaValidaTeste = Buffer.alloc(64).toString('base64');

function criarManifestoAssinado(atualizacao: AtualizacaoDisponivel): { manifesto: ManifestoAtualizacao; assinatura: string } {
  return {
    manifesto: {
      versaoManifesto: 1,
      versao: atualizacao.versao,
      commit: 'a'.repeat(40),
      dataPublicacao: atualizacao.dataPublicacao,
      canais: ['stable'],
      versaoSchema: atualizacao.versaoSchema,
      requerBackupCompletoImagens: atualizacao.requerBackupCompletoImagens,
      notas: atualizacao.notas,
      artefatos: [atualizacao.artefato],
    },
    assinatura: assinaturaValidaTeste,
  };
}

function obterPlataformaAtualizacaoTeste(): PlataformaAtualizacao {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

function criarArtefatoCompativelComRunner(nome: string, tamanho: number, hashSha256: string): ArtefatoAtualizacao {
  const plataforma = obterPlataformaAtualizacaoTeste();

  return {
    plataforma,
    arquitetura: process.arch === 'arm64' ? 'arm64' : 'x64',
    formato: plataforma === 'windows' ? 'nsis' : plataforma === 'macos' ? 'dmg' : 'AppImage',
    canal: 'stable',
    nome,
    tamanho,
    hashSha256,
    url: 'https://example.invalid/arquivo',
  };
}

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  mocks.verificarAssinatura.mockReset();
  mocks.verificarAssinatura.mockReturnValue(true);
});

describe('AtualizacaoService', () => {
  it('deve iniciar em estado ocioso', () => {
    const service = new AtualizacaoService();

    expect(service.obterEstado()).toMatchObject({
      estado: 'ociosa',
      versaoInstalada: '0.1.0-test',
    });
  });

  it('deve registrar falha amigável quando o índice não estiver disponível', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    const service = new AtualizacaoService();

    const estado = await service.verificar(true);

    expect(estado.estado).toBe('falhou');
    expect(estado.falha).toMatchObject({
      codigo: 'RECURSO_INDISPONIVEL',
      etapa: 'verificacao',
      acaoSugerida: 'verificar',
    });
    expect(estado.falha?.mensagem).not.toContain('Índice de atualização indisponível');
  });

  it('deve explicar falha de rede sem expor a mensagem bruta do fetch', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed', {
      cause: { code: 'ENOTFOUND' },
    }));
    const service = new AtualizacaoService();

    const estado = await service.verificar(true);

    expect(estado.falha).toMatchObject({
      codigo: 'REDE_INDISPONIVEL',
      mensagem: expect.stringContaining('não conseguiu acessar o servidor de atualizações'),
      detalheTecnico: expect.stringContaining('fetch failed'),
    });
  });

  it('deve recusar download sem uma atualização disponível', async () => {
    const service = new AtualizacaoService();

    await expect(service.baixar()).rejects.toThrow('Não há atualização disponível para download.');
  });

  it('deve publicar progresso crescente durante o download e a validação', async () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-progresso-atualizacao-'));
    vi.mocked(app.getPath).mockReturnValue(diretorio);
    const conteudo = Buffer.from('pacote de atualização válido');
    const service = new AtualizacaoService();
    const interno = service as unknown as {
      estado: EstadoAtualizacao;
      atualizacaoDisponivel: AtualizacaoDisponivel;
      manifestoAssinado: { manifesto: ManifestoAtualizacao; assinatura: string };
    };
    interno.estado = 'disponivel';
    interno.atualizacaoDisponivel = {
      versao: '0.1.2', dataPublicacao: '2026-07-24T00:00:00.000Z', notas: 'Teste', versaoSchema: 1,
      requerBackupCompletoImagens: false,
      artefato: {
        plataforma: 'windows', arquitetura: 'x64', formato: 'nsis', canal: 'stable', nome: 'laWdo-0.1.2-setup.exe',
        tamanho: conteudo.length, hashSha256: createHash('sha256').update(conteudo).digest('hex'), url: 'https://example.invalid/arquivo',
      },
    };
    interno.manifestoAssinado = criarManifestoAssinado(interno.atualizacaoDisponivel);
    const percentuais: number[] = [];
    service.onProgresso(progresso => percentuais.push(progresso.percentual));
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(conteudo));

    const estado = await service.baixar();

    expect(estado.estado).toBe('baixada');
    expect(percentuais[0]).toBe(0);
    expect(percentuais.at(-1)).toBe(100);
    expect(percentuais.every((valor, indice) => indice === 0 || valor >= percentuais[indice - 1])).toBe(true);
    expect(fs.existsSync(path.join(diretorio, 'atualizacao-pacote-pronto.json'))).toBe(true);
    fs.rmSync(diretorio, { recursive: true, force: true });
  });

  it('deve restaurar o pacote validado após reiniciar o aplicativo', () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-pacote-pronto-'));
    vi.mocked(app.getPath).mockReturnValue(diretorio);
    const plataforma = obterPlataformaAtualizacaoTeste();
    const nome = plataforma === 'windows' ? 'laWdo-0.1.2-setup.exe' : plataforma === 'macos' ? 'laWdo-0.1.2.dmg' : 'laWdo-0.1.2.AppImage';
    const conteudo = Buffer.from('instalador validado');
    const hashSha256 = createHash('sha256').update(conteudo).digest('hex');
    const diretorioAtualizacoes = path.join(diretorio, 'atualizacoes');
    fs.mkdirSync(diretorioAtualizacoes, { recursive: true });
    fs.writeFileSync(path.join(diretorioAtualizacoes, nome), conteudo);
    const atualizacao: AtualizacaoDisponivel = {
      versao: '0.1.2', dataPublicacao: '2026-07-24T00:00:00.000Z', notas: 'Teste', versaoSchema: 1,
      requerBackupCompletoImagens: false,
      artefato: criarArtefatoCompativelComRunner(nome, conteudo.length, hashSha256),
    };
    fs.writeFileSync(path.join(diretorio, 'atualizacao-pacote-pronto.json'), JSON.stringify(criarManifestoAssinado(atualizacao)));

    const service = new AtualizacaoService();

    expect(service.obterEstado()).toMatchObject({ estado: 'baixada', atualizacaoDisponivel: { versao: '0.1.2' } });
    expect(mocks.verificarAssinatura).toHaveBeenCalledTimes(1);
    fs.rmSync(diretorio, { recursive: true, force: true });
  });

  it('descarta o pacote alterado depois do reinício', () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-pacote-modificado-'));
    vi.mocked(app.getPath).mockReturnValue(diretorio);
    const plataforma = obterPlataformaAtualizacaoTeste();
    const nome = plataforma === 'windows' ? 'laWdo-0.1.2-setup.exe' : plataforma === 'macos' ? 'laWdo-0.1.2.dmg' : 'laWdo-0.1.2.AppImage';
    const conteudoOriginal = Buffer.from('instalador validado');
    const diretorioAtualizacoes = path.join(diretorio, 'atualizacoes');
    fs.mkdirSync(diretorioAtualizacoes, { recursive: true });
    fs.writeFileSync(path.join(diretorioAtualizacoes, nome), Buffer.from('instalador adulterado'));
    const atualizacao: AtualizacaoDisponivel = {
      versao: '0.1.2', dataPublicacao: '2026-07-24T00:00:00.000Z', notas: 'Teste', versaoSchema: 1,
      requerBackupCompletoImagens: false,
      artefato: criarArtefatoCompativelComRunner(nome, conteudoOriginal.length, createHash('sha256').update(conteudoOriginal).digest('hex')),
    };
    fs.writeFileSync(path.join(diretorio, 'atualizacao-pacote-pronto.json'), JSON.stringify(criarManifestoAssinado(atualizacao)));

    const service = new AtualizacaoService();

    expect(service.obterEstado().estado).toBe('ociosa');
    expect(fs.existsSync(path.join(diretorio, 'atualizacao-pacote-pronto.json'))).toBe(false);
    fs.rmSync(diretorio, { recursive: true, force: true });
  });

  it('descarta pacote persistido sem uma assinatura válida após reiniciar', () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-pacote-adulterado-'));
    vi.mocked(app.getPath).mockReturnValue(diretorio);
    fs.writeFileSync(path.join(diretorio, 'atualizacao-pacote-pronto.json'), JSON.stringify({ atualizacao: {} }));

    const service = new AtualizacaoService();

    expect(service.obterEstado().estado).toBe('ociosa');
    expect(fs.existsSync(path.join(diretorio, 'atualizacao-pacote-pronto.json'))).toBe(false);
    fs.rmSync(diretorio, { recursive: true, force: true });
  });

  it('não executa uma atualização agendada sem manifesto assinado após reiniciar', async () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-pendencia-adulterada-'));
    vi.mocked(app.getPath).mockReturnValue(diretorio);
    fs.writeFileSync(path.join(diretorio, 'atualizacao-pendente.json'), JSON.stringify({
      formato: 'nsis', nome: 'laWdo-0.1.2-setup.exe', tamanho: 1, hashSha256: 'a'.repeat(64), versao: '0.1.2',
    }));

    const service = new AtualizacaoService();

    await expect(service.processarPendenciaInicializacao()).resolves.toBe(false);
    expect(shell.openPath).not.toHaveBeenCalled();
    fs.rmSync(diretorio, { recursive: true, force: true });
  });

  it('deve manter o aplicativo aberto quando o Windows não conseguir abrir o instalador', async () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-instalador-'));
    vi.mocked(app.getPath).mockReturnValue(diretorio);
    const nome = 'laWdo-0.1.2-setup.exe';
    const conteudo = Buffer.from('instalador validado');
    const hashSha256 = createHash('sha256').update(conteudo).digest('hex');
    const diretorioAtualizacoes = path.join(diretorio, 'atualizacoes');
    fs.mkdirSync(diretorioAtualizacoes, { recursive: true });
    const caminho = path.join(diretorioAtualizacoes, nome);
    fs.writeFileSync(caminho, conteudo);
    vi.mocked(shell.openPath).mockResolvedValueOnce('Acesso negado');
    const service = new AtualizacaoService();
    const interno = service as unknown as { executarInstalador: (artefato: AtualizacaoDisponivel['artefato'], caminhoArquivo: string) => Promise<void> };

    await expect(interno.executarInstalador({
      plataforma: 'windows', arquitetura: 'x64', formato: 'nsis', canal: 'stable', nome, tamanho: conteudo.length, hashSha256, url: 'https://example.invalid/arquivo',
    }, caminho)).rejects.toThrow('Não foi possível abrir o instalador');

    expect(app.quit).not.toHaveBeenCalled();
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
      manifestoAssinado: { manifesto: ManifestoAtualizacao; assinatura: string };
    };
    interno.estado = 'baixada';
    interno.caminhoDownload = caminhoDownload;
    interno.atualizacaoDisponivel = {
      versao: '0.1.2', dataPublicacao: '2026-07-24T00:00:00.000Z', notas: 'Teste', versaoSchema: 1,
      requerBackupCompletoImagens: false,
      artefato: { plataforma: 'windows', arquitetura: 'x64', formato: 'nsis', canal: 'stable', nome, tamanho: conteudo.length, hashSha256, url: 'https://example.invalid/arquivo' },
    };
    interno.manifestoAssinado = criarManifestoAssinado(interno.atualizacaoDisponivel);

    const estado = service.agendarParaProximaInicializacao();

    expect(estado.estado).toBe('aguardando_reinicio');
    expect(JSON.parse(fs.readFileSync(path.join(diretorio, 'atualizacao-pendente.json'), 'utf8'))).toMatchObject({ assinatura: assinaturaValidaTeste, manifesto: { versao: '0.1.2', artefatos: [expect.objectContaining({ nome, hashSha256 })] } });
    fs.rmSync(diretorio, { recursive: true, force: true });
  });

  it('deve persistir a data da última verificação entre inicializações', () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-ultima-verificacao-'));
    vi.mocked(app.getPath).mockReturnValue(diretorio);
    const service = new AtualizacaoService();
    const interno = service as unknown as { registrarUltimaVerificacao: () => void };

    interno.registrarUltimaVerificacao();

    const reiniciado = new AtualizacaoService();
    expect(reiniciado.obterEstado().verificadoEm).toBe(service.obterEstado().verificadoEm);
    fs.rmSync(diretorio, { recursive: true, force: true });
  });
});
