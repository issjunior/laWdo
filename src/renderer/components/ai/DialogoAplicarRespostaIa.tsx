import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DialogoAplicarRespostaIaProps {
  open: boolean;
  secaoTitulo: string;
  conteudoAtual: string;
  conteudoProposto: string;
  onOpenChange: (open: boolean) => void;
  onConfirmar: () => void;
}

export function DialogoAplicarRespostaIa({
  open,
  secaoTitulo,
  conteudoAtual,
  conteudoProposto,
  onOpenChange,
  onConfirmar,
}: DialogoAplicarRespostaIaProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Revisar substituição da seção</DialogTitle>
          <DialogDescription>
            A resposta substituirá todo o conteúdo de “{secaoTitulo}”. Compare as versões antes de confirmar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-4 md:grid-cols-2">
          <section className="min-w-0">
            <h3 className="mb-2 text-sm font-medium">Conteúdo atual</h3>
            <div className="max-h-[48vh] overflow-y-auto rounded-md border bg-muted/20 p-3">
              <p className="whitespace-pre-wrap text-sm">{conteudoAtual || 'Seção vazia'}</p>
            </div>
          </section>
          <section className="min-w-0">
            <h3 className="mb-2 text-sm font-medium">Conteúdo proposto</h3>
            <div className="max-h-[48vh] overflow-y-auto rounded-md border bg-muted/20 p-3">
              <p className="whitespace-pre-wrap text-sm">{conteudoProposto || 'Resposta vazia'}</p>
            </div>
          </section>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirmar}>
            Substituir seção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
