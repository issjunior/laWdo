import React from 'react';
import { MapPin, Clock, Hash, Search, Package, CircleDot, Cylinder, Crosshair } from 'lucide-react';
import { LocalFatoFields } from './local-fato';
import { AcionamentoFields } from './acionamento';
import { NumeracaoFields } from './numeracao';
import { DadosInvestigacaoFields, MaterialEncFields, CartuchosFields, EstojosFields, ArmasFields, B602_MENU_STRUCTURE } from './b602';
import { PecasB602Fields } from './pecas-b602';
import { pecaB602EstaCompleta } from '@shared/catalogos/b602-gdl.catalogo';
import { numeracaoService } from './services/numeracao.service';
import { b602Service } from './services/b602.service';
import type { ExamSection, MenuSection } from './types';
import type { ExamService } from './services/types';

export type { ExamSection } from './types';

export interface ExamToggle {
  id: string;
  label: string;
  subtitulo?: string;
  sectionId?: string;
  subToggles?: ExamToggle[];
}

export const EXAM_TOGGLES: Record<string, ExamToggle[]> = {
  'B-602': [
    { id: 'b602_cartuchos_toggle', label: 'Cartuchos', subtitulo: 'DOS CARTUCHOS', sectionId: 'cartuchos' },
    { id: 'b602_estojos_toggle', label: 'Estojos', subtitulo: 'DOS ESTOJOS', sectionId: 'estojos' },
    { id: 'b602_armas_toggle', label: 'Arma', subtitulo: 'DA ARMA', sectionId: 'armas' },
  ],
};

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
    group: undefined,
    requiredFields: [],
  },
  numeracao: {
    id: 'numeracao',
    label: 'Numerações Identificadoras',
    icon: Hash,
    description: 'Dados específicos para exame de numeração (I-801)',
    component: NumeracaoFields,
    group: undefined,
    requiredFields: ['numeracao_veiculo'],
  },
  dados_investigacao: {
    id: 'dados_investigacao',
    label: 'Dados da Investigação',
    icon: Search,
    description: 'Envolvidos, data, local, BO, IP e solicitante',
    component: DadosInvestigacaoFields,
    group: undefined,
    requiredFields: ['b602_envolvidos_0', 'b602_data_ocorrencia', 'b602_local_cidade', 'b602_local_uf'],
  },
  pecas_b602: {
    id: 'pecas_b602',
    label: 'Peças',
    icon: Package,
    description: 'Peças encaminhadas para o exame, manuais ou importadas do GDL',
    component: ({ pecasB602 = [], onPecasB602Change, onRevisarPecasGdl }) => React.createElement(PecasB602Fields, {
      pecas: pecasB602,
      onChange: onPecasB602Change ?? (() => undefined),
      onRevisarPecasGdl,
    }),
    group: undefined,
    requiredFields: [],
    isComplete: (_data, { pecasB602 }) => pecasB602.length > 0 && pecasB602.every(pecaB602EstaCompleta),
  },
  material_enc: {
    id: 'material_enc',
    label: 'Material Encaminhado',
    icon: Package,
    description: 'Armas, munições e acessórios encaminhados para exame',
    component: MaterialEncFields,
    group: undefined,
    requiredFields: [],
  },
  cartuchos: {
    id: 'cartuchos',
    label: 'Cartuchos',
    icon: CircleDot,
    description: 'Especificações de cartuchos para exame balístico',
    component: CartuchosFields,
    group: undefined,
    requiredFields: [],
  },
  estojos: {
    id: 'estojos',
    label: 'Estojos',
    icon: Cylinder,
    description: 'Especificações de estojos para exame balístico',
    component: EstojosFields,
    group: undefined,
    requiredFields: [],
  },
  armas: {
    id: 'armas',
    label: 'Arma',
    icon: Crosshair,
    description: 'Especificações das armas periciadas',
    component: ArmasFields,
    group: undefined,
    requiredFields: [],
  },
};

export const EXAM_FIELD_MAP: Record<string, string[]> = {
  'LOC':   ['local_fato', 'acionamento'],
  'I-801': ['numeracao'],
  'B-602': ['dados_investigacao', 'pecas_b602'],
};

const EXAM_SERVICE_REGISTRY: Record<string, ExamService> = {
  'I-801': numeracaoService,
  'B-602': b602Service,
};

export type { MenuSection } from './types';

export const EXAM_MENU_REGISTRY: Record<string, MenuSection[]> = {
  'B-602': B602_MENU_STRUCTURE,
};

export function getSectionsForExame(codigo: string): ExamSection[] {
  const ids = EXAM_FIELD_MAP[codigo] || [];
  return ids.map(id => SECTION_REGISTRY[id]).filter(Boolean);
}

export function serializeCamposEspecificos(
  codigo: string,
  data: import('./types').REPFormData,
  contexto?: import('./services/types').ContextoSerializacaoCamposEspecificos,
): string | undefined {
  const service = EXAM_SERVICE_REGISTRY[codigo];
  if (!service) return undefined;

  const dataWithDefaults = { ...data } as Record<string, string>;
  for (const [field, defaultVal] of Object.entries(service.fieldDefaults ?? {})) {
    if (!dataWithDefaults[field]) {
      dataWithDefaults[field] = defaultVal;
    }
  }

  return JSON.stringify(service.serialize(dataWithDefaults as import('./types').REPFormData, contexto));
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

