import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import { authSessaoService } from '../../main/services/auth-sessao.service';
import { googleDriveService } from '../../main/services/google-drive.service';

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => process.cwd()) }, ipcMain: { handle: vi.fn() } }));
vi.mock('../../main/services/auth-sessao.service', () => ({ authSessaoService: { exigir: vi.fn(() => 'usuario-1') } }));
vi.mock('../../main/services/google-drive.service', () => ({ ErroGoogleDrive: class ErroGoogleDrive extends Error {}, googleDriveService: {
  estadoRapido: vi.fn(), estado: vi.fn(), resumo: vi.fn(), conectar: vi.fn(), desconectar: vi.fn(), definirEnvioAutomatico: vi.fn(), listarCopias: vi.fn(), listarLaudosConcluidos: vi.fn(), enviarLaudo: vi.fn(), verificar: vi.fn(), conferirCopiaAtual: vi.fn(), lerPacoteCopia: vi.fn(), registrarVerificacaoConcluida: vi.fn(), moverParaLixeira: vi.fn(),
} }));
vi.mock('../../main/services/laudo-bkp.service', () => ({ analisarConflitosBkp: vi.fn(), importarBkpLaudo: vi.fn() }));

type Remetente = { id: number; isDestroyed: () => boolean; once: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };
type Tratador = (evento: { sender: Remetente }, ...argumentos: unknown[]) => Promise<unknown>;
const pacote = { rep: { numero: '109.026-26' }, tipoExame: { codigo: 'T', nome: 'Teste' }, solicitante: null, placeholders: [], laudo: { conteudo: '<p>Laudo</p>', apresentacao_json: null } };

function obterTratador(canal: string): Tratador {
  const tratador = vi.mocked(ipcMain.handle).mock.calls.find(([registrado]) => registrado === canal)?.[1];
  if (!tratador) throw new Error(`Handler ${canal} não registrado.`);
  return tratador as unknown as Tratador;
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(authSessaoService.exigir).mockReturnValue('usuario-1');
  vi.mocked(googleDriveService.lerPacoteCopia).mockResolvedValue({ pacote, hashCifrado: 'hash', revisao: 'r1' } as never);
  vi.mocked(googleDriveService.registrarVerificacaoConcluida).mockResolvedValue(undefined);
  const { registrarGoogleDriveHandlers } = await import('../../main/ipc/handlers/google-drive.handlers');
  registrarGoogleDriveHandlers();
});

describe('fronteira IPC do Google Drive', () => {
  it('marca a cópia como íntegra depois de preparar uma visualização válida', async () => {
    const evento = { sender: { id: 1, isDestroyed: () => false, once: vi.fn(), send: vi.fn() } };

    const resposta = await obterTratador('google-drive:preparar-visualizacao')(evento, 'copia-1');

    expect(resposta).toMatchObject({ success: true, data: { html: '<p>Laudo</p>', titulo: 'Laudo — REP 109.026-26' } });
    expect(googleDriveService.registrarVerificacaoConcluida).toHaveBeenCalledWith('usuario-1', 'r1');
  });

  it('não atualiza a integridade se a preparação da visualização falhar', async () => {
    vi.mocked(googleDriveService.lerPacoteCopia).mockRejectedValueOnce(new Error('Pacote inválido'));
    const evento = { sender: { id: 2, isDestroyed: () => false, once: vi.fn(), send: vi.fn() } };

    const resposta = await obterTratador('google-drive:preparar-visualizacao')(evento, 'copia-2');

    expect(resposta).toMatchObject({ success: false, error: 'Pacote inválido' });
    expect(googleDriveService.registrarVerificacaoConcluida).not.toHaveBeenCalled();
  });

  it('rejeita exclusão sem revisão para impedir apagar uma cópia alterada', async () => {
    const evento = { sender: { id: 3, isDestroyed: () => false, once: vi.fn(), send: vi.fn() } };

    const resposta = await obterTratador('google-drive:mover-para-lixeira')(evento, 'copia-3', 1);

    expect(resposta).toMatchObject({ success: false });
    expect(googleDriveService.moverParaLixeira).not.toHaveBeenCalled();
  });
});
