import { afterEach, describe, expect, it } from 'vitest';
import { authSessaoService } from '../../main/services/auth-sessao.service';

const janelaId = 345;
const janelaFilhaId = 346;

afterEach(() => {
  authSessaoService.encerrar(janelaFilhaId);
  authSessaoService.encerrar(janelaId);
});

describe('sessão do backup', () => {
  it('permanece ativa ao mudar de rota dentro do mesmo documento', () => {
    authSessaoService.iniciar(janelaId, 'perito-1');

    authSessaoService.aoIniciarNavegacao(janelaId, { isMainFrame: true, isSameDocument: true });

    expect(authSessaoService.exigir(janelaId)).toBe('perito-1');
  });

  it('não é afetada por navegação de um quadro secundário', () => {
    authSessaoService.iniciar(janelaId, 'perito-1');

    authSessaoService.aoIniciarNavegacao(janelaId, { isMainFrame: false, isSameDocument: false });

    expect(authSessaoService.exigir(janelaId)).toBe('perito-1');
  });

  it('é revogada quando o documento principal é recarregado', () => {
    authSessaoService.iniciar(janelaId, 'perito-1');

    authSessaoService.aoIniciarNavegacao(janelaId, { isMainFrame: true, isSameDocument: false });

    expect(() => authSessaoService.exigir(janelaId)).toThrow('Faça login novamente');
  });

  it('compartilha a sessão apenas com uma janela filha vinculada e a revoga junto com a janela principal', () => {
    authSessaoService.iniciar(janelaId, 'perito-1');
    authSessaoService.vincularJanelaFilha(janelaId, janelaFilhaId);

    expect(authSessaoService.exigir(janelaFilhaId)).toBe('perito-1');

    authSessaoService.encerrar(janelaId);

    expect(() => authSessaoService.exigir(janelaFilhaId)).toThrow('Faça login novamente');
  });
});
