import { FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SECTION_REGISTRY, EXAM_FIELD_MAP } from '@/components/rep/exam-fields';
import type { Step } from '@/components/ui/stepper';

export interface StepEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  requiredFields: string[];
}

export const STEP_REGISTRY: StepEntry[] = [
  {
    id: 'dados-solicitacao',
    label: 'Dados da Solicitação',
    icon: FileText,
    requiredFields: ['numero', 'data_requisicao', 'tipo_solicitacao', 'numero_documento'],
  },
];

const STEP1_REQUIRED = new Set(['numero', 'data_requisicao', 'tipo_solicitacao', 'numero_documento', 'tipo_exame_id']);

export function getMissingUnlockFields(formValues: Record<string, unknown>): string[] {
  const labelMap: Record<string, string> = {
    numero: 'Nº da REP',
    data_requisicao: 'Data de recebimento',
    tipo_solicitacao: 'Tipo de Solicitação',
    numero_documento: 'Nº da Solicitação',
    tipo_exame_id: 'Tipo de Exame',
  };

  const missing: string[] = [];
  for (const field of STEP1_REQUIRED) {
    const value = formValues[field];
    if (!value || (typeof value === 'string' && !value.trim())) {
      missing.push(labelMap[field] || field);
    }
  }
  return missing;
}

export function getDynamicSteps(codigo: string): Step[] {
  const sectionIds = EXAM_FIELD_MAP[codigo] || [];
  return sectionIds
    .map((id) => {
      const section = SECTION_REGISTRY[id];
      if (!section) return null;
      return {
        id: `section-${section.id}`,
        label: section.label,
        icon: section.icon,
      } as Step;
    })
    .filter(Boolean) as Step[];
}

export function getAllSteps(codigo: string | undefined): Step[] {
  const steps: Step[] = STEP_REGISTRY.map((s) => ({
    id: s.id,
    label: s.label,
    icon: s.icon,
  }));

  if (!codigo) return steps;

  const dynamicSteps = getDynamicSteps(codigo);
  steps.push(...dynamicSteps);
  return steps;
}
