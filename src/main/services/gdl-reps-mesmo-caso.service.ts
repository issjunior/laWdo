import { esquemaRepsMesmoCasoGdl } from '../../shared/gdl/reps-mesmo-caso.js';
import type { RepsMesmoCasoGdl } from '../../shared/gdl/reps-mesmo-caso.js';
import type { GdlListaRepsInvestigacaoValidada, GdlRepValidada } from './gdl.schema.js';

type FiltroCaso = { numeroCaso: number } | { numeroOrigem: string; anoOrigem?: number };
type CarregarPaginaCaso = (filtro: FiltroCaso, pagina: number) => Promise<GdlListaRepsInvestigacaoValidada>;

async function lerPaginasCaso(filtro: FiltroCaso, carregar: CarregarPaginaCaso) {
  const registros: GdlListaRepsInvestigacaoValidada['dadosREPs'] = [];
  const assinaturas = new Set<string>();
  let totalEsperado: number | undefined;
  for (let pagina = 1; pagina <= 100; pagina++) {
    const resposta = await carregar(filtro, pagina);
    if (resposta.quantRegistros !== undefined) {
      if (totalEsperado !== undefined && totalEsperado !== resposta.quantRegistros) throw new Error('A lista de REPs do caso mudou durante a consulta. Tente novamente.');
      totalEsperado = resposta.quantRegistros;
    }
    const assinatura = JSON.stringify(resposta.dadosREPs);
    if (assinaturas.has(assinatura)) throw new Error('A lista de REPs do caso está inconsistente. Tente novamente.');
    assinaturas.add(assinatura);
    registros.push(...resposta.dadosREPs);
    if (resposta.quantRegistros !== undefined) {
      if (registros.length > resposta.quantRegistros) throw new Error('A quantidade retornada de REPs do caso é inconsistente.');
      if (registros.length === resposta.quantRegistros) return registros;
      if (!resposta.dadosREPs.length) throw new Error('O GDL retornou uma lista incompleta de REPs do caso.');
    } else if (resposta.dadosREPs.length < 10) return registros;
  }
  throw new Error('A consulta das REPs do caso excedeu o limite de páginas.');
}

export async function consultarReferenciasMesmoCasoGdl(
  rep: GdlRepValidada,
  ambiente: RepsMesmoCasoGdl['ambiente'],
  filtros: readonly FiltroCaso[],
  carregar: CarregarPaginaCaso,
): Promise<RepsMesmoCasoGdl> {
  const casos = new Set<string>();
  for (const filtro of filtros) {
    for (const registro of await lerPaginasCaso(filtro, carregar)) {
      if (registro.numeroRep.replace(/\D/g, '') === `${rep.numero}${rep.ano}`
        && /^[1-9]\d*$/.test(registro.numeroCaso)) casos.add(registro.numeroCaso);
    }
  }
  if (casos.size !== 1) throw new Error('Não foi possível confirmar um único caso para esta REP. Preencha o exame de coleta manualmente.');
  const numeroCaso = [...casos][0];
  const numeroCasoConsulta = Number(numeroCaso);
  if (!Number.isSafeInteger(numeroCasoConsulta)) throw new Error('O número do caso retornado pelo GDL é inválido.');
  const referencias = new Map<string, RepsMesmoCasoGdl['reps'][number]>();
  for (const registro of await lerPaginasCaso({ numeroCaso: numeroCasoConsulta }, carregar)) {
    if (registro.numeroCaso !== numeroCaso) continue;
    const codigo = registro.naturezaExame.trim().toUpperCase().match(/^([A-Z])\s*-?\s*(\d{3})\b/);
    const codigoNatureza = codigo ? `${codigo[1]}${codigo[2]}` : '';
    if (codigoNatureza !== 'M110' && codigoNatureza !== 'T002') continue;
    const identificacao = registro.numeroRep.trim().match(/^([\d.]+)\s*\/\s*(\d{4})$/);
    if (!identificacao) throw new Error('O GDL retornou um número inválido de exame de coleta.');
    const numero = identificacao[1].replace(/\D/g, '');
    const ano = identificacao[2];
    const chave = `${numero}/${ano}`;
    const anterior = referencias.get(chave);
    if (anterior && anterior.codigoNatureza !== codigoNatureza) throw new Error('O GDL retornou naturezas divergentes para o mesmo exame de coleta.');
    referencias.set(chave, { numero, ano, codigoNatureza });
  }
  return esquemaRepsMesmoCasoGdl.parse({ ambiente, numeroRep: String(rep.numero), anoRep: String(rep.ano),
    numeroCaso, consultadoEm: new Date().toISOString(), reps: [...referencias.values()] });
}
