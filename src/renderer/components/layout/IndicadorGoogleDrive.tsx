import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { CircleCheck, CircleHelp, Cloud, RefreshCw, TriangleAlert, Unplug } from 'lucide-react';
import type { EstadoGoogleDrive } from '@shared/types/google-drive.types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Aparencia = 'desconectado' | 'disponivel' | 'local' | 'atencao' | 'desconhecida';

interface ResumoIndicador {
  aparencia: Aparencia;
  mensagem: string;
  orientacao?: string;
}

const apresentacao = {
  desconhecida: { icone: CircleHelp, classe: 'text-sidebar-foreground/70', painel: 'border-border bg-muted/40', destaque: 'bg-muted text-muted-foreground', titulo: 'text-foreground', texto: 'text-muted-foreground' },
  disponivel: { icone: CircleCheck, classe: 'text-emerald-400 dark:text-emerald-400', painel: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40', destaque: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-400', titulo: 'text-emerald-950 dark:text-emerald-100', texto: 'text-emerald-800 dark:text-emerald-200' },
  local: { icone: Cloud, classe: 'text-sky-400 dark:text-sky-400', painel: 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40', destaque: 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-400', titulo: 'text-sky-950 dark:text-sky-100', texto: 'text-sky-800 dark:text-sky-200' },
  atencao: { icone: TriangleAlert, classe: 'text-amber-400 dark:text-amber-400', painel: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40', destaque: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-400', titulo: 'text-amber-950 dark:text-amber-100', texto: 'text-amber-800 dark:text-amber-200' },
  desconectado: { icone: Unplug, classe: 'text-red-400 dark:text-red-400', painel: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40', destaque: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-400', titulo: 'text-red-950 dark:text-red-100', texto: 'text-red-800 dark:text-red-200' },
};

function resumirEstado(estado: EstadoGoogleDrive | null, confirmado: boolean, falhaConsulta?: string): ResumoIndicador {
  if (!estado) return falhaConsulta ? { aparencia: 'atencao', mensagem: 'Não foi possível consultar o Google Drive', orientacao: falhaConsulta } : { aparencia: 'desconhecida', mensagem: 'Estado do Google Drive ainda não disponível' };

  const requerAtencao = estado.falhaFila || estado.filaAguardaCorrecao || estado.filaAguardaEspaco
    || estado.protecaoChave === 'indisponivel' || estado.protecaoChave === 'reconexao_necessaria' || estado.protecaoChave === 'migracao_pendente';
  if (requerAtencao) {
    const orientacao = estado.falhaFila ?? (estado.filaAguardaEspaco ? 'A fila de envios aguarda espaço disponível no Google Drive.' : undefined) ?? (estado.filaAguardaCorrecao ? 'Há envios aguardando uma correção.' : undefined) ?? estado.aviso;
    return { aparencia: 'atencao', mensagem: 'Google Drive requer atenção', orientacao };
  }
  if (!estado.conectado) return { aparencia: 'desconectado', mensagem: 'Google Drive não conectado', orientacao: estado.aviso ?? 'Abra o Google Drive para conectar uma conta.' };
  if (!confirmado) return { aparencia: 'local', mensagem: 'Conta configurada localmente', orientacao: falhaConsulta ?? 'Abra este painel para confirmar o acesso ao Google Drive.' };
  if (estado.pendencias > 0) return { aparencia: 'local', mensagem: `${estado.pendencias} envio${estado.pendencias === 1 ? '' : 's'} pendente${estado.pendencias === 1 ? '' : 's'}`, orientacao: 'A conta está acessível e a fila será processada conforme a configuração.' };
  return { aparencia: 'disponivel', mensagem: 'Google Drive conectado', orientacao: estado.envioAutomatico ? 'Envio automático ativado.' : 'Envio automático desativado.' };
}

export function IndicadorGoogleDrive() {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<EstadoGoogleDrive | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [falhaConsulta, setFalhaConsulta] = useState<string>();
  const [verificadoEm, setVerificadoEm] = useState<string>();
  const montado = useRef(true);
  const navegar = useNavigate();

  const carregarRapido = useCallback(async () => {
    const api = window.ipcAPI.googleDrive;
    if (!api) {
      if (montado.current) setFalhaConsulta('A integração com o Google Drive não está disponível neste ambiente.');
      return;
    }
    const resposta = await api.estadoRapido();
    if (!montado.current) return;
    if (resposta.success && resposta.data) {
      setEstado(resposta.data);
      setFalhaConsulta(undefined);
    } else setFalhaConsulta(resposta.error ?? 'Não foi possível consultar o estado salvo do Google Drive.');
  }, []);

  const atualizarEstado = useCallback(async () => {
    const api = window.ipcAPI.googleDrive;
    if (!api) {
      if (montado.current) setFalhaConsulta('A integração com o Google Drive não está disponível neste ambiente.');
      return;
    }
    setVerificando(true);
    try {
      const resposta = await api.estado();
      if (!montado.current) return;
      if (resposta.success && resposta.data) {
        setEstado(resposta.data);
        setConfirmado(true);
        setVerificadoEm(new Date().toISOString());
        setFalhaConsulta(undefined);
      } else {
        setConfirmado(false);
        setFalhaConsulta(resposta.error ?? 'Não foi possível confirmar o acesso ao Google Drive.');
      }
    } finally {
      if (montado.current) setVerificando(false);
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    void carregarRapido();
    const intervalo = window.setInterval(() => void carregarRapido(), 30_000);
    const aoReceberFoco = () => void carregarRapido();
    window.addEventListener('focus', aoReceberFoco);
    return () => {
      montado.current = false;
      window.clearInterval(intervalo);
      window.removeEventListener('focus', aoReceberFoco);
    };
  }, [carregarRapido]);

  useEffect(() => { if (aberto) void atualizarEstado(); }, [aberto, atualizarEstado]);

  const resumo = useMemo(() => resumirEstado(estado, confirmado, falhaConsulta), [confirmado, estado, falhaConsulta]);
  const visual = apresentacao[resumo.aparencia];
  const { icone: Icone, classe } = visual;

  return <TooltipProvider><Popover open={aberto} onOpenChange={setAberto}>
    <Tooltip><TooltipTrigger asChild><PopoverTrigger asChild>
      <button type="button" aria-label={`Drive: ${resumo.mensagem}`} className="flex h-8 w-[72px] shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span>Drive</span><Icone className={`h-4 w-4 ${classe}`} aria-hidden="true" /></button>
    </PopoverTrigger></TooltipTrigger><TooltipContent>Drive: {resumo.mensagem}</TooltipContent></Tooltip>
    <PopoverContent align="end" className="w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl p-0 shadow-lg" aria-label="Estado do Google Drive">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4"><h2 className="text-xs font-semibold text-muted-foreground">Google Drive</h2>{estado?.email && <span className="max-w-52 truncate text-xs text-muted-foreground" title={estado.email}>{estado.email}</span>}</div>
      <div aria-live="polite" className={`m-3 flex items-start gap-3 rounded-lg border p-3.5 ${visual.painel}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${visual.destaque}`}><Icone className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0 space-y-1.5 pt-0.5"><p className={`text-sm font-semibold leading-5 ${visual.titulo}`}>{resumo.mensagem}</p>{resumo.orientacao && <p className={`text-xs leading-relaxed ${visual.texto}`}>{resumo.orientacao}</p>}{verificando && <p className={`text-xs ${visual.texto}`}>Atualizando estado…</p>}</div></div>
      <div role="status" aria-live="polite" aria-atomic="true" className="space-y-1.5 px-4 pb-3 text-xs text-muted-foreground"><p>{confirmado && verificadoEm ? `Acesso confirmado às ${new Date(verificadoEm).toLocaleTimeString('pt-BR')}.` : 'O indicador mostra o estado local até confirmar o acesso ao Drive.'}</p>{estado && <p>{estado.pendencias} envio{estado.pendencias === 1 ? '' : 's'} pendente{estado.pendencias === 1 ? '' : 's'} · envio automático {estado.envioAutomatico ? 'ativado' : 'desativado'}.</p>}</div>
      <div className="grid grid-cols-2 gap-2 border-t bg-muted/30 p-3"><Button size="sm" variant="outline" className="w-full gap-1.5" disabled={verificando} onClick={() => void atualizarEstado()}><RefreshCw className={verificando ? 'animate-spin' : ''} aria-hidden="true" />Atualizar estado</Button><Button size="sm" variant={resumo.aparencia === 'atencao' || resumo.aparencia === 'desconectado' ? 'default' : 'ghost'} className="w-full gap-1.5" onClick={() => { setAberto(false); navegar('/backup?aba=google-drive'); }}><Cloud aria-hidden="true" />Abrir Google Drive</Button></div>
    </PopoverContent>
  </Popover></TooltipProvider>;
}
