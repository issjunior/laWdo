import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  EntradaConsultarCaptura,
  EntradaFinalizarCaptura,
  EntradaIniciarCaptura,
  EventoDiagnostico,
} from '../../shared/diagnostico/contratos.js';
import type { DiagnosticoEventosService } from './diagnostico-eventos.service.js';
import { compararResumosDesempenho, resumirDesempenho, type ResumoDesempenhoDiagnostico } from './diagnostico-desempenho.service.js';

type FinalidadeCaptura = EntradaIniciarCaptura['finalidade'];
type EstadoCaptura = 'preparando' | 'coletando' | 'finalizada' | 'expirada' | 'cancelada' | 'interrompida';
type ClassificacaoCaptura = 'reproduzido' | 'nao_reproduzido' | 'interrompido' | 'inconclusiva';

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
  capturarLinhaBase: (janelaId?: number) => Promise<EvidenciaInicial>;
  capturarEstadoFinal: (janelaId: number) => Promise<Omit<EvidenciaInicial, 'janelaId' | 'rota'>>;
  obterMetricas?: () => unknown[];
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
}

function paraNdjson(eventos: EventoDiagnostico[]): string {
  return eventos.map(evento => JSON.stringify(evento)).join('\n').concat(eventos.length ? '\n' : '');
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
    const houveWheel = eventos.slice(Math.max(0, indice - 3), indice).some(evento => evento.categoria === 'acao' && evento.dados.tipo === 'wheel');
    if (!houveWheel) sinais.push({
      tipo: 'salto_rolagem_sem_entrada', confianca: 'media', eventosSuporte: [anterior.sequencia, atual.sequencia],
      descricao: `A rolagem mudou de ${anteriorY} para ${atualY} sem wheel associado.`,
    });
  }
  return sinais.slice(0, 20);
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
    const base = await this.dependencias.capturarLinhaBase(entrada.janelaId);
    const agora = Date.now();
    const duracaoMs = entrada.finalidade === 'desempenho' ? entrada.duracaoSegundos * 1_000 : 10 * 60 * 1_000;
    const captura: CapturaAtiva = {
      capturaId: randomUUID(), finalidade: entrada.finalidade, estado: 'coletando', janelaId: base.janelaId, rota: base.rota,
      cursorInicial: eventos.ultimoCursor, cursorBufferInicial: Math.max(0, eventos.ultimoCursor - (entrada.finalidade === 'problema' ? 20 : 0)),
      iniciadaEm: new Date(agora).toISOString(), finalizaEm: new Date(agora + duracaoMs).toISOString(), entrada, base, amostras: [], timerFinalizacao: null, timerAmostragem: null,
    };
    this.capturaAtiva = captura;
    this.dependencias.alterarSonda(entrada.finalidade === 'problema', entrada.finalidade);
    if (entrada.finalidade === 'desempenho') {
      captura.amostras.push(...(this.dependencias.obterMetricas?.() ?? []));
      captura.timerAmostragem = setInterval(() => {
        if (!this.capturaAtiva || this.capturaAtiva.capturaId !== captura.capturaId || captura.amostras.length >= 300) return;
        captura.amostras.push(...(this.dependencias.obterMetricas?.() ?? []));
      }, 1_000);
    }
    captura.timerFinalizacao = setTimeout(() => { void this.finalizarInternamente(captura, 'inconclusiva', undefined, true); }, duracaoMs);
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
    return { capturaId: captura.capturaId, finalidade: captura.finalidade, estado: captura.estado, iniciadaEm: captura.iniciadaEm, finalizaEm: captura.finalizaEm, cursorAtual: this.dependencias.eventos()?.ultimoCursor ?? captura.cursorInicial, amostras: captura.amostras.length };
  }

  async finalizar(entrada: EntradaFinalizarCaptura): Promise<Record<string, unknown>> {
    const concluida = this.concluidas.get(entrada.capturaId);
    if (concluida) return this.paraResposta(entrada.capturaId, concluida);
    if (!this.capturaAtiva || this.capturaAtiva.capturaId !== entrada.capturaId) throw new Error('CAPTURA_NAO_ENCONTRADA');
    const classificacao = entrada.resultadoUsuario ?? 'inconclusiva';
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
      return compararResumosDesempenho(outra.metricas, resultado.metricas);
    }
    const arquivo: Record<EntradaConsultarCaptura['componente'], string> = {
      manifesto: 'manifesto.json', dossie: 'dossie-agente.json', metricas_resumo: 'metricas-resumo.json', amostras_processos: 'amostras-processos.ndjson', timeline: 'linha-do-tempo.json', eventos: 'eventos.ndjson', interface_inicial: 'interface-inicial.json', interface_final: 'interface-final.json', tela_inicial: 'tela-inicial.png', tela_final: 'tela-final.png', erro: 'erros-captura.json',
    };
    const arquivoSelecionado = arquivo[entrada.componente];
    if (entrada.componente === 'tela_inicial' || entrada.componente === 'tela_final') return readFile(path.join(resultado.caminho, arquivoSelecionado));
    const conteudo = await readFile(path.join(resultado.caminho, arquivoSelecionado), 'utf8');
    if (entrada.componente === 'eventos' || entrada.componente === 'amostras_processos') return conteudo.split('\n').filter(Boolean).slice(entrada.depoisDe, entrada.depoisDe + entrada.limite).map(linha => JSON.parse(linha));
    return JSON.parse(conteudo);
  }

  private async finalizarInternamente(captura: CapturaAtiva, classificacao: ClassificacaoCaptura, observacao: string | undefined, automatico: boolean): Promise<FinalizacaoCaptura> {
    if (captura.resultado) return captura.resultado;
    if (captura.timerFinalizacao) clearTimeout(captura.timerFinalizacao);
    if (captura.timerAmostragem) clearInterval(captura.timerAmostragem);
    this.dependencias.alterarSonda(false, captura.finalidade);
    const eventosServico = this.dependencias.eventos();
    const cursorFinal = eventosServico?.ultimoCursor ?? captura.cursorInicial;
    const eventos = eventosServico?.consultar({ depoisDe: captura.cursorBufferInicial, limite: Math.max(1, cursorFinal - captura.cursorBufferInicial + 1) }).eventos ?? [];
    const erros = [...captura.base.erros];
    let final: Omit<EvidenciaInicial, 'janelaId' | 'rota'> = { erros: [] };
    try { final = await this.dependencias.capturarEstadoFinal(captura.janelaId); } catch (erro) { erros.push({ componente: 'estado_final', codigo: erro instanceof Error ? erro.message : 'ERRO_INTERNO', mensagem: 'Não foi possível coletar o estado final.' }); }
    erros.push(...final.erros);
    if (captura.finalidade === 'desempenho') captura.amostras.push(...(this.dependencias.obterMetricas?.() ?? []));
    const sinais = captura.finalidade === 'problema' ? classificarSinais(eventos) : [];
    const resumo = sumarizar(eventos, sinais);
    const metricas = resumirDesempenho(captura.amostras);
    const qualidade = erros.length === 0 && (captura.finalidade === 'desempenho' || eventos.length > 0) ? 'suficiente' : 'parcial';
    const marcadores = this.dependencias.obterMarcadores?.() ?? {};
    const dossieAgente = { qualidade, classificacao, observacaoUsuario: observacao ?? null, linhaTempoEssencial: eventos.slice(-30), anomalias: [...sinais, ...metricas.gargalos], classesCausa: sinais.length ? ['rolagem_programatica', 'mudanca_layout'] : metricas.gargalos.length ? ['desempenho'] : ['inconclusiva'], alvosInvestigacao: [...Object.entries(marcadores).map(([marcador, arquivo]) => ({ marcador, arquivo })), ...metricas.gargalos.map(gargalo => ({ processo: gargalo.processo, pid: gargalo.pid }))], lacunas: erros.map(erro => erro.componente), proximosPassos: sinais.length ? ['Inspecione os marcadores e arquivos associados ao contêiner rolável.'] : metricas.gargalos.length ? ['Repita a mesma captura após uma alteração limitada e compare os resultados.'] : ['Repita a captura com o sintoma ativo.'] };
    const diretorioSessao = this.dependencias.diretorioSessao();
    if (!diretorioSessao) throw new Error('SESSAO_INDISPONIVEL');
    const diretorioFinal = path.join(diretorioSessao, 'capturas', `${new Date().toISOString().replace(/[:.]/g, '-')}-${captura.capturaId}`);
    const temporario = `${diretorioFinal}.tmp`;
    await mkdir(temporario, { recursive: true });
    const componentes = { telaInicial: Boolean(captura.base.tela), telaFinal: Boolean(final.tela), interfaceInicial: Boolean(captura.base.interface), interfaceFinal: Boolean(final.interface), eventos: true };
    await Promise.all([
      writeFile(path.join(temporario, 'manifesto.json'), JSON.stringify({ versaoProtocolo: 1, capturaId: captura.capturaId, sessionId: this.dependencias.sessionId(), finalidade: captura.finalidade, estado: automatico ? 'expirada' : 'finalizada', classificacao, janelaId: captura.janelaId, rota: captura.rota, cursorInicial: captura.cursorInicial, cursorFinal, iniciadoEm: captura.iniciadaEm, finalizadoEm: new Date().toISOString(), componentes, errosCaptura: erros }, null, 2)),
      writeFile(path.join(temporario, 'dossie-agente.json'), JSON.stringify(dossieAgente, null, 2)),
      writeFile(path.join(temporario, 'linha-do-tempo.json'), JSON.stringify(eventos.slice(-30), null, 2)),
      writeFile(path.join(temporario, 'eventos.ndjson'), paraNdjson(eventos)),
      writeFile(path.join(temporario, 'erros-captura.json'), JSON.stringify(erros, null, 2)),
      writeFile(path.join(temporario, 'metricas-resumo.json'), JSON.stringify(metricas, null, 2)),
      writeFile(path.join(temporario, 'amostras-processos.ndjson'), captura.amostras.map(amostra => JSON.stringify(amostra)).join('\n')),
    ]);
    if (captura.base.interface) await writeFile(path.join(temporario, 'interface-inicial.json'), JSON.stringify(captura.base.interface, null, 2));
    if (final.interface) await writeFile(path.join(temporario, 'interface-final.json'), JSON.stringify(final.interface, null, 2));
    if (captura.base.tela) await writeFile(path.join(temporario, 'tela-inicial.png'), captura.base.tela);
    if (final.tela) await writeFile(path.join(temporario, 'tela-final.png'), final.tela);
    await rename(temporario, diretorioFinal);
    const resultado = { classificacao, cursorFinal, caminho: diretorioFinal, dossieAgente, componentes, errosCaptura: erros, resumo, metricas };
    captura.resultado = resultado;
    captura.estado = automatico ? 'expirada' : 'finalizada';
    this.concluidas.set(captura.capturaId, resultado);
    this.capturaAtiva = null;
    await eventosServico?.registrar({ origem: 'main', categoria: 'sessao', nivel: 'info', janelaId: captura.janelaId, dados: { evento: 'captura_finalizada', capturaId: captura.capturaId, finalidade: captura.finalidade } });
    return resultado;
  }

  private paraResposta(capturaId: string, resultado: FinalizacaoCaptura): Record<string, unknown> {
    return { capturaId, estado: 'finalizada', classificacao: resultado.classificacao, cursorFinal: resultado.cursorFinal, resumo: resultado.resumo, sinais: resultado.resumo.sinais, dossieAgente: resultado.dossieAgente, caminho: resultado.caminho, componentes: resultado.componentes, errosCaptura: resultado.errosCaptura };
  }
}
