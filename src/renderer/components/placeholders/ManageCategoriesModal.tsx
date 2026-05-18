import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Plus, Lock, Check } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

export interface CategoriaPlaceholderRow {
  id: string;
  chave: string;
  label: string;
  descricao: string | null;
  cor: string;
  icone: string;
  is_sistema: number;
  ordem: number;
}

const ALLOWED_COLORS = ['slate', 'red', 'orange', 'amber', 'emerald', 'teal', 'blue', 'indigo', 'violet', 'fuchsia', 'pink', 'rose'];

// 40 popular icons for the picker
const POPULAR_ICONS = [
  'Tag', 'Folder', 'File', 'FileText', 'Image', 'Database', 'Puzzle', 'Box',
  'Layers', 'Component', 'Layout', 'Settings', 'Tool', 'Shield', 'Lock', 'Key',
  'User', 'Users', 'UserCheck', 'Briefcase', 'Building', 'MapPin', 'Calendar', 'Clock',
  'Zap', 'Star', 'Heart', 'Flag', 'Bell', 'Info', 'AlertCircle', 'CheckCircle',
  'XCircle', 'HelpCircle', 'MessageSquare', 'Mail', 'Phone', 'Camera', 'Video', 'Music'
];

interface ManageCategoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: CategoriaPlaceholderRow[];
  onCategoriasChange: () => void;
}

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({
  open, onOpenChange, categorias, onCategoriasChange
}) => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingCat, setEditingCat] = useState<CategoriaPlaceholderRow | null>(null);
  
  const [formData, setFormData] = useState({
    chave: '',
    label: '',
    descricao: '',
    cor: 'slate',
    icone: 'Tag'
  });
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form helpers
  const handleEdit = (cat: CategoriaPlaceholderRow) => {
    setEditingCat(cat);
    setFormData({
      chave: cat.chave,
      label: cat.label,
      descricao: cat.descricao || '',
      cor: cat.cor || 'slate',
      icone: cat.icone || 'Tag'
    });
    setError(null);
    setView('form');
  };

  const handleNew = () => {
    setEditingCat(null);
    setFormData({
      chave: '',
      label: '',
      descricao: '',
      cor: 'slate',
      icone: 'Tag'
    });
    setError(null);
    setView('form');
  };

  const handleSave = async () => {
    try {
      setError(null);
      if (!formData.label.trim()) {
        setError('O Nome da Categoria é obrigatório.');
        return;
      }

      const generatedChave = formData.label
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_]/g, '');

      const payload = {
        chave: editingCat ? formData.chave : generatedChave,
        label: formData.label.trim(),
        descricao: formData.descricao.trim() || null,
        cor: formData.cor,
        icone: formData.icone,
      };

      if (!payload.chave) {
        setError('Label inválido para gerar um identificador.');
        return;
      }

      if (editingCat) {
        const res = await window.ipcAPI.categoria.update(editingCat.id, payload);
        if (res.success) {
          onCategoriasChange();
          setView('list');
        } else {
          setError(res.error || 'Erro ao atualizar categoria');
        }
      } else {
        const res = await window.ipcAPI.categoria.create(payload);
        if (res.success) {
          onCategoriasChange();
          setView('list');
        } else {
          setError(res.error || 'Erro ao criar categoria');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro interno');
    }
  };

  const handleDeleteClick = async (cat: CategoriaPlaceholderRow) => {
    setIsDeleting(cat.id);
  };

  const confirmDelete = async (id: string) => {
    try {
      const res = await window.ipcAPI.categoria.delete(id);
      if (res.success) {
        onCategoriasChange();
      } else {
        alert(res.error || 'Erro ao excluir');
      }
    } catch (err: any) {
      alert('Erro interno: ' + err.message);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias</DialogTitle>
          <DialogDescription>
            Personalize a organização dos placeholders do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 py-2">
          {view === 'list' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={handleNew}><Plus size={16} className="mr-2" /> Nova Categoria</Button>
              </div>

              <div className="space-y-2">
                {categorias.filter(c => c.id !== 'cat-sem-categoria').map(cat => {
                  const Icon = (LucideIcons as any)[cat.icone] || LucideIcons.Tag;
                  const isSys = cat.is_sistema === 1;

                  return (
                    <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${cat.cor}-100 dark:bg-${cat.cor}-900/30 text-${cat.cor}-600 dark:text-${cat.cor}-400`}>
                          <Icon size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{cat.label}</h4>
                            {isSys && <Badge variant="outline" className="text-[10px] px-1 h-4 gap-1"><Lock size={8}/> Sistema</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{cat.chave} {cat.descricao ? `• ${cat.descricao}` : ''}</p>
                        </div>
                      </div>

                      {isDeleting === cat.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-destructive">Excluir e mover placeholders?</span>
                          <Button size="sm" variant="destructive" onClick={() => confirmDelete(cat.id)}>Sim</Button>
                          <Button size="sm" variant="ghost" onClick={() => setIsDeleting(null)}>Não</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(cat)}>
                            <Edit size={16} className="text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteClick(cat)}
                            disabled={isSys}
                          >
                            <Trash2 size={16} className={isSys ? "text-muted-foreground/30" : "text-destructive hover:bg-destructive/10"} />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'form' && (
            <div className="space-y-6">
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              
              <div className="grid grid-cols-1 gap-4 px-1">
                <div className="space-y-2">
                  <Label>Nome da Categoria</Label>
                  <Input 
                    value={formData.label} 
                    onChange={e => setFormData({...formData, label: e.target.value})} 
                    placeholder="Ex: Armas de Fogo" 
                    disabled={editingCat?.is_sistema === 1}
                  />
                  {!editingCat && (
                    <p className="text-[10px] text-muted-foreground mt-1">O código interno da categoria será gerado automaticamente.</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 px-1">
                <Label>Descrição</Label>
                <Textarea 
                  value={formData.descricao} 
                  onChange={e => setFormData({...formData, descricao: e.target.value})} 
                  placeholder="Opcional..." 
                  rows={2}
                />
              </div>

              <div className="space-y-2 px-1">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2 py-1">
                  {ALLOWED_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({...formData, cor: color})}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all bg-${color}-500 hover:scale-110 ${formData.cor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                      title={color}
                    >
                      {formData.cor === color && <Check size={14} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 px-1">
                <Label>Ícone</Label>
                <div className="grid grid-cols-8 sm:grid-cols-10 gap-2 border rounded-lg p-3 max-h-48 overflow-y-auto bg-muted/10">
                  {POPULAR_ICONS.map(iconName => {
                    const IconComp = (LucideIcons as any)[iconName];
                    if (!IconComp) return null;
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setFormData({...formData, icone: iconName})}
                        className={`p-2 rounded-md flex justify-center items-center hover:bg-muted transition-colors ${formData.icone === iconName ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground'}`}
                        title={iconName}
                      >
                        <IconComp size={20} />
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>

        {view === 'form' && (
          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setView('list')}>Voltar</Button>
            <Button onClick={handleSave}>Salvar Categoria</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
