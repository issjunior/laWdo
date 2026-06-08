import { useState, useMemo, useCallback } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { REPFormData } from '@/components/rep/exam-fields';
import { SECTION_REGISTRY } from '@/components/rep/exam-fields';
import type { Step } from '@/components/ui/stepper';
import {
  STEP_REGISTRY,
  getDynamicSteps,
  getMissingUnlockFields,
} from './step-registry';

interface UseRepStepperOptions {
  form: UseFormReturn<REPFormData>;
  tipoExameId: string;
  tipoExameSelecionado: { id: string; codigo: string; nome: string } | null;
}

interface UseRepStepperReturn {
  steps: Step[];
  activeStep: string;
  completedSteps: Set<string>;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  onStepClick: (id: string) => void;
  canUnlockDynamic: boolean;
}

export function useRepStepper({
  form,
  tipoExameId,
  tipoExameSelecionado,
}: UseRepStepperOptions): UseRepStepperReturn {
  const [activeStep, setActiveStep] = useState('dados-solicitacao');
  const [collapsed, setCollapsed] = useState(false);
  const formValues = form.watch();

  const canUnlockDynamic = useMemo(() => {
    return !!(
      formValues.numero &&
      formValues.data_requisicao &&
      formValues.tipo_solicitacao &&
      formValues.numero_documento &&
      tipoExameId
    );
  }, [formValues.numero, formValues.data_requisicao, formValues.tipo_solicitacao, formValues.numero_documento, tipoExameId]);

  const steps: Step[] = useMemo(() => {
    const base: Step[] = STEP_REGISTRY.map((s) => ({
      id: s.id,
      label: s.label,
      icon: s.icon,
    }));

    const codigo = tipoExameSelecionado?.codigo;
    if (!codigo) return base;

    const dynamic = getDynamicSteps(codigo);
    const missingFields = !canUnlockDynamic
      ? getMissingUnlockFields({
          numero: formValues.numero,
          data_requisicao: formValues.data_requisicao,
          tipo_solicitacao: formValues.tipo_solicitacao,
          numero_documento: formValues.numero_documento,
          tipo_exame_id: tipoExameId,
        })
      : [];

    const blockedTooltip =
      missingFields.length > 0
        ? `Preencha: ${missingFields.join(', ')}`
        : undefined;

    base.push(
      ...dynamic.map((s) => ({
        ...s,
        blocked: !canUnlockDynamic,
        blockedTooltip,
      })),
    );

    return base;
  }, [tipoExameSelecionado?.codigo, formValues, tipoExameId, canUnlockDynamic]);

  const completedSteps = useMemo(() => {
    const completed = new Set<string>();

    const checkStep = (requiredFields: string[], stepId: string) => {
      if (requiredFields.length === 0) return;
      const allFilled = requiredFields.every((f) => {
        const v = formValues[f as keyof REPFormData];
        return v && (typeof v === 'string' ? v.trim().length > 0 : true);
      });
      if (allFilled) completed.add(stepId);
    };

    for (const step of STEP_REGISTRY) {
      checkStep(step.requiredFields, step.id);
    }

    const codigo = tipoExameSelecionado?.codigo;
    if (codigo && canUnlockDynamic) {
      const dynamicSteps = getDynamicSteps(codigo);
      for (const step of dynamicSteps) {
        const sectionId = step.id.replace('section-', '');
        const section = SECTION_REGISTRY[sectionId];
        if (!section) continue;
        checkStep(section.requiredFields ?? [], step.id);
      }
    }

    return completed;
  }, [formValues, tipoExameSelecionado?.codigo, canUnlockDynamic]);

  const onStepClick = useCallback(
    (id: string) => {
      setActiveStep(id);
      const el = document.getElementById(`step-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [],
  );

  return {
    steps,
    activeStep,
    completedSteps,
    collapsed,
    setCollapsed,
    onStepClick,
    canUnlockDynamic,
  };
}
