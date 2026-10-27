import type { CamposComunsPecaBalistica, PecaBalistica } from './pecas-balistica.types.js';
import type { IdentificacaoNaturezaExameGdl } from '../gdl/natureza-exame.js';
import type { RepsMesmoCasoGdl } from '../gdl/reps-mesmo-caso.js';
export type OrigemPecaB602 = 'manual' | 'gdl'

export interface CamposComunsPecaB602 extends CamposComunsPecaBalistica {
  materialIncinerado: 'S' | 'N'
}

export interface PecaB602 extends PecaBalistica {
  origem: OrigemPecaB602
  comuns: CamposComunsPecaB602
}

export interface AvisoImportacao {
  codigo: string
  mensagem: string
  contexto?: Record<string, unknown>
}

export interface MetadadosIntegracaoGdl {
  repsMesmoCaso?: RepsMesmoCasoGdl
  origemInicial: 'manual' | 'gdl'
  identificacaoNatureza?: IdentificacaoNaturezaExameGdl
  dataExecucaoLaudo?: string
  origemSolicitacaoSelecionada?: ReferenciaOrigemGdl
  dadosSolicitacao?: DadosSolicitacaoGdl
  dadosInvestigacao?: DadosInvestigacaoGdl
  ultimaConsulta?: {
    ambiente: 'homologacao' | 'producao'
    numeroRep: string
    anoRep: string
    consultadoEm: string
  }
}

export interface DadosSolicitacaoGdl {
  orgao: string
  cidade?: string
  responsavel: string
  autoridade: string
  origensDisponiveis: ReferenciaOrigemGdl[]
}

export interface ReferenciaOrigemGdl {
  tipo: string
  numero: string
  dataDocumento?: string
  iniciais?: string
}

export interface DadosInvestigacaoGdl {
  envolvidos: string[]
  boletinsOcorrencia: ReferenciaOrigemGdl[]
  inqueritosPoliciais: ReferenciaOrigemGdl[]
}

export interface ResultadoImportacaoExame<TDados> {
  camposVaziosConfirmados?: Array<'observacoes' | 'data_requisicao'>
  limpezasSelecionadas?: Array<'observacoes' | 'data_requisicao'>
  codigoExame: string
  identificacaoNatureza?: IdentificacaoNaturezaExameGdl
  naturezaExameGdl?: string
  camposGerais: Record<string, string>
  camposEspecificos: TDados
  avisos: AvisoImportacao[]
  metadadosIntegracaoGdl?: MetadadosIntegracaoGdl
}

export interface DadosImportacaoB602 {
  pecas: PecaB602[]
  dadosSolicitacao: DadosSolicitacaoGdl
  dadosInvestigacao: DadosInvestigacaoGdl
}
