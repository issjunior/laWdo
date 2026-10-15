export interface SecaoCompletaTemplateInput {
  id?: string;
  chave_local: string;
  nome: string;
  parent_id?: string | null;
  conteudo?: string | null;
  condicao?: string | null;
  repetir_para?: string | null;
  repetir_titulo?: string | null;
  ocultar_titulo?: boolean;
  contar_na_numeracao?: boolean;
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

export interface CriarSecaoTemplateInput extends Omit<SecaoCompletaTemplateInput, 'id' | 'chave_local'> {
  template_id: string;
  ordem: number;
}

export type AtualizarSecaoTemplateInput = Partial<Omit<CriarSecaoTemplateInput, 'template_id'>>;
