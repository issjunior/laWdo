import { opcoesCalibreNominalCartucho, opcoesMarcaCartucho, opcoesOrigemColeta } from './balistica-opcoes.catalogo.js';
import { CATALOGO_TIPOS_PECA_B601, OPCOES_TIPO_PROJETIL_B601, OPCOES_TIPO_RAIAMENTO_B601 } from './b601.catalogo.js';
import { catalogoProjeteis } from './projeteis.catalogo.js';
import { criarOpcoesFormatoProjetil } from '../utils/formato-projetil.js';

export const VERSAO_CAMPOS_TABELA_B601 = '1';
export const VALOR_MANUAL_TABELA_B601 = '__manual__';

type FonteOpcoes = 'origem' | 'tipo' | 'formato' | 'calibre_projetil' | 'raiamento' | 'marca' | 'calibre_estojo' | 'revestimento' | 'aderencias';
export interface CampoTabelaB601 {
  chave: string;
  rotulo: string;
  fonte?: FonteOpcoes;
  aceitaTextoLivre?: boolean;
}
export interface FormatoPersonalizadoB601 { tipo: string; sigla: string | null; calibre?: string }

const origem: CampoTabelaB601 = { chave: 'origem', rotulo: 'Origem', fonte: 'origem' };
export const CAMPOS_PROJETEIS_B601: readonly CampoTabelaB601[] = [
  origem,
  { chave: 'tipo', rotulo: 'Tipo', fonte: 'tipo' },
  { chave: 'constituicao_formato', rotulo: 'Constituição e formato', fonte: 'formato' },
  { chave: 'massa', rotulo: 'Massa (g)' },
  { chave: 'diametro', rotulo: 'Diâmetro médio (mm)' },
  { chave: 'altura', rotulo: 'Altura (mm)' },
  { chave: 'calibre_nominal_provavel', rotulo: 'Calibre nominal (provável)', fonte: 'calibre_projetil', aceitaTextoLivre: true },
  { chave: 'cavados_ressaltos', rotulo: 'Cavados e Ressaltos' },
  { chave: 'raiamento_orientacao', rotulo: 'Raiamento e Orientação' },
  { chave: 'tipo_raiamento', rotulo: 'Tipo de Raiamento', fonte: 'raiamento' },
  { chave: 'deformacoes', rotulo: 'Deformações Acidentais' },
  { chave: 'aderencias', rotulo: 'Aderências', fonte: 'aderencias', aceitaTextoLivre: true },
];
export const CAMPOS_ESTOJOS_B601: readonly CampoTabelaB601[] = [
  origem,
  { chave: 'marca', rotulo: 'Marca', fonte: 'marca' },
  { chave: 'calibre_nominal', rotulo: 'Calibre nominal', fonte: 'calibre_estojo' },
  { chave: 'composicao', rotulo: 'Composição do estojo', fonte: 'revestimento' },
  { chave: 'espoleta', rotulo: 'Espoleta', fonte: 'revestimento' },
  { chave: 'observacoes', rotulo: 'Observações' },
];

export function obterCampoTabelaB601(tipo: string | null, chave: string | null): CampoTabelaB601 | undefined {
  return (tipo === '105' ? CAMPOS_PROJETEIS_B601 : tipo === '101' ? CAMPOS_ESTOJOS_B601 : [])
    .find(campo => campo.chave === chave);
}

export function normalizarOpcoesTabelaB601(opcoes: readonly { texto: string; valor: string }[], chave: string) {
  const comparar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ');
  const frase = (valor: string) => valor.charAt(0).toLocaleUpperCase('pt-BR') + valor.slice(1).toLocaleLowerCase('pt-BR');
  const naturais = chave === 'origem' ? opcoesOrigemColeta.map(opcao => opcao.label)
    : chave === 'tipo' ? [...CATALOGO_TIPOS_PECA_B601.map(opcao => opcao.label), ...OPCOES_TIPO_PROJETIL_B601.map(opcao => opcao.valor)]
    : chave === 'tipo_raiamento' ? [...OPCOES_TIPO_RAIAMENTO_B601]
    : chave === 'aderencias' ? ['Caliça', 'Material biológico'] : [];
  const canonicos = new Map(naturais.map(valor => [comparar(valor), frase(valor).replace('gillete', 'Gillete')]));
  for (const valor of ['Prejudicado', 'Ausente', 'Não aparente']) canonicos.set(comparar(valor), valor);
  const normalizar = (valor: string) => canonicos.get(comparar(valor)) ?? valor.charAt(0).toLocaleUpperCase('pt-BR') + valor.slice(1);
  const unicas = new Map<string, { texto: string; valor: string }>();
  for (const opcao of opcoes) {
    if (opcao.valor === 'XXX') continue;
    const valor = opcao.valor === VALOR_MANUAL_TABELA_B601 ? opcao.valor : normalizar(opcao.valor);
    const texto = opcao.valor === VALOR_MANUAL_TABELA_B601 ? opcao.texto : normalizar(opcao.texto);
    const identidade = comparar(valor);
    if (!unicas.has(identidade)) unicas.set(identidade, { texto, valor });
  }
  return [...unicas.values()];
}

export function obterOpcoesCampoTabelaB601(campo: CampoTabelaB601, personalizados: readonly FormatoPersonalizadoB601[] = [], atual = '') {
  const simples = (valores: readonly string[]) => valores.map(valor => ({ texto: valor, valor }));
  const siglas = [...new Set([...catalogoProjeteis.flatMap(item => item.sigla ? [item.sigla] : []),
    ...personalizados.flatMap(item => item.sigla ? [item.sigla] : [])])];
  let opcoes: { texto: string; valor: string }[] = [];
  switch (campo.fonte) {
    case 'origem': opcoes = simples(opcoesOrigemColeta.map(opcao => opcao.label)); break;
    case 'tipo': opcoes = simples(OPCOES_TIPO_PROJETIL_B601.map(opcao => opcao.valor)); break;
    case 'raiamento': opcoes = simples(OPCOES_TIPO_RAIAMENTO_B601); break;
    case 'marca': opcoes = simples(opcoesMarcaCartucho.map(opcao => opcao.label)); break;
    case 'calibre_estojo': opcoes = simples(opcoesCalibreNominalCartucho.map(opcao => opcao.label)); break;
    case 'revestimento': opcoes = simples(['Latonado', 'Niquelado']); break;
    case 'aderencias': opcoes = simples(['Caliça', 'Material biológico']); break;
    case 'formato': opcoes = criarOpcoesFormatoProjetil(siglas, personalizados.map(item => item.tipo), atual)
      .map(opcao => ({ texto: opcao.rotulo, valor: opcao.valor })); break;
    case 'calibre_projetil': {
      const calibres = new Map<string, string>();
      for (const bruto of [...catalogoProjeteis.map(item => item.calibre), ...personalizados.map(item => item.calibre || '')]) {
        const valor = bruto.trim();
        const chave = valor.replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
        if (valor && !calibres.has(chave)) calibres.set(chave, valor);
      }
      opcoes = simples([...calibres.values()].sort((a, b) => a.localeCompare(b, 'pt-BR')));
      break;
    }
  }
  opcoes = opcoes.filter(opcao => opcao.valor.trim().toLocaleLowerCase('pt-BR') !== 'prejudicado' && opcao.valor !== VALOR_MANUAL_TABELA_B601);
  if (atual && atual !== 'XXX' && atual !== VALOR_MANUAL_TABELA_B601 && atual !== 'Prejudicado' && !opcoes.some(opcao => opcao.valor === atual)) {
    opcoes.unshift({ texto: atual, valor: atual });
  }
  return [...opcoes, { texto: 'Prejudicado', valor: 'Prejudicado' }, { texto: 'Preenchimento manual…', valor: VALOR_MANUAL_TABELA_B601 }];
}
