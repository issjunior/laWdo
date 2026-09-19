import { useCallback, useEffect, useState } from 'react';
import { Activity, Download, OctagonAlert, Play, Square } from 'lucide-react';
import type { AmostraDesempenho, EstadoCapturaDesempenho } from '@shared/desempenho/contratos';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function DesempenhoTab() {
  const [estado, setEstado] = useState<EstadoCapturaDesempenho | null>(null);
  const [amostras, setAmostras] = useState<AmostraDesempenho[]>([]);
  const [agora, setAgora] = useState(Date.now());

  const carregar = useCallback(async () => {
    const [estadoResposta, listaResposta] = await Promise.all([window.ipcAPI.desempenho.estado(), window.ipcAPI.desempenho.listar()]);
    if (estadoResposta.success && estadoResposta.data) setEstado(estadoResposta.data);
    if (listaResposta.success && listaResposta.data) setAmostras(listaResposta.data);
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    if (!estado?.sessao?.ativa) return;
    const temporizador = window.setInterval(() => setAgora(Date.now()), 1_000);
    return () => window.clearInterval(temporizador);
  }, [estado?.sessao?.ativa]);

  const iniciar = async () => {
    const resposta = await window.ipcAPI.desempenho.iniciarDetalhada();
    if (!resposta.success) return toast.error(resposta.error || 'Não foi possível iniciar a captura.');
    toast.success('Captura detalhada iniciada por até 15 minutos.');
    await carregar();
  };
  const parar = async () => {
    await window.ipcAPI.desempenho.pararDetalhada();
    toast.success('Captura detalhada encerrada.');
    await carregar();
  };
  const marcar = async () => {
    await window.ipcAPI.desempenho.marcarProblema();
    toast.success('Marcador registrado.');
    await carregar();
  };
  const exportar = async () => {
    const resposta = await window.ipcAPI.desempenho.exportarCsv();
    if (!resposta.success) return toast.error(resposta.error || 'Não foi possível exportar o CSV.');
    if (!resposta.canceled) toast.success('Diagnóstico exportado.');
  };

  const detalhada = estado?.sessao?.ativa ?? false;
  const restanteSegundos = estado?.sessao?.terminaEm ? Math.max(0, Math.ceil((Date.parse(estado.sessao.terminaEm) - agora) / 1_000)) : null;
  return <div className="mt-4 space-y-4">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" />Captura de desempenho</CardTitle>
        <CardDescription>Inicie a captura antes de abrir o laudo afetado. O diagnóstico é local e não registra conteúdo, textos, imagens, nomes ou caminhos de arquivos.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Select value={estado?.perfil ?? 'importante'} disabled={detalhada} onValueChange={async valor => {
          if (valor === 'importante' || valor === 'critico') {
            await window.ipcAPI.desempenho.configurarPerfil(valor);
            await carregar();
          }
        }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="importante">Importante</SelectItem>
            <SelectItem value="critico">Crítico</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant={detalhada ? 'default' : 'secondary'}>{detalhada ? 'Detalhado ativo' : `Perfil ${estado?.perfil ?? 'importante'}`}</Badge>
        {restanteSegundos !== null && <span className="text-xs text-muted-foreground">{Math.floor(restanteSegundos / 60)}m {restanteSegundos % 60}s restantes</span>}
        {(estado?.eventosDescartados ?? 0) > 0 && <span className="text-xs text-amber-600">{estado?.eventosDescartados} evento(s) descartado(s) para proteger o desempenho.</span>}
        {detalhada ? <Button variant="outline" onClick={parar}><Square className="mr-2 h-4 w-4" />Parar captura</Button> : <Button onClick={iniciar}><Play className="mr-2 h-4 w-4" />Iniciar captura</Button>}
        <Button variant="secondary" onClick={marcar}><OctagonAlert className="mr-2 h-4 w-4" />Problema aconteceu agora</Button>
        <Button variant="outline" onClick={exportar}><Download className="mr-2 h-4 w-4" />Exportar diagnóstico CSV</Button>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="text-sm">Eventos recentes</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Horário</th><th className="p-2">Severidade</th><th className="p-2">Origem</th><th className="p-2">Operação</th><th className="p-2">Duração</th></tr></thead>
          <tbody>{amostras.slice(0, 100).map(amostra => <tr key={amostra.id} className="border-b"><td className="p-2">{new Date(amostra.timestamp).toLocaleString('pt-BR')}</td><td className="p-2"><Badge variant={amostra.severidade === 'critico' ? 'destructive' : 'secondary'}>{amostra.severidade}</Badge></td><td className="p-2">{amostra.origem}</td><td className="p-2">{amostra.operacao || amostra.canal || amostra.evento}</td><td className="p-2">{amostra.duracaoMs == null ? '—' : `${Math.round(amostra.duracaoMs)} ms`}</td></tr>)}</tbody>
        </table>
      </CardContent>
    </Card>
  </div>;
}
