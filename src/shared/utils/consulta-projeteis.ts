import type { ConsultaProjetil, ProjetilReferencia, ResultadoProjetil } from '../types/projetil.types.js';

type EstadoDimensao = 'coincide' | 'ausente' | 'nao_informado' | 'diverge';

interface ComparacaoDimensao {
  estado: EstadoDimensao;
  distanciaCentro: number;
}

function compararDimensao(
  consultaMin: number | null,
  consultaMax: number | null,
  referenciaMin: number | null,
  referenciaMax: number | null,
): ComparacaoDimensao {
  if (consultaMin === null && consultaMax === null) return { estado: 'nao_informado', distanciaCentro: 0 };
  if (referenciaMin === null || referenciaMax === null) return { estado: 'ausente', distanciaCentro: 0 };
  const minimo = consultaMin ?? consultaMax;
  const maximo = consultaMax ?? consultaMin;
  if (minimo === null || maximo === null || referenciaMax < minimo || referenciaMin > maximo) {
    return { estado: 'diverge', distanciaCentro: 0 };
  }
  return {
    estado: 'coincide',
    distanciaCentro: Math.abs((minimo + maximo) / 2 - (referenciaMin + referenciaMax) / 2),
  };
}

function prioridadeSituacao(projetil: ProjetilReferencia): number {
  return projetil.situacao === 'confirmada' ? 0 : 1;
}

export function consultarProjeteis(
  referencias: ProjetilReferencia[],
  consulta: ConsultaProjetil,
): ResultadoProjetil[] {
  const possuiDimensao = consulta.diametroMinMm !== null || consulta.diametroMaxMm !== null
    || consulta.comprimentoMinMm !== null || consulta.comprimentoMaxMm !== null;

  return referencias.flatMap((projetil) => {
    const diametro = compararDimensao(
      consulta.diametroMinMm, consulta.diametroMaxMm,
      projetil.diametroMinMm, projetil.diametroMaxMm,
    );
    const comprimento = compararDimensao(
      consulta.comprimentoMinMm, consulta.comprimentoMaxMm,
      projetil.comprimentoMinMm, projetil.comprimentoMaxMm,
    );
    if (diametro.estado === 'diverge' || comprimento.estado === 'diverge') return [];

    const compatibilidade: ResultadoProjetil['compatibilidade'] = possuiDimensao
      && diametro.estado !== 'ausente' && comprimento.estado !== 'ausente'
      ? 'compativel' : 'parcial';
    return [{
      projetil,
      compatibilidade,
      diametro: diametro.estado,
      comprimento: comprimento.estado,
      diferencaMassaGramas: consulta.massaGramas === null
        ? null : Math.abs(projetil.massaGramas - consulta.massaGramas),
      distanciaDiametro: diametro.distanciaCentro,
      distanciaComprimento: comprimento.distanciaCentro,
    }];
  }).sort((a, b) => {
    if (a.compatibilidade !== b.compatibilidade) return a.compatibilidade === 'compativel' ? -1 : 1;
    if (a.diametro !== b.diametro && (a.diametro === 'ausente' || b.diametro === 'ausente')) {
      return a.diametro === 'ausente' ? 1 : -1;
    }
    const distanciaDiametro = a.distanciaDiametro - b.distanciaDiametro;
    if (distanciaDiametro !== 0) return distanciaDiametro;
    if (a.comprimento !== b.comprimento && (a.comprimento === 'ausente' || b.comprimento === 'ausente')) {
      return a.comprimento === 'ausente' ? 1 : -1;
    }
    const distanciaComprimento = a.distanciaComprimento - b.distanciaComprimento;
    if (distanciaComprimento !== 0) return distanciaComprimento;
    const massa = (a.diferencaMassaGramas ?? 0) - (b.diferencaMassaGramas ?? 0);
    if (massa !== 0) return massa;
    const situacao = prioridadeSituacao(a.projetil) - prioridadeSituacao(b.projetil);
    if (situacao !== 0) return situacao;
    return a.projetil.calibre.localeCompare(b.projetil.calibre, 'pt-BR')
      || a.projetil.tipo.localeCompare(b.projetil.tipo, 'pt-BR')
      || a.projetil.id.localeCompare(b.projetil.id, 'pt-BR');
  }).map(({ distanciaDiametro: _diametro, distanciaComprimento: _comprimento, ...resultado }) => resultado);
}
