export type CategoriaDiferencaRepGdl = 'campo' | 'peca'

export interface DetalheDiferencaAtualizacaoRepGdl {
  campo: string
  valorLocal: string
  valorGdl: string
}

export interface DiferencaAtualizacaoRepGdl {
  id: string
  categoria: CategoriaDiferencaRepGdl
  grupo: string
  rotulo: string
  valorLocal: string
  valorGdl: string
  resumo?: string
  detalhes?: DetalheDiferencaAtualizacaoRepGdl[]
  selecionadaPorPadrao: boolean
}

export interface ImpactoLaudoAtualizacaoRepGdl {
  laudoId: string
  status: string
  requerReabertura: boolean
}

export interface PreviaAtualizacaoRepGdl {
  operacaoId: string
  repId: string
  repNumero: string
  codigoExame: string
  diferencas: DiferencaAtualizacaoRepGdl[]
  impactoLaudo?: ImpactoLaudoAtualizacaoRepGdl
  avisos: string[]
}

export interface AplicarAtualizacaoRepGdlEntrada {
  operacaoId: string
  diferencasSelecionadas: string[]
  reabrirLaudo: boolean
}

export interface ResultadoAtualizacaoRepGdl {
  camposAtualizados: number
  pecasAtualizadas: number
  laudoReconciliado: boolean
  laudoReaberto: boolean
}
