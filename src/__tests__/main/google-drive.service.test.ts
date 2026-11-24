import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { shell } from 'electron';

const mocks = vi.hoisted(() => ({
  salvarConfiguracao: vi.fn(), consultarBanco: vi.fn(),
  exportarBkp: vi.fn(async (_laudoId: string, destino: string) => writeFile(destino, 'pacote válido')),
  lerBkp: vi.fn(async () => ({ rep: { numero: '2026/00109026' }, tipoExame: { codigo: 'T', nome: 'Teste' }, laudo: { status: 'Concluído' }, imagens: [] })),
  cifrar: vi.fn(async (_origem: string, destino: string) => writeFile(destino, 'pacote cifrado')),
  decifrar: vi.fn(async (_origem: string, destino: string) => writeFile(destino, 'pacote decifrado')),
  validarJwt: vi.fn(),
  obterConfiguracao: vi.fn(),
  executarBanco: vi.fn(),
}));

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => os.tmpdir()), isPackaged: false, getAppPath: vi.fn(() => os.tmpdir()) }, shell: { openExternal: vi.fn() } }));
vi.mock('../../main/database/sqlite', () => ({ executeQuery: mocks.consultarBanco, executeNonQuery: mocks.executarBanco, withTransaction: async <T>(operacao: () => Promise<T>) => operacao() }));
vi.mock('../../main/services/configuracao.service', () => ({ configuracaoService: { obter: mocks.obterConfiguracao, salvar: mocks.salvarConfiguracao } }));
vi.mock('../../main/services/safe-storage.service', () => ({ safeStorageService: { isSecurelyAvailable: vi.fn(() => true) } }));
vi.mock('../../main/services/google-drive-oauth.service', () => ({ CLIENT_ID_GOOGLE_DRIVE: 'cliente', obterSegredoClienteGoogleDrive: vi.fn(async () => 'segredo-cliente') }));
vi.mock('../../main/services/laudo-bkp.service', () => ({ exportarBkpLaudo: mocks.exportarBkp, lerBkpLaudo: mocks.lerBkp }));
vi.mock('../../main/services/google-drive-pacote.service', () => ({ cifrarPacoteGoogleDrive: mocks.cifrar, decifrarPacoteGoogleDrive: mocks.decifrar, criarChavePacoteGoogleDrive: vi.fn(() => Buffer.alloc(32, 1)) }));
vi.mock('../../main/utils/logger', () => ({ getLogger: vi.fn(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() })) }));
vi.mock('jose', () => ({ createRemoteJWKSet: vi.fn(() => 'chaves-google'), jwtVerify: mocks.validarJwt }));

import { ErroGoogleDrive, googleDriveService } from '../../main/services/google-drive.service';

type ArquivoDrive = { id: string; name: string; mimeType?: string; size?: string; modifiedTime?: string; version?: string; appProperties?: Record<string, string>; parents?: string[] };
type CopiaLocalizada = { id: string; laudoId: string; numeroRep: string; nome: string; tamanho: number; modificadaEm: string; revisao: string; versaoDrive: string };
type ServicoInterno = {
  obterRaiz: (usuarioId: string) => Promise<string>;
  listarCopias: (usuarioId: string) => Promise<Array<{ id: string; laudoId: string; numeroRep: string; nome: string; tamanho: number; modificadaEm: string; revisao: string }>>;
  obterRevisoes: (usuarioId: string) => Promise<Record<string, string>>;
  obterChavePacote: (usuarioId: string, raizId: string) => Promise<Buffer>;
  conferirCotaAntesDoEnvio: (usuarioId: string, raizId: string, tamanho: number) => Promise<void>;
  criarPasta: (usuarioId: string, nome: string, paiId: string, raizId: string) => Promise<string>;
  enviarArquivo: (usuarioId: string, caminho: string, metadados: Record<string, unknown>) => Promise<ArquivoDrive>;
  baixarArquivo: (usuarioId: string, arquivoId: string, destino: string) => Promise<void>;
  registrarRevisao: (usuarioId: string, laudoId: string, revisao: string) => Promise<void>;
  invalidarCacheResumo: (usuarioId: string) => Promise<void>;
  listarDescendentes: (usuarioId: string, raizId: string) => Promise<ArquivoDrive[]>;
  requisitar: (usuarioId: string, url: string, init?: RequestInit) => Promise<Response>;
  registrarVerificacaoConcluida: (usuarioId: string, revisao: string) => Promise<void>;
  obterVerificacoes: (usuarioId: string) => Promise<Record<string, string>>;
  lerPacoteCopia: (usuarioId: string, copiaId: string, diretorio: string) => Promise<{ pacote: { rep: { numero: string }; tipoExame: { codigo: string; nome: string }; laudo: { status: string }; imagens: unknown[] }; hashCifrado: string; revisao: string }>;
  estadoRapido: (usuarioId: string) => Promise<{ conectado: boolean; email?: string; envioAutomatico: boolean; pendencias: number }>;
  obterCacheResumo: (usuarioId: string) => Promise<{ email: string; atualizadoEm: string; estado: { conectado: boolean; envioAutomatico: boolean; pendencias: number }; copias: Array<{ id: string; laudoId: string; numeroRep: string; nome: string; tamanho: number; modificadaEm: string; revisao: string }> } | null>;
  verificarAcessoDadosApp: (usuarioId: string) => Promise<void>;
  migrarControleLegado: (usuarioId: string, raizId: string) => Promise<void>;
  estado: (usuarioId: string) => Promise<{ conectado: boolean; email?: string; envioAutomatico: boolean; pendencias: number }>;
  validarIdentidadeGoogle: (idToken: unknown, nonce: string) => Promise<{ email: string; sub: string }>;
  salvarConexao: (usuarioId: string, tokens: { access_token: string; refresh_token?: string; expires_at: number; escopos?: string[] }, identidade: { email: string; sub: string }) => Promise<void>;
  listar: (usuarioId: string, consulta: string, campos: string, sinal?: AbortSignal) => Promise<ArquivoDrive[]>;
  obterArquivoDrive: (usuarioId: string, arquivoId: string, sinal?: AbortSignal) => Promise<ArquivoDrive | null>;
  listarCopiasDoLaudo: (usuarioId: string, raizId: string, laudoId: string, sinal?: AbortSignal) => Promise<CopiaLocalizada[]>;
  tokenValido: (usuarioId: string) => Promise<string>;
};

const servico = googleDriveService as unknown as ServicoInterno;
const metodosSubstituidos = ['obterRaiz', 'listarCopias', 'obterRevisoes', 'obterChavePacote', 'conferirCotaAntesDoEnvio', 'criarPasta', 'enviarArquivo', 'baixarArquivo', 'registrarRevisao', 'invalidarCacheResumo', 'listarDescendentes', 'requisitar', 'registrarVerificacaoConcluida', 'obterVerificacoes', 'lerPacoteCopia', 'estadoRapido', 'obterCacheResumo', 'verificarAcessoDadosApp', 'migrarControleLegado', 'estado', 'listar', 'obterArquivoDrive', 'listarCopiasDoLaudo', 'tokenValido'] as const;

beforeEach(() => {
  mocks.consultarBanco.mockReset().mockResolvedValue([{ id: 'laudo-1', status: 'Concluído', data_conclusao: '2026-02-03T12:00:00.000Z', versao: 2, numero: '2026/00109026' }]);
  mocks.salvarConfiguracao.mockReset().mockResolvedValue(undefined);
  mocks.exportarBkp.mockClear();
  mocks.lerBkp.mockClear();
  mocks.cifrar.mockClear();
  mocks.decifrar.mockClear();
  mocks.validarJwt.mockReset();
  mocks.obterConfiguracao.mockReset().mockResolvedValue(null);
  mocks.executarBanco.mockReset().mockResolvedValue(undefined);
  vi.mocked(shell.openExternal).mockReset();
});

afterEach(() => {
  for (const metodo of metodosSubstituidos) delete (servico as unknown as Record<string, unknown>)[metodo];
  vi.unstubAllGlobals();
});

describe('GoogleDriveService', () => {
  it('retoma o envio pelo byte confirmado após uma falha temporária', async () => {
    const diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-upload-'));
    const arquivo = path.join(diretorio, 'backup.lawdo');
    await writeFile(arquivo, 'abcde');
    const faixas: string[] = [];

    try {
      vi.spyOn(servico, 'requisitar').mockResolvedValue(new Response(null, {
        status: 200,
        headers: { location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=sessao' },
      }));
      vi.spyOn(servico, 'tokenValido').mockResolvedValue('token');
      vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
        const faixa = new Headers(init?.headers).get('Content-Range') ?? '';
        faixas.push(faixa);
        if (faixa === 'bytes 0-4/5') return new Response(null, { status: 503, headers: { 'retry-after': '0' } });
        if (faixa === 'bytes */5') return new Response(null, { status: 308, headers: { range: 'bytes=0-1' } });
        return new Response(JSON.stringify({ id: 'enviado', name: 'backup.lawdo' }), { status: 200 });
      }));

      await expect(servico.enviarArquivo('usuario-1', arquivo, { name: 'backup.lawdo', parents: ['pasta'] })).resolves.toMatchObject({ id: 'enviado' });
      expect(faixas).toEqual(['bytes 0-4/5', 'bytes */5', 'bytes 2-4/5']);
    } finally {
      await rm(diretorio, { recursive: true, force: true });
    }
  });

  it('recusa uma identidade institucional sem confirmação e não grava credenciais', async () => {
    mocks.validarJwt.mockResolvedValue({ payload: { nonce: 'nonce-invalido', sub: 'conta', email: 'perito@policiacientifica.pr.gov.br', email_verified: true, hd: 'policiacientifica.pr.gov.br' } });

    await expect(servico.validarIdentidadeGoogle('id-token', 'nonce-esperado')).rejects.toMatchObject({ codigo: 'conta_institucional_nao_confirmada' } satisfies Partial<ErroGoogleDrive>);
    expect(mocks.salvarConfiguracao).not.toHaveBeenCalled();
  });

  it('persiste tokens, e-mail e identificador estável na mesma transação após a validação da conexão', async () => {
    await servico.salvarConexao('usuario-1', { access_token: 'token-novo', refresh_token: 'refresh-novo', expires_at: 1, escopos: [] }, { email: 'perito@policiacientifica.pr.gov.br', sub: 'conta-google' });

    expect(mocks.salvarConfiguracao).toHaveBeenCalledWith('google_drive_tokens_usuario-1', expect.any(String), 'api_key', 'Tokens OAuth do Google Drive');
    expect(mocks.salvarConfiguracao).toHaveBeenCalledWith('google_drive_email_usuario-1', 'perito@policiacientifica.pr.gov.br', 'texto', 'Conta Google Drive autorizada');
    expect(mocks.salvarConfiguracao).toHaveBeenCalledWith('google_drive_sub_usuario-1', 'conta-google', 'texto', 'Identificador estável da conta Google Drive');
  });

  it('renova o token com client_id e client_secret provisionado', async () => {
    mocks.obterConfiguracao.mockResolvedValueOnce(JSON.stringify({ access_token: 'vencido', refresh_token: 'refresh', expires_at: 0, escopos: [] }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ access_token: 'novo', expires_in: 3600 }), { status: 200 })));

    await expect(servico.tokenValido('usuario-1')).resolves.toBe('novo');

    const corpo = vi.mocked(fetch).mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(corpo.get('client_id')).toBe('cliente');
    expect(corpo.get('client_secret')).toBe('segredo-cliente');
  });

  it('limpa as credenciais locais quando o Google devolve invalid_grant', async () => {
    mocks.obterConfiguracao.mockResolvedValueOnce(JSON.stringify({ access_token: 'vencido', refresh_token: 'refresh', expires_at: 0, escopos: [] }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })));

    await expect(servico.tokenValido('usuario-1')).rejects.toMatchObject({ codigo: 'invalid_grant' } satisfies Partial<ErroGoogleDrive>);

    expect(mocks.executarBanco).toHaveBeenCalledWith('DELETE FROM configuracoes WHERE chave = ?', ['google_drive_tokens_usuario-1']);
  });

  it('classifica a recusa do cliente sem registrar a descrição OAuth', async () => {
    mocks.obterConfiguracao.mockResolvedValueOnce(JSON.stringify({ access_token: 'vencido', refresh_token: 'refresh', expires_at: 0, escopos: [] }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_request', error_description: 'Missing required parameter: client_secret' }), { status: 400 })));

    await expect(servico.tokenValido('usuario-1')).rejects.toMatchObject({ codigo: 'invalid_request_client_secret_rejeitado' } satisfies Partial<ErroGoogleDrive>);
  });

  it('abre no navegador a pasta exclusiva do laWdo da conta conectada', async () => {
    Object.assign(servico, {
      estadoRapido: vi.fn(async () => ({ conectado: true, email: 'perito@policiacientifica.pr.gov.br', envioAutomatico: false, pendencias: 0 })),
      obterRaiz: vi.fn(async () => 'pasta do laWdo'),
    });

    await googleDriveService.abrirPasta('usuario-1');

    expect(shell.openExternal).toHaveBeenCalledWith('https://drive.google.com/drive/u/0/folders/pasta%20do%20laWdo');
  });

  it('retorna o resumo em cache mesmo vencido para a tela exibir antes da atualização remota', async () => {
    Object.assign(servico, {
      estadoRapido: vi.fn(async () => ({ conectado: true, email: 'perito@policiacientifica.pr.gov.br', envioAutomatico: false, pendencias: 0 })),
      obterCacheResumo: vi.fn(async () => ({
        email: 'perito@policiacientifica.pr.gov.br', atualizadoEm: '2020-01-01T00:00:00.000Z',
        estado: { conectado: true, envioAutomatico: false, pendencias: 0 },
        copias: [{ id: 'copia', laudoId: 'laudo-1', numeroRep: '1', nome: '1.laWdo', tamanho: 1, modificadaEm: '', revisao: 'r1' }],
      })),
    });

    await expect(googleDriveService.resumoCache('usuario-1')).resolves.toMatchObject({ origem: 'cache', desatualizado: true, copias: [expect.objectContaining({ id: 'copia' })] });
  });

  it('lista apenas backups pertencentes à raiz e restaura a data da última integridade por revisão', async () => {
    Object.assign(servico, {
      obterRaiz: vi.fn(async () => 'raiz'), obterVerificacoes: vi.fn(async () => ({ revisao: '2026-02-03T12:00:00.000Z' })),
      listarDescendentes: vi.fn(async () => [
        { id: 'backup', name: '109.026-26.laWdo', size: '12', modifiedTime: '2026-02-02T12:00:00.000Z', appProperties: { lawdoBackup: '1', lawdoRaizId: 'raiz', lawdoLaudoId: 'laudo-1', lawdoNumeroRep: '2026/00109026', lawdoHash: 'revisao' } },
        { id: 'externo', name: 'externo.laWdo', appProperties: { lawdoBackup: '1', lawdoRaizId: 'outra-raiz' } },
      ]),
    });

    await expect(googleDriveService.listarCopias('usuario-1')).resolves.toEqual([expect.objectContaining({ id: 'backup', nome: '109.026-26.laWdo', verificadaEm: '2026-02-03T12:00:00.000Z' })]);
  });

  it('localiza apenas as cópias do laudo e confirma a hierarquia até a raiz', async () => {
    const backup = { id: 'backup', name: '109.026-26.laWdo', size: '12', version: 'v1', parents: ['rep'], appProperties: { lawdoBackup: '1', lawdoRaizId: 'raiz', lawdoLaudoId: 'laudo-1', lawdoNumeroRep: '2026/00109026', lawdoHash: 'hash' } };
    const pastas = new Map<string, ArquivoDrive>([
      ['rep', { id: 'rep', name: '109.026-26', mimeType: 'application/vnd.google-apps.folder', parents: ['mes'], appProperties: { lawdoPasta: '1', lawdoRaizId: 'raiz' } }],
      ['mes', { id: 'mes', name: '02', mimeType: 'application/vnd.google-apps.folder', parents: ['ano'], appProperties: { lawdoPasta: '1', lawdoRaizId: 'raiz' } }],
      ['ano', { id: 'ano', name: '2026', mimeType: 'application/vnd.google-apps.folder', parents: ['raiz'], appProperties: { lawdoPasta: '1', lawdoRaizId: 'raiz' } }],
    ]);
    const listar = vi.fn(async () => [backup]);
    Object.assign(servico, {
      listar,
      obterArquivoDrive: vi.fn(async (_usuarioId: string, arquivoId: string) => pastas.get(arquivoId) ?? null),
      listarDescendentes: vi.fn(),
    });

    await expect(servico.listarCopiasDoLaudo('usuario-1', 'raiz', 'laudo-1')).resolves.toEqual([expect.objectContaining({ id: 'backup', versaoDrive: 'v1' })]);
    expect(listar).toHaveBeenCalledWith('usuario-1', expect.stringContaining("key='lawdoLaudoId' and value='laudo-1'"), expect.any(String), undefined);
    expect(servico.listarDescendentes).not.toHaveBeenCalled();
  });

  it('não envia novamente uma cópia idêntica e preserva o arquivo remoto já validado', async () => {
    const revisao = createHash('sha256').update('pacote válido').digest('hex');
    const enviarArquivo = vi.fn();
    Object.assign(servico, {
      obterRaiz: vi.fn(async () => 'raiz'), listarCopiasDoLaudo: vi.fn(async () => [{ id: 'existente', laudoId: 'laudo-1', numeroRep: '2026/00109026', nome: '109.026-26.laWdo', tamanho: 1, modificadaEm: '', revisao, versaoDrive: 'v1' }]),
      obterRevisoes: vi.fn(async () => ({})), enviarArquivo, registrarRevisao: vi.fn(async () => undefined), invalidarCacheResumo: vi.fn(async () => undefined),
    });

    await expect(googleDriveService.enviarLaudo('usuario-1', 'laudo-1', true)).resolves.toMatchObject({ id: 'existente' });
    expect(enviarArquivo).not.toHaveBeenCalled();
  });

  it('permite o envio manual de um laudo em andamento usando a última atualização como referência', async () => {
    mocks.consultarBanco.mockResolvedValue([{ id: 'laudo-1', status: 'Em andamento', data_conclusao: null, updated_at: '2026-02-03T12:00:00.000Z', versao: 2, numero: '2026/00109026' }]);
    const revisao = createHash('sha256').update('pacote válido').digest('hex');
    Object.assign(servico, {
      obterRaiz: vi.fn(async () => 'raiz'), listarCopiasDoLaudo: vi.fn(async () => [{ id: 'existente', laudoId: 'laudo-1', numeroRep: '2026/00109026', nome: '109.026-26.laWdo', tamanho: 1, modificadaEm: '', revisao, versaoDrive: 'v1' }]),
      obterRevisoes: vi.fn(async () => ({})), enviarArquivo: vi.fn(), registrarRevisao: vi.fn(async () => undefined), invalidarCacheResumo: vi.fn(async () => undefined),
    });

    await expect(googleDriveService.enviarLaudo('usuario-1', 'laudo-1', true)).resolves.toMatchObject({ id: 'existente' });
  });

  it('protege o envio automático quando a cópia remota divergiu e exige confirmação no envio manual', async () => {
    const copias = [{ id: 'existente', laudoId: 'laudo-1', numeroRep: '2026/00109026', nome: '109.026-26.laWdo', tamanho: 1, modificadaEm: '', revisao: 'remota', versaoDrive: 'v1' }];
    Object.assign(servico, { obterRaiz: vi.fn(async () => 'raiz'), listarCopiasDoLaudo: vi.fn(async () => copias), obterRevisoes: vi.fn(async () => ({ 'laudo-1': 'local' })) });

    await expect(googleDriveService.enviarLaudo('usuario-1', 'laudo-1', false, true)).rejects.toMatchObject({ codigo: 'divergencia_remota' } satisfies Partial<ErroGoogleDrive>);
    await expect(googleDriveService.enviarLaudo('usuario-1', 'laudo-1', false)).rejects.toMatchObject({ codigo: 'substituicao_nao_confirmada' } satisfies Partial<ErroGoogleDrive>);
  });

  it('envia o arquivo com o nome amigável da REP e mantém a troca de cópia anterior', async () => {
    const enviarArquivo = vi.fn(async (_usuarioId: string, _caminho: string, metadados: Record<string, unknown>) => ({ id: 'nova-copia', name: String(metadados.name), size: '17', modifiedTime: '2026-02-03T12:00:00.000Z' }));
    const requisitar = vi.fn(async () => new Response(null, { status: 204 }));
    const anterior = { id: 'anterior', laudoId: 'laudo-1', numeroRep: '2026/00109026', nome: 'antigo.laWdo', tamanho: 1, modificadaEm: '', revisao: 'antiga', versaoDrive: 'v1' };
    const listarCopiasDoLaudo = vi.fn()
      .mockResolvedValueOnce([anterior])
      .mockResolvedValueOnce([anterior, { id: 'nova-copia', laudoId: 'laudo-1', numeroRep: '2026/00109026', nome: '109.026-26.laWdo', tamanho: 17, modificadaEm: '', revisao: 'nova', versaoDrive: 'v2' }]);
    Object.assign(servico, {
      obterRaiz: vi.fn(async () => 'raiz'), listarCopiasDoLaudo,
      obterRevisoes: vi.fn(async () => ({ 'laudo-1': 'antiga' })), obterChavePacote: vi.fn(async () => Buffer.alloc(32, 1)), conferirCotaAntesDoEnvio: vi.fn(async () => undefined),
      criarPasta: vi.fn(async (_usuarioId: string, nome: string) => `pasta-${nome}`), enviarArquivo, baixarArquivo: vi.fn(async () => undefined),
      registrarRevisao: vi.fn(async () => undefined), invalidarCacheResumo: vi.fn(async () => undefined), requisitar,
    });

    const copia = await googleDriveService.enviarLaudo('usuario-1', 'laudo-1', true);

    expect(enviarArquivo).toHaveBeenCalledWith('usuario-1', expect.any(String), expect.objectContaining({ name: '109.026-26.laWdo', parents: ['pasta-109.026-26'] }));
    expect(copia.nome).toBe('109.026-26.laWdo');
    expect(requisitar).toHaveBeenCalledWith('usuario-1', expect.stringContaining('/anterior'), { method: 'DELETE' });
  });

  it('preserva as cópias anteriores quando a revisão remota muda durante o envio', async () => {
    const anterior = { id: 'anterior', laudoId: 'laudo-1', numeroRep: '2026/00109026', nome: 'antigo.laWdo', tamanho: 1, modificadaEm: '', revisao: 'antiga', versaoDrive: 'v1' };
    const requisitar = vi.fn(async () => new Response(null, { status: 204 }));
    Object.assign(servico, {
      obterRaiz: vi.fn(async () => 'raiz'),
      listarCopiasDoLaudo: vi.fn()
        .mockResolvedValueOnce([anterior])
        .mockResolvedValueOnce([{ ...anterior, versaoDrive: 'v2' }, { id: 'nova-copia', laudoId: 'laudo-1', numeroRep: '2026/00109026', nome: '109.026-26.laWdo', tamanho: 17, modificadaEm: '', revisao: 'nova', versaoDrive: 'v3' }]),
      obterRevisoes: vi.fn(async () => ({ 'laudo-1': 'antiga' })), obterChavePacote: vi.fn(async () => Buffer.alloc(32, 1)), conferirCotaAntesDoEnvio: vi.fn(async () => undefined),
      criarPasta: vi.fn(async (_usuarioId: string, nome: string) => `pasta-${nome}`),
      enviarArquivo: vi.fn(async () => ({ id: 'nova-copia', name: '109.026-26.laWdo', size: '17', modifiedTime: '2026-02-03T12:00:00.000Z' })),
      baixarArquivo: vi.fn(async () => undefined), registrarRevisao: vi.fn(async () => undefined), invalidarCacheResumo: vi.fn(async () => undefined), requisitar,
    });

    await expect(googleDriveService.enviarLaudo('usuario-1', 'laudo-1', true)).rejects.toMatchObject({ codigo: 'divergencia_remota' } satisfies Partial<ErroGoogleDrive>);
    expect(requisitar).not.toHaveBeenCalled();
  });

  it('envia somente a pasta exclusiva validada da REP para a Lixeira', async () => {
    const requisitar = vi.fn(async () => new Response('{}'));
    const copia = { id: 'copia', name: '109.026-26.laWdo', parents: ['rep'], appProperties: { lawdoBackup: '1', lawdoRaizId: 'raiz' } };
    const pastaRep = { id: 'rep', name: '109.026-26', mimeType: 'application/vnd.google-apps.folder', parents: ['mes'], appProperties: { lawdoPasta: '1', lawdoRaizId: 'raiz' } };
    const pastaMes = { id: 'mes', name: '02', mimeType: 'application/vnd.google-apps.folder', parents: ['ano'], appProperties: { lawdoPasta: '1', lawdoRaizId: 'raiz' } };
    const pastaAno = { id: 'ano', name: '2026', mimeType: 'application/vnd.google-apps.folder', parents: ['raiz'], appProperties: { lawdoPasta: '1', lawdoRaizId: 'raiz' } };
    Object.assign(servico, {
      listarCopias: vi.fn(async () => [{ id: 'copia', laudoId: 'laudo-1', numeroRep: '2026/00109026', nome: copia.name, tamanho: 1, modificadaEm: '', revisao: 'r1' }]),
      obterRaiz: vi.fn(async () => 'raiz'), listarDescendentes: vi.fn(async () => [copia, pastaRep, pastaMes, pastaAno]), requisitar, invalidarCacheResumo: vi.fn(async () => undefined),
    });

    await googleDriveService.moverParaLixeira('usuario-1', 'copia', 'r1');

    expect(requisitar).toHaveBeenCalledWith('usuario-1', expect.stringContaining('/rep'), expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ trashed: true }) }));
  });

  it('recusa enviar qualquer item para a Lixeira quando a hierarquia não é exclusiva do laWdo', async () => {
    const requisitar = vi.fn();
    Object.assign(servico, {
      listarCopias: vi.fn(async () => [{ id: 'copia', laudoId: 'laudo-1', numeroRep: '1', nome: '1.laWdo', tamanho: 1, modificadaEm: '', revisao: 'r1' }]),
      obterRaiz: vi.fn(async () => 'raiz'), listarDescendentes: vi.fn(async () => [{ id: 'copia', name: '1.laWdo', parents: ['externa'], appProperties: { lawdoBackup: '1', lawdoRaizId: 'raiz' } }]), requisitar,
    });

    await expect(googleDriveService.moverParaLixeira('usuario-1', 'copia', 'r1')).rejects.toMatchObject({ codigo: 'pasta_copia_invalida' } satisfies Partial<ErroGoogleDrive>);
    expect(requisitar).not.toHaveBeenCalled();
  });

  it('registra a revisão e invalida o resumo apenas depois da verificação concluída', async () => {
    const registrar = vi.fn(async () => undefined);
    Object.assign(servico, { lerPacoteCopia: vi.fn(async () => ({ pacote: { rep: { numero: '109.026-26' }, tipoExame: { codigo: 'T', nome: 'Teste' }, laudo: { status: 'Concluído' }, imagens: [] }, hashCifrado: 'hash', revisao: 'r1' })), registrarVerificacaoConcluida: registrar });

    const resultado = await googleDriveService.verificar('usuario-1', 'copia', undefined);

    expect(resultado.previa).toMatchObject({ numeroRep: '109.026-26', tipoExame: 'T — Teste' });
    expect(registrar).toHaveBeenCalledWith('usuario-1', 'r1');
  });
});
