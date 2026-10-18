export interface AvisoReiteracaoGdl {
  numero: string;
  ano: string;
  reiterando: boolean;
  fonte: 'html' | 'api';
  consultadoEm: string;
}

export function normalizarTipoReiteracao(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function chaveRepReiteracao(numeroCompleto: string): string | null {
  const partes = numeroCompleto.trim().match(/^([\d.\s]+)\s*[/\\-]\s*(\d{4})$/);
  if (!partes) return null;
  const numero = partes[1].replace(/\D/g, '').replace(/^0+/, '');
  return numero ? `${numero}/${partes[2]}` : null;
}

export function apiContemOficioReiterando(dados: unknown): boolean {
  if (!dados || typeof dados !== 'object' || !('origens' in dados) || !Array.isArray(dados.origens)) return false;
  return dados.origens.some((origem: unknown) => origem !== null && typeof origem === 'object'
    && 'tipo' in origem && typeof origem.tipo === 'string'
    && normalizarTipoReiteracao(origem.tipo) === 'OFICIO REITERANDO');
}
