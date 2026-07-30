import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowLeft, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EstadoPainelIa {
  revisao: number;
  titulo?: string;
  status?: string;
}

export default function PainelIaWindow() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [estado, setEstado] = useState<EstadoPainelIa | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const remover = window.ipcAPI.ia.onPainelEstado((proximoEstado: unknown) => {
      if (!proximoEstado || typeof proximoEstado !== 'object') return;
      const candidato = proximoEstado as Partial<EstadoPainelIa>;
      if (typeof candidato.revisao !== 'number') return;
      const revisao = candidato.revisao;
      if (typeof revisao !== 'number') return;
      setEstado(atual => (!atual || revisao > atual.revisao ? candidato as EstadoPainelIa : atual));
    });
    window.ipcAPI.ia.painelPronto();
    return remover;
  }, [sessionId]);

  if (!sessionId) {
    return <div className="p-6 text-sm text-destructive">Sessão do painel inválida.</div>;
  }

  return (
    <main className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-primary" />
          <div>
            <h1 className="text-sm font-semibold">Assistente IA</h1>
            <p className="text-xs text-muted-foreground">{estado?.titulo || 'Aguardando sincronização do editor...'}</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => window.ipcAPI.ia.painelReencaixar()}>
          <ArrowLeft className="size-4" />
          Reencaixar
        </Button>
      </header>
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {estado ? estado.status || 'Painel sincronizado.' : 'Conectando ao editor...'}
      </div>
    </main>
  );
}
