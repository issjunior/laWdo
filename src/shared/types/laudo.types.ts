export interface LaudoResumoLista {
  id: string;
  rep_id: string;
  perito_id: string;
  template_id: string;
  status: string;
  data_inicio: string;
  data_conclusao?: string;
  data_entrega?: string;
  updated_at?: string;
  tipo_criacao?: string;
  wizard_id?: string;
  rep_numero: string;
  template_nome: string;
  status_rep: string;
  tipo_exame_nome?: string;
  tipo_exame_codigo?: string;
  nome_envolvido?: string;
  data_requisicao?: string;
  tipo_solicitacao?: string;
  numero_documento?: string;
}

export interface LaudoConteudo {
  id: string;
  conteudo: string;
  apresentacao_json?: string | null;
}
