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
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { REP } from '@/lib/validators';

interface REPFormData {
  numero: string;
  solicitante_id: string;
  tipo_exame_id: string;
  data_requisicao: string;
  prazo: string;
  tipo_solicitacao: string;
  numero_documento: string;
  data_documento: string;
  autoridade_solicitante: string;
  nome_envolvido: string;
  data_acionamento: string;
  data_chegada: string;
  data_saida: string;
  local_fato: string;
  latitude: string;
  longitude: string;
  lacre_entrada: string;
  lacre_saida: string;
  numero_bo: string;
  numero_ip: string;
  observacoes: string;
}

const emptyForm = (): REPFormData => ({
  numero: '', solicitante_id: '', tipo_exame_id: '', data_requisicao: '', prazo: '',
  tipo_solicitacao: '', numero_documento: '', data_documento: '',
  autoridade_solicitante: '', nome_envolvido: '', data_acionamento: '',
  data_chegada: '', data_saida: '', local_fato: '', latitude: '', longitude: '',
  lacre_entrada: '', lacre_saida: '', numero_bo: '', numero_ip: '', observacoes: '',
});

export const REPsPage: React.FC = () => {
  const [reps, setReps] = useState<REP[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<REP | null>(null);
  const [formData, setFormData] = useState<REPFormData>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [solicitantes, setSolicitantes] = useState<any[]>([]);
  const [tiposExame, setTiposExame] = useState<any[]>([]);

  const carregarREPs = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const r = await window.ipcAPI.rep.findAll();
      if (r.success && r.data) setReps(r.data); else setError(r.error);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);

  const carregarSolicitantes = useCallback(async () => {
    const r = await window.ipcAPI.solicitante.findAll();
    if (r.success && r.data) setSolicitantes(r.data);
  }, []);

  const carregarTiposExame = useCallback(async () => {
    const r = await window.ipcAPI.tipoExame.findAll();
    if (r.success && r.data) setTiposExame(r.data);
  }, []);

  useEffect(() => { carregarREPs(); carregarSolicitantes(); carregarTiposExame(); }, []);

  const filteredREPs = reps.filter(r =>
    r.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.nome_envolvido || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.numero_bo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNovo = () => {
    setEditingRep(null); setFormData(emptyForm()); setError(null); setSuccess(null); setDialogOpen(true);
  };

  const handleEditar = (rep: REP) => {
    setEditingRep(rep);
    setFormData({
      numero: rep.numero,
      solicitante_id: rep.solicitante_id || '',
      tipo_exame_id: rep.tipo_exame_id || '',
      data_requisicao: rep.data_requisicao?.split('T')[0] || '',
      prazo: rep.prazo?.split('T')[0] || '',
      tipo_solicitacao: rep.tipo_solicitacao || '',
      numero_documento: rep.numero_documento || '',
      data_documento: rep.data_documento?.split('T')[0] || '',
      autoridade_solicitante: rep.autoridade_solicitante || '',
      nome_envolvido: rep.nome_envolvido || '',
      data_acionamento: rep.data_acionamento || '',
      data_chegada: rep.data_chegada || '',
      data_saida: rep.data_saida || '',
      local_fato: rep.local_fato || '',
      latitude: rep.latitude != null ? String(rep.latitude) : '',
      longitude: rep.longitude != null ? String(rep.longitude) : '',
      lacre_entrada: rep.lacre_entrada || '',
      lacre_saida: rep.lacre_saida || '',
      numero_bo: rep.numero_bo || '',
      numero_ip: rep.numero_ip || '',
      observacoes: rep.observacoes || '',
    });
    setError(null); setSuccess(null); setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta REP?')) return;
    try {
      const r = await window.ipcAPI.rep.delete(id);
      if (r.success) { await carregarREPs(); } else { alert(`Erro: ${r.error}`); }
    } catch (e: any) { alert('Erro ao excluir REP'); }
  };

  const handleSalvar = async () => {
    try {
      setError(null); setSuccess(null); setSubmitting(true);

      if (!formData.numero.trim()) {
        setError('Número da REP é obrigatório.'); setSubmitting(false); return;
      }
      if (!formData.data_requisicao.trim()) {
        setError('Data da solicitação é obrigatória.'); setSubmitting(false); return;
      }

      if (editingRep) {
        const r = await window.ipcAPI.rep.update(editingRep.id, {
          numero: formData.numero,
          solicitante_id: formData.solicitante_id || null,
          tipo_exame_id: formData.tipo_exame_id || null,
          data_requisicao: formData.data_requisicao,
          prazo: formData.prazo || null,
          tipo_solicitacao: formData.tipo_solicitacao || null,
          numero_documento: formData.numero_documento || null,
          data_documento: formData.data_documento || null,
          autoridade_solicitante: formData.autoridade_solicitante || null,
          nome_envolvido: formData.nome_envolvido || null,
          data_acionamento: formData.data_acionamento || null,
          data_chegada: formData.data_chegada || null,
          data_saida: formData.data_saida || null,
          local_fato: formData.local_fato || null,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          lacre_entrada: formData.lacre_entrada || null,
          lacre_saida: formData.lacre_saida || null,
          numero_bo: formData.numero_bo || null,
          numero_ip: formData.numero_ip || null,
          observacoes: formData.observacoes || null,
        });
        if (r.success) {
          setSuccess('REP atualizada com sucesso!');
          await carregarREPs();
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(r.error || 'Erro ao atualizar REP');
        }
      } else {
        const r = await window.ipcAPI.rep.create({
          numero: formData.numero,
          solicitante_id: formData.solicitante_id || null,
          tipo_exame_id: formData.tipo_exame_id || null,
          data_requisicao: formData.data_requisicao,
          prazo: formData.prazo || null,
          tipo_solicitacao: formData.tipo_solicitacao || null,
          numero_documento: formData.numero_documento || null,
          data_documento: formData.data_documento || null,
          autoridade_solicitante: formData.autoridade_solicitante || null,
          nome_envolvido: formData.nome_envolvido || null,
          data_acionamento: formData.data_acionamento || null,
          data_chegada: formData.data_chegada || null,
          data_saida: formData.data_saida || null,
          local_fato: formData.local_fato || null,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          lacre_entrada: formData.lacre_entrada || null,
          lacre_saida: formData.lacre_saida || null,
          numero_bo: formData.numero_bo || null,
          numero_ip: formData.numero_ip || null,
          observacoes: formData.observacoes || null,
        });
        if (r.success) {
          setSuccess('REP criada com sucesso!');
          await carregarREPs();
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(r.error || 'Erro ao criar REP');
        }
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar REP');
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'Pendente': 'bg-yellow-100 text-yellow-800',
      'Em Andamento': 'bg-blue-100 text-blue-800',
      'Concluído': 'bg-green-100 text-green-800',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Requisições (REPs)</h1>
          <p className="text-gray-600 mt-2">Gerencie as requisições de exame pericial</p>
        </div>
        <Button onClick={handleNovo} className="flex items-center gap-2"><Plus size={16} /> Nova REP</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Lista de REPs</CardTitle>
              <CardDescription>{filteredREPs.length} registro(s) encontrado(s)</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input placeholder="Buscar REPs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8 text-gray-500">Carregando...</div>
          : filteredREPs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{searchTerm ? 'Nenhuma REP encontrada.' : 'Nenhuma REP cadastrada.'}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº REP</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Envolvido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredREPs.map(rep => (
                  <TableRow key={rep.id}>
                    <TableCell className="font-mono text-sm font-medium">{rep.numero}</TableCell>
                    <TableCell>{rep.data_requisicao?.split('T')[0] || '-'}</TableCell>
                    <TableCell>{rep.tipo_solicitacao || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{rep.nome_envolvido || '-'}</TableCell>
                    <TableCell>{statusBadge(rep.status || 'Pendente')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditar(rep)}>
                          <Edit size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(rep.id)}>
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

      {/* Diálogo Nova/Editar REP */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRep ? 'Editar REP' : 'Nova Requisição de Exame Pericial'}</DialogTitle>
            <DialogDescription>Preencha os dados da requisição.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            {success && <Alert className="bg-green-50 border-green-200"><AlertDescription className="text-green-800">{success}</AlertDescription></Alert>}

            {/* Dados da Solicitação */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Dados da Solicitação</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numero">Nº da REP *</Label>
                  <Input id="numero" value={formData.numero} onChange={e => setFormData({...formData, numero: e.target.value})} placeholder="Ex: 2025/00123" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_requisicao">Data da Solicitação *</Label>
                  <Input id="data_requisicao" type="date" value={formData.data_requisicao} onChange={e => setFormData({...formData, data_requisicao: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prazo">Prazo</Label>
                  <Input id="prazo" type="date" value={formData.prazo} onChange={e => setFormData({...formData, prazo: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="solicitante_id">Solicitante</Label>
                  <Select value={formData.solicitante_id} onValueChange={v => setFormData({...formData, solicitante_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione o órgão..." /></SelectTrigger>
                    <SelectContent>
                      {solicitantes.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_exame_id">Tipo de Exame</Label>
                  <Select value={formData.tipo_exame_id} onValueChange={v => setFormData({...formData, tipo_exame_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione o exame..." /></SelectTrigger>
                    <SelectContent>
                      {tiposExame.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_solicitacao">Tipo de Solicitação</Label>
                  <Select value={formData.tipo_solicitacao} onValueChange={v => setFormData({...formData, tipo_solicitacao: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ordinária">Ordinária</SelectItem>
                      <SelectItem value="Urgente">Urgente</SelectItem>
                      <SelectItem value="Prioritária">Prioritária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="numero_documento">Nº do Documento</Label>
                  <Input id="numero_documento" value={formData.numero_documento} onChange={e => setFormData({...formData, numero_documento: e.target.value})} placeholder="Ofício/Requisição nº" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_documento">Data do Documento</Label>
                  <Input id="data_documento" type="date" value={formData.data_documento} onChange={e => setFormData({...formData, data_documento: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="autoridade_solicitante">Autoridade Solicitante</Label>
                  <Input id="autoridade_solicitante" value={formData.autoridade_solicitante} onChange={e => setFormData({...formData, autoridade_solicitante: e.target.value})} placeholder="Nome da autoridade" />
                </div>
              </div>
            </div>

            {/* Envolvido e Local */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Envolvido e Local do Fato</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome_envolvido">Nome do Envolvido</Label>
                  <Input id="nome_envolvido" value={formData.nome_envolvido} onChange={e => setFormData({...formData, nome_envolvido: e.target.value})} placeholder="Nome da pessoa envolvida" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="local_fato">Local do Fato</Label>
                  <Input id="local_fato" value={formData.local_fato} onChange={e => setFormData({...formData, local_fato: e.target.value})} placeholder="Descrição do local" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input id="latitude" type="number" step="any" value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})} placeholder="-25.4284" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input id="longitude" type="number" step="any" value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})} placeholder="-49.2674" />
                </div>
              </div>
            </div>

            {/* Acionamento */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Acionamento</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_acionamento">Data/Hora Acionamento</Label>
                  <Input id="data_acionamento" type="datetime-local" value={formData.data_acionamento} onChange={e => setFormData({...formData, data_acionamento: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_chegada">Data/Hora Chegada</Label>
                  <Input id="data_chegada" type="datetime-local" value={formData.data_chegada} onChange={e => setFormData({...formData, data_chegada: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_saida">Data/Hora Saída</Label>
                  <Input id="data_saida" type="datetime-local" value={formData.data_saida} onChange={e => setFormData({...formData, data_saida: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Documentos Associados */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Documentos Associados</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numero_bo">Nº do BO</Label>
                  <Input id="numero_bo" value={formData.numero_bo} onChange={e => setFormData({...formData, numero_bo: e.target.value})} placeholder="Boletim de Ocorrência" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero_ip">Nº do IP</Label>
                  <Input id="numero_ip" value={formData.numero_ip} onChange={e => setFormData({...formData, numero_ip: e.target.value})} placeholder="Inquérito Policial" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lacre_entrada">Lacre de Entrada</Label>
                  <Input id="lacre_entrada" value={formData.lacre_entrada} onChange={e => setFormData({...formData, lacre_entrada: e.target.value})} placeholder="Nº do lacre" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="lacre_saida">Lacre de Saída</Label>
                  <Input id="lacre_saida" value={formData.lacre_saida} onChange={e => setFormData({...formData, lacre_saida: e.target.value})} placeholder="Nº do lacre" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea id="observacoes" value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})} placeholder="Observações gerais..." rows={2} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={submitting} className="flex items-center gap-2">
              <Plus size={16} /> {submitting ? 'Salvando...' : editingRep ? 'Atualizar' : 'Criar'} REP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
