import type { FalhaPdf } from '@shared/types/pdf.types';

export function validarFalhaPdf(valor: unknown): valor is FalhaPdf {
  if (!valor || typeof valor !== 'object') return false;
  const falha = valor as Record<string, unknown>;
  return ['IMAGEM_INDISPONIVEL', 'FONTE_INDISPONIVEL', 'CABECALHO_INDISPONIVEL', 'TEMPO_EXCEDIDO', 'FALHA_PDF'].includes(String(falha.codigo))
    && ['carregamento', 'recursos', 'impressao'].includes(String(falha.etapa))
    && typeof falha.tentarNovamente === 'boolean'
    && (falha.posicaoImagem === undefined || (Number.isInteger(falha.posicaoImagem) && Number(falha.posicaoImagem) > 0))
    && (falha.origem === undefined || falha.origem === 'corpo' || falha.origem === 'cabecalho');
}

export function mensagemFalhaPdf(falha: FalhaPdf): string {
  switch (falha.codigo) {
    case 'IMAGEM_INDISPONIVEL': {
      const local = falha.origem === 'cabecalho' ? 'do cabeçalho' : 'do laudo';
      const posicao = falha.posicaoImagem ? ` na posição ${falha.posicaoImagem}` : '';
      return `Uma imagem ${local}${posicao} não pôde ser carregada. Revise ou substitua a imagem e tente novamente.`;
    }
    case 'FONTE_INDISPONIVEL':
      return 'Uma fonte do documento ou do cabeçalho não pôde ser carregada. Revise a fonte no template e tente novamente.';
    case 'CABECALHO_INDISPONIVEL':
      return 'Não foi possível ler a configuração do cabeçalho. Tente novamente; se persistir, revise o cabeçalho nas configurações.';
    case 'TEMPO_EXCEDIDO':
      return `A preparação do PDF excedeu o tempo na etapa de ${falha.etapa}. Tente novamente; se persistir, salve o laudo e reinicie o aplicativo.`;
    case 'FALHA_PDF':
      return 'Não foi possível gerar o PDF. Tente novamente; se persistir, salve o laudo, reinicie o aplicativo e envie o código FALHA_PDF ao suporte.';
  }
}
