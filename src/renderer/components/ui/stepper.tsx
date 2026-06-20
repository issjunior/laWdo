import React, { useState, useCallback } from 'react';
import { Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface Step {
  id: string;
  label: string;
  icon: LucideIcon;
  blocked?: boolean;
  blockedTooltip?: string;
}

export interface StepperProps {
  steps: Step[];
  activeStep: string;
  completedSteps: Set<string>;
  onStepClick: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  /** Número da REP formatado e válido — exibe no cabeçalho */
  repNumero?: string;
  /** Contexto: criação ou edição */
  repModo?: 'nova' | 'editar';
  /** Nome do tipo de exame selecionado */
  tipoExameNome?: string;
}

const REP_NUMERO_REGEX = /^\d{1,3}(\.\d{3})?-\d{4}$/;

export const Stepper: React.FC<StepperProps> = ({
  steps,
  activeStep,
  completedSteps,
  onStepClick,
  collapsed,
  onToggle,
  className,
  repNumero,
  repModo = 'nova',
  tipoExameNome,
}) => {
  const [hoveredBlockedStep, setHoveredBlockedStep] = useState<string | null>(null);

  const handleStepClick = useCallback(
    (step: Step) => {
      if (step.blocked) {
        setHoveredBlockedStep(prev => prev === step.id ? null : step.id);
        return;
      }
      onStepClick(step.id);
    },
    [onStepClick],
  );

  // Só exibe o número quando o formato está validado
  const numeroValido = repNumero && REP_NUMERO_REGEX.test(repNumero) ? repNumero : null;

  /* ── Modo colapsado ───────────────────────────────────────────────────── */
  if (collapsed) {
    return (
      <div className={cn('flex flex-col items-center gap-1 py-3 w-[44px] shrink-0', className)}>
        <button
          type="button"
          onClick={onToggle}
          className="p-1 rounded hover:bg-muted transition-colors mb-1"
          aria-label="Expandir stepper"
        >
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>

        {/* Track de progresso vertical removido */}

        {steps.map((step, i) => {
          const isComplete = completedSteps.has(step.id);
          const isActive = step.id === activeStep;
          const isBlocked = step.blocked;

          let icon: React.ReactNode;
          if (isBlocked) {
            icon = <Lock size={14} className="text-muted-foreground/50" />;
          } else {
            icon = (
              <span
                className={cn(
                  'w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-bold leading-none transition-colors duration-300',
                  isComplete
                    ? 'bg-green-500 text-white'
                    : isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'border-2 border-muted-foreground/30 text-muted-foreground',
                )}
              >
                {i + 1}
              </span>
            );
          }

          return (
            <React.Fragment key={step.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={isBlocked}
                    onClick={() => !isBlocked && handleStepClick(step)}
                    className={cn(
                      'flex items-center justify-center w-7 h-7 rounded transition-colors',
                      !isBlocked && 'hover:bg-muted cursor-pointer',
                      isBlocked && 'cursor-not-allowed opacity-50',
                    )}
                    aria-label={step.label}
                  >
                    {icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {step.label}
                </TooltipContent>
              </Tooltip>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 flex-1 min-h-[8px] transition-colors duration-300',
                    isComplete ? 'bg-green-300' : 'bg-muted-foreground/20',
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  /* ── Modo expandido ───────────────────────────────────────────────────── */
  return (
    <div className={cn('flex flex-col gap-0 py-3 w-[240px] shrink-0', className)}>

      {/* Botão colapsar */}
      <div className="flex justify-end mb-2 px-1">
        <button
          type="button"
          onClick={onToggle}
          className="p-1 rounded hover:bg-muted transition-colors"
          aria-label="Colapsar stepper"
        >
          <ChevronLeft size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* ── Cabeçalho de identidade ── */}
      <div className="mx-2 mb-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 space-y-1.5 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Badge de modo */}
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide border shrink-0',
              repModo === 'editar'
                ? 'bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/30'
                : 'bg-primary/12 text-primary border-primary/30',
            )}
          >
            {repModo === 'editar' ? 'EDITANDO' : 'NOVA REP'}
          </span>

          {/* Número da REP — só exibe quando válido */}
          {numeroValido && (
            <span className="text-sm font-bold text-foreground tabular-nums leading-none">
              {numeroValido}
            </span>
          )}
        </div>

        {/* Tipo de exame */}
        {tipoExameNome ? (
          <p className="text-[11px] text-muted-foreground leading-tight break-words" title={tipoExameNome}>
            {tipoExameNome}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground/40 leading-tight italic">
            Nenhum tipo de exame
          </p>
        )}
      </div>

      {/* ── Etapas ── */}
      {steps.map((step, i) => {
        const isComplete = completedSteps.has(step.id);
        const isActive = step.id === activeStep;
        const isBlocked = step.blocked;

        const stepContent = (
          <button
            type="button"
            onClick={() => handleStepClick(step)}
            disabled={isBlocked}
            className={cn(
              'flex items-start gap-3 w-full text-left py-2 px-3 rounded-md transition-all duration-200 group',
              isActive && !isBlocked
                ? 'bg-primary/10 ring-1 ring-primary/35 shadow-sm'
                : 'hover:bg-muted/50',
              isBlocked && 'opacity-50 cursor-not-allowed',
            )}
          >
            <div className="flex flex-col items-center shrink-0">
              {/* Indicador de estado — sempre mostra número */}
              {isBlocked ? (
                <Lock size={16} className="text-muted-foreground mt-0.5" />
              ) : (
                <span
                  className={cn(
                    'w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold leading-none mt-0.5 transition-colors duration-300 shrink-0',
                    isComplete
                      ? 'bg-green-500 text-white shadow-sm'
                      : isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'border-2 border-muted-foreground/30 text-muted-foreground group-hover:border-muted-foreground/50',
                  )}
                >
                  {i + 1}
                </span>
              )}

              {/* Conector vertical */}
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 flex-1 min-h-[12px] mt-1 rounded-full transition-colors duration-400',
                    isComplete ? 'bg-green-300' : 'bg-muted-foreground/20',
                  )}
                />
              )}
            </div>

            <div className="flex-1 min-w-0 pb-3">
              <div className="flex items-center gap-2">
                <step.icon
                  size={13}
                  className={cn(
                    'shrink-0 transition-colors duration-200',
                    isActive && !isBlocked
                      ? 'text-primary'
                      : isComplete
                        ? 'text-green-500'
                        : 'text-muted-foreground',
                  )}
                />
                <span
                  className={cn(
                    'text-sm leading-tight transition-colors duration-200',
                    isActive && !isBlocked
                      ? 'text-primary font-semibold'
                      : isComplete
                        ? 'text-foreground'
                        : 'text-foreground',
                    isBlocked && 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>
            </div>
          </button>
        );

        if (isBlocked && step.blockedTooltip) {
          return (
            <Tooltip key={step.id} open={hoveredBlockedStep === step.id}>
              <TooltipTrigger asChild>{stepContent}</TooltipTrigger>
              <TooltipContent side="right" className="max-w-[260px]">
                <p className="text-xs">{step.blockedTooltip}</p>
              </TooltipContent>
            </Tooltip>
          );
        }

        return <React.Fragment key={step.id}>{stepContent}</React.Fragment>;
      })}
    </div>
  );
};
