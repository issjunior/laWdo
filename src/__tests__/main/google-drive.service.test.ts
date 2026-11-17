import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';

const mocks = vi.hoisted(() => ({
  salvarConfiguracao: vi.fn(), consultarBanco: vi.fn(),
  exportarBkp: vi.fn(async (_laudoId: string, destino: string) => writeFile(destino, 'pacote válido')),
  lerBkp: vi.fn(async () => ({ rep: { numero: '2026/00109026' }, tipoExame: { codigo: 'T', nome: 'Teste' }, laudo: { status: 'Concluído' }, imagens: [] })),
  cifrar: vi.fn(async (_origem: string, destino: string) => writeFile(destino, 'pacote cifrado')),
  decifrar: vi.fn(async (_origem: string, destino: string) => writeFile(destino, 'pacote decifrado')),
}));

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => os.tmpdir()), isPackaged: false, getAppPath: vi.fn(() => os.tmpdir()) }, shell: { openExternal: vi.fn() } }));
vi.mock('../../main/database/sqlite', () => ({ executeQuery: mocks.consultarBanco, executeNonQuery: vi.fn() }));
vi.mock('../../main/services/configuracao.service', () => ({ configuracaoService: { obter: vi.fn(), salvar: mocks.salvarConfiguracao } }));
vi.mock('../../main/services/safe-storage.service', () => ({ safeStorageService: { isAvailable: vi.fn(() => true) } }));
vi.mock('../../main/services/google-drive-oauth.service', () => ({ CLIENT_ID_GOOGLE_DRIVE: 'cliente', obterSegredoClienteGoogleDrive: vi.fn() }));
vi.mock('../../main/services/laudo-bkp.service', () => ({ exportarBkpLaudo: mocks.exportarBkp, lerBkpLaudo: mocks.lerBkp }));
vi.mock('../../main/services/google-drive-pacote.service', () => ({ cifrarPacoteGoogleDrive: mocks.cifrar, decifrarPacoteGoogleDrive: mocks.decifrar, criarChavePacoteGoogleDrive: vi.fn(() => Buffer.alloc(32, 1)) }));
vi.mock('../../main/utils/logger', () => ({ getLogger: vi.fn(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() })) }));

import { ErroGoogleDrive, googleDriveService } from '../../main/services/google-drive.service';

type ArquivoDrive = { id: string; name: string; mimeType?: string; size?: string; modifiedTime?: string; appProperties?: Record<string, string>; parents?: string[] };
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
};

const servico = googleDriveService as unknown as ServicoInterno;
const metodosSubstituidos = ['obterRaiz', 'listarCopias', 'obterRevisoes', 'obterChavePacote', 'conferirCotaAntesDoEnvio', 'criarPasta', 'enviarArquivo', 'baixarArquivo', 'registrarRevisao', 'invalidarCacheResumo', 'listarDescendentes', 'requisitar', 'registrarVerificacaoConcluida', 'obterVerificacoes', 'lerPacoteCopia'] as const;

beforeEach(() => {
  mocks.consultarBanco.mockReset().mockResolvedValue([{ id: 'laudo-1', status: 'Concluído', data_conclusao: '2026-02-03T12:00:00.000Z', versao: 2, numero: '2026/00109026' }]);
  mocks.salvarConfiguracao.mockReset().mockResolvedValue(undefined);
  mocks.exportarBkp.mockClear();
  mocks.lerBkp.mockClear();
  mocks.cifrar.mockClear();
  mocks.decifrar.mockClear();
});

afterEach(() => {
  for (const metodo of metodosSubstituidos) delete (servico as unknown as Record<string, unknown>)[metodo];
});

describe('GoogleDriveService', () => {
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

  it('não envia novamente uma cópia idêntica e preserva o arquivo remoto já validado', async () => {
    const revisao = createHash('sha256').update('pacote válido').digest('hex');
    const enviarArquivo = vi.fn();
    Object.assign(servico, {
      obterRaiz: vi.fn(async () => 'raiz'), listarCopias: vi.fn(async () => [{ id: 'existente', laudoId: 'laudo-1', numeroRep: '2026/00109026', nome: '109.026-26.laWdo', tamanho: 1, modificadaEm: '', revisao }]),
      obterRevisoes: vi.fn(async () => ({})), enviarArquivo, registrarRevisao: vi.fn(async () => undefined), invalidarCacheResumo: vi.fn(async () => undefined),
    });

    await expect(googleDriveService.enviarLaudo('usuario-1', 'laudo-1', true)).resolves.toMatchObject({ id: 'existente' });
    expect(enviarArquivo).not.toHaveBeenCalled();
  });

  it('protege o envio automático quando a cópia remota divergiu e exige confirmação no envio manual', async () => {
    const copias = [{ id: 'existente', laudoId: 'laudo-1', numeroRep: '2026/00109026', nome: '109.026-26.laWdo', tamanho: 1, modificadaEm: '', revisao: 'remota' }];
    Object.assign(servico, { obterRaiz: vi.fn(async () => 'raiz'), listarCopias: vi.fn(async () => copias), obterRevisoes: vi.fn(async () => ({ 'laudo-1': 'local' })) });

    await expect(googleDriveService.enviarLaudo('usuario-1', 'laudo-1', false, true)).rejects.toMatchObject({ codigo: 'divergencia_remota' } satisfies Partial<ErroGoogleDrive>);
    await expect(googleDriveService.enviarLaudo('usuario-1', 'laudo-1', false)).rejects.toMatchObject({ codigo: 'substituicao_nao_confirmada' } satisfies Partial<ErroGoogleDrive>);
  });

  it('envia o arquivo com o nome amigável da REP e mantém a troca de cópia anterior', async () => {
    const enviarArquivo = vi.fn(async (_usuarioId: string, _caminho: string, metadados: Record<string, unknown>) => ({ id: 'nova-copia', name: String(metadados.name), size: '17', modifiedTime: '2026-02-03T12:00:00.000Z' }));
    const requisitar = vi.fn(async () => new Response(null, { status: 204 }));
    Object.assign(servico, {
      obterRaiz: vi.fn(async () => 'raiz'), listarCopias: vi.fn(async () => [{ id: 'anterior', laudoId: 'laudo-1', numeroRep: '2026/00109026', nome: 'antigo.laWdo', tamanho: 1, modificadaEm: '', revisao: 'antiga' }]),
      obterRevisoes: vi.fn(async () => ({ 'laudo-1': 'antiga' })), obterChavePacote: vi.fn(async () => Buffer.alloc(32, 1)), conferirCotaAntesDoEnvio: vi.fn(async () => undefined),
      criarPasta: vi.fn(async (_usuarioId: string, nome: string) => `pasta-${nome}`), enviarArquivo, baixarArquivo: vi.fn(async () => undefined),
      registrarRevisao: vi.fn(async () => undefined), invalidarCacheResumo: vi.fn(async () => undefined), requisitar,
    });

    const copia = await googleDriveService.enviarLaudo('usuario-1', 'laudo-1', true);

    expect(enviarArquivo).toHaveBeenCalledWith('usuario-1', expect.any(String), expect.objectContaining({ name: '109.026-26.laWdo', parents: ['pasta-109.026-26'] }));
    expect(copia.nome).toBe('109.026-26.laWdo');
    expect(requisitar).toHaveBeenCalledWith('usuario-1', expect.stringContaining('/anterior'), { method: 'DELETE' });
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
