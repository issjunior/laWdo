import { describe, expect, it } from 'vitest';
import { validarCredenciaisLogin } from '@main/security/autenticacao';

describe('validação de credenciais de login', () => {
  it('normaliza somente o usuário e preserva a senha exatamente', () => {
    expect(validarCredenciaisLogin('  perito  ', '  <Senha:data:>  ')).toEqual({
      username: 'perito',
      password: '  <Senha:data:>  ',
    });
  });

  it('rejeita entradas inválidas sem incluir a senha na mensagem', () => {
    const senha = 'segredo-que-nao-pode-vazar';
    expect(() => validarCredenciaisLogin('', senha)).toThrow('Usuário e senha são obrigatórios.');
    try {
      validarCredenciaisLogin('', senha);
    } catch (erro) {
      expect(String(erro)).not.toContain(senha);
    }
  });
});
