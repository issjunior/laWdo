import { useCallback, useEffect, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ResumoCapturaLogs } from '@shared/captura-logs/contratos';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const rotulosQualidade = {
  suficiente: 'Cobertura completa',
  parcial: 'Cobertura parcial',
  sem_evidencia: 'Sem evidências',
} as const;

export function HistoricoCapturasLogs() {
  const [capturas, setCapturas] = useState<ResumoCapturaLogs[]>([]);
  const carregar = useCallback(async () => {
    const resposta = await window.ipcAPI.capturaLogs.listar();
    if (resposta.success && resposta.data) setCapturas(resposta.data);
  }, []);

  useEffect(() => {
    void carregar();
    return window.ipcAPI.capturaLogs.onEstadoAlterado(() => { void carregar(); });
  }, [carregar]);

  if (!capturas.length) return null;
  return <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-sm">Capturas concluídas</CardTitle>
      <CardDescription>Exporte cada captura central em JSON. O histórico local guarda até 10 capturas e 50 MB.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-2">
      {capturas.map(captura => <div key={captura.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
        <div>
          <p className="font-medium">{new Date(captura.iniciadaEm).toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground">{captura.sondas.join(', ')} · {captura.quantidadeEventos} eventos · {rotulosQualidade[captura.qualidade]}</p>
          {!captura.coberturaSondas.every(sonda => sonda.possuiEvidencia) && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Sem eventos: {captura.coberturaSondas.filter(sonda => !sonda.possuiEvidencia).map(sonda => sonda.sonda).join(', ')}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={async () => {
            const resposta = await window.ipcAPI.capturaLogs.exportar(captura.id);
            if (!resposta.success) toast.error(resposta.error || 'Não foi possível exportar a captura.');
            else if (!resposta.canceled) toast.success('Captura exportada em JSON.');
          }}><Download className="mr-2 h-4 w-4" />Exportar JSON</Button>
          <Button variant="ghost" size="icon" aria-label="Excluir captura" onClick={async () => {
            const resposta = await window.ipcAPI.capturaLogs.excluir(captura.id);
            if (!resposta.success) return toast.error(resposta.error || 'Não foi possível excluir a captura.');
            await carregar();
          }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>)}
    </CardContent>
  </Card>;
}
