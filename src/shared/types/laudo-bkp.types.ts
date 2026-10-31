import { z } from 'zod';

const identificador = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/);
const textoOpcional = z.string().nullish().transform(valor => valor ?? undefined);
const marcador = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform(Boolean);
const resposta = z.union([z.string(), z.array(z.string())]);
export const esquemaRespostasIncorporadas = z.record(z.string(), resposta);

const esquemaSecao = z.object({
  id: identificador, nome: z.string(), ordem: z.number().int(),
  parent_id: identificador.nullish(), conteudo: textoOpcional, condicao: textoOpcional,
  repetir_para: textoOpcional, repetir_titulo: textoOpcional,
  ocultar_titulo: z.number().int().min(0).max(1).default(0),
  contar_na_numeracao: z.number().int().min(0).max(1).default(1),
  chave_integrada: textoOpcional,
});
const esquemaEtapa = z.object({
  id: identificador, etapa_pai_id: identificador.nullable(), pergunta: z.string(),
  descricao_ajuda: textoOpcional, tipo_input: z.enum(['select', 'radio', 'checkbox', 'text', 'image']),
  nivel: z.number().int().nonnegative().max(50), ordem: z.number().int(),
  obrigatorio: marcador, multipla_escolha: marcador,
});
const esquemaOpcao = z.object({
  id: identificador, etapa_id: identificador, label: z.string(), valor: z.string(),
  etapa_filha_id: identificador.nullable(), ordem: z.number().int(),
});
const esquemaPeca = z.object({ id: identificador, nome: z.string(), conteudo: z.string(), descricao: textoOpcional });
const esquemaRegra = z.object({
  id: identificador, peca_id: identificador, secao_template_id: identificador.nullable(),
  condicoes: esquemaRespostasIncorporadas, ordem: z.number().int(),
});

export const esquemaEstruturaIncorporada = z.object({
  formato: z.literal(1),
  origem: z.object({ repId: identificador, laudoId: identificador }),
  template: z.object({ nome: z.string().min(1), descricao: textoOpcional, secoes: z.array(esquemaSecao).max(10000) }),
  wizard: z.object({
    id: identificador, nome: z.string(), etapas: z.array(esquemaEtapa).max(10000),
    opcoes: z.array(esquemaOpcao).max(20000), pecas: z.array(esquemaPeca).max(10000),
    regras: z.array(esquemaRegra).max(20000),
  }).nullable(),
}).superRefine((estrutura, contexto) => {
  const falhar = (mensagem: string) => contexto.addIssue({ code: 'custom', message: mensagem });
  const verificarIds = (itens: Array<{ id: string }>) => {
    const ids = new Set(itens.map(item => item.id));
    if (ids.size !== itens.length) falhar('Identificadores duplicados na estrutura incorporada.');
    return ids;
  };
  const secoes = verificarIds(estrutura.template.secoes);
  const paisSecoes = new Map(estrutura.template.secoes.map(secao => [secao.id, secao.parent_id]));
  const verificarPais = (pais: Map<string, string | null | undefined>) => {
    for (const inicio of pais.keys()) {
      const visitados = new Set<string>();
      let atual: string | null | undefined = inicio;
      while (atual) {
        if (!pais.has(atual) || visitados.has(atual) || visitados.size > 50) {
          falhar('Hierarquia inválida ou cíclica na estrutura incorporada.');
          break;
        }
        visitados.add(atual);
        atual = pais.get(atual);
      }
    }
  };
  verificarPais(paisSecoes);
  if (!estrutura.wizard) return;
  const wizard = estrutura.wizard;
  const etapas = verificarIds(wizard.etapas);
  const pecas = verificarIds(wizard.pecas);
  verificarIds(wizard.opcoes);
  verificarIds(wizard.regras);
  verificarPais(new Map(wizard.etapas.map(etapa => [etapa.id, etapa.etapa_pai_id])));
  for (const opcao of wizard.opcoes) {
    if (!etapas.has(opcao.etapa_id) || (opcao.etapa_filha_id && !etapas.has(opcao.etapa_filha_id))) falhar('Opção com etapa inexistente.');
  }
  const filhasPorEtapa = new Map<string, string[]>();
  for (const opcao of wizard.opcoes) {
    if (opcao.etapa_filha_id) filhasPorEtapa.set(opcao.etapa_id, [...(filhasPorEtapa.get(opcao.etapa_id) ?? []), opcao.etapa_filha_id]);
  }
  const concluidas = new Set<string>();
  const visitar = (id: string, caminho: Set<string>) => {
    if (concluidas.has(id)) return;
    if (caminho.has(id) || caminho.size > 50) { falhar('Ciclo nas opções do wizard.'); return; }
    const seguinte = new Set(caminho).add(id);
    for (const filha of filhasPorEtapa.get(id) ?? []) visitar(filha, seguinte);
    concluidas.add(id);
  };
  for (const id of etapas) visitar(id, new Set());
  for (const regra of wizard.regras) {
    if (!pecas.has(regra.peca_id) || (regra.secao_template_id && !secoes.has(regra.secao_template_id))
      || Object.keys(regra.condicoes).some(id => !etapas.has(id))) falhar('Regra com referência inexistente.');
  }
});

export type EstruturaIncorporadaLaudo = z.infer<typeof esquemaEstruturaIncorporada>;
export type RespostasIncorporadas = z.infer<typeof esquemaRespostasIncorporadas>;

export interface EtapaIncorporadaArvore {
  id: string;
  pergunta: string;
  descricao_ajuda?: string;
  tipo_input: 'select' | 'radio' | 'checkbox' | 'text' | 'image';
  nivel: number;
  ordem: number;
  obrigatorio: boolean;
  multipla_escolha: boolean;
  opcoes: Array<{ id: string; label: string; valor: string; ordem: number; etapa_filha?: EtapaIncorporadaArvore }>;
}

export interface ContextoWizardLaudo {
  wizard: { id: string; nome: string };
  etapas: EtapaIncorporadaArvore[];
}

export interface PecaIncorporadaCalculada {
  peca: { id: string; nome: string; conteudo: string; descricao?: string };
  secao_template_id: string | null;
  regra_id: string;
  ordem: number;
}

const textoNulo = z.string().nullable().optional().transform(valor => valor ?? null);
export const esquemaPacoteLaudo = z.object({
  formato: z.literal(1),
  rep: z.object({
    numero: z.string().trim().min(1).max(200), data_requisicao: z.string().min(1), status: z.string().min(1),
    prazo: textoNulo, tipo_solicitacao: textoNulo, numero_documento: textoNulo, data_documento: textoNulo,
    autoridade_solicitante: textoNulo, data_acionamento: textoNulo, data_chegada: textoNulo, data_saida: textoNulo,
    local_fato: textoNulo, latitude: z.number().finite().nullable().optional().transform(valor => valor ?? null),
    longitude: z.number().finite().nullable().optional().transform(valor => valor ?? null),
    observacoes: textoNulo, campos_especificos: textoNulo,
  }),
  tipoExame: z.object({ codigo: z.string().min(1), nome: z.string().min(1), descricao: textoNulo }),
  solicitante: z.object({ nome: z.string().min(1), tipo: z.string(), endereco: textoNulo, telefone: textoNulo, email: textoNulo }).nullable(),
  laudo: z.object({
    conteudo: z.string(), status: z.enum(['Em andamento', 'Concluído', 'Entregue']),
    data_inicio: z.string().min(1), data_conclusao: textoNulo, data_entrega: textoNulo,
    versao: z.number().int().positive(), tipo_criacao: z.enum(['template', 'wizard']),
    respostas: esquemaRespostasIncorporadas,
  }),
  estrutura: esquemaEstruturaIncorporada,
  placeholders: z.array(z.object({ chave: z.string().regex(/^[a-zA-Z0-9_.-]+$/).max(200), valor: z.string(), descricao: textoNulo })).max(10000),
  imagens: z.array(z.object({
    id: identificador, arquivo: z.string().regex(/^imagens\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|gif|bmp|webp)$/),
    nome_arquivo: z.string().max(500), mime_type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp']),
    tamanho: z.number().int().positive(), sha256: z.string().regex(/^[a-f0-9]{64}$/), legenda: z.string(),
    origem: z.enum(['local', 'gdl']), sequencia: z.number().int(), imagem_origem_id: identificador.nullable(),
    ajustes_json: textoNulo, disponivel_painel: z.number().int().min(0).max(1), created_at: z.string(),
  })).max(10000),
}).strict().superRefine((pacote, contexto) => {
  const falhar = (message: string) => contexto.addIssue({ code: 'custom', message });
  if (new Set(pacote.placeholders.map(item => item.chave)).size !== pacote.placeholders.length) falhar('Placeholders duplicados.');
  const imagens = new Map(pacote.imagens.map(imagem => [imagem.id, imagem]));
  if (imagens.size !== pacote.imagens.length || new Set(pacote.imagens.map(imagem => imagem.arquivo)).size !== pacote.imagens.length) falhar('Imagens duplicadas.');
  for (const imagem of pacote.imagens) {
    const visitadas = new Set<string>();
    let atual: typeof imagem | undefined = imagem;
    while (atual) {
      if (visitadas.has(atual.id)) { falhar('Ciclo nas imagens originais.'); break; }
      visitadas.add(atual.id);
      const origem: string | null = atual.imagem_origem_id;
      if (origem && !imagens.has(origem)) { falhar('Imagem original ausente.'); break; }
      atual = origem ? imagens.get(origem) : undefined;
    }
  }
  if (pacote.rep.campos_especificos) {
    try {
      const dados: unknown = JSON.parse(pacote.rep.campos_especificos);
      if (!dados || typeof dados !== 'object' || Array.isArray(dados)) falhar('Dados específicos da REP inválidos.');
    } catch { falhar('JSON dos dados específicos inválido.'); }
  }
});

export type PacoteLaudo = z.infer<typeof esquemaPacoteLaudo>;

export interface PreviaBkpLaudo {
  numeroRep: string;
  tipoExame: string;
  status: string;
  figuras: number;
  substituiRep: boolean;
  substituiLaudo: boolean;
  bloqueio?: string;
}
export interface RespostaBkpLaudo<T = undefined> {
  success: boolean;
  canceled?: boolean;
  error?: string;
  data?: T;
}

export interface SelecaoBkpLaudo { selecaoId: string; nomeArquivo: string }
export interface AnaliseBkpLaudo { operacaoId: string; previa: PreviaBkpLaudo }
export interface ApiBkpLaudo {
  exportarBkp: (laudoId: string) => Promise<RespostaBkpLaudo>;
  selecionarBkp: () => Promise<RespostaBkpLaudo<SelecaoBkpLaudo>>;
  analisarBkp: (selecaoId: string) => Promise<RespostaBkpLaudo<AnaliseBkpLaudo>>;
  importarBkp: (operacaoId: string, confirmarSubstituicao: boolean) => Promise<RespostaBkpLaudo<{ laudoId: string }>>;
  cancelarBkp: (id: string) => Promise<RespostaBkpLaudo>;
}
