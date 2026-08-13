export interface AmostraProcessoDiagnostico {
  timestamp: string;
  pid: number;
  tipo: string;
  cpu: number;
  memoriaKb: number | null;
}

interface EstatisticaNumerica {
  mediana: number | null;
  p95: number | null;
  maximo: number | null;
  tendencia: 'subindo' | 'descendo' | 'estavel' | 'indisponivel';
}

export interface ResumoDesempenhoDiagnostico {
  amostras: number;
  processos: Array<{
    pid: number;
    tipo: string;
    cpu: EstatisticaNumerica;
    memoriaKb: EstatisticaNumerica;
  }>;
  gargalos: Array<{ tipo: 'cpu' | 'memoria'; pid: number; processo: string; valor: number; descricao: string }>;
}

function percentil(valores: number[], percentual: number): number | null {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.ceil((ordenados.length - 1) * percentual));
  return Number(ordenados[indice]?.toFixed(2));
}

function estatistica(valores: number[]): EstatisticaNumerica {
  if (!valores.length) return { mediana: null, p95: null, maximo: null, tendencia: 'indisponivel' };
  const metade = Math.max(1, Math.floor(valores.length / 2));
  const inicio = valores.slice(0, metade).reduce((soma, valor) => soma + valor, 0) / metade;
  const fim = valores.slice(-metade).reduce((soma, valor) => soma + valor, 0) / metade;
  const limite = Math.max(1, Math.abs(inicio) * 0.1);
  return {
    mediana: percentil(valores, 0.5), p95: percentil(valores, 0.95), maximo: percentil(valores, 1),
    tendencia: fim - inicio > limite ? 'subindo' : inicio - fim > limite ? 'descendo' : 'estavel',
  };
}

export function normalizarAmostrasDesempenho(valor: unknown[]): AmostraProcessoDiagnostico[] {
  return valor.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const dado = item as Record<string, unknown>;
    return typeof dado.pid === 'number' && typeof dado.tipo === 'string' && typeof dado.cpu === 'number'
      ? [{ timestamp: typeof dado.timestamp === 'string' ? dado.timestamp : new Date().toISOString(), pid: dado.pid, tipo: dado.tipo, cpu: dado.cpu, memoriaKb: typeof dado.memoriaKb === 'number' ? dado.memoriaKb : null }]
      : [];
  });
}

export function resumirDesempenho(amostrasBrutas: unknown[]): ResumoDesempenhoDiagnostico {
  const amostras = normalizarAmostrasDesempenho(amostrasBrutas);
  const grupos = new Map<string, AmostraProcessoDiagnostico[]>();
  for (const amostra of amostras) {
    const chave = `${amostra.pid}:${amostra.tipo}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), amostra]);
  }
  const processos = [...grupos.values()].map(grupo => ({
    pid: grupo[0]!.pid, tipo: grupo[0]!.tipo,
    cpu: estatistica(grupo.map(amostra => amostra.cpu)),
    memoriaKb: estatistica(grupo.flatMap(amostra => amostra.memoriaKb === null ? [] : [amostra.memoriaKb])),
  }));
  const gargalos = processos.flatMap(processo => {
    const itens: ResumoDesempenhoDiagnostico['gargalos'] = [];
    if ((processo.cpu.p95 ?? 0) >= 20) itens.push({ tipo: 'cpu', pid: processo.pid, processo: processo.tipo, valor: processo.cpu.p95!, descricao: `O processo ${processo.tipo} atingiu p95 de CPU de ${processo.cpu.p95}%.` });
    if ((processo.memoriaKb.tendencia === 'subindo') && processo.memoriaKb.p95 !== null) itens.push({ tipo: 'memoria', pid: processo.pid, processo: processo.tipo, valor: processo.memoriaKb.p95, descricao: `A memória do processo ${processo.tipo} apresentou tendência de alta.` });
    return itens;
  }).sort((a, b) => b.valor - a.valor);
  return { amostras: amostras.length, processos, gargalos };
}

export function compararResumosDesempenho(antes: ResumoDesempenhoDiagnostico, depois: ResumoDesempenhoDiagnostico): { compativel: boolean; deltas: Array<{ processo: string; pid: number; cpuP95: number | null; memoriaP95Kb: number | null }> } {
  const porChave = new Map(antes.processos.map(processo => [`${processo.pid}:${processo.tipo}`, processo]));
  const deltas = depois.processos.map(processo => {
    const anterior = porChave.get(`${processo.pid}:${processo.tipo}`);
    return {
      processo: processo.tipo, pid: processo.pid,
      cpuP95: anterior?.cpu.p95 !== null && anterior?.cpu.p95 !== undefined && processo.cpu.p95 !== null ? Number((processo.cpu.p95 - anterior.cpu.p95).toFixed(2)) : null,
      memoriaP95Kb: anterior?.memoriaKb.p95 !== null && anterior?.memoriaKb.p95 !== undefined && processo.memoriaKb.p95 !== null ? Number((processo.memoriaKb.p95 - anterior.memoriaKb.p95).toFixed(2)) : null,
    };
  });
  return { compativel: antes.amostras > 0 && depois.amostras > 0, deltas };
}
