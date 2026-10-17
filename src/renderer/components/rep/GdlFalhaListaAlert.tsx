import { useState } from 'react';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { codigosFalhaListaRepsGdl, etapasFalhaListaRepsGdl, codigosSistemaFalhaGdl } from '@shared/types/gdl-minhas-reps.types';
import type { CodigoFalhaListaRepsGdl, FalhaListaRepsGdl } from '@shared/types/gdl-minhas-reps.types';

const esquemaFalha = z.object({
  falha: z.object({
    codigo: z.enum(codigosFalhaListaRepsGdl),
    detalhes: z.string().min(1).max(240),
    referencia: z.string().uuid(),
    etapa: z.enum(etapasFalhaListaRepsGdl).optional(),
    codigoSistema: z.enum(codigosSistemaFalhaGdl).optional(),
    statusHttp: z.number().int().min(100).max(599).optional(),
    bloqueioTemporario: z.boolean().optional(),
    tentarNovamenteEmSegundos: z.number().int().min(1).max(60).optional(),
  }),
});

export interface FalhaListaGdlApresentavel extends Omit<FalhaListaRepsGdl, 'referencia'> {
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

const orientacoes: Record<CodigoFalhaListaRepsGdl, string> = {
  desativada: 'Ative a listagem na página API GDL para ver suas REPs.',
  credenciais: 'Informe seu usuário e sua senha na página API GDL.',
  autenticacao: 'Confira o usuário e a senha cadastrados na página API GDL.',
  rede: 'Verifique a conexão e conecte a VPN, se necessária, antes de tentar novamente.',
  tempo_esgotado: 'O GDL não respondeu a tempo. Aguarde um pouco e tente novamente.',
  limite_gdl: 'Aguarde alguns minutos antes de consultar novamente.',
  servidor: 'O serviço do GDL está indisponível no momento. Tente mais tarde.',
  sessao: 'Atualize a lista para restabelecer o acesso ao GDL.',
  estrutura: 'A resposta do GDL não pôde ser lida. Tente novamente mais tarde.',
  detalhes_reps: 'Algumas informações não puderam ser confirmadas. Tente atualizar novamente.',
  lista_inconsistente: 'Atualize a lista para obter as informações mais recentes.',
  cache_local: 'Não foi possível guardar a lista neste computador. Tente novamente.',
  inesperado: 'Tente atualizar novamente. Se o problema continuar, consulte os logs.',
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
      <AlertDescription className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p role="alert" className="min-w-0 flex-[1_1_20rem]">{mensagens[falha.codigo]} {listaSalva ? 'Exibindo a última lista salva.' : 'Nenhuma lista salva disponível.'}{falha.bloqueioTemporario && falha.tentarNovamenteEmSegundos ? ` Nova tentativa disponível em até ${falha.tentarNovamenteEmSegundos} s.` : ''}</p>
          <div className="flex shrink-0 flex-wrap gap-2">
            {falha.codigo !== 'desativada' && <Button variant="outline" size="sm" onClick={onTentarNovamente}>Tentar novamente</Button>}
            {configurarCredenciais && <Button variant="outline" size="sm" onClick={onConfigurarCredenciais}>{falha.codigo === 'desativada' ? 'Abrir API GDL' : 'Configurar GDL'}</Button>}
            <Button variant="outline" size="sm" aria-expanded={detalhesAbertos} onClick={() => setDetalhesAbertos(!detalhesAbertos)}>
              {detalhesAbertos ? 'Ocultar detalhes' : 'Detalhes'}
            </Button>
          </div>
        </div>
        {detalhesAbertos && <div className="max-w-full overflow-x-auto whitespace-nowrap rounded-md border bg-background p-2 text-xs text-muted-foreground">
          {orientacoes[falha.codigo]}
        </div>}
      </AlertDescription>
    </Alert>
  );
}
