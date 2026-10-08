export const CHAVE_LISTAGEM_REPS_GDL_HABILITADA = 'gdl_listagem_reps_habilitada';
export const VALIDADE_CACHE_LISTAGEM_DESATIVADA_MS = 30 * 60 * 1000;

export function cacheListagemDesativadaDisponivel(atualizadoEm: string, agora = Date.now()): boolean {
  const instante = Date.parse(atualizadoEm);
  return Number.isFinite(instante) && instante <= agora
    && agora - instante < VALIDADE_CACHE_LISTAGEM_DESATIVADA_MS;
}
