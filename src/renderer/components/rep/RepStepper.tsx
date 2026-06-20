import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { Stepper } from '@/components/ui/stepper';
import { useRepStepper } from './useRepStepper';
import type { UseFormReturn } from 'react-hook-form';
import type { REPFormData } from '@/components/rep/exam-fields';

/* ─── Contexto ─── */

const RepStepperContext = createContext<string>('dados-solicitacao');

/** Hook para acessar o passo ativo do stepper dentro do formulário de REP. */
export const useRepStepperContext = (): string => useContext(RepStepperContext);

/* ─── Props ─── */

interface RepStepperProps {
  form: UseFormReturn<REPFormData>;
  tipoExameId: string;
  tipoExameSelecionado: { id: string; codigo: string; nome: string } | null;
  /** Número da REP formatado — exibido no cabeçalho do stepper */
  repNumero?: string;
  /** Contexto: criação ou edição */
  repModo?: 'nova' | 'editar';
  /** Nome do tipo de exame selecionado */
  tipoExameNome?: string;
  /** Controla se o IntersectionObserver fica ativo */
  showForm: boolean;
  children: React.ReactNode;
}

/* ─── Componente ─── */

/**
 * Stepper lateral para o formulário de REP.
 * Encapsula o hook `useRepStepper`, o IntersectionObserver (scroll spy),
 * o posicionamento sticky e o contexto de passo ativo para highlight das seções.
 */
export const RepStepper: React.FC<RepStepperProps> = ({
  form,
  tipoExameId,
  tipoExameSelecionado,
  repNumero,
  repModo = 'nova',
  tipoExameNome,
  showForm,
  children,
}) => {
  const { steps, activeStep, setActiveStep, completedSteps, collapsed, setCollapsed, onStepClick } =
    useRepStepper({ form, tipoExameId, tipoExameSelecionado });

  /* ── Scroll spy via IntersectionObserver ── */
  const observerPausedRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleStepClick = useCallback(
    (id: string) => {
      observerPausedRef.current = true;
      onStepClick(id);
      setTimeout(() => {
        observerPausedRef.current = false;
      }, 600);
    },
    [onStepClick],
  );

  useEffect(() => {
    if (!showForm) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      return;
    }

    const timeout = setTimeout(() => {
      const elements = document.querySelectorAll('[data-step]');
      if (elements.length === 0) return;

      const ratios = new Map<string, number>();
      const observer = new IntersectionObserver(
        (entries) => {
          if (observerPausedRef.current) return;
          for (const entry of entries) {
            ratios.set(entry.target.getAttribute('data-step')!, entry.intersectionRatio);
          }
          let bestId: string | null = null;
          let bestRatio = 0;
          ratios.forEach((ratio, id) => {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              bestId = id;
            }
          });
          if (bestId) {
            setActiveStep(bestId);
          }
        },
        { threshold: [0, 0.25, 0.5, 0.75, 1] },
      );

      elements.forEach((el) => observer.observe(el));
      observerRef.current = observer;
    }, 100);

    return () => {
      clearTimeout(timeout);
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [showForm, steps.length]);

  return (
    <RepStepperContext.Provider value={activeStep}>
      <div className="flex gap-6 max-w-[1600px] mx-auto items-start">
        <div className="sticky top-[calc(var(--spacing-header,0px)+1rem)] self-start shrink-0">
          <Stepper
            steps={steps}
            activeStep={activeStep}
            completedSteps={completedSteps}
            onStepClick={handleStepClick}
            collapsed={collapsed}
            onToggle={() => setCollapsed(!collapsed)}
            repNumero={repNumero}
            repModo={repModo}
            tipoExameNome={tipoExameNome}
          />
        </div>
        {children}
      </div>
    </RepStepperContext.Provider>
  );
};
