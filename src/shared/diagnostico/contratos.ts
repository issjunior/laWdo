import { z } from 'zod';

export const VERSAO_PROTOCOLO_DIAGNOSTICO = 1;

export const codigosErroDiagnostico = [
  'ENTRADA_INVALIDA',
  'SESSAO_INDISPONIVEL',
  'AUTENTICACAO_FALHOU',
  'VERSAO_INCOMPATIVEL',
  'JANELA_NAO_ENCONTRADA',
  'JANELA_INDISPONIVEL',
  'SNAPSHOT_EXPIRADO',
  'ELEMENTO_NAO_ENCONTRADO',
  'ACAO_NAO_SUPORTADA',
  'TIMEOUT',
  'CAPTURA_PARCIAL',
  'CAPTURA_EM_ANDAMENTO',
  'CAPTURA_NAO_ENCONTRADA',
  'CAPTURA_EXPIRADA',
  'CAPTURA_INCOMPATIVEL',
  'ERRO_INTERNO',
] as const;

export const schemaRetanguloDiagnostico = z.strictObject({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  largura: z.number().int().positive(),
  altura: z.number().int().positive(),
});

const schemaJanelaId = z.number().int().positive();
const schemaUuid = z.string().uuid();

export const schemaDiagnosticoStatusEntrada = z.strictObject({});

export const schemaCapturarTelaEntrada = z.strictObject({
  janelaId: schemaJanelaId.optional(),
  regiao: schemaRetanguloDiagnostico.optional(),
});

export const schemaInspecionarInterfaceEntrada = z.strictObject({
  janelaId: schemaJanelaId.optional(),
  limiteElementos: z.number().int().min(1).max(1000).default(500),
  profundidadeMaxima: z.number().int().min(1).max(20).default(12),
});

const schemaAcaoClique = z.strictObject({
  tipo: z.literal('clicar'),
  botao: z.enum(['esquerdo', 'direito', 'meio']).default('esquerdo'),
  quantidade: z.union([z.literal(1), z.literal(2)]).default(1),
});

const schemaAcaoDigitacao = z.strictObject({
  tipo: z.literal('digitar'),
  texto: z.string().max(20_000),
  modo: z.enum(['substituir', 'acrescentar']),
});

export const schemaExecutarAcaoEntrada = z.strictObject({
  janelaId: schemaJanelaId,
  revisao: schemaUuid,
  elementoId: z.string().min(1),
  acao: z.discriminatedUnion('tipo', [schemaAcaoClique, schemaAcaoDigitacao]),
});

export const schemaObterEventosEntrada = z.strictObject({
  depoisDe: z.number().int().nonnegative().default(0),
  limite: z.number().int().min(1).max(200).default(100),
  categorias: z.array(z.enum(['sessao', 'janela', 'acao', 'console', 'erro', 'ipc'])).min(1).optional(),
  niveis: z.array(z.enum(['debug', 'info', 'warn', 'error'])).min(1).optional(),
  origens: z.array(z.enum(['main', 'preload', 'renderer', 'agente'])).min(1).optional(),
  janelaId: schemaJanelaId.optional(),
  correlacaoId: schemaUuid.optional(),
});

export const schemaCriarSnapshotEntrada = z.strictObject({
  janelaId: schemaJanelaId.optional(),
  quantidadeEventos: z.number().int().min(1).max(1000).default(200),
  regiao: schemaRetanguloDiagnostico.nullable().optional(),
});

const schemaCategoriasCaptura = z.array(z.enum(['sessao', 'janela', 'acao', 'console', 'erro', 'ipc'])).min(1);
export const schemaIniciarCapturaEntrada = z.discriminatedUnion('finalidade', [
  z.strictObject({
    finalidade: z.literal('problema'),
    cenario: z.string().trim().min(10).max(500),
    janelaId: schemaJanelaId.optional(),
    categorias: schemaCategoriasCaptura.optional(),
  }),
  z.strictObject({
    finalidade: z.literal('desempenho'),
    janelaId: schemaJanelaId.optional(),
    duracaoSegundos: z.number().int().min(30).max(300).default(60),
    cenarioDesempenho: z.enum(['ocioso', 'abertura_laudo', 'uso_editor', 'painel_ia', 'geral']).default('geral'),
  }),
]);

export const schemaStatusCapturaEntrada = z.strictObject({
  capturaId: schemaUuid.optional(),
});

export const schemaFinalizarCapturaEntrada = z.strictObject({
  capturaId: schemaUuid,
  resultadoUsuario: z.enum(['reproduzido', 'nao_reproduzido', 'interrompido']).optional(),
  observacaoUsuario: z.string().trim().max(1_000).optional(),
});

export const schemaConsultarCapturaEntrada = z.strictObject({
  capturaId: schemaUuid,
  componente: z.enum(['manifesto', 'dossie', 'metricas_resumo', 'amostras_processos', 'timeline', 'eventos', 'interface_inicial', 'interface_final', 'tela_inicial', 'tela_final', 'erro']),
  depoisDe: z.number().int().nonnegative().default(0),
  limite: z.number().int().min(1).max(200).default(50),
  compararComCapturaId: schemaUuid.optional(),
});

export const schemasEntradaFerramentasDiagnostico = {
  diagnostico_status: schemaDiagnosticoStatusEntrada,
  capturar_tela: schemaCapturarTelaEntrada,
  inspecionar_interface: schemaInspecionarInterfaceEntrada,
  executar_acao: schemaExecutarAcaoEntrada,
  obter_eventos: schemaObterEventosEntrada,
  criar_snapshot: schemaCriarSnapshotEntrada,
  iniciar_captura: schemaIniciarCapturaEntrada,
  status_captura: schemaStatusCapturaEntrada,
  finalizar_captura: schemaFinalizarCapturaEntrada,
  consultar_captura: schemaConsultarCapturaEntrada,
} as const;

export type NomeFerramentaDiagnostico = keyof typeof schemasEntradaFerramentasDiagnostico;
export type EntradaCapturarTela = z.infer<typeof schemaCapturarTelaEntrada>;
export type EntradaInspecionarInterface = z.infer<typeof schemaInspecionarInterfaceEntrada>;
export type EntradaExecutarAcao = z.infer<typeof schemaExecutarAcaoEntrada>;
export type EntradaObterEventos = z.infer<typeof schemaObterEventosEntrada>;
export type EntradaCriarSnapshot = z.infer<typeof schemaCriarSnapshotEntrada>;
export type EntradaIniciarCaptura = z.infer<typeof schemaIniciarCapturaEntrada>;
export type EntradaStatusCaptura = z.infer<typeof schemaStatusCapturaEntrada>;
export type EntradaFinalizarCaptura = z.infer<typeof schemaFinalizarCapturaEntrada>;
export type EntradaConsultarCaptura = z.infer<typeof schemaConsultarCapturaEntrada>;

export const schemaEventoDiagnostico = z.strictObject({
  sequencia: z.number().int().positive(),
  timestamp: z.string().datetime({ offset: true }),
  origem: z.enum(['main', 'preload', 'renderer', 'agente']),
  categoria: z.enum(['sessao', 'janela', 'acao', 'console', 'erro', 'ipc']),
  nivel: z.enum(['debug', 'info', 'warn', 'error']),
  janelaId: schemaJanelaId.optional(),
  rota: z.string().optional(),
  correlacaoId: schemaUuid.optional(),
  dados: z.record(z.string(), z.unknown()),
});

export type EventoDiagnostico = z.infer<typeof schemaEventoDiagnostico>;
export type CodigoErroDiagnostico = (typeof codigosErroDiagnostico)[number];

export interface RespostaDiagnosticoSucesso<TDados> {
  ok: true;
  versaoProtocolo: typeof VERSAO_PROTOCOLO_DIAGNOSTICO;
  requestId: string;
  sessionId: string | null;
  dados: TDados;
}

export interface RespostaDiagnosticoErro {
  ok: false;
  versaoProtocolo: typeof VERSAO_PROTOCOLO_DIAGNOSTICO;
  requestId: string;
  sessionId: string | null;
  erro: {
    codigo: CodigoErroDiagnostico;
    mensagem: string;
    recuperavel: boolean;
    detalhes: Record<string, unknown>;
  };
}

export function criarRespostaDiagnosticoSucesso<TDados>(
  requestId: string,
  sessionId: string | null,
  dados: TDados,
): RespostaDiagnosticoSucesso<TDados> {
  return { ok: true, versaoProtocolo: VERSAO_PROTOCOLO_DIAGNOSTICO, requestId, sessionId, dados };
}

export function criarRespostaDiagnosticoErro(
  requestId: string,
  sessionId: string | null,
  codigo: CodigoErroDiagnostico,
  mensagem: string,
  recuperavel: boolean,
  detalhes: Record<string, unknown> = {},
): RespostaDiagnosticoErro {
  return {
    ok: false,
    versaoProtocolo: VERSAO_PROTOCOLO_DIAGNOSTICO,
    requestId,
    sessionId,
    erro: { codigo, mensagem, recuperavel, detalhes },
  };
}

export function gerarSchemasJsonFerramentasDiagnostico(): Record<NomeFerramentaDiagnostico, object> {
  return Object.fromEntries(
    Object.entries(schemasEntradaFerramentasDiagnostico).map(([nome, schema]) => [nome, z.toJSONSchema(schema)]),
  ) as Record<NomeFerramentaDiagnostico, object>;
}
