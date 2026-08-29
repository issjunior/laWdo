export type EstadoAtualizacao =
  | 'ociosa'
  | 'verificando'
  | 'disponivel'
  | 'baixando'
  | 'baixada'
  | 'aguardando_reinicio'
  | 'instalando'
  | 'concluida'
  | 'falhou';

export type EtapaProgressoAtualizacao =
  | 'verificando'
  | 'baixando'
  | 'validando'
  | 'copiando'
  | 'confirmando'
  | 'backup'
  | 'agendando'
  | 'abrindo_instalador';

export interface ProgressoAtualizacao {
  percentual: number;
  etapa: EtapaProgressoAtualizacao;
  descricao: string;
}

export type PlataformaAtualizacao = 'windows' | 'linux' | 'macos';
export type ArquiteturaAtualizacao = 'x64' | 'arm64';
export type FormatoAtualizacao = 'nsis' | 'AppImage' | 'deb' | 'dmg' | 'zip';

export interface ArtefatoAtualizacao {
  plataforma: PlataformaAtualizacao;
  arquitetura: ArquiteturaAtualizacao;
  formato: FormatoAtualizacao;
  canal: 'stable' | 'experimental';
  nome: string;
  tamanho: number;
  hashSha256: string;
  url: string;
}

export interface ManifestoAtualizacao {
  versaoManifesto: 1;
  versao: string;
  commit: string;
  dataPublicacao: string;
  canais: Array<'stable' | 'experimental'>;
  versaoSchema: number;
  requerBackupCompletoImagens: boolean;
  notas: string;
  artefatos: ArtefatoAtualizacao[];
}

export interface AtualizacaoDisponivel {
  versao: string;
  dataPublicacao: string;
  notas: string;
  versaoSchema: number;
  requerBackupCompletoImagens: boolean;
  artefato: ArtefatoAtualizacao;
}

export interface EstadoAtualizacaoResposta {
  estado: EstadoAtualizacao;
  versaoInstalada: string;
  atualizacaoDisponivel?: AtualizacaoDisponivel;
  caminhoDownload?: string;
  progresso?: number;
  progressoDetalhado?: ProgressoAtualizacao;
  erro?: string;
  verificadoEm?: string;
}

export interface RespostaAtualizacao {
  success: boolean;
  data: EstadoAtualizacaoResposta;
  error?: string;
}
