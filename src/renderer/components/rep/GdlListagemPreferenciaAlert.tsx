import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface GdlListagemPreferenciaAlertProps {
  habilitada: boolean;
  cacheVisivel?: boolean;
  tentativaBloqueada?: boolean;
  onAbrirConfiguracao: () => void;
}

export function GdlListagemPreferenciaAlert({ habilitada, cacheVisivel, tentativaBloqueada, onAbrirConfiguracao }: GdlListagemPreferenciaAlertProps) {
  if (habilitada) {
    return <p className="text-xs text-amber-700 dark:text-amber-300">A listagem abre detalhes das REPs e pode marcá-las como “Laudo em Execução” no GDL.</p>;
  }

  return (
    <Alert className="border-amber-400/50 bg-amber-50 dark:bg-amber-950/30">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex flex-wrap items-center gap-2">
        <span role="alert">
          {tentativaBloqueada ? 'Consulta da lista bloqueada: a listagem do GDL está desativada. ' : 'Listagem do GDL desativada. '}
          {cacheVisivel
            ? 'Exibindo a lista salva há menos de 30 minutos, sem nova consulta. Abrir uma REP inicia uma consulta individual.'
            : 'Não há lista salva recente para exibir. Nenhuma nova consulta foi iniciada por esta tela.'}
        </span>
        <Button variant="outline" size="sm" onClick={onAbrirConfiguracao}>Abrir API GDL</Button>
      </AlertDescription>
    </Alert>
  );
}
