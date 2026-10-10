export const CHAVE_USUARIO_SESSAO = 'lawdo_auth_user';

export interface UsuarioSessao {
  [key: string]: unknown;
  id: string;
  username: string;
  name: string;
  nome: string;
  email: string;
  role?: string | null;
  cargo?: string | null;
  forma_tratamento: 'masculino' | 'feminino';
  lotacao?: string | null;
  foto_url?: string | null;
  matricula?: string | null;
  especialidade?: string | null;
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function ehTextoObrigatorio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function ehTextoOpcional(valor: unknown): valor is string | null | undefined {
  return valor === undefined || valor === null || typeof valor === 'string';
}

export function normalizarUsuarioSessao(valor: unknown): UsuarioSessao | null {
  if (!ehRegistro(valor)) return null;

  const nome = ehTextoObrigatorio(valor.name)
    ? valor.name
    : ehTextoObrigatorio(valor.nome)
      ? valor.nome
      : null;
  if (
    !ehTextoObrigatorio(valor.id)
    || !ehTextoObrigatorio(valor.username)
    || !ehTextoObrigatorio(valor.email)
    || !nome
    || !ehTextoOpcional(valor.role)
    || !ehTextoOpcional(valor.cargo)
    || (valor.forma_tratamento !== undefined && valor.forma_tratamento !== 'masculino' && valor.forma_tratamento !== 'feminino')
    || !ehTextoOpcional(valor.lotacao)
    || !ehTextoOpcional(valor.foto_url)
    || !ehTextoOpcional(valor.matricula)
    || !ehTextoOpcional(valor.especialidade)
  ) return null;

  return {
    id: valor.id,
    username: valor.username,
    name: nome,
    nome,
    email: valor.email,
    forma_tratamento: valor.forma_tratamento === 'feminino' ? 'feminino' : 'masculino',
    ...(valor.role !== undefined ? { role: valor.role } : {}),
    ...(valor.cargo !== undefined ? { cargo: valor.cargo } : {}),
    ...(valor.lotacao !== undefined ? { lotacao: valor.lotacao } : {}),
    ...(valor.foto_url !== undefined ? { foto_url: valor.foto_url } : {}),
    ...(valor.matricula !== undefined ? { matricula: valor.matricula } : {}),
    ...(valor.especialidade !== undefined ? { especialidade: valor.especialidade } : {}),
  };
}

export function interpretarUsuarioSessao(raw: string | null): UsuarioSessao | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return normalizarUsuarioSessao(parsed);
  } catch {
    return null;
  }
}

export function lerUsuarioSessao(storage: Pick<Storage, 'getItem' | 'removeItem'> = window.sessionStorage): UsuarioSessao | null {
  const raw = storage.getItem(CHAVE_USUARIO_SESSAO);
  const usuario = interpretarUsuarioSessao(raw);
  if (raw && !usuario) storage.removeItem(CHAVE_USUARIO_SESSAO);
  return usuario;
}

export function salvarUsuarioSessao(usuario: unknown, storage: Pick<Storage, 'setItem'> = window.sessionStorage): UsuarioSessao {
  const normalizado = normalizarUsuarioSessao(usuario);
  if (!normalizado) throw new Error('Dados de usuário inválidos para a sessão.');
  storage.setItem(CHAVE_USUARIO_SESSAO, JSON.stringify(normalizado));
  return normalizado;
}
