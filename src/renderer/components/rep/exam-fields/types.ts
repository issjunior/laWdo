import type { UseFormReturn } from 'react-hook-form';
import type { PecaB602 } from '@shared/types/b602-gdl.types';

export interface REPFormData {
  [key: string]: string;
  numero: string;
  solicitante_id: string;
  tipo_exame_id: string;
  template_id: string;
  data_requisicao: string;
  tipo_solicitacao: string;
  numero_documento: string;
  data_documento: string;
  autoridade_solicitante: string;
  data_acionamento: string;
  data_chegada: string;
  data_saida: string;
  local_fato: string;
  latitude: string;
  longitude: string;
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
  b602_envolvidos_0: string;
  b602_envolvidos_1: string;
  b602_envolvidos_2: string;
  b602_envolvidos_3: string;
  b602_envolvidos_4: string;
  b602_envolvidos_5: string;
  b602_envolvidos_6: string;
  b602_envolvidos_7: string;
  b602_envolvidos_8: string;
  b602_envolvidos_9: string;
  b602_envolvidos_qualificacao_0: string;
  b602_envolvidos_qualificacao_1: string;
  b602_envolvidos_qualificacao_2: string;
  b602_envolvidos_qualificacao_3: string;
  b602_envolvidos_qualificacao_4: string;
  b602_envolvidos_qualificacao_5: string;
  b602_envolvidos_qualificacao_6: string;
  b602_envolvidos_qualificacao_7: string;
  b602_envolvidos_qualificacao_8: string;
  b602_envolvidos_qualificacao_9: string;
  b602_data_ocorrencia: string;
  b602_local_bairro: string;
  b602_local_cidade: string;
  b602_local_uf: string;
  b602_numero_bo: string;
  b602_numero_ip: string;
  b602_solicitante_nome: string;
  b602_material_enc_toggle: string;
  b602_cartuchos_toggle: string;
  b602_estojos_toggle: string;
  b602_armas_toggle: string;
}

export interface ExamSectionProps {
  form: UseFormReturn<REPFormData>;
  mostrarPlaceholders: boolean;
  pecasB602?: PecaB602[];
  onPecasB602Change?: (pecas: PecaB602[]) => void;
  camposPreenchidosGdl?: ReadonlySet<string>;
}

export interface ExamSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  description: string;
  component: React.FC<ExamSectionProps>;
  group?: string;
  requiredFields: string[];
  isComplete?: (data: REPFormData, contexto: { pecasB602: PecaB602[] }) => boolean;
}

interface MenuField {
  name: string;
  label: string;
}

export interface MenuGroup {
  type: 'group';
  label: string;
  prefix: string;
  fields: MenuField[];
}

export interface MenuEntry {
  type: 'field';
  name: string;
  label: string;
}

type MenuSectionItem = MenuEntry | MenuGroup;

export interface MenuSection {
  id: string;
  label: string;
  items: MenuSectionItem[];
}
