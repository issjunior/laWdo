import { AgendadorGdlService } from './gdl-agendador.service.js';
import { authSessaoService } from './auth-sessao.service.js';
import { obterListagemRepsGdlHabilitada } from './gdl-listagem-preferencia.service.js';
import { obterIdentidadeMinhasReps } from './gdl.service.js';
import { atualizarMinhasRepsEmCache, obterMinhasRepsEmCache } from './gdl-minhas-reps-cache.service.js';
import { observarContextoGdl, observarListaGdl } from './gdl-agendamento-eventos.service.js';
import { classificarFalhaListaRepsGdl } from './gdl-minhas-reps-erro.service.js';
import { logError } from '../utils/logger.js';

function obterBloqueioTemporario(erro: unknown): number {
  const visitados = new Set<unknown>();
  let atual = erro;
  let atraso = 0;
  while (atual && typeof atual === 'object' && !visitados.has(atual)) {
    visitados.add(atual);
    if ('tentarNovamenteEmSegundos' in atual) {
      const segundos = atual.tentarNovamenteEmSegundos;
      if (typeof segundos === 'number' && Number.isSafeInteger(segundos) && segundos > 0) atraso = Math.max(atraso, segundos * 1000);
    }
    atual = 'cause' in atual ? atual.cause : undefined;
  }
  return atraso;
}

const agendador = new AgendadorGdlService({
  obterUsuarios: () => authSessaoService.obterUsuarios(),
  habilitada: obterListagemRepsGdlHabilitada,
  identidade: obterIdentidadeMinhasReps,
  obterCache: obterMinhasRepsEmCache,
  atualizar: (usuarioId, validar) => atualizarMinhasRepsEmCache(usuarioId, false, validar),
  registrarFalha: erro => {
    const falha = classificarFalhaListaRepsGdl(erro);
    logError('Falha na atualização automática de REPs do GDL', { codigo: falha.codigo, etapa: falha.etapa, detalhes: falha.detalhes });
    return obterBloqueioTemporario(erro);
  },
});

let removerObservadores: (() => void)[] = [];

export function iniciarAtualizacaoAutomaticaGdl(): void {
  encerrarAtualizacaoAutomaticaGdl();
  removerObservadores = [
    observarContextoGdl(() => agendador.contextoAlterado()),
    observarListaGdl((usuarioId, identidade) => agendador.listaAlterada(usuarioId, identidade)),
  ];
  agendador.iniciar();
}

export function encerrarAtualizacaoAutomaticaGdl(): void {
  for (const remover of removerObservadores) remover();
  removerObservadores = [];
  agendador.encerrar();
}
