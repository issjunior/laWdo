import { MapPin, Clock, Hash, Search, Package, CircleDot, Cylinder } from 'lucide-react';
import { LocalFatoFields } from './local-fato';
import { AcionamentoFields } from './acionamento';
import { NumeracaoFields } from './numeracao';
import { DadosInvestigacaoFields, MaterialEncFields, CartuchosFields, EstojosFields, B602_MENU_STRUCTURE } from './b602';
import { numeracaoService } from './services/numeracao.service';
import { b602Service } from './services/b602.service';
import type { ExamSection, MenuSection } from './types';
import type { ExamService } from './services/types';

export type { ExamSection, ExamSectionProps, REPFormData } from './types';
export type { ExamService } from './services/types';
export * from './placeholders';

export const SECTION_REGISTRY: Record<string, ExamSection> = {
  local_fato: {
    id: 'local_fato',
    label: 'Local do Fato',
    icon: MapPin,
    description: 'Coordenadas geográficas e descrição do local periciado',
    component: LocalFatoFields,
    group: 'envolvido-local',
    requiredFields: ['local_fato'],
  },
  acionamento: {
    id: 'acionamento',
    label: 'Linha do Tempo',
    icon: Clock,
    description: 'Registro de acionamento, chegada e saída do local',
    component: AcionamentoFields,
    group: null,
    requiredFields: [],
  },
  numeracao: {
    id: 'numeracao',
    label: 'Numerações Identificadoras',
    icon: Hash,
    description: 'Dados específicos para exame de numeração (I-801)',
    component: NumeracaoFields,
    group: null,
    requiredFields: ['numeracao_veiculo'],
  },
  dados_investigacao: {
    id: 'dados_investigacao',
    label: 'Dados da Investigação',
    icon: Search,
    description: 'Envolvidos, data, local, BO, IP e solicitante',
    component: DadosInvestigacaoFields,
    group: null,
    requiredFields: ['b602_envolvidos_0', 'b602_data_ocorrencia', 'b602_local'],
  },
  material_enc: {
    id: 'material_enc',
    label: 'Material Encaminhado',
    icon: Package,
    description: 'Armas, munições e acessórios encaminhados para exame',
    component: MaterialEncFields,
    group: null,
    requiredFields: [],
  },
  cartuchos: {
    id: 'cartuchos',
    label: 'Cartuchos',
    icon: CircleDot,
    description: 'Especificações de cartuchos para exame balístico',
    component: CartuchosFields,
    group: null,
    requiredFields: [],
  },
  estojos: {
    id: 'estojos',
    label: 'Estojos',
    icon: Cylinder,
    description: 'Especificações de estojos para exame balístico',
    component: EstojosFields,
    group: null,
    requiredFields: [],
  },
};

export const EXAM_FIELD_MAP: Record<string, string[]> = {
  'LOC':   ['local_fato', 'acionamento'],
  'I-801': ['numeracao'],
  'B-602': ['dados_investigacao', 'material_enc', 'cartuchos', 'estojos'],
};

export const EXAM_SERVICE_REGISTRY: Record<string, ExamService> = {
  'I-801': numeracaoService,
  'B-602': b602Service,
};

export { B602_MENU_STRUCTURE };
export type { MenuSection, MenuSectionItem, MenuEntry, MenuGroup, MenuField } from './types';

export const EXAM_MENU_REGISTRY: Record<string, MenuSection[]> = {
  'B-602': B602_MENU_STRUCTURE,
};

export function getSectionsForExame(codigo: string): ExamSection[] {
  const ids = EXAM_FIELD_MAP[codigo] || [];
  return ids.map(id => SECTION_REGISTRY[id]).filter(Boolean);
}

export function serializeCamposEspecificos(codigo: string, data: import('./types').REPFormData): string | undefined {
  const service = EXAM_SERVICE_REGISTRY[codigo];
  if (!service) return undefined;

  const dataWithDefaults = { ...data } as Record<string, string>;
  for (const [field, defaultVal] of Object.entries(service.fieldDefaults ?? {})) {
    if (!dataWithDefaults[field]) {
      dataWithDefaults[field] = defaultVal;
    }
  }

  return JSON.stringify(service.serialize(dataWithDefaults as import('./types').REPFormData));
}

export function deserializeCamposEspecificos(codigo: string, json: string | null | undefined): Partial<import('./types').REPFormData> {
  if (!json) return {};
  const service = EXAM_SERVICE_REGISTRY[codigo];
  if (!service) return {};
  try {
    return service.deserialize(JSON.parse(json));
  } catch {
    return {};
  }
}

export function getFieldMasks(codigo: string): Record<string, (v: string) => string> {
  return EXAM_SERVICE_REGISTRY[codigo]?.fieldMasks ?? {};
}
