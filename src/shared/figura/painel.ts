import { ajusteVisualParFigurasValido, alturaParFigurasValida, type AjusteVisualParFiguras } from './enquadramento.js';
import type { ResultadoAtualizacaoFiguras, ResultadoInsercaoFiguras, ResultadoOperacaoPainelFiguras } from '../types/imagem-laudo.types.js';

export interface ImagemLaudoPainel {
  id: string;
  ocorrenciaId?: string;
  url: string;
  thumbnailUrl: string;
  legenda: string;
  legendaSubstituicao?: string;
  numero_figura: number;
  sequencia: number;
  created_at: string;
  dummy?: boolean;
  origem?: 'gdl';
  sha256?: string;
  nomeArquivo?: string;
  imagemOrigemId?: string;
  alturaParPercentual?: number;
  ajusteVisualPar?: AjusteVisualParFiguras;
}

export interface EstadoPainelFiguras {
  sessaoId?: number;
  figurasNoEditor: ImagemLaudoPainel[];
  figurasDevolvidas?: ImagemLaudoPainel[];
  imagensProtegidas?: string[];
  syncEnabled: boolean;
  figuraAtivaId: string | null;
  figuraAtivaOcorrenciaId?: string | null;
  tema?: string;
  resultadoAtualizacao?: ResultadoAtualizacaoFiguras;
  resultadoOperacao?: ResultadoOperacaoPainelFiguras;
}

const registro = (valor: unknown): valor is Record<string, unknown> => typeof valor === 'object' && valor !== null;
const texto = (valor: unknown): valor is string => typeof valor === 'string';
const opcionalTexto = (valor: unknown): boolean => valor === undefined || texto(valor);
const indice = (valor: unknown): boolean => typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0;

export function ehResultadoAtualizacaoFiguras(valor: unknown): valor is ResultadoAtualizacaoFiguras {
  return registro(valor) && indice(valor.restauradas) && indice(valor.semDescricao)
    && indice(valor.falhasConsulta) && opcionalTexto(valor.erro);
}

export function ehResultadoInsercaoFiguras(valor: unknown, idsSolicitados?: readonly string[]): valor is ResultadoInsercaoFiguras {
  if (!registro(valor) || !Array.isArray(valor.inseridas) || !valor.inseridas.every(texto)
    || !Array.isArray(valor.falhas) || !valor.falhas.every(falha => registro(falha) && texto(falha.imagemId) && texto(falha.mensagem))) return false;
  const ids = [...valor.inseridas, ...valor.falhas.map(falha => falha.imagemId)];
  return new Set(ids).size === ids.length && (!idsSolicitados || ids.every(id => idsSolicitados.includes(id)));
}

export function ehImagemLaudoPainel(valor: unknown): valor is ImagemLaudoPainel {
  return registro(valor) && texto(valor.id) && texto(valor.url) && texto(valor.thumbnailUrl) && texto(valor.legenda)
    && typeof valor.numero_figura === 'number' && Number.isFinite(valor.numero_figura)
    && typeof valor.sequencia === 'number' && Number.isFinite(valor.sequencia) && texto(valor.created_at)
    && opcionalTexto(valor.ocorrenciaId) && opcionalTexto(valor.imagemOrigemId) && opcionalTexto(valor.legendaSubstituicao)
    && (valor.dummy === undefined || typeof valor.dummy === 'boolean')
    && (valor.origem === undefined || valor.origem === 'gdl')
    && opcionalTexto(valor.sha256) && opcionalTexto(valor.nomeArquivo)
    && (valor.alturaParPercentual === undefined || alturaParFigurasValida(valor.alturaParPercentual))
    && (valor.ajusteVisualPar === undefined || ajusteVisualParFigurasValido(valor.ajusteVisualPar));
}

export function ehEstadoPainelFiguras(valor: unknown): valor is EstadoPainelFiguras {
  if (!registro(valor) || !Array.isArray(valor.figurasNoEditor) || !valor.figurasNoEditor.every(ehImagemLaudoPainel)
    || (valor.figurasDevolvidas !== undefined && (!Array.isArray(valor.figurasDevolvidas) || !valor.figurasDevolvidas.every(ehImagemLaudoPainel)))
    || (valor.sessaoId !== undefined && !indice(valor.sessaoId))
    || (valor.imagensProtegidas !== undefined && (!Array.isArray(valor.imagensProtegidas) || !valor.imagensProtegidas.every(texto)))
    || typeof valor.syncEnabled !== 'boolean' || !(valor.figuraAtivaId === null || texto(valor.figuraAtivaId))
    || !(valor.figuraAtivaOcorrenciaId === undefined || valor.figuraAtivaOcorrenciaId === null || texto(valor.figuraAtivaOcorrenciaId))
    || !opcionalTexto(valor.tema)) return false;
  const atualizacao = valor.resultadoAtualizacao;
  if (atualizacao !== undefined && !ehResultadoAtualizacaoFiguras(atualizacao)) return false;
  const resultado = valor.resultadoOperacao;
  return resultado === undefined || (registro(resultado) && texto(resultado.solicitacaoId) && typeof resultado.sucesso === 'boolean'
    && opcionalTexto(resultado.erro) && (resultado.valor === undefined || resultado.valor === null || typeof resultado.valor === 'boolean'
      || texto(resultado.valor) || (Array.isArray(resultado.valor) && resultado.valor.every(texto))
      || ehResultadoInsercaoFiguras(resultado.valor) || ehResultadoAtualizacaoFiguras(resultado.valor)));
}

export function ehAcaoPainelFiguras(acao: unknown, args: unknown[]): boolean {
  if (!texto(acao)) return false;
  if (acao === 'ready' || acao === 'popIn') return args.length === 0;
  if (acao === 'syncToggle' || acao === 'refreshHtml') return args.length === 1 && typeof args[0] === 'boolean';
  if (acao === 'scrollToFigure') return (args.length === 1 || args.length === 2) && texto(args[0]) && opcionalTexto(args[1]);
  if (acao === 'generateCaption' || acao === 'deleteFile') return args.length === 1 && texto(args[0]);
  if (acao === 'reorder' || acao === 'insertAll') return args.length === 1 && Array.isArray(args[0]) && args[0].every(ehImagemLaudoPainel);
  if (acao === 'previewPairHeight' || acao === 'commitPairHeight') return args.length === 3 && indice(args[0]) && alturaParFigurasValida(args[1]) && opcionalTexto(args[2]);
  if (acao === 'cancelPairHeight') return args.length === 2 && indice(args[0]) && opcionalTexto(args[1]);
  if (acao === 'setPairVisualMode') return args.length === 3 && indice(args[0]) && ajusteVisualParFigurasValido(args[1]) && opcionalTexto(args[2]);
  if (acao === 'insertImage') return args.length === 3 && args.every(texto);
  if (acao === 'deleteImage') return args.length === 3 && texto(args[0]) && (args[1] === undefined || indice(args[1])) && opcionalTexto(args[2]);
  if (acao === 'updateLegenda') return args.length === 3 && texto(args[0]) && texto(args[1]) && opcionalTexto(args[2]);
  if (acao === 'replaceImage') return args.length === 3 && texto(args[0]) && ehImagemLaudoPainel(args[1]) && (args[2] === undefined || indice(args[2]));
  if (acao === 'editImage') return args.length === 4 && indice(args[0]) && ehImagemLaudoPainel(args[1]) && texto(args[2]) && texto(args[3]);
  if (acao === 'solicitarOperacao') {
    const [solicitacaoId, laudoId, terceiro, ...restante] = args;
    const comSessao = typeof terceiro === 'number';
    const [operacao, ...parametros] = comSessao ? restante : [terceiro, ...restante];
    return texto(solicitacaoId) && solicitacaoId.length > 0 && texto(laudoId) && laudoId.length > 0
      && (!comSessao || indice(terceiro))
      && texto(operacao) && ['insertImage', 'insertAll', 'deleteImage', 'deleteFile', 'updateLegenda', 'replaceImage', 'editImage', 'generateCaption', 'refreshHtml', 'commitPairHeight', 'setPairVisualMode'].includes(operacao)
      && ehAcaoPainelFiguras(operacao, parametros);
  }
  return false;
}
