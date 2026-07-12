import { useState, useMemo, useCallback } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { SECTION_REGISTRY } from '@/components/rep/exam-fields/index';
import type { REPFormData } from '@/components/rep/exam-fields/types';
import type { Step } from '@/components/ui/stepper';
import type { PecaB602 } from '@shared/types/b602-gdl.types';
import {
  STEP_REGISTRY,
  getDynamicSteps,
} from './step-registry';

interface UseRepStepperOptions {
  form: UseFormReturn<REPFormData>;
  tipoExameId: string;
  tipoExameSelecionado: { id: string; codigo: string; nome: string } | null;
  pecasB602: PecaB602[];
}

interface UseRepStepperReturn {
  steps: Step[];
  activeStep: string;
  setActiveStep: (id: string) => void;
  completedSteps: Set<string>;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  onStepClick: (id: string) => void;
}

export function useRepStepper({
  form,
  tipoExameId: _tipoExameId,
  tipoExameSelecionado,
  pecasB602,
}: UseRepStepperOptions): UseRepStepperReturn {
  const [activeStep, setActiveStep] = useState('dados-solicitacao');
  const [collapsed, setCollapsed] = useState(false);
  const formValues = form.watch();

  const steps: Step[] = useMemo(() => {
    const base: Step[] = STEP_REGISTRY.map((s) => ({
      id: s.id,
      label: s.label,
      icon: s.icon,
    }));

    const codigo = tipoExameSelecionado?.codigo;
    if (!codigo) return base;

    const dynamic = getDynamicSteps(codigo);
    base.push(...dynamic);

    return base;
  }, [tipoExameSelecionado?.codigo]);

  const completedSteps = useMemo(() => {
    const completed = new Set<string>();

    const checkStep = (requiredFields: string[], stepId: string) => {
      if (requiredFields.length === 0) { completed.add(stepId); return; }
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
    if (codigo) {
      const dynamicSteps = getDynamicSteps(codigo);
      for (const step of dynamicSteps) {
        const sectionId = step.id.replace('section-', '');
        const section = SECTION_REGISTRY[sectionId];
        if (!section) continue;
        if (section.isComplete) {
          if (section.isComplete(formValues, { pecasB602 })) completed.add(step.id);
        } else {
          checkStep(section.requiredFields ?? [], step.id);
        }
      }
    }

    return completed;
  }, [formValues, pecasB602, tipoExameSelecionado?.codigo]);

  const onStepClick = useCallback(
    (id: string) => {
      setActiveStep(id);
      const el = document.getElementById(`step-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    },
    [],
  );

  return {
    steps,
    activeStep,
    setActiveStep,
    completedSteps,
    collapsed,
    setCollapsed,
    onStepClick,
  };
}
