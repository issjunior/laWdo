import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Download } from 'lucide-react';
import type { AmostraDesempenho, EstadoCapturaDesempenho } from '@shared/desempenho/contratos';
import type { DefinicaoColunaTabela } from '@/components/data-table/data-table-features';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CapturaLogsControle } from '@/components/logs/CapturaLogsControle';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';

export function DesempenhoTab() {
  const [estado, setEstado] = useState<EstadoCapturaDesempenho | null>(null);
  const [amostras, setAmostras] = useState<AmostraDesempenho[]>([]);
  const [agora, setAgora] = useState(Date.now());
  const colunas = useMemo<DefinicaoColunaTabela<AmostraDesempenho>[]>(() => [
    {
      accessorKey: 'timestamp',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Horário" />,
      cell: ({ row }) => <span className="whitespace-nowrap">{new Date(row.getValue('timestamp')).toLocaleString('pt-BR')}</span>,
    },
    {
      accessorKey: 'severidade',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Severidade" />,
      cell: ({ row }) => <Badge variant={row.getValue('severidade') === 'critico' ? 'destructive' : 'secondary'}>{row.getValue('severidade')}</Badge>,
    },
    {
      accessorKey: 'origem',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Origem" />,
    },
    {
      id: 'operacao',
      accessorFn: amostra => amostra.operacao || amostra.canal || amostra.evento,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Operação" />,
    },
    {
      accessorKey: 'duracaoMs',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Duração" />,
      cell: ({ row }) => {
        const duracao = row.getValue('duracaoMs');
        return duracao == null ? '—' : `${Math.round(duracao as number)} ms`;
      },
    },
  ], []);

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

  const exportar = async () => {
    const resposta = await window.ipcAPI.desempenho.exportarCsv();
    if (!resposta.success) return toast.error(resposta.error || 'Não foi possível exportar o CSV.');
    if (!resposta.canceled) toast.success('Diagnóstico exportado.');
  };

  const detalhada = estado?.sessao?.ativa ?? false;
  const restanteSegundos = estado?.sessao?.terminaEm ? Math.max(0, Math.ceil((Date.parse(estado.sessao.terminaEm) - agora) / 1_000)) : null;
  const resumo = useMemo(() => {
    const eventosCriticos = amostras.filter(amostra => amostra.severidade === 'critico').length;
    const operacoesLentas = new Set(amostras
      .filter(amostra => (amostra.duracaoMs ?? 0) >= 250)
      .map(amostra => amostra.operacao || amostra.canal || amostra.evento));
    const maiorDuracao = amostras.reduce<number | null>((maior, amostra) => {
      if (amostra.duracaoMs == null) return maior;
      return maior === null || amostra.duracaoMs > maior ? amostra.duracaoMs : maior;
    }, null);
    return { eventosCriticos, operacoesLentas: operacoesLentas.size, maiorDuracao };
  }, [amostras]);
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
        <CapturaLogsControle sondas={['desempenho']} compacto />
        <Button variant="outline" onClick={exportar}><Download className="mr-2 h-4 w-4" />Exportar CSV de desempenho</Button>
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Resumo dos eventos carregados</CardTitle>
        <CardDescription>Indicadores calculados somente a partir das amostras exibidas nesta aba.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><p className="text-2xl font-bold">{amostras.length}</p><p className="text-xs text-muted-foreground">Eventos carregados</p></div>
        <div><p className="text-2xl font-bold text-red-600">{resumo.eventosCriticos}</p><p className="text-xs text-muted-foreground">Eventos críticos</p></div>
        <div><p className="text-2xl font-bold text-amber-600">{resumo.operacoesLentas}</p><p className="text-xs text-muted-foreground">Operações lentas</p></div>
        <div><p className="text-2xl font-bold">{resumo.maiorDuracao === null ? '—' : `${Math.round(resumo.maiorDuracao)} ms`}</p><p className="text-xs text-muted-foreground">Maior duração</p></div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="text-sm">Eventos recentes</CardTitle></CardHeader>
      <CardContent><DataTable columns={colunas} data={amostras} searchColumn="operacao" searchPlaceholder="Buscar eventos de desempenho..." defaultSorting={[{ id: 'timestamp', desc: true }]} /></CardContent>
    </Card>
  </div>;
}
