import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Edit, Trash2, X, Eye, EyeOff, FlaskConical, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { DefinicaoColunaTabela } from '@/components/data-table/data-table-features';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import type { TipoExame, CreateTipoExameInput } from '@/lib/validators/tipo-exame.schema';
import { TipoExameFormFields } from '@/components/tipos-exame/TipoExameFormFields';

export const TiposExamePage: React.FC = () => {
  const [tiposExame, setTiposExame] = useState<TipoExame[]>([]);
  const [todosTipos, setTodosTipos] = useState<TipoExame[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [erroTotais, setErroTotais] = useState<string | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const mostrarTodosRef = useRef(mostrarTodos);
  mostrarTodosRef.current = mostrarTodos;
  const sequenciaListaRef = useRef(0);
  const sequenciaTotaisRef = useRef(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoExame | null>(null);
  const [formData, setFormData] = useState<CreateTipoExameInput>({
    codigo: '',
    nome: '',
    descricao: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inativosCount = todosTipos?.filter(t => !t.ativo).length ?? 0;

  const getMensagemErro = (erro: unknown, fallback: string): string =>
    erro instanceof Error ? erro.message : fallback;

  const carregarLista = useCallback(async () => {
    const sequencia = ++sequenciaListaRef.current;
    const incluirInativos = mostrarTodosRef.current;
    setLoading(true);
    setErroLista(null);
    try {
      const result = await (incluirInativos
        ? window.ipcAPI.tipoExame.findAllSemFiltroStatus()
        : window.ipcAPI.tipoExame.findAll());
      if (sequencia !== sequenciaListaRef.current) return;
      if (!result.success || !Array.isArray(result.data)) throw new Error(result.error || 'Erro ao carregar tipos de exame');
      setTiposExame(result.data);
    } catch (err: unknown) {
      if (sequencia === sequenciaListaRef.current) setErroLista(getMensagemErro(err, 'Erro ao carregar tipos de exame'));
    } finally {
      if (sequencia === sequenciaListaRef.current) setLoading(false);
    }
  }, []);

  const carregarTodosTipos = useCallback(async () => {
    const sequencia = ++sequenciaTotaisRef.current;
    setErroTotais(null);
    try {
      const allResult = await window.ipcAPI.tipoExame.findAllSemFiltroStatus();
      if (sequencia !== sequenciaTotaisRef.current) return;
      if (!allResult.success || !Array.isArray(allResult.data)) throw new Error(allResult.error || 'Não foi possível carregar os totais.');
      setTodosTipos(allResult.data);
    } catch (err: unknown) {
      if (sequencia === sequenciaTotaisRef.current) {
        setTodosTipos(null);
        setErroTotais(getMensagemErro(err, 'Não foi possível carregar os totais.'));
      }
    }
  }, []);

  useEffect(() => {
    void carregarTodosTipos();
    return () => { sequenciaTotaisRef.current += 1; };
  }, [carregarTodosTipos]);

  useEffect(() => {
    void carregarLista();
    return () => { sequenciaListaRef.current += 1; };
  }, [mostrarTodos, carregarLista]);

  // Alternar status ativo/inativo
  const handleToggleStatus = useCallback(async (id: string) => {
    try {
      const result = await window.ipcAPI.tipoExame.toggleStatus(id);
      if (result.success) {
        await Promise.all([carregarLista(), carregarTodosTipos()]);
        toast.success(result.message || 'Status alterado com sucesso!');
      } else {
        toast.error(result.error || 'Erro ao alterar status');
      }
    } catch {
      toast.error('Erro ao alterar status do tipo de exame');
    }
  }, [carregarLista, carregarTodosTipos]);

  // Abrir diálogo para novo tipo
  const handleNovo = () => {
    setEditingTipo(null);
    setFormData({
      codigo: '',
      nome: '',
      descricao: '',
    });
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  };

  // Abrir diálogo para edição
  const handleEditar = useCallback((tipo: TipoExame) => {
    setEditingTipo(tipo);
    setFormData({
      codigo: tipo.codigo,
      nome: tipo.nome,
      descricao: tipo.descricao || '',
    });
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  }, []);

  // Salvar tipo de exame (criar ou atualizar)
  const handleSalvar = async () => {
    try {
      setError(null);
      setSuccess(null);

      if (!formData.codigo.trim()) {
        setError('O código do exame no GDL é obrigatório.');
        return;
      }

      if (!formData.nome.trim()) {
        setError('O nome do tipo de exame é obrigatório.');
        return;
      }

      if (editingTipo) {
        const result = await window.ipcAPI.tipoExame.update(editingTipo.id, formData);

        if (result.success && result.data) {
          setSuccess('Tipo de exame atualizado com sucesso!');
          await Promise.all([carregarLista(), carregarTodosTipos()]);
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(result.error || 'Erro ao atualizar tipo de exame');
        }
      } else {
        const result = await window.ipcAPI.tipoExame.create(formData);

        if (result.success && result.data) {
          setSuccess('Tipo de exame criado com sucesso!');
          await Promise.all([carregarLista(), carregarTodosTipos()]);
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(result.error || 'Erro ao criar tipo de exame');
        }
      }
    } catch (err: unknown) {
      setError(getMensagemErro(err, 'Erro ao salvar tipo de exame'));
    }
  };

  // Excluir tipo de exame
  const handleExcluir = useCallback(async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este tipo de exame?')) {
      return;
    }

    try {
      const result = await window.ipcAPI.tipoExame.delete(id);

      if (result.success) {
        await Promise.all([carregarLista(), carregarTodosTipos()]);
        toast.success('Tipo de exame excluído com sucesso!');
      } else {
        toast.error(result.error || 'Erro ao excluir');
      }
    } catch {
      toast.error('Erro ao excluir tipo de exame');
    }
  }, [carregarLista, carregarTodosTipos]);

  // Definições de colunas da DataTable
  const columnDefs = useMemo<DefinicaoColunaTabela<TipoExame>[]>(() => [
    {
      accessorKey: 'codigo',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Código GDL" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">{row.getValue('codigo')}</span>
      ),
    },
    {
      accessorKey: 'nome',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tipo de exame" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue('nome')}</span>
      ),
    },
    {
      accessorKey: 'ativo',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const ativo = !!row.getValue('ativo');
        return (
          <Badge
            variant="outline"
            className={`rounded-full ${ativo
              ? 'bg-green-100 text-green-800 border-green-200'
              : 'bg-red-100 text-red-800 border-red-200'
            }`}
          >
            {ativo ? 'Ativo' : 'Inativo'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'descricao',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Descrição" />
      ),
      cell: ({ row }) => (
        <span className="max-w-xs truncate block">{row.getValue('descricao') || '-'}</span>
      ),
    },
    {
      id: 'actions',
      enableHiding: false,
      header: () => <span className="sr-only">Ações</span>,
      cell: ({ row }) => {
        const tipo = row.original;
        return (
          <div className="flex justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditar(tipo)}
                  aria-label="Editar"
                >
                  <Edit size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Editar</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleStatus(tipo.id)}
                  aria-label={tipo.ativo ? 'Desativar' : 'Ativar'}
                  className={tipo.ativo ? 'text-orange-500' : 'text-green-600'}
                >
                  {tipo.ativo ? <X size={14} /> : <Plus size={14} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{tipo.ativo ? 'Desativar' : 'Ativar'}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExcluir(tipo.id)}
                  className="text-red-600"
                  aria-label="Excluir"
                >
                  <Trash2 size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Excluir</p></TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
  ], [handleEditar, handleToggleStatus, handleExcluir]);

  return (
    <TooltipProvider>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Tipos de Exame</h1>
            <p className="text-gray-600 mt-2">
              Gerencie os tipos de exame pericial e suas informações
            </p>
          </div>
        </div>

        {/* Cards de estatísticas */}
        {erroTotais && (
          <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
            <AlertCircle size={16} />
            <span>Totais indisponíveis: {erroTotais}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void carregarTodosTipos()}>Tentar novamente</Button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
              <FlaskConical size={16} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{todosTipos?.length ?? '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">Tipos de exame cadastrados</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Ativos</CardTitle>
              <div className="h-2 w-2 rounded-full bg-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {todosTipos ? todosTipos.filter((t) => !!t.ativo).length : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Disponíveis para laudos</p>
            </CardContent>
          </Card>

          <Card
            className={`border-red-200 dark:border-red-800 ${inativosCount > 0 && !mostrarTodos ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
            onClick={() => { if (inativosCount > 0 && !mostrarTodos) setMostrarTodos(true); }}
          >
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">Inativos</CardTitle>
              <div className="h-2 w-2 rounded-full bg-red-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                {todosTipos ? inativosCount : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {inativosCount > 0 && !mostrarTodos ? 'Clique para revelar' : 'Ocultos da lista'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleNovo} className="flex items-center gap-2">
            <Plus size={16} />
            Novo Tipo de Exame
          </Button>
        </div>

        {/* Tabela com DataTable */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Lista de Tipos de Exame</CardTitle>
                <CardDescription>
                  {loading ? 'Carregando lista...'
                    : erroLista ? 'Lista indisponível'
                    : mostrarTodos
                    ? `${tiposExame.length} tipo(s) no total`
                    : `${tiposExame.length} ativo(s)`}
                  {!loading && !erroLista && !mostrarTodos && inativosCount > 0 && (
                    <span className="text-red-600 ml-2">({inativosCount} inativo{inativosCount > 1 ? 's' : ''} oculto{inativosCount > 1 ? 's' : ''})</span>
                  )}
                </CardDescription>
              </div>
              <Button
                variant={mostrarTodos ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMostrarTodos(!mostrarTodos)}
                className="flex items-center gap-1.5"
              >
                {mostrarTodos ? <Eye size={14} /> : <EyeOff size={14} />}
                {mostrarTodos ? 'Ocultar inativos' : `Mostrar todos${inativosCount > 0 ? ` (${inativosCount})` : ''}`}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-sm">Carregando tipos de exame...</span>
              </div>
            ) : erroLista ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                <AlertCircle size={24} className="text-destructive" />
                <span className="text-sm text-destructive">{erroLista}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void carregarLista()}>Tentar novamente</Button>
              </div>
            ) : tiposExame.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                <FlaskConical size={32} className="opacity-40" />
                <span className="text-sm">
                  {mostrarTodos ? 'Nenhum tipo de exame cadastrado.' : 'Nenhum tipo de exame ativo.'}
                </span>
                {!mostrarTodos && inativosCount > 0 && (
                  <Button variant="link" size="sm" onClick={() => setMostrarTodos(true)} className="text-xs">
                    Mostrar {inativosCount} inativo{inativosCount > 1 ? 's' : ''}
                  </Button>
                )}
              </div>
            ) : (
              <DataTable
                columns={columnDefs}
                data={tiposExame}
                searchColumn="nome"
                searchPlaceholder="Buscar tipos..."
              />
            )}
          </CardContent>
        </Card>

        {/* Diálogo de criação/edição */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingTipo ? 'Editar Tipo de Exame' : 'Novo Tipo de Exame'}
              </DialogTitle>
              <DialogDescription>
                {editingTipo
                  ? 'Atualize as informações do tipo de exame.'
                  : 'Preencha as informações para criar um novo tipo de exame.'}
              </DialogDescription>
            </DialogHeader>

            <TipoExameFormFields
              formData={formData}
              onChange={setFormData}
              error={error}
              success={success}
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSalvar} disabled={!formData.codigo.trim() || !formData.nome.trim()}>
                {editingTipo ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

