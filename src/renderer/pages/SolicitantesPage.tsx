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
import { Plus, Search, Edit, Trash2, X } from 'lucide-react';
import {
  Solicitante,
  SolicitanteCreateData,
  SolicitanteUpdateData,
} from '@/lib/validators';

export const SolicitantesPage: React.FC = () => {
  const [solicitantes, setSolicitantes] = useState<Solicitante[]>([]);
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

  // Carregar solicitantes
  const carregarSolicitantes = useCallback(async (showAll = false) => {
    try {
      setLoading(true);
      setError(null);

      let result;
      if (showAll) {
        // Buscar todos os solicitantes (ativos e inativos)
        result = await window.ipcAPI.solicitante.findAllSemFiltroStatus();
        console.log('Resultado findAllSemFiltroStatus:', result); // Debug
      } else {
        // Buscar apenas solicitantes ativos
        result = await window.ipcAPI.solicitante.findAll();
        console.log('Resultado findAll:', result); // Debug
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

  useEffect(() => {
    carregarSolicitantes(mostrarTodos);
  }, [carregarSolicitantes, mostrarTodos]);

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

      if (!formData.nome.trim()) {
        setError('O nome é obrigatório');
        return;
      }

      if (!formData.tipo.trim()) {
        setError('O tipo é obrigatório');
        return;
      }

      if (editingSolicitante) {
        // Atualizar
        const result = await window.ipcAPI.solicitante.update(
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
        // Criar novo
        const result = await window.ipcAPI.solicitante.create(formData);

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
        <div className="flex gap-3">
          <Button
            onClick={handleNovo}
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            Novo Solicitante
          </Button>
          <Button
            variant={mostrarTodos ? "default" : "outline"}
            onClick={() => {
              const novoStatus = !mostrarTodos;
              setMostrarTodos(novoStatus);
              carregarSolicitantes(novoStatus);
            }}
            className="flex items-center gap-2"
          >
            {mostrarTodos ? "🔍 Todos" : "🔍 Apenas Ativos"}
          </Button>
        </div>
      </div>

      {/* Card de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{solicitantes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {solicitantes.filter((s) => !!s.ativo).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Tipos Diferentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(solicitantes.map((s) => s.tipo)).size}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Status View
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <span className="text-green-600 font-medium">
                {solicitantes.filter((s) => !!s.ativo).length} Ativos
              </span>
              {mostrarTodos && solicitantes.some((s) => !s.ativo) && (
                <span className="mx-2">•</span>
              )}
              {mostrarTodos && solicitantes.some((s) => !s.ativo) && (
                <span className="text-red-600 font-medium">
                  {solicitantes.filter((s) => !s.ativo).length} Inativos
                </span>
              )}
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
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          !!solicitante.ativo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {!!solicitante.ativo ? 'Ativo' : 'Desativado'}
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
                  Nome *
                </label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  placeholder="Ex: Tribunal de Justiça do Paraná"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="tipo" className="text-sm font-medium">
                  Tipo *
                </label>
                <Input
                  id="tipo"
                  value={formData.tipo}
                  onChange={(e) =>
                    setFormData({ ...formData, tipo: e.target.value })
                  }
                  placeholder="Ex: Vara Criminal, Delegacia, Ministério Público"
                />
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
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="telefone" className="text-sm font-medium">
                    Telefone
                  </label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) =>
                      setFormData({ ...formData, telefone: e.target.value })
                    }
                    placeholder="(41) 99999-9999"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="email@tjpr.jus.br"
                  />
                </div>
              </div>
            </div>

            {/* Mensagens de erro/sucesso */}
            {error && (
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
            <Button onClick={handleSalvar} disabled={!formData.nome.trim() || !formData.tipo.trim()}>
              {editingSolicitante ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
