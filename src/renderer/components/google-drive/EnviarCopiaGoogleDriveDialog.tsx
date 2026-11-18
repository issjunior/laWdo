import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Enviar cópia ao Google Drive?</AlertDialogTitle>
        <AlertDialogDescription>
          {consultandoEstado ? 'Verificando a conexão com o Google Drive.' : !contaConectada
            ? 'Conecte uma conta institucional na página Backup e restauração antes de enviar uma cópia.'
            : possuiCopiaVigente ? 'A cópia vigente será substituída depois da validação da nova cópia.' : 'O laWdo criará uma cópia cifrada na pasta exclusiva Meu Drive/laWdo.'}
        </AlertDialogDescription>
      </AlertDialogHeader>
      {enviando && <div className="space-y-2" aria-live="polite"><Progress value={null} /><p className="text-sm text-muted-foreground">Preparando, cifrando, enviando e validando a cópia.</p></div>}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
        <AlertDialogAction disabled={consultandoEstado || !contaConectada || enviando || !laudoId} onClick={evento => { evento.preventDefault(); void enviar(); }}>
          {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{enviando ? 'Enviando...' : 'Enviar cópia'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
