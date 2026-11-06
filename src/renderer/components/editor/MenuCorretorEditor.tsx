import { useState, type ReactNode } from 'react';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import { obterContextoCorrecao, type ContextoCorrecao } from '@/lib/corretor-editor';
import { ItensMenuCorretor } from './ItensMenuCorretor';

export function MenuCorretorEditor({ editorId, children }: { editorId: string; children: ReactNode }) {
  const [correcao, definirCorrecao] = useState<ContextoCorrecao | null>(null);

  return <ContextMenu>
    <ContextMenuTrigger asChild onContextMenuCapture={evento => {
      const contexto = obterContextoCorrecao(editorId);
      definirCorrecao(contexto);
      if (!contexto) evento.preventDefault();
    }}>{children}</ContextMenuTrigger>
    {correcao && <ContextMenuContent className="w-64" onCloseAutoFocus={evento => {
      evento.preventDefault();
      correcao.restaurarFoco();
    }}>
      <ItensMenuCorretor correcao={correcao} />
    </ContextMenuContent>}
  </ContextMenu>;
}
