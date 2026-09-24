import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type {
  AchadoCapturaLogs,
  CapturaLogsAtiva,
  CapturaLogsConcluida,
  CoberturaSondaCapturaLogs,
  EstadoCapturaLogs,
  EstatisticaMetricaCapturaLogs,
  EventoCapturaLogs,
  NivelCapturaLogs,
  MotivoEncerramentoCapturaLogs,
  ResumoAnaliticoCapturaLogs,
  ResumoCapturaLogs,
  SondaCapturaLogs,
} from '../../shared/captura-logs/contratos.js';
import { SONDAS_CAPTURA_LOGS } from '../../shared/captura-logs/contratos.js';
import type { EventoDesempenhoEntrada } from '../../shared/desempenho/contratos.js';

const DURACAO_MAXIMA_MS = 5 * 60_000;
const MAXIMO_CAPTURAS = 10;
const MAXIMO_BYTES = 50 * 1024 * 1024;
const LIMITE_FILA = 1_000;
const PADRAO_CODIGO = /^[a-z0-9:_-]{1,100}$/i;
const METRICAS_AGREGADAS = ['duracaoMs', 'cpuPercentual', 'memoriaKb', 'heapUsado', 'heapLimite', 'atrasoEventLoopMs', 'longTasks', 'longTaskMaximaMs', 'nosDom', 'tabelas', 'celulas', 'imagens'] as const;
const METADADOS_DESEMPENHO_PERMITIDOS = new Set(['quantidade', 'bytesEntrada', 'bytesSaida', 'linhas', 'itensRenderizados', 'imagensMemoria', 'tentativas', 'arquivosRelidos', 'sucesso', 'falhou', 'incremental', 'fallback']);
const LIMIAR_OPERACAO_LENTA_MS = 250;
const LIMIAR_OPERACAO_CRITICA_MS = 2_000;
const LIMIAR_ATRASO_EVENT_LOOP_MS = 200;
const LIMIAR_CRESCIMENTO_MEMORIA_KB = 64 * 1024;

interface ArquivoCapturaAtiva {
  captura: CapturaLogsAtiva;
  salt: string;
  eventosDescartados: number;
}

function diretorioCapturas(): string {
  return path.join(app.getPath('userData'), 'capturas-logs');
}

function caminhoAtiva(): string {
  return path.join(diretorioCapturas(), 'captura-ativa.json');
}

function caminhoEventos(id: string): string {
  return path.join(diretorioCapturas(), `${id}.ndjson`);
}

function caminhoCaptura(id: string): string {
  return path.join(diretorioCapturas(), `${id}.json`);
}

function codigoSeguro(valor: string): string | null {
  return PADRAO_CODIGO.test(valor) ? valor : null;
}

function registro(valor: unknown): valor is Record<string, unknown> {
  return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);
}

function capturaValida(valor: unknown): valor is CapturaLogsConcluida {
  if (!registro(valor) || valor.versaoFormato !== 2 || typeof valor.id !== 'string' || !Array.isArray(valor.sondas) || !Array.isArray(valor.eventos) || !Array.isArray(valor.coberturaSondas) || !registro(valor.resumo)) return false;
  if (!valor.sondas.every(sonda => typeof sonda === 'string' && SONDAS_CAPTURA_LOGS.includes(sonda as SondaCapturaLogs))) return false;
  if (!valor.eventos.every(evento => registro(evento) && typeof evento.timestamp === 'string' && typeof evento.codigo === 'string' && typeof evento.nivel === 'string' && registro(evento.dados))) return false;
  return typeof valor.iniciadaEm === 'string' && typeof valor.finalizadaEm === 'string' && typeof valor.quantidadeEventos === 'number' && typeof valor.eventosDescartados === 'number' && typeof valor.qualidade === 'string';
}

function numeroSeguro(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? Number(valor.toFixed(2)) : null;
}

function arredondar(valor: number): number {
  return Number(valor.toFixed(2));
}

function estatisticaMetrica(metrica: string, valores: number[]): EstatisticaMetricaCapturaLogs | null {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const soma = ordenados.reduce((total, valor) => total + valor, 0);
  return {
    metrica,
    quantidade: ordenados.length,
    minimo: arredondar(ordenados[0]),
    maximo: arredondar(ordenados.at(-1) ?? 0),
    media: arredondar(soma / ordenados.length),
    p95: arredondar(ordenados[Math.max(0, Math.ceil(ordenados.length * 0.95) - 1)]),
  };
}

function dadosNumericos(eventos: EventoCapturaLogs[], metrica: string): number[] {
  return eventos.flatMap(evento => {
    const valor = evento.dados[metrica];
    return typeof valor === 'number' && Number.isFinite(valor) ? [valor] : [];
  });
}

function contagensPorCodigo(eventos: EventoCapturaLogs[]): { codigo: string; quantidade: number }[] {
  const contagens = new Map<string, number>();
  eventos.forEach(evento => contagens.set(evento.codigo, (contagens.get(evento.codigo) ?? 0) + 1));
  return [...contagens.entries()]
    .map(([codigo, quantidade]) => ({ codigo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.codigo.localeCompare(b.codigo));
}

function coberturaSondas(eventos: EventoCapturaLogs[], sondas: SondaCapturaLogs[]): CoberturaSondaCapturaLogs[] {
  return sondas.map(sonda => {
    const eventosSonda = eventos.filter(evento => evento.sonda === sonda);
    return {
      sonda,
      quantidadeEventos: eventosSonda.length,
      quantidadeAvisos: eventosSonda.filter(evento => evento.nivel === 'aviso' || evento.nivel === 'critico').length,
      quantidadeErros: eventosSonda.filter(evento => evento.nivel === 'erro' || evento.nivel === 'critico').length,
      possuiEvidencia: eventosSonda.length > 0,
    };
  });
}

function achadosCaptura(eventos: EventoCapturaLogs[], cobertura: CoberturaSondaCapturaLogs[], metricas: EstatisticaMetricaCapturaLogs[]): AchadoCapturaLogs[] {
  const achados: AchadoCapturaLogs[] = cobertura
    .filter(sonda => !sonda.possuiEvidencia)
    .map(sonda => ({ tipo: 'sonda_sem_evidencia', codigo: `sonda:${sonda.sonda}`, nivel: 'info', ocorrencias: 0, dados: { sonda: sonda.sonda } }));
  const erros = new Map<string, EventoCapturaLogs[]>();
  eventos.filter(evento => evento.nivel === 'erro' || evento.nivel === 'critico').forEach(evento => {
    const chave = `${evento.sonda}:${evento.codigo}`;
    erros.set(chave, [...(erros.get(chave) ?? []), evento]);
  });
  erros.forEach((eventosErro, chave) => {
    const nivel: NivelCapturaLogs = eventosErro.some(evento => evento.nivel === 'critico') ? 'critico' : 'erro';
    achados.push({ tipo: eventosErro.length > 1 ? 'erros_repetidos' : 'erro_detectado', codigo: chave, nivel, ocorrencias: eventosErro.length, dados: { codigoEvento: eventosErro[0].codigo } });
  });
  const operacoes = new Map<string, number[]>();
  eventos.filter(evento => evento.sonda === 'desempenho' && typeof evento.dados.duracaoMs === 'number').forEach(evento => {
    const codigo = typeof evento.dados.operacao === 'string' ? evento.dados.operacao : evento.codigo;
    operacoes.set(codigo, [...(operacoes.get(codigo) ?? []), evento.dados.duracaoMs as number]);
  });
  operacoes.forEach((duracoes, codigo) => {
    const estatistica = estatisticaMetrica('duracaoMs', duracoes);
    if (!estatistica || (estatistica.p95 < LIMIAR_OPERACAO_LENTA_MS && estatistica.maximo < LIMIAR_OPERACAO_LENTA_MS)) return;
    achados.push({ tipo: 'operacao_lenta', codigo, nivel: estatistica.maximo >= LIMIAR_OPERACAO_CRITICA_MS ? 'critico' : 'aviso', ocorrencias: estatistica.quantidade, dados: { duracaoP95Ms: estatistica.p95, duracaoMaximaMs: estatistica.maximo, limiarMs: LIMIAR_OPERACAO_LENTA_MS } });
  });
  const atrasoEventLoop = metricas.find(metrica => metrica.metrica === 'atrasoEventLoopMs');
  if (atrasoEventLoop && atrasoEventLoop.maximo >= LIMIAR_ATRASO_EVENT_LOOP_MS) {
    achados.push({ tipo: 'atraso_event_loop', codigo: 'atraso_event_loop', nivel: atrasoEventLoop.maximo >= LIMIAR_OPERACAO_CRITICA_MS ? 'critico' : 'aviso', ocorrencias: atrasoEventLoop.quantidade, dados: { atrasoMaximoMs: atrasoEventLoop.maximo, atrasoP95Ms: atrasoEventLoop.p95, limiarMs: LIMIAR_ATRASO_EVENT_LOOP_MS } });
  }
  const longTasks = metricas.find(metrica => metrica.metrica === 'longTasks');
  if (longTasks && longTasks.maximo > 0) {
    achados.push({ tipo: 'long_tasks', codigo: 'long_tasks_detectadas', nivel: 'aviso', ocorrencias: Math.round(longTasks.media * longTasks.quantidade), dados: { longTasksMaximo: longTasks.maximo, longTasksMedia: longTasks.media } });
  }
  const memoria = dadosNumericos(eventos.filter(evento => evento.sonda === 'desempenho'), 'memoriaKb');
  if (memoria.length >= 3) {
    const crescimento = memoria.at(-1)! - memoria[0];
    if (crescimento >= LIMIAR_CRESCIMENTO_MEMORIA_KB) achados.push({ tipo: 'memoria_crescente', codigo: 'memoria_crescente', nivel: 'aviso', ocorrencias: memoria.length, dados: { crescimentoKb: arredondar(crescimento), amostras: memoria.length, limiarKb: LIMIAR_CRESCIMENTO_MEMORIA_KB } });
  }
  return achados;
}

function resumoAnalitico(eventos: EventoCapturaLogs[], sondas: SondaCapturaLogs[], iniciadaEm: string, finalizadaEm: string): ResumoAnaliticoCapturaLogs {
  const cobertura = coberturaSondas(eventos, sondas);
  const metricas = METRICAS_AGREGADAS.flatMap(metrica => {
    const estatistica = estatisticaMetrica(metrica, dadosNumericos(eventos, metrica));
    return estatistica ? [estatistica] : [];
  });
  return {
    duracaoMs: Math.max(0, Date.parse(finalizadaEm) - Date.parse(iniciadaEm)),
    quantidadeEventosUteis: eventos.filter(evento => evento.sonda !== 'marcador').length,
    marcadores: eventos.filter(evento => evento.sonda === 'marcador').map(evento => ({ codigo: evento.codigo, timestamp: evento.timestamp })),
    coberturaSondas: cobertura,
    eventosPorCodigo: contagensPorCodigo(eventos),
    metricas,
    achados: achadosCaptura(eventos, cobertura, metricas),
  };
}

function qualidadeCaptura(resumo: ResumoAnaliticoCapturaLogs, eventosDescartados: number): 'suficiente' | 'parcial' | 'sem_evidencia' {
  if (!resumo.quantidadeEventosUteis) return 'sem_evidencia';
  if (eventosDescartados || resumo.coberturaSondas.some(sonda => !sonda.possuiEvidencia)) return 'parcial';
  return 'suficiente';
}

export class CapturaLogsService {
  private ativa: CapturaLogsAtiva | null = null;
  private salt = '';
  private eventosDescartados = 0;
  private fila: EventoCapturaLogs[] = [];
  private gravacao: Promise<void> | null = null;
  private temporizador: NodeJS.Timeout | null = null;
  private aoAlterarEstado: ((estado: EstadoCapturaLogs) => void) | null = null;
  private aoEncerrar: ((sondas: SondaCapturaLogs[]) => Promise<void>) | null = null;

  configurarCallbacks(
    aoAlterarEstado: (estado: EstadoCapturaLogs) => void,
    aoEncerrar: (sondas: SondaCapturaLogs[]) => Promise<void>,
  ): void {
    this.aoAlterarEstado = aoAlterarEstado;
    this.aoEncerrar = aoEncerrar;
  }

  async inicializar(): Promise<void> {
    await fs.mkdir(diretorioCapturas(), { recursive: true });
    try {
      const arquivo = JSON.parse(await fs.readFile(caminhoAtiva(), 'utf8')) as ArquivoCapturaAtiva;
      if (arquivo.captura?.id && Array.isArray(arquivo.captura.sondas)) {
        this.ativa = arquivo.captura;
        this.salt = arquivo.salt;
        this.eventosDescartados = arquivo.eventosDescartados ?? 0;
        await this.finalizar('interrompida');
      }
    } catch {
      // Não havia captura pendente.
    }
  }

  obterEstado(): EstadoCapturaLogs {
    return { ativa: this.ativa };
  }

  async iniciar(sondas: SondaCapturaLogs[]): Promise<EstadoCapturaLogs> {
    if (this.ativa) throw new Error('CAPTURA_ATIVA');
    const selecionadas = [...new Set(sondas)].filter((sonda): sonda is SondaCapturaLogs => SONDAS_CAPTURA_LOGS.includes(sonda));
    if (!selecionadas.length) throw new Error('SONDAS_INVALIDAS');
    const agora = Date.now();
    this.ativa = { id: randomUUID(), sondas: selecionadas, iniciadaEm: new Date(agora).toISOString(), terminaEm: new Date(agora + DURACAO_MAXIMA_MS).toISOString() };
    this.salt = randomUUID();
    this.eventosDescartados = 0;
    await this.persistirAtiva();
    await this.registrar('marcador', 'captura_iniciada', 'info', { quantidadeSondas: selecionadas.length });
    this.agendarExpiracao();
    this.publicarEstado();
    return this.obterEstado();
  }

  async parar(): Promise<EstadoCapturaLogs> {
    if (this.ativa) await this.finalizar('manual');
    return this.obterEstado();
  }

  async marcarProblema(): Promise<void> {
    await this.registrar('marcador', 'problema_aconteceu_agora', 'aviso', {});
  }

  async registrarSistema(nivel: 'warn' | 'error', modulo: string): Promise<void> {
    if (!this.sondaAtiva('sistema')) return;
    const codigoModulo = codigoSeguro(modulo);
    await this.registrar('sistema', nivel === 'error' ? 'erro_tecnico' : 'aviso_tecnico', nivel === 'error' ? 'erro' : 'aviso', { modulo: codigoModulo });
  }

  async registrarAuditoria(entrada: { modulo: string; tipoAcao: string; entidade: string; entidadeId?: string | null; nivel?: string }): Promise<void> {
    const contexto = entrada.entidadeId ? this.identificadorOpaco(entrada.entidadeId) : null;
    const resultado = entrada.nivel === 'error' ? 'falha' : 'registrada';
    if (this.sondaAtiva('auditoria')) {
      await this.registrar('auditoria', 'acao_auditada', entrada.nivel === 'error' ? 'erro' : 'info', {
        modulo: codigoSeguro(entrada.modulo),
        tipoAcao: codigoSeguro(entrada.tipoAcao),
        entidade: codigoSeguro(entrada.entidade),
        resultado,
        contexto,
      });
    }
    if (this.sondaAtiva('linha_tempo') && (entrada.modulo === 'rep' || entrada.modulo === 'laudo')) {
      await this.registrar('linha_tempo', 'evento_ciclo_vida', 'info', {
        modulo: entrada.modulo,
        tipoAcao: codigoSeguro(entrada.tipoAcao),
        entidade: entrada.entidade === 'reps' || entrada.entidade === 'laudos' ? entrada.entidade : null,
        resultado,
        contexto,
      });
    }
  }

  async registrarDesempenho(entrada: EventoDesempenhoEntrada): Promise<void> {
    if (!this.sondaAtiva('desempenho')) return;
    const metricas = entrada.metricas ?? {};
    await this.registrar('desempenho', codigoSeguro(entrada.evento) ?? 'evento_desempenho', entrada.duracaoMs && entrada.duracaoMs >= 2_000 ? 'critico' : entrada.duracaoMs && entrada.duracaoMs >= 250 ? 'aviso' : 'info', {
      origem: codigoSeguro(entrada.origem),
      categoria: codigoSeguro(entrada.categoria),
      operacao: entrada.operacao ? codigoSeguro(entrada.operacao) : null,
      canal: entrada.canal ? codigoSeguro(entrada.canal) : null,
      duracaoMs: numeroSeguro(entrada.duracaoMs),
      cpuPercentual: numeroSeguro(metricas.cpuPercentual),
      memoriaKb: numeroSeguro(metricas.memoriaKb),
      atrasoEventLoopMs: numeroSeguro(metricas.atrasoEventLoopMs),
      longTasks: numeroSeguro(metricas.longTasks),
      longTaskMaximaMs: numeroSeguro(metricas.longTaskMaximaMs),
      heapUsado: numeroSeguro(metricas.heapUsado),
      heapLimite: numeroSeguro(metricas.heapLimite),
      nosDom: numeroSeguro(metricas.nosDom),
      tabelas: numeroSeguro(metricas.tabelas),
      celulas: numeroSeguro(metricas.celulas),
      imagens: numeroSeguro(metricas.imagens),
      contexto: entrada.contextoId ? this.identificadorOpaco(entrada.contextoId) : null,
      ...Object.fromEntries(Object.entries(entrada.metadados ?? {}).flatMap(([chave, valor]) => {
        if (!METADADOS_DESEMPENHO_PERMITIDOS.has(chave)) return [];
        const valorSeguro = typeof valor === 'boolean' ? valor : numeroSeguro(valor);
        return valorSeguro === null ? [] : [[`metadado_${chave}`, valorSeguro]];
      })),
    });
  }

  async listar(): Promise<ResumoCapturaLogs[]> {
    await this.garantirGravacao();
    const arquivos = (await fs.readdir(diretorioCapturas())).filter(arquivo => /^[a-f0-9-]+\.json$/i.test(arquivo));
    const capturas = await Promise.all(arquivos.map(async arquivo => {
      try {
        const captura = JSON.parse(await fs.readFile(path.join(diretorioCapturas(), arquivo), 'utf8')) as CapturaLogsConcluida;
        if (!capturaValida(captura)) return null;
        return {
          id: captura.id,
          sondas: captura.sondas,
          iniciadaEm: captura.iniciadaEm,
          finalizadaEm: captura.finalizadaEm,
          motivoEncerramento: captura.motivoEncerramento,
        quantidadeEventos: captura.quantidadeEventos,
        eventosDescartados: captura.eventosDescartados,
        qualidade: captura.qualidade,
        coberturaSondas: captura.coberturaSondas,
      };
      } catch {
        return null;
      }
    }));
    return capturas.filter((captura): captura is ResumoCapturaLogs => captura !== null).sort((a, b) => b.finalizadaEm.localeCompare(a.finalizadaEm));
  }

  async ler(id: string): Promise<CapturaLogsConcluida | null> {
    if (!codigoSeguro(id)) return null;
    try {
      const captura = JSON.parse(await fs.readFile(caminhoCaptura(id), 'utf8')) as CapturaLogsConcluida;
      return capturaValida(captura) ? captura : null;
    } catch { return null; }
  }

  async excluir(id: string): Promise<void> {
    if (!codigoSeguro(id)) throw new Error('CAPTURA_INVALIDA');
    await fs.rm(caminhoCaptura(id), { force: true });
  }

  async limpar(): Promise<void> {
    if (this.ativa) await this.finalizar('manual');
    const arquivos = await fs.readdir(diretorioCapturas());
    await Promise.all(arquivos.filter(arquivo => arquivo.endsWith('.json') || arquivo.endsWith('.ndjson')).map(arquivo => fs.rm(path.join(diretorioCapturas(), arquivo), { force: true })));
  }

  async encerrar(): Promise<void> {
    if (this.ativa) await this.finalizar('interrompida');
  }

  private sondaAtiva(sonda: SondaCapturaLogs): boolean {
    return Boolean(this.ativa?.sondas.includes(sonda));
  }

  private async registrar(sonda: EventoCapturaLogs['sonda'], codigo: string, nivel: EventoCapturaLogs['nivel'], dados: EventoCapturaLogs['dados']): Promise<void> {
    if (!this.ativa || (sonda !== 'marcador' && !this.sondaAtiva(sonda))) return;
    const dadosSeguros = Object.fromEntries(Object.entries(dados).filter(([, valor]) => valor === null || typeof valor === 'boolean' || (typeof valor === 'number' && Number.isFinite(valor)) || (typeof valor === 'string' && PADRAO_CODIGO.test(valor))));
    if (this.fila.length >= LIMITE_FILA) {
      this.eventosDescartados += 1;
      await this.persistirAtiva();
      return;
    }
    this.fila.push({ timestamp: new Date().toISOString(), sonda, codigo, nivel, dados: dadosSeguros });
    void this.descarregar();
  }

  private async descarregar(): Promise<void> {
    if (this.gravacao || !this.ativa || !this.fila.length) return this.gravacao ?? Promise.resolve();
    const lote = this.fila.splice(0, this.fila.length);
    const id = this.ativa.id;
    this.gravacao = fs.appendFile(caminhoEventos(id), `${lote.map(evento => JSON.stringify(evento)).join('\n')}\n`, 'utf8')
      .catch(() => { this.eventosDescartados += lote.length; })
      .finally(() => { this.gravacao = null; });
    await this.gravacao;
    if (this.fila.length) await this.descarregar();
  }

  private async garantirGravacao(): Promise<void> {
    await this.descarregar();
    if (this.gravacao) await this.gravacao;
  }

  private async finalizar(motivo: MotivoEncerramentoCapturaLogs): Promise<void> {
    const captura = this.ativa;
    if (!captura) return;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    await this.registrar('marcador', motivo === 'expirada' ? 'captura_expirada' : motivo === 'interrompida' ? 'captura_interrompida' : 'captura_encerrada', motivo === 'interrompida' ? 'aviso' : 'info', {});
    await this.garantirGravacao();
    const eventos = await this.lerEventos(captura.id);
    const finalizadaEm = new Date().toISOString();
    const resumo = resumoAnalitico(eventos, captura.sondas, captura.iniciadaEm, finalizadaEm);
    const resultado: CapturaLogsConcluida = {
      versaoFormato: 2,
      id: captura.id,
      sondas: captura.sondas,
      iniciadaEm: captura.iniciadaEm,
      finalizadaEm,
      motivoEncerramento: motivo,
      quantidadeEventos: eventos.length,
      eventosDescartados: this.eventosDescartados,
      qualidade: qualidadeCaptura(resumo, this.eventosDescartados),
      coberturaSondas: resumo.coberturaSondas,
      resumo,
      eventos,
    };
    if (!capturaValida(resultado)) throw new Error('CAPTURA_INVALIDA');
    await fs.writeFile(caminhoCaptura(captura.id), JSON.stringify(resultado, null, 2), 'utf8');
    await Promise.all([fs.rm(caminhoAtiva(), { force: true }), fs.rm(caminhoEventos(captura.id), { force: true })]);
    this.ativa = null;
    this.fila = [];
    this.salt = '';
    this.publicarEstado();
    await this.aplicarRetencao();
    await this.aoEncerrar?.(captura.sondas);
  }

  private async lerEventos(id: string): Promise<EventoCapturaLogs[]> {
    try {
      const conteudo = await fs.readFile(caminhoEventos(id), 'utf8');
      return conteudo.split('\n').flatMap(linha => { try { return linha ? [JSON.parse(linha) as EventoCapturaLogs] : []; } catch { return []; } });
    } catch { return []; }
  }

  private async persistirAtiva(): Promise<void> {
    if (!this.ativa) return;
    await fs.writeFile(caminhoAtiva(), JSON.stringify({ captura: this.ativa, salt: this.salt, eventosDescartados: this.eventosDescartados } satisfies ArquivoCapturaAtiva), 'utf8');
  }

  private agendarExpiracao(): void {
    if (!this.ativa) return;
    this.temporizador = setTimeout(() => { void this.finalizar('expirada'); }, Math.max(0, Date.parse(this.ativa.terminaEm) - Date.now()));
  }

  private identificadorOpaco(valor: string): string {
    return createHash('sha256').update(`${this.salt}:${valor}`).digest('hex').slice(0, 20);
  }

  private publicarEstado(): void {
    this.aoAlterarEstado?.(this.obterEstado());
  }

  private async aplicarRetencao(): Promise<void> {
    const arquivos = (await fs.readdir(diretorioCapturas())).filter(arquivo => /^[a-f0-9-]+\.json$/i.test(arquivo));
    const entradas = await Promise.all(arquivos.map(async arquivo => {
      const caminho = path.join(diretorioCapturas(), arquivo);
      const stat = await fs.stat(caminho);
      return { caminho, tamanho: stat.size, modificadoEm: stat.mtimeMs };
    }));
    entradas.sort((a, b) => b.modificadoEm - a.modificadoEm);
    let total = entradas.reduce((soma, entrada) => soma + entrada.tamanho, 0);
    for (const [indice, entrada] of entradas.entries()) {
      if (indice < MAXIMO_CAPTURAS && total <= MAXIMO_BYTES) continue;
      await fs.rm(entrada.caminho, { force: true });
      total -= entrada.tamanho;
    }
  }
}

export const capturaLogsService = new CapturaLogsService();
