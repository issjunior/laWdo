export type SituacaoProjetil = 'confirmada' | 'estimada' | 'personalizada';

export interface ProjetilReferencia {
  id: string;
  calibre: string;
  tipo: string;
  massaGramas: number;
  diametroMinMm: number | null;
  diametroMaxMm: number | null;
  comprimentoMinMm: number | null;
  comprimentoMaxMm: number | null;
  situacao: SituacaoProjetil;
}

export type ProjetilPersonalizadoEntrada = Omit<ProjetilReferencia, 'id' | 'situacao'>;

export interface ConsultaProjetil {
  massaGramas: number | null;
  diametroMinMm: number | null;
  diametroMaxMm: number | null;
  comprimentoMinMm: number | null;
  comprimentoMaxMm: number | null;
}

export interface ResultadoProjetil {
  projetil: ProjetilReferencia;
  compatibilidade: 'compativel' | 'parcial';
  diametro: 'coincide' | 'ausente' | 'nao_informado';
  comprimento: 'coincide' | 'ausente' | 'nao_informado';
  diferencaMassaGramas: number | null;
}

export interface ProjetilIpcRenderer {
  listarPersonalizados: () => Promise<{ success: boolean; data?: ProjetilReferencia[]; error?: string }>;
  salvarPersonalizado: (dados: ProjetilPersonalizadoEntrada, id?: string) => Promise<{ success: boolean; data?: ProjetilReferencia; error?: string }>;
  excluirPersonalizado: (id: string) => Promise<{ success: boolean; error?: string }>;
  importarCsv: (texto: string) => Promise<{ success: boolean; data?: number; error?: string }>;
}
