import { useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DialogoSaidaLaudoProps {
  titulo?: string;
  descricao?: string;
  aberto: boolean;
  salvando: boolean;
  erro: string | null;
  aoAlterarAbertura: (aberto: boolean) => void;
  aoDescartar: () => void;
  aoSalvar: () => void;
}

export function DialogoSaidaLaudo({
  titulo = 'Salvar alterações do laudo?',
  descricao = 'Há alterações não salvas. Deseja salvar antes de sair?',
  aberto,
  salvando,
  erro,
  aoAlterarAbertura,
  aoDescartar,
  aoSalvar,
}: DialogoSaidaLaudoProps) {
  const continuarEditandoRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog open={aberto} onOpenChange={novoEstado => {
      if (!salvando) aoAlterarAbertura(novoEstado);
    }}>
      <AlertDialogContent
        className="max-w-xl"
        onEscapeKeyDown={evento => { if (salvando) evento.preventDefault(); }}
        onOpenAutoFocus={evento => {
          evento.preventDefault();
          continuarEditandoRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>
            {descricao}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}
        <AlertDialogFooter className="flex-col sm:flex-row sm:flex-wrap">
          <AlertDialogCancel ref={continuarEditandoRef} disabled={salvando} className="h-11 w-full whitespace-nowrap sm:w-auto">
            Continuar editando
          </AlertDialogCancel>
          <AlertDialogAction disabled={salvando} className="h-11 w-full whitespace-nowrap bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto" onClick={aoDescartar}>
            Sair sem salvar
          </AlertDialogAction>
          <Button type="button" disabled={salvando} className="h-11 w-full whitespace-nowrap sm:w-auto" onClick={aoSalvar}>
            {salvando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando…</> : 'Salvar e sair'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
