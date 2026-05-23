import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, Edit, Trash2, X, Eye, EyeOff } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { TipoExame, CreateTipoExameInput } from '@/lib/validators';

export const TiposExamePage: React.FC = () => {
  const [tiposExame, setTiposExame] = useState<TipoExame[]>([]);
  const [todosTipos, setTodosTipos] = useState<TipoExame[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoExame | null>(null);
  const [formData, setFormData] = useState<CreateTipoExameInput>({
    codigo: '',
    nome: '',
    descricao: '',
    eh_local: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Carregar tipos de exame
  const carregarTiposExame = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await window.ipcAPI.tipoExame.findAll();

      if (result.success && result.data) {
        setTiposExame(result.data);
      } else {
        setError(result.error || 'Erro ao carregar tipos de exame');
      }
    } catch (err: any) {
      console.error('Erro ao carregar tipos de exame:', err);
      setError(err.message || 'Erro ao carregar tipos de exame');
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarTiposTodos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await window.ipcAPI.tipoExame.findAllSemFiltroStatus();

      if (result.success && result.data) {
        setTiposExame(result.data);
      } else {
        setError(result.error || 'Erro ao carregar tipos de exame');
      }
    } catch (err: any) {
      console.error('Erro ao carregar tipos de exame:', err);
      setError(err.message || 'Erro ao carregar tipos de exame');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega lista completa para o card de total
  const carregarTodosTipos = useCallback(async () => {
    try {
      const allResult = await window.ipcAPI.tipoExame.findAllSemFiltroStatus();
      if (allResult.success && allResult.data) {
        setTodosTipos(allResult.data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar todos os tipos:', err);
    }
  }, []);

  // Carregar na inicialização
  useEffect(() => {
    carregarTiposExame();
    carregarTodosTipos();
  }, [carregarTiposExame, carregarTodosTipos]);

  useEffect(() => {
    if (mostrarTodos) {
      carregarTiposTodos();
    } else {
      carregarTiposExame();
    }
  }, [mostrarTodos, carregarTiposExame, carregarTiposTodos]);

  // Alternar status ativo/inativo
  const handleToggleStatus = async (id: string) => {
    try {
      const result = await window.ipcAPI.tipoExame.toggleStatus(id);
      if (result.success) {
        if (mostrarTodos) {
          await carregarTiposTodos();
        } else {
          await carregarTiposExame();
        }
        await carregarTodosTipos();
      } else {
        alert(`Erro ao alterar status: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      alert('Erro ao alterar status do tipo de exame');
    }
  };

  // Abrir diálogo para novo tipo
  const handleNovo = () => {
    setEditingTipo(null);
    setFormData({
      codigo: '',
      nome: '',
      descricao: '',
      eh_local: false,
    });
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  };

  // Abrir diálogo para edição
  const handleEditar = (tipo: TipoExame) => {
    setEditingTipo(tipo);
    setFormData({
      codigo: tipo.codigo,
      nome: tipo.nome,
      descricao: tipo.descricao || '',
      eh_local: tipo.eh_local === true || tipo.eh_local === 1,
    });
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  };

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
          if (mostrarTodos) {
            await carregarTiposTodos();
          } else {
            await carregarTiposExame();
          }
          await carregarTodosTipos();
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(result.error || 'Erro ao atualizar tipo de exame');
        }
      } else {
        const result = await window.ipcAPI.tipoExame.create(formData);

        if (result.success && result.data) {
          setSuccess('Tipo de exame criado com sucesso!');
          if (mostrarTodos) {
            await carregarTiposTodos();
          } else {
            await carregarTiposExame();
          }
          await carregarTodosTipos();
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(result.error || 'Erro ao criar tipo de exame');
        }
      }
    } catch (err: any) {
      console.error('Erro ao salvar tipo de exame:', err);
      setError(err.message || 'Erro ao salvar tipo de exame');
    }
  };

  // Excluir tipo de exame
  const handleExcluir = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este tipo de exame?')) {
      return;
    }

    try {
      const result = await window.ipcAPI.tipoExame.delete(id);

      if (result.success) {
        if (mostrarTodos) {
          await carregarTiposTodos();
        } else {
          await carregarTiposExame();
        }
        await carregarTodosTipos();
      } else {
        alert(`Erro ao excluir: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro ao excluir tipo de exame:', error);
      alert('Erro ao excluir tipo de exame');
    }
  };

  // Definições de colunas da DataTable
  const columnDefs = useMemo<ColumnDef<TipoExame>[]>(() => [
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
      id: 'tipo',
      accessorFn: (row) => (row.eh_local === true || row.eh_local === 1 ? 'Local' : 'Laboratorial'),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tipo" />
      ),
      cell: ({ row }) => {
        const isLocal = row.original.eh_local === true || row.original.eh_local === 1;
        return (
          <Badge
            variant={isLocal ? 'default' : 'secondary'}
            className="rounded-full"
          >
            {isLocal ? 'Local' : 'Laboratorial'}
          </Badge>
        );
      },
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
          <Button onClick={handleNovo} className="flex items-center gap-2">
            <Plus size={16} />
            Novo Tipo de Exame
          </Button>
        </div>

        {/* Card de total */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total de Tipos de Exame
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm flex items-center space-x-2">
                <span className="text-green-600 font-medium">
                  {todosTipos.filter((t) => !!t.ativo).length} Ativos
                </span>
                <span className="text-red-600 font-medium">
                  {todosTipos.filter((t) => !t.ativo).length} Inativos
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela com DataTable */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Lista de Tipos de Exame</CardTitle>
                <CardDescription>
                  {mostrarTodos ? 'Todos' : 'Apenas Ativos'}
                </CardDescription>
              </div>
              <Button
                variant={mostrarTodos ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMostrarTodos(!mostrarTodos)}
                className="flex items-center gap-1.5"
              >
                {mostrarTodos ? <Eye size={14} /> : <EyeOff size={14} />}
                {mostrarTodos ? 'Mostrar Ativos' : 'Apenas Ativos'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Carregando...</div>
            ) : error && tiposExame.length === 0 ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
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

            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="bg-green-50 border-green-200">
                  <AlertDescription className="text-green-800">{success}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label htmlFor="codigo" className="text-sm font-medium">
                  Código do exame no GDL *
                </label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo: e.target.value })
                  }
                  placeholder="Ex: DNA, BAL, LOC..."
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="nome" className="text-sm font-medium">
                  Nome do tipo de exame *
                </label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  placeholder="Ex: Exame de DNA, Perícia Balística..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="eh_local"
                  checked={formData.eh_local}
                  onChange={(e) =>
                    setFormData({ ...formData, eh_local: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="eh_local" className="text-sm font-medium cursor-pointer">
                  É exame de local
                </Label>
              </div>

              <div className="space-y-2">
                <label htmlFor="descricao" className="text-sm font-medium">
                  Descrição do exame
                </label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) =>
                    setFormData({ ...formData, descricao: e.target.value })
                  }
                  placeholder="Descrição detalhada do tipo de exame..."
                  rows={4}
                />
              </div>
            </div>

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

export default TiposExamePage;
