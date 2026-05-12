import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ColumnDef,
} from '@tanstack/react-table';
import { toast } from 'sonner';
import {
  Trash2,
  Download,
  FileText,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
} from 'lucide-react';

import { LogEntry } from '@/shared/types/database';

import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Badge de tipo de log com cores condicionais via Tailwind
 */
const TipoBadge = ({ level }: { level: LogEntry['level'] }) => {
  const config: Record<
    LogEntry['level'],
    { label: string; classes: string }
  > = {
    error: {
      label: 'Erro',
      classes:
        'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
    },
    warn: {
      label: 'Aviso',
      classes:
        'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
    },
    info: {
      label: 'Info',
      classes:
        'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
    },
    debug: {
      label: 'Debug',
      classes:
        'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600',
    },
  };

  const { label, classes } = config[level];
  return <Badge className={classes}>{label}</Badge>;
};

/**
 * Formata timestamp para DD/MM/AA HH:mm:ss
 */
const formatarTimestamp = (ts: string): string => {
  const [dataPart, horaPart] = ts.split(' ');
  if (!dataPart || !horaPart) return ts;
  const [ano, mes, dia] = dataPart.split('-');
  const anoCurto = ano ? ano.slice(-2) : '';
  return `${dia}/${mes}/${anoCurto} ${horaPart}`;
};

/**
 * Página de Logs do Sistema
 */
export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');

  // Buscar logs ao montar
  useEffect(() => {
    carregarLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarLogs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await window.ipcAPI.log.listar();
      if (r.success && Array.isArray(r.data)) {
        setLogs(r.data);
      } else {
        toast.error(r.error || 'Falha ao carregar logs');
      }
    } catch (err) {
      toast.error('Erro ao carregar logs do sistema');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Dados filtrados (tipo + range de datas)
  const logsFiltrados = useMemo(() => {
    return logs.filter((log) => {
      // Filtro por tipo
      if (filtroTipo !== 'todos' && log.level !== filtroTipo) {
        return false;
      }

      // Filtro por data
      const logDate = log.timestamp.slice(0, 10); // YYYY-MM-DD
      if (dataInicio && logDate < dataInicio) return false;
      if (dataFim && logDate > dataFim) return false;

      return true;
    });
  }, [logs, filtroTipo, dataInicio, dataFim]);

  // Contadores por tipo (KPIs)
  const contadores = useMemo(() => {
    return {
      total: logs.length,
      erro: logs.filter((l) => l.level === 'error').length,
      aviso: logs.filter((l) => l.level === 'warn').length,
      info: logs.filter((l) => l.level === 'info').length,
      debug: logs.filter((l) => l.level === 'debug').length,
    };
  }, [logs]);

  // Colunas da tabela
  const columns = useMemo<ColumnDef<LogEntry>[]>(
    () => [
      {
        accessorKey: 'timestamp',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Timestamp" />
        ),
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap font-mono">
            {formatarTimestamp(row.getValue('timestamp'))}
          </span>
        ),
      },
      {
        accessorKey: 'level',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Tipo" />
        ),
        cell: ({ row }) => <TipoBadge level={row.getValue('level')} />,
      },
      {
        accessorKey: 'message',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Mensagem" />
        ),
        cell: ({ row }) => {
          const msg: string = row.getValue('message');
          return (
            <div className="max-w-md truncate text-sm" title={msg}>
              {msg}
            </div>
          );
        },
      },
    ],
    []
  );

  // Limpar filtros
  const limparFiltros = () => {
    setFiltroTipo('todos');
    setDataInicio('');
    setDataFim('');
  };

  // Exportar CSV
  const exportarCSV = () => {
    const dados = logsFiltrados;
    if (dados.length === 0) {
      toast.warning('Nenhum log para exportar');
      return;
    }

    const linhas = dados.map((l) => {
      const ts = formatarTimestamp(l.timestamp);
      const tipo = l.level.toUpperCase();
      const msg = l.message.replace(/"/g, '""');
      return `"${ts}","${tipo}","${msg}"`;
    });

    const csv = `\uFEFFTimestamp,Tipo,Mensagem\n${linhas.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `logs-sistema-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`CSV exportado com ${dados.length} registros`);
  };

  // Limpar logs
  const handleLimparLogs = async () => {
    setClearing(true);
    try {
      const r = await window.ipcAPI.log.limpar();
      if (r.success) {
        toast.success('Logs do sistema limpos com sucesso');
        setLogs([]);
        setClearDialogOpen(false);
      } else {
        toast.error(r.error || 'Falha ao limpar logs');
      }
    } catch (err) {
      toast.error('Erro ao limpar logs');
      console.error(err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Logs do Sistema</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportarCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setClearDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar Logs
          </Button>
        </div>
      </div>

      {/* Cards de resumo (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{contadores.total}</div>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{contadores.erro}</div>
            <p className="text-xs text-muted-foreground">Erros</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">{contadores.aviso}</div>
            <p className="text-xs text-muted-foreground">Avisos</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600">{contadores.info}</div>
            <p className="text-xs text-muted-foreground">Info</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-600">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-slate-600">{contadores.debug}</div>
            <p className="text-xs text-muted-foreground">Debug</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="filtro-tipo">Tipo</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger id="filtro-tipo">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                  <SelectItem value="warn">Aviso</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-inicio">Data Início</Label>
              <Input
                id="data-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-fim">Data Fim</Label>
              <Input
                id="data-fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={limparFiltros}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="h-4 w-4" />
            Registros de Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando logs...
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={logsFiltrados}
              searchColumn="message"
              searchPlaceholder="Buscar na mensagem..."
            />
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação para limpar logs */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Limpar Logs do Sistema
            </DialogTitle>
            <DialogDescription>
              Todos os logs do sistema serão permanentemente removidos.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearDialogOpen(false)}
              disabled={clearing}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleLimparLogs}
              disabled={clearing}
            >
              {clearing ? 'Limpando...' : 'Prosseguir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LogsPage;
