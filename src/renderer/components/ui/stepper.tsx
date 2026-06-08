import React, { useState, useCallback } from 'react';
import { CheckCircle, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
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
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  activeStep,
  completedSteps,
  onStepClick,
  collapsed,
  onToggle,
  className,
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

  if (collapsed) {
    return (
      <div className={cn('flex flex-col items-center gap-1 py-4 w-[44px] shrink-0', className)}>
        <button
          type="button"
          onClick={onToggle}
          className="p-1 rounded hover:bg-muted transition-colors mb-2"
          aria-label="Expandir stepper"
        >
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        {steps.map((step, i) => {
          const isComplete = completedSteps.has(step.id);
          const isActive = step.id === activeStep;
          const isBlocked = step.blocked;

          let node: React.ReactNode;
          if (isBlocked) {
            node = <Lock size={12} className="text-muted-foreground/50" />;
          } else if (isComplete) {
            node = <CheckCircle size={14} className="text-green-500" />;
          } else if (isActive) {
            node = (
              <span className="w-[14px] h-[14px] rounded-full bg-primary flex items-center justify-center text-[8px] text-primary-foreground font-bold leading-none">
                {i + 1}
              </span>
            );
          } else {
            node = (
              <span className="w-[14px] h-[14px] rounded-full border-2 border-muted-foreground/30" />
            );
          }

          return (
            <React.Fragment key={step.id}>
              {node}
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 flex-1 min-h-[8px]',
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

  return (
    <div className={cn('flex flex-col gap-0 py-4 w-[220px] shrink-0', className)}>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={onToggle}
          className="p-1 rounded hover:bg-muted transition-colors"
          aria-label="Colapsar stepper"
        >
          <ChevronLeft size={16} className="text-muted-foreground" />
        </button>
      </div>
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
              'flex items-start gap-3 w-full text-left py-2 px-3 rounded-md transition-colors group',
              isActive && !isBlocked
                ? 'bg-primary/10 ring-1 ring-primary/30'
                : 'hover:bg-muted/50',
              isBlocked && 'opacity-50 cursor-not-allowed',
            )}
          >
            <div className="flex flex-col items-center shrink-0">
              {isBlocked ? (
                <Lock size={16} className="text-muted-foreground mt-0.5" />
              ) : isComplete ? (
                <CheckCircle size={18} className="text-green-500 mt-0.5" />
              ) : isActive ? (
                <span className="w-[18px] h-[18px] rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-bold leading-none mt-0.5">
                  {i + 1}
                </span>
              ) : (
                <span className="w-[18px] h-[18px] rounded-full border-2 border-muted-foreground/30 mt-0.5" />
              )}
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 flex-1 min-h-[12px] mt-1',
                    isComplete ? 'bg-green-300' : 'bg-muted-foreground/20',
                  )}
                />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-3">
              <div className="flex items-center gap-2">
                <step.icon
                  size={14}
                  className={cn(
                    'shrink-0',
                    isActive && !isBlocked ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
                <span
                  className={cn(
                    'text-sm leading-tight',
                    isActive && !isBlocked ? 'text-primary font-semibold' : 'text-foreground',
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
