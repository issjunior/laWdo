import { describe, expect, it } from 'vitest';
import {
  filtrarLaudosPorAba,
  filtrarRepsPorAba,
  obterAbaInicialLaudos,
  obterAbaInicialReps,
} from '@/lib/filtros-listas-laudos-reps';

describe('filtros das listas de laudos e REPs', () => {
  it('abre a aba do dashboard e retorna ao padrão ao limpar a URL', () => {
    expect(obterAbaInicialLaudos('')).toBe('em_andamento');
    expect(obterAbaInicialLaudos('?status=Conclu%C3%ADdo')).toBe('concluidos');
    expect(obterAbaInicialLaudos('?status=Entregue')).toBe('entregues');
    expect(obterAbaInicialLaudos('?prioridade=aguardando-entrega')).toBe('concluidos');
    expect(obterAbaInicialLaudos('?prioridade=sem-alteracao')).toBe('em_andamento');
    expect(obterAbaInicialReps('')).toBe('ativas');
    expect(obterAbaInicialReps('?status=Conclu%C3%ADdo')).toBe('concluidas');
    expect(obterAbaInicialReps('?status=Pendente')).toBe('pendentes');
    expect(obterAbaInicialReps('?prioridade=vencida')).toBe('ativas');
  });

  it('separa as listas por seus próprios status sem omitir registros de Todas', () => {
    const laudos = [
      { id: '1', status: 'Em andamento' },
      { id: '2', status: 'Concluído' },
      { id: '3', status: 'Entregue' },
    ];
    const reps = [
      { id: '1', status: 'Pendente' },
      { id: '2', status: 'Em Andamento' },
      { id: '3', status: 'Concluído' },
    ];
    expect(filtrarLaudosPorAba(laudos, 'em_andamento').map(item => item.id)).toEqual(['1']);
    expect(filtrarLaudosPorAba(laudos, 'entregues').map(item => item.id)).toEqual(['3']);
    expect(filtrarLaudosPorAba(laudos, 'todos')).toHaveLength(3);
    expect(filtrarRepsPorAba(reps, 'ativas').map(item => item.id)).toEqual(['1', '2']);
    expect(filtrarRepsPorAba(reps, 'concluidas').map(item => item.id)).toEqual(['3']);
    expect(filtrarRepsPorAba(reps, 'todas')).toHaveLength(3);
  });
});
