import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { History } from 'lucide-react';
import { DualTrackTimeline } from './DualTrackTimeline';

interface RepTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repId: string;
  repNumero: string;
}

export function RepTimelineDialog({
  open,
  onOpenChange,
  repId,
  repNumero,
}: RepTimelineDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        overflow-y-auto fica num div interno para que o botão ✕
        (absolute right-4 top-4 dentro do DialogContent) nunca
        desapareça ao rolar o conteúdo.
      */}
      <DialogContent className="max-w-4xl p-0 flex flex-col max-h-[88vh]">

        {/* ── Cabeçalho fixo (não rola) ── */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/60 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            {/* Icon bubble */}
            <span className="
              inline-flex items-center justify-center
              w-8 h-8 rounded-lg flex-shrink-0
              bg-gradient-to-br from-blue-500/15 to-purple-500/15
              border border-blue-200/50 dark:border-blue-800/40
            ">
              <History size={15} className="text-blue-600 dark:text-blue-400" />
            </span>

            {/* Title */}
            <span className="text-base font-semibold">
              Linha do Tempo
            </span>

            {/* REP number pill */}
            <span className="
              inline-flex items-center
              px-2.5 py-0.5 rounded-full
              text-xs font-bold tracking-wide
              bg-blue-50 text-blue-700
              border border-blue-200
              dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700/60
            ">
              REP&nbsp;{repNumero}
            </span>
          </DialogTitle>

          {/* Subtitle */}
          <p className="text-xs text-muted-foreground mt-1 ml-[44px]">
            Ciclo de vida completo — eventos de REP e Laudo em ordem cronológica
          </p>
        </DialogHeader>

        {/* ── Corpo rolável (a área de scroll fica aqui) ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[280px]">
          <DualTrackTimeline repId={repId} repNumero={repNumero} />
        </div>

      </DialogContent>
    </Dialog>
  );
}

export default RepTimelineDialog;
