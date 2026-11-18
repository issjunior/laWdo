export const STATUS_REP = ['Pendente', 'Em Andamento', 'Concluído'] as const;
export const STATUS_LAUDO = ['Em andamento', 'Concluído', 'Entregue'] as const;

export type StatusRep = (typeof STATUS_REP)[number];
export type StatusLaudo = (typeof STATUS_LAUDO)[number];

export const CAMPOS_DATA_CIVIL_REP = [
  'data_requisicao', 'prazo', 'data_documento', 'data_acionamento', 'data_chegada', 'data_saida',
] as const;

const formatoDataCivil = /^\d{4}-\d{2}-\d{2}$/;

export function normalizarDataCivil(valor: unknown, campo: string, obrigatoria = false): string | null {
  if (valor === undefined || valor === null || valor === '') {
    if (obrigatoria) throw new Error(`${campo} é obrigatório.`);
    return null;
  }
  if (typeof valor !== 'string') throw new Error(`${campo} deve usar o formato AAAA-MM-DD.`);
  const data = valor.slice(0, 10);
  if (!formatoDataCivil.test(data)) throw new Error(`${campo} deve usar o formato AAAA-MM-DD.`);
  const [ano, mes, dia] = data.split('-').map(Number);
  const validada = new Date(Date.UTC(ano, mes - 1, dia));
  if (validada.getUTCFullYear() !== ano || validada.getUTCMonth() !== mes - 1 || validada.getUTCDate() !== dia) {
    throw new Error(`${campo} contém uma data inválida.`);
  }
  return data;
}

export function normalizarDatasCivisRep<T extends Record<string, unknown>>(dados: T): T {
  const normalizado: Record<string, unknown> = { ...dados };
  for (const campo of CAMPOS_DATA_CIVIL_REP) {
    if (!(campo in normalizado)) continue;
    normalizado[campo] = normalizarDataCivil(normalizado[campo], campo, campo === 'data_requisicao');
  }
  return normalizado as T;
}
