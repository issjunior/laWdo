export interface CredenciaisLoginValidadas {
  username: string;
  password: string;
}

export function validarCredenciaisLogin(username: unknown, password: unknown): CredenciaisLoginValidadas {
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new Error('Usuário e senha devem ser textos.');
  }

  const usernameNormalizado = username.trim();
  if (!usernameNormalizado || password.length === 0) {
    throw new Error('Usuário e senha são obrigatórios.');
  }
  if (usernameNormalizado.length > 254 || password.length > 1024) {
    throw new Error('Usuário ou senha excede o tamanho permitido.');
  }

  return { username: usernameNormalizado, password };
}
