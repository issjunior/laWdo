export interface AmostraProcessoDiagnostico {
  timestamp: string;
  pid: number;
  tipo: string;
  cpu: number;
  memoriaKb: number | null;
  atrasoEventLoopMs?: number | null;
}

export interface ContextoComparacaoDesempenho {
  finalidade: 'desempenho';
  cenario: string;
  versaoProtocolo: number;
  perfil: 'essencial' | 'completo';
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
  atrasoEventLoopMs: EstatisticaNumerica;
  degradacao: { ativa: boolean; motivo: string | null };
  ipcsLentos: Array<{ canal: string; ocorrencias: number; duracaoP95Ms: number }>;
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
      ? [{ timestamp: typeof dado.timestamp === 'string' ? dado.timestamp : new Date().toISOString(), pid: dado.pid, tipo: dado.tipo, cpu: dado.cpu, memoriaKb: typeof dado.memoriaKb === 'number' ? dado.memoriaKb : null, atrasoEventLoopMs: typeof dado.atrasoEventLoopMs === 'number' ? dado.atrasoEventLoopMs : null }]
      : [];
  });
}

export function resumirDesempenho(amostrasBrutas: unknown[], degradacao = { ativa: false, motivo: null as string | null }, eventosIpc: Array<{ canal: string; duracaoMs: number }> = []): ResumoDesempenhoDiagnostico {
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
  const atrasos = amostras.flatMap(amostra => typeof amostra.atrasoEventLoopMs === 'number' ? [amostra.atrasoEventLoopMs] : []);
  const porCanal = new Map<string, number[]>();
  eventosIpc.forEach(evento => porCanal.set(evento.canal, [...(porCanal.get(evento.canal) ?? []), evento.duracaoMs]));
  const ipcsLentos = [...porCanal.entries()].map(([canal, duracoes]) => ({ canal, ocorrencias: duracoes.length, duracaoP95Ms: percentil(duracoes, 0.95) ?? 0 })).filter(ipc => ipc.duracaoP95Ms >= 250).sort((a, b) => b.duracaoP95Ms - a.duracaoP95Ms);
  return { amostras: amostras.length, processos, gargalos, atrasoEventLoopMs: estatistica(atrasos), degradacao, ipcsLentos };
}

function percentualDelta(anterior: number | null, atual: number | null): number | null {
  if (anterior === null || atual === null || anterior === 0) return null;
  return Number((((atual - anterior) / Math.abs(anterior)) * 100).toFixed(2));
}

export function compararResumosDesempenho(antes: ResumoDesempenhoDiagnostico, depois: ResumoDesempenhoDiagnostico, contextoAntes?: ContextoComparacaoDesempenho, contextoDepois?: ContextoComparacaoDesempenho): { compativel: boolean; motivoIncompatibilidade?: string; deltas: Array<{ processo: string; pid: number; cpuP95: number | null; cpuP95Percentual: number | null; memoriaP95Kb: number | null; memoriaP95Percentual: number | null }>; atrasoEventLoopP95Ms: number | null; atrasoEventLoopP95Percentual: number | null } {
  const contextoCompativel = !contextoAntes || !contextoDepois || (
    contextoAntes.finalidade === contextoDepois.finalidade
    && contextoAntes.cenario === contextoDepois.cenario
    && contextoAntes.versaoProtocolo === contextoDepois.versaoProtocolo
  );
  const porChave = new Map(antes.processos.map(processo => [`${processo.pid}:${processo.tipo}`, processo]));
  const deltas = depois.processos.map(processo => {
    const anterior = porChave.get(`${processo.pid}:${processo.tipo}`);
    const cpuP95 = anterior?.cpu.p95 !== null && anterior?.cpu.p95 !== undefined && processo.cpu.p95 !== null ? Number((processo.cpu.p95 - anterior.cpu.p95).toFixed(2)) : null;
    const memoriaP95Kb = anterior?.memoriaKb.p95 !== null && anterior?.memoriaKb.p95 !== undefined && processo.memoriaKb.p95 !== null ? Number((processo.memoriaKb.p95 - anterior.memoriaKb.p95).toFixed(2)) : null;
    return { processo: processo.tipo, pid: processo.pid, cpuP95, cpuP95Percentual: percentualDelta(anterior?.cpu.p95 ?? null, processo.cpu.p95), memoriaP95Kb, memoriaP95Percentual: percentualDelta(anterior?.memoriaKb.p95 ?? null, processo.memoriaKb.p95) };
  });
  const compativel = contextoCompativel && antes.amostras > 0 && depois.amostras > 0;
  if (!compativel) {
    return {
      compativel: false,
      motivoIncompatibilidade: !contextoCompativel ? 'Cenário, finalidade ou versão de protocolo incompatível.' : 'Uma das capturas não possui amostras.',
      deltas: [],
      atrasoEventLoopP95Ms: null,
      atrasoEventLoopP95Percentual: null,
    };
  }
  return {
    compativel: true,
    deltas,
    atrasoEventLoopP95Ms: antes.atrasoEventLoopMs.p95 !== null && depois.atrasoEventLoopMs.p95 !== null ? Number((depois.atrasoEventLoopMs.p95 - antes.atrasoEventLoopMs.p95).toFixed(2)) : null,
    atrasoEventLoopP95Percentual: percentualDelta(antes.atrasoEventLoopMs.p95, depois.atrasoEventLoopMs.p95),
  };
}
