export type SituacaoProjetil = 'estimada' | 'personalizada';
export type MedidaProjetil = 'calibreRealMm' | 'alturaMaximaMm' | 'massaGramas';

export interface OrigemProjetil {
  fonte: string;
  localizacao: string;
  valoresOriginais?: Record<string, string | number | null>;
}

export interface ProjetilReferencia {
  id: string;
  calibre: string;
  tipo: string;
  sigla: string | null;
  massaGramas: number | null;
  calibreRealMinMm: number | null;
  calibreRealMaxMm: number | null;
  alturaMinMm: number | null;
  alturaMaxMm: number | null;
  situacao: SituacaoProjetil;
  fonte: string;
  localizacao: string;
  observacao?: string;
  origens?: OrigemProjetil[];
  motivoExclusaoClassificacao?: string;
  liga?: string;
  linha?: string;
  comprimentoEstojoMm?: number;
  massaNucleoGramas?: number;
  massaCamisaGramas?: number;
}

export interface ProjetilPersonalizadoEntrada {
  calibre: string;
  tipo: string;
  massaGramas: number;
  calibreRealMm: number | null;
  alturaMaximaMm: number | null;
}

export interface ConsultaProjetil {
  calibreRealMm: number | null;
  alturaMaximaMm: number | null;
  massaGramas: number | null;
  medidaPrioritaria: MedidaProjetil;
  perdaMaterial: boolean;
  limiteProximidadePercentual?: number;
  sigla: string | null;
}

export interface ComparacaoMedida {
  observado: number | null;
  referenciaMin: number | null;
  referenciaMax: number | null;
  diferenca: number | null;
  utilizada: boolean;
}

export interface ResultadoProjetil {
  projetil: ProjetilReferencia;
  calibreReal: ComparacaoMedida;
  altura: ComparacaoMedida;
  massa: ComparacaoMedida;
  medidasAusentes: MedidaProjetil[];
  medidasComparadas: MedidaProjetil[];
  medidasProximas: MedidaProjetil[];
  pontuacao: number | null;
  prioridadeAusente: boolean;
  grupoMassa: number;
}

export interface ProjetilIpcRenderer {
  listarPersonalizados: () => Promise<{ success: boolean; data?: ProjetilReferencia[]; error?: string }>;
  salvarPersonalizado: (dados: ProjetilPersonalizadoEntrada, id?: string) => Promise<{ success: boolean; data?: ProjetilReferencia; error?: string }>;
  excluirPersonalizado: (id: string) => Promise<{ success: boolean; error?: string }>;
  importarCsv: (texto: string) => Promise<{ success: boolean; data?: number; error?: string }>;
}
