import type { ComparacaoMedida, ConsultaProjetil, MedidaProjetil, ProjetilReferencia, ResultadoProjetil } from '../types/projetil.types.js';
import { LIMITE_PROXIMIDADE_PERCENTUAL, medidaProximaDaReferencia } from './proximidade-medida.js';

function numeroPositivo(valor: number | null): valor is number {
  return valor !== null && Number.isFinite(valor) && valor > 0;
}

function comparar(observado: number | null, minimo: number | null, maximo: number | null, participa = true): ComparacaoMedida {
  const valor = numeroPositivo(observado) ? observado : null;
  const faixaValida = numeroPositivo(minimo) && numeroPositivo(maximo) && minimo <= maximo;
  const diferenca = valor === null || !faixaValida ? null
    : valor < minimo ? valor - minimo : valor > maximo ? valor - maximo : 0;
  return { observado: valor, referenciaMin: minimo, referenciaMax: maximo, diferenca, utilizada: participa && diferenca !== null };
}

export function consultarProjeteis(referencias: ProjetilReferencia[], consulta: ConsultaProjetil): ResultadoProjetil[] {
  const limite = consulta.limiteProximidadePercentual;
  const limiteProximidade = typeof limite === 'number' && Number.isFinite(limite) && limite >= 0 && limite <= 100 ? limite : LIMITE_PROXIMIDADE_PERCENTUAL;
  return referencias.filter(item => !item.motivoExclusaoClassificacao && (!consulta.sigla || item.sigla === consulta.sigla)).map(projetil => {
    const calibreReal = comparar(consulta.calibreRealMm, projetil.calibreRealMinMm, projetil.calibreRealMaxMm);
    const altura = comparar(consulta.alturaMaximaMm, projetil.alturaMinMm, projetil.alturaMaxMm);
    const massa = comparar(consulta.massaGramas, projetil.massaGramas, projetil.massaGramas, !consulta.perdaMaterial);
    const comparacoes: Record<MedidaProjetil, ComparacaoMedida> = { calibreRealMm: calibreReal, alturaMaximaMm: altura, massaGramas: massa };
    const medidasComparadas: MedidaProjetil[] = [];
    const medidasProximas: MedidaProjetil[] = [];
    const medidasAusentes: MedidaProjetil[] = [];
    let somaErros = 0;
    let somaPesos = 0;
    for (const chave of Object.keys(comparacoes) as MedidaProjetil[]) {
      const medida = comparacoes[chave];
      if (medida.observado === null) continue;
      if (medida.diferenca === null) medidasAusentes.push(chave);
      if (!medida.utilizada || medida.diferenca === null) continue;
      const peso = chave === consulta.medidaPrioritaria ? 60 : 20;
      somaErros += peso * Math.abs(medida.diferenca) / medida.observado;
      somaPesos += peso;
      medidasComparadas.push(chave);
      if (medidaProximaDaReferencia(medida, limiteProximidade)) medidasProximas.push(chave);
    }
    const prioridade = comparacoes[consulta.medidaPrioritaria];
    const prioridadeAusente = prioridade.observado !== null && prioridade.diferenca === null
      && !(consulta.perdaMaterial && consulta.medidaPrioritaria === 'massaGramas');
    const grupoMassa = !consulta.perdaMaterial || massa.observado === null ? 0
      : !numeroPositivo(projetil.massaGramas) ? 1 : projetil.massaGramas >= massa.observado ? 0 : 2;
    return { projetil, calibreReal, altura, massa, medidasAusentes, medidasComparadas, medidasProximas,
      pontuacao: somaPesos ? somaErros / somaPesos : null, prioridadeAusente, grupoMassa };
  }).sort((a, b) => {
    if (a.grupoMassa !== b.grupoMassa) return a.grupoMassa - b.grupoMassa;
    if (a.medidasProximas.length !== b.medidasProximas.length) return b.medidasProximas.length - a.medidasProximas.length;
    if (a.prioridadeAusente !== b.prioridadeAusente) return Number(a.prioridadeAusente) - Number(b.prioridadeAusente);
    if (a.pontuacao === null && b.pontuacao !== null) return 1;
    if (a.pontuacao !== null && b.pontuacao === null) return -1;
    if (a.pontuacao !== null && b.pontuacao !== null && a.pontuacao !== b.pontuacao) return a.pontuacao - b.pontuacao;
    if (a.medidasComparadas.length !== b.medidasComparadas.length) return b.medidasComparadas.length - a.medidasComparadas.length;
    return a.projetil.calibre.localeCompare(b.projetil.calibre, 'pt-BR')
      || a.projetil.tipo.localeCompare(b.projetil.tipo, 'pt-BR')
      || a.projetil.id.localeCompare(b.projetil.id, 'pt-BR');
  });
}
