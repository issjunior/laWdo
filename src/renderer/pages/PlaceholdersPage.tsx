import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Search, Edit, Trash2, Puzzle, Info, Lock, Zap, ArrowRight } from 'lucide-react';
import { Placeholder } from '@/lib/validators';

interface PlaceholderFormData {
  chave: string;
  valor: string;
  descricao: string;
  categoria: string;
}

const emptyForm = (): PlaceholderFormData => ({
  chave: '', valor: '', descricao: '', categoria: 'Personalizado',
});

export const PlaceholdersPage: React.FC = () => {
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlaceholder, setEditingPlaceholder] = useState<Placeholder | null>(null);
  const [formData, setFormData] = useState<PlaceholderFormData>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const carregarPlaceholders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Garantir seed antes de listar
      await window.ipcAPI.placeholder.seedSistema();
      const r = await window.ipcAPI.placeholder.findAll();
      if (r.success && r.data) {
        setPlaceholders(r.data);
      } else {
        setError(r.error || 'Erro ao carregar placeholders');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar placeholders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarPlaceholders(); }, [carregarPlaceholders]);

  const filtered = placeholders.filter(p =>
    p.chave.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.categoria || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNovo = () => {
    setEditingPlaceholder(null);
    setFormData(emptyForm());
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  };

  const handleEditar = (p: Placeholder) => {
    setEditingPlaceholder(p);
    setFormData({
      chave: p.chave,
      valor: p.valor || '',
      descricao: p.descricao || '',
      categoria: p.categoria || 'Personalizado',
    });
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este placeholder?')) return;
    try {
      const r = await window.ipcAPI.placeholder.delete(id);
      if (r.success) {
        await carregarPlaceholders();
      } else {
        alert(`Erro: ${r.error}`);
      }
    } catch (err: any) {
      alert('Erro ao excluir placeholder');
    }
  };

  const handleSalvar = async () => {
    try {
      setError(null);
      setSuccess(null);

      if (!formData.chave.trim()) {
        setError('A chave do placeholder é obrigatória.');
        return;
      }

      if (editingPlaceholder) {
        const r = await window.ipcAPI.placeholder.update(editingPlaceholder.id, {
          chave: formData.chave,
          valor: formData.valor,
          descricao: formData.descricao || null,
          categoria: formData.categoria || null,
        });
        if (r.success) {
          setSuccess('Placeholder atualizado com sucesso!');
          await carregarPlaceholders();
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(r.error || 'Erro ao atualizar placeholder');
        }
      } else {
        const r = await window.ipcAPI.placeholder.create({
          chave: formData.chave,
          valor: formData.valor,
          descricao: formData.descricao || null,
          categoria: formData.categoria || null,
        });
        if (r.success) {
          setSuccess('Placeholder criado com sucesso!');
          await carregarPlaceholders();
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(r.error || 'Erro ao criar placeholder');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar placeholder');
    }
  };

  const isSistema = (p: Placeholder) => p.categoria === 'REP';

  const totalSistema = placeholders.filter(p => isSistema(p)).length;
  const totalPersonalizados = placeholders.filter(p => !isSistema(p)).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Placeholders</h1>
          <p className="text-gray-600 mt-2">
            Gerencie os placeholders disponíveis para uso nos laudos
          </p>
        </div>
        <Button onClick={handleNovo} className="flex items-center gap-2">
          <Plus size={16} /> Novo Placeholder
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total de Placeholders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{placeholders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Placeholders do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm flex items-center space-x-2">
              <Lock size={14} className="text-gray-400" />
              <span className="text-blue-600 font-medium">{totalSistema} fixos (REP)</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Placeholders Personalizados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <span className="text-green-600 font-medium">{totalPersonalizados} criados pelo usuário</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Lista de Placeholders</CardTitle>
              <CardDescription>{filtered.length} placeholder(s) encontrado(s)</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar placeholders..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'Nenhum placeholder encontrado.' : 'Nenhum placeholder cadastrado.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chave</TableHead>
                  <TableHead>Valor Padrão</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {`{{${p.chave}}}`}
                    </TableCell>
                    <TableCell className="text-gray-500 max-w-[150px] truncate">
                      {p.valor || '—'}
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate">
                      {p.descricao || '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isSistema(p) ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {isSistema(p) && <Lock size={10} className="mr-1" />}
                        {p.categoria || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditar(p)}>
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExcluir(p.id)}
                          disabled={isSistema(p)}
                          className={isSistema(p) ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:text-red-700'}
                          title={isSistema(p) ? 'Placeholders do sistema não podem ser excluídos' : 'Excluir'}
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

      {/* Instruções de uso */}
      <Card className="border-blue-200 bg-gradient-to-b from-white to-blue-50/30">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
              <Zap size={20} className="text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl">Como usar placeholders no laudo</CardTitle>
              <CardDescription>
                Um guia simples para automatizar o preenchimento dos seus documentos
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 pt-4">
          {/* O que são */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-5">
            <div className="flex gap-3">
              <Info size={22} className="text-blue-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1.5">O que é um placeholder?</h3>
                <p className="text-blue-800 text-sm leading-relaxed">
                  É um <strong>atalho inteligente</strong> que o sistema substitui automaticamente pela informação real.
                  Funciona como um "espaço reservado" no texto: você digita um código simples entre chaves duplas,
                  e na hora de gerar o laudo, o sistema troca esse código pelo dado verdadeiro —
                  como o número da REP, o nome do envolvido ou a data da solicitação.
                </p>
              </div>
            </div>
          </div>

          {/* Exemplo visual */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <ArrowRight size={18} className="text-gray-500" />
              Veja na prática
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Antes */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-amber-50 px-4 py-2 border-b border-amber-100">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">O que você digita</span>
                </div>
                <div className="p-4 font-mono text-sm leading-relaxed bg-white">
                  <p><span className="text-gray-400">REP nº</span> <span className="bg-pink-50 text-pink-700 px-1 rounded">{'{{rep_numero}}'}</span></p>
                  <p><span className="text-gray-400">Solicitante:</span> <span className="bg-pink-50 text-pink-700 px-1 rounded">{'{{solicitante_nome}}'}</span></p>
                  <p><span className="text-gray-400">Envolvido:</span> <span className="bg-pink-50 text-pink-700 px-1 rounded">{'{{rep_nome_envolvido}}'}</span></p>
                  <p><span className="text-gray-400">BO nº</span> <span className="bg-pink-50 text-pink-700 px-1 rounded">{'{{rep_numero_bo}}'}</span> <span className="text-gray-400">— IP nº</span> <span className="bg-pink-50 text-pink-700 px-1 rounded">{'{{rep_numero_ip}}'}</span></p>
                  <p><span className="text-gray-400">Exame:</span> <span className="bg-pink-50 text-pink-700 px-1 rounded">{'{{tipo_exame_nome}}'}</span></p>
                </div>
              </div>

              {/* Depois */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-50 px-4 py-2 border-b border-green-100">
                  <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">O que o laudo exibe</span>
                </div>
                <div className="p-4 text-sm leading-relaxed bg-white">
                  <p>REP nº <strong className="text-gray-900">2025/00123</strong></p>
                  <p>Solicitante: <strong className="text-gray-900">Delegacia de Polícia Civil</strong></p>
                  <p>Envolvido: <strong className="text-gray-900">João da Silva</strong></p>
                  <p>BO nº <strong className="text-gray-900">1234/2025</strong> — IP nº <strong className="text-gray-900">567/2025</strong></p>
                  <p>Exame: <strong className="text-gray-900">Exame de DNA</strong></p>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Os códigos em rosa são trocados pelos dados reais da REP automaticamente
            </p>
          </div>

          {/* Criando os seus próprios */}
          <div className="bg-white border rounded-lg p-5">
            <div className="flex gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-100 shrink-0">
                <Plus size={18} className="text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1.5">Crie seus próprios placeholders</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Precisa de um campo que não existe na lista? Clique em <strong>"Novo Placeholder"</strong> no topo da página,
                  dê um nome (ex: <code className="bg-gray-100 px-1 rounded text-pink-600 text-xs">SECAO_TECNICA</code>),
                  preencha um valor padrão se quiser, e pronto. Use <code className="bg-gray-100 px-1 rounded text-pink-600 text-xs">{'{{SECAO_TECNICA}}'}</code> em qualquer editor.
                </p>
              </div>
            </div>
          </div>

          {/* Dicas */}
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-5">
            <div className="flex gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-100 shrink-0">
                <Lock size={16} className="text-amber-600" />
              </div>
              <div className="space-y-3 text-sm text-amber-800">
                <div>
                  <h3 className="font-semibold mb-1">Placeholders fixos (REP)</h3>
                  <p className="leading-relaxed">
                    Os placeholders com o ícone <Lock size={12} className="inline text-amber-600" /> e categoria <strong>REP</strong> são fornecidos pelo sistema.
                    Eles correspondem aos campos da Requisição de Exame Pericial e <strong>não podem ser removidos</strong>.
                  </p>
                </div>
                <div className="border-t border-amber-200 pt-3">
                  <h3 className="font-semibold mb-1">Dica importante</h3>
                  <p className="leading-relaxed">
                    Se o placeholder não tiver um valor correspondente na REP (ex: campos de local em exames laboratoriais),
                    ele simplesmente <strong>aparecerá em branco</strong> no laudo final. Nenhum erro será exibido.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingPlaceholder ? 'Editar Placeholder' : 'Novo Placeholder'}
            </DialogTitle>
            <DialogDescription>
              {editingPlaceholder
                ? 'Atualize as informações do placeholder.'
                : 'Preencha as informações para criar um novo placeholder.'}
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
              <Label htmlFor="chave">Chave *</Label>
              <Input
                id="chave"
                value={formData.chave}
                onChange={e => setFormData({ ...formData, chave: e.target.value })}
                placeholder="Ex: MEU_CAMPO"
                disabled={!!editingPlaceholder && editingPlaceholder.categoria === 'REP'}
              />
              <p className="text-xs text-gray-500">
                Será usado como {'{{chave}}'} no editor de laudo.
                {editingPlaceholder && editingPlaceholder.categoria === 'REP' && ' Chave do sistema não pode ser alterada.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor padrão</Label>
              <Input
                id="valor"
                value={formData.valor}
                onChange={e => setFormData({ ...formData, valor: e.target.value })}
                placeholder="Valor padrão (opcional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descreva o que este placeholder representa..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                value={formData.categoria}
                onValueChange={v => setFormData({ ...formData, categoria: v })}
                disabled={!!editingPlaceholder && editingPlaceholder.categoria === 'REP'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REP">REP (Sistema)</SelectItem>
                  <SelectItem value="Personalizado">Personalizado</SelectItem>
                  <SelectItem value="Laudo">Laudo</SelectItem>
                  <SelectItem value="Perito">Perito</SelectItem>
                  <SelectItem value="Sistema">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={!formData.chave.trim()}>
              {editingPlaceholder ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
