export type EtapaFalhaPdf = 'carregamento' | 'recursos' | 'impressao';
export type CodigoFalhaPdf = 'IMAGEM_INDISPONIVEL' | 'FONTE_INDISPONIVEL' | 'CABECALHO_INDISPONIVEL' | 'TEMPO_EXCEDIDO' | 'FALHA_PDF';

export interface FalhaPdf {
  codigo: CodigoFalhaPdf;
  etapa: EtapaFalhaPdf;
  tentarNovamente: boolean;
  posicaoImagem?: number;
  origem?: 'corpo' | 'cabecalho';
}
