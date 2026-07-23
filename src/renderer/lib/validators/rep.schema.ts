export interface REP {
  id: string;
  numero: string;
  solicitante_id?: string | null;
  tipo_exame_id?: string | null;
  data_requisicao: string;
  prazo?: string | null;
  status: string;
  tipo_solicitacao: string;
  numero_documento: string;
  data_documento?: string | null;
  autoridade_solicitante?: string | null;
  data_acionamento?: string | null;
  data_chegada?: string | null;
  data_saida?: string | null;
  local_fato?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  usuario_id?: string | null;
  observacoes?: string | null;
  campos_especificos?: string | null;
  created_at: string;
  updated_at: string;
}
