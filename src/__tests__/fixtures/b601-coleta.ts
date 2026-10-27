import type { PecaBalistica } from '../../shared/types/pecas-balistica.types';

export function criarPecaColeta(id: string, origem: string, quantidade = 1, tipoCodigo = '105'): PecaBalistica {
  return { idLocal: id, origem: 'gdl', alteradaLocalmente: false, tipoCodigo, tipoPeca: tipoCodigo === '105' ? 'PROJÉTEIS' : 'ESTOJO(S)',
    comuns: { identificacao: id, quantidade, unidadeMedida: 'UNIDADES', quantidadeDescricao: '', examinadoInLoco: false,
      dataEntrada: '', lacreEntrada: 'L1', lacreSaida: '', dataLiberacao: '', codigoVestigio: '', consumida: 'N', observacao: '' },
    personalizados: { [`${tipoCodigo}:origem_coleta`]: origem }, extrasGdl: {} };
}
