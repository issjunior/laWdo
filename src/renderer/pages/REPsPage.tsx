import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/forms/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, X, FileText, Link2, AlertTriangle, Eye, Lock, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { type REP } from '@/lib/validators';
import { z } from 'zod';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getSectionsForExame,
  EXAM_FIELD_MAP,
  serializeCamposEspecificos,
  deserializeCamposEspecificos,
} from '@/components/rep/exam-fields';
import type { REPFormData } from '@/components/rep/exam-fields';

const emptyForm = (): REPFormData => ({
  numero: '', solicitante_id: '', tipo_exame_id: '', template_id: '', data_requisicao: new Date().toISOString().split('T')[0],
  tipo_solicitacao: 'Ofício', numero_documento: '', data_documento: '',
  autoridade_solicitante: '', nome_envolvido: '', data_acionamento: '',
  data_chegada: '', data_saida: '', local_fato: '', latitude: '', longitude: '',
  lacre_entrada: '', lacre_saida: '', numero_bo: '', numero_ip: '', observacoes: '',
  numeracao_veiculo: '', numeracao_placa: '', numeracao_fabricacao: '',
  numeracao_cor: '', numeracao_conservacao: 'regular',
  numeracao_chassi: '', numeracao_chassi_revelado: '',
  numeracao_motor: '', numeracao_motor_revelado: '',
});

const FIELD_PLACEHOLDER: Record<string, string> = {
  numero: 'numero_rep',
  solicitante_id: 'solicitante_nome',
  tipo_exame_id: 'tipo_exame_nome',
  data_requisicao: 'data_recebimento_rep',
  tipo_solicitacao: 'tipo_solicitacao_rep',
  numero_documento: 'numero_solicitacao_rep',
  data_documento: 'data_solicitacao_rep',
  autoridade_solicitante: 'autoridade_solicitante_rep',
  nome_envolvido: 'nome_envolvido',
  local_fato: 'local_fato',
  latitude: 'latitude',
  longitude: 'longitude',
  data_acionamento: 'data_acionamento_local',
  data_chegada: 'data_chegada_local',
  data_saida: 'data_saida_local',
  numero_bo: 'numero_bo',
  numero_ip: 'numero_ip',
  lacre_entrada: 'lacre_entrada',
  lacre_saida: 'lacre_saida',
  observacoes: 'observacoes_rep',
  numeracao_veiculo: 'veiculo',
  numeracao_placa: 'placa',
  numeracao_fabricacao: 'fabricacao_modelo',
  numeracao_cor: 'cor',
  numeracao_conservacao: 'conservacao',
  numeracao_chassi: 'chassi',
  numeracao_chassi_revelado: 'chassi_revelado',
  numeracao_motor: 'motor',
  numeracao_motor_revelado: 'motor_revelado',
};

function formatarNumeroREP(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const len = digits.length;

  if (len <= 4) {
    return digits;
  }

  const year = digits.slice(-4);
  const repNum = digits.slice(0, -4);

  let formattedRepNum = repNum;
  if (repNum.length > 3) {
    formattedRepNum = repNum.slice(0, -3) + '.' + repNum.slice(-3);
  }

  return `${formattedRepNum}-${year}`;
}

function getLoggedUserId(): string | undefined {
  try {
    const raw = sessionStorage.getItem('lawdo_auth_user');
    if (!raw) return undefined;
    return JSON.parse(raw).id;
  } catch {
    return undefined;
  }
}

function prepareForApi(data: REPFormData, codigo: string | undefined) {
  const payload: Record<string, unknown> = {
    numero: data.numero,
    data_requisicao: data.data_requisicao,
    tipo_solicitacao: data.tipo_solicitacao,
    numero_documento: data.numero_documento,
  };

  if (data.solicitante_id) payload.solicitante_id = data.solicitante_id;
  if (data.tipo_exame_id) payload.tipo_exame_id = data.tipo_exame_id;
  if (data.template_id) {
    payload.template_id = data.template_id;
    const peritoId = getLoggedUserId();
    if (peritoId) payload.perito_id = peritoId;
  }
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

  if (codigo) {
    payload.campos_especificos = serializeCamposEspecificos(codigo, data) || null;
  }

  return payload;
}

/** Ícone "?" com tooltip usando shadcn Tooltip */
const HelpIcon: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border border-muted-foreground/40 text-[10px] text-muted-foreground font-semibold cursor-help ml-1.5 align-middle select-none hover:bg-muted-foreground hover:text-background transition-colors">
        ?
      </span>
    </TooltipTrigger>
    <TooltipContent side="top">
      <p className="max-w-[250px] text-xs">{text}</p>
    </TooltipContent>
  </Tooltip>
);

/** FormLabel que condicionalmente mostra o placeholder via Tooltip */
const LabelWithPlaceholder: React.FC<{ field: string; children: React.ReactNode; mostrar: boolean }> = ({ field, children, mostrar }) => {
  const chave = FIELD_PLACEHOLDER[field];
  if (!mostrar || !chave) {
    return <FormLabel>{children}</FormLabel>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <FormLabel className="cursor-help border-b border-dotted border-muted-foreground/50">{children}</FormLabel>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="font-mono text-xs">{`{{${chave}}}`}</span>
      </TooltipContent>
    </Tooltip>
  );
};

function formatarDataBR(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    const data = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
    if (isNaN(data.getTime())) return iso;
    return data.toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

export const REPsPage: React.FC = () => {
  const [reps, setReps] = useState<REP[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRep, setEditingRep] = useState<REP | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [solicitantes, setSolicitantes] = useState<any[]>([]);
  const [tiposExame, setTiposExame] = useState<any[]>([]);
  const [templatesVinculados, setTemplatesVinculados] = useState<any[]>([]);

  // Ref para o superRefine sempre ter os tiposExame atualizados
  const tiposExameRef = useRef<any[]>([]);
  useEffect(() => { tiposExameRef.current = tiposExame; }, [tiposExame]);

  // Schema com validação condicional via superRefine
  const repFormSchema = useMemo(() => z.object({
    numero: z
      .string()
      .min(1, 'Número da REP é obrigatório')
      .regex(/^(\d{1,3}|\d{1,3}\.\d{3})-\d{4}$/, 'Formato inválido. Use algo entre 1-AAAA e 000.000-AAAA'),
    solicitante_id: z.string().optional(),
    tipo_exame_id: z.string().optional(),
    template_id: z.string().optional(),
    data_requisicao: z.string().min(1, 'Data da solicitação é obrigatória'),
    tipo_solicitacao: z.string().min(1, 'Tipo de solicitação é obrigatório').max(50, 'Tipo de solicitação deve ter no máximo 50 caracteres'),
    numero_documento: z.string().min(1, 'Nº da solicitação é obrigatório').max(30, 'Nº do documento deve ter no máximo 30 caracteres'),
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
    numeracao_veiculo: z.string().max(25, 'Máximo 25 caracteres').optional(),
    numeracao_placa: z.string().regex(/^[A-Za-z]{3}-?(\d{4}|\d[A-Za-z]\d{2})$/, 'Formato inválido. Use ABC1234, ABC-1234, ABC1B23 ou ABC-1B23').optional().or(z.literal('')),
    numeracao_fabricacao: z.string().regex(/^\d{4}\/\d{4}$/, 'Formato inválido. Use ano/ano (ex: 2020/2021)').optional().or(z.literal('')),
    numeracao_cor: z.string().optional(),
    numeracao_conservacao: z.string().optional(),
    numeracao_chassi: z.string().regex(/^[A-Za-z0-9]{0,17}$/, 'Apenas caracteres alfanuméricos, até 17').optional(),
    numeracao_chassi_revelado: z.string().regex(/^[A-Za-z0-9]{0,17}$/, 'Apenas caracteres alfanuméricos, até 17').optional(),
    numeracao_motor: z.string().regex(/^[A-Za-z0-9]{0,15}$/, 'Apenas caracteres alfanuméricos, até 15').optional(),
    numeracao_motor_revelado: z.string().regex(/^[A-Za-z0-9]{0,15}$/, 'Apenas caracteres alfanuméricos, até 15').optional(),
  }).superRefine((data, ctx) => {
    if (!data.tipo_exame_id) return;
    const tipos = tiposExameRef.current;
    const tipo = tipos.find(t => t.id === data.tipo_exame_id);
    if (!tipo) return;
    const sections = EXAM_FIELD_MAP[tipo.codigo] || [];

    if (sections.includes('local_fato') && !data.local_fato?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Local do fato é obrigatório para este tipo de exame', path: ['local_fato'] });
    }
    if (sections.includes('numeracao') && !data.numeracao_veiculo?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Veículo é obrigatório', path: ['numeracao_veiculo'] });
    }
  }), []);

  const form = useForm<REPFormData>({
    resolver: zodResolver(repFormSchema),
    defaultValues: emptyForm(),
    mode: 'onChange',
  });

  // Estados para o Dialog "Criar Laudo" (REPs órfãs)
  const [criarLaudoOpen, setCriarLaudoOpen] = useState(false);
  const [criarLaudoRep, setCriarLaudoRep] = useState<REP | null>(null);
  const [criarLaudoTipoExameId, setCriarLaudoTipoExameId] = useState('');
  const [mostrarPlaceholders, setMostrarPlaceholders] = useState(false);
  const [criarLaudoTemplateId, setCriarLaudoTemplateId] = useState('');
  const [criarLaudoTemplates, setCriarLaudoTemplates] = useState<any[]>([]);
  const [criarLaudoSubmitting, setCriarLaudoSubmitting] = useState(false);
  const [repsComLaudo, setRepsComLaudo] = useState<Set<string>>(new Set());

  // Estados para o Alert Dialog de exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDialogRep, setDeleteDialogRep] = useState<REP | null>(null);

  // Estado de desbloqueio dos campos específicos (Nível 3)
  const [camposEspecificosDesbloqueados, setCamposEspecificosDesbloqueados] = useState(false);

  // Controle do accordion (expande N3 automaticamente ao desbloquear)
  const [accordionValue, setAccordionValue] = useState<string[]>(["dados-solicitacao", "documentos"]);

  const carregarREPs = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const r = await window.ipcAPI.rep.findAll();
      if (r.success && r.data) {
        setReps(r.data);

        try {
          const laudosResp = await window.ipcAPI.laudo.findAll();
          if (laudosResp.success && laudosResp.data) {
            const idsComLaudo = new Set<string>(
              (laudosResp.data as any[]).map((l: any) => l.rep_id)
            );
            setRepsComLaudo(idsComLaudo);
          }
        } catch {
        }
      } else {
        setError(r.error);
      }
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

  const tipoExameId = form.watch('tipo_exame_id');

  // Quando o tipo de exame muda, busca os templates vinculados e limpa template_id
  useEffect(() => {
    form.setValue('template_id', '', { shouldValidate: false });
    if (!showForm || !tipoExameId) {
      setTemplatesVinculados([]);
      return;
    }
    (async () => {
      const r = await window.ipcAPI.template.findByTipoExame(tipoExameId);
      if (r.success && r.data) {
        const ordenados = [...r.data].sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'));
        setTemplatesVinculados(ordenados);
      } else {
        setTemplatesVinculados([]);
      }
    })();
  }, [tipoExameId, showForm]);

  // Revalidar campos condicionais quando o tipo de exame muda
  useEffect(() => {
    if (tipoExameId) {
      form.trigger(['local_fato', 'numeracao_veiculo', 'numeracao_placa', 'numeracao_fabricacao', 'numeracao_chassi', 'numeracao_chassi_revelado', 'numeracao_motor', 'numeracao_motor_revelado']);
    }
  }, [tipoExameId]);

  const tipoExameSelecionado = tipoExameId
    ? tiposExame.find(t => t.id === tipoExameId)
    : null;

  // Seções dinâmicas baseadas no tipo de exame
  const examSections = useMemo(() => {
    if (!tipoExameSelecionado) return [];
    return getSectionsForExame(tipoExameSelecionado.codigo);
  }, [tipoExameSelecionado, tiposExame]);

  const groupedSections = examSections.filter(s => s.group);
  const standaloneSections = examSections.filter(s => !s.group);

  // Desbloqueio do Nível 3
  const [numero, data_requisicao, tipo_solicitacao, numero_documento] = form.watch(['numero', 'data_requisicao', 'tipo_solicitacao', 'numero_documento']);
  const canUnlockSpecificFields = !!(numero && data_requisicao && tipo_solicitacao && numero_documento && tipoExameId);

  useEffect(() => {
    if (canUnlockSpecificFields && !camposEspecificosDesbloqueados) {
      setCamposEspecificosDesbloqueados(true);
    }
  }, [canUnlockSpecificFields, camposEspecificosDesbloqueados]);

  // Expande N3 automaticamente ao desbloquear
  useEffect(() => {
    if (camposEspecificosDesbloqueados) {
      setAccordionValue(["dados-solicitacao", "documentos", "campos-especificos"]);
    }
  }, [camposEspecificosDesbloqueados]);

  const handleNovo = () => {
    setEditingRep(null);
    setError(null);
    setSuccess(null);
    setTemplatesVinculados([]);
    setCamposEspecificosDesbloqueados(false);
    setAccordionValue(["dados-solicitacao", "documentos"]);
    form.reset(emptyForm());
    setSubmitting(false);
    setShowForm(true);
    document.body.style.pointerEvents = '';
  };

  const handleCancelar = () => {
    setShowForm(false);
    setEditingRep(null);
    setCamposEspecificosDesbloqueados(false);
    setAccordionValue(["dados-solicitacao", "documentos"]);
    form.reset(emptyForm());
    setTemplatesVinculados([]);
    setError(null);
    setSuccess(null);
    setSubmitting(false);
    document.body.style.pointerEvents = '';
  };

  const handleEditar = async (rep: REP) => {
    setEditingRep(rep);
    setError(null);
    setSuccess(null);

    let templateId = '';
    if (rep.tipo_exame_id) {
      try {
        const r = await window.ipcAPI.laudo.findByRepId(rep.id);
        if (r.success && r.data && r.data.template_id) {
          templateId = r.data.template_id;
        }
      } catch {
      }

      try {
        const templatesResp = await window.ipcAPI.template.findByTipoExame(rep.tipo_exame_id);
        if (templatesResp.success && templatesResp.data) {
          const ordenados = [...templatesResp.data].sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'));
          setTemplatesVinculados(ordenados);
        } else {
          setTemplatesVinculados([]);
        }
      } catch {
        setTemplatesVinculados([]);
      }
    } else {
      setTemplatesVinculados([]);
    }

    // Se a REP já tem tipo de exame com campos específicos, desbloqueia o Nível 3
    const tipo = tiposExame.find(t => t.id === rep.tipo_exame_id);
    const hasSpecificSections = tipo ? getSectionsForExame(tipo.codigo).length > 0 : false;
    setCamposEspecificosDesbloqueados(hasSpecificSections);

    // Parse campos_especificos via service registry
    const especificos = deserializeCamposEspecificos(tipo?.codigo ?? '', rep.campos_especificos);

    form.reset({
      numero: rep.numero,
      solicitante_id: rep.solicitante_id || '',
      tipo_exame_id: rep.tipo_exame_id || '',
      template_id: templateId,
      data_requisicao: rep.data_requisicao?.split('T')[0] || '',
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
      numeracao_veiculo: especificos.numeracao_veiculo || '',
      numeracao_placa: especificos.numeracao_placa || '',
      numeracao_fabricacao: especificos.numeracao_fabricacao || '',
      numeracao_cor: especificos.numeracao_cor || '',
      numeracao_conservacao: especificos.numeracao_conservacao || 'regular',
      numeracao_chassi: especificos.numeracao_chassi || '',
      numeracao_chassi_revelado: especificos.numeracao_chassi_revelado || '',
      numeracao_motor: especificos.numeracao_motor || '',
      numeracao_motor_revelado: especificos.numeracao_motor_revelado || '',
    });
    setShowForm(true);
  };

  const handleDelete = (rep: REP) => {
    setDeleteDialogRep(rep);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialogRep) return;
    try {
      const id = deleteDialogRep.id;
      const r = await window.ipcAPI.rep.delete(id);
      if (r.success) {
        await carregarREPs();
        setDeleteDialogOpen(false);
        setDeleteDialogRep(null);
      } else {
        setError(r.error || 'Erro ao excluir REP');
        setDeleteDialogOpen(false);
      }
    } catch (e: any) {
      setError('Erro ao excluir REP');
      setDeleteDialogOpen(false);
    }
  };

  const handleCriarLaudo = (rep: REP) => {
    setCriarLaudoRep(rep);
    setCriarLaudoTipoExameId(rep.tipo_exame_id || '');
    setCriarLaudoTemplateId('');
    setCriarLaudoTemplates([]);
    setCriarLaudoSubmitting(false);
    setCriarLaudoOpen(true);

    if (rep.tipo_exame_id) {
      (async () => {
        const r = await window.ipcAPI.template.findByTipoExame(rep.tipo_exame_id!);
        if (r.success && r.data) {
          const ordenados = [...r.data].sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'));
          setCriarLaudoTemplates(ordenados);
        }
      })();
    }
  };

  const handleCriarLaudoConfirmar = async () => {
    if (!criarLaudoRep || !criarLaudoTemplateId) return;

    try {
      setCriarLaudoSubmitting(true);
      const peritoId = getLoggedUserId();
      if (!peritoId) {
        setError('Usuário não autenticado. Faça login novamente.');
        return;
      }

      const r = await window.ipcAPI.laudo.create({
        rep_id: criarLaudoRep.id,
        perito_id: peritoId,
        template_id: criarLaudoTemplateId,
      });

      if (r.success) {
        await carregarREPs();
        setCriarLaudoOpen(false);
        setSuccess('Laudo criado com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(r.error || 'Erro ao criar laudo');
      }
    } catch (e: any) {
      setError('Erro ao criar laudo: ' + e.message);
    } finally {
      setCriarLaudoSubmitting(false);
    }
  };

  const handleCriarLaudoTipoExameChange = async (tipoExameId: string) => {
    setCriarLaudoTipoExameId(tipoExameId);
    setCriarLaudoTemplateId('');
    if (!tipoExameId) {
      setCriarLaudoTemplates([]);
      return;
    }
    const r = await window.ipcAPI.template.findByTipoExame(tipoExameId);
    if (r.success && r.data) {
      const ordenados = [...r.data].sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR'));
      setCriarLaudoTemplates(ordenados);
    } else {
      setCriarLaudoTemplates([]);
    }
  };

  const handleSalvar = form.handleSubmit(async (data) => {
    try {
      setError(null);
      setSuccess(null);
      setSubmitting(true);

      const codigo = tipoExameSelecionado?.codigo;
      const apiData = prepareForApi(data, codigo);

      if (editingRep) {
        const r = await window.ipcAPI.rep.update(editingRep.id, apiData);
        if (r.success) {
          await carregarREPs();
          setSuccess('REP atualizada com sucesso!');
          setTimeout(() => handleCancelar(), 1200);
        } else {
          setError(r.error || 'Erro ao atualizar REP');
        }
      } else {
        const r = await window.ipcAPI.rep.create(apiData);
        if (r.success) {
          await carregarREPs();
          setSuccess('REP criada com sucesso!');
          setTimeout(() => handleCancelar(), 1200);
        } else {
          setError(r.error || 'Erro ao criar REP');
        }
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar REP');
    } finally {
      setSubmitting(false);
    }
  });

  const columnDefs = useMemo<ColumnDef<REP>[]>(() => [
    {
      accessorKey: 'data_requisicao',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Data de recebimento" />
      ),
      cell: ({ row }) => formatarDataBR(row.getValue('data_requisicao')),
    },
    {
      accessorKey: 'numero',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nº REP" />
      ),
      cell: ({ row }) => <span className="font-medium">{row.getValue('numero')}</span>,
    },
    {
      accessorKey: 'tipo_solicitacao',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tipo de Solicitação" />
      ),
      cell: ({ row }) => row.getValue('tipo_solicitacao') || '-',
    },
    {
      accessorKey: 'numero_documento',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nº da Solicitação" />
      ),
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate block">{row.getValue('numero_documento') || '-'}</span>
      ),
    },
    {
      id: 'tem_laudo',
      accessorFn: (row) => (repsComLaudo.has(row.id) ? 1 : 0),
      enableSorting: true,
      enableHiding: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Laudo" />
      ),
      cell: ({ row }) => {
        const temLaudo = repsComLaudo.has(row.original.id);
        return temLaudo
          ? <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">Criado</Badge>
          : <Badge variant="destructive" className="gap-1"><AlertTriangle size={12} /> Sem Laudo</Badge>;
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = (row.getValue('status') as string) || 'Pendente';
        const variantMap: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
          'Pendente': 'secondary',
          'Em Andamento': 'default',
          'Concluído': 'outline',
        };
        return <Badge variant={variantMap[status] || 'secondary'}>{status}</Badge>;
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      header: () => <span className="sr-only">Ações</span>,
      cell: ({ row }) => {
        const rep = row.original;
        const temLaudo = repsComLaudo.has(rep.id);
        return (
          <div className="flex justify-end gap-2">
            {!temLaudo && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCriarLaudo(rep)}
                aria-label={`Criar laudo para REP ${rep.numero}`}
                title="Criar Laudo"
              >
                <FileText size={14} />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => handleEditar(rep)} aria-label={`Editar REP ${rep.numero}`}>
              <Edit size={14} />
            </Button>
            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(rep)} aria-label={`Excluir REP ${rep.numero}`}>
              <Trash2 size={14} />
            </Button>
          </div>
        );
      },
    },
  ], [handleEditar, handleDelete, repsComLaudo, handleCriarLaudo]);

  // Tabela sem form
  if (!showForm) {
    return (
      <TooltipProvider>
        <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Requisições (REPs)</h1>
            <p className="text-muted-foreground mt-1">Gerencie as requisições de exame pericial</p>
          </div>
          <Button onClick={handleNovo} className="flex items-center gap-2 w-full sm:w-auto"><Plus size={16} /> Nova REP</Button>
        </div>

        {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}

        <Card>
          <CardHeader>
            <CardTitle>Lista de REPs</CardTitle>
            <CardDescription>{reps.length} registro(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (
              <DataTable
                columns={columnDefs}
                data={reps}
                searchColumn="numero"
                searchPlaceholder="Buscar por REP, envolvido ou BO..."
              />
            )}
          </CardContent>
        </Card>

        <Dialog open={criarLaudoOpen} onOpenChange={setCriarLaudoOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Criar Laudo — REP {criarLaudoRep?.numero}
              </DialogTitle>
              <DialogDescription>
                Selecione o tipo de exame e o template para criar o laudo desta REP.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="criar-laudo-tipo-exame">Tipo de Exame</Label>
                <Select
                  value={criarLaudoTipoExameId}
                  onValueChange={handleCriarLaudoTipoExameChange}
                >
                  <SelectTrigger id="criar-laudo-tipo-exame">
                    <SelectValue placeholder="Selecione o tipo de exame..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposExame.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.codigo} - {t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="criar-laudo-template">Template</Label>
                <Select
                  disabled={!criarLaudoTipoExameId || criarLaudoTemplates.length === 0}
                  value={criarLaudoTemplateId}
                  onValueChange={setCriarLaudoTemplateId}
                >
                  <SelectTrigger id="criar-laudo-template">
                    <SelectValue placeholder={
                      !criarLaudoTipoExameId
                        ? 'Selecione um tipo de exame'
                        : criarLaudoTemplates.length === 0
                          ? 'Nenhum template disponível'
                          : 'Selecione um template'
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {criarLaudoTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setCriarLaudoOpen(false)} disabled={criarLaudoSubmitting}>
                Cancelar
              </Button>
              <Button
                onClick={handleCriarLaudoConfirmar}
                disabled={!criarLaudoTemplateId || criarLaudoSubmitting}
                className="flex items-center gap-2"
              >
                <Plus size={16} />
                {criarLaudoSubmitting ? 'Criando...' : 'Criar Laudo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Excluir REP
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Ao excluir a REP de nº <span className="font-semibold text-foreground">{deleteDialogRep?.numero}</span> o laudo vinculado também será excluído automaticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="pt-2 text-sm text-muted-foreground">
              Esta ação não pode ser desfeita.
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} className="flex items-center gap-2">
                <Trash2 size={16} />
                Excluir
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </TooltipProvider>
    );
  }

  // Modo formulário
  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Requisições (REPs)</h1>
          <p className="text-muted-foreground mt-1">Gerencie as requisições de exame pericial</p>
        </div>
        <Button onClick={handleNovo} className="flex items-center gap-2 w-full sm:w-auto"><Plus size={16} /> Nova REP</Button>
      </div>

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
              <div className="flex items-center gap-2">
                <Button
                  variant={mostrarPlaceholders ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMostrarPlaceholders(!mostrarPlaceholders)}
                  className="flex items-center gap-1"
                >
                  <Eye size={14} />
                  Placeholders
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancelar} aria-label="Fechar formulário">
                  <X size={18} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                className="space-y-5"
                onSubmit={handleSalvar}
              >
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              {success && <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900/50"><AlertDescription className="text-green-800 dark:text-green-400">{success}</AlertDescription></Alert>}

              <Accordion type="multiple" value={accordionValue} onValueChange={setAccordionValue} className="space-y-4">

                {/* ============================================ */}
                {/* NÍVEL 1: Dados da Solicitação */}
                {/* ============================================ */}
                <AccordionItem value="dados-solicitacao">
                  <AccordionTrigger className="text-base font-semibold">
                    <span className="inline-flex items-center gap-2">
                      <FileText size={14} />
                      Dados da Solicitação
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-5 bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-4">Informações principais da requisição.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="numero"
                      render={({ field }) => (
                        <FormItem>
                          <LabelWithPlaceholder field="numero" mostrar={mostrarPlaceholders}>Nº da REP *<HelpIcon text="O ano deve conter os 4 dígitos, exemplo: 2026." /></LabelWithPlaceholder>
                          <FormControl>
                            <Input
                              placeholder="000.000-2026"
                              value={field.value}
                              onChange={e => field.onChange(formatarNumeroREP(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div>
                    <FormField
                      control={form.control}
                      name="data_requisicao"
                      render={({ field }) => (
                        <FormItem>
                          <LabelWithPlaceholder field="data_requisicao" mostrar={mostrarPlaceholders}>Data de recebimento *</LabelWithPlaceholder>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                  <div>
                    <FormField
                      control={form.control}
                      name="solicitante_id"
                      render={({ field }) => (
                        <FormItem>
                          <LabelWithPlaceholder field="solicitante_id" mostrar={mostrarPlaceholders}>Solicitante</LabelWithPlaceholder>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Selecione o órgão..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {solicitantes.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <FormLabel>Responsável/Contato</FormLabel>
                    <Input value={form.watch('solicitante_id') ? (solicitantes.find(s => s.id === form.watch('solicitante_id'))?.tipo || '—') : '—'} readOnly className="bg-muted text-muted-foreground cursor-default" />
                  </div>
                  <div>
                    <FormField
                      control={form.control}
                      name="tipo_exame_id"
                      render={({ field }) => (
                        <FormItem>
                          <LabelWithPlaceholder field="tipo_exame_id" mostrar={mostrarPlaceholders}>Tipo de Exame</LabelWithPlaceholder>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Selecione o exame..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {tiposExame.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.codigo} - {t.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div>
                    <FormField
                      control={form.control}
                      name="template_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template<HelpIcon text="Selecione 'Não definido' para não criar o laudo automaticamente." /></FormLabel>
                          <Select
                            disabled={!tipoExameId || templatesVinculados.length === 0}
                            value={field.value || undefined}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={
                                  !tipoExameId
                                    ? 'Selecione um tipo de exame'
                                    : 'Selecione um template'
                                } />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {templatesVinculados.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div>
                    <FormField
                      control={form.control}
                      name="tipo_solicitacao"
                      render={({ field }) => (
                        <FormItem>
                          <LabelWithPlaceholder field="tipo_solicitacao" mostrar={mostrarPlaceholders}>Tipo de Solicitação *<HelpIcon text="Ex: Ofício, BOU, BO PM, BO PC, CECOMP" /></LabelWithPlaceholder>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="BOU">BOU</SelectItem>
                              <SelectItem value="BO PM">BO PM</SelectItem>
                              <SelectItem value="BO PC">BO PC</SelectItem>
                              <SelectItem value="Ofício">Ofício</SelectItem>
                              <SelectItem value="CECOMP">CECOMP</SelectItem>
                              <SelectItem value="Outros">Outros</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <FormField
                      control={form.control}
                      name="numero_documento"
                      render={({ field }) => (
                        <FormItem>
                          <LabelWithPlaceholder field="numero_documento" mostrar={mostrarPlaceholders}>Nº da Solicitação *<HelpIcon text="Número do ofício ou documento que originou a solicitação" /></LabelWithPlaceholder>
                          <FormControl>
                            <Input placeholder="Requisição nº" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div>
                    <FormField
                      control={form.control}
                      name="data_documento"
                      render={({ field }) => (
                        <FormItem>
                          <LabelWithPlaceholder field="data_documento" mostrar={mostrarPlaceholders}>Data do Documento</LabelWithPlaceholder>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div>
                    <FormField
                      control={form.control}
                      name="autoridade_solicitante"
                      render={({ field }) => (
                        <FormItem>
                          <LabelWithPlaceholder field="autoridade_solicitante" mostrar={mostrarPlaceholders}>Autoridade Solicitante</LabelWithPlaceholder>
                          <FormControl>
                            <Input placeholder="Nome da autoridade" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div>
                    <FormField
                      control={form.control}
                      name="nome_envolvido"
                      render={({ field }) => (
                        <FormItem>
                          <LabelWithPlaceholder field="nome_envolvido" mostrar={mostrarPlaceholders}>Nome do Envolvido</LabelWithPlaceholder>
                          <FormControl>
                            <Input placeholder="Nome dos envolvidos" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                  </AccordionContent>
                </AccordionItem>

                {/* ============================================ */}
                {/* NÍVEL 2: Documentos Associados */}
                {/* ============================================ */}
                <AccordionItem value="documentos">
                  <AccordionTrigger className="text-base font-semibold">
                    <span className="inline-flex items-center gap-2">
                      <Link2 size={14} />
                      Documentos Associados
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-5 bg-muted/30 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-4">Vínculos e observações importantes da REP.</p>
                {(!form.watch('numero_bo') && !form.watch('numero_ip')) ? (
                  <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-amber-800 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                        Requisito GDL
                      </CardTitle>
                      <CardDescription className="text-amber-700 dark:text-amber-400/80">
                        O GDL só aceitará o envio de laudos com o nº do BO ou nº do IP preenchidos.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <FormField
                            control={form.control}
                            name="numero_bo"
                            render={({ field }) => (
                              <FormItem>
                                <LabelWithPlaceholder field="numero_bo" mostrar={mostrarPlaceholders}>Nº do BO</LabelWithPlaceholder>
                                <FormControl>
                                  <Input placeholder="Boletim de Ocorrência" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div>
                          <FormField
                            control={form.control}
                            name="numero_ip"
                            render={({ field }) => (
                              <FormItem>
                                <LabelWithPlaceholder field="numero_ip" mostrar={mostrarPlaceholders}>Nº do IP</LabelWithPlaceholder>
                                <FormControl>
                                  <Input placeholder="Inquérito Policial" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <FormField
                        control={form.control}
                        name="numero_bo"
                        render={({ field }) => (
                          <FormItem>
                            <LabelWithPlaceholder field="numero_bo" mostrar={mostrarPlaceholders}>Nº do BO</LabelWithPlaceholder>
                            <FormControl>
                              <Input placeholder="Boletim de Ocorrência" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div>
                      <FormField
                        control={form.control}
                        name="numero_ip"
                        render={({ field }) => (
                          <FormItem>
                            <LabelWithPlaceholder field="numero_ip" mostrar={mostrarPlaceholders}>Nº do IP</LabelWithPlaceholder>
                            <FormControl>
                              <Input placeholder="Inquérito Policial" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FormField
                      control={form.control}
                      name="lacre_entrada"
                      render={({ field }) => (
                        <FormItem>
                          <LabelWithPlaceholder field="lacre_entrada" mostrar={mostrarPlaceholders}>Lacre de Entrada</LabelWithPlaceholder>
                          <FormControl>
                            <Input placeholder="Nº do lacre" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div>
                    <FormField
                      control={form.control}
                      name="lacre_saida"
                      render={({ field }) => (
                        <FormItem>
                          <LabelWithPlaceholder field="lacre_saida" mostrar={mostrarPlaceholders}>Lacre de Saída</LabelWithPlaceholder>
                          <FormControl>
                            <Input placeholder="Nº do lacre" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <div>
                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <LabelWithPlaceholder field="observacoes" mostrar={mostrarPlaceholders}>Observações</LabelWithPlaceholder>
                        <FormControl>
                          <Textarea placeholder="Observações gerais..." rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                  </AccordionContent>
                </AccordionItem>

                {/* ============================================ */}
                {/* NÍVEL 3: Campos Específicos (bloqueado/desbloqueado) */}
                {/* ============================================ */}
                {examSections.length > 0 && (
                  <AccordionItem
                    value="campos-especificos"
                    className={!camposEspecificosDesbloqueados ? 'opacity-60' : ''}
                  >
                    <AccordionTrigger className="text-base font-semibold">
                      {camposEspecificosDesbloqueados
                        ? (
                          <span className="inline-flex items-center gap-2">
                            <Zap size={14} />
                            Campos Específicos — {tipoExameSelecionado?.nome}
                          </span>
                        )
                        : (
                          <span className="inline-flex items-center gap-2">
                            <Lock size={14} />
                            Preencha os campos obrigatórios acima para desbloquear
                          </span>
                        )
                      }
                    </AccordionTrigger>
                    <AccordionContent className="space-y-5 bg-muted/30 rounded-lg p-4">
                      {camposEspecificosDesbloqueados ? (
                        <>
                          {groupedSections.length > 0 && (
                            <div className="space-y-4">
                              <h4 className="font-medium text-sm">Envolvido e Local</h4>
                              {groupedSections.map(s => (
                                <s.component key={s.id} form={form} mostrarPlaceholders={mostrarPlaceholders} />
                              ))}
                            </div>
                          )}

                          {standaloneSections.map(s => (
                            <div key={s.id} className="space-y-3">
                              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <s.icon size={14} />
                                <span>{s.label}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{s.description}</p>
                              <s.component form={form} mostrarPlaceholders={mostrarPlaceholders} />
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-3">
                          <Lock size={28} className="opacity-30" />
                          <p className="text-sm text-center max-w-md">Selecione o tipo de exame e preencha os campos obrigatórios (Nº REP, Data de Recebimento, Tipo de Solicitação, Nº da Solicitação) para desbloquear os campos específicos.</p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
                <Button variant="outline" type="button" onClick={handleCancelar}>Cancelar</Button>
                <Button type="submit" disabled={submitting || !form.formState.isValid} className="flex items-center gap-2">
                  <Plus size={16} /> {submitting ? 'Salvando...' : editingRep ? 'Atualizar' : 'Criar'} REP
                </Button>
              </div>
            </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
      </TooltipProvider>
  );
};
