export interface TipoExamePacoteTemplate {
  codigo: string;
  nome: string;
  descricao?: string | null;
}

export interface SecaoPacoteTemplate {
  id_origem: string;
  parent_id_origem?: string | null;
  nome: string;
  ordem: number;
  conteudo?: string | null;
  condicao?: string | null;
  repetir_para?: string | null;
  repetir_titulo?: string | null;
}

export interface PacoteTemplate {
  template: { nome: string; descricao?: string | null };
  tipo_exame: TipoExamePacoteTemplate;
  secoes: SecaoPacoteTemplate[];
}

export interface PreviaPacoteTemplate extends PacoteTemplate {
  caminho: string;
  tipoExameExiste: boolean;
}
