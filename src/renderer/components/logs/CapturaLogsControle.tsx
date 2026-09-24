import { useCallback, useEffect, useState } from 'react';
import { Activity, OctagonAlert, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import type { EstadoCapturaLogs, SondaCapturaLogs } from '@shared/captura-logs/contratos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const nomesSondas: Record<SondaCapturaLogs, string> = {
  sistema: 'Sistema',
  auditoria: 'Auditoria',
  linha_tempo: 'Linha do tempo',
  desempenho: 'Desempenho',
};

interface CapturaLogsControleProps {
  sondas: SondaCapturaLogs[];
  compacto?: boolean;
}

export function CapturaLogsControle({ sondas, compacto = false }: CapturaLogsControleProps) {
  const [estado, setEstado] = useState<EstadoCapturaLogs>({ ativa: null });
  const [agora, setAgora] = useState(Date.now());
  const carregar = useCallback(async () => {
    const resposta = await window.ipcAPI.capturaLogs.estado();
    if (resposta.success && resposta.data) setEstado(resposta.data);
  }, []);

  useEffect(() => {
    void carregar();
    return window.ipcAPI.capturaLogs.onEstadoAlterado(setEstado);
  }, [carregar]);
  useEffect(() => {
    if (!estado.ativa) return;
    const temporizador = window.setInterval(() => setAgora(Date.now()), 1_000);
    return () => window.clearInterval(temporizador);
  }, [estado.ativa]);

  const iniciar = async () => {
    const resposta = await window.ipcAPI.capturaLogs.iniciar(sondas);
    if (!resposta.success) return toast.error(resposta.error || 'Não foi possível iniciar a captura.');
    toast.success('Captura iniciada por até 5 minutos.');
  };
  const parar = async () => {
    const resposta = await window.ipcAPI.capturaLogs.parar();
    if (!resposta.success) return toast.error(resposta.error || 'Não foi possível encerrar a captura.');
    toast.success('Captura encerrada e preservada.');
  };
  const marcar = async () => {
    const resposta = await window.ipcAPI.capturaLogs.marcarProblema();
    if (!resposta.success) return toast.error(resposta.error || 'Não foi possível registrar o marcador.');
    toast.success('Marcador registrado.');
  };

  const restante = estado.ativa ? Math.max(0, Math.ceil((Date.parse(estado.ativa.terminaEm) - agora) / 1_000)) : null;
  const titulo = sondas.length === 4 ? 'Captura completa de logs' : `Sonda: ${sondas.map(sonda => nomesSondas[sonda]).join(', ')}`;
  const descricao = estado.ativa
    ? `Ativa: ${estado.ativa.sondas.map(sonda => nomesSondas[sonda]).join(', ')}.`
    : 'A captura é local, limitada e exporta apenas metadados anonimizados.';
  const controles = <div className="flex flex-wrap items-center gap-2">
    {estado.ativa ? <>
      <Badge variant="default">Captura ativa</Badge>
      {restante !== null && <span className="text-xs text-muted-foreground">{Math.floor(restante / 60)}m {restante % 60}s restantes</span>}
      <Button variant="outline" size="sm" onClick={parar}><Square className="mr-2 h-4 w-4" />Parar captura</Button>
      <Button variant="secondary" size="sm" onClick={marcar}><OctagonAlert className="mr-2 h-4 w-4" />Problema aconteceu agora</Button>
    </> : <Button size="sm" onClick={iniciar}><Play className="mr-2 h-4 w-4" />Iniciar captura</Button>}
  </div>;

  if (compacto) return controles;
  return <Card>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4" />{titulo}</CardTitle>
      <CardDescription>{descricao}</CardDescription>
    </CardHeader>
    <CardContent>{controles}</CardContent>
  </Card>;
}
