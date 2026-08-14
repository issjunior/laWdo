import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  EntradaConsultarCaptura,
  EntradaFinalizarCaptura,
  EntradaIniciarCaptura,
  EventoDiagnostico,
} from '../../shared/diagnostico/contratos.js';
import { VERSAO_PROTOCOLO_DIAGNOSTICO } from '../../shared/diagnostico/contratos.js';
import type { DiagnosticoEventosService } from './diagnostico-eventos.service.js';
import { compararResumosDesempenho, normalizarAmostrasDesempenho, resumirDesempenho, type ResumoDesempenhoDiagnostico } from './diagnostico-desempenho.service.js';

type FinalidadeCaptura = EntradaIniciarCaptura['finalidade'];
type EstadoCaptura = 'preparando' | 'coletando' | 'finalizada' | 'expirada' | 'cancelada' | 'interrompida';
type ClassificacaoCaptura = 'reproduzido' | 'nao_reproduzido' | 'interrompido' | 'inconclusiva' | 'concluida';

interface EvidenciaInicial {
  janelaId: number;
  rota: string;
  tela?: Buffer;
  interface?: unknown;
  contexto?: Record<string, unknown>;
  erros: ErroCaptura[];
}

interface ErroCaptura { componente: string; codigo: string; mensagem: string }

export interface DependenciasCapturaDiagnostico {
  diretorioSessao: () => string | null;
  sessionId: () => string | null;
  eventos: () => DiagnosticoEventosService | null;
  capturarLinhaBase: (janelaId: number | undefined, finalidade: FinalidadeCaptura) => Promise<EvidenciaInicial>;
  capturarEstadoFinal: (janelaId: number, finalidade: FinalidadeCaptura) => Promise<Omit<EvidenciaInicial, 'janelaId' | 'rota'>>;
  obterMetricas?: () => unknown[];
  obterAtrasoEventLoop?: () => number | null;
  obterPendenciasPersistencia?: () => number;
  obterMarcadores?: () => Record<string, string>;
  alterarSonda: (ativa: boolean, finalidade: FinalidadeCaptura) => void;
}

interface CapturaAtiva {
  capturaId: string;
  finalidade: FinalidadeCaptura;
  estado: EstadoCaptura;
  janelaId: number;
  rota: string;
  cursorInicial: number;
  cursorBufferInicial: number;
  iniciadaEm: string;
  finalizaEm: string;
  entrada: EntradaIniciarCaptura;
  base: EvidenciaInicial;
  amostras: unknown[];
  perfilDesempenho: 'essencial' | 'completo';
  degradacao: { ativa: boolean; motivo: string | null };
  atrasoEventLoopMs: number | null;
  timerFinalizacao: NodeJS.Timeout | null;
  timerAmostragem: NodeJS.Timeout | null;
  resultado?: FinalizacaoCaptura;
}

interface FinalizacaoCaptura {
  classificacao: ClassificacaoCaptura;
  cursorFinal: number;
  caminho: string;
  dossieAgente: Record<string, unknown>;
  componentes: Record<string, boolean>;
  errosCaptura: ErroCaptura[];
  resumo: Record<string, number | unknown[]>;
  metricas: ResumoDesempenhoDiagnostico;
  contextoComparacao?: { finalidade: 'desempenho'; cenario: string; versaoProtocolo: number; perfil: 'essencial' | 'completo' };
}

function paraNdjson(eventos: EventoDiagnostico[]): string {
  return eventos.map(evento => JSON.stringify(evento)).join('\n').concat(eventos.length ? '\n' : '');
}

function limitarNdjsonPorBytes(conteudo: string, limiteBytes: number): string {
  let total = 0;
  const linhasAceitas: string[] = [];
  for (const linha of conteudo.split('\n')) {
    if (!linha) continue;
    const tamanho = Buffer.byteLength(linha, 'utf8') + 1;
    if (total + tamanho > limiteBytes) break;
    linhasAceitas.push(linha);
    total += tamanho;
  }
  return linhasAceitas.length ? `${linhasAceitas.join('\n')}\n` : '';
}

function classificarSinais(eventos: EventoDiagnostico[]): Array<Record<string, unknown>> {
  const sinais: Array<Record<string, unknown>> = [];
  for (let indice = 1; indice < eventos.length; indice += 1) {
    const atual = eventos[indice];
    const anterior = eventos[indice - 1];
    if (atual?.categoria !== 'acao' || atual.dados.tipo !== 'scroll' || anterior?.categoria !== 'acao' || anterior.dados.tipo !== 'scroll') continue;
    const anteriorY = typeof anterior.dados.y === 'number' ? anterior.dados.y : null;
    const atualY = typeof atual.dados.y === 'number' ? atual.dados.y : null;
    const maximo = typeof atual.dados.maximoY === 'number' ? atual.dados.maximoY : null;
    if (anteriorY === null || atualY === null || !maximo || Math.abs(atualY - anteriorY) < maximo * 0.25) continue;
    const janelaTemporal = eventos.slice(Math.max(0, indice - 12), indice + 1);
    const houveWheel = atual.dados.teveWheelRecente === true || janelaTemporal.some(evento => evento.categoria === 'acao' && evento.dados.tipo === 'wheel');
    if (!houveWheel) sinais.push({
      tipo: 'salto_rolagem_sem_entrada', confianca: 'media', eventosSuporte: [anterior.sequencia, atual.sequencia],
      descricao: `A rolagem mudou de ${anteriorY} para ${atualY} sem wheel associado.`,
    });
    const layout = janelaTemporal.filter(evento => evento.categoria === 'acao' && ['redimensionamento', 'layout_shift', 'mutacao_estrutural', 'imagem_carregada'].includes(String(evento.dados.tipo)));
    if (layout.length) sinais.push({
      tipo: 'mudanca_layout_proxima_rolagem', confianca: 'media', eventosSuporte: [...layout.map(evento => evento.sequencia), atual.sequencia],
      descricao: 'Uma alteração estrutural, imagem ou mudança de dimensão ocorreu próxima à rolagem.',
    });
    const erroOuIpc = janelaTemporal.filter(evento => evento.nivel === 'error' || (evento.categoria === 'ipc' && typeof evento.dados.duracaoMs === 'number' && evento.dados.duracaoMs > 500));
    if (erroOuIpc.length) sinais.push({
      tipo: 'erro_ou_ipc_correlacionado', confianca: 'baixa', eventosSuporte: [...erroOuIpc.map(evento => evento.sequencia), atual.sequencia],
      descricao: 'Erro do renderer/console ou IPC lento ocorreu próximo à rolagem.',
    });
  }
  return sinais.filter((sinal, indice, lista) => lista.findIndex(outro => outro.tipo === sinal.tipo && JSON.stringify(outro.eventosSuporte) === JSON.stringify(sinal.eventosSuporte)) === indice).slice(0, 20);
}

function sumarizar(eventos: EventoDiagnostico[], sinais: Array<Record<string, unknown>>): Record<string, number | unknown[]> {
  return {
    acoes: eventos.filter(evento => evento.categoria === 'acao').length,
    rolagens: eventos.filter(evento => evento.categoria === 'acao' && evento.dados.tipo === 'scroll').length,
    erros: eventos.filter(evento => evento.categoria === 'erro' || evento.nivel === 'error').length,
    ipcsComErro: eventos.filter(evento => evento.categoria === 'ipc' && evento.nivel === 'error').length,
    sinais,
  };
}

export class DiagnosticoCapturaService {
  private capturaAtiva: CapturaAtiva | null = null;
  private readonly concluidas = new Map<string, FinalizacaoCaptura>();

  constructor(private readonly dependencias: DependenciasCapturaDiagnostico) {}

  async iniciar(entrada: EntradaIniciarCaptura): Promise<Record<string, unknown>> {
    if (this.capturaAtiva) throw new Error('CAPTURA_EM_ANDAMENTO');
    const eventos = this.dependencias.eventos();
    const diretorioSessao = this.dependencias.diretorioSessao();
    if (!eventos || !diretorioSessao || !this.dependencias.sessionId()) throw new Error('SESSAO_INDISPONIVEL');
    const base = await this.dependencias.capturarLinhaBase(entrada.janelaId, entrada.finalidade);
    const agora = Date.now();
    const duracaoMs = entrada.finalidade === 'desempenho' ? entrada.duracaoSegundos * 1_000 : 10 * 60 * 1_000;
    const captura: CapturaAtiva = {
      capturaId: randomUUID(), finalidade: entrada.finalidade, estado: 'coletando', janelaId: base.janelaId, rota: base.rota,
      cursorInicial: eventos.ultimoCursor, cursorBufferInicial: Math.max(0, eventos.ultimoCursor - (entrada.finalidade === 'problema' ? 20 : 0)),
      iniciadaEm: new Date(agora).toISOString(), finalizaEm: new Date(agora + duracaoMs).toISOString(), entrada, base, amostras: [], perfilDesempenho: 'completo', degradacao: { ativa: false, motivo: null }, atrasoEventLoopMs: null, timerFinalizacao: null, timerAmostragem: null,
    };
    this.capturaAtiva = captura;
    this.dependencias.alterarSonda(entrada.finalidade === 'problema', entrada.finalidade);
    if (entrada.finalidade === 'desempenho') {
      this.coletarAmostraDesempenho(captura);
      captura.timerAmostragem = setInterval(() => {
        if (!this.capturaAtiva || this.capturaAtiva.capturaId !== captura.capturaId || captura.amostras.length >= 300) return;
        this.coletarAmostraDesempenho(captura);
      }, 1_000);
    }
    captura.timerFinalizacao = setTimeout(() => { void this.finalizarInternamente(captura, captura.finalidade === 'desempenho' ? 'concluida' : 'inconclusiva', undefined, true); }, duracaoMs);
    await eventos.registrar({ origem: 'main', categoria: 'sessao', nivel: 'info', janelaId: base.janelaId, dados: { evento: 'captura_iniciada', capturaId: captura.capturaId, finalidade: entrada.finalidade } });
    return {
      capturaId: captura.capturaId, finalidade: captura.finalidade, estado: captura.estado, janelaId: captura.janelaId, rota: captura.rota,
      cursorInicial: captura.cursorInicial, expiraEm: captura.finalizaEm, finalizaEm: entrada.finalidade === 'desempenho' ? captura.finalizaEm : undefined,
      instrucoesUsuario: entrada.finalidade === 'problema' ? 'Reproduza o cenário uma vez e informe quando concluir.' : 'A captura será concluída automaticamente ao fim do período.',
      componentesIniciais: { tela: Boolean(base.tela), interface: Boolean(base.interface), geometriaRolagem: entrada.finalidade === 'problema' }, errosCaptura: base.erros,
    };
  }

  status(capturaId?: string): Record<string, unknown> {
    const captura = capturaId ? (this.capturaAtiva?.capturaId === capturaId ? this.capturaAtiva : null) : this.capturaAtiva;
    if (!captura) throw new Error('CAPTURA_NAO_ENCONTRADA');
    const eventos = this.dependencias.eventos();
    const cursorAtual = eventos?.ultimoCursor ?? captura.cursorInicial;
    const intervalo = eventos?.consultar({ depoisDe: captura.cursorInicial, limite: Math.max(1, cursorAtual - captura.cursorInicial + 1) }).eventos ?? [];
    const contagens = Object.fromEntries(['acao', 'ipc', 'erro', 'console', 'janela'].map(categoria => [categoria, intervalo.filter(evento => evento.categoria === categoria).length]));
    return { capturaId: captura.capturaId, finalidade: captura.finalidade, estado: captura.estado, iniciadaEm: captura.iniciadaEm, finalizaEm: captura.finalizaEm, cursorAtual, contagens, amostras: captura.amostras.length, perfilDesempenho: captura.perfilDesempenho, degradacao: captura.degradacao, orientacao: captura.finalidade === 'problema' ? 'Finalize após concluir a reprodução.' : 'Aguarde a finalização automática.' };
  }

  async finalizar(entrada: EntradaFinalizarCaptura): Promise<Record<string, unknown>> {
    const concluida = this.concluidas.get(entrada.capturaId);
    if (concluida) return this.paraResposta(entrada.capturaId, concluida);
    if (!this.capturaAtiva || this.capturaAtiva.capturaId !== entrada.capturaId) throw new Error('CAPTURA_NAO_ENCONTRADA');
    const classificacao = entrada.resultadoUsuario ?? (this.capturaAtiva.finalidade === 'desempenho' ? 'concluida' : 'inconclusiva');
    const resultado = await this.finalizarInternamente(this.capturaAtiva, classificacao, entrada.observacaoUsuario, false);
    return this.paraResposta(entrada.capturaId, resultado);
  }

  async consultar(entrada: EntradaConsultarCaptura): Promise<unknown> {
    const resultado = this.concluidas.get(entrada.capturaId);
    if (!resultado) throw new Error('CAPTURA_NAO_ENCONTRADA');
    if (entrada.compararComCapturaId) {
      if (entrada.componente !== 'dossie' && entrada.componente !== 'metricas_resumo') throw new Error('CAPTURA_INCOMPATIVEL');
      const outra = this.concluidas.get(entrada.compararComCapturaId);
      if (!outra) throw new Error('CAPTURA_NAO_ENCONTRADA');
      if (!outra.contextoComparacao || !resultado.contextoComparacao) throw new Error('CAPTURA_INCOMPATIVEL');
      return compararResumosDesempenho(outra.metricas, resultado.metricas, outra.contextoComparacao, resultado.contextoComparacao);
    }
    const arquivo: Record<EntradaConsultarCaptura['componente'], string> = {
      manifesto: 'manifesto.json', dossie: 'dossie-agente.json', metricas_resumo: 'metricas-resumo.json', amostras_processos: 'amostras-processos.ndjson', timeline: 'linha-do-tempo.json', eventos: 'eventos.ndjson', interface_inicial: 'interface-inicial.json', interface_final: 'interface-final.json', tela_inicial: 'tela-inicial.png', tela_final: 'tela-final.png', erro: 'erros-captura.json',
    };
    const arquivoSelecionado = arquivo[entrada.componente];
    if (entrada.componente === 'tela_inicial' || entrada.componente === 'tela_final') return { imagemBase64: (await readFile(path.join(resultado.caminho, arquivoSelecionado))).toString('base64') };
    const conteudo = await readFile(path.join(resultado.caminho, arquivoSelecionado), 'utf8');
    if (entrada.componente === 'eventos' || entrada.componente === 'amostras_processos') {
      const linhas = conteudo.split('\n').filter(Boolean);
      const itens = linhas.slice(entrada.depoisDe, entrada.depoisDe + entrada.limite).map(linha => JSON.parse(linha));
      return { itens, proximoCursor: entrada.depoisDe + itens.length, truncado: linhas.length > entrada.depoisDe + itens.length };
    }
    return JSON.parse(conteudo);
  }

  private async finalizarInternamente(captura: CapturaAtiva, classificacao: ClassificacaoCaptura, observacao: string | undefined, automatico: boolean): Promise<FinalizacaoCaptura> {
    if (captura.resultado) return captura.resultado;
    if (captura.timerFinalizacao) clearTimeout(captura.timerFinalizacao);
    if (captura.timerAmostragem) clearInterval(captura.timerAmostragem);
    this.dependencias.alterarSonda(false, captura.finalidade);
    const eventosServico = this.dependencias.eventos();
    const cursorFinal = eventosServico?.ultimoCursor ?? captura.cursorInicial;
    const todosEventos = eventosServico?.consultar({ depoisDe: captura.cursorBufferInicial, limite: Math.max(1, cursorFinal - captura.cursorBufferInicial + 1) }).eventos ?? [];
    const categorias: EventoDiagnostico['categoria'][] | undefined = captura.entrada.finalidade === 'problema'
      ? captura.entrada.categorias
      : ['sessao', 'janela'];
    const eventos = todosEventos.filter(evento => !categorias || categorias.includes(evento.categoria));
    const erros = [...captura.base.erros];
    let final: Omit<EvidenciaInicial, 'janelaId' | 'rota'> = { erros: [] };
    try { final = await this.dependencias.capturarEstadoFinal(captura.janelaId, captura.finalidade); } catch (erro) { erros.push({ componente: 'estado_final', codigo: erro instanceof Error ? erro.message : 'ERRO_INTERNO', mensagem: 'Não foi possível coletar o estado final.' }); }
    erros.push(...final.erros);
    if (captura.finalidade === 'desempenho') this.coletarAmostraDesempenho(captura);
    const sinais = captura.finalidade === 'problema' ? classificarSinais(eventos) : [];
    const resumo = sumarizar(eventos, sinais);
    const ipcs = todosEventos.flatMap(evento => evento.categoria === 'ipc' && typeof evento.dados.canal === 'string' && typeof evento.dados.duracaoMs === 'number'
      ? [{ canal: evento.dados.canal, duracaoMs: evento.dados.duracaoMs }]
      : []);
    const metricas = resumirDesempenho(captura.amostras, captura.degradacao, ipcs);
    const qualidade = erros.length === 0 && (captura.finalidade === 'desempenho' || eventos.length > 0) ? 'suficiente' : 'parcial';
    const marcadores = this.dependencias.obterMarcadores?.() ?? {};
    const dossieAgente = { qualidade, classificacao, observacaoUsuario: observacao ?? null, linhaTempoEssencial: eventos.slice(-30), anomalias: [...sinais, ...metricas.gargalos, ...metricas.ipcsLentos], classesCausa: sinais.length ? ['rolagem_programatica', 'mudanca_layout'] : metricas.gargalos.length || metricas.ipcsLentos.length ? ['desempenho'] : ['inconclusiva'], alvosInvestigacao: [...Object.entries(marcadores).map(([marcador, arquivo]) => ({ marcador, arquivo })), ...metricas.gargalos.map(gargalo => ({ processo: gargalo.processo, pid: gargalo.pid })), ...metricas.ipcsLentos.map(ipc => ({ canal: ipc.canal }))], lacunas: erros.map(erro => erro.componente), proximosPassos: sinais.length ? ['Inspecione os marcadores e arquivos associados ao contêiner rolável.'] : metricas.gargalos.length || metricas.ipcsLentos.length ? ['Repita a mesma captura após uma alteração limitada e compare os resultados.'] : ['Repita a captura com o sintoma ativo.'], componentesDisponiveis: ['manifesto', 'dossie', 'metricas_resumo', 'amostras_processos', 'timeline', 'eventos', 'interface_inicial', 'interface_final', 'tela_inicial', 'tela_final', 'erro'] };
    const diretorioSessao = this.dependencias.diretorioSessao();
    if (!diretorioSessao) throw new Error('SESSAO_INDISPONIVEL');
    const diretorioFinal = path.join(diretorioSessao, 'capturas', `${new Date().toISOString().replace(/[:.]/g, '-')}-${captura.capturaId}`);
    const temporario = `${diretorioFinal}.tmp`;
    await mkdir(temporario, { recursive: true });
    const componentes = { telaInicial: Boolean(captura.base.tela), telaFinal: Boolean(final.tela), interfaceInicial: Boolean(captura.base.interface), interfaceFinal: Boolean(final.interface), eventos: true };
    const estadoFinal = automatico && captura.finalidade === 'problema' ? 'expirada' : classificacao === 'interrompido' ? 'interrompida' : 'finalizada';
    const contextoExecucao = { versaoProtocolo: VERSAO_PROTOCOLO_DIAGNOSTICO, modo: 'diagnostico', plataforma: process.platform, arquitetura: process.arch, node: process.versions.node, electron: process.versions.electron, chromium: process.versions.chrome, rota: captura.rota, janelaId: captura.janelaId, ...captura.base.contexto };
    const marcadoresInterface = { marcadores };
    const manifesto = { versaoProtocolo: VERSAO_PROTOCOLO_DIAGNOSTICO, capturaId: captura.capturaId, sessionId: this.dependencias.sessionId(), finalidade: captura.finalidade, cenario: captura.entrada.finalidade === 'desempenho' ? captura.entrada.cenarioDesempenho : captura.entrada.cenario, perfilDesempenho: captura.finalidade === 'desempenho' ? captura.perfilDesempenho : undefined, estado: estadoFinal, classificacao, janelaId: captura.janelaId, rota: captura.rota, cursorInicial: captura.cursorInicial, cursorFinal, iniciadoEm: captura.iniciadaEm, finalizadoEm: new Date().toISOString(), componentes, componentesAusentes: Object.entries(componentes).filter(([, disponivel]) => !disponivel).map(([nome]) => nome), errosCaptura: erros };
    const limiteDadosDesempenho = 8 * 1024 * 1024;
    const eventosNdjson = captura.finalidade === 'desempenho' ? limitarNdjsonPorBytes(paraNdjson(eventos), Math.floor(limiteDadosDesempenho * 0.1)) : paraNdjson(eventos);
    const amostrasNdjson = limitarNdjsonPorBytes(captura.amostras.map(amostra => JSON.stringify(amostra)).join('\n'), captura.finalidade === 'desempenho' ? Math.floor(limiteDadosDesempenho * 0.9) : limiteDadosDesempenho);
    await Promise.all([
      writeFile(path.join(temporario, 'manifesto.json'), JSON.stringify(manifesto, null, 2)),
      writeFile(path.join(temporario, 'dossie-agente.json'), JSON.stringify(dossieAgente, null, 2)),
      writeFile(path.join(temporario, 'resumo.md'), `# Captura ${captura.capturaId}\n\nFinalidade: ${captura.finalidade}\nClassificação: ${classificacao}\nQualidade: ${qualidade}\n`),
      writeFile(path.join(temporario, 'contexto-execucao.json'), JSON.stringify(contextoExecucao, null, 2)),
      writeFile(path.join(temporario, 'marcadores-interface.json'), JSON.stringify(marcadoresInterface, null, 2)),
      writeFile(path.join(temporario, 'linha-do-tempo.json'), JSON.stringify(eventos.slice(-30), null, 2)),
      writeFile(path.join(temporario, 'eventos.ndjson'), eventosNdjson),
      writeFile(path.join(temporario, 'erros-captura.json'), JSON.stringify(erros, null, 2)),
      writeFile(path.join(temporario, 'metricas-resumo.json'), JSON.stringify(metricas, null, 2)),
      writeFile(path.join(temporario, 'amostras-processos.ndjson'), amostrasNdjson),
    ]);
    if (captura.base.interface) await writeFile(path.join(temporario, 'interface-inicial.json'), JSON.stringify(captura.base.interface, null, 2));
    if (final.interface) await writeFile(path.join(temporario, 'interface-final.json'), JSON.stringify(final.interface, null, 2));
    if (captura.base.tela) await writeFile(path.join(temporario, 'tela-inicial.png'), captura.base.tela);
    if (final.tela) await writeFile(path.join(temporario, 'tela-final.png'), final.tela);
    await rename(temporario, diretorioFinal);
    const contextoComparacao = captura.entrada.finalidade === 'desempenho' ? { finalidade: 'desempenho' as const, cenario: captura.entrada.cenarioDesempenho, versaoProtocolo: VERSAO_PROTOCOLO_DIAGNOSTICO, perfil: captura.perfilDesempenho } : undefined;
    const resultado = { classificacao, cursorFinal, caminho: diretorioFinal, dossieAgente, componentes, errosCaptura: erros, resumo, metricas, contextoComparacao };
    captura.resultado = resultado;
    captura.estado = estadoFinal;
    this.concluidas.set(captura.capturaId, resultado);
    this.capturaAtiva = null;
    await eventosServico?.registrar({ origem: 'main', categoria: 'sessao', nivel: 'info', janelaId: captura.janelaId, dados: { evento: 'captura_finalizada', capturaId: captura.capturaId, finalidade: captura.finalidade } });
    return resultado;
  }

  private paraResposta(capturaId: string, resultado: FinalizacaoCaptura): Record<string, unknown> {
    return { capturaId, estado: 'finalizada', classificacao: resultado.classificacao, cursorFinal: resultado.cursorFinal, resumo: resultado.resumo, sinais: resultado.resumo.sinais, dossieAgente: resultado.dossieAgente, caminho: resultado.caminho, componentes: resultado.componentes, errosCaptura: resultado.errosCaptura };
  }

  async interromper(motivo: string): Promise<void> {
    if (!this.capturaAtiva) return;
    await this.finalizarInternamente(this.capturaAtiva, 'interrompido', motivo, false);
  }

  finalidadeAtiva(): FinalidadeCaptura | null {
    return this.capturaAtiva?.finalidade ?? null;
  }

  private coletarAmostraDesempenho(captura: CapturaAtiva): void {
    const atrasoEventLoopMs = this.dependencias.obterAtrasoEventLoop?.() ?? null;
    captura.atrasoEventLoopMs = atrasoEventLoopMs;
    const pendenciasPersistencia = this.dependencias.obterPendenciasPersistencia?.() ?? 0;
    if (!captura.degradacao.ativa && (pendenciasPersistencia >= 20 || (atrasoEventLoopMs !== null && atrasoEventLoopMs > 50))) {
      captura.perfilDesempenho = 'essencial';
      captura.degradacao = { ativa: true, motivo: pendenciasPersistencia >= 20 ? 'FILA_PERSISTENCIA' : 'ATRASO_EVENT_LOOP' };
    }
    const amostras = this.dependencias.obterMetricas?.() ?? [];
    const fontes = captura.perfilDesempenho === 'essencial'
      ? amostras.filter(amostra => typeof amostra === 'object' && amostra && ['Browser', 'GPU'].includes(String((amostra as Record<string, unknown>).tipo)))
      : amostras;
    const restantes = Math.max(0, 300 - captura.amostras.length);
    const amostrasNormalizadas = normalizarAmostrasDesempenho(fontes);
    captura.amostras.push(...amostrasNormalizadas.slice(0, restantes).map(amostra => ({ ...amostra, atrasoEventLoopMs })));
    if (captura.amostras.length >= 300 && !captura.degradacao.ativa) {
      captura.perfilDesempenho = 'essencial';
      captura.degradacao = { ativa: true, motivo: 'LIMITE_AMOSTRAS' };
    }
  }
}
