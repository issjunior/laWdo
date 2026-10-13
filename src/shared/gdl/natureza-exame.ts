import { NATUREZAS_EXAME_GDL } from '../catalogos/naturezas-exame-gdl.catalogo.js';
import { z } from 'zod';

export interface NaturezaExameGdl {
  idGdl: number;
  codigo: string;
  descricao: string;
}

export interface IdentificacaoNaturezaExameGdl {
  textoOriginal: string;
  codigoExplicito: string | null;
  candidatos: NaturezaExameGdl[];
  codigoSugerido: string | null;
  origem: 'gdl' | 'catalogo' | 'usuario';
}

export interface ConsultaIdentificacaoRepGdl {
  consultaId: string;
  identificacao: IdentificacaoNaturezaExameGdl;
  avisos: string[];
  tiposLocais: Array<{ id: string; codigo: string; nome: string }>;
  codigosImportacaoDisponiveis?: string[];
  detalhes?: { estado: 'aguardando_confirmacao' | 'confirmados' | 'parciais' | 'somente_api'; statusAtual: string | null; motivoConfirmacao?: string; origemNatureza?: 'api' | 'detalhes' | 'cache' | 'catalogo'; divergencia?: boolean };
}

export interface CampoDetalheGdl { estado: 'ausente' | 'vazio' | 'presente'; valor: string }
export interface DetalhesRepGdl { natureza: string | null; quesito: CampoDetalheGdl; dataSolicitacao: CampoDetalheGdl }

export const esquemaIdentificacaoNaturezaExameGdl = z.object({
  textoOriginal: z.string(),
  codigoExplicito: z.string().nullable(),
  candidatos: z.array(z.object({ idGdl: z.number().int().positive(), codigo: z.string().min(1), descricao: z.string().min(1) })),
  codigoSugerido: z.string().nullable(),
  origem: z.enum(['gdl', 'catalogo', 'usuario']),
});

export const esquemaConsultaIdentificacaoRepGdl = z.object({
  consultaId: z.string().uuid(),
  identificacao: esquemaIdentificacaoNaturezaExameGdl,
  tiposLocais: z.array(z.object({ id: z.string().min(1), codigo: z.string().min(1), nome: z.string().min(1) })),
  avisos: z.array(z.string()),
  codigosImportacaoDisponiveis: z.array(z.string().min(1)).optional(),
  detalhes: z.object({ estado: z.enum(['aguardando_confirmacao', 'confirmados', 'parciais', 'somente_api']), statusAtual: z.string().nullable(), motivoConfirmacao: z.string().optional(), origemNatureza: z.enum(['api', 'detalhes', 'cache', 'catalogo']).optional(), divergencia: z.boolean().optional() }).optional(),
});

export function normalizarCodigoExame(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function codigoExameParaFormulario(codigo: string): string {
  return normalizarCodigoExame(codigo).replace(/^([A-Z])(\d{3})$/, '$1-$2');
}

function normalizarDescricao(descricao: string): string {
  return descricao.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function identificarNaturezaExame(textoOriginal: string): IdentificacaoNaturezaExameGdl {
  const correspondencia = textoOriginal.trim().match(/^([A-Z]\s*-?\s*\d{3}|\d{4})(?=\s|\s*-|$)/i);
  const codigoExplicito = correspondencia ? normalizarCodigoExame(correspondencia[1]) : null;
  const descricao = normalizarDescricao(textoOriginal);
  const candidatos = NATUREZAS_EXAME_GDL.filter(natureza => codigoExplicito
    ? natureza.codigo === codigoExplicito
    : normalizarDescricao(natureza.descricao) === descricao);
  const preferido = candidatos.find(natureza => ['B601', 'A440'].includes(natureza.codigo));
  return {
    textoOriginal, codigoExplicito, candidatos,
    codigoSugerido: codigoExplicito ?? preferido?.codigo ?? candidatos[0]?.codigo ?? null,
    origem: codigoExplicito ? 'gdl' : 'catalogo',
  };
}

export function apresentarNaturezaExame(texto: string): string {
  const identificacao = identificarNaturezaExame(texto);
  const candidata = identificacao.candidatos.find(item => item.codigo === identificacao.codigoSugerido);
  if (!candidata) return texto;
  return `${candidata.codigo} - ${candidata.descricao}`;
}
