import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import { authSessaoService } from '../../main/services/auth-sessao.service';
import { googleDriveService } from '../../main/services/google-drive.service';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => process.cwd()), getVersion: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));
vi.mock('../../main/services/auth-sessao.service.js', () => ({ authSessaoService: { exigir: vi.fn(), encerrar: vi.fn(), iniciar: vi.fn() } }));
vi.mock('../../main/services/google-drive.service.js', () => ({ googleDriveService: { desconectar: vi.fn(), retomarFila: vi.fn() } }));
vi.mock('../../main/services/user.service.js', () => ({ userService: { authenticate: vi.fn() } }));
vi.mock('../../main/security/index.js', () => ({ sanitizeInput: (valor: string) => valor }));
vi.mock('../../main/security/autenticacao.js', () => ({ validarCredenciaisLogin: vi.fn() }));
vi.mock('../../main/services/audit-log.service.js', () => ({ auditLogin: vi.fn() }));
vi.mock('../../main/utils/logger.js', () => ({ getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) }));

type TratadorLogout = (evento: { sender: { id: number } }) => Promise<{ success: boolean }>;

function obterTratadorLogout(): TratadorLogout {
  const tratador = vi.mocked(ipcMain.handle).mock.calls.find(([canal]) => canal === 'logout')?.[1];
  if (!tratador) throw new Error('Handler de logout não registrado.');
  return tratador as TratadorLogout;
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(authSessaoService.exigir).mockReturnValue('usuario-1');
  const { registrarHandlersAutenticacao } = await import('../../main/ipc/index');
  registrarHandlersAutenticacao();
});

describe('handler de logout', () => {
  it('encerra somente a sessão local e preserva a conexão OAuth do Google Drive', async () => {
    const resposta = await obterTratadorLogout()({ sender: { id: 17 } });

    expect(resposta).toEqual({ success: true });
    expect(authSessaoService.exigir).toHaveBeenCalledWith(17);
    expect(authSessaoService.encerrar).toHaveBeenCalledWith(17);
    expect(googleDriveService.desconectar).not.toHaveBeenCalled();
  });
});
