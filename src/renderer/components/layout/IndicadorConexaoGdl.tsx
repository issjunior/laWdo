import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CircleHelp, CircleCheck, TriangleAlert, Unplug, RefreshCw, Settings2 } from 'lucide-react';
import { useConexaoGdl } from '@/hooks/useConexaoGdl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const apresentacao = {
  desconhecida: {
    icone: CircleHelp, classe: 'text-sidebar-foreground/70',
    painel: 'border-border bg-muted/40', destaque: 'bg-muted text-muted-foreground',
    titulo: 'text-foreground', texto: 'text-muted-foreground',
  },
  disponivel: {
    icone: CircleCheck, classe: 'text-emerald-400 dark:text-emerald-400',
    painel: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
    destaque: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-400',
    titulo: 'text-emerald-950 dark:text-emerald-100', texto: 'text-emerald-800 dark:text-emerald-200',
  },
  acessivel: {
    icone: CircleCheck, classe: 'text-sky-400 dark:text-sky-400',
    painel: 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40',
    destaque: 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-400',
    titulo: 'text-sky-950 dark:text-sky-100', texto: 'text-sky-800 dark:text-sky-200',
  },
  atencao: {
    icone: TriangleAlert, classe: 'text-amber-400 dark:text-amber-400',
    painel: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
    destaque: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-400',
    titulo: 'text-amber-950 dark:text-amber-100', texto: 'text-amber-800 dark:text-amber-200',
  },
  indisponivel: {
    icone: Unplug, classe: 'text-red-400 dark:text-red-400',
    painel: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
    destaque: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-400',
    titulo: 'text-red-950 dark:text-red-100', texto: 'text-red-800 dark:text-red-200',
  },
};

export function IndicadorConexaoGdl() {
  const { estado, resumo, verificando, verificarAgora } = useConexaoGdl();
  const [aberto, setAberto] = useState(false);
  const navegar = useNavigate();
  const visual = apresentacao[resumo.aparencia];
  const { icone: Icone, classe } = visual;

  return (
    <TooltipProvider>
      <Popover open={aberto} onOpenChange={setAberto}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button type="button" aria-label={`GDL: ${resumo.mensagem}`} className="flex h-8 w-16 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span>GDL</span><Icone className={`h-4 w-4 ${classe}`} aria-hidden="true" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>GDL: {resumo.mensagem}</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl p-0 shadow-lg" aria-label="Conexão com o GDL">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
            <h2 className="text-xs font-semibold text-muted-foreground">Conexão com o GDL</h2>
            {estado?.ambiente === 'homologacao' && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Ambiente de testes</Badge>}
          </div>
          <div aria-live="polite" className={`m-3 flex items-start gap-3 rounded-lg border p-3.5 ${visual.painel}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${visual.destaque}`}>
              <Icone className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1.5 pt-0.5">
              <p className={`text-sm font-semibold leading-5 ${visual.titulo}`}>{resumo.mensagem}</p>
              {resumo.orientacao && <p className={`text-xs leading-relaxed ${visual.texto}`}>{resumo.orientacao}</p>}
              {verificando && <p className={`text-xs ${visual.texto}`}>Testando conexão…</p>}
            </div>
          </div>
          <div role="status" aria-live="polite" aria-atomic="true" className="space-y-1.5 px-4 pb-3 text-xs text-muted-foreground">
            {!verificando && estado?.ultimoTesteRede && <>
              <p className="font-medium text-foreground">{estado.ultimoTesteRede.sucesso ? 'Rede acessível' : 'Não foi possível confirmar o acesso pela rede'}</p>
              <p>Último teste às {new Date(estado.ultimoTesteRede.verificadoEm).toLocaleTimeString('pt-BR')} · {estado.ultimoTesteRede.duracaoMs} ms</p>
            </>}
            <p>Este teste verifica o alcance da rede. Não valida credenciais nem a recuperação dos dados.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t bg-muted/30 p-3">
            <Button size="sm" variant="outline" className="w-full gap-1.5" disabled={verificando} onClick={() => void verificarAgora()}>
              <RefreshCw className={verificando ? 'animate-spin' : ''} aria-hidden="true" />Testar Conexão
            </Button>
            <Button size="sm" variant={resumo.aparencia === 'atencao' ? 'default' : 'ghost'} className="w-full gap-1.5" onClick={() => { setAberto(false); navegar('/gdl-config'); }}>
              <Settings2 aria-hidden="true" />Configurar GDL
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
