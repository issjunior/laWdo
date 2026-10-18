import type { DadosImportacaoB602, DadosSolicitacaoGdl, DadosInvestigacaoGdl, ResultadoImportacaoExame } from './b602-gdl.types.js'
import type { PecaBalistica } from './pecas-balistica.types.js'

export interface DadosImportacaoBalistica<T extends PecaBalistica> {
  pecas: T[]
  dadosSolicitacao: DadosSolicitacaoGdl
  dadosInvestigacao: DadosInvestigacaoGdl
}
export type DadosImportacaoB601 = DadosImportacaoBalistica<PecaBalistica>
export type ResultadoImportacaoB601 = ResultadoImportacaoExame<DadosImportacaoB601> & { codigoExame: 'B-601' }
export type ResultadoImportacaoB602 = ResultadoImportacaoExame<DadosImportacaoB602> & { codigoExame: 'B-602' }
export type ResultadoImportacaoGdl = ResultadoImportacaoB601 | ResultadoImportacaoB602
