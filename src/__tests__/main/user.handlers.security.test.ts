import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import { authSessaoService } from '../../main/services/auth-sessao.service';
import { userService } from '../../main/services/user.service';

vi.mock('electron', () => ({ app: { getPath: vi.fn() }, ipcMain: { handle: vi.fn() } }));
vi.mock('../../main/services/auth-sessao.service.js', () => ({ authSessaoService: { exigir: vi.fn() } }));
vi.mock('../../main/services/user.service.js', () => ({ userService: {
  findAll: vi.fn(), findById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findByEmail: vi.fn(),
  findActivePeritos: vi.fn(), updateProfile: vi.fn(), temUsuarios: vi.fn(),
} }));
vi.mock('../../main/security/index.js', () => ({ sanitizeInput: (valor: string) => valor }));
vi.mock('../../main/database/sqlite.js', () => ({ withTransaction: async (operacao: () => unknown) => operacao() }));
vi.mock('../../main/utils/logger.js', () => ({ logDebug: vi.fn(), logError: vi.fn() }));

type Tratador = (evento: { sender: { id: number } }, ...argumentos: unknown[]) => Promise<Record<string, unknown>>;

function obterTratador(canal: string): Tratador {
  const tratador = vi.mocked(ipcMain.handle).mock.calls.find(([nome]) => nome === canal)?.[1];
  if (!tratador) throw new Error(`Handler ${canal} não registrado.`);
  return tratador as unknown as Tratador;
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(authSessaoService.exigir).mockReturnValue('usuario-1');
  const { registerUserHandlers } = await import('../../main/ipc/handlers/user.handlers');
  registerUserHandlers();
});

describe('fronteira IPC de usuários', () => {
  it('não consulta usuários sem uma sessão autenticada', async () => {
    vi.mocked(authSessaoService.exigir).mockImplementation(() => { throw new Error('Faça login novamente'); });

    const resposta = await obterTratador('user:findAll')({ sender: { id: 1 } });

    expect(resposta).toMatchObject({ success: false, error: 'Faça login novamente' });
    expect(userService.findAll).not.toHaveBeenCalled();
  });

  it('não expõe senha_hash nas respostas ao renderer', async () => {
    vi.mocked(userService.findAll).mockResolvedValueOnce([{
      id: 'usuario-1', nome: 'Perito', email: 'perito@teste.local', username: 'perito', senha_hash: 'hash-secreto',
      matricula: null, telefone: null, cargo: null, lotacao: null, forma_tratamento: 'masculino', ativo: 1,
      foto_url: null, data_criacao: '', data_atualizacao: '',
    }] as never);

    const resposta = await obterTratador('user:findAll')({ sender: { id: 1 } });

    expect(resposta).toMatchObject({ success: true, data: [expect.objectContaining({ id: 'usuario-1' })] });
    expect((resposta.data as Array<Record<string, unknown>>)[0]).not.toHaveProperty('senha_hash');
  });

  it('mantém a verificação de existência de usuário disponível antes do login', async () => {
    vi.mocked(userService.temUsuarios).mockResolvedValueOnce(true);

    const resposta = await obterTratador('user:temUsuarios')({ sender: { id: 1 } });

    expect(resposta).toEqual({ success: true, data: true });
    expect(authSessaoService.exigir).not.toHaveBeenCalled();
  });
});
