export type AbaLaudos = 'todos' | 'em_andamento' | 'concluidos' | 'entregues';
export type AbaReps = 'ativas' | 'pendentes' | 'em_andamento' | 'concluidas' | 'todas';

export function obterAbaInicialLaudos(busca: string): AbaLaudos {
  const parametros = new URLSearchParams(busca);
  const status = parametros.get('status');
  if (status === 'Concluído' || parametros.get('prioridade') === 'aguardando-entrega') return 'concluidos';
  if (status === 'Entregue') return 'entregues';
  return 'em_andamento';
}

export function obterAbaInicialReps(busca: string): AbaReps {
  const status = new URLSearchParams(busca).get('status');
  if (status === 'Pendente') return 'pendentes';
  if (status === 'Em Andamento') return 'em_andamento';
  if (status === 'Concluído') return 'concluidas';
  return 'ativas';
}

export function filtrarLaudosPorAba<T extends { status: string }>(laudos: T[], aba: AbaLaudos): T[] {
  if (aba === 'todos') return laudos;
  const status: Record<Exclude<AbaLaudos, 'todos'>, string> = {
    em_andamento: 'Em andamento',
    concluidos: 'Concluído',
    entregues: 'Entregue',
  };
  return laudos.filter(laudo => laudo.status === status[aba]);
}

export function filtrarRepsPorAba<T extends { status: string }>(reps: T[], aba: AbaReps): T[] {
  if (aba === 'todas') return reps;
  if (aba === 'ativas') return reps.filter(rep => rep.status === 'Pendente' || rep.status === 'Em Andamento');
  const status: Record<Exclude<AbaReps, 'todas' | 'ativas'>, string> = {
    pendentes: 'Pendente',
    em_andamento: 'Em Andamento',
    concluidas: 'Concluído',
  };
  return reps.filter(rep => rep.status === status[aba]);
}
