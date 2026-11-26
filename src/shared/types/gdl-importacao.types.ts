import type { DadosImportacaoB602, DadosSolicitacaoGdl, DadosInvestigacaoGdl, ResultadoImportacaoExame } from './b602-gdl.types.js'
import type { PecaBalistica } from './pecas-balistica.types.js'
import type { PecaI801 } from './i801.types.js'

export interface DadosImportacaoBalistica<T extends PecaBalistica> {
  pecas: T[]
  dadosSolicitacao: DadosSolicitacaoGdl
  dadosInvestigacao: DadosInvestigacaoGdl
}
export type DadosImportacaoB601 = DadosImportacaoBalistica<PecaBalistica>
export type ResultadoImportacaoB601 = ResultadoImportacaoExame<DadosImportacaoB601> & { codigoExame: 'B-601' }
export type ResultadoImportacaoB602 = ResultadoImportacaoExame<DadosImportacaoB602> & { codigoExame: 'B-602' }
export type DadosImportacaoI801 = DadosImportacaoBalistica<PecaI801>
export type ResultadoImportacaoI801 = ResultadoImportacaoExame<DadosImportacaoI801> & { codigoExame: 'I-801' }
export type ResultadoImportacaoGdl = ResultadoImportacaoB601 | ResultadoImportacaoB602 | ResultadoImportacaoI801
