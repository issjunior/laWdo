import { describe, expect, it, vi } from 'vitest';
import type { Session } from 'electron';

vi.mock('@main/services/configuracao.service', () => ({ configuracaoService: { obter: vi.fn(), salvar: vi.fn() } }));
import { configuracaoService } from '@main/services/configuracao.service';
import { configurarCorretor, prepararCorretor, validarPalavraCorretor } from '@main/services/corretor.service';

describe('configuração do corretor', () => {
  it('inicializa em português brasileiro e respeita a preferência salva', async () => {
    const sessao = { availableSpellCheckerLanguages: ['en-US', 'pt-BR'], setSpellCheckerLanguages: vi.fn(), setSpellCheckerEnabled: vi.fn() } as unknown as Session;
    vi.mocked(configuracaoService.obter).mockResolvedValue('false');
    await prepararCorretor(sessao);
    if (process.platform !== 'darwin') expect(sessao.setSpellCheckerLanguages).toHaveBeenCalledWith(['pt-BR']);
    expect(sessao.setSpellCheckerEnabled).toHaveBeenCalledWith(false);
  });

  it('não muda o corretor quando salvar a preferência falha', async () => {
    const sessao = { setSpellCheckerEnabled: vi.fn() } as unknown as Session;
    vi.mocked(configuracaoService.salvar).mockRejectedValueOnce(new Error('Falha no armazenamento'));
    await expect(configurarCorretor(sessao, false)).rejects.toThrow('Falha no armazenamento');
    expect(sessao.setSpellCheckerEnabled).not.toHaveBeenCalled();
  });

  it.each([null, 123, '', 'duas palavras', '<script>', 'a'.repeat(101)])('rejeita termo inválido %s', entrada => {
    expect(() => validarPalavraCorretor(entrada)).toThrow();
  });

  it('aceita termos técnicos com acentos, hífen e normaliza Unicode', () => {
    expect(validarPalavraCorretor('  projétil  ')).toBe('projétil');
    expect(validarPalavraCorretor('micro-estriamento')).toBe('micro-estriamento');
    expect(validarPalavraCorretor('proje\u0301til')).toBe('projétil');
  });
});
