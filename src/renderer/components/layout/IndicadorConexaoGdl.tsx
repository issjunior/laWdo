import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CircleHelp, CircleCheck, TriangleAlert, Unplug, RefreshCw } from 'lucide-react';
import { aparenciaConexaoGdl } from '@shared/gdl/conexao';
import { useConexaoGdl } from '@/hooks/useConexaoGdl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const apresentacao = {
  desconhecida: { icone: CircleHelp, classe: 'text-muted-foreground', descricao: 'Estado desconhecido ou desatualizado' },
  disponivel: { icone: CircleCheck, classe: 'text-emerald-700 dark:text-emerald-400', descricao: 'Acessível com credenciais validadas' },
  atencao: { icone: TriangleAlert, classe: 'text-amber-700 dark:text-amber-400', descricao: 'Acessível com pendências' },
  indisponivel: { icone: Unplug, classe: 'text-destructive', descricao: 'Indisponível na última verificação' },
};

const descricoesCredenciais = {
  ausentes: 'Não configuradas', pendentes: 'Validação pendente', validadas: 'Validadas', rejeitadas: 'Autenticação rejeitada',
};
const formatador = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
const formatarData = (valor?: string | null) => valor ? formatador.format(new Date(valor)) : 'Ainda não realizada';

export function IndicadorConexaoGdl() {
  const { estado, erro, verificando, agora, verificarAgora } = useConexaoGdl();
  const [aberto, setAberto] = useState(false);
  const navegar = useNavigate();
  const aparencia = aparenciaConexaoGdl(estado, agora);
  const { icone: Icone, classe, descricao } = apresentacao[aparencia];
  const descricaoRede = aparencia === 'desconhecida' ? descricao
    : estado?.rede === 'acessivel' ? 'Servidor acessível' : 'Servidor indisponível; confira rede ou VPN';

  return (
    <TooltipProvider>
      <Popover open={aberto} onOpenChange={setAberto}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button type="button" aria-label={`GDL: ${descricao}`} className="flex h-8 w-16 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span>GDL</span><Icone className={`h-4 w-4 ${classe}`} aria-hidden="true" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>GDL: {descricao}</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] space-y-3" aria-label="Conexão com o GDL">
          <div>
            <h2 className="text-sm font-semibold">Conexão com o GDL</h2>
            {estado ? (
              <Badge variant={estado.ambiente === 'producao' ? 'destructive' : 'secondary'}>
                {estado.ambiente === 'producao' ? 'Produção' : 'Homologação'}
              </Badge>
            ) : <p className="text-xs text-muted-foreground">Carregando ambiente</p>}
          </div>
          <dl className="space-y-2 text-xs">
            <div><dt className="text-muted-foreground">Disponibilidade</dt><dd>{estado?.rede === 'acessivel' && aparencia !== 'desconhecida'
              ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Servidor acessível</Badge>
              : descricaoRede}</dd></div>
            <div><dt className="text-muted-foreground">Credenciais da API</dt><dd>{estado ? descricoesCredenciais[estado.credenciais] : 'Ainda não verificadas'}</dd></div>
            <div><dt className="text-muted-foreground">Última validação das credenciais</dt><dd>{formatarData(estado?.credenciaisValidadasEm)}</dd></div>
            <div><dt className="text-muted-foreground">Última checagem de rede</dt><dd>{formatarData(estado?.redeVerificadaEm)}</dd></div>
            <div><dt className="text-muted-foreground">Acesso web</dt><dd>{estado?.web === 'atencao' ? 'Falha parcial; a disponibilidade da API é independente'
              : estado?.web === 'disponivel' ? 'Último acesso bem-sucedido' : 'Ainda não observado'}</dd></div>
          </dl>
          <div aria-live="polite" className="text-xs text-muted-foreground">
            {verificando && <p>Verificando a rede…</p>}
            {erro && <p className="text-destructive">{erro}</p>}
          </div>
          <p className="text-xs text-muted-foreground">A validação pode ser de um acesso anterior. Cada operação depende das permissões no GDL.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={verificando} onClick={() => void verificarAgora()}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${verificando ? 'animate-spin' : ''}`} aria-hidden="true" />Verificar agora
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAberto(false); navegar('/gdl-config'); }}>Abrir API GDL</Button>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
