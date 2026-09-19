import { createHash, randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import type { AmostraDesempenho, EstadoCapturaDesempenho, EventoDesempenhoEntrada, MetricasDesempenho, PerfilCapturaLogs, ResumoIpcDesempenho, SeveridadeDesempenho, SessaoCapturaDesempenho } from '../../shared/desempenho/contratos.js';
import { configuracaoService } from './configuracao.service.js';

const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const MAXIMO_ARQUIVOS = 3;
const LIMITE_FILA = 1_000;
const TAMANHO_LOTE = 100;
const INTERVALO_GRAVACAO_MS = 1_000;
const CHAVE_PERFIL = 'desempenho_perfil_captura';
const METADADOS_PERMITIDOS = new Set(['placeholders', 'previasCriadas', 'previasRemovidas', 'tabelas', 'linhas', 'celulas', 'tabelasPersonalizadas', 'tentativas', 'imagens', 'imagensMemoria', 'itensRenderizados', 'bytesEntrada', 'bytesSaida', 'arquivosRelidos', 'sucesso', 'falhou', 'quantidade']);
const PADRAO_IDENTIFICADOR = /^[a-z0-9:_-]{1,100}$/i;

function diretorioLogs(): string { return path.join(app.getPath('userData'), 'logs'); }
function caminhoLog(): string { return path.join(diretorioLogs(), 'performance.log'); }
function perfilPersistivel(valor: unknown): valor is 'importante' | 'critico' { return valor === 'importante' || valor === 'critico'; }
function identificadorSeguro(valor: string | undefined): string | null { return valor && PADRAO_IDENTIFICADOR.test(valor) ? valor : null; }
function severidadePara(entrada: EventoDesempenhoEntrada): SeveridadeDesempenho {
  if (entrada.evento === 'renderer_sem_resposta' || entrada.evento === 'renderer_encerrado' || (entrada.duracaoMs ?? 0) >= 2_000) return 'critico';
  if ((entrada.duracaoMs ?? 0) >= 250 || (entrada.metricas?.atrasoEventLoopMs ?? 0) >= 200 || (entrada.metricas?.longTaskMaximaMs ?? 0) >= 200) return 'importante';
  return 'info';
}
function metadadosSeguros(entrada: Record<string, number | boolean | null> | undefined): Record<string, number | boolean | null> {
  if (!entrada) return {};
  return Object.fromEntries(Object.entries(entrada).filter(([chave, valor]) => METADADOS_PERMITIDOS.has(chave) && (typeof valor === 'number' || typeof valor === 'boolean' || valor === null)));
}
function metricasSeguras(entrada: MetricasDesempenho | undefined): MetricasDesempenho {
  if (!entrada) return {};
  return Object.fromEntries(Object.entries(entrada).filter(([, valor]) => valor === null || (typeof valor === 'number' && Number.isFinite(valor)))) as MetricasDesempenho;
}
function resumoIpcSeguro(resumo: ResumoIpcDesempenho[] | undefined): ResumoIpcDesempenho[] | undefined {
  if (!resumo) return undefined;
  return resumo.slice(0, 10).flatMap(item => identificadorSeguro(item.canal) && Number.isFinite(item.quantidade) && Number.isFinite(item.falhas) && Number.isFinite(item.duracaoMaximaMs) && Number.isFinite(item.duracaoMediaMs)
    ? [{ canal: item.canal, quantidade: Math.max(0, Math.floor(item.quantidade)), falhas: Math.max(0, Math.floor(item.falhas)), duracaoMaximaMs: Math.max(0, item.duracaoMaximaMs), duracaoMediaMs: Math.max(0, item.duracaoMediaMs), bytesEntrada: Number.isFinite(item.bytesEntrada) ? Math.max(0, item.bytesEntrada ?? 0) : null, bytesSaida: Number.isFinite(item.bytesSaida) ? Math.max(0, item.bytesSaida ?? 0) : null }]
    : []);
}

export class DesempenhoService {
  private perfil: PerfilCapturaLogs = 'importante';
  private sessao: SessaoCapturaDesempenho | null = null;
  private temporizadorAmostragem: NodeJS.Timeout | null = null;
  private temporizadorGravacao: NodeJS.Timeout | null = null;
  private inicializado = false;
  private saltSessao = randomUUID();
  private fila: AmostraDesempenho[] = [];
  private eventosDescartados = 0;
  private gravacaoEmAndamento: Promise<void> | null = null;

  async inicializar(): Promise<void> {
    if (this.inicializado) return;
    const armazenado = await configuracaoService.obter(CHAVE_PERFIL);
    this.perfil = perfilPersistivel(armazenado) ? armazenado : 'importante';
    this.inicializado = true;
    this.iniciarColetaPeriodica();
  }
  async obterEstado(): Promise<EstadoCapturaDesempenho> { await this.inicializar(); return { perfil: this.perfil, sessao: this.sessao, eventosDescartados: this.eventosDescartados }; }
  async configurarPerfil(perfil: 'importante' | 'critico'): Promise<EstadoCapturaDesempenho> {
    await this.inicializar(); this.perfil = perfil;
    await configuracaoService.salvar(CHAVE_PERFIL, perfil, 'texto', 'Perfil padrão da captura de desempenho');
    this.iniciarColetaPeriodica(); return this.obterEstado();
  }
  async iniciarDetalhada(): Promise<EstadoCapturaDesempenho> {
    await this.inicializar();
    this.sessao = { id: randomUUID(), perfil: 'detalhado', iniciadaEm: new Date().toISOString(), terminaEm: new Date(Date.now() + 15 * 60_000).toISOString(), ativa: true };
    this.iniciarColetaPeriodica(); await this.registrar({ origem: 'main', categoria: 'captura', evento: 'captura_detalhada_iniciada' }); return this.obterEstado();
  }
  async pararDetalhada(): Promise<EstadoCapturaDesempenho> {
    if (this.sessao?.ativa) await this.registrar({ origem: 'main', categoria: 'captura', evento: 'captura_detalhada_encerrada' });
    this.sessao = null; this.iniciarColetaPeriodica(); return this.obterEstado();
  }
  async marcarProblema(): Promise<void> { await this.registrar({ origem: 'renderer', categoria: 'marcador', evento: 'problema_aconteceu_agora' }); }
  async registrar(entrada: EventoDesempenhoEntrada): Promise<void> {
    await this.inicializar();
    const perfilAtivo = this.sessao?.ativa ? 'detalhado' : this.perfil;
    const severidade = severidadePara(entrada);
    if (perfilAtivo === 'critico' && severidade !== 'critico') return;
    if (perfilAtivo === 'importante' && severidade === 'info' && entrada.categoria !== 'amostra' && entrada.evento !== 'resumo_ipc') return;
    this.enfileirar({ id: randomUUID(), sessaoId: this.sessao?.id ?? this.idSessaoPadrao(), timestamp: new Date().toISOString(), perfil: perfilAtivo, severidade, origem: entrada.origem, categoria: entrada.categoria.slice(0, 80), evento: entrada.evento.slice(0, 100), operacao: identificadorSeguro(entrada.operacao), canal: identificadorSeguro(entrada.canal), duracaoMs: Number.isFinite(entrada.duracaoMs) ? Math.max(0, entrada.duracaoMs ?? 0) : null, contextoId: entrada.contextoId ? createHash('sha256').update(`${this.saltSessao}:${entrada.contextoId}`).digest('hex').slice(0, 20) : null, metricas: metricasSeguras(entrada.metricas), metadados: metadadosSeguros(entrada.metadados), resumoIpc: resumoIpcSeguro(entrada.resumoIpc) });
  }
  async listar(limite = 500): Promise<AmostraDesempenho[]> {
    await this.descarregarTudo();
    const arquivos = [caminhoLog(), ...Array.from({ length: MAXIMO_ARQUIVOS - 1 }, (_, indice) => `${caminhoLog()}.${indice + 1}`)];
    const conteudos = await Promise.all(arquivos.map(async arquivo => { try { return await fs.readFile(arquivo, 'utf8'); } catch { return ''; } }));
    return conteudos.flatMap(conteudo => conteudo.split('\n').flatMap(linha => { try { return linha ? [JSON.parse(linha) as AmostraDesempenho] : []; } catch { return []; } })).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limite);
  }
  async limpar(): Promise<void> {
    await this.descarregarTudo();
    this.fila = [];
    const arquivos = [caminhoLog(), ...Array.from({ length: MAXIMO_ARQUIVOS - 1 }, (_, indice) => `${caminhoLog()}.${indice + 1}`)];
    await Promise.all(arquivos.map(async arquivo => { try { await fs.unlink(arquivo); } catch { /* arquivo ausente */ } }));
  }
  async exportarCsv(): Promise<string> {
    const cabecalho = ['sessao', 'horario', 'perfil', 'severidade', 'origem', 'categoria', 'evento', 'operacao', 'canal', 'duracao_ms', 'cpu_percentual', 'memoria_kb', 'heap_usado', 'heap_limite', 'atraso_event_loop_ms', 'long_tasks', 'tabelas', 'celulas', 'imagens', 'contexto_id', 'metadados', 'resumo_ipc'];
    const escapar = (valor: unknown) => `"${String(valor ?? '').replaceAll('"', '""')}"`;
    const linhas = (await this.listar(10_000)).reverse().map(amostra => [amostra.sessaoId, amostra.timestamp, amostra.perfil, amostra.severidade, amostra.origem, amostra.categoria, amostra.evento, amostra.operacao, amostra.canal, amostra.duracaoMs, amostra.metricas.cpuPercentual, amostra.metricas.memoriaKb, amostra.metricas.heapUsado, amostra.metricas.heapLimite, amostra.metricas.atrasoEventLoopMs, amostra.metricas.longTasks, amostra.metricas.tabelas, amostra.metricas.celulas, amostra.metricas.imagens, amostra.contextoId, JSON.stringify(amostra.metadados), JSON.stringify(amostra.resumoIpc ?? [])].map(escapar).join(','));
    return `${cabecalho.join(',')}\n${linhas.join('\n')}\n`;
  }
  async encerrar(): Promise<void> {
    if (this.temporizadorAmostragem) clearInterval(this.temporizadorAmostragem);
    if (this.temporizadorGravacao) clearTimeout(this.temporizadorGravacao);
    this.temporizadorAmostragem = null; this.temporizadorGravacao = null; this.sessao = null;
    await Promise.race([this.descarregarTudo(), new Promise<void>(resolve => setTimeout(resolve, 1_500))]);
  }
  private enfileirar(amostra: AmostraDesempenho): void {
    if (this.fila.length >= LIMITE_FILA) {
      const indiceInformativo = this.fila.findIndex(item => item.severidade === 'info');
      if (indiceInformativo >= 0) this.fila.splice(indiceInformativo, 1);
      else if (amostra.severidade === 'info') { this.eventosDescartados += 1; return; }
      else this.fila.shift();
      this.eventosDescartados += 1;
    }
    this.fila.push(amostra);
    if (this.fila.length >= TAMANHO_LOTE || amostra.severidade === 'critico') void this.descarregar(); else this.agendarGravacao();
  }
  private agendarGravacao(): void {
    if (this.temporizadorGravacao) return;
    this.temporizadorGravacao = setTimeout(() => { this.temporizadorGravacao = null; void this.descarregar(); }, INTERVALO_GRAVACAO_MS);
  }
  private async descarregar(): Promise<void> {
    if (this.gravacaoEmAndamento) return this.gravacaoEmAndamento;
    const lote = this.fila.splice(0, TAMANHO_LOTE);
    if (!lote.length) return;
    this.gravacaoEmAndamento = (async () => {
      try { await fs.mkdir(diretorioLogs(), { recursive: true }); await this.rotacionarSeNecessario(); await fs.appendFile(caminhoLog(), `${lote.map(item => JSON.stringify(item)).join('\n')}\n`, 'utf8'); }
      catch { this.fila.unshift(...lote.filter(item => item.severidade !== 'info')); this.eventosDescartados += lote.filter(item => item.severidade === 'info').length; }
      finally { this.gravacaoEmAndamento = null; }
    })();
    await this.gravacaoEmAndamento;
    if (this.fila.length) this.agendarGravacao();
  }
  private async descarregarTudo(): Promise<void> {
    do { await this.descarregar(); } while (this.fila.length > 0 || this.gravacaoEmAndamento);
  }
  private idSessaoPadrao(): string { return createHash('sha256').update(this.saltSessao).digest('hex').slice(0, 32); }
  private iniciarColetaPeriodica(): void {
    if (this.temporizadorAmostragem) clearInterval(this.temporizadorAmostragem);
    const intervalo = this.sessao?.ativa ? 2_000 : 10_000;
    this.temporizadorAmostragem = setInterval(() => {
      if (this.sessao?.terminaEm && Date.now() >= Date.parse(this.sessao.terminaEm)) { void this.pararDetalhada(); return; }
      const metricas = app.getAppMetrics();
      const cpu = metricas.reduce((total, item) => total + item.cpu.percentCPUUsage, 0);
      const memoriaKb = metricas.reduce((total, item) => total + (item.memory?.workingSetSize ?? 0), 0);
      void this.registrar({ origem: 'processo', categoria: 'amostra', evento: 'metricas_processos', metricas: { cpuPercentual: cpu, memoriaKb }, metadados: { quantidade: metricas.length } });
    }, intervalo);
  }
  private async rotacionarSeNecessario(): Promise<void> {
    try { if ((await fs.stat(caminhoLog())).size < TAMANHO_MAXIMO) return; } catch { return; }
    for (let indice = MAXIMO_ARQUIVOS - 1; indice >= 1; indice -= 1) {
      const origem = indice === 1 ? caminhoLog() : `${caminhoLog()}.${indice - 1}`;
      const destino = `${caminhoLog()}.${indice}`;
      try { await fs.rm(destino, { force: true }); await fs.rename(origem, destino); } catch { /* arquivo anterior ausente */ }
    }
  }
}
export const desempenhoService = new DesempenhoService();
