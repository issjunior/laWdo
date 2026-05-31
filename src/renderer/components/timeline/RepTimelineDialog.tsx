import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Linha do Tempo — REP Nº {repNumero}</DialogTitle>
        </DialogHeader>
        <DualTrackTimeline repId={repId} repNumero={repNumero} />
      </DialogContent>
    </Dialog>
  );
}

export default RepTimelineDialog;
