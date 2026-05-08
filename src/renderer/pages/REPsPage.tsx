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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Search, Edit, Trash2, X, FileText, User, Clock3, Link2 } from 'lucide-react';
import { type REP } from '@/lib/validators';
import { z } from 'zod';

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
  numero: '', solicitante_id: '', tipo_exame_id: '', data_requisicao: new Date().toISOString().split('T')[0], prazo: '',
  tipo_solicitacao: 'Ofício', numero_documento: '', data_documento: '',
  autoridade_solicitante: '', nome_envolvido: '', data_acionamento: '',
  data_chegada: '', data_saida: '', local_fato: '', latitude: '', longitude: '',
  lacre_entrada: '', lacre_saida: '', numero_bo: '', numero_ip: '', observacoes: '',
});

type REPFormErrors = Partial<Record<keyof REPFormData, string>>;

function formatarNumeroREP(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  // Preenche da direita para esquerda: os últimos 4 dígitos formam o ano
  const len = digits.length;
  if (len <= 4) {
    return digits; // apenas o ano
  } else if (len <= 7) {
    return `${digits.slice(0, len - 4)}-${digits.slice(len - 4)}`; // meio-ano
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, len - 4)}-${digits.slice(len - 4)}`; // completo
}

const repFormSchema = z.object({
  numero: z
    .string()
    .min(1, 'Número da REP é obrigatório')
    .regex(/^\d{3}\.\d{3}-\d{4}$/, 'Formato inválido. Use: 000.000-0000'),
  solicitante_id: z.string().optional(),
  tipo_exame_id: z.string().optional(),
  data_requisicao: z.string().min(1, 'Data da solicitação é obrigatória'),
  prazo: z.string().optional(),
  tipo_solicitacao: z.string().max(50, 'Tipo de solicitação deve ter no máximo 50 caracteres').optional(),
  numero_documento: z.string().max(30, 'Nº do documento deve ter no máximo 30 caracteres').optional(),
  data_documento: z.string().optional(),
  autoridade_solicitante: z.string().max(200, 'Autoridade deve ter no máximo 200 caracteres').optional(),
  nome_envolvido: z.string().max(200, 'Nome do envolvido deve ter no máximo 200 caracteres').optional(),
  data_acionamento: z.string().optional(),
  data_chegada: z.string().optional(),
  data_saida: z.string().optional(),
  local_fato: z.string().max(500, 'Local do fato deve ter no máximo 500 caracteres').optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  lacre_entrada: z.string().max(50, 'Lacre de entrada deve ter no máximo 50 caracteres').optional(),
  lacre_saida: z.string().max(50, 'Lacre de saída deve ter no máximo 50 caracteres').optional(),
  numero_bo: z.string().max(30, 'Nº do BO deve ter no máximo 30 caracteres').optional(),
  numero_ip: z.string().max(30, 'Nº do IP deve ter no máximo 30 caracteres').optional(),
  observacoes: z.string().max(1000, 'Observações devem ter no máximo 1000 caracteres').optional(),
});

function prepareForApi(data: REPFormData) {
  const payload: Record<string, unknown> = {
    numero: data.numero,
    data_requisicao: data.data_requisicao,
  };

  if (data.solicitante_id) payload.solicitante_id = data.solicitante_id;
  if (data.tipo_exame_id) payload.tipo_exame_id = data.tipo_exame_id;
  if (data.prazo) payload.prazo = data.prazo;
  if (data.tipo_solicitacao) payload.tipo_solicitacao = data.tipo_solicitacao;
  if (data.numero_documento) payload.numero_documento = data.numero_documento;
  if (data.data_documento) payload.data_documento = data.data_documento;
  if (data.autoridade_solicitante) payload.autoridade_solicitante = data.autoridade_solicitante;
  if (data.nome_envolvido) payload.nome_envolvido = data.nome_envolvido;
  if (data.data_acionamento) payload.data_acionamento = data.data_acionamento;
  if (data.data_chegada) payload.data_chegada = data.data_chegada;
  if (data.data_saida) payload.data_saida = data.data_saida;
  if (data.local_fato) payload.local_fato = data.local_fato;
  if (data.latitude) payload.latitude = parseFloat(data.latitude);
  if (data.longitude) payload.longitude = parseFloat(data.longitude);
  if (data.lacre_entrada) payload.lacre_entrada = data.lacre_entrada;
  if (data.lacre_saida) payload.lacre_saida = data.lacre_saida;
  if (data.numero_bo) payload.numero_bo = data.numero_bo;
  if (data.numero_ip) payload.numero_ip = data.numero_ip;
  if (data.observacoes) payload.observacoes = data.observacoes;

  return payload;
}

interface SectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, description, icon, children }) => (
  <fieldset className="rounded-lg border bg-card/50 p-4 md:p-5 space-y-4">
    <legend className="px-2">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </span>
    </legend>
    <p className="text-xs text-muted-foreground -mt-1">{description}</p>
    {children}
  </fieldset>
);

export const REPsPage: React.FC = () => {
  const [reps, setReps] = useState<REP[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRep, setEditingRep] = useState<REP | null>(null);
  const [formData, setFormData] = useState<REPFormData>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [solicitantes, setSolicitantes] = useState<any[]>([]);
  const [tiposExame, setTiposExame] = useState<any[]>([]);
  const [templatesVinculados, setTemplatesVinculados] = useState<any[]>([]);
  const [errors, setErrors] = useState<REPFormErrors>({});

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

  // Quando o tipo de exame muda, busca os templates vinculados
  useEffect(() => {
    if (!showForm || !formData.tipo_exame_id) {
      setTemplatesVinculados([]);
      return;
    }
    (async () => {
      const r = await window.ipcAPI.template.findByTipoExame(formData.tipo_exame_id);
      if (r.success && r.data) {
        setTemplatesVinculados(r.data);
      } else {
        setTemplatesVinculados([]);
      }
    })();
  }, [formData.tipo_exame_id, showForm]);

  const filteredREPs = reps.filter(r =>
    r.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.nome_envolvido || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.numero_bo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tipoExameSelecionado = formData.tipo_exame_id
    ? tiposExame.find(t => t.id === formData.tipo_exame_id)
    : null;
  const isExameLocal = tipoExameSelecionado?.eh_local === true || tipoExameSelecionado?.eh_local === 1;

  const handleNovo = () => {
    setEditingRep(null);
    setError(null);
    setSuccess(null);
    setErrors({});
    setFormData(emptyForm());
    setShowForm(true);
  };

  const handleCancelar = () => {
    setShowForm(false);
    setEditingRep(null);
    setFormData(emptyForm());
    setError(null);
    setSuccess(null);
    setErrors({});
  };

  const handleEditar = (rep: REP) => {
    setEditingRep(rep);
    setError(null);
    setSuccess(null);
    setErrors({});

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
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta REP?')) return;
    try {
      const r = await window.ipcAPI.rep.delete(id);
      if (r.success) { await carregarREPs(); } else { alert(`Erro: ${r.error}`); }
    } catch (e: any) { alert('Erro ao excluir REP'); }
  };

  const validateField = (field: keyof REPFormData) => {
    const fieldSchema = repFormSchema.shape[field];
    if (!fieldSchema) return;
    const value = formData[field];
    const result = fieldSchema.safeParse(value);
    if (!result.success) {
      setErrors(prev => ({ ...prev, [field]: result.error.errors[0].message }));
    } else {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const updateField = (field: keyof REPFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSalvar = async () => {
    try {
      setError(null);
      setSuccess(null);
      setSubmitting(true);
      setErrors({});

      const result = repFormSchema.safeParse(formData);
      if (!result.success) {
        const fieldErrors: REPFormErrors = {};
        result.error.errors.forEach((err) => {
          const field = err.path[0] as keyof REPFormData;
          if (!fieldErrors[field]) {
            fieldErrors[field] = err.message;
          }
        });
        setErrors(fieldErrors);
        setSubmitting(false);
        return;
      }

      const apiData = prepareForApi(formData);

      if (editingRep) {
        const r = await window.ipcAPI.rep.update(editingRep.id, apiData);
        if (r.success) {
          setSuccess('REP atualizada com sucesso!');
          await carregarREPs();
          setTimeout(() => setSuccess(null), 3000);
        } else {
          setError(r.error || 'Erro ao atualizar REP');
        }
      } else {
        const r = await window.ipcAPI.rep.create(apiData);
        if (r.success) {
          setSuccess('REP criada com sucesso!');
          setFormData(emptyForm());
          setErrors({});
          setEditingRep(null);
          await carregarREPs();
          setTimeout(() => setSuccess(null), 3000);
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
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Requisições (REPs)</h1>
          <p className="text-muted-foreground mt-1">Gerencie as requisições de exame pericial</p>
        </div>
        <Button onClick={handleNovo} className="flex items-center gap-2 w-full sm:w-auto"><Plus size={16} /> Nova REP</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
            <div>
              <CardTitle>Lista de REPs</CardTitle>
              <CardDescription>{filteredREPs.length} registro(s) encontrado(s)</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por REP, envolvido ou BO..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            : filteredREPs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{searchTerm ? 'Nenhuma REP encontrada.' : 'Nenhuma REP cadastrada.'}</div>
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
                          <Button variant="ghost" size="sm" onClick={() => handleEditar(rep)} aria-label={`Editar REP ${rep.numero}`}>
                            <Edit size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(rep.id)} aria-label={`Excluir REP ${rep.numero}`}>
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

      {showForm && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <CardTitle>{editingRep ? 'Editar REP' : 'Nova Requisição de Exame Pericial'}</CardTitle>
                <CardDescription>
                  Campos marcados com <span className="font-semibold">*</span> são obrigatórios.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCancelar} aria-label="Fechar formulário">
                <X size={18} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                handleSalvar();
              }}
            >
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              {success && <Alert className="bg-green-50 border-green-200"><AlertDescription className="text-green-800">{success}</AlertDescription></Alert>}

              <Section title="Dados da Solicitação" description="Informações principais da requisição." icon={<FileText size={14} />}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="numero">Nº da REP *</Label>
                    <Input
                      id="numero"
                      required
                      value={formData.numero}
                      onChange={e => updateField('numero', formatarNumeroREP(e.target.value))}
                      className={errors.numero ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      placeholder="000.000-0000"
                    />
                    {errors.numero && <p className="text-xs text-red-600">{errors.numero}</p>}
                    <p className="text-xs text-muted-foreground">
                      Digite o número completo: os <strong>últimos 4 dígitos</strong> correspondem ao ano da REP.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data_requisicao">Data de recebimento *</Label>
                    <Input
                      id="data_requisicao"
                      required
                      type="date"
                      value={formData.data_requisicao}
                      onChange={e => updateField('data_requisicao', e.target.value)}
                      onBlur={() => validateField('data_requisicao')}
                      className={errors.data_requisicao ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {errors.data_requisicao && <p className="text-xs text-red-600">{errors.data_requisicao}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="solicitante_id">Solicitante</Label>
                    <Select value={formData.solicitante_id} onValueChange={v => updateField('solicitante_id', v)}>
                      <SelectTrigger id="solicitante_id"><SelectValue placeholder="Selecione o órgão..." /></SelectTrigger>
                      <SelectContent>
                        {solicitantes.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Responsável/Contato</Label>
                    <Input value={formData.solicitante_id ? (solicitantes.find(s => s.id === formData.solicitante_id)?.tipo || '—') : '—'} readOnly className="bg-muted text-muted-foreground cursor-default" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo_exame_id">Tipo de Exame</Label>
                    <Select value={formData.tipo_exame_id} onValueChange={v => updateField('tipo_exame_id', v)}>
                      <SelectTrigger id="tipo_exame_id"><SelectValue placeholder="Selecione o exame..." /></SelectTrigger>
                      <SelectContent>
                        {tiposExame.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Template</Label>
                    <Input
                      value={
                        !formData.tipo_exame_id
                          ? '—'
                          : templatesVinculados.length === 0
                            ? 'Nenhum template cadastrado'
                            : templatesVinculados.map(t => t.nome).join(', ')
                      }
                      readOnly
                      className="bg-muted text-muted-foreground cursor-default"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo_solicitacao">Tipo de Solicitação</Label>
                    <Select value={formData.tipo_solicitacao} onValueChange={v => updateField('tipo_solicitacao', v)}>
                      <SelectTrigger id="tipo_solicitacao"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BOU">BOU</SelectItem>
                        <SelectItem value="BO PM">BO PM</SelectItem>
                        <SelectItem value="BO PC">BO PC</SelectItem>
                        <SelectItem value="Ofício">Ofício</SelectItem>
                        <SelectItem value="CECOMP">CECOMP</SelectItem>
                        <SelectItem value="Outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numero_documento">Nº da Solicitação</Label>
                    <Input
                      id="numero_documento"
                      value={formData.numero_documento}
                      onChange={e => updateField('numero_documento', e.target.value)}
                      onBlur={() => validateField('numero_documento')}
                      className={errors.numero_documento ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      placeholder="Requisição nº"
                    />
                    {errors.numero_documento && <p className="text-xs text-red-600">{errors.numero_documento}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data_documento">Data do Documento</Label>
                    <Input
                      id="data_documento"
                      type="date"
                      value={formData.data_documento}
                      onChange={e => updateField('data_documento', e.target.value)}
                      className={errors.data_documento ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {errors.data_documento && <p className="text-xs text-red-600">{errors.data_documento}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="autoridade_solicitante">Autoridade Solicitante</Label>
                    <Input
                      id="autoridade_solicitante"
                      value={formData.autoridade_solicitante}
                      onChange={e => updateField('autoridade_solicitante', e.target.value)}
                      onBlur={() => validateField('autoridade_solicitante')}
                      className={errors.autoridade_solicitante ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      placeholder="Nome da autoridade"
                    />
                    {errors.autoridade_solicitante && <p className="text-xs text-red-600">{errors.autoridade_solicitante}</p>}
                  </div>
                </div>
              </Section>

              <Section title="Envolvido e Local" description="Dados da pessoa envolvida e, quando aplicável, do local do fato." icon={<User size={14} />}>
                <div className={`grid grid-cols-1 ${isExameLocal ? 'md:grid-cols-2' : ''} gap-4`}>
                  <div className="space-y-2">
                    <Label htmlFor="nome_envolvido">Nome do Envolvido</Label>
                    <Input
                      id="nome_envolvido"
                      value={formData.nome_envolvido}
                      onChange={e => updateField('nome_envolvido', e.target.value)}
                      onBlur={() => validateField('nome_envolvido')}
                      className={errors.nome_envolvido ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      placeholder="Nome dos envolvidos"
                    />
                    {errors.nome_envolvido && <p className="text-xs text-red-600">{errors.nome_envolvido}</p>}
                  </div>
                  {isExameLocal && (
                    <div className="space-y-2">
                      <Label htmlFor="local_fato">Local do Fato</Label>
                      <Input
                        id="local_fato"
                        value={formData.local_fato}
                        onChange={e => updateField('local_fato', e.target.value)}
                        onBlur={() => validateField('local_fato')}
                        className={errors.local_fato ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        placeholder="Descrição do local"
                      />
                      {errors.local_fato && <p className="text-xs text-red-600">{errors.local_fato}</p>}
                    </div>
                  )}
                </div>
                {isExameLocal && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input
                        id="latitude"
                        type="number"
                        step="any"
                        value={formData.latitude}
                        onChange={e => updateField('latitude', e.target.value)}
                        className={errors.latitude ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        placeholder="-25.4284"
                      />
                      {errors.latitude && <p className="text-xs text-red-600">{errors.latitude}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input
                        id="longitude"
                        type="number"
                        step="any"
                        value={formData.longitude}
                        onChange={e => updateField('longitude', e.target.value)}
                        className={errors.longitude ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        placeholder="-49.2674"
                      />
                      {errors.longitude && <p className="text-xs text-red-600">{errors.longitude}</p>}
                    </div>
                  </div>
                )}
              </Section>

              {isExameLocal && (
                <Section title="Acionamento" description="Linha do tempo de atendimento no local." icon={<Clock3 size={14} />}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="data_acionamento">Data/Hora Acionamento</Label>
                      <Input
                        id="data_acionamento"
                        type="datetime-local"
                        value={formData.data_acionamento}
                        onChange={e => updateField('data_acionamento', e.target.value)}
                        className={errors.data_acionamento ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      />
                      {errors.data_acionamento && <p className="text-xs text-red-600">{errors.data_acionamento}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_chegada">Data/Hora Chegada</Label>
                      <Input
                        id="data_chegada"
                        type="datetime-local"
                        value={formData.data_chegada}
                        onChange={e => updateField('data_chegada', e.target.value)}
                        className={errors.data_chegada ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      />
                      {errors.data_chegada && <p className="text-xs text-red-600">{errors.data_chegada}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_saida">Data/Hora Saída</Label>
                      <Input
                        id="data_saida"
                        type="datetime-local"
                        value={formData.data_saida}
                        onChange={e => updateField('data_saida', e.target.value)}
                        className={errors.data_saida ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      />
                      {errors.data_saida && <p className="text-xs text-red-600">{errors.data_saida}</p>}
                    </div>
                  </div>
                </Section>
              )}

              <Section title="Documentos Associados" description="Vínculos e observações importantes da REP." icon={<Link2 size={14} />}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numero_bo">Nº do BO</Label>
                    <Input
                      id="numero_bo"
                      value={formData.numero_bo}
                      onChange={e => updateField('numero_bo', e.target.value)}
                      onBlur={() => validateField('numero_bo')}
                      className={errors.numero_bo ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      placeholder="Boletim de Ocorrência"
                    />
                    {errors.numero_bo && <p className="text-xs text-red-600">{errors.numero_bo}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero_ip">Nº do IP</Label>
                    <Input
                      id="numero_ip"
                      value={formData.numero_ip}
                      onChange={e => updateField('numero_ip', e.target.value)}
                      onBlur={() => validateField('numero_ip')}
                      className={errors.numero_ip ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      placeholder="Inquérito Policial"
                    />
                    {errors.numero_ip && <p className="text-xs text-red-600">{errors.numero_ip}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lacre_entrada">Lacre de Entrada</Label>
                    <Input
                      id="lacre_entrada"
                      value={formData.lacre_entrada}
                      onChange={e => updateField('lacre_entrada', e.target.value)}
                      onBlur={() => validateField('lacre_entrada')}
                      className={errors.lacre_entrada ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      placeholder="Nº do lacre"
                    />
                    {errors.lacre_entrada && <p className="text-xs text-red-600">{errors.lacre_entrada}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lacre_saida">Lacre de Saída</Label>
                    <Input
                      id="lacre_saida"
                      value={formData.lacre_saida}
                      onChange={e => updateField('lacre_saida', e.target.value)}
                      onBlur={() => validateField('lacre_saida')}
                      className={errors.lacre_saida ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      placeholder="Nº do lacre"
                    />
                    {errors.lacre_saida && <p className="text-xs text-red-600">{errors.lacre_saida}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={e => updateField('observacoes', e.target.value)}
                    onBlur={() => validateField('observacoes')}
                    className={errors.observacoes ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    placeholder="Observações gerais..."
                    rows={3}
                  />
                  {errors.observacoes && <p className="text-xs text-red-600">{errors.observacoes}</p>}
                </div>
              </Section>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
                <Button variant="outline" type="button" onClick={handleCancelar}>Cancelar</Button>
                <Button type="submit" disabled={submitting} className="flex items-center gap-2">
                  <Plus size={16} /> {submitting ? 'Salvando...' : editingRep ? 'Atualizar' : 'Criar'} REP
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
