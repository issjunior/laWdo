import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

export function useConfirmacaoConteudo() {
  const [mensagem, definirMensagem] = useState<string | null>(null);
  const resolver = useRef<((valor: boolean) => void) | null>(null);
  const concluir = useCallback((valor: boolean) => {
    resolver.current?.(valor);
    resolver.current = null;
    definirMensagem(null);
  }, []);
  useEffect(() => () => { resolver.current?.(false); }, []);
  const confirmar = useCallback((texto: string) => new Promise<boolean>(resolve => {
    resolver.current?.(false);
    resolver.current = resolve;
    definirMensagem(texto);
  }), []);
  const dialogo = <AlertDialog open={mensagem !== null} onOpenChange={aberto => { if (!aberto) concluir(false); }}>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar alteração do laudo</AlertDialogTitle>
      <AlertDialogDescription>{mensagem}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel onClick={() => concluir(false)}>Cancelar</AlertDialogCancel>
        <AlertDialogAction onClick={() => concluir(true)}>Confirmar</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
  return { confirmar, dialogo };
}
