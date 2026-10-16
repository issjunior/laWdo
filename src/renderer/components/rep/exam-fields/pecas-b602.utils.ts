import type { PecaB602 } from '@shared/types/b602-gdl.types'
import { montarItensReconciliacaoPecasBalistica, obterPecasImportadasAusentesDoGdl as obterAusentes, mesclarPecasBalisticaDoGdl } from './pecas-balistica-gdl.utils'

export interface ItemReconciliacaoPecaB602 { chave: string; peca: PecaB602; jaImportada: boolean; retornadaPeloGdl: boolean }
export const montarItensReconciliacaoPecasB602 = montarItensReconciliacaoPecasBalistica<PecaB602>
export const obterPecasImportadasAusentesDoGdl = obterAusentes<PecaB602>
export const mesclarPecasB602DoGdl = mesclarPecasBalisticaDoGdl<PecaB602>
