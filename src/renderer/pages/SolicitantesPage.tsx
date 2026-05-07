import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, X, Eye, EyeOff } from 'lucide-react';
import { solicitanteSchema, createSolicitanteSchema, type Solicitante } from '@/lib/validators/solicitante.schema';

export const SolicitantesPage: React.FC = () => {
  const [solicitantes, setSolicitantes] = useState<Solicitante[]>([]);
  const [todosSolicitantes, setTodosSolicitantes] = useState<Solicitante[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSolicitante, setEditingSolicitante] = useState<Solicitante | null>(null);
  const [formData, setFormData] = useState<SolicitanteCreateData>({
    nome: '',
    tipo: '',
    endereco: '',
    telefone: '',
    email: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [removidoRecentemente, setRemovidoRecentemente] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Solicitante>>({});

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
    } catch (err: any) {
      console.error('Erro ao carregar solicitantes:', err);
      setError(err.message || 'Erro ao carregar solicitantes');
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
    } catch (err: any) {
      console.error('Erro ao carregar todos os solicitantes:', err);
      setError(err.message || 'Erro ao carregar todos os solicitantes');
    }
  }, []);

  useEffect(() => {
    // Primeiro carrega total completo, depois a lista filtrada
    carregarTodosSolicitantes();
    carregarSolicitantes(mostrarTodos);
  }, [carregarSolicitantes, carregarTodosSolicitantes, mostrarTodos]);

  // Filtrar solicitantes pelo termo de busca
  const filteredSolicitantes = solicitantes.filter(
    (s) =>
      s.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.tipo && s.tipo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
  const handleEditar = (solicitante: Solicitante) => {
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
  };

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
        validationResult.error.errors.forEach((err) => {
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
          await carregarSolicitantes();
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
          await carregarSolicitantes();
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(result.error || 'Erro ao criar solicitante');
        }
      }
    } catch (err: any) {
      console.error('Erro ao salvar solicitante:', err);
      setError(err.message || 'Erro ao salvar solicitante');
    }
  };

  // Desativar solicitante (soft delete)
  const handleDesativar = async (id: string) => {
    if (!confirm('Tem certeza que deseja desativar este solicitante? Ele deixará de aparecer na lista de ativos, mas permanecerá no banco de dados para fins históricos.')) {
      return;
    }

    try {
      const result = await window.ipcAPI.solicitante.delete(id);

      if (result.success) {
        await carregarSolicitantes(mostrarTodos);
        setSuccess('Solicitante desativado com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Erro ao desativar solicitante');
      }
    } catch (error) {
      console.error('Erro ao desativar solicitante:', error);
      setError('Erro ao desativar solicitante');
    }
  };

  // Excluir permanentemente (hard delete)
  const handleHardDelete = async (id: string, nome: string) => {
    if (!confirm(`⚠️ ATENÇÃO: Você está prestes a EXCLUIR PERMANENTEMENTE o solicitante "${nome}".\n\nEsta ação não pode ser desfeita e pode afetar laudos que utilizam este solicitante. Tem certeza absoluta?`)) {
      return;
    }

    try {
      const result = await window.ipcAPI.solicitante.hardDelete(id);

      if (result.success) {
        await carregarSolicitantes(mostrarTodos);
        setSuccess('Solicitante excluído permanentemente!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Erro ao excluir permanentemente');
      }
    } catch (error) {
      console.error('Erro ao excluir permanentemente:', error);
      setError('Erro ao excluir permanentemente');
    }
  };

  // Gerenciar status (ativar/desativar)
  const handleToggleStatus = async (solicitante: Solicitante) => {
    try {
      // Mostrar mensagem de confirmação mais específica
      const acao = solicitante.ativo !== false ? 'desativar' : 'ativar';
      if (!confirm(`Tem certeza que deseja ${acao} este solicitante?`)) {
        return;
      }

      const result = await window.ipcAPI.solicitante.toggleStatus(solicitante.id);

      if (result.success) {
        const novoStatus = !solicitante.ativo;

        if (!mostrarTodos && !!solicitante.ativo && novoStatus === false) {
          // ApenasAtivos + Desativando: remover da lista local
          setSolicitantes(prev => prev.filter(s => s.id !== solicitante.id));
          setRemovidoRecentemente(solicitante.id);
          setTimeout(() => setRemovidoRecentemente(null), 3000);
          setSuccess(`Solicitante desativado com sucesso!`);
        } else {
          // Outros casos: recarregar normalmente
          await carregarSolicitantes(mostrarTodos);
        }
      } else {
        alert(`Erro ao alterar status: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      alert('Erro ao alterar status');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Solicitantes</h1>
          <p className="text-gray-600 mt-2">
            Gerencie órgãos solicitantes (varas, delegacias, órgãos públicos)
          </p>
        </div>
        <Button onClick={handleNovo} className="flex items-center gap-2">
          <Plus size={16} />
          Novo Solicitante
        </Button>
      </div>

      {/* Card de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total de Solicitantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm flex items-center space-x-2">
              <span className="text-green-600 font-medium">
                {todosSolicitantes.filter((s) => !!s.ativo).length} Ativos
              </span>
              <span className="text-red-600 font-medium">
                {todosSolicitantes.filter((s) => !s.ativo).length} Inativos
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca e tabela */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Lista de Solicitantes</CardTitle>
              <CardDescription>
                {filteredSolicitantes.length} solicitante(s) encontrado(s) • {mostrarTodos ? "Todos" : "Apenas Ativos"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant={mostrarTodos ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMostrarTodos(!mostrarTodos)}
                className="flex items-center gap-1.5"
              >
                {mostrarTodos ? <Eye size={14} /> : <EyeOff size={14} />}
                {mostrarTodos ? 'Mostrar Ativos' : 'Apenas Ativos'}
              </Button>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar solicitantes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : filteredSolicitantes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm
                ? 'Nenhum solicitante encontrado para a busca.'
                : 'Nenhum solicitante cadastrado.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSolicitantes.map((solicitante) => (
                  <TableRow key={solicitante.id}>
                    <TableCell className="font-medium">{solicitante.nome}</TableCell>
                    <TableCell>{solicitante.tipo || '-'}</TableCell>
                    <TableCell>{solicitante.telefone || '-'}</TableCell>
                    <TableCell>{solicitante.email || '-'}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${!!solicitante.ativo
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}
                      >
                        {!!solicitante.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditar(solicitante)}
                          title="Editar informações"
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleToggleStatus(solicitante)
                          }
                          title={
                            !!solicitante.ativo
                              ? 'Desativar (ocultar da lista)'
                              : 'Ativar (mostrar na lista)'
                          }
                          className={!!solicitante.ativo ? 'text-orange-500' : 'text-green-600'}
                        >
                          {!!solicitante.ativo ? <X size={14} /> : <Plus size={14} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleHardDelete(solicitante.id, solicitante.nome)}
                          className="text-red-600 hover:text-red-700"
                          title="Excluir permanentemente (apagar do banco de dados)"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Toast de sucesso */}
      {removidoRecentemente && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          Solicitante desativado com sucesso!
        </div>
      )}

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

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label htmlFor="nome" className="text-sm font-medium">
                  Solicitante *
                </label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  placeholder="Ex: Tribunal de Justiça do Paraná"
                  className={errors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {errors.nome && (
                  <p className="text-xs text-red-600">{errors.nome}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="tipo" className="text-sm font-medium">
                  Responsável/Contato
                </label>
                <Input
                  id="tipo"
                  value={formData.tipo}
                  onChange={(e) =>
                    setFormData({ ...formData, tipo: e.target.value })
                  }
                  placeholder="Ex: Vara Criminal, Delegacia, Ministério Público"
                  className={errors.tipo ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {errors.tipo && (
                  <p className="text-xs text-red-600">{errors.tipo}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="endereco" className="text-sm font-medium">
                  Endereço
                </label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) =>
                    setFormData({ ...formData, endereco: e.target.value })
                  }
                  placeholder="Endereço completo"
                  className={errors.endereco ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {errors.endereco && (
                  <p className="text-xs text-red-600">{errors.endereco}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  E-mail
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="email@tjpr.jus.br"
                  className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email}</p>
                )}
              </div>
            </div>

            {/* Mensagens de erro/sucesso */}
            {error && !errors.nome && !errors.tipo && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
                {success}
              </div>
            )}
          </div>

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
  );
};
