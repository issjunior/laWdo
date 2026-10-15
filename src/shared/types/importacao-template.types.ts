export type FormatoImportacaoTemplate = 'pdf' | 'docx' | 'odt';

export interface AvisoImportacaoTemplate {
  id: string;
  codigo: string;
  categoria: 'adaptacao' | 'limitacao';
  mensagem: string;
  secaoId?: string;
  elementoId?: string;
  pagina?: number;
}

export interface SecaoImportadaTemplate {
  id: string;
  nome: string;
  conteudo: string;
  incluir: boolean;
}

export interface ResultadoImportacaoTemplate {
  nomeArquivo: string;
  formato: FormatoImportacaoTemplate;
  secoes: SecaoImportadaTemplate[];
  avisos: AvisoImportacaoTemplate[];
  resumo: { tabelas: number; figuras: number };
}

export type RespostaImportacaoTemplate =
  | { success: true; data: ResultadoImportacaoTemplate; cancelado?: false; error?: never }
  | { success: false; data?: never; cancelado: true; error?: never }
  | { success: false; data?: never; cancelado?: false; error: string };

const objeto = (valor: unknown): valor is Record<string, unknown> =>
  valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const texto = (valor: unknown): valor is string => typeof valor === 'string';
const id = (valor: unknown): valor is string => texto(valor) && Boolean(valor.trim());
const opcional = (valor: unknown): boolean => valor === undefined || id(valor);

export function ehResultadoImportacaoTemplate(valor: unknown): valor is ResultadoImportacaoTemplate {
  if (!objeto(valor) || !texto(valor.nomeArquivo) || (valor.formato !== 'pdf' && valor.formato !== 'docx' && valor.formato !== 'odt')
    || !Array.isArray(valor.secoes) || !Array.isArray(valor.avisos)
    || !objeto(valor.resumo) || !Number.isSafeInteger(valor.resumo.tabelas) || !Number.isSafeInteger(valor.resumo.figuras)
    || Number(valor.resumo.tabelas) < 0 || Number(valor.resumo.figuras) < 0) return false;
  const ids = new Set<string>();
  const unico = (valorId: unknown): boolean => {
    if (!id(valorId) || ids.has(valorId)) return false;
    ids.add(valorId);
    return true;
  };
  return valor.secoes.every((secao: unknown) => objeto(secao) && unico(secao.id) && texto(secao.nome)
    && texto(secao.conteudo) && typeof secao.incluir === 'boolean')
    && valor.avisos.every((aviso: unknown) => objeto(aviso) && unico(aviso.id) && id(aviso.codigo) && texto(aviso.mensagem)
      && (aviso.categoria === 'adaptacao' || aviso.categoria === 'limitacao') && opcional(aviso.secaoId) && opcional(aviso.elementoId)
      && (aviso.pagina === undefined || (Number.isSafeInteger(aviso.pagina) && Number(aviso.pagina) > 0)));
}
