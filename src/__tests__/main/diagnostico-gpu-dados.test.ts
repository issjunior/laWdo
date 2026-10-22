import { describe, expect, it } from 'vitest';
import { normalizarAmbienteGpu, normalizarEventosWindowsGpu, normalizarProcessosGpu, sanitizarTextoGpu } from '@main/services/diagnostico-gpu-dados.js';

describe('normalização gráfica', () => {
  it('seleciona apenas campos técnicos e rejeita dados dinâmicos inválidos', () => {
    expect(normalizarAmbienteGpu(null, null)).toEqual({ adaptadores: [], atributos: {}, recursos: {} });
    expect(normalizarProcessosGpu([{ pid: 1, type: 'Utility' }, { pid: -1, type: 'GPU' }, { pid: 2, type: 'Tab', cpu: { percentCPUUsage: NaN } }])).toEqual([{ pid: 2, tipo: 'Renderer', cpu: null, memoriaKb: null }]);
    expect(sanitizarTextoGpu('gpu driver email=a@b.com token=abc https://host/segredo')).not.toMatch(/abc|segredo|a@b.com/);
  });
  it('distingue relatório antigo reenviado de dump contemporâneo', () => {
    const inicio = Date.parse('2026-10-21T18:33:00Z'); const fim = Date.parse('2026-10-21T18:36:00Z');
    const base = { horario: '2026-10-21T18:35:25Z', provedor: 'Windows Error Reporting', codigo: '141', dump: 'C:\\Windows\\WATCHDOG-20261021-1535.dmp' };
    expect(normalizarEventosWindowsGpu([{ ...base, horarioDump: '2026-10-21T18:35:00Z' }, { ...base, horarioDump: '2026-10-21T14:38:00Z' }, base], inicio, fim).map(item => item.correlacao)).toEqual(['contemporaneo', 'relatorio_antigo', 'sem_horario_dump']);
    expect(normalizarEventosWindowsGpu([base], inicio, fim)[0]?.dump).toBe('WATCHDOG-20261021-1535.dmp');
  });
});
