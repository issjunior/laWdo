export type AmbienteGdl = 'homologacao' | 'producao'

export const CHAVE_HOMOLOGACAO_GDL_HABILITADA = 'gdl_homologacao_habilitada'

export function resolverAmbienteGdl(ambiente: unknown, homologacaoHabilitada: unknown): AmbienteGdl {
  return homologacaoHabilitada === 'true' && ambiente === 'homologacao' ? 'homologacao' : 'producao'
}
