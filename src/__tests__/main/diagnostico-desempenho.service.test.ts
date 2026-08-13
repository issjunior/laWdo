import { describe, expect, it } from 'vitest';
import { compararResumosDesempenho, resumirDesempenho } from '@main/services/diagnostico-desempenho.service.js';

describe('diagnóstico de desempenho', () => {
  it('agrega percentis, tendência e gargalo de CPU sem conteúdo do renderer', () => {
    const resumo = resumirDesempenho([
      { timestamp: '2026-08-12T12:00:00.000Z', pid: 10, tipo: 'Browser', cpu: 5, memoriaKb: 100 },
      { timestamp: '2026-08-12T12:00:01.000Z', pid: 10, tipo: 'Browser', cpu: 25, memoriaKb: 120 },
      { timestamp: '2026-08-12T12:00:02.000Z', pid: 10, tipo: 'Browser', cpu: 30, memoriaKb: 140 },
    ]);
    expect(resumo.processos[0]).toMatchObject({ cpu: { p95: 30 }, memoriaKb: { tendencia: 'subindo' } });
    expect(resumo.gargalos.map(gargalo => gargalo.tipo)).toContain('cpu');
  });

  it('compara somente resumos com amostras', () => {
    const antes = resumirDesempenho([{ pid: 10, tipo: 'Browser', cpu: 10, memoriaKb: 100 }]);
    const depois = resumirDesempenho([{ pid: 10, tipo: 'Browser', cpu: 20, memoriaKb: 150 }]);
    expect(compararResumosDesempenho(antes, depois)).toMatchObject({ compativel: true, deltas: [{ cpuP95: 10, memoriaP95Kb: 50 }] });
  });
});
