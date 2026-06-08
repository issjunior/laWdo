import React from 'react';
import { Stepper } from '@/components/ui/stepper';
import { useRepStepper } from './useRepStepper';
import type { UseFormReturn } from 'react-hook-form';
import type { REPFormData } from '@/components/rep/exam-fields';

interface RepStepperProps {
  form: UseFormReturn<REPFormData>;
  tipoExameId: string;
  tipoExameSelecionado: { id: string; codigo: string; nome: string } | null;
}

export const RepStepper: React.FC<RepStepperProps> = ({
  form,
  tipoExameId,
  tipoExameSelecionado,
}) => {
  const stepper = useRepStepper({ form, tipoExameId, tipoExameSelecionado });

  return (
    <Stepper
      steps={stepper.steps}
      activeStep={stepper.activeStep}
      completedSteps={stepper.completedSteps}
      onStepClick={stepper.onStepClick}
      collapsed={stepper.collapsed}
      onToggle={() => stepper.setCollapsed(!stepper.collapsed)}
      className="sticky top-[calc(var(--spacing-header)+1rem)] self-start"
    />
  );
};
