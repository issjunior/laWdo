import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, Edit, Trash2, X, Eye, EyeOff, Building2, Users, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { createSolicitanteSchema, type Solicitante, type CreateSolicitanteInput } from '@/lib/validators/solicitante.schema';
import { SolicitanteFormFields } from '@/components/solicitantes/SolicitanteFormFields';

const getMensagemErro = (erro: unknown, fallback: string): string =>
  erro instanceof Error ? erro.message : fallback;

export const SolicitantesPage: React.FC = () => {
  const [solicitantes, setSolicitantes] = useState<Solicitante[]>([]);
  const [todosSolicitantes, setTodosSolicitantes] = useState<Solicitante[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSolicitante, setEditingSolicitante] = useState<Solicitante | null>(null);
  const [formData, setFormData] = useState<CreateSolicitanteInput>({
    nome: '',
    tipo: '',
    endereco: '',
    telefone: '',
    email: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [errors, setErrors] = useState<Partial<Solicitante>>({});
  const inativosCount = todosSolicitantes.filter(s => !s.ativo).length;

  // Carregar solicitantes
  const carregarSolicitantes = useCallback(async (showAll = false) => {
    try {
      setLoading(true);
      setError(null);

      let result;
      if (showAll) {
        // Buscar todos os solicitantes (ativos e inativos)
        result = await window.ipcAPI.solicitante.findAllSemFiltroStatus();
      } else {
        // Buscar apenas solicitantes ativos
        result = await window.ipcAPI.solicitante.findAll();
      }

      if (result.success && result.data) {
        setSolicitantes(result.data);
      } else {
        setError(result.error || 'Erro ao carregar solicitantes');
      }
    } catch (err: unknown) {
      setError(getMensagemErro(err, 'Erro ao carregar solicitantes'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega a lista completa de solicitantes para o card de total
  const carregarTodosSolicitantes = useCallback(async () => {
    try {
      const allResult = await window.ipcAPI.solicitante.findAllSemFiltroStatus();
      if (allResult.success && allResult.data) {
        setTodosSolicitantes(allResult.data);
      } else {
        setError(allResult.error || 'Erro ao carregar todos os solicitantes');
      }
    } catch (err: unknown) {
      setError(getMensagemErro(err, 'Erro ao carregar todos os solicitantes'));
    }
  }, []);

  useEffect(() => {
    // Primeiro carrega total completo, depois a lista filtrada
    carregarTodosSolicitantes();
    carregarSolicitantes(mostrarTodos);
  }, [carregarSolicitantes, carregarTodosSolicitantes, mostrarTodos]);

  // Abrir diálogo para novo solicitante
  const handleNovo = () => {
    setEditingSolicitante(null);
    setFormData({
      nome: '',
      tipo: '',
      endereco: '',
      telefone: '',
      email: '',
    });
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  };

  // Abrir diálogo para edição
  const handleEditar = useCallback((solicitante: Solicitante) => {
    setEditingSolicitante(solicitante);
    setFormData({
      nome: solicitante.nome,
      tipo: solicitante.tipo ?? '',
      endereco: solicitante.endereco ?? '',
      telefone: solicitante.telefone ?? '',
      email: solicitante.email ?? '',
    });
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  }, []);

  // Salvar solicitante (criar ou atualizar)
  const handleSalvar = async () => {
    try {
      setError(null);
      setSuccess(null);
      setErrors({});
      const solicitanteApi = window.ipcAPI?.solicitante;

      // Validar com Zod
      const validationResult = createSolicitanteSchema.safeParse(formData);

      if (!validationResult.success) {
        const zodErrors: Partial<Solicitante> = {};
        validationResult.error.issues.forEach((err) => {
          // Mapear corretamente os erros para os campos
          if (err.path[0] === 'nome') {
            zodErrors.nome = err.message;
          } else if (err.path[0] === 'tipo') {
            zodErrors.tipo = err.message;
          } else if (err.path[0] === 'endereco') {
            zodErrors.endereco = err.message;
          } else if (err.path[0] === 'telefone') {
            zodErrors.telefone = err.message;
          } else if (err.path[0] === 'email') {
            zodErrors.email = err.message;
          }
        });
        setErrors(zodErrors);
        // Removido setError duplicado que exibia a mesma mensagem geral
        return;
      }

      if (editingSolicitante) {
        if (!solicitanteApi?.update) {
          setError('API de solicitante indisponível para atualização.');
          return;
        }
        // Atualizar
        const result = await solicitanteApi.update(
          editingSolicitante.id,
          formData
        );

        if (result.success) {
          setSuccess('Solicitante atualizado com sucesso!');
          await carregarSolicitantes(mostrarTodos);
          await carregarTodosSolicitantes();
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(result.error || 'Erro ao atualizar solicitante');
        }
      } else {
        if (!solicitanteApi?.create) {
          setError('API de solicitante indisponível para criação.');
          return;
        }
        // Criar novo
        const result = await solicitanteApi.create(formData);

        if (result.success) {
          setSuccess('Solicitante criado com sucesso!');
          await carregarSolicitantes(mostrarTodos);
          await carregarTodosSolicitantes();
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(result.error || 'Erro ao criar solicitante');
        }
      }
    } catch (err: unknown) {
      setError(getMensagemErro(err, 'Erro ao salvar solicitante'));
    }
  };

  // Desativar solicitante (soft delete) — não utilizado atualmente
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDesativar = async (id: string) => {
    if (!confirm('Tem certeza que deseja desativar este solicitante? Ele deixará de aparecer na lista de ativos, mas permanecerá no banco de dados para fins históricos.')) {
      return;
    }

    try {
      const result = await window.ipcAPI.solicitante.delete(id);

      if (result.success) {
        await carregarSolicitantes(mostrarTodos);
        await carregarTodosSolicitantes();
        toast.success('Solicitante desativado com sucesso!');
      } else {
        toast.error(result.error || 'Erro ao desativar solicitante');
      }
    } catch (error) {
      toast.error('Erro ao desativar solicitante');
    }
  };

  // Excluir permanentemente (hard delete)
  const handleHardDelete = useCallback(async (id: string, nome: string) => {
    if (!confirm(`⚠️ ATENÇÃO: Você está prestes a EXCLUIR PERMANENTEMENTE o solicitante "${nome}".\n\nEsta ação não pode ser desfeita e pode afetar laudos que utilizam este solicitante. Tem certeza absoluta?`)) {
      return;
    }

    try {
      const result = await window.ipcAPI.solicitante.hardDelete(id);

      if (result.success) {
        await carregarSolicitantes(mostrarTodos);
        await carregarTodosSolicitantes();
        toast.success('Solicitante excluído permanentemente!');
      } else {
        toast.error(result.error || 'Erro ao excluir permanentemente');
      }
    } catch (error) {
      toast.error('Erro ao excluir permanentemente');
    }
  }, [mostrarTodos, carregarSolicitantes, carregarTodosSolicitantes]);

  // Gerenciar status (ativar/desativar)
  const handleToggleStatus = useCallback(async (solicitante: Solicitante) => {
    try {
      // Mostrar mensagem de confirmação mais específica
      const acao = solicitante.ativo !== false ? 'desativar' : 'ativar';
      if (!confirm(`Tem certeza que deseja ${acao} este solicitante?`)) {
        return;
      }

      const result = await window.ipcAPI.solicitante.toggleStatus(solicitante.id);

      if (result.success) {
        const novoStatus = !solicitante.ativo;
        await carregarTodosSolicitantes();

        if (!mostrarTodos && !!solicitante.ativo && novoStatus === false) {
          setSolicitantes(prev => prev.filter(s => s.id !== solicitante.id));
          toast.success('Solicitante desativado com sucesso!');
        } else {
          await carregarSolicitantes(mostrarTodos);
          toast.success(`Solicitante ${novoStatus ? 'ativado' : 'desativado'} com sucesso!`);
        }
      } else {
        toast.error(result.error || 'Erro ao alterar status');
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      alert('Erro ao alterar status');
    }
  }, [mostrarTodos, carregarSolicitantes, carregarTodosSolicitantes]);

  // Definições de colunas da DataTable
  const columnDefs = useMemo<ColumnDef<Solicitante>[]>(() => [
    {
      accessorKey: 'nome',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nome" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue('nome')}</span>
      ),
    },
    {
      accessorKey: 'tipo',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tipo" />
      ),
      cell: ({ row }) => (
        <span>{row.getValue('tipo') || '-'}</span>
      ),
    },
    {
      accessorKey: 'telefone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Telefone" />
      ),
      cell: ({ row }) => (
        <span>{row.getValue('telefone') || '-'}</span>
      ),
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({ row }) => (
        <span>{row.getValue('email') || '-'}</span>
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
      id: 'actions',
      enableHiding: false,
      header: () => <span className="sr-only">Ações</span>,
      cell: ({ row }) => {
        const solicitante = row.original;
        return (
          <div className="flex justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditar(solicitante)}
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
                  onClick={() => handleToggleStatus(solicitante)}
                  aria-label={solicitante.ativo ? 'Desativar' : 'Ativar'}
                  className={solicitante.ativo ? 'text-orange-500' : 'text-green-600'}
                >
                  {solicitante.ativo ? <X size={14} /> : <Plus size={14} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{solicitante.ativo ? 'Desativar' : 'Ativar'}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleHardDelete(solicitante.id, solicitante.nome)}
                  className="text-red-600"
                  aria-label="Excluir"
                >
                  <Trash2 size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Excluir permanentemente</p></TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
  ], [handleEditar, handleToggleStatus, handleHardDelete]);

  return (
    <TooltipProvider>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Solicitantes</h1>
            <p className="text-gray-600 mt-2">
              Gerencie órgãos solicitantes (varas, delegacias, órgãos públicos)
            </p>
          </div>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
              <Users size={16} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{todosSolicitantes.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Solicitantes cadastrados</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Ativos</CardTitle>
              <div className="h-2 w-2 rounded-full bg-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {todosSolicitantes.filter((s) => !!s.ativo).length}
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
                {inativosCount}
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
            Novo Solicitante
          </Button>
        </div>

        {/* Tabela com DataTable */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Lista de Solicitantes</CardTitle>
                <CardDescription>
                  {mostrarTodos
                    ? `${solicitantes.length} solicitante(s) no total`
                    : `${solicitantes.length} ativo(s)`}
                  {!mostrarTodos && inativosCount > 0 && (
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
                <span className="text-sm">Carregando solicitantes...</span>
              </div>
            ) : error && solicitantes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                <AlertCircle size={24} className="text-destructive" />
                <span className="text-sm text-destructive">{error}</span>
              </div>
            ) : solicitantes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                <Building2 size={32} className="opacity-40" />
                <span className="text-sm">
                  {mostrarTodos ? 'Nenhum solicitante cadastrado.' : 'Nenhum solicitante ativo.'}
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
                data={solicitantes}
                searchColumn="nome"
                searchPlaceholder="Buscar solicitantes..."
              />
            )}
          </CardContent>
        </Card>

        {/* Diálogo de criação/edição */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingSolicitante
                  ? 'Editar Solicitante'
                  : 'Novo Solicitante'}
              </DialogTitle>
              <DialogDescription>
                {editingSolicitante
                  ? 'Atualize as informações do solicitante.'
                  : 'Preencha as informações para cadastrar um novo solicitante.'}
              </DialogDescription>
            </DialogHeader>

            <SolicitanteFormFields
              formData={formData}
              onChange={setFormData}
              errors={errors}
              error={error}
              success={success}
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSalvar}>
                {editingSolicitante ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

