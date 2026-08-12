import type { FragmentoIa } from '@shared/types/ia.types';

const PADRAO_DADO_PROTEGIDO = /\{\{\s*[^{}]+\s*\}\}|https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|\b\d{5,7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b|\b(?:REP|RDO|LAUDO)\s*[-:]?\s*\d+[-/]\d{2,4}\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b\d+(?:[.,]\d+)?\b/gi;
const PADRAO_TOKEN_PROTEGIDO = /\[\[DADO_PROTEGIDO_\d{4}\]\]/g;

export interface ProtecaoFragmentosIa {
  fragmentos: FragmentoIa[];
  tokensPorFragmento: Record<string, string[]>;
  valoresPorToken: Record<string, string>;
}

export function protegerFragmentosIa(fragmentos: FragmentoIa[]): ProtecaoFragmentosIa {
  let sequencia = 0;
  const tokensPorFragmento: Record<string, string[]> = {};
  const valoresPorToken: Record<string, string> = {};
  const protegidos = fragmentos.map(fragmento => {
    const tokens: string[] = [];
    const texto = fragmento.texto.replace(PADRAO_DADO_PROTEGIDO, valor => {
      sequencia += 1;
      const token = `[[DADO_PROTEGIDO_${String(sequencia).padStart(4, '0')}]]`;
      tokens.push(token);
      valoresPorToken[token] = valor;
      return token;
    });
    tokensPorFragmento[fragmento.id] = tokens;
    return { ...fragmento, texto };
  });

  return { fragmentos: protegidos, tokensPorFragmento, valoresPorToken };
}

export function restaurarFragmentosIa(
  fragmentos: FragmentoIa[],
  protecao: ProtecaoFragmentosIa,
): FragmentoIa[] | null {
  if (fragmentos.length !== protecao.fragmentos.length) return null;

  const resultado: FragmentoIa[] = [];
  for (const [indice, fragmento] of fragmentos.entries()) {
    const esperado = protecao.fragmentos[indice];
    if (fragmento.id !== esperado.id) return null;
    const tokensEsperados = protecao.tokensPorFragmento[fragmento.id] || [];
    const tokensEncontrados = fragmento.texto.match(PADRAO_TOKEN_PROTEGIDO) || [];
    if (tokensEncontrados.length !== tokensEsperados.length) return null;
    if (tokensEsperados.some(token => tokensEncontrados.filter(encontrado => encontrado === token).length !== 1)) return null;
    if (tokensEncontrados.some(token => !tokensEsperados.includes(token))) return null;

    let texto = fragmento.texto;
    for (const token of tokensEsperados) {
      texto = texto.replace(token, protecao.valoresPorToken[token]);
    }
    resultado.push({ id: fragmento.id, texto });
  }
  return resultado;
}
