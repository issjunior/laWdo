import { useState } from 'react';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { codigosFalhaListaRepsGdl } from '@shared/types/gdl-minhas-reps.types';
import type { CodigoFalhaListaRepsGdl } from '@shared/types/gdl-minhas-reps.types';

const esquemaFalha = z.object({
  falha: z.object({
    codigo: z.enum(codigosFalhaListaRepsGdl),
    detalhes: z.string().min(1).max(240),
    referencia: z.string().uuid(),
  }),
});

export interface FalhaListaGdlApresentavel {
  codigo: CodigoFalhaListaRepsGdl;
  detalhes: string;
  referencia?: string;
}

const mensagens: Record<CodigoFalhaListaRepsGdl, string> = {
  desativada: 'A listagem de REPs do GDL está desativada. Ative-a em API GDL para consultar novamente.',
  credenciais: 'Configure suas credenciais do GDL para consultar a lista de REPs.',
  autenticacao: 'O GDL não concluiu a autenticação. Confira suas credenciais e tente novamente.',
  rede: 'Não foi possível alcançar o GDL. Confira a conexão e a VPN.',
  tempo_esgotado: 'O GDL demorou a responder. Tente atualizar a lista novamente.',
  limite_gdl: 'O GDL limitou temporariamente as consultas. Aguarde um pouco antes de atualizar.',
  servidor: 'O GDL não disponibilizou a lista de REPs neste momento. Tente novamente mais tarde.',
  sessao: 'A sessão da lista no GDL expirou. Atualize a lista novamente.',
  estrutura: 'Uma página do GDL mudou de formato e não pôde ser lida.',
  detalhes_reps: 'A lista foi encontrada, mas não foi possível consultar o código de exame de todas as REPs.',
  lista_inconsistente: 'A lista ou a configuração do GDL mudou durante a consulta. Atualize novamente.',
  cache_local: 'A lista foi consultada, mas não pôde ser salva neste computador.',
  inesperado: 'Não foi possível atualizar a lista de REPs do GDL.',
};

export function normalizarFalhaListaGdl(resposta: unknown): FalhaListaGdlApresentavel {
  const validacao = esquemaFalha.safeParse(resposta);
  return validacao.success ? validacao.data.falha : {
    codigo: 'inesperado',
    detalhes: 'A resposta de erro não trouxe detalhes suficientes. Consulte o log do aplicativo.',
  };
}

interface GdlFalhaListaAlertProps {
  falha: FalhaListaGdlApresentavel;
  listaSalva: boolean;
  onTentarNovamente: () => void;
  onConfigurarCredenciais: () => void;
}

export function GdlFalhaListaAlert({ falha, listaSalva, onTentarNovamente, onConfigurarCredenciais }: GdlFalhaListaAlertProps) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const configurarCredenciais = falha.codigo === 'credenciais' || falha.codigo === 'autenticacao' || falha.codigo === 'desativada';

  return (
    <Alert className="shrink-0 border-amber-400/50 bg-amber-50 dark:bg-amber-950/30">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="space-y-2">
        <p role="alert">{mensagens[falha.codigo]} {listaSalva ? 'Exibindo a última lista salva.' : 'Nenhuma lista salva disponível.'}</p>
        <div className="flex flex-wrap gap-2">
          {falha.codigo !== 'desativada' && <Button variant="outline" size="sm" onClick={onTentarNovamente}>Tentar novamente</Button>}
          {configurarCredenciais && <Button variant="outline" size="sm" onClick={onConfigurarCredenciais}>{falha.codigo === 'desativada' ? 'Abrir API GDL' : 'Configurar GDL'}</Button>}
          <Button variant="ghost" size="sm" aria-expanded={detalhesAbertos} onClick={() => setDetalhesAbertos(!detalhesAbertos)}>
            {detalhesAbertos ? 'Ocultar detalhes' : 'Detalhes'}
          </Button>
        </div>
        {detalhesAbertos && <div className="rounded-md border bg-background p-2 text-xs text-muted-foreground">
          <p className="break-words">{falha.detalhes}</p>
          {falha.referencia && <p className="mt-1">Referência no log: {falha.referencia}</p>}
        </div>}
      </AlertDescription>
    </Alert>
  );
}
