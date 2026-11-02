import type { PecaB602 } from '@shared/types/b602-gdl.types'
import { montarItensReconciliacaoPecasBalistica, obterPecasImportadasAusentesDoGdl as obterAusentes, mesclarPecasBalisticaDoGdl } from './pecas-balistica-gdl.utils'

export const montarItensReconciliacaoPecasB602 = montarItensReconciliacaoPecasBalistica<PecaB602>
export const obterPecasImportadasAusentesDoGdl = obterAusentes<PecaB602>
export const mesclarPecasB602DoGdl = mesclarPecasBalisticaDoGdl<PecaB602>
