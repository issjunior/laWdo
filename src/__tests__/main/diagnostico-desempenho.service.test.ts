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
    expect(compararResumosDesempenho(antes, depois)).toMatchObject({ compativel: true, deltas: [{ cpuP95: 10, cpuP95Percentual: 100, memoriaP95Kb: 50, memoriaP95Percentual: 50 }] });
  });

  it('recusa comparar cenários ou versões de protocolo incompatíveis', () => {
    const resumo = resumirDesempenho([{ pid: 10, tipo: 'Browser', cpu: 10, memoriaKb: 100, atrasoEventLoopMs: 4 }]);
    expect(compararResumosDesempenho(
      resumo,
      resumo,
      { finalidade: 'desempenho', cenario: 'geral', versaoProtocolo: 1, perfil: 'completo' },
      { finalidade: 'desempenho', cenario: 'uso_editor', versaoProtocolo: 1, perfil: 'completo' },
    )).toMatchObject({ compativel: false, motivoIncompatibilidade: expect.stringContaining('incompatível'), deltas: [], atrasoEventLoopP95Ms: null });
  });

  it('prioriza IPC lento sem persistir a linha de eventos detalhada', () => {
    const resumo = resumirDesempenho(
      [{ pid: 10, tipo: 'Browser', cpu: 10, memoriaKb: 100 }],
      { ativa: true, motivo: 'LIMITE_AMOSTRAS' },
      [{ canal: 'laudo:salvar', duracaoMs: 300 }, { canal: 'laudo:salvar', duracaoMs: 500 }],
    );
    expect(resumo).toMatchObject({ degradacao: { ativa: true }, ipcsLentos: [{ canal: 'laudo:salvar', duracaoP95Ms: 500 }] });
  });
});
