import type { AmbienteGdl } from '../../shared/gdl/ambiente.js';
import type { EstadoConexaoGdl } from '../../shared/gdl/conexao.js';

export interface ContextoConexaoGdl {
  ambiente: AmbienteGdl;
  identidade: string;
  baseUrl: string;
  autorizacao: string;
  credenciaisConfiguradas: boolean;
  validadoEm: string | null;
}

interface DependenciasConexaoGdl {
  obterContexto: () => Promise<ContextoConexaoGdl>;
  verificar: (contexto: ContextoConexaoGdl) => Promise<boolean>;
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
  private revisao = 0;
  private sequencia = 0;
  private ultimaRede = 0;
  private ultimaAutenticacao = 0;
  private ultimaWeb = 0;
  private verificacao?: { revisao: number; promessa: Promise<EstadoConexaoGdl> };
  private ouvintes = new Set<() => void>();

  constructor(dependencias?: DependenciasConexaoGdl) { this.dependencias = dependencias; }

  configurar(dependencias: DependenciasConexaoGdl): void { this.dependencias = dependencias; }

  observar(ouvinte: () => void): () => void {
    this.ouvintes.add(ouvinte);
    return () => { this.ouvintes.delete(ouvinte); };
  }

  private notificar(): void { for (const ouvinte of this.ouvintes) ouvinte(); }

  contextoAlterado(): void {
    this.revisao += 1;
    this.contexto = undefined;
    this.estado = undefined;
    this.verificacao = undefined;
    this.notificar();
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
        ambiente: contexto.ambiente, revisao: this.revisao,
        rede: 'desconhecida', redeVerificadaEm: null,
        credenciais: !contexto.credenciaisConfiguradas ? 'ausentes' : contexto.validadoEm ? 'validadas' : 'pendentes',
        credenciaisValidadasEm: contexto.validadoEm, web: 'desconhecida', verificando: false,
      };
    }
    return contexto;
  }

  async obterEstado(): Promise<EstadoConexaoGdl> {
    await this.atualizarContexto();
    if (!this.estado) throw new Error('O contexto do GDL mudou.');
    return { ...this.estado };
  }

  async capturarRequisicao(url: string, autorizacao?: string): Promise<ObservacaoConexaoGdl | null> {
    const contexto = await this.atualizarContexto();
    const base = contexto.baseUrl.replace(/\/api$/i, '');
    if (!url.startsWith(`${base}/`)) return null;
    if (autorizacao && autorizacao !== contexto.autorizacao) return null;
    return { revisao: this.revisao, identidade: contexto.identidade,
      autenticada: Boolean(autorizacao && autorizacao === contexto.autorizacao), sequencia: ++this.sequencia };
  }

  observacaoAtual(observacao: ObservacaoConexaoGdl | null): observacao is ObservacaoConexaoGdl {
    return Boolean(observacao && this.estado && observacao.revisao === this.revisao
      && observacao.identidade === this.contexto?.identidade);
  }

  registrarRede(observacao: ObservacaoConexaoGdl | null, acessivel: boolean): void {
    if (!this.observacaoAtual(observacao) || !this.estado || observacao.sequencia < this.ultimaRede) return;
    this.ultimaRede = observacao.sequencia;
    this.estado.rede = acessivel ? 'acessivel' : 'indisponivel';
    this.estado.redeVerificadaEm = new Date().toISOString();
    this.notificar();
  }

  registrarAutenticacao(observacao: ObservacaoConexaoGdl | null, validada: boolean): void {
    if (!this.observacaoAtual(observacao) || !observacao.autenticada || !this.estado
      || observacao.sequencia < this.ultimaAutenticacao) return;
    this.ultimaAutenticacao = observacao.sequencia;
    this.estado.credenciais = validada ? 'validadas' : 'rejeitadas';
    this.estado.credenciaisValidadasEm = validada ? new Date().toISOString() : null;
    this.notificar();
  }

  limparAutenticacao(ambiente: AmbienteGdl): void {
    if (this.estado?.ambiente !== ambiente) return;
    this.estado.credenciais = this.contexto?.credenciaisConfiguradas ? 'pendentes' : 'ausentes';
    this.estado.credenciaisValidadasEm = null;
    this.notificar();
  }

  registrarWeb(observacao: ObservacaoConexaoGdl | null, disponivel: boolean): void {
    if (!this.observacaoAtual(observacao) || !this.estado || observacao.sequencia < this.ultimaWeb) return;
    this.ultimaWeb = observacao.sequencia;
    this.estado.web = disponivel ? 'disponivel' : 'atencao';
    this.notificar();
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
    const promessa = (async () => {
      try {
        const sucesso = await this.dependencias!.verificar(contexto);
        this.registrarRede(observacao, sucesso);
      } catch {
        this.registrarRede(observacao, false);
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
