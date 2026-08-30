export const ACOES_IA = [
  'ortografia',
  'tecnico_pericial',
  'reescrever',
  'clareza',
  'resumir',
  'expandir',
  'inserir',
] as const;

export const ESCOPOS_IA = ['selecao', 'secao', 'laudo_completo', 'cursor'] as const;

export type AcaoIa = typeof ACOES_IA[number];
export type EscopoIa = typeof ESCOPOS_IA[number];
export type ModoInteracaoIa = 'perguntar' | 'escrever' | 'reescrever';
export type EstadoConsultaIa = 'respondida' | 'insuficiente' | 'conflitante';
export type FaseConsultaIa = 'preparando' | 'analisando' | 'consolidando' | 'verificando';
export type EstadoOperacaoPainelIa = 'ocioso' | 'preparando' | 'analisando' | 'consolidando' | 'verificando' | 'concluido' | 'insuficiente' | 'conflitante' | 'cancelado' | 'erro';

export interface BlocoContextoIa {
  id: string;
  tipo: 'titulo' | 'paragrafo' | 'lista' | 'tabela' | 'figura' | 'legenda' | 'bloco';
  ordem: number;
  secaoId: string;
  secaoTitulo: string;
  titulo: string;
  texto: string;
  ancora: string;
}

export interface EvidenciaConsultaIa {
  blocoId: string;
}

export interface SolicitacaoConsultaIa {
  operationId: string;
  pergunta: string;
  escopo: 'secao' | 'laudo_completo';
  modelo?: string;
  fingerprint: string;
  blocos: BlocoContextoIa[];
  memoria: Array<{ pergunta: string; resposta: string }>;
}

export interface RespostaConsultaIa {
  operationId: string;
  estado: EstadoConsultaIa;
  resposta: string;
  evidencias: EvidenciaConsultaIa[];
  itens?: string[];
  total?: number;
  modelo: string;
  recomendacao?: string;
}

export interface ProgressoConsultaIa {
  operationId: string;
  fase: FaseConsultaIa;
}

export function progressoConsultaIaValido(valor: unknown): valor is ProgressoConsultaIa {
  if (!valor || typeof valor !== 'object') return false;
  const progresso = valor as Record<string, unknown>;
  return typeof progresso.operationId === 'string' && Boolean(progresso.operationId)
    && ['preparando', 'analisando', 'consolidando', 'verificando'].includes(String(progresso.fase));
}

function blocoContextoIaValido(valor: unknown): valor is BlocoContextoIa {
  if (!valor || typeof valor !== 'object') return false;
  const bloco = valor as Record<string, unknown>;
  return typeof bloco.id === 'string' && Boolean(bloco.id)
    && ['titulo', 'paragrafo', 'lista', 'tabela', 'figura', 'legenda', 'bloco'].includes(String(bloco.tipo))
    && Number.isInteger(bloco.ordem) && (bloco.ordem as number) >= 0
    && ['secaoId', 'secaoTitulo', 'titulo', 'texto', 'ancora'].every(campo => typeof bloco[campo] === 'string');
}

export function solicitacaoConsultaIaValida(valor: unknown): valor is SolicitacaoConsultaIa {
  if (!valor || typeof valor !== 'object') return false;
  const solicitacao = valor as Record<string, unknown>;
  return typeof solicitacao.operationId === 'string' && Boolean(solicitacao.operationId)
    && typeof solicitacao.pergunta === 'string' && solicitacao.pergunta.trim().length > 0 && solicitacao.pergunta.length <= 10_000
    && (solicitacao.escopo === 'secao' || solicitacao.escopo === 'laudo_completo')
    && typeof solicitacao.fingerprint === 'string' && Boolean(solicitacao.fingerprint)
    && Array.isArray(solicitacao.blocos) && solicitacao.blocos.length > 0 && solicitacao.blocos.every(blocoContextoIaValido)
    && Array.isArray(solicitacao.memoria) && solicitacao.memoria.length <= 3
    && solicitacao.memoria.every(item => item && typeof item === 'object' && typeof item.pergunta === 'string' && typeof item.resposta === 'string');
}

export function respostaConsultaIaValida(valor: unknown, blocos?: BlocoContextoIa[]): valor is RespostaConsultaIa {
  if (!valor || typeof valor !== 'object') return false;
  const resposta = valor as Record<string, unknown>;
  if (typeof resposta.operationId !== 'string' || !resposta.operationId
    || !['respondida', 'insuficiente', 'conflitante'].includes(String(resposta.estado))
    || typeof resposta.resposta !== 'string' || typeof resposta.modelo !== 'string'
    || !Array.isArray(resposta.evidencias)) return false;
  const ids = new Set<string>();
  const idsBlocos = blocos ? new Set(blocos.map(bloco => bloco.id)) : null;
  return resposta.evidencias.every(evidencia => {
    if (!evidencia || typeof evidencia !== 'object' || typeof (evidencia as Record<string, unknown>).blocoId !== 'string') return false;
    const id = (evidencia as Record<string, unknown>).blocoId as string;
    if (ids.has(id) || (idsBlocos && !idsBlocos.has(id))) return false;
    ids.add(id);
    return true;
  }) && (resposta.itens === undefined || (Array.isArray(resposta.itens) && resposta.itens.every(item => typeof item === 'string')))
    && (resposta.total === undefined || (Number.isInteger(resposta.total) && (resposta.total as number) >= 0))
    && (resposta.recomendacao === undefined || (typeof resposta.recomendacao === 'string' && resposta.recomendacao.length <= 500));
}
export type TomRespostaIa = 'tecnico_pericial' | 'formal' | 'direto';
export type DetalhamentoRespostaIa = 'conciso' | 'equilibrado' | 'detalhado';

export interface PerfilRespostaIa {
  versao: 1;
  tom: TomRespostaIa;
  detalhamento: DetalhamentoRespostaIa;
  instrucoesPersonalizadas: string;
  temperatura?: number;
}

export const PERFIL_RESPOSTA_IA_PADRAO: PerfilRespostaIa = {
  versao: 1,
  tom: 'tecnico_pericial',
  detalhamento: 'equilibrado',
  instrucoesPersonalizadas: '',
  temperatura: 0.2,
};

export function perfilRespostaIaValido(valor: unknown): valor is PerfilRespostaIa {
  if (!valor || typeof valor !== 'object') return false;
  const perfil = valor as Record<string, unknown>;
  return perfil.versao === 1
    && ['tecnico_pericial', 'formal', 'direto'].includes(String(perfil.tom))
    && ['conciso', 'equilibrado', 'detalhado'].includes(String(perfil.detalhamento))
    && typeof perfil.instrucoesPersonalizadas === 'string'
    && perfil.instrucoesPersonalizadas.length <= 2_000
    && (perfil.temperatura === undefined || (
      typeof perfil.temperatura === 'number'
      && Number.isFinite(perfil.temperatura)
      && perfil.temperatura >= 0
      && perfil.temperatura <= 1
    ));
}

export interface ConfiguracaoPrivacidadeIa {
  versao: 1;
  enviarConteudoIntegral: boolean;
}

export const CONFIGURACAO_PRIVACIDADE_IA_PADRAO: ConfiguracaoPrivacidadeIa = {
  versao: 1,
  enviarConteudoIntegral: true,
};

export function configuracaoPrivacidadeIaValida(valor: unknown): valor is ConfiguracaoPrivacidadeIa {
  if (!valor || typeof valor !== 'object') return false;
  const configuracao = valor as Record<string, unknown>;
  return configuracao.versao === 1
    && typeof configuracao.enviarConteudoIntegral === 'boolean';
}

export function deveMascararConteudoIa(configuracao: ConfiguracaoPrivacidadeIa): boolean {
  return !configuracao.enviarConteudoIntegral;
}

export type QualidadeImagemIa = 'original' | 'alta' | 'equilibrada' | 'economica';

export interface ConfiguracaoImagemIa {
  versao: 1;
  qualidade: QualidadeImagemIa;
}

export const CONFIGURACAO_IMAGEM_IA_PADRAO: ConfiguracaoImagemIa = {
  versao: 1,
  qualidade: 'equilibrada',
};

export function qualidadeImagemIaValida(valor: unknown): valor is QualidadeImagemIa {
  return ['original', 'alta', 'equilibrada', 'economica'].includes(String(valor));
}

export function configuracaoImagemIaValida(valor: unknown): valor is ConfiguracaoImagemIa {
  if (!valor || typeof valor !== 'object') return false;
  const configuracao = valor as Record<string, unknown>;
  return configuracao.versao === 1 && qualidadeImagemIaValida(configuracao.qualidade);
}

export interface FragmentoIa {
  id: string;
  texto: string;
}

export interface SolicitacaoIa {
  operationId: string;
  acao: AcaoIa;
  escopo: EscopoIa;
  instrucao?: string;
  contextoResolvido?: string;
  modelo?: string;
  planoId?: string;
  retomadaId?: string;
  fragmentos: FragmentoIa[];
}

export function solicitacaoIaValida(valor: unknown): valor is SolicitacaoIa {
  if (!valor || typeof valor !== 'object') return false;
  const solicitacao = valor as Record<string, unknown>;
  if (
    typeof solicitacao.operationId !== 'string'
    || !solicitacao.operationId.trim()
    || typeof solicitacao.acao !== 'string'
    || !ACOES_IA.includes(solicitacao.acao as AcaoIa)
    || typeof solicitacao.escopo !== 'string'
    || !ESCOPOS_IA.includes(solicitacao.escopo as EscopoIa)
    || (solicitacao.instrucao !== undefined && (typeof solicitacao.instrucao !== 'string' || solicitacao.instrucao.length > 10_000))
    || (solicitacao.contextoResolvido !== undefined && (typeof solicitacao.contextoResolvido !== 'string' || solicitacao.contextoResolvido.length > 200_000))
    || (solicitacao.modelo !== undefined && (typeof solicitacao.modelo !== 'string' || !solicitacao.modelo.trim() || solicitacao.modelo.length > 200))
    || (solicitacao.planoId !== undefined && (typeof solicitacao.planoId !== 'string' || !solicitacao.planoId))
    || (solicitacao.retomadaId !== undefined && (typeof solicitacao.retomadaId !== 'string' || !solicitacao.retomadaId))
    || !Array.isArray(solicitacao.fragmentos)
    || solicitacao.fragmentos.length === 0
  ) return false;

  const ids = new Set<string>();
  return solicitacao.fragmentos.every(fragmento => {
    if (!fragmento || typeof fragmento !== 'object') return false;
    const item = fragmento as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.texto !== 'string' || !item.texto) return false;
    ids.add(item.id);
    return true;
  });
}

export interface SolicitacaoDescricaoImagemIa {
  operationId: string;
  laudoId: string;
  imagemId: string;
  modo?: 'descricao' | 'legenda';
}

export interface ContextoIa {
  configurado: boolean;
  provedor?: 'groq' | 'gemini';
  modelo?: string;
  suportaVisao: boolean;
}

export interface ErroIa {
  codigo:
    | 'CONFIGURACAO_AUSENTE'
    | 'NAO_AUTORIZADO'
    | 'ENTRADA_INVALIDA'
    | 'LIMITE_EXCEDIDO'
    | 'LIMITE_REQUISICOES'
    | 'MODELO_INCOMPATIVEL'
    | 'FORMATO_IMAGEM_NAO_SUPORTADO'
    | 'IMAGEM_MUITO_GRANDE'
    | 'IMAGEM_PROTEGIDA'
    | 'CANCELADO'
    | 'TIMEOUT'
    | 'SEM_CONEXAO'
    | 'PROVEDOR_INDISPONIVEL'
    | 'RESPOSTA_INVALIDA'
    | 'RESPOSTA_VAZIA'
    | 'CONFIRMACAO_NECESSARIA'
    | 'PLANO_ALTERADO'
    | 'RETOMADA_INDISPONIVEL'
    | 'RETOMADA_INVALIDA'
    | 'OPERACAO_EM_ANDAMENTO'
    | 'ERRO_INTERNO';
  mensagem: string;
  retryable: boolean;
  acaoSugerida: string;
}

export type CategoriaLimiteUsoIa = 'requisicoes' | 'tokens' | 'diario' | 'gasto' | 'desconhecido';

export interface LimiteUsoIa {
  provedor: 'groq' | 'gemini';
  categoria: CategoriaLimiteUsoIa;
  tentarNovamenteEm?: number;
  fonteTempo?: 'retry_info' | 'retry_after' | 'cabecalho_provedor';
  identificadorCota?: string;
}

export interface RespostaIa {
  operationId: string;
  fragmentos: FragmentoIa[];
}

export interface PlanoExecucaoIaResumo {
  planoId: string;
  acao: AcaoIa;
  escopo: EscopoIa;
  provedor: 'groq' | 'gemini';
  modelo: string;
  totalLotes: number;
  chamadasBase: number;
  limiteMaximoChamadas: number;
  requerConfirmacao: boolean;
}

export function planoExecucaoIaResumoValido(valor: unknown): valor is PlanoExecucaoIaResumo {
  if (!valor || typeof valor !== 'object') return false;
  const plano = valor as Record<string, unknown>;
  return typeof plano.planoId === 'string'
    && Boolean(plano.planoId)
    && typeof plano.acao === 'string'
    && ACOES_IA.includes(plano.acao as AcaoIa)
    && typeof plano.escopo === 'string'
    && ESCOPOS_IA.includes(plano.escopo as EscopoIa)
    && (plano.provedor === 'groq' || plano.provedor === 'gemini')
    && typeof plano.modelo === 'string'
    && Boolean(plano.modelo)
    && Number.isInteger(plano.totalLotes)
    && (plano.totalLotes as number) > 0
    && plano.chamadasBase === plano.totalLotes
    && Number.isInteger(plano.limiteMaximoChamadas)
    && (plano.limiteMaximoChamadas as number) >= (plano.chamadasBase as number)
    && typeof plano.requerConfirmacao === 'boolean';
}

export interface RetomadaIa {
  retomadaId: string;
  planoId: string;
  lotesConcluidos: number;
  totalLotes: number;
}

export function retomadaIaValida(valor: unknown): valor is RetomadaIa {
  if (!valor || typeof valor !== 'object') return false;
  const retomada = valor as Record<string, unknown>;
  return typeof retomada.retomadaId === 'string'
    && Boolean(retomada.retomadaId)
    && typeof retomada.planoId === 'string'
    && Boolean(retomada.planoId)
    && Number.isInteger(retomada.lotesConcluidos)
    && (retomada.lotesConcluidos as number) > 0
    && Number.isInteger(retomada.totalLotes)
    && (retomada.totalLotes as number) > (retomada.lotesConcluidos as number);
}

export interface RespostaExecucaoIaIpc {
  success: boolean;
  data?: RespostaIa;
  error?: string;
  retomada?: RetomadaIa;
  limiteRequisicoes?: LimiteUsoIa;
}

export type FaseProgressoIa = 'preparando' | 'processando' | 'concluido';

export interface ProgressoIa {
  operationId: string;
  fase: FaseProgressoIa;
  loteAtual: number;
  totalLotes: number;
  tentativa: number;
  chamadasConcluidas: number;
}

export function progressoIaValido(valor: unknown): valor is ProgressoIa {
  if (!valor || typeof valor !== 'object') return false;
  const progresso = valor as Record<string, unknown>;
  return typeof progresso.operationId === 'string'
    && Boolean(progresso.operationId)
    && (progresso.fase === 'preparando' || progresso.fase === 'processando' || progresso.fase === 'concluido')
    && Number.isInteger(progresso.loteAtual)
    && (progresso.loteAtual as number) >= 0
    && Number.isInteger(progresso.totalLotes)
    && (progresso.totalLotes as number) > 0
    && (progresso.loteAtual as number) <= (progresso.totalLotes as number)
    && Number.isInteger(progresso.tentativa)
    && (progresso.tentativa as number) >= 0
    && Number.isInteger(progresso.chamadasConcluidas)
    && (progresso.chamadasConcluidas as number) >= 0
    && (progresso.chamadasConcluidas as number) <= (progresso.totalLotes as number);
}

export interface RespostaDescricaoImagemIa {
  operationId: string;
  descricao: string;
  miniaturaDataUri: string;
}

export type AcaoPainelIa = AcaoIa | 'descrever_imagem';

export interface MensagemPainelIa {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  aplicacao?: 'inserir' | 'substituir';
  acao?: AcaoPainelIa;
  evidencias?: BlocoContextoIa[];
  estadoConsulta?: EstadoConsultaIa;
  modeloConsulta?: string;
  perguntaConsulta?: string;
  recomendacao?: string;
  permiteAplicacao?: boolean;
  proposalId?: string;
  miniaturaDataUri?: string;
}

export interface EstadoPainelIa {
  revisao: number;
  titulo: string;
  carregando: boolean;
  estadoOperacao?: EstadoOperacaoPainelIa;
  erro: string | null;
  avisoLimite?: { mensagem: string; tentarNovamenteEm?: number } | null;
  editorDisponivel: boolean;
  imagemSelecionada: boolean;
  contextoImagem: boolean;
  modoAplicacao: 'inserir' | 'substituir';
  progresso: ProgressoIa | null;
  progressoConsulta?: ProgressoConsultaIa | null;
  planoPendente: PlanoExecucaoIaResumo | null;
  retomada: RetomadaIa | null;
  mensagens: MensagemPainelIa[];
  escopos: Array<{ id: number; titulo: string }>;
  escopoSelecionado?: number | null;
  modeloSelecionado?: string;
  provedorIa?: 'groq' | 'gemini';
}

export type CamposEstadoPainelIa = Omit<EstadoPainelIa, 'revisao'>;

export interface SnapshotPainelIa {
  tipo: 'snapshot';
  estado: EstadoPainelIa;
}

export interface DeltaPainelIa {
  tipo: 'delta';
  revisao: number;
  alteracoes: Partial<CamposEstadoPainelIa>;
}

export type AtualizacaoPainelIa = SnapshotPainelIa | DeltaPainelIa;

const CAMPOS_ESTADO_PAINEL_IA: Array<keyof CamposEstadoPainelIa> = [
  'titulo',
  'carregando',
  'estadoOperacao',
  'erro',
  'avisoLimite',
  'editorDisponivel',
  'imagemSelecionada',
  'contextoImagem',
  'modoAplicacao',
  'progresso',
  'progressoConsulta',
  'planoPendente',
  'retomada',
  'mensagens',
  'escopos',
  'modeloSelecionado',
  'provedorIa',
];

function mensagensPainelIaValidas(valor: unknown): valor is MensagemPainelIa[] {
  return Array.isArray(valor) && valor.every(mensagem => {
    if (!mensagem || typeof mensagem !== 'object') return false;
    const item = mensagem as Record<string, unknown>;
    return typeof item.id === 'string'
      && Boolean(item.id)
      && (item.role === 'user' || item.role === 'assistant')
      && typeof item.content === 'string'
      && typeof item.timestamp === 'number'
      && (item.miniaturaDataUri === undefined || typeof item.miniaturaDataUri === 'string')
      && (item.evidencias === undefined || Array.isArray(item.evidencias))
      && (item.estadoConsulta === undefined || ['respondida', 'insuficiente', 'conflitante'].includes(String(item.estadoConsulta)))
      && (item.modeloConsulta === undefined || typeof item.modeloConsulta === 'string')
      && (item.perguntaConsulta === undefined || typeof item.perguntaConsulta === 'string')
      && (item.recomendacao === undefined || typeof item.recomendacao === 'string');
  });
}

function escoposPainelIaValidos(valor: unknown): valor is EstadoPainelIa['escopos'] {
  return Array.isArray(valor) && valor.every(escopo => {
    if (!escopo || typeof escopo !== 'object') return false;
    const item = escopo as Record<string, unknown>;
    return Number.isInteger(item.id) && typeof item.titulo === 'string';
  });
}

function campoEstadoPainelIaValido(campo: keyof CamposEstadoPainelIa, valor: unknown): boolean {
  switch (campo) {
    case 'titulo': return typeof valor === 'string';
    case 'avisoLimite': return valor === undefined || valor === null || (
      typeof valor === 'object'
      && typeof (valor as { mensagem?: unknown }).mensagem === 'string'
      && (!('tentarNovamenteEm' in valor)
        || (valor as { tentarNovamenteEm?: unknown }).tentarNovamenteEm === undefined
        || Number.isFinite((valor as { tentarNovamenteEm?: unknown }).tentarNovamenteEm))
    );
    case 'carregando':
    case 'editorDisponivel':
    case 'imagemSelecionada':
    case 'contextoImagem': return typeof valor === 'boolean';
    case 'estadoOperacao': return valor === undefined || ['ocioso', 'preparando', 'analisando', 'consolidando', 'verificando', 'concluido', 'insuficiente', 'conflitante', 'cancelado', 'erro'].includes(String(valor));
    case 'erro': return valor === null || typeof valor === 'string';
    case 'modoAplicacao': return valor === 'inserir' || valor === 'substituir';
    case 'progresso': return valor === null || progressoIaValido(valor);
    case 'progressoConsulta': return valor === undefined || valor === null || progressoConsultaIaValido(valor);
    case 'planoPendente': return valor === null || planoExecucaoIaResumoValido(valor);
    case 'retomada': return valor === null || retomadaIaValida(valor);
    case 'mensagens': return mensagensPainelIaValidas(valor);
    case 'escopos': return escoposPainelIaValidos(valor);
    case 'escopoSelecionado': return valor === null || Number.isInteger(valor);
    case 'modeloSelecionado': return valor === undefined || (typeof valor === 'string' && Boolean(valor));
    case 'provedorIa': return valor === undefined || valor === 'groq' || valor === 'gemini';
  }
}

export function estadoPainelIaValido(valor: unknown): valor is EstadoPainelIa {
  if (!valor || typeof valor !== 'object') return false;
  const estado = valor as Record<string, unknown>;
  return Number.isInteger(estado.revisao)
    && (estado.revisao as number) > 0
    && CAMPOS_ESTADO_PAINEL_IA.every(campo => campoEstadoPainelIaValido(campo, estado[campo]))
    && (!('escopoSelecionado' in estado) || campoEstadoPainelIaValido('escopoSelecionado', estado.escopoSelecionado));
}

export function atualizacaoPainelIaValida(valor: unknown): valor is AtualizacaoPainelIa {
  if (!valor || typeof valor !== 'object') return false;
  const atualizacao = valor as Record<string, unknown>;
  if (atualizacao.tipo === 'snapshot') return estadoPainelIaValido(atualizacao.estado);
  if (atualizacao.tipo !== 'delta'
    || !Number.isInteger(atualizacao.revisao)
    || (atualizacao.revisao as number) <= 0
    || !atualizacao.alteracoes
    || typeof atualizacao.alteracoes !== 'object') return false;

  const alteracoes = atualizacao.alteracoes as Record<string, unknown>;
  const campos = Object.keys(alteracoes);
  return campos.length > 0
    && campos.every(campo => CAMPOS_ESTADO_PAINEL_IA.includes(campo as keyof CamposEstadoPainelIa)
      && campoEstadoPainelIaValido(campo as keyof CamposEstadoPainelIa, alteracoes[campo]));
}

export function aplicarAtualizacaoPainelIa(
  estadoAtual: EstadoPainelIa | null,
  atualizacao: AtualizacaoPainelIa,
): { estado: EstadoPainelIa | null; requerRessincronizacao: boolean } {
  if (atualizacao.tipo === 'snapshot') {
    return {
      estado: !estadoAtual || atualizacao.estado.revisao > estadoAtual.revisao
        ? atualizacao.estado
        : estadoAtual,
      requerRessincronizacao: false,
    };
  }
  if (!estadoAtual) return { estado: null, requerRessincronizacao: true };
  if (atualizacao.revisao <= estadoAtual.revisao) {
    return { estado: estadoAtual, requerRessincronizacao: false };
  }
  if (atualizacao.revisao !== estadoAtual.revisao + 1) {
    return { estado: estadoAtual, requerRessincronizacao: true };
  }
  return {
    estado: { ...estadoAtual, ...atualizacao.alteracoes, revisao: atualizacao.revisao },
    requerRessincronizacao: false,
  };
}

export type ComandoPainelIa =
  | { tipo: 'executar_acao'; acao: AcaoIa }
  | { tipo: 'enviar_pedido_livre'; mensagem: string; modo: ModoInteracaoIa; tamanho: 'automatico' | 'curta' | 'media' | 'longa' }
  | { tipo: 'perguntar_documento_completo'; pergunta: string }
  | { tipo: 'reenviar_mensagem'; mensagemId: string }
  | { tipo: 'limpar_conversa' }
  | { tipo: 'aplicar_resposta'; mensagemId: string }
  | { tipo: 'navegar_evidencia'; evidencia: BlocoContextoIa }
  | { tipo: 'cancelar_operacao' }
  | { tipo: 'retomar_operacao' }
  | { tipo: 'confirmar_execucao' }
  | { tipo: 'cancelar_confirmacao' }
  | { tipo: 'descrever_imagem' }
  | { tipo: 'solicitar_ressincronizacao' }
  | { tipo: 'selecionar_escopo'; indice: number }
  | { tipo: 'selecionar_modelo'; modelo: string };

export function comandoPainelIaValido(valor: unknown): valor is ComandoPainelIa {
  if (!valor || typeof valor !== 'object') return false;
  const comando = valor as Record<string, unknown>;
  if (comando.tipo === 'executar_acao') return typeof comando.acao === 'string' && ACOES_IA.includes(comando.acao as AcaoIa);
  if (comando.tipo === 'enviar_pedido_livre') {
    return typeof comando.mensagem === 'string'
      && comando.mensagem.trim().length > 0
      && (comando.modo === 'perguntar' || comando.modo === 'escrever' || comando.modo === 'reescrever')
      && ['automatico', 'curta', 'media', 'longa'].includes(String(comando.tamanho));
  }
  if (comando.tipo === 'perguntar_documento_completo') return typeof comando.pergunta === 'string' && Boolean(comando.pergunta.trim());
  if (comando.tipo === 'aplicar_resposta' || comando.tipo === 'reenviar_mensagem') return typeof comando.mensagemId === 'string' && Boolean(comando.mensagemId);
  if (comando.tipo === 'navegar_evidencia') return blocoContextoIaValido(comando.evidencia);
  if (comando.tipo === 'cancelar_operacao'
    || comando.tipo === 'retomar_operacao'
    || comando.tipo === 'limpar_conversa'
    || comando.tipo === 'confirmar_execucao'
    || comando.tipo === 'cancelar_confirmacao'
    || comando.tipo === 'descrever_imagem'
    || comando.tipo === 'solicitar_ressincronizacao') return true;
  if (comando.tipo === 'selecionar_escopo') return Number.isInteger(comando.indice);
  return comando.tipo === 'selecionar_modelo' && typeof comando.modelo === 'string' && Boolean(comando.modelo.trim()) && comando.modelo.length <= 200;
}
