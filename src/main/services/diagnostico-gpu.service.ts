import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm, stat, truncate, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizarAmbienteGpu, normalizarProcessosGpu, sanitizarTextoGpu, type ProcessoGpuDiagnostico } from './diagnostico-gpu-dados.js';
import type { ResultadoWindowsGpu } from './diagnostico-gpu-windows.js';
import type { EntradaConsultarGpu } from '../../shared/diagnostico/contratos.js';

interface AmostraGpu { horario: string; processos: ProcessoGpuDiagnostico[] }
interface LinhaGpu { horario: string; linha: string }
interface OcorrenciaGpu { horario: string; motivo: string; codigo: number; classificacao: 'contexto_grafico_perdido' | 'processo_gpu_encerrado'; pidAnterior: number | null; recuperacao: 'aguardando' | 'confirmada' | 'inconclusiva'; novoPid?: number; recuperadoEm?: string }
interface AmbienteGpu { horario: string; dados: ReturnType<typeof normalizarAmbienteGpu> }
interface IncidenteGpu {
  incidenteId: string; iniciadoEm: string; ocorrencias: OcorrenciaGpu[]; totalOcorrencias: number;
  contexto: Record<string, unknown>; ambienteAnterior: AmbienteGpu | null; idadeAmbienteMs: number | null;
  ambientePosterior: AmbienteGpu | null; amostras: AmostraGpu[]; logsNativos: LinhaGpu[];
  eventosWindows: ResultadoWindowsGpu[]; lacunas: string[];
}
export interface DependenciasGpu {
  diretorio: string; arquivoNativo: string; ambienteExecucao: Record<string, unknown>;
  obterInformacoes: () => Promise<unknown>; obterRecursos: () => unknown; obterMetricas: () => unknown;
  obterContexto: () => Record<string, unknown>;
  registrar: (dados: Record<string, unknown>, incidenteId: string) => Promise<unknown>;
  consultarWindows: (inicio: number, fim: number) => Promise<ResultadoWindowsGpu>;
  agora?: () => number;
  limites?: { bytesNativo?: number; incidentes?: number; bytesIncidentes?: number };
}

export class DiagnosticoGpuService {
  private readonly incidentes = new Map<string, IncidenteGpu>();
  private amostras: AmostraGpu[] = [];
  private linhas: LinhaGpu[] = [];
  private ambiente: AmbienteGpu | null = null;
  private lacunas = new Set<string>();
  private intervalos: NodeJS.Timeout[] = [];
  private temporizadores = new Set<NodeJS.Timeout>();
  private tarefas = new Set<Promise<unknown>>();
  private fila: Promise<void> = Promise.resolve();
  private monitorando = false;
  private lendo = false;
  private atualizando = false;
  private encerrado = false;
  private posicaoNativo = 0;
  private fragmento = '';
  private ultimaFalha: IncidenteGpu | null = null;

  constructor(private readonly dependencias: DependenciasGpu) {}
  private agora(): number { return this.dependencias.agora?.() ?? Date.now(); }
  private horario(): string { return new Date(this.agora()).toISOString(); }
  private executar(tarefa: Promise<unknown>): void {
    const segura = tarefa.catch(() => { this.lacunas.add('COLETA_GPU_FALHOU'); });
    this.tarefas.add(segura);
    void segura.finally(() => this.tarefas.delete(segura));
  }
  private agendar(ms: number, tarefa: () => Promise<unknown>): void {
    const timer = setTimeout(() => { this.temporizadores.delete(timer); if (!this.encerrado) this.executar(tarefa()); }, ms);
    timer.unref(); this.temporizadores.add(timer);
  }

  iniciar(): void {
    if (this.monitorando || this.encerrado) return;
    this.monitorando = true;
    this.coletarAmostra();
    this.executar(this.atualizarAmbiente());
    this.executar(this.lerLogNativo());
    const metricas = setInterval(() => this.coletarAmostra(), 2_000);
    const logs = setInterval(() => this.executar(this.lerLogNativo()), 1_000);
    metricas.unref(); logs.unref(); this.intervalos.push(metricas, logs);
  }

  coletarAmostra(): void {
    if (this.encerrado) return;
    try {
      const amostra = { horario: this.horario(), processos: normalizarProcessosGpu(this.dependencias.obterMetricas()) };
      this.amostras.push(amostra);
      this.amostras = this.amostras.filter(item => Date.parse(item.horario) >= this.agora() - 120_000).slice(-61);
      for (const incidente of this.incidentes.values()) {
        let recuperou = false;
        for (const ocorrencia of incidente.ocorrencias) {
          if (ocorrencia.recuperacao !== 'aguardando') continue;
          const novo = amostra.processos.find(processo => processo.tipo === 'GPU' && ocorrencia.pidAnterior !== null && processo.pid !== ocorrencia.pidAnterior);
          if (novo) { ocorrencia.recuperacao = 'confirmada'; ocorrencia.novoPid = novo.pid; ocorrencia.recuperadoEm = amostra.horario; recuperou = true; }
        }
        if (this.agora() - Date.parse(incidente.iniciadoEm) <= 75_000) incidente.amostras = [...incidente.amostras, amostra].slice(-100);
        if (recuperou) { this.executar(this.registrar({ evento: 'gpu_recuperada' }, incidente)); this.executar(this.persistir(incidente)); }
      }
    } catch { this.lacunas.add('METRICAS_GPU_INDISPONIVEIS'); }
  }

  async atualizarAmbiente(): Promise<void> {
    if (this.atualizando || this.encerrado) return;
    this.atualizando = true;
    let timer: NodeJS.Timeout | undefined;
    try {
      const informacoes = await Promise.race([
        this.dependencias.obterInformacoes(),
        new Promise<never>((_, rejeitar) => { timer = setTimeout(() => rejeitar(new Error('GPU_INFO_TIMEOUT')), 3_000); timer.unref(); }),
      ]);
      this.ambiente = { horario: this.horario(), dados: normalizarAmbienteGpu(informacoes, this.dependencias.obterRecursos()) };
      for (const incidente of this.incidentes.values()) {
        if (this.agora() - Date.parse(incidente.iniciadoEm) <= 75_000) incidente.ambientePosterior = this.ambiente;
      }
    } catch { this.lacunas.add('AMBIENTE_GPU_INDISPONIVEL'); }
    finally { if (timer) clearTimeout(timer); this.atualizando = false; }
  }

  async registrarFalha(motivo: string, codigo: number): Promise<string | null> {
    if (this.encerrado) return null;
    const momento = this.agora();
    let incidente = this.ultimaFalha;
    if (!incidente || !this.incidentes.has(incidente.incidenteId) || momento - Date.parse(incidente.iniciadoEm) >= 60_000) {
      let contexto: Record<string, unknown> = {};
      try { contexto = this.dependencias.obterContexto(); } catch { this.lacunas.add('CONTEXTO_GPU_INDISPONIVEL'); }
      incidente = { incidenteId: randomUUID(), iniciadoEm: this.horario(), ocorrencias: [], totalOcorrencias: 0,
        contexto, ambienteAnterior: this.ambiente, idadeAmbienteMs: this.ambiente ? Math.max(0, momento - Date.parse(this.ambiente.horario)) : null,
        ambientePosterior: null, amostras: [...this.amostras], logsNativos: [...this.linhas], eventosWindows: [], lacunas: [...this.lacunas] };
      if (!this.ambiente) incidente.lacunas.push('AMBIENTE_ANTERIOR_AUSENTE');
      this.incidentes.set(incidente.incidenteId, incidente); this.ultimaFalha = incidente;
      const atual = incidente;
      this.agendar(60_000, () => this.correlacionarWindows(atual));
    }
    const pidAnterior = this.amostras.at(-1)?.processos.find(processo => processo.tipo === 'GPU')?.pid ?? null;
    const ocorrencia: OcorrenciaGpu = { horario: this.horario(), motivo: sanitizarTextoGpu(motivo).slice(0, 80), codigo,
      classificacao: codigo === 34 ? 'contexto_grafico_perdido' : 'processo_gpu_encerrado', pidAnterior, recuperacao: 'aguardando' };
    incidente.totalOcorrencias += 1;
    incidente.ocorrencias.push(ocorrencia);
    if (incidente.ocorrencias.length > 200) { incidente.ocorrencias.shift(); this.adicionarLacuna(incidente, 'OCORRENCIAS_TRUNCADAS_CONSULTE_EVENTOS'); }
    await this.registrar({ evento: 'gpu_encerrada', ...ocorrencia }, incidente);
    await this.persistir(incidente);
    const atual = incidente;
    this.agendar(15_000, async () => {
      if (!this.incidentes.has(atual.incidenteId)) return;
      this.coletarAmostra();
      if (ocorrencia.recuperacao === 'aguardando') ocorrencia.recuperacao = 'inconclusiva';
      await this.atualizarAmbiente();
      await this.lerLogNativo();
      await this.correlacionarWindows(atual);
      await this.registrar({ evento: 'gpu_acompanhamento_concluido', codigo, recuperacao: ocorrencia.recuperacao }, atual);
      await this.persistir(atual);
    });
    return incidente.incidenteId;
  }

  private adicionarLacuna(incidente: IncidenteGpu, lacuna: string): void {
    if (!incidente.lacunas.includes(lacuna)) incidente.lacunas.push(lacuna);
  }
  private async registrar(dados: Record<string, unknown>, incidente: IncidenteGpu): Promise<void> {
    try { await this.dependencias.registrar({ ...dados, incidenteId: incidente.incidenteId }, incidente.incidenteId); }
    catch { this.adicionarLacuna(incidente, 'EVENTO_GPU_NAO_PERSISTIDO'); }
  }
  private async correlacionarWindows(incidente: IncidenteGpu): Promise<void> {
    if (!this.incidentes.has(incidente.incidenteId)) return;
    try {
      const inicio = Date.parse(incidente.iniciadoEm) - 120_000;
      const fim = this.agora();
      incidente.eventosWindows.push({ ...await this.dependencias.consultarWindows(inicio, fim), consultadoEm: this.horario(), inicioIntervalo: new Date(inicio).toISOString(), fimIntervalo: new Date(fim).toISOString() });
      incidente.eventosWindows = incidente.eventosWindows.slice(-8);
      const lacuna = incidente.eventosWindows.at(-1)?.lacuna;
      if (lacuna) this.adicionarLacuna(incidente, lacuna);
    } catch { this.adicionarLacuna(incidente, 'WINDOWS_INDISPONIVEL'); }
    await this.persistir(incidente);
  }

  async lerLogNativo(): Promise<void> {
    if (this.lendo || this.encerrado) return;
    this.lendo = true;
    try {
      const tamanho = (await stat(this.dependencias.arquivoNativo)).size;
      if (tamanho < this.posicaoNativo) { this.posicaoNativo = 0; this.fragmento = ''; this.lacunas.add('LOG_NATIVO_REINICIADO'); }
      if (tamanho - this.posicaoNativo > 1024 * 1024) {
        this.posicaoNativo = tamanho - 1024 * 1024; this.fragmento = ''; this.lacunas.add('LOG_NATIVO_TRECHO_TRUNCADO');
      }
      if (tamanho > this.posicaoNativo) {
        const arquivo = await open(this.dependencias.arquivoNativo, 'r');
        let texto: string;
        try {
          const buffer = Buffer.alloc(Math.min(1024 * 1024, tamanho - this.posicaoNativo));
          const { bytesRead } = await arquivo.read(buffer, 0, buffer.length, this.posicaoNativo);
          this.posicaoNativo += bytesRead; texto = this.fragmento + buffer.subarray(0, bytesRead).toString('utf8');
        } finally { await arquivo.close(); }
        const partes = texto.split(/\r?\n/); this.fragmento = (partes.pop() ?? '').slice(-4096);
        const novas = partes.filter(linha => /(?:gpu|angle|viz|gl_|command_buffer|d3d|dxgi|shared_context)/i.test(linha)).map(linha => ({ horario: this.horario(), linha: sanitizarTextoGpu(linha) }));
        const linhasRetidas = [...this.linhas, ...novas].filter(linha => Date.parse(linha.horario) >= this.agora() - 120_000);
        if (linhasRetidas.length > 1000) this.lacunas.add('LOGS_GPU_LIMITE_REGISTROS_ATINGIDO');
        this.linhas = linhasRetidas.slice(-1000);
        for (const incidente of this.incidentes.values()) {
          if (this.agora() - Date.parse(incidente.iniciadoEm) <= 75_000) incidente.logsNativos = [...incidente.logsNativos, ...novas].slice(-1000);
        }
      }
      if (tamanho > (this.dependencias.limites?.bytesNativo ?? 20 * 1024 * 1024)) {
        // O Chromium abre o arquivo em modo append; não renomear seu handle aberto no Windows.
        await truncate(this.dependencias.arquivoNativo, 0); this.posicaoNativo = 0; this.fragmento = '';
        this.lacunas.add('LOG_NATIVO_LIMITE_EXCEDIDO_CONTINUIDADE_PARCIAL');
        for (const incidente of this.incidentes.values()) this.adicionarLacuna(incidente, 'LOG_NATIVO_LIMITE_EXCEDIDO_CONTINUIDADE_PARCIAL');
      }
    } catch { this.lacunas.add('LOG_NATIVO_INDISPONIVEL'); }
    finally { this.lendo = false; }
  }

  private persistir(incidente: IncidenteGpu): Promise<void> {
    this.fila = this.fila.then(async () => {
      if (!this.incidentes.has(incidente.incidenteId)) return;
      for (const lacuna of this.lacunas) this.adicionarLacuna(incidente, lacuna);
      const pasta = path.join(this.dependencias.diretorio, 'gpu', 'incidentes');
      const destino = path.join(pasta, `${incidente.incidenteId}.json`);
      try {
        await mkdir(pasta, { recursive: true });
        await writeFile(`${destino}.tmp`, JSON.stringify(incidente), { mode: 0o600 });
        await rename(`${destino}.tmp`, destino);
      } catch {
        this.lacunas.add('DOSSIE_GPU_FALHA_ESCRITA');
        this.adicionarLacuna(incidente, 'DOSSIE_GPU_FALHA_ESCRITA');
        await rm(`${destino}.tmp`, { force: true }).catch(() => undefined);
      }
      let bytes = [...this.incidentes.values()].reduce((soma, item) => soma + Buffer.byteLength(JSON.stringify(item)), 0);
      while (this.incidentes.size > (this.dependencias.limites?.incidentes ?? 20) || bytes > (this.dependencias.limites?.bytesIncidentes ?? 50 * 1024 * 1024)) {
        const antigo = this.incidentes.values().next().value as IncidenteGpu | undefined;
        if (!antigo) break;
        bytes -= Buffer.byteLength(JSON.stringify(antigo)); this.incidentes.delete(antigo.incidenteId);
        await rm(path.join(pasta, `${antigo.incidenteId}.json`), { force: true }).catch(() => { this.lacunas.add('RETENCAO_GPU_FALHA_REMOCAO'); });
      }
    }).catch(() => { this.lacunas.add('DOSSIE_GPU_FALHA_ESCRITA'); });
    return this.fila;
  }

  resumo() {
    return { ativo: !this.encerrado, ambiente: this.ambiente, execucao: this.dependencias.ambienteExecucao,
      logNativo: { ativo: !this.lacunas.has('LOG_NATIVO_INDISPONIVEL'), limiteBytes: this.dependencias.limites?.bytesNativo ?? 20 * 1024 * 1024 },
      ultimoIncidenteId: this.ultimaFalha?.incidenteId ?? null, totalIncidentes: this.incidentes.size,
      incidentes: [...this.incidentes.values()].map(item => ({ incidenteId: item.incidenteId, iniciadoEm: item.iniciadoEm, ocorrencias: item.totalOcorrencias })), lacunas: [...this.lacunas] };
  }
  snapshot() {
    return structuredClone({ ...this.resumo(), detalhes: [...this.incidentes.values()].map(item => ({
      incidenteId: item.incidenteId, iniciadoEm: item.iniciadoEm, totalOcorrencias: item.totalOcorrencias,
      ocorrencias: item.ocorrencias.slice(-20), lacunas: item.lacunas,
    })) });
  }

  consultar(entrada: EntradaConsultarGpu): Record<string, unknown> {
    if (entrada.componente === 'resumo') return this.resumo();
    const incidente = entrada.incidenteId ? this.incidentes.get(entrada.incidenteId) : undefined;
    if (!incidente) throw new Error('INCIDENTE_GPU_NAO_ENCONTRADO');
    if (entrada.componente === 'ambiente') return { anterior: incidente.ambienteAnterior, idadeAmbienteMs: incidente.idadeAmbienteMs, posterior: incidente.ambientePosterior, execucao: this.dependencias.ambienteExecucao };
    if (entrada.componente === 'incidente') return { ...incidente, logsNativos: undefined, eventosWindows: undefined };
    const registros = entrada.componente === 'logs_nativos' ? incidente.logsNativos : incidente.eventosWindows;
    return { registros: registros.slice(entrada.depoisDe, entrada.depoisDe + entrada.limite), proximoCursor: Math.min(registros.length, entrada.depoisDe + entrada.limite), total: registros.length, lacunas: incidente.lacunas };
  }

  async encerrar(): Promise<void> {
    this.encerrado = true;
    this.intervalos.forEach(clearInterval); this.intervalos = [];
    this.temporizadores.forEach(clearTimeout); this.temporizadores.clear();
    await Promise.allSettled([...this.tarefas]);
    for (const incidente of this.incidentes.values()) {
      for (const ocorrencia of incidente.ocorrencias) if (ocorrencia.recuperacao === 'aguardando') { ocorrencia.recuperacao = 'inconclusiva'; this.adicionarLacuna(incidente, 'SESSAO_ENCERRADA_DURANTE_ACOMPANHAMENTO'); }
      await this.persistir(incidente);
    }
    await this.fila;
  }
}
