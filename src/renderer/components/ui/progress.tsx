import * as React from 'react';

import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number | null;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({ className, value = 0, ...props }, ref) => {
  const valorNormalizado = value === null ? null : Math.max(0, Math.min(100, value));

  return (
    <div
      ref={ref}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/20', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valorNormalizado ?? undefined}
      {...props}
    >
      <div
        className={cn(
          'h-full bg-primary transition-transform',
          valorNormalizado === null ? 'w-1/3 animate-pulse rounded-full' : 'w-full flex-1',
        )}
        style={valorNormalizado === null ? undefined : { transform: `translateX(-${100 - valorNormalizado}%)` }}
      />
    </div>
  );
});
Progress.displayName = 'Progress';

export { Progress };
