import { describe, expect, it, vi } from 'vitest';
import {
  CHAVE_USUARIO_SESSAO,
  interpretarUsuarioSessao,
  lerUsuarioSessao,
  normalizarUsuarioSessao,
} from '@/lib/usuario-sessao';

describe('usuário persistido na sessão', () => {
  it('interpreta um objeto válido', () => {
    expect(interpretarUsuarioSessao('{"id":"usuario-1","username":"perito","nome":"Perito","email":"perito@example.test","ignorado":true}')).toEqual({
      id: 'usuario-1',
      username: 'perito',
      name: 'Perito',
      nome: 'Perito',
      email: 'perito@example.test',
    });
  });

  it.each(['{', '[]', '"texto"', 'null', '{}', '{"id":42}'])('rejeita conteúdo inválido: %s', raw => {
    expect(interpretarUsuarioSessao(raw)).toBeNull();
  });

  it('rejeita campos esperados com tipos incompatíveis', () => {
    expect(normalizarUsuarioSessao({
      id: 'usuario-1',
      username: 'perito',
      nome: 'Perito',
      email: 'perito@example.test',
      foto_url: 42,
    })).toBeNull();
  });

  it('remove do storage um valor inválido', () => {
    const storage = {
      getItem: vi.fn(() => '{'),
      removeItem: vi.fn(),
    };
    expect(lerUsuarioSessao(storage)).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(CHAVE_USUARIO_SESSAO);
  });
});
