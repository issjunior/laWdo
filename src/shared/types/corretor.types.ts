export interface EstadoCorretor {
  ativo: boolean;
  disponivel: boolean;
  palavras: string[];
}

export type RespostaCorretor =
  | { success: true; data: EstadoCorretor }
  | { success: false; error: string };

export interface SugestoesCorretor {
  palavra: string;
  sugestoes: string[];
}

export interface ApiCorretor {
  obter: () => Promise<RespostaCorretor>;
  configurar: (ativo: boolean) => Promise<RespostaCorretor>;
  adicionar: (palavra: string) => Promise<RespostaCorretor>;
  remover: (palavra: string) => Promise<RespostaCorretor>;
  onSugestoes: (callback: (dados: SugestoesCorretor) => void) => () => void;
}
