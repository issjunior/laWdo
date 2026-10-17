import { CATALOGO_TIPOS_PECA_B601 } from '@shared/catalogos/b601.catalogo';
import { ehAgrupamentoB601 } from '@shared/utils/b601-descricao-agrupada';
export interface SecaoTemplateEstrutural {
  id?: string;
  chave_local: string;
  nome: string;
  parent_id?: string;
  condicao?: string;
  repetir_para?: string;
  repetir_titulo?: string;
  ocultar_titulo?: boolean;
  contar_na_numeracao?: boolean;
  conteudo?: string;
}

export interface ToggleTemplateOption {
  id: string;
  label: string;
}

export interface OpcaoSecaoPai {
  value: string;
  label: string;
}

export interface DiagnosticoSecaoTemplate {
  tipo: 'erro' | 'aviso';
  mensagem: string;
}

interface ConfiguracaoTemplateExame {
  opcoesRepeticao: Array<{ value: string; label: string }>;
  tituloPadraoArmas?: string;
  ajudaRepeticao: string;
}

const TITULO_PADRAO_REPETICAO_ARMAS = 'ARMA {{b602_arma_1_letra}} - {{b602_arma_1_tipo}} {{b602_arma_1_marca}} {{b602_arma_1_modelo}}';

const CONFIGURACAO_PADRAO: ConfiguracaoTemplateExame = {
  opcoesRepeticao: [],
  ajudaRepeticao: 'Use repetição apenas quando o exame tiver blocos derivados da REP.',
};

const CONFIGURACOES_POR_EXAME: Record<string, ConfiguracaoTemplateExame> = {
  'B-601': {
    opcoesRepeticao: [
      { value: 'b601_agrupados:105', label: 'Tabela conjunta de projéteis' },
      { value: 'b601_agrupados:101', label: 'Tabela conjunta de estojos' },
      { value: 'b601_pecas', label: 'Peças sem modelo específico' },
      ...CATALOGO_TIPOS_PECA_B601.map(tipo => ({ value: 'b601_pecas:' + tipo.codigo, label: 'Uma seção por peça: ' + tipo.label })),
    ],
    ajudaRepeticao: 'As tabelas conjuntas descrevem as quantidades em UNIDADES. Projéteis e estojos em outras medidas recebem blocos manuais nas respectivas subseções. O modelo genérico atende os demais materiais.',
  },
  'B-602': {
    opcoesRepeticao: [{ value: 'armas', label: 'Uma seção por arma' }],
    tituloPadraoArmas: TITULO_PADRAO_REPETICAO_ARMAS,
    ajudaRepeticao: 'Cada arma da REP gera um bloco próprio abaixo desta subseção.',
  },
};

function removerTags(html?: string): string {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function encontrarLabelPai(parentId: string | undefined, opcoesSecaoPai: OpcaoSecaoPai[]): string | null {
  if (!parentId) return null;
  return opcoesSecaoPai.find(opcao => opcao.value === parentId)?.label || null;
}

function getConfiguracaoTemplateExame(tipoExameCodigo?: string): ConfiguracaoTemplateExame {
  if (!tipoExameCodigo) return CONFIGURACAO_PADRAO;
  return CONFIGURACOES_POR_EXAME[tipoExameCodigo] || CONFIGURACAO_PADRAO;
}

export function getOpcoesRepeticaoTemplate(tipoExameCodigo?: string) {
  return getConfiguracaoTemplateExame(tipoExameCodigo).opcoesRepeticao;
}

function suportaRepeticaoPorArma(tipoExameCodigo?: string): boolean {
  return getOpcoesRepeticaoTemplate(tipoExameCodigo).some(opcao => opcao.value === 'armas');
}

export function getTituloPadraoRepeticao(secao: Pick<SecaoTemplateEstrutural, 'repetir_para'>, tipoExameCodigo?: string): string {
  if (/^b601_pecas(?::\d+)?$/.test(secao.repetir_para || '')) return 'PEÇA {{b601_peca_1_letra}} — {{b601_peca_1_tipo}}';
  if (secao.repetir_para !== 'armas') return '';
  return getConfiguracaoTemplateExame(tipoExameCodigo).tituloPadraoArmas || '';
}

function getLabelVisibilidade(condicao: string | undefined, toggles: ToggleTemplateOption[] = []): string {
  if (!condicao) return 'Sempre mostrar';

  try {
    const valor = JSON.parse(condicao) as { campo?: string };
    const toggle = toggles.find(item => item.id === valor.campo);
    if (toggle) return `Mostrar quando ${toggle.label}`;
  } catch {
    return 'Mostrar conforme condição configurada';
  }

  return 'Mostrar conforme condição configurada';
}

function getLabelEstrutura(secao: Pick<SecaoTemplateEstrutural, 'parent_id'>, opcoesSecaoPai: OpcaoSecaoPai[]): string {
  const labelPai = encontrarLabelPai(secao.parent_id, opcoesSecaoPai);
  return labelPai ? `Subseção de ${labelPai}` : 'Seção principal';
}

function getLabelRepeticao(secao: Pick<SecaoTemplateEstrutural, 'repetir_para'>): string {
  if (ehAgrupamentoB601(secao.repetir_para)) return 'Tabela conjunta por quantidade';
  if ((secao.repetir_para || '').startsWith('b601_pecas')) return 'Uma seção por peça';
  if (secao.repetir_para === 'armas') return 'Uma seção por arma';
  return 'Conteúdo único';
}

export function getResumoConfiguracaoSecao(
  secao: Pick<SecaoTemplateEstrutural, 'parent_id' | 'condicao' | 'repetir_para'>,
  opcoesSecaoPai: OpcaoSecaoPai[],
  toggles: ToggleTemplateOption[] = [],
): string {
  return [
    getLabelVisibilidade(secao.condicao, toggles),
    getLabelEstrutura(secao, opcoesSecaoPai).toLowerCase(),
    getLabelRepeticao(secao).toLowerCase(),
  ].join(' · ');
}

export function getAjudaConfiguracaoSecao(
  secao: Pick<SecaoTemplateEstrutural, 'parent_id' | 'repetir_para'>,
  tipoExameCodigo?: string,
) {
  return {
    visibilidade: 'Escolha se a seção aparece sempre ou só quando um bloco da REP estiver ativo.',
    estrutura: secao.parent_id
      ? 'Subseções ficam dentro de uma seção principal. A hierarquia atual vai até subseção.'
      : 'Seções principais viram títulos numerados do laudo.',
    repeticao: secao.repetir_para === 'armas'
      ? 'O conteúdo desta subseção será replicado para cada arma informada na REP.'
      : getConfiguracaoTemplateExame(tipoExameCodigo).ajudaRepeticao,
  };
}

export function validarConfiguracaoSecaoTemplate(
  secao: Pick<SecaoTemplateEstrutural, 'parent_id' | 'repetir_para' | 'repetir_titulo' | 'conteudo'>,
  tipoExameCodigo?: string,
): DiagnosticoSecaoTemplate[] {
  const diagnosticos: DiagnosticoSecaoTemplate[] = [];
  if (ehAgrupamentoB601(secao.repetir_para)) {
    if (tipoExameCodigo !== 'B-601' || !secao.parent_id) diagnosticos.push({ tipo: 'erro', mensagem: 'A tabela conjunta deve ser uma subseção do exame B-601.' });
    return diagnosticos;
  }
  if ((secao.repetir_para || '').startsWith('b601_pecas')) {
    if (tipoExameCodigo !== 'B-601' || !getOpcoesRepeticaoTemplate(tipoExameCodigo).some(opcao => opcao.value === secao.repetir_para)) diagnosticos.push({ tipo: 'erro', mensagem: 'Selecione uma repetição válida do B-601.' });
    if (!secao.parent_id) diagnosticos.push({ tipo: 'erro', mensagem: 'A repetição por peça precisa ficar dentro de uma seção principal.' });
    if (!secao.repetir_titulo?.trim()) diagnosticos.push({ tipo: 'erro', mensagem: 'Informe o título de cada peça.' });
    return diagnosticos;
  }

  if (secao.repetir_para !== 'armas') {
    return diagnosticos;
  }

  if (!suportaRepeticaoPorArma(tipoExameCodigo)) {
    diagnosticos.push({
      tipo: 'erro',
      mensagem: 'Uma seção por arma só está disponível para templates do exame B-602.',
    });
  }

  if (!secao.parent_id) {
    diagnosticos.push({
      tipo: 'erro',
      mensagem: 'Uma seção por arma precisa ficar dentro de uma seção principal.',
    });
  }

  if (!(secao.repetir_titulo || '').trim()) {
    diagnosticos.push({
      tipo: 'erro',
      mensagem: 'Informe o título usado em cada bloco repetido por arma.',
    });
  }

  if ((secao.repetir_titulo || '').trim() && !/\{\{[^}]*_1_[^}]*\}\}/.test(secao.repetir_titulo || '')) {
    diagnosticos.push({
      tipo: 'aviso',
      mensagem: 'O título de cada arma deve usar placeholders com `_1_` para variar por item.',
    });
  }

  const conteudoSemTags = removerTags(secao.conteudo);
  const tituloSemTags = removerTags(secao.repetir_titulo);
  if (conteudoSemTags && tituloSemTags && conteudoSemTags.includes(tituloSemTags)) {
    diagnosticos.push({
      tipo: 'aviso',
      mensagem: 'O conteúdo parece repetir o mesmo padrão do título de cada arma. Revise para evitar duplicação no laudo.',
    });
  }

  return diagnosticos;
}
