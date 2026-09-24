import { useEffect } from 'react';
import type { EstadoCapturaDesempenho } from '@shared/desempenho/contratos';

interface MemoriaPerformance extends Performance {
  memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
}

export function DesempenhoBridge() {
  useEffect(() => {
    let longTasks = 0;
    let longTaskMaximaMs = 0;
    const observer = typeof PerformanceObserver === 'undefined' ? null : new PerformanceObserver(lista => {
      for (const entrada of lista.getEntries()) {
        if (entrada.duration >= 50) {
          longTasks += 1;
          longTaskMaximaMs = Math.max(longTaskMaximaMs, entrada.duration);
        }
      }
    });
    try { observer?.observe({ type: 'longtask', buffered: true }); } catch { observer?.disconnect(); }

    let perfil: EstadoCapturaDesempenho['perfil'] = 'importante';
    let temporizador: number | null = null;
    let esperado = performance.now() + 10_000;
    const coletar = () => {
      const agora = performance.now();
      const atrasoEventLoopMs = Math.max(0, agora - esperado);
      const intervalo = perfil === 'detalhado' ? 2_000 : 10_000;
      esperado = agora + intervalo;
      const memoria = (performance as MemoriaPerformance).memory;
      window.ipcAPI.desempenho.registrar({
        origem: 'renderer', categoria: 'amostra', evento: 'metricas_renderer',
        metricas: {
          heapUsado: memoria?.usedJSHeapSize ?? null,
          heapLimite: memoria?.jsHeapSizeLimit ?? null,
          atrasoEventLoopMs,
          longTasks,
          longTaskMaximaMs,
        },
      });
      longTasks = 0;
      longTaskMaximaMs = 0;
      temporizador = window.setTimeout(coletar, intervalo);
    };
    const atualizarPerfil = (estado: EstadoCapturaDesempenho) => {
      perfil = estado.sessao?.ativa ? 'detalhado' : estado.perfil;
      if (temporizador !== null) window.clearTimeout(temporizador);
      esperado = performance.now() + (perfil === 'detalhado' ? 2_000 : 10_000);
      temporizador = window.setTimeout(coletar, perfil === 'detalhado' ? 2_000 : 10_000);
    };
    const removerListener = window.ipcAPI.desempenho.onPerfilAlterado(atualizarPerfil);
    void window.ipcAPI.desempenho.estado().then(resposta => { if (resposta.success && resposta.data) atualizarPerfil(resposta.data); });
    return () => { if (temporizador !== null) window.clearTimeout(temporizador); removerListener(); observer?.disconnect(); };
  }, []);

  return null;
}
