import { createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { estatisticas } from './configuracao.mjs';

function solicitarDiagnostico(sessao, operacao, payload, prazoMs = 15_000) {
  return new Promise((resolver, rejeitar) => {
    const socket = createConnection(sessao.pipe);
    const requestId = randomUUID();
    let buffer = '';
    const finalizar = (erro, dados) => {
      clearTimeout(prazo);
      socket.destroy();
      if (erro) rejeitar(erro); else resolver(dados);
    };
    const prazo = setTimeout(() => finalizar(new Error('Timeout do diagnóstico.')), prazoMs);
    socket.setEncoding('utf8');
    socket.once('error', erro => finalizar(erro));
    socket.once('connect', () => socket.write(JSON.stringify({ token: sessao.token, requestId, operacao, payload }) + '\n'));
    socket.on('data', parte => {
      buffer += parte;
      if (buffer.length > 8 * 1024 * 1024) return finalizar(new Error('Resposta diagnóstica excedeu o limite.'));
      const fim = buffer.indexOf('\n');
      if (fim < 0) return;
      try {
        const resposta = JSON.parse(buffer.slice(0, fim));
        if (resposta.requestId !== requestId || !resposta.ok) return finalizar(new Error(resposta.erro?.codigo ?? 'Resposta diagnóstica inválida.'));
        finalizar(null, resposta.dados);
      } catch (erro) { finalizar(erro); }
    });
    socket.once('end', () => { if (!buffer.includes('\n')) finalizar(new Error('Diagnóstico encerrou sem resposta.')); });
  });
}

export async function verificarSessaoLivre(workspace) {
  try {
    const sessao = JSON.parse(await readFile(path.join(workspace, 'tmp/diagnostico-agente/sessao-ativa.json'), 'utf8'));
    try { process.kill(sessao.pid, 0); } catch (erro) { if (erro.code === 'ESRCH') return; throw erro; }
    throw new Error('Já existe uma sessão diagnóstica ativa. Feche o laWdo de diagnóstico antes de executar a carga.');
  } catch (erro) { if (erro.code !== 'ENOENT') throw erro; }
}

export class ColetaDiagnostica {
  constructor(workspace, pid) {
    this.workspace = workspace;
    this.pid = pid;
    this.segmentos = [];
    this.erros = [];
  }

  async iniciar() {
    this.sessao = JSON.parse(await readFile(path.join(this.workspace, 'tmp/diagnostico-agente/sessao-ativa.json'), 'utf8'));
    if (this.sessao.pid !== this.pid) throw new Error(`A sessão diagnóstica não pertence ao processo de teste (esperado ${this.pid}, observado ${this.sessao.pid}).`);
    const estado = await solicitarDiagnostico(this.sessao, 'diagnostico_status', {});
    if (estado?.conectado !== true || estado.modoDiagnostico !== true || estado.pid !== this.pid) throw new Error('Diagnóstico indisponível para o processo de teste.');
    this.estadoInicial = { conectado: true, modoDiagnostico: true, pid: estado.pid, sessionId: estado.sessionId };
    await this.abrirSegmento();
  }

  async abrirSegmento() {
    if (this.encerrada) return;
    this.captura = await solicitarDiagnostico(this.sessao, 'iniciar_captura', { finalidade: 'desempenho', duracaoSegundos: 30, cenarioDesempenho: 'uso_editor' });
    this.temporizador = setTimeout(() => {
      this.rotacao = this.fecharSegmento(false).then(() => this.abrirSegmento()).catch(erro => this.erros.push(erro.message));
    }, 31_000);
  }

  async fecharSegmento(antecipado) {
    const captura = this.captura;
    this.captura = null;
    if (!captura) return;
    await solicitarDiagnostico(this.sessao, 'finalizar_captura', { capturaId: captura.capturaId });
    const consultar = componente => solicitarDiagnostico(this.sessao, 'consultar_captura', { capturaId: captura.capturaId, componente });
    this.segmentos.push({ capturaId: captura.capturaId, antecipado, manifesto: await consultar('manifesto'), metricas: await consultar('metricas_resumo') });
  }

  async encerrar() {
    this.encerrada = true;
    clearTimeout(this.temporizador);
    await this.rotacao;
    await this.fecharSegmento(true).catch(erro => this.erros.push(erro.message));
    return { estadoInicial: this.estadoInicial, segmentos: this.segmentos, erros: this.erros };
  }
}

// Esta função é instalada somente pelo executor nos documentos de teste, inclusive iframes.
export function instalarColetorRenderer() {
  if (globalThis.__cargaMetricas) return;
  const principal = globalThis.top;
  principal.__cargaMetricasFrames ??= principal.structuredClone({});
  principal.__cargaProximoFrame = (principal.__cargaProximoFrame ?? 0) + 1;
  // Clones no contexto principal preservam dados, sem reter o Window dos editores removidos.
  const dados = principal.structuredClone({ entradas: [], tarefas: [], atrasos: [], visibilidade: [], descartadas: 0, longTasksDisponivel: false });
  principal.__cargaMetricasFrames[principal.__cargaProximoFrame] = dados;
  globalThis.__cargaMetricas = dados;
  const adicionar = (lista, valor) => {
    if (lista.length >= 20_000) { dados.descartadas++; return undefined; }
    const copia = principal.structuredClone(valor);
    lista.push(copia);
    return copia;
  };
  globalThis.document.addEventListener('keydown', evento => {
    const inicio = evento.timeStamp > 0 && evento.timeStamp <= performance.now() ? evento.timeStamp : performance.now();
    const recebidaEm = performance.timeOrigin + performance.now();
    const caractere = evento.key.length === 1 && !evento.ctrlKey && !evento.metaKey && !evento.altKey;
    const entrada = adicionar(dados.entradas, { inicio: performance.timeOrigin + inicio, recebidaEm, caractere, duracao: null, visivel: globalThis.document.visibilityState === 'visible', foco: principal.document.hasFocus() });
    globalThis.requestAnimationFrame(() => { if (entrada) entrada.duracao = Math.max(0, performance.now() - inicio); });
  }, true);
  try {
    if (!PerformanceObserver.supportedEntryTypes.includes('longtask')) throw new Error('API de long tasks ausente.');
    new PerformanceObserver(lista => {
      for (const tarefa of lista.getEntries()) adicionar(dados.tarefas, { inicio: performance.timeOrigin + tarefa.startTime, duracao: tarefa.duration });
    }).observe({ type: 'longtask' });
    dados.longTasksDisponivel = true;
  } catch { /* O relatório informa quando a API não estiver disponível. */ }
  let esperado = performance.now() + 100;
  const reiniciarPrazo = () => { esperado = performance.now() + 100; };
  globalThis.document.addEventListener('visibilitychange', reiniciarPrazo);
  globalThis.addEventListener('focus', reiniciarPrazo);
  setInterval(() => {
    const agora = performance.now();
    adicionar(dados.atrasos, { inicio: performance.timeOrigin + agora, duracao: Math.max(0, agora - esperado), visivel: globalThis.document.visibilityState === 'visible', foco: principal.document.hasFocus() });
    esperado = agora + 100;
  }, 100);
  const registrarVisibilidade = () => adicionar(dados.visibilidade, { horario: Date.now(), estado: globalThis.document.visibilityState, foco: principal.document.hasFocus() });
  globalThis.document.addEventListener('visibilitychange', registrarVisibilidade);
  globalThis.addEventListener('focus', registrarVisibilidade);
  globalThis.addEventListener('blur', registrarVisibilidade);
  registrarVisibilidade();
}

export async function lerMetricasRenderer(pagina, inicio, fim) {
  await pagina.waitForTimeout(50);
  const amostras = await pagina.evaluate(({ inicio, fim }) => {
      const registros = Object.values(globalThis.__cargaMetricasFrames ?? {});
      if (!registros.length) return [{ indisponivel: true }];
      return registros.map(dados => {
        const filtrar = lista => lista.filter(item => item.inicio >= inicio && item.inicio <= fim);
        return { entradas: filtrar(dados.entradas), tarefas: filtrar(dados.tarefas), atrasos: filtrar(dados.atrasos), visibilidade: dados.visibilidade, descartadas: dados.descartadas, longTasksDisponivel: dados.longTasksDisponivel };
      });
    }, { inicio, fim });
  return resumirMetricasRenderer(amostras);
}

export function resumirMetricasRenderer(amostras) {
  const entradas = [...new Map(amostras.flatMap(item => item.entradas ?? []).map(item => [`${item.inicio}:${item.recebidaEm}`, item])).values()];
  const atrasos = amostras.flatMap(item => item.atrasos ?? []);
  const tarefas = [...new Map(amostras.flatMap(item => item.tarefas ?? []).map(item => [`${Math.round(item.inicio)}:${Math.round(item.duracao)}`, item])).values()];
  const visivelComFoco = item => item.visivel && item.foco !== false;
  const recepcoes = entradas.filter(item => item.caractere && visivelComFoco(item)).map(item => item.recebidaEm).sort((a, b) => a - b);
  const entradasSemFrame = entradas.filter(item => visivelComFoco(item) && item.duracao === null).length;
  return {
    entradaFrame: estatisticas(entradas.filter(visivelComFoco).map(item => item.duracao)),
    atrasoRenderer: estatisticas(atrasos.filter(visivelComFoco).map(item => item.duracao)),
    longTasks: estatisticas(tarefas.map(item => item.duracao)),
    cadenciaRecepcaoMs: estatisticas(recepcoes.slice(1).map((horario, indice) => horario - recepcoes[indice])),
    entradasRecebidas: recepcoes.length,
    entradasSemFrame,
    amostrasSemFoco: entradas.concat(atrasos).filter(item => item.foco === false).length,
    amostrasOcultas: entradas.filter(item => !item.visivel).length + atrasos.filter(item => !item.visivel).length,
    coletaIncompleta: entradasSemFrame > 0 || amostras.some(item => item.indisponivel || item.descartadas || !item.longTasksDisponivel),
    amostras,
  };
}
