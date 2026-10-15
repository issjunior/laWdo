export const normalizarNomeTipoExame = (nome: string): string =>
  nome.toLocaleUpperCase('pt-BR').replace(/\bEXAME\b/g, '').replace(/\s+/g, ' ').trim();
