import { useEffect, useState } from 'react';
import { Cloud, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import type { EstadoGoogleDrive } from '@shared/types/google-drive.types';

interface EnviarCopiaGoogleDriveDialogProps {
  aberto: boolean;
  laudoId: string | null;
  possuiCopiaVigente?: boolean;
  onAbertoChange: (aberto: boolean) => void;
  onEnviado?: () => void;
}

export function EnviarCopiaGoogleDriveDialog({ aberto, laudoId, possuiCopiaVigente = false, onAbertoChange, onEnviado }: EnviarCopiaGoogleDriveDialogProps) {
  const [estado, setEstado] = useState<EstadoGoogleDrive | null>(null);
  const [consultandoEstado, setConsultandoEstado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    setEstado(null);
    setConsultandoEstado(true);
    void window.ipcAPI.googleDrive.estadoRapido().then(resposta => {
      if (!ativo) return;
      if (resposta.success && resposta.data) setEstado(resposta.data);
      else toast.error(resposta.error ?? 'Não foi possível consultar o Google Drive.');
    }).finally(() => { if (ativo) setConsultandoEstado(false); });
    return () => { ativo = false; };
  }, [aberto]);

  const enviar = async () => {
    if (!laudoId || enviando || !estado?.conectado) return;
    setEnviando(true);
    try {
      const resposta = await window.ipcAPI.googleDrive.enviarLaudo(laudoId, true);
      if (!resposta.success) { toast.error(resposta.error ?? 'Não foi possível enviar o laudo.'); return; }
      toast.success('Cópia validada e enviada ao Google Drive.');
      onAbertoChange(false);
      onEnviado?.();
    } finally { setEnviando(false); }
  };

  const contaConectada = estado?.conectado === true;
  return <AlertDialog open={aberto} onOpenChange={valor => { if (!enviando) onAbertoChange(valor); }}>
    <AlertDialogContent className="gap-0 overflow-hidden rounded-xl p-0">
      <AlertDialogHeader className="space-y-3 border-b bg-muted/30 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cloud className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1">
            <AlertDialogTitle>Enviar cópia ao Google Drive?</AlertDialogTitle>
            <AlertDialogDescription>Uma cópia protegida será armazenada exclusivamente na sua área do laWdo.</AlertDialogDescription>
          </div>
        </div>
      </AlertDialogHeader>
      <div className="space-y-3 px-6 py-5">
        <div className="flex gap-3 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          {consultandoEstado || enviando ? <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" aria-hidden="true" /> : <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />}
          <p>{consultandoEstado ? 'Verificando a conexão com o Google Drive.' : !contaConectada
            ? 'Conecte uma conta institucional na página Backup e restauração antes de enviar uma cópia.'
            : possuiCopiaVigente ? 'A cópia vigente será substituída depois da validação da nova cópia.' : 'A cópia será cifrada antes de ser enviada para Meu Drive/laWdo.'}</p>
        </div>
        {enviando && <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3" aria-live="polite">
          <Progress value={null} />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
            <span>Preparando, cifrando, enviando e validando a cópia.</span>
          </div>
        </div>}
      </div>
      <AlertDialogFooter className="border-t bg-muted/20 px-6 py-4">
        <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
        <AlertDialogAction disabled={consultandoEstado || !contaConectada || enviando || !laudoId} onClick={evento => { evento.preventDefault(); void enviar(); }}>
          {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{enviando ? 'Enviando...' : 'Enviar cópia'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
