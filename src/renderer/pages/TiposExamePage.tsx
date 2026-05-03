import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Search, Edit, Trash2, FileText, X } from 'lucide-react';
import { TipoExame, CreateTipoExameInput } from '@/lib/validators';

export const TiposExamePage: React.FC = () => {
  const [tiposExame, setTiposExame] = useState<TipoExame[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoExame | null>(null);
  const [formData, setFormData] = useState<CreateTipoExameInput>({
    nome: '',
    descricao: '',
    template_padrao: '',
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

  useEffect(() => {
    carregarTiposExame();
  }, [carregarTiposExame]);

  // Filtrar tipos de exame pelo termo de busca
  const filteredTipos = tiposExame.filter(
    (tipo) =>
      tipo.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tipo.descricao && tipo.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Abrir diálogo para novo tipo
  const handleNovo = () => {
    setEditingTipo(null);
    setFormData({
      nome: '',
      descricao: '',
      template_padrao: '',
    });
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  };

  // Abrir diálogo para edição
  const handleEditar = (tipo: TipoExame) => {
    setEditingTipo(tipo);
    setFormData({
      nome: tipo.nome,
      descricao: tipo.descricao || '',
      template_padrao: tipo.template_padrao || '',
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

      if (!formData.nome.trim()) {
        setError('O nome é obrigatório.');
        return;
      }

      if (editingTipo) {
        // Atualizar
        const result = await window.ipcAPI.tipoExame.update(editingTipo.id, formData);

        if (result.success && result.data) {
          setSuccess('Tipo de exame atualizado com sucesso!');
          await carregarTiposExame();
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(result.error || 'Erro ao atualizar tipo de exame');
        }
      } else {
        // Criar novo
        const result = await window.ipcAPI.tipoExame.create(formData);

        if (result.success && result.data) {
          setSuccess('Tipo de exame criado com sucesso!');
          await carregarTiposExame();
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
        await carregarTiposExame();
      } else {
        alert(`Erro ao excluir: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro ao excluir tipo de exame:', error);
      alert('Erro ao excluir tipo de exame');
    }
  };

  // Gerenciar template padrão
  const handleGerenciarTemplate = async (tipo: TipoExame) => {
    const template = prompt(
      'Edite o template padrão para este tipo de exame:',
      tipo.template_padrao || ''
    );

    if (template !== null) {
      try {
        const result = await window.ipcAPI.tipoExame.atualizarTemplate(tipo.id, template);
        if (result.success) {
          await carregarTiposExame();
          alert('Template atualizado com sucesso!');
        } else {
          alert(`Erro ao salvar template: ${result.error}`);
        }
      } catch (error) {
        console.error('Erro ao salvar template:', error);
        alert('Erro ao salvar template');
      }
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tipos de Exame</h1>
          <p className="text-gray-600 mt-2">
            Gerencie os tipos de exame pericial e seus templates padrão
          </p>
        </div>
        <Button onClick={handleNovo} className="flex items-center gap-2">
          <Plus size={16} />
          Novo Tipo de Exame
        </Button>
      </div>

      {/* Card de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total de Tipos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tiposExame.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Com Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tiposExame.filter((t) => t.template_padrao).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Sem Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tiposExame.filter((t) => !t.template_padrao).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca e tabela */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Lista de Tipos de Exame</CardTitle>
              <CardDescription>
                {filteredTipos.length} tipo(s) encontrado(s)
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar tipos..."
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
          ) : error && filteredTipos.length === 0 ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : filteredTipos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'Nenhum tipo encontrado para a busca.' : 'Nenhum tipo de exame cadastrado.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTipos.map((tipo) => (
                  <TableRow key={tipo.id}>
                    <TableCell className="font-medium">{tipo.nome}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {tipo.descricao || '-'}
                    </TableCell>
                    <TableCell>
                      {tipo.template_padrao ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✅ Configurado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          ⚠️ Não configurado
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGerenciarTemplate(tipo)}
                          title="Gerenciar Template"
                        >
                          <FileText size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditar(tipo)}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExcluir(tipo.id)}
                          className="text-red-600 hover:text-red-700"
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

      {/* Diálogo de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
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
              <label htmlFor="nome" className="text-sm font-medium">
                Nome *
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

            <div className="space-y-2">
              <label htmlFor="descricao" className="text-sm font-medium">
                Descrição
              </label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) =>
                  setFormData({ ...formData, descricao: e.target.value })
                }
                placeholder="Descrição detalhada do tipo de exame..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="template" className="text-sm font-medium">
                Template Padrão (opcional)
              </label>
              <Textarea
                id="template"
                value={formData.template_padrao}
                onChange={(e) =>
                  setFormData({ ...formData, template_padrao: e.target.value })
                }
                placeholder="Template base para geração de laudos deste tipo..."
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500">
                Use placeholders como {"{perito.nome}"}, {"{rep.numero}"}, etc.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={!formData.nome.trim()}>
              {editingTipo ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
