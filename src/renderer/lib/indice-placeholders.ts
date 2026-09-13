import type { MapaPlaceholdersResolvidos, ValorPlaceholderResolvido } from '@/lib/exportacao-placeholders';
import { CAMPOS_ESPECIFICOS_PLACEHOLDERS } from '@/components/rep/exam-fields/placeholders';

export interface MetadadoPlaceholderIndice {
  chave: string;
  descricao?: string | null;
}

export interface TabelaIndicePlaceholder {
  linhas: CelulaIndicePlaceholder[][];
}

export type AlinhamentoCelulaIndice = 'left' | 'center' | 'right' | 'justify';

export interface CelulaIndicePlaceholder {
  valor: string;
  alinhamento: AlinhamentoCelulaIndice;
}

export interface ItemIndicePlaceholder {
  chave: string;
  campoFormulario: string;
  valor: string;
  preenchido: boolean;
  tabela?: TabelaIndicePlaceholder;
}

const CAMPOS_REP_PADRAO: Record<string, string> = {
  rep_numero: 'Número da REP',
  numero_rep: 'Número da REP',
  rep_data_requisicao: 'Data de recebimento da REP',
  data_recebimento_rep: 'Data de recebimento da REP',
  rep_prazo: 'Prazo da REP',
  rep_tipo_solicitacao: 'Tipo de solicitação',
  tipo_solicitacao_rep: 'Tipo de solicitação',
  rep_numero_documento: 'Número do documento',
  numero_solicitacao_rep: 'Número do documento',
  rep_data_documento: 'Data do documento',
  data_solicitacao_rep: 'Data do documento',
  rep_data_acionamento: 'Data/hora do acionamento',
  data_acionamento_local: 'Data/hora do acionamento',
  rep_data_chegada: 'Data/hora de chegada',
  data_chegada_local: 'Data/hora de chegada',
  rep_data_saida: 'Data/hora de saída',
  data_saida_local: 'Data/hora de saída',
  rep_observacoes: 'Observações da REP',
  observacoes_rep: 'Observações da REP',
  'rep.numero': 'Número da REP',
  'rep.documento': 'Número do documento',
  'rep.local': 'Local do fato',
  'rep.data': 'Data de recebimento da REP',
  'rep.autoridade': 'Autoridade solicitante',
  'rep.requisicao': 'Número do documento',
  local_fato: 'Local do fato',
  latitude: 'Latitude do local',
  longitude: 'Longitude do local',
  autoridade_solicitante_rep: 'Autoridade solicitante',
  solicitante_nome: 'Órgão solicitante',
  tipo_exame_nome: 'Tipo de exame',
  tipo_exame_codigo: 'Código do tipo de exame',
  perito_nome: 'Nome do perito',
  perito_cargo: 'Cargo do perito',
  perito_lotacao: 'Lotação do perito',
  perito_matricula: 'Matrícula do perito',
  'perito.nome': 'Nome do perito',
  'perito.cargo': 'Cargo do perito',
  'perito.especialidade': 'Especialidade do perito',
  data_atual: 'Data atual do sistema',
  data_extenso_recebimento_rep: 'Data de recebimento por extenso',
};

function obterCampoFormulario(chave: string, metadados: MetadadoPlaceholderIndice[]): string {
  const campoEspecifico = CAMPOS_ESPECIFICOS_PLACEHOLDERS.find(campo => campo.chave === chave);
  if (campoEspecifico) return campoEspecifico.label;

  const campoIndexado = CAMPOS_ESPECIFICOS_PLACEHOLDERS.find(campo => {
    if (!campo.chave.includes('_N_')) return false;
    const padrao = new RegExp(`^${campo.chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('_N_', '_(\\d+)_')}$`);
    return padrao.test(chave);
  });
  if (campoIndexado) {
    const indice = chave.match(/_arma_(\d+)_/)?.[1];
    return indice ? `${campoIndexado.label} · Arma ${indice}` : campoIndexado.label;
  }

  if (CAMPOS_REP_PADRAO[chave]) return CAMPOS_REP_PADRAO[chave];
  return metadados.find(placeholder => placeholder.chave === chave)?.descricao || 'Campo não identificado';
}

function normalizarTexto(valor: string | null | undefined): string {
  return (valor || '').replace(/\s+/g, ' ').trim();
}

function obterAlinhamentoCelula(celula: HTMLElement): AlinhamentoCelulaIndice {
  let elemento: HTMLElement | null = celula;
  while (elemento) {
    const alinhamento = (elemento.style.textAlign || elemento.getAttribute('align') || '').toLowerCase();
    if (alinhamento === 'center' || alinhamento === 'right' || alinhamento === 'justify' || alinhamento === 'left') {
      return alinhamento;
    }
    elemento = elemento.parentElement;
  }
  return 'left';
}

function extrairTabela(html: string): TabelaIndicePlaceholder | undefined {
  try {
    const tabela = new DOMParser().parseFromString(html, 'text/html').querySelector('table');
    if (!tabela) return undefined;

    const linhas = Array.from(tabela.querySelectorAll('tr'))
      .map(linha => Array.from(linha.querySelectorAll<HTMLTableCellElement>(':scope > th, :scope > td'))
        .map(celula => ({
          valor: normalizarTexto(celula.textContent),
          alinhamento: obterAlinhamentoCelula(celula),
        })))
      .filter(linha => linha.length > 0);

    return linhas.length > 0 ? { linhas } : undefined;
  } catch {
    return undefined;
  }
}

function textoDoHtml(html: string): string {
  try {
    return normalizarTexto(new DOMParser().parseFromString(html, 'text/html').body.textContent);
  } catch {
    return normalizarTexto(html);
  }
}

function obterChaveBruta(valor: string | null): string | undefined {
  const correspondencia = valor?.match(/^\{\{([^{}]+)\}\}$/);
  return correspondencia?.[1]?.trim() || undefined;
}

function obterValor(
  chave: string,
  valores: MapaPlaceholdersResolvidos,
  metadados: MetadadoPlaceholderIndice[],
  tabelaPersonalizada?: string,
): ItemIndicePlaceholder {
  const campoFormulario = obterCampoFormulario(chave, metadados);
  if (tabelaPersonalizada) {
    const tabela = extrairTabela(tabelaPersonalizada);
    return {
      chave,
      campoFormulario,
      valor: tabela ? '' : textoDoHtml(tabelaPersonalizada),
      preenchido: Boolean(tabela || textoDoHtml(tabelaPersonalizada)),
      tabela,
    };
  }

  const resolvido: ValorPlaceholderResolvido | undefined = valores[chave];
  if (!resolvido?.preenchido) return { chave, campoFormulario, valor: '', preenchido: false };

  const tabela = resolvido.formato === 'html' ? extrairTabela(resolvido.valor) : undefined;
  return {
    chave,
    campoFormulario,
    valor: tabela ? '' : (resolvido.formato === 'texto' ? resolvido.valor : textoDoHtml(resolvido.valor)),
    preenchido: true,
    tabela,
  };
}

export function extrairIndicePlaceholders(
  conteudosHtml: string[],
  valores: MapaPlaceholdersResolvidos,
  metadados: MetadadoPlaceholderIndice[] = [],
): ItemIndicePlaceholder[] {
  const itens: ItemIndicePlaceholder[] = [];
  const chavesEncontradas = new Set<string>();

  const adicionar = (chave: string, tabelaPersonalizada?: string) => {
    if (!chave || chavesEncontradas.has(chave)) return;
    chavesEncontradas.add(chave);
    itens.push(obterValor(chave, valores, metadados, tabelaPersonalizada));
  };

  for (const html of conteudosHtml) {
    try {
      const documento = new DOMParser().parseFromString(html, 'text/html');
      documento.querySelectorAll('script, style, [data-placeholder-preview="true"]').forEach(elemento => elemento.remove());

      const tabelasPersonalizadas = new Map<string, string>();
      documento.querySelectorAll<HTMLElement>('[data-placeholder-tabela-personalizada="true"]').forEach(tabela => {
        const identificador = tabela.getAttribute('data-placeholder-tabela-personalizada-id');
        if (identificador) tabelasPersonalizadas.set(identificador, tabela.innerHTML);
      });

      documento.querySelectorAll<HTMLElement>('[data-placeholder]').forEach(ancora => {
        const chave = obterChaveBruta(ancora.getAttribute('data-placeholder'));
        const identificador = ancora.getAttribute('data-placeholder-tabela-personalizada-id');
        adicionar(chave || '', identificador ? tabelasPersonalizadas.get(identificador) : undefined);
      });

      const texto = documento.body.textContent || '';
      for (const correspondencia of texto.matchAll(/\{\{([^{}]+)\}\}/g)) {
        adicionar(correspondencia[1].trim());
      }
    } catch {
      for (const correspondencia of html.matchAll(/\{\{([^{}]+)\}\}/g)) {
        adicionar(correspondencia[1].trim());
      }
    }
  }

  return itens;
}
