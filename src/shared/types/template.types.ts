export interface SecaoCompletaTemplateInput {
  id?: string;
  chave_local: string;
  nome: string;
  parent_id?: string | null;
  conteudo?: string | null;
  condicao?: string | null;
  repetir_para?: string | null;
  repetir_titulo?: string | null;
}

export interface SalvarTemplateCompletoInput {
  id?: string;
  nome: string;
  tipo_exame_id: string;
  descricao?: string | null;
  importado_de_documento?: boolean;
  secoes: SecaoCompletaTemplateInput[];
}

export interface TemplateSalvo {
  id: string;
  nome: string;
  tipo_exame_id: string | null;
}

export interface RespostaSalvarTemplateCompleto {
  success: boolean;
  data?: TemplateSalvo;
  error?: string;
  message?: string;
}
