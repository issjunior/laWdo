import { VALIDADE_CACHE_LISTAGEM_MS } from '../../shared/gdl/listagem.js';
import type { SnapshotMinhasRepsGdl } from '../../shared/types/gdl-minhas-reps.types.js';
import { atividadeGdlService, AtividadeGdlService, OCIOSIDADE_GDL_MS } from './gdl-atividade.service.js';

interface DependenciasAgendadorGdl {
  obterUsuarios: () => string[];
  habilitada: () => Promise<boolean>;
  identidade: () => Promise<string>;
  obterCache: (usuarioId: string) => Promise<SnapshotMinhasRepsGdl | null>;
  atualizar: (usuarioId: string, validar: () => Promise<void>) => Promise<SnapshotMinhasRepsGdl>;
  registrarFalha: (erro: unknown) => number | void;
}

export class AgendadorGdlService {
  private temporizador?: ReturnType<typeof setTimeout>;
  private controlador = new AbortController();
  private ativo = false;
  private executando = false;
  private revisaoPendente = false;
  private tentarApos = new Map<string, number>();
  private naoAntesDe = 0;

  constructor(private dependencias: DependenciasAgendadorGdl, private atividade: AtividadeGdlService = atividadeGdlService) {}

  iniciar(): void {
    this.ativo = true;
    this.contextoAlterado();
  }

  encerrar(): void {
    this.ativo = false;
    this.controlador.abort();
    clearTimeout(this.temporizador);
  }

  contextoAlterado(): void {
    this.controlador.abort();
    this.controlador = new AbortController();
    this.tentarApos.clear();
    this.naoAntesDe = Date.now() + OCIOSIDADE_GDL_MS;
    this.listaAlterada();
  }

  listaAlterada(usuarioId?: string, identidade?: string): void {
    if (usuarioId !== undefined && identidade !== undefined) this.tentarApos.delete(JSON.stringify([usuarioId, identidade]));
    if (!this.ativo) return;
    if (this.executando) { this.revisaoPendente = true; return; }
    this.agendar(this.naoAntesDe - Date.now());
  }

  private agendar(atraso: number): void {
    clearTimeout(this.temporizador);
    if (this.ativo) this.temporizador = setTimeout(() => { void this.verificar(); }, Math.min(2_147_483_647, Math.max(0, atraso)));
  }

  private async verificar(): Promise<void> {
    if (!this.ativo || this.executando) return;
    this.executando = true;
    const sinal = this.controlador.signal;
    let proxima = Number.POSITIVE_INFINITY;
    try {
      const usuarios = new Set(this.dependencias.obterUsuarios());
      if (!usuarios.size || !await this.dependencias.habilitada()) return;
      const identidade = await this.dependencias.identidade();
      for (const usuarioId of usuarios) {
        const validar = async () => {
          sinal.throwIfAborted();
          if (!this.dependencias.obterUsuarios().includes(usuarioId) || !await this.dependencias.habilitada()
            || identidade !== await this.dependencias.identidade()) throw new Error('A sessão ou configuração GDL mudou.');
          sinal.throwIfAborted();
        };
        await validar();
        const chave = JSON.stringify([usuarioId, identidade]);
        const cache = await this.dependencias.obterCache(usuarioId);
        const instante = cache ? Date.parse(cache.atualizadoEm) : 0;
        const vencimento = Math.max(Number.isFinite(instante) ? instante + VALIDADE_CACHE_LISTAGEM_MS : 0, this.tentarApos.get(chave) ?? 0);
        if ((cache && vencimento > Date.now()) || (this.tentarApos.get(chave) ?? 0) > Date.now()) {
          proxima = Math.min(proxima, vencimento);
          continue;
        }
        try {
          const resultado = await this.atividade.automatizar(sinal, validar, async () => {
            await this.atividade.antesDaRequisicao();
            return this.dependencias.atualizar(usuarioId, validar);
          });
          this.tentarApos.delete(chave);
          proxima = Math.min(proxima, Date.parse(resultado.atualizadoEm) + VALIDADE_CACHE_LISTAGEM_MS);
        } catch (erro: unknown) {
          if (sinal.aborted) return;
          const atraso = Math.max(VALIDADE_CACHE_LISTAGEM_MS, this.dependencias.registrarFalha(erro) ?? 0);
          const tentativa = Date.now() + atraso;
          this.tentarApos.set(chave, tentativa);
          proxima = Math.min(proxima, tentativa);
        }
      }
    } catch (erro: unknown) {
      if (!sinal.aborted) {
        const atraso = Math.max(VALIDADE_CACHE_LISTAGEM_MS, this.dependencias.registrarFalha(erro) ?? 0);
        proxima = Date.now() + atraso;
      }
    } finally {
      this.executando = false;
      const atraso = Math.max(this.naoAntesDe - Date.now(), this.revisaoPendente ? 0 : Math.max(1, proxima - Date.now()));
      this.revisaoPendente = false;
      if (Number.isFinite(atraso)) this.agendar(atraso);
    }
  }
}
