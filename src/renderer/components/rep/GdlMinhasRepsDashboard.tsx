import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GdlConsultaEmAndamento } from '@/components/rep/GdlConsultaEmAndamento';
import { GdlStatusBadge } from '@/components/rep/GdlStatusBadge';
import type { MinhaRepGdl, SnapshotMinhasRepsGdl, StatusMinhaRepGdl } from '@shared/types/gdl-minhas-reps.types';

const statusDisponiveis: StatusMinhaRepGdl[] = ['Aberta e Distribuída', 'Laudo em Execução', 'Concluída e Não Remetida'];
const esquemaSnapshot = z.object({
  atualizadoEm: z.string().datetime(),
  reps: z.array(z.object({
    idGdl: z.number().int().positive(), numero: z.string().regex(/^\d+$/), ano: z.string().regex(/^\d{4}$/),
    naturezaExame: z.string().min(1), naturezaExameComCodigo: z.string().min(1).nullable(),
    status: z.enum(statusDisponiveis), dataDesignacao: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(),
    quantidadeFotos: z.number().int().nonnegative().nullable(),
  })),
});

function formatarData(valor: string | null): string {
  if (!valor) return 'Não informada';
  return `${valor.slice(8, 10)}/${valor.slice(5, 7)}/${valor.slice(0, 4)} ${valor.slice(11, 16)}`;
}

export function GdlMinhasRepsDashboard() {
  const navegar = useNavigate();
  const [snapshot, setSnapshot] = useState<SnapshotMinhasRepsGdl | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusMinhaRepGdl | 'todos'>('todos');
  const [natureza, setNatureza] = useState('todos');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');

  const atualizar = useCallback(async (forcar: boolean) => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await window.ipcAPI.gdl.atualizarMinhasRepsCache(forcar);
      if (!resposta.success) throw new Error(resposta.error || 'Não foi possível consultar o GDL.');
      const validacao = esquemaSnapshot.safeParse(resposta.data);
      if (!validacao.success) throw new Error('A lista do GDL retornou um formato inesperado.');
      setSnapshot(validacao.data);
    } catch (falha: unknown) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível acessar o GDL.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    void window.ipcAPI.gdl.obterMinhasRepsCache().then(resposta => {
      if (!ativo) return;
      const validacao = esquemaSnapshot.safeParse(resposta.data);
      if (resposta.success && validacao.success) setSnapshot(validacao.data);
    }).catch(() => undefined).finally(() => { if (ativo) void atualizar(false); });
    return () => { ativo = false; };
  }, [atualizar]);

  const naturezas = useMemo(() => [...new Set(snapshot?.reps.map(rep => rep.naturezaExameComCodigo ?? rep.naturezaExame) ?? [])]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [snapshot]);
  const intervaloInvalido = Boolean(dataInicial && dataFinal && dataInicial > dataFinal);
  const filtradas = useMemo(() => [...(snapshot?.reps ?? [])].filter(rep => {
    if (intervaloInvalido || (status !== 'todos' && rep.status !== status)) return false;
    if (natureza !== 'todos' && (rep.naturezaExameComCodigo ?? rep.naturezaExame) !== natureza) return false;
    const dia = rep.dataDesignacao?.slice(0, 10);
    return (!dataInicial || Boolean(dia && dia >= dataInicial)) && (!dataFinal || Boolean(dia && dia <= dataFinal));
  }).sort((a, b) => (b.dataDesignacao ?? '').localeCompare(a.dataDesignacao ?? '')), [snapshot, intervaloInvalido, status, natureza, dataInicial, dataFinal]);

  const selecionar = (rep: MinhaRepGdl) => {
    navegar('/reps', { state: { importarGdl: { numero: rep.numero, ano: rep.ano } } });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span>{snapshot ? `${filtradas.length} de ${snapshot.reps.length} REPs · Atualizado em ${new Date(snapshot.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Nenhuma lista salva'}</span>
          {carregando && <GdlConsultaEmAndamento />}
        </div>
        <Button variant="outline" size="sm" disabled={carregando} onClick={() => void atualizar(true)}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
      </div>
      {erro && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-amber-400/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
        <AlertTriangle className="h-4 w-4" />
        <span>Não foi possível atualizar pelo GDL. Verifique a rede, a VPN e as credenciais. {snapshot ? 'A lista salva pode estar desatualizada.' : erro}</span>
        <Button variant="outline" size="sm" onClick={() => navegar('/gdl-config')}>Configurar GDL</Button>
      </div>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div><Label htmlFor="gdl-dashboard-status">Status</Label><Select value={status} onValueChange={valor => setStatus(statusDisponiveis.find(item => item === valor) ?? 'todos')}><SelectTrigger id="gdl-dashboard-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os status</SelectItem>{statusDisponiveis.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="gdl-dashboard-natureza">Natureza</Label><Select value={natureza} onValueChange={setNatureza}><SelectTrigger id="gdl-dashboard-natureza"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os exames</SelectItem>{naturezas.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="gdl-dashboard-inicio">Designação de</Label><Input id="gdl-dashboard-inicio" type="date" value={dataInicial} onChange={evento => setDataInicial(evento.target.value)} /></div>
        <div><Label htmlFor="gdl-dashboard-fim">Designação até</Label><Input id="gdl-dashboard-fim" type="date" value={dataFinal} onChange={evento => setDataFinal(evento.target.value)} /></div>
      </div>
      {intervaloInvalido && <p className="text-sm text-destructive">A data inicial deve ser anterior ou igual à final.</p>}
      <div className="max-h-96 overflow-y-auto rounded-md border divide-y">
        {filtradas.map(rep => <button key={rep.idGdl} type="button" onClick={() => selecionar(rep)} className="grid w-full gap-1 p-3 text-left text-sm hover:bg-accent sm:grid-cols-[minmax(9rem,1fr)_minmax(11rem,1fr)_minmax(12rem,2fr)_6rem]">
          <span><strong>REP {rep.numero}/{rep.ano}</strong><br /><span className="text-xs text-muted-foreground">{formatarData(rep.dataDesignacao)}</span></span>
          <span><GdlStatusBadge status={rep.status} /></span><span>{rep.naturezaExameComCodigo ?? rep.naturezaExame}</span>
          <span>{rep.quantidadeFotos ?? '—'} fotos</span>
        </button>)}
        {snapshot && filtradas.length === 0 && <p className="p-5 text-center text-sm text-muted-foreground">Nenhuma REP corresponde aos filtros.</p>}
        {!snapshot && !carregando && <p className="p-5 text-center text-sm text-muted-foreground">Nenhuma lista disponível. Use Atualizar para tentar novamente.</p>}
      </div>
    </div>
  );
}
