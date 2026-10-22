import { beforeEach, describe, expect, it, vi } from 'vitest';
import { consultarEventosWindowsGpu } from '@main/services/diagnostico-gpu-windows.js';
const simulacao = { executar: vi.fn() };

beforeEach(() => { simulacao.executar.mockReset(); });
describe.runIf(process.platform === 'win32')('consulta limitada de eventos gráficos do Windows', () => {
  it('usa consulta delimitada, oculta e com timeout sem retornar mensagens integrais', async () => {
    simulacao.executar.mockResolvedValue({ stdout: JSON.stringify([{ horario: '2026-10-21T18:35:00Z', provedor: 'Display', codigo: '4101', mensagem: 'privada' }]) });
    const resultado = await consultarEventosWindowsGpu(Date.parse('2026-10-21T18:33:00Z'), Date.parse('2026-10-21T18:36:00Z'), simulacao.executar);
    expect(resultado).toMatchObject({ estado: 'disponivel', eventos: [{ codigo: '4101' }] });
    expect(JSON.stringify(resultado)).not.toContain('privada');
    const [comando, argumentos, opcoes] = simulacao.executar.mock.calls[0]!;
    expect(comando).toBe('powershell.exe');
    expect(opcoes).toMatchObject({ windowsHide: true, timeout: 5000, maxBuffer: 1024 * 1024 });
    const script = Buffer.from(argumentos.at(-1), 'base64').toString('utf16le');
    expect(script).toContain('WATCHDOG-(\\d{8})-(\\d{4})\\.dmp');
    expect(script).toContain('-MaxEvents 50');
  });
  it.each([
    [{ code: 'EACCES' }, 'WINDOWS_INDISPONIVEL_OU_SEM_PERMISSAO'],
    [{ code: 'ETIMEDOUT', killed: true }, 'WINDOWS_TIMEOUT'],
  ])('explicita lacunas sem propagar falhas: %j', async (erro, lacuna) => {
    simulacao.executar.mockRejectedValue(erro);
    await expect(consultarEventosWindowsGpu(0, Date.now(), simulacao.executar)).resolves.toMatchObject({ estado: 'indisponivel', eventos: [], lacuna });
  });
});
