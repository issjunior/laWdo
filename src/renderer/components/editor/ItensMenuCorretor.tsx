import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ContextMenuItem, ContextMenuLabel } from '@/components/ui/context-menu';
import { notificarEstadoCorretor, observarEstadoCorretor, type ContextoCorrecao } from '@/lib/corretor-editor';

export function ItensMenuCorretor({ correcao }: { correcao: ContextoCorrecao }) {
  const [correcaoComErro, definirCorrecaoComErro] = useState<ContextoCorrecao | null>(null);
  const [invalidada, definirInvalidada] = useState<ContextoCorrecao | null>(null);
  const valida = invalidada !== correcao;
  const erro = correcaoComErro === correcao;

  useEffect(() => observarEstadoCorretor(() => definirInvalidada(correcao)), [correcao]);

  return <>
    <ContextMenuLabel>Ortografia: {correcao.palavra}</ContextMenuLabel>
    {correcao.sugestoes.length === 0 && <ContextMenuItem disabled>Sem sugestões</ContextMenuItem>}
    {correcao.sugestoes.map(sugestao => <ContextMenuItem key={sugestao} disabled={!valida} onSelect={evento => {
      if (!correcao.aplicar(sugestao)) {
        evento.preventDefault();
        definirCorrecaoComErro(correcao);
      }
    }}>{sugestao}</ContextMenuItem>)}
    <ContextMenuItem disabled={!valida} onSelect={() => {
      void window.ipcAPI.corretor.adicionar(correcao.palavra).then(resposta => {
        if (resposta.success) notificarEstadoCorretor(resposta.data);
        else toast.error(resposta.error);
      }).catch(() => toast.error('Não foi possível adicionar a palavra.'));
    }}>Adicionar ao dicionário</ContextMenuItem>
    {(!valida || erro) && <p role="alert" className="px-2 py-1 text-xs text-destructive">
      {!valida ? 'As opções do corretor mudaram. Clique novamente na palavra.' : 'O texto mudou ou está protegido. Clique novamente na palavra.'}
    </p>}
  </>;
}
