import { useState, useEffect, useMemo, useCallback } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import {
  Trash2,
  Download,
  FileText,
  ShieldAlert,
  Lock,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  Database,
  ClipboardList,
  Activity,
  ShieldCheck,
  HardDrive,
  Clock,
  Maximize2,
} from 'lucide-react';

import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DualTrackTimeline } from '@/components/timeline/DualTrackTimeline';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const AUTH_USER_KEY = 'lawdo_auth_user';

const MODULOS = [
  { value: 'todos', label: 'Todos os módulos' },
  { value: 'sistema', label: 'Sistema' },
  { value: 'database', label: 'Banco de Dados' },
  { value: 'auth', label: 'Autenticação' },
  { value: 'rep', label: 'REP' },
  { value: 'laudo', label: 'Laudo' },
  { value: 'solicitante', label: 'Solicitante' },
  { value: 'tipo_exame', label: 'Tipo Exame' },
  { value: 'template', label: 'Template' },
  { value: 'placeholder', label: 'Placeholder' },
  { value: 'backup', label: 'Backup' },
  { value: 'configuracao', label: 'Configuração' },
  { value: 'ia', label: 'IA' },
  { value: 'gdl', label: 'API GDL' },
  { value: 'ilustracao', label: 'Ilustração' },
  { value: 'renderer', label: 'Renderer' },
];

const TIPOS_ACAO = [
  { value: 'todos', label: 'Todas as ações' },
  { value: 'criacao', label: 'Criação' },
  { value: 'atualizacao', label: 'Atualização' },
  { value: 'exclusao', label: 'Exclusão' },
  { value: 'transicao_status', label: 'Transição de Status' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'exportacao', label: 'Exportação' },
  { value: 'backup', label: 'Backup' },
  { value: 'restauracao', label: 'Restauração' },
  { value: 'limpeza_logs', label: 'Limpeza de Logs' },
  { value: 'erro', label: 'Erro' },
];

function getCurrentUserId(): string {
  try {
    const raw = sessionStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw)?.id ?? '' : '';
  } catch {
    return '';
  }
}

interface SystemLog {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  module: string;
  message: string;
}

interface AuditLog {
  id: number;
  created_at: string;
  modulo: string;
  tipo_acao: string;
  nivel: string;
  acao: string;
  mensagem?: string;
  usuario_id?: string;
  entidade?: string;
  entidade_id?: string;
  detalhes?: string;
  dados_anteriores?: string;
  dados_novos?: string;
}

const NivelBadge = ({ level }: { level: string }) => {
  const config: Record<string, { label: string; classes: string }> = {
    error: { label: 'Erro', classes: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800' },
    warn: { label: 'Aviso', classes: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800' },
    warning: { label: 'Aviso', classes: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800' },
    info: { label: 'Info', classes: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800' },
    debug: { label: 'Debug', classes: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600' },
  };
  const { label, classes } = config[level] ?? config.info;
  return <Badge className={classes}>{label}</Badge>;
};

const formatarTimestamp = (ts: string): string => {
  if (!ts) return '';

  if (ts.includes('T')) {
    const [dataPart, timePart] = ts.split('T');
    const partes = dataPart.split('-');
    if (partes.length === 3) {
      const [ano, mes, dia] = partes;
      const hora = timePart ? timePart.slice(0, 8) : '';
      return `${dia}/${mes}/${ano.slice(-2)} ${hora}`;
    }
  }

  const [dataPart, horaPart] = ts.split(' ');
  if (!dataPart) return ts;
  const partes = dataPart.split('-');
  if (partes.length !== 3) {
    const partesBR = dataPart.split('/');
    if (partesBR.length === 3) {
      const [dia, mes, ano] = partesBR;
      const anoCurto = (ano ?? '').slice(-2);
      const hora = horaPart ? ` ${horaPart}` : '';
      return `${dia}/${mes}/${anoCurto}${hora}`;
    }
    return ts;
  }
  const [ano, mes, dia] = partes;
  const anoCurto = (ano ?? '').slice(-2);
  const hora = horaPart ? ` ${horaPart}` : '';
  return `${dia}/${mes}/${anoCurto}${hora}`;
};

export function LogsPage() {
  const [aba, setAba] = useState<'sistema' | 'auditoria' | 'timeline'>('sistema');
  const [logsSistema, setLogsSistema] = useState<SystemLog[]>([]);
  const [logsAuditoria, setLogsAuditoria] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [senha, setSenha] = useState('');
  const [senhaErro, setSenhaErro] = useState('');
  const [verificandoSenha, setVerificandoSenha] = useState(false);
  const [passoConfirmacao, setPassoConfirmacao] = useState(0);
  const [dialogMsg, setDialogMsg] = useState<string | null>(null);

  const [filtroNivel, setFiltroNivel] = useState('todos');
  const [filtroModulo, setFiltroModulo] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [filtroModuloAudit, setFiltroModuloAudit] = useState('todos');
  const [filtroTipoAcao, setFiltroTipoAcao] = useState('todos');
  const [filtroNivelAudit, setFiltroNivelAudit] = useState('todos');
  const [dataInicioAudit, setDataInicioAudit] = useState('');
  const [dataFimAudit, setDataFimAudit] = useState('');

  const [contagemSistema, setContagemSistema] = useState(0);
  const [contagemAuditoria, setContagemAuditoria] = useState(0);

  const [timelineRepNumero, setTimelineRepNumero] = useState('');
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineRepId, setTimelineRepId] = useState<string | null>(null);
  const [timelineRepEncontrada, setTimelineRepEncontrada] = useState<any>(null);
  const [timelineError, setTimelineError] = useState('');

  useEffect(() => {
    carregarLogsSistema();
    carregarLogsAuditoria();
    carregarContagens();
  }, []);

  const carregarLogsSistema = useCallback(async () => {
    try {
      const filters: Record<string, unknown> = {};
      if (dataInicio) filters.startDate = dataInicio;
      if (dataFim) filters.endDate = dataFim;
      if (filtroNivel !== 'todos') filters.level = filtroNivel;
      if (filtroModulo !== 'todos') filters.module = filtroModulo;

      const r = await window.ipcAPI.log.listar(Object.keys(filters).length > 0 ? filters : undefined);
      if (r.success && Array.isArray(r.data)) {
        setLogsSistema(r.data as unknown as SystemLog[]);
      }
    } catch {
      toast.error('Erro ao carregar logs do sistema');
    }
  }, [filtroNivel, filtroModulo, dataInicio, dataFim]);

  const carregarLogsAuditoria = useCallback(async () => {
    try {
      const filters: Record<string, unknown> = {};
      if (dataInicioAudit) filters.startDate = dataInicioAudit;
      if (dataFimAudit) filters.endDate = dataFimAudit;
      if (filtroModuloAudit !== 'todos') filters.modulo = filtroModuloAudit;
      if (filtroTipoAcao !== 'todos') filters.tipo_acao = filtroTipoAcao;
      if (filtroNivelAudit !== 'todos') filters.nivel = filtroNivelAudit;

      const r = await window.ipcAPI.log.listarAuditoria(
        Object.keys(filters).length > 0 ? filters : undefined,
      );
      if (r.success && Array.isArray(r.data)) {
        setLogsAuditoria(r.data as unknown as AuditLog[]);
      }
    } catch {
      toast.error('Erro ao carregar logs de auditoria');
    }
  }, [filtroModuloAudit, filtroTipoAcao, filtroNivelAudit, dataInicioAudit, dataFimAudit]);

  const carregarContagens = useCallback(async () => {
    try {
      const r = await window.ipcAPI.log.contar();
      if (r.success && r.data) {
        setContagemSistema(r.data.sistema);
        setContagemAuditoria(r.data.auditoria);
      }
    } catch {
      // silencioso
    }
  }, []);

  const contadoresSistema = useMemo(() => ({
    total: logsSistema.length,
    erro: logsSistema.filter(l => l.level === 'error').length,
    aviso: logsSistema.filter(l => l.level === 'warn').length,
    info: logsSistema.filter(l => l.level === 'info').length,
    debug: logsSistema.filter(l => l.level === 'debug').length,
  }), [logsSistema]);

  const limparFiltrosSistema = () => {
    setFiltroNivel('todos');
    setFiltroModulo('todos');
    setDataInicio('');
    setDataFim('');
  };

  const limparFiltrosAuditoria = () => {
    setFiltroModuloAudit('todos');
    setFiltroTipoAcao('todos');
    setFiltroNivelAudit('todos');
    setDataInicioAudit('');
    setDataFimAudit('');
  };

  const handleBuscarTimeline = async () => {
    const numero = timelineRepNumero.trim();
    if (!numero) {
      setTimelineError('Digite o número da REP');
      return;
    }
    setTimelineLoading(true);
    setTimelineError('');
    setTimelineRepId(null);
    setTimelineRepEncontrada(null);
    try {
      const r = await window.ipcAPI.rep.findByNumero(numero);
      if (r.success && r.data) {
        setTimelineRepId(r.data.id);
        setTimelineRepEncontrada(r.data);
      } else {
        setTimelineError(r.error || 'REP não encontrada');
      }
    } catch (err) {
      setTimelineError(String(err));
    } finally {
      setTimelineLoading(false);
    }
  };

  const abrirDialogLimpeza = () => {
    setSenha('');
    setSenhaErro('');
    setPassoConfirmacao(0);
    setClearDialogOpen(true);
    carregarContagens();
  };

  const handleVerificarSenha = async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      setSenhaErro('Sessão não encontrada. Faça login novamente.');
      return;
    }
    if (!senha) {
      setSenhaErro('Digite sua senha para continuar.');
      return;
    }

    setVerificandoSenha(true);
    try {
      const r = await window.ipcAPI.verifyPassword(userId, senha);
      if (r.valid) {
        setSenhaErro('');
        setPassoConfirmacao(1);
      } else {
        setSenhaErro(r.error || 'Senha incorreta.');
      }
    } catch {
      setSenhaErro('Erro ao verificar senha.');
    } finally {
      setVerificandoSenha(false);
    }
  };

  const handleConfirmarLimpeza = async () => {
    setClearing(true);
    const userId = getCurrentUserId();
    try {
      const [rSistema, rAuditoria] = await Promise.all([
        window.ipcAPI.log.limpar(),
        window.ipcAPI.log.limparAuditoria(userId),
      ]);

      if (rSistema.success && rAuditoria.success) {
        toast.success(
          `Logs limpos: ${rAuditoria.count ?? 0} registros de auditoria removidos e arquivos de sistema truncados`,
        );
        setLogsSistema([]);
        setLogsAuditoria([]);
        setContagemSistema(0);
        setContagemAuditoria(0);
        setClearDialogOpen(false);
      } else {
        toast.error(rSistema.error || rAuditoria.error || 'Falha ao limpar logs');
      }
    } catch {
      toast.error('Erro ao limpar logs');
    } finally {
      setClearing(false);
    }
  };

  const exportarCSV = () => {
    const dados = aba === 'sistema' ? logsSistema : logsAuditoria;
    if (dados.length === 0) {
      toast.warning('Nenhum log para exportar');
      return;
    }

    let csv: string;
    if (aba === 'sistema') {
      const linhas = (dados as SystemLog[]).map(l =>
        `"${formatarTimestamp(l.timestamp)}","${l.level.toUpperCase()}","${l.module}","${(l.message || '').replace(/"/g, '""')}"`,
      );
      csv = '\uFEFFData/Hora,Nível,Módulo,Mensagem\n' + linhas.join('\n');
    } else {
      const linhas = (dados as AuditLog[]).map(l =>
        `"${formatarTimestamp(l.created_at)}","${l.tipo_acao}","${l.modulo}","${l.nivel}","${(l.acao || '').replace(/"/g, '""')}"`,
      );
      csv = '\uFEFFData/Hora,Ação,Módulo,Nível,Descrição\n' + linhas.join('\n');
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `logs-${aba}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`CSV exportado com ${dados.length} registros`);
  };

  const columnsSistema = useMemo<ColumnDef<SystemLog>[]>(() => [
    {
      accessorKey: 'timestamp',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Data/Hora" />,
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap font-mono">{formatarTimestamp(row.getValue('timestamp'))}</span>
      ),
    },
    {
      accessorKey: 'level',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Nível" />,
      cell: ({ row }) => <NivelBadge level={row.getValue('level')} />,
    },
    {
      accessorKey: 'module',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Módulo" />,
      cell: ({ row }) => {
        const mod = row.getValue('module') as string;
        return <Badge variant="outline" className="text-xs">{mod || 'sistema'}</Badge>;
      },
    },
    {
      accessorKey: 'message',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Mensagem" />,
      cell: ({ row }) => {
        const msg = (row.getValue('message') as string) || '';
        return (
          <div className="flex items-center gap-1">
            <span className="truncate text-sm" title={msg.length > 80 ? msg : undefined}>{msg}</span>
            {msg.length > 80 && (
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setDialogMsg(msg)}>
                <Maximize2 size={12} />
              </Button>
            )}
          </div>
        );
      },
    },
  ], []);

  const columnsAuditoria = useMemo<ColumnDef<AuditLog>[]>(() => [
    {
      accessorKey: 'created_at',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Data/Hora" />,
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap font-mono">{formatarTimestamp(row.getValue('created_at'))}</span>
      ),
    },
    {
      accessorKey: 'modulo',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Módulo" />,
      cell: ({ row }) => {
        const mod = row.getValue('modulo') as string;
        return <Badge variant="outline" className="text-xs">{mod || '-'}</Badge>;
      },
    },
    {
      accessorKey: 'tipo_acao',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Ação" />,
      cell: ({ row }) => {
        const acao = row.getValue('tipo_acao') as string;
        const isDelete = acao === 'exclusao';
        return (
          <Badge
            className={isDelete ? 'bg-red-100 text-red-700 border-red-200' : ''}
            variant={isDelete ? undefined : 'secondary'}
          >
            {acao || '-'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'nivel',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Nível" />,
      cell: ({ row }) => <NivelBadge level={row.getValue('nivel')} />,
    },
    {
      accessorKey: 'acao',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Descrição" />,
      cell: ({ row }) => {
        const msg = (row.getValue('acao') as string) || '';
        return (
          <div className="flex items-center gap-1">
            <span className="truncate text-sm" title={msg.length > 80 ? msg : undefined}>{msg}</span>
            {msg.length > 80 && (
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setDialogMsg(msg)}>
                <Maximize2 size={12} />
              </Button>
            )}
          </div>
        );
      },
    },
  ], []);

  return (
    <div className="space-y-6">
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
          <Button variant="destructive" size="sm" onClick={abrirDialogLimpeza}>
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar Logs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Log de Sistema
            </CardTitle>
            <CardDescription>
              Registros técnicos da operação do software. Use para diagnosticar erros, monitorar
              performance e depurar o comportamento da aplicação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1 text-xs">
                <HardDrive className="h-3 w-3" />
                Arquivos JSON em disco
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs">
                <Clock className="h-3 w-3" />
                Retenção: 30 dias
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Ex: erro de conexão com banco, query lenta, aviso de memória, debug de template IA
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              Log de Auditoria
            </CardTitle>
            <CardDescription>
              Rastreabilidade das ações dos usuários sobre os dados. Garante conformidade legal e
              permite identificar quem fez o quê e quando.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1 text-xs">
                <HardDrive className="h-3 w-3" />
                Tabela SQLite no banco
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs">
                <Clock className="h-3 w-3" />
                Retenção: Indefinido
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Ex: login de usuário, exclusão de REP, transição de status do laudo, exportação de
              backup
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {aba === 'sistema' ? (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{contadoresSistema.total}</div>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{contadoresSistema.erro}</div>
                <p className="text-xs text-muted-foreground">Erros</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-800">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-amber-600">{contadoresSistema.aviso}</div>
                <p className="text-xs text-muted-foreground">Avisos</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-emerald-600">{contadoresSistema.info}</div>
                <p className="text-xs text-muted-foreground">Info</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 dark:border-slate-600">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-slate-600">{contadoresSistema.debug}</div>
                <p className="text-xs text-muted-foreground">Debug</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="col-span-full">
            <CardContent className="pt-6 flex items-center gap-4">
              <ClipboardList className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{logsAuditoria.length}</div>
                <p className="text-xs text-muted-foreground">Registros de auditoria carregados</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs value={aba} onValueChange={v => setAba(v as 'sistema' | 'auditoria' | 'timeline')}>
        <TabsList>
          <TabsTrigger value="sistema" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Sistema
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Auditoria
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Linha do Tempo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sistema" className="mt-4 space-y-4">
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
                  <Label>Nível</Label>
                  <Select value={filtroNivel} onValueChange={setFiltroNivel}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
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
                  <Label>Módulo</Label>
                  <Select value={filtroModulo} onValueChange={setFiltroModulo}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      {MODULOS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={limparFiltrosSistema}>
                  <RotateCcw className="mr-2 h-4 w-4" />Limpar Filtros
                </Button>
                <Button size="sm" onClick={carregarLogsSistema}>
                  <Search className="mr-2 h-4 w-4" />Filtrar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                Registros de Log — Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columnsSistema}
                data={logsSistema}
                searchColumn="message"
                searchPlaceholder="Buscar na mensagem..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria" className="mt-4 space-y-4">
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
                  <Label>Módulo</Label>
                  <Select value={filtroModuloAudit} onValueChange={setFiltroModuloAudit}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      {MODULOS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Ação</Label>
                  <Select value={filtroTipoAcao} onValueChange={setFiltroTipoAcao}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_ACAO.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input type="date" value={dataInicioAudit} onChange={e => setDataInicioAudit(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input type="date" value={dataFimAudit} onChange={e => setDataFimAudit(e.target.value)} />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={limparFiltrosAuditoria}>
                  <RotateCcw className="mr-2 h-4 w-4" />Limpar Filtros
                </Button>
                <Button size="sm" onClick={carregarLogsAuditoria}>
                  <Search className="mr-2 h-4 w-4" />Filtrar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                Registros de Log — Auditoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columnsAuditoria}
                data={logsAuditoria}
                searchColumn="acao"
                searchPlaceholder="Buscar na descrição..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Buscar REP
              </CardTitle>
              <CardDescription>
                Digite o número da REP para visualizar a linha do tempo completa do ciclo de vida
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: 045-2026"
                  value={timelineRepNumero}
                  onChange={e => setTimelineRepNumero(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleBuscarTimeline(); }}
                />
                <Button onClick={handleBuscarTimeline} disabled={timelineLoading}>
                  {timelineLoading ? (
                    <span className="flex items-center gap-1">Buscando...</span>
                  ) : (
                    <span className="flex items-center gap-1"><Search className="h-4 w-4" /> Buscar</span>
                  )}
                </Button>
              </div>
              {timelineError && (
                <p className="text-sm text-destructive mt-2">{timelineError}</p>
              )}
            </CardContent>
          </Card>

          {timelineRepEncontrada && (
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-950/30">
                    REP {timelineRepEncontrada.numero}
                  </Badge>
                  {timelineRepEncontrada.status && (
                    <Badge variant={
                      timelineRepEncontrada.status === 'Pendente' ? 'secondary' :
                      timelineRepEncontrada.status === 'Em Andamento' ? 'default' : 'outline'
                    }>
                      {timelineRepEncontrada.status}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {timelineRepId && (
            <Card>
              <CardContent className="pt-6">
                <DualTrackTimeline repId={timelineRepId} repNumero={timelineRepEncontrada?.numero} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={clearDialogOpen} onOpenChange={(open) => {
        if (!open || !clearing) setClearDialogOpen(false);
        if (!open) { setSenha(''); setSenhaErro(''); setPassoConfirmacao(0); }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Exclusão de Registros do Sistema
            </DialogTitle>
            <DialogDescription>
              Esta ação é irreversível e será registrada para fins de auditoria.
            </DialogDescription>
          </DialogHeader>

          {passoConfirmacao === 0 ? (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 mt-1 space-y-1 text-sm">
                    <li>{contagemSistema} registros de sistema serão truncados dos arquivos de log</li>
                    <li>{contagemAuditoria} registros de auditoria serão permanentemente excluídos do banco de dados</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  Conforme política de segurança, a exclusão de registros requer autenticação do operador responsável.
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha-confirmacao">Digite sua senha para confirmar</Label>
                  <Input
                    id="senha-confirmacao"
                    type="password"
                    placeholder="••••••••"
                    value={senha}
                    onChange={e => { setSenha(e.target.value); setSenhaErro(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleVerificarSenha(); }}
                    disabled={verificandoSenha}
                    autoFocus
                  />
                  {senhaErro && (
                    <p className="text-sm text-destructive">{senhaErro}</p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setClearDialogOpen(false)} disabled={verificandoSenha || clearing}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleVerificarSenha}
                  disabled={verificandoSenha || !senha}
                >
                  {verificandoSenha ? 'Verificando...' : 'Verificar Senha'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Confirmação final</AlertTitle>
                <AlertDescription>
                  Ao prosseguir, todos os registros serão permanentemente removidos.
                  Esta ação será registrada no log de auditoria com sua identificação.
                </AlertDescription>
              </Alert>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setPassoConfirmacao(0); setSenha(''); }} disabled={clearing}>
                  Voltar
                </Button>
                <Button variant="destructive" onClick={handleConfirmarLimpeza} disabled={clearing}>
                  {clearing ? 'Limpando...' : 'Confirmar Exclusão'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!dialogMsg} onOpenChange={(open) => { if (!open) setDialogMsg(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do registro</DialogTitle>
          </DialogHeader>
          <div className="text-sm whitespace-pre-wrap break-words">{dialogMsg}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LogsPage;
