import { codigosFalhaListaRepsGdl } from '../../shared/types/gdl-minhas-reps.types.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { classificarFalhaListaRepsGdl } from './gdl-minhas-reps-erro.service.js';
import type { AmbienteGdl } from '../../shared/gdl/ambiente.js';
import type { AcessoAutenticadoGdl, EstadoConexaoGdl } from '../../shared/gdl/conexao.js';

export interface ContextoConexaoGdl {
  ambiente: AmbienteGdl;
  identidade: string;
  baseUrl: string;
  autorizacao: string;
  credenciaisConfiguradas: boolean;
  validadoEm: string | null;
}

interface RegistroConexaoGdl {
  ambiente: AmbienteGdl;
  operacao: string;
  resultado: string;
  motivo: string;
  rede: EstadoConexaoGdl['rede'];
  credenciais: EstadoConexaoGdl['credenciais'];
  web: EstadoConexaoGdl['web'];
  redeVerificadaEm: string | null;
  credenciaisValidadasEm: string | null;
  acessoConfirmadoEm: string | null;
}

interface DependenciasConexaoGdl {
  obterContexto: () => Promise<ContextoConexaoGdl>;
  verificar: (contexto: ContextoConexaoGdl) => Promise<boolean>;
  registrarMudanca?: (dados: RegistroConexaoGdl) => void;
}

export interface ObservacaoConexaoGdl {
  revisao: number;
  identidade: string;
  autenticada: boolean;
  sequencia: number;
}

export class ConexaoGdlService {
  private dependencias?: DependenciasConexaoGdl;
  private contexto?: ContextoConexaoGdl;
  private estado?: EstadoConexaoGdl;
  private operacao = new AsyncLocalStorage<{ requisitou: boolean; rede?: boolean; falha?: unknown }>();
  private versaoEstado = 0;
  private revisao = 0;
  private sequencia = 0;
  private ultimaRede = 0;
  private ultimaAutenticacao = 0;
  private ultimaWeb = 0;
  private ultimaOperacaoAutenticada = 0;
  private estadosRegistrados = new Map<string, string>();
  private verificacao?: { revisao: number; promessa: Promise<EstadoConexaoGdl> };
  private ouvintes = new Set<(estado: EstadoConexaoGdl) => void>();

  constructor(dependencias?: DependenciasConexaoGdl) { this.dependencias = dependencias; }

  configurar(dependencias: DependenciasConexaoGdl): void { this.dependencias = dependencias; }

  observar(ouvinte: (estado: EstadoConexaoGdl) => void): () => void {
    this.ouvintes.add(ouvinte);
    return () => { this.ouvintes.delete(ouvinte); };
  }

  private copiarEstado(): EstadoConexaoGdl {
    if (!this.estado) throw new Error('Estado do GDL indisponível.');
    return { ...this.estado, ultimoTesteRede: this.estado.ultimoTesteRede ? { ...this.estado.ultimoTesteRede } : null, acessoAutenticado: this.estado.acessoAutenticado ? { ...this.estado.acessoAutenticado } : null };
  }

  private notificar(): void {
    if (!this.estado) return;
    this.estado.versaoEstado = ++this.versaoEstado;
    for (const ouvinte of this.ouvintes) ouvinte(this.copiarEstado());
  }

  contextoAlterado(): void {
    this.revisao += 1;
    this.contexto = undefined;
    this.estadosRegistrados.clear();
    this.estado = undefined;
    this.verificacao = undefined;
    void this.obterEstado().then(() => this.notificar()).catch(() => undefined);
  }

  private async atualizarContexto(): Promise<ContextoConexaoGdl> {
    if (!this.dependencias) throw new Error('Monitor do GDL não inicializado.');
    const revisao = this.revisao;
    const contexto = await this.dependencias.obterContexto();
    if (revisao !== this.revisao) return this.atualizarContexto();
    if (this.contexto && this.contexto.identidade !== contexto.identidade) {
      this.contextoAlterado();
      return this.atualizarContexto();
    }
    this.contexto = contexto;
    if (!this.estado) {
      this.estado = {
        ambiente: contexto.ambiente, revisao: this.revisao, versaoEstado: ++this.versaoEstado,
        rede: 'desconhecida', redeVerificadaEm: null,
        credenciais: !contexto.credenciaisConfiguradas ? 'ausentes' : contexto.validadoEm ? 'validadas' : 'pendentes',
        credenciaisValidadasEm: contexto.validadoEm, web: 'desconhecida', verificando: false, ultimoTesteRede: null, acessoAutenticado: null,
      };
      this.registrarMudanca('contexto', 'inicializado', 'contexto_carregado');
    }
    return contexto;
  }

  async obterEstado(): Promise<EstadoConexaoGdl> {
    await this.atualizarContexto();
    if (!this.estado) throw new Error('O contexto do GDL mudou.');
    return this.copiarEstado();
  }

  private registrarMudanca(operacao: string, resultado: string, motivo: string): void {
    if (!this.estado || this.estadosRegistrados.get(operacao) === resultado) return;
    this.estadosRegistrados.set(operacao, resultado);
    try {
      const { ambiente, rede, credenciais, web, redeVerificadaEm, credenciaisValidadasEm } = this.estado;
      this.dependencias?.registrarMudanca?.({ ambiente, operacao, resultado, motivo, rede, credenciais, web,
        redeVerificadaEm, credenciaisValidadasEm, acessoConfirmadoEm: this.estado.acessoAutenticado?.confirmadoEm ?? null });
    }
    catch { /* O registro não interfere na conexão. */ }
  }

  private registrarAcesso(observacao: ObservacaoConexaoGdl, origem: AcessoAutenticadoGdl['origem'], resultado: AcessoAutenticadoGdl['resultado'], motivo?: string, condicaoEsperada?: 'acesso_rede_institucional'): void {
    if (!observacao.autenticada || !this.estado || observacao.sequencia < this.ultimaOperacaoAutenticada) return;
    this.ultimaOperacaoAutenticada = observacao.sequencia;
    const anterior = this.estado.acessoAutenticado;
    const realizadaEm = new Date(Date.now()).toISOString();
    this.estado.acessoAutenticado = {
      origem, resultado, realizadaEm, motivo, condicaoEsperada,
      confirmadoEm: resultado === 'sucesso' ? realizadaEm : anterior?.confirmadoEm ?? null,
      rejeicaoPendente: resultado === 'rejeitada' || (resultado === 'falha' && Boolean(anterior?.rejeicaoPendente)),
    };
    this.registrarMudanca('acesso_autenticado', resultado, `${origem}_${resultado}`);
  }

  async capturarRequisicao(url: string, autorizacao?: string): Promise<ObservacaoConexaoGdl | null> {
    const contexto = await this.atualizarContexto();
    const operacao = this.operacao.getStore();
    const base = contexto.baseUrl.replace(/\/api$/i, '');
    if (!url.startsWith(`${base}/`)) return null;
    if (autorizacao && autorizacao !== contexto.autorizacao) return null;
    if (operacao) operacao.requisitou = true;
    return { revisao: this.revisao, identidade: contexto.identidade,
      autenticada: Boolean(autorizacao && autorizacao === contexto.autorizacao), sequencia: ++this.sequencia };
  }

  observacaoAtual(observacao: ObservacaoConexaoGdl | null): observacao is ObservacaoConexaoGdl {
    return Boolean(observacao && this.estado && observacao.revisao === this.revisao
      && observacao.identidade === this.contexto?.identidade);
  }

  registrarRede(observacao: ObservacaoConexaoGdl | null, acessivel: boolean, publicar = true): void {
    const operacao = this.operacao.getStore();
    if (operacao) { operacao.rede = acessivel; return; }
    if (!this.observacaoAtual(observacao) || !this.estado || observacao.sequencia < this.ultimaRede) return;
    this.ultimaRede = observacao.sequencia;
    this.estado.rede = acessivel ? 'acessivel' : 'indisponivel';
    if (!acessivel && this.estado.acessoAutenticado?.resultado === 'sucesso') this.estado.acessoAutenticado.confirmadoEm = null;
    this.estado.redeVerificadaEm = new Date(Date.now()).toISOString();
    this.registrarMudanca('rede', this.estado.rede, acessivel ? 'resposta_recebida' : 'checagem_sem_acesso');
    if (publicar) this.notificar();
  }

  registrarAutenticacao(observacao: ObservacaoConexaoGdl | null, validada: boolean): void {
    if (this.operacao.getStore()) return;
    if (!this.observacaoAtual(observacao) || !observacao.autenticada || !this.estado
      || observacao.sequencia < this.ultimaAutenticacao) return;
    this.ultimaAutenticacao = observacao.sequencia;
    this.estado.credenciais = validada ? 'validadas' : 'rejeitadas';
    this.estado.credenciaisValidadasEm = validada ? new Date(Date.now()).toISOString() : null;
    this.registrarMudanca('autenticacao_api', this.estado.credenciais, validada ? 'consulta_autenticada' : 'autenticacao_rejeitada');
    this.registrarResultado(observacao, 'api', validada ? undefined : { codigo: 'autenticacao' });
    this.notificar();
  }

  limparAutenticacao(ambiente: AmbienteGdl): void {
    if (this.estado?.ambiente !== ambiente) return;
    this.estado.credenciais = this.contexto?.credenciaisConfiguradas ? 'pendentes' : 'ausentes';
    this.estado.credenciaisValidadasEm = null;
    this.estado.acessoAutenticado = null;
    this.ultimaOperacaoAutenticada = ++this.sequencia;
    this.ultimaAutenticacao = this.sequencia;
    this.ultimaWeb = this.sequencia;
    this.registrarMudanca('autenticacao_api', this.estado.credenciais, 'validacao_limpa');
    this.notificar();
  }

  registrarWeb(observacao: ObservacaoConexaoGdl | null, disponivel: boolean, autenticacaoRejeitada = false): void {
    if (this.operacao.getStore()) return;
    if (!this.observacaoAtual(observacao) || !this.estado || observacao.sequencia < this.ultimaWeb) return;
    this.ultimaWeb = observacao.sequencia;
    this.estado.web = disponivel ? 'disponivel' : 'atencao';
    this.registrarMudanca('acesso_web', this.estado.web, disponivel ? 'consulta_concluida' : 'consulta_nao_concluida');
    this.registrarResultado(observacao, 'web', disponivel ? undefined : { codigo: autenticacaoRejeitada ? 'autenticacao' : 'estrutura' });
    this.notificar();
  }

  private registrarResultado(observacao: ObservacaoConexaoGdl, origem: AcessoAutenticadoGdl['origem'], falha?: { codigo: string; condicaoEsperada?: 'acesso_rede_institucional' }, rede?: boolean): void {
    if (!this.observacaoAtual(observacao) || !this.estado || observacao.sequencia < this.ultimaOperacaoAutenticada) return;
    this.ultimaRede = Math.max(this.ultimaRede, observacao.sequencia);
    const redeIndisponivel = falha?.codigo === 'rede' || falha?.codigo === 'tempo_esgotado';
    this.estado.rede = (!falha || (rede ?? !redeIndisponivel)) ? 'acessivel' : 'indisponivel';
    this.estado.redeVerificadaEm = new Date().toISOString();
    if (origem === 'web') this.estado.web = falha ? 'atencao' : 'disponivel';
    if (origem === 'api' && (!falha || falha.codigo === 'autenticacao')) {
      this.estado.credenciais = falha ? 'rejeitadas' : 'validadas';
      this.estado.credenciaisValidadasEm = falha ? null : new Date().toISOString();
    }
    this.registrarAcesso(observacao, origem, !falha ? 'sucesso' : falha.codigo === 'autenticacao' ? 'rejeitada' : 'falha', falha?.codigo, falha?.condicaoEsperada);
  }

  registrarFalhaRecuperacao(erro: unknown): void {
    const operacao = this.operacao.getStore();
    if (operacao) operacao.falha = erro;
  }

  async executarOperacao<T>(origem: AcessoAutenticadoGdl['origem'], consulta: () => Promise<T>): Promise<T> {
    if (this.operacao.getStore()) return consulta();
    const contexto = await this.atualizarContexto().catch(() => null);
    const observacao = contexto ? await this.capturarRequisicao(`${contexto.baseUrl}/`, contexto.autorizacao).catch(() => null) : null;
    const operacao: { requisitou: boolean; rede?: boolean; falha?: unknown } = { requisitou: false };
    const concluir = (erro?: unknown, codigo?: typeof codigosFalhaListaRepsGdl[number], condicaoEsperada?: 'acesso_rede_institucional') => {
      if (!operacao.requisitou || !this.observacaoAtual(observacao)) return;
      const falha = erro === undefined ? undefined : { ...classificarFalhaListaRepsGdl(erro), ...(codigo ? { codigo } : {}), ...(condicaoEsperada ? { condicaoEsperada } : {}) };
      if (falha && ['desativada', 'cache_local'].includes(falha.codigo)) return;
      const mensagem = erro instanceof Error ? erro.message : '';
      if (/cancelad|configuração.*mudou|sessão.*mudou/i.test(mensagem) || (erro instanceof Error && erro.name === 'AbortError')) return;
      this.registrarResultado(observacao, origem, falha, operacao.rede);
      this.notificar();
    };
    try {
      const resultado = await this.operacao.run(operacao, consulta);
      if (resultado && typeof resultado === 'object' && 'sucesso' in resultado && resultado.sucesso === false) {
        const mensagem = 'erro' in resultado && typeof resultado.erro === 'string' ? resultado.erro : 'Não foi possível recuperar dados do GDL.';
        const falha = 'falha' in resultado ? resultado.falha : undefined;
        const codigo = falha && typeof falha === 'object' && 'codigo' in falha
          ? codigosFalhaListaRepsGdl.find(candidato => candidato === falha.codigo) : undefined;
        const condicaoEsperada = falha && typeof falha === 'object' && 'condicaoEsperada' in falha
          && falha.condicaoEsperada === 'acesso_rede_institucional' ? falha.condicaoEsperada : undefined;
        concluir(new Error(mensagem), codigo, condicaoEsperada);
      } else if (resultado && typeof resultado === 'object' && 'erroNaturezaExame' in resultado
        && typeof resultado.erroNaturezaExame === 'string' && resultado.erroNaturezaExame) {
        concluir(new Error('Resposta da consulta em formato inesperado ou incompleto.'), 'estrutura');
      } else concluir(operacao.falha);
      return resultado;
    } catch (erro: unknown) {
      concluir(erro);
      throw erro;
    }
  }

  async verificar(): Promise<EstadoConexaoGdl> {
    const contexto = await this.atualizarContexto();
    if (this.verificacao?.revisao === this.revisao) return this.verificacao.promessa;
    const observacao = await this.capturarRequisicao(`${contexto.baseUrl}/unidadesMedida`);
    if (!this.observacaoAtual(observacao)) return this.obterEstado();
    if (this.verificacao?.revisao === this.revisao) return this.verificacao.promessa;
    const revisao = this.revisao;
    if (this.estado) this.estado.verificando = true;
    this.notificar();
    const inicio = performance.now();
    const promessa = (async () => {
      let sucesso = false;
      try {
        sucesso = await this.dependencias!.verificar(contexto);
      } catch { sucesso = false; }
      try {
        if (this.observacaoAtual(observacao) && this.estado && observacao.sequencia >= this.ultimaRede) {
          this.estado.ultimoTesteRede = { sucesso, verificadoEm: new Date(Date.now()).toISOString(),
            duracaoMs: Math.round(Math.max(0, performance.now() - inicio)) };
          this.registrarRede(observacao, sucesso, false);
        }
      } finally {
        if (revisao === this.revisao) {
          if (this.estado) this.estado.verificando = false;
          this.verificacao = undefined;
          this.notificar();
        }
      }
      return this.obterEstado();
    })();
    this.verificacao = { revisao, promessa };
    return promessa;
  }
}

export const conexaoGdlService = new ConexaoGdlService();
