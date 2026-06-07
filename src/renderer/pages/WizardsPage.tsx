import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, Loader2, AlertCircle, Wand2 } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { toast } from 'sonner';

interface WizardItem {
  id: string;
  tipo_exame_id: string;
  template_id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface TipoExameItem {
  id: string;
  nome: string;
}

interface TemplateItem {
  id: string;
  nome: string;
}

const WizardsPage: React.FC = () => {
  const navigate = useNavigate();
  const [wizards, setWizards] = useState<WizardItem[]>([]);
  const [tiposExame, setTiposExame] = useState<TipoExameItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroTipoExame, setFiltroTipoExame] = useState('todos');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formTipoExameId, setFormTipoExameId] = useState('');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<WizardItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wizRes, tipoRes, tplRes] = await Promise.all([
        window.ipcAPI.wizard.findAll(),
        window.ipcAPI.tipoExame.findAllSemFiltroStatus(),
        window.ipcAPI.template.findAll(),
      ]);
      if (wizRes.success) setWizards(wizRes.data || []);
      else setError(wizRes.error || 'Erro');
      if (tipoRes.success) setTiposExame(tipoRes.data || []);
      if (tplRes.success) setTemplates(tplRes.data || []);
    } catch (e: any) {
      setError(e.message || 'Erro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = filtroTipoExame === 'todos'
    ? wizards
    : wizards.filter(w => w.tipo_exame_id === filtroTipoExame);

  const ativos = wizards.filter(w => w.ativo).length;
  const inativos = wizards.length - ativos;

  const handleNovo = () => {
    setFormNome('');
    setFormDescricao('');
    setFormTipoExameId('');
    setFormTemplateId('');
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formNome.trim() || !formTipoExameId || !formTemplateId) return;
    setSaving(true);
    try {
      const res = await window.ipcAPI.wizard.create({
        nome: formNome.trim(),
        descricao: formDescricao.trim() || undefined,
        tipo_exame_id: formTipoExameId,
        template_id: formTemplateId,
        ativo: true,
      });
      if (res.success) {
        toast.success('Wizard criado');
        if (res.data?.id) navigate(`/wizards/${res.data.id}`);
        else loadData();
        setDialogOpen(false);
      } else toast.error(res.error || 'Erro');
    } catch (e: any) {
      toast.error(e.message || 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      const res = await window.ipcAPI.wizard.delete(deletingItem.id);
      if (res.success) { toast.success('Wizard excluído'); loadData(); }
      else toast.error(res.error || 'Erro');
    } catch (e: any) {
      toast.error(e.message || 'Erro');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingItem(null);
    }
  };

  const colunas: ColumnDef<WizardItem>[] = [
    {
      accessorKey: 'nome',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Nome" />,
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.nome}</span>
          {row.original.descricao && (
            <p className="text-xs text-muted-foreground truncate max-w-[250px]">{row.original.descricao}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'tipo_exame_id',
      header: 'Tipo de Exame',
      cell: ({ row }) => {
        const te = tiposExame.find(t => t.id === row.original.tipo_exame_id);
        return <span className="text-sm">{te?.nome || '—'}</span>;
      },
    },
    {
      accessorKey: 'template_id',
      header: 'Template',
      cell: ({ row }) => {
        const tpl = templates.find(t => t.id === row.original.template_id);
        return <span className="text-sm">{tpl?.nome || '—'}</span>;
      },
    },
    {
      accessorKey: 'ativo',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.ativo ? 'default' : 'secondary'}>
          {row.original.ativo ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/wizards/${row.original.id}`)}>
                <Edit size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => { setDeletingItem(row.original); setDeleteDialogOpen(true); }}>
                <Trash2 size={14} className="text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Wizards</h1>
            <p className="text-muted-foreground mt-1">Configure árvores de decisão para gerar laudos automaticamente.</p>
          </div>
          <Button onClick={handleNovo} className="flex items-center gap-2 w-full sm:w-auto">
            <Plus size={16} /> Novo Wizard
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{wizards.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ativos</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-emerald-600">{ativos}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Inativos</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-muted-foreground">{inativos}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
              <div>
                <CardTitle>Wizards Cadastrados</CardTitle>
                <CardDescription>{filtered.length} wizard(s)</CardDescription>
              </div>
              <Select value={filtroTipoExame} onValueChange={setFiltroTipoExame}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tipo de Exame" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {tiposExame.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
                <Wand2 size={48} />
                <p>Nenhum wizard encontrado</p>
                <Button variant="outline" size="sm" onClick={handleNovo}>Criar primeiro wizard</Button>
              </div>
            ) : (
              <DataTable columns={colunas} data={filtered} searchColumn="nome" searchPlaceholder="Buscar wizard..." />
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Wizard</DialogTitle>
              <DialogDescription>Configure o wizard que será usado para gerar laudos.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Nome do wizard" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={formDescricao} onChange={e => setFormDescricao(e.target.value)} placeholder="Breve descrição" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Exame *</Label>
                <Select value={formTipoExameId} onValueChange={setFormTipoExameId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {tiposExame.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Template *</Label>
                <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving || !formNome.trim() || !formTipoExameId || !formTemplateId}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir Wizard</DialogTitle>
              <DialogDescription>Tem certeza que deseja excluir "{deletingItem?.nome}"?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default WizardsPage;
