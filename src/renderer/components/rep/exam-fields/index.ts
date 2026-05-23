import { MapPin, Clock, Hash } from 'lucide-react';
import { LocalFatoFields } from './local-fato';
import { AcionamentoFields } from './acionamento';
import { NumeracaoFields } from './numeracao';
import type { ExamSection } from './types';

export type { ExamSection, ExamSectionProps, REPFormData } from './types';
export * from './placeholders';

export const SECTION_REGISTRY: Record<string, ExamSection> = {
  local_fato: {
    id: 'local_fato',
    label: 'Local do Fato',
    icon: MapPin,
    description: 'Coordenadas geográficas e descrição do local periciado',
    component: LocalFatoFields,
    group: 'envolvido-local',
  },
  acionamento: {
    id: 'acionamento',
    label: 'Linha do Tempo',
    icon: Clock,
    description: 'Registro de acionamento, chegada e saída do local',
    component: AcionamentoFields,
    group: null,
  },
  numeracao: {
    id: 'numeracao',
    label: 'Numerações Identificadoras',
    icon: Hash,
    description: 'Dados específicos para exame de numeração (I-801)',
    component: NumeracaoFields,
    group: null,
  },
};

export const EXAM_FIELD_MAP: Record<string, string[]> = {
  'LOC':   ['local_fato', 'acionamento'],
  'I-801': ['numeracao'],
};

export function getSectionsForExame(codigo: string): ExamSection[] {
  const ids = EXAM_FIELD_MAP[codigo] || [];
  return ids.map(id => SECTION_REGISTRY[id]).filter(Boolean);
}
