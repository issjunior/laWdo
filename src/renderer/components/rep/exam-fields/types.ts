import type { UseFormReturn } from 'react-hook-form';

export interface REPFormData {
  numero: string;
  solicitante_id: string;
  tipo_exame_id: string;
  template_id: string;
  data_requisicao: string;
  tipo_solicitacao: string;
  numero_documento: string;
  data_documento: string;
  autoridade_solicitante: string;
  nome_envolvido: string;
  data_acionamento: string;
  data_chegada: string;
  data_saida: string;
  local_fato: string;
  latitude: string;
  longitude: string;
  lacre_entrada: string;
  lacre_saida: string;
  numero_bo: string;
  numero_ip: string;
  observacoes: string;
  numeracao_veiculo: string;
  numeracao_placa: string;
  numeracao_fabricacao: string;
  numeracao_cor: string;
  numeracao_conservacao: string;
  numeracao_chassi: string;
  numeracao_chassi_revelado: string;
  numeracao_motor: string;
  numeracao_motor_revelado: string;
}

export interface ExamSectionProps {
  form: UseFormReturn<REPFormData>;
  mostrarPlaceholders: boolean;
}

export interface ExamSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  description: string;
  component: React.FC<ExamSectionProps>;
  group?: string;
}
