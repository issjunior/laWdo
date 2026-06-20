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
import { Plus, Edit, Trash2, X, FileText, AlertTriangle, Eye, ClipboardPen, Clock, Network } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { RepTimelineDialog } from '@/components/timeline/RepTimelineDialog';
import {
  getSectionsForExame,
  EXAM_FIELD_MAP,
  serializeCamposEspecificos,
  deserializeCamposEspecificos,
} from '@/components/rep/exam-fields';
import type { REPFormData } from '@/components/rep/exam-fields';
import { SolicitanteFormFields } from '@/components/solicitantes/SolicitanteFormFields';
import { TipoExameFormFields } from '@/components/tipos-exame/TipoExameFormFields';
import { RepStepper, useRepStepperContext } from '@/components/rep/RepStepper';
import { GdlConsultaModal } from '@/components/rep/GdlConsultaModal';
import { createSolicitanteSchema, type CreateSolicitanteInput } from '@/lib/validators/solicitante.schema';
import type { CreateTipoExameInput } from '@/lib/validators';
import { buildHeaderTemplate } from '@/lib/pdf-header';
import { getMargens } from '@/lib/margens';
import { toast } from 'sonner';

/* ─── HELPERS para PDF da REP ─── */

const REP_TABLE_STYLES = {
  table:  'border-collapse:collapse;width:100%;margin:12px 0',
  title:  'background:#d9d9d9;color:#000;font-weight:bold;text-align:center',
  th:     'border:1px solid #000;padding:6px 10px;text-align:center;font-weight:600;background:#e8e8e8;color:#000;font-size:12px',
  td:     'border:1px solid #000;padding:6px 10px;font-size:12px;color:#000',
  label:  'border:1px solid #000;padding:6px 10px;font-weight:600;font-size:12px',
};

function buildRepLabelValue(label: string, value: string, labelW?: string): string {
  const lw = labelW ? `;width:${labelW}` : '';
  return `<tr><td style="${REP_TABLE_STYLES.label}${lw}">${label}</td><td style="${REP_TABLE_STYLES.td}">${value}</td></tr>`;
}

function buildRepTwoCol(a: string, b: string, c: string, d: string): string {
  return `<tr><td style="${REP_TABLE_STYLES.label};width:25%">${a}</td><td style="${REP_TABLE_STYLES.td};width:25%">${b}</td><td style="${REP_TABLE_STYLES.label};width:25%">${c}</td><td style="${REP_TABLE_STYLES.td};width:25%">${d}</td></tr>`;
}

function buildRepTableTitle(title: string, colspan: number): string {
  return `<tr><td colspan="${colspan}" style="${REP_TABLE_STYLES.title};border:1px solid #000;padding:6px 10px">${title}</td></tr>`;
}

function buildRepNumberedTable(titulo: string, headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '';
  const allHeaders = ['Item', ...headers];
  const thead = `<tr>${allHeaders.map(h => `<th style="${REP_TABLE_STYLES.th}">${h}</th>`).join('')}</tr>`;
  const tbody = rows.map((row, i) => {
    const cells = [`<td style="${REP_TABLE_STYLES.td};width:50px;text-align:center">${i + 1}</td>`,
      ...row.map(c => `<td style="${REP_TABLE_STYLES.td}">${(c ?? '').trim() || '-'}</td>`)].join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  const titleRow = buildRepTableTitle(titulo, allHeaders.length);
  return `<table style="${REP_TABLE_STYLES.table}"><thead>${titleRow}${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function buildRepHtml(rep: any, solicitanteNome: string, tipoExameNome: string): string {
  const s = (v: any): string => (v != null && v !== '') ? String(v) : '-';
  const statusMap: Record<string, string> = { 'Pendente': 'Pendente', 'Em Andamento': 'Em Andamento', 'Concluído': 'Concluído' };
  const statusLabel = statusMap[rep.status] || rep.status || 'Pendente';

  let html = `<h2 style="font-size:18px;margin-bottom:16px">REP Nº ${s(rep.numero)}</h2>`;

  // TABELA 1 — DADOS DA SOLICITAÇÃO
  html += `<table style="${REP_TABLE_STYLES.table}">`;
  html += buildRepTableTitle('DADOS DA SOLICITAÇÃO', 4);
  html += buildRepTwoCol('Nº REP', s(rep.numero), 'Data de Recebimento', formatarDataBR(rep.data_requisicao));
  html += buildRepTwoCol('Solicitante', solicitanteNome || s(rep.solicitante_id), 'Tipo de Solicitação', s(rep.tipo_solicitacao));
  html += buildRepTwoCol('Nº da Solicitação', s(rep.numero_documento), 'Data do Documento', formatarDataBR(rep.data_documento));
  html += buildRepTwoCol('Autoridade Solicitante', s(rep.autoridade_solicitante), 'Tipo de Exame', tipoExameNome || s(rep.tipo_exame_id));
  html += buildRepTwoCol('Local do Fato', s(rep.local_fato), 'Status', statusLabel);
  html += `</table>`;

  // TABELA 2 — TRAMITAÇÃO (se tiver alguma data)
  if (rep.data_acionamento || rep.data_chegada || rep.data_saida) {
    html += `<table style="${REP_TABLE_STYLES.table}">`;
    html += buildRepTableTitle('TRAMITAÇÃO', 4);
    html += buildRepTwoCol('Acionamento', formatarDataHora(rep.data_acionamento), 'Chegada', formatarDataHora(rep.data_chegada));
    html += buildRepTwoCol('Saída', formatarDataHora(rep.data_saida), '', '');
    html += `</table>`;
  }

  // CAMPOS ESPECÍFICOS
  if (rep.campos_especificos) {
    try {
      const ce = JSON.parse(rep.campos_especificos);

      // Veículo
      const veic = ce.numeracao ?? ce;
      const temVeic = veic.veiculo || veic.placa || veic.chassi || veic.motor;
      if (temVeic) {
        html += `<table style="${REP_TABLE_STYLES.table}">`;
        html += buildRepTableTitle('DADOS DO VEÍCULO', 4);
        html += buildRepTwoCol('Veículo', s(veic.veiculo), 'Placa', s(veic.placa));
        html += buildRepTwoCol('Fabricação/Modelo', s(veic.fabricacao_modelo), 'Cor', s(veic.cor));
        html += buildRepTwoCol('Conservação', s(veic.conservacao), '', '');
        html += buildRepTwoCol('Chassi', s(veic.chassi), 'Chassi Revelado', s(veic.chassi_revelado));
        html += buildRepTwoCol('Motor', s(veic.motor), 'Motor Revelado', s(veic.motor_revelado));
        html += `</table>`;
      }

      // B-602
      const b602 = ce.b602;
      if (b602) {
        const envolvidos = (b602.envolvidos as string[] | undefined)?.filter(Boolean);
        if (envolvidos?.length) {
          let envolvidosHtml = `<table style="${REP_TABLE_STYLES.table}">`;
          envolvidosHtml += buildRepTableTitle('DADOS DA INVESTIGAÇÃO', 4);
          envolvidosHtml += `<tr><td style="${REP_TABLE_STYLES.label};width:25%">Envolvido(s)</td><td colspan="3" style="${REP_TABLE_STYLES.td}">${envolvidos.join(', ')}</td></tr>`;
          const localStr = (typeof b602.local === 'object' && b602.local !== null)
            ? [(b602.local as Record<string, string>).bairro, (b602.local as Record<string, string>).cidade, (b602.local as Record<string, string>).uf].filter(Boolean).join(' / ')
            : String(b602.local || '');
          if (b602.data_ocorrencia || b602.local || b602.numero_bo || b602.numero_ip || b602.solicitante_nome) {
            envolvidosHtml += buildRepTwoCol('Data Ocorrência', s(b602.data_ocorrencia), 'Local', localStr || '-');
            envolvidosHtml += buildRepTwoCol('Nº BO', s(b602.numero_bo), 'Nº IP', s(b602.numero_ip));
            envolvidosHtml += `<tr><td style="${REP_TABLE_STYLES.label};width:25%">Unidade Policial</td><td colspan="3" style="${REP_TABLE_STYLES.td}">${solicitanteNome || s(b602.solicitante_nome)}</td></tr>`;
          }
          envolvidosHtml += `</table>`;
          html += envolvidosHtml;
        }

        const material = b602.material_enc as Record<string, string>[] | undefined;
        if (material?.length) {
          html += buildRepNumberedTable('MATERIAL ENCAMINHADO',
            ['Natureza', 'Qtd', 'Tipo', 'Dito do Ofício', 'Nº do Lacre'],
            material.map(m => [m.natureza || '', m.quantidade || '', m.tipo || '', m.dito_oficio || '', m.numero_lacre || '']));
        }

        const cartuchos = b602.cartuchos as Record<string, unknown>[] | undefined;
        if (cartuchos?.length) {
          html += buildRepNumberedTable('CARTUCHOS',
            ['Qtd', 'Calibre', 'Marca', 'Origem', 'Espoleta', 'Estojo', 'Projétil', 'Observação'],
            cartuchos.map(c => [String(c.quantidade || ''), String(c.calibre || ''), String(c.marca || ''),
              String(c.origem || ''), String(c.espoleta || ''), String(c.estojo || ''),
              String(c.projetil || ''), Array.isArray(c.observacao) ? (c.observacao as string[]).join(', ') : String(c.observacao || '')]));
        }

        const estojos = b602.estojos as Record<string, unknown>[] | undefined;
        if (estojos?.length) {
          html += buildRepNumberedTable('ESTOJOS',
            ['Qtd', 'Calibre', 'Marca', 'Origem', 'Espoleta', 'Estojo', 'Observação'],
            estojos.map(e => [String(e.quantidade || ''), String(e.calibre || ''), String(e.marca || ''),
              String(e.origem || ''), String(e.espoleta || ''), String(e.estojo || ''),
              Array.isArray(e.observacao) ? (e.observacao as string[]).join(', ') : String(e.observacao || '')]));
        }

        const armas = b602.armas as Record<string, unknown>[] | undefined;
        if (armas?.length) {
          html += `<table style="${REP_TABLE_STYLES.table}">`;
          html += buildRepTableTitle('ARMAS', 1);
          html += `<tr><td style="padding:4px 0 0 0;border:none">`;
          html += buildRepNumberedTable('ARMAS - IDENTIFICAÇÃO',
            ['Tipo', 'Marca', 'Calibre', 'Nº Série', 'Nº Cano', 'Qtd'],
            armas.map(a => [String(a.tipo || ''), String(a.marca || ''), String(a.calibre || ''),
              String(a.numeracao_serie || ''), String(a.numeracao_cano || ''),
              String(a.quantidade || '')]));
          html += buildRepNumberedTable('ARMAS - DADOS TÉCNICOS',
            ['Cap. Carreg.', 'Compr. Cano', 'Acabamento', 'Funcionamento', 'Est. Conservação', 'Dito Ofício', 'Nº Lacre'],
            armas.map(a => [String(a.capacidade_carregador || ''), String(a.comprimento_cano || ''),
              String(a.acabamento || ''), String(a.funcionamento || ''),
              String(a.estado_conservacao || ''), String(a.dito_oficio || ''),
              String(a.numero_lacre || '')]));
          html += `</td></tr></table>`;
        }
      }

      // Local do fato detalhado
      if (ce.local_fato && ce.local_fato !== rep.local_fato) {
        html += `<table style="${REP_TABLE_STYLES.table}">`;
        html += buildRepTableTitle('LOCAL DO FATO', 2);
        html += buildRepLabelValue('Descrição', s(ce.local_fato));
        if (ce.latitude != null || ce.longitude != null) {
          html += buildRepTwoCol('Latitude', s(ce.latitude), 'Longitude', s(ce.longitude));
        }
        html += `</table>`;
      }
    } catch {}
  }

  // OBSERVAÇÕES
  if (rep.observacoes) {
    html += `<table style="${REP_TABLE_STYLES.table}">`;
    html += buildRepTableTitle('OBSERVAÇÕES', 1);
    html += `<tr><td style="${REP_TABLE_STYLES.td}">${rep.observacoes}</td></tr>`;
    html += `</table>`;
  }

  return html;
}

const emptyForm = (): REPFormData => ({
  numero: '', solicitante_id: '', tipo_exame_id: '', template_id: '', data_requisicao: new Date().toISOString().split('T')[0],
  tipo_solicitacao: 'Ofício', numero_documento: '', data_documento: '',
  autoridade_solicitante: '', data_acionamento: '',
  data_chegada: '', data_saida: '', local_fato: '', latitude: '', longitude: '',
  observacoes: '',
  numeracao_veiculo: '', numeracao_placa: '', numeracao_fabricacao: '',
  numeracao_cor: '', numeracao_conservacao: 'regular',
  numeracao_chassi: '', numeracao_chassi_revelado: '',
  numeracao_motor: '', numeracao_motor_revelado: '',
  b602_envolvidos_0: '', b602_envolvidos_1: '', b602_envolvidos_2: '',
  b602_envolvidos_3: '', b602_envolvidos_4: '', b602_envolvidos_5: '',
  b602_envolvidos_6: '', b602_envolvidos_7: '', b602_envolvidos_8: '',
  b602_envolvidos_9: '',
  b602_data_ocorrencia: '', b602_local_bairro: '', b602_local_cidade: '', b602_local_uf: '',
  b602_numero_bo: '', b602_numero_ip: '', b602_solicitante_nome: '',
  b602_material_enc_toggle: 'off', b602_cartuchos_toggle: 'off', b602_estojos_toggle: 'off',
  b602_armas_toggle: 'off', b602_armas_funcionamento_toggle: 'off', b602_armas_coleta_toggle: 'off',
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
  local_fato: 'local_fato',
  latitude: 'latitude',
  longitude: 'longitude',
  data_acionamento: 'data_acionamento_local',
  data_chegada: 'data_chegada_local',
  data_saida: 'data_saida_local',
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
  b602_envolvidos_0: 'b602_envolvidos',
  b602_data_ocorrencia: 'b602_data_ocorrencia',
  b602_local_bairro: 'b602_local_bairro',
  b602_local_cidade: 'b602_local_cidade',
  b602_local_uf: 'b602_local_uf',
  b602_numero_bo: 'b602_numero_bo',
  b602_numero_ip: 'b602_numero_ip',
  b602_solicitante_nome: 'b602_solicitante_nome',
};

function formatarNumeroBO(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return digits;
  const year = digits.slice(0, 4);
  const num = digits.slice(4, 10);
  return `${year}/${num}`;
}

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
  if (data.data_acionamento) payload.data_acionamento = data.data_acionamento;
  if (data.data_chegada) payload.data_chegada = data.data_chegada;
  if (data.data_saida) payload.data_saida = data.data_saida;
  if (data.local_fato) payload.local_fato = data.local_fato;
  if (data.latitude) payload.latitude = parseFloat(data.latitude);
  if (data.longitude) payload.longitude = parseFloat(data.longitude);
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

function formatarDataHora(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    const data = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
    if (isNaN(data.getTime())) return iso;
    return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

/** Wrapper para seção do formulário que faz highlight quando é o passo ativo do stepper. */
const RepStepSection: React.FC<{ stepId: string; children: React.ReactNode }> = ({ stepId, children }) => {
  const activeStep = useRepStepperContext();
  return (
    <div
      id={`step-${stepId}`}
      data-step={stepId}
      className={`rounded-lg p-4 transition-all ${activeStep === stepId ? 'ring-2 ring-primary bg-primary/5' : ''}`}
    >
      {children}
    </div>
  );
};

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

  // Ref para evitar que o template_id seja limpo ao carregar uma edição
  const editLoadRef = useRef(false);
  const togglesOriginaisRef = useRef<Record<string, string>>({});
  const [dialogoToggleAberto, setDialogoToggleAberto] = useState(false);
  const [togglesDesmarcados, setTogglesDesmarcados] = useState<string[]>([]);
  const dadosPendentesRef = useRef<any>(null);
  const codigoPendenteRef = useRef<string | undefined>(undefined);

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
    data_acionamento: z.string().optional(),
    data_chegada: z.string().optional(),
    data_saida: z.string().optional(),
    local_fato: z.string().max(500, 'Local do fato deve ter no máximo 500 caracteres').optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
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
    b602_envolvidos_0: z.string().optional(),
    b602_envolvidos_1: z.string().optional(),
    b602_envolvidos_2: z.string().optional(),
    b602_envolvidos_3: z.string().optional(),
    b602_envolvidos_4: z.string().optional(),
    b602_envolvidos_5: z.string().optional(),
    b602_envolvidos_6: z.string().optional(),
    b602_envolvidos_7: z.string().optional(),
    b602_envolvidos_8: z.string().optional(),
    b602_envolvidos_9: z.string().optional(),
    b602_data_ocorrencia: z.string().optional(),
    b602_local_bairro: z.string().optional(),
    b602_local_cidade: z.string().optional(),
    b602_local_uf: z.string().optional(),
    b602_numero_bo: z.string().max(30, 'Nº do BO deve ter no máximo 30 caracteres').optional(),
    b602_numero_ip: z.string().max(30, 'Nº do IP deve ter no máximo 30 caracteres').optional(),
    b602_solicitante_nome: z.string().optional(),
    b602_material_enc_toggle: z.string().optional(),
    b602_cartuchos_toggle: z.string().optional(),
    b602_estojos_toggle: z.string().optional(),
    b602_armas_toggle: z.string().optional(),
    b602_armas_funcionamento_toggle: z.string().optional(),
    b602_armas_coleta_toggle: z.string().optional(),
  }).passthrough().superRefine((data, ctx) => {
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
    if (sections.includes('dados_investigacao')) {
      if (!data.b602_envolvidos_0?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pelo menos um envolvido é obrigatório para B-602', path: ['b602_envolvidos_0'] });
      }
      if (!data.b602_data_ocorrencia?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Data da ocorrência é obrigatória para B-602', path: ['b602_data_ocorrencia'] });
      }
      if (!data.b602_local_cidade?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cidade é obrigatória para B-602', path: ['b602_local_cidade'] });
      }
      if (!data.b602_local_uf?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'UF é obrigatória para B-602', path: ['b602_local_uf'] });
      }
      if (!data.b602_numero_bo?.trim() && !data.b602_numero_ip?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Preencha o Nº do BO ou Nº do IP (B-602 exige ao menos um)', path: ['b602_numero_bo'] });
      }
    }
  }), []);

  const form = useForm<REPFormData>({
    resolver: zodResolver(repFormSchema),
    defaultValues: emptyForm(),
    mode: 'onSubmit',
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

  // Estados para o Dialog de Linha do Tempo
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineRep, setTimelineRep] = useState<REP | null>(null);
  const [deleteDialogRep, setDeleteDialogRep] = useState<REP | null>(null);

  // Estados para Preview PDF da REP
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Quick-create dialog states
  const [solicitanteQCOpen, setSolicitanteQCOpen] = useState(false);
  const [solicitanteQCFormData, setSolicitanteQCFormData] = useState<CreateSolicitanteInput>({ nome: '', tipo: '', endereco: '', telefone: '', email: '' });
  const [solicitanteQCErrors, setSolicitanteQCErrors] = useState<Partial<Record<keyof CreateSolicitanteInput, string>>>({});
  const [solicitanteQCError, setSolicitanteQCError] = useState<string | null>(null);
  const [solicitanteQCSubmitting, setSolicitanteQCSubmitting] = useState(false);

  const [tipoExameQCOpen, setTipoExameQCOpen] = useState(false);
  const [tipoExameQCFormData, setTipoExameQCFormData] = useState<CreateTipoExameInput>({ codigo: '', nome: '', descricao: '' });
  const [tipoExameQCError, setTipoExameQCError] = useState<string | null>(null);
  const [tipoExameQCSubmitting, setTipoExameQCSubmitting] = useState(false);

  const [gdlModalOpen, setGdlModalOpen] = useState(false);
  const [camposPreenchidosGdl, setCamposPreenchidosGdl] = useState<Set<string>>(new Set());
  const [gdlApplied, setGdlApplied] = useState(false);

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
    if (editLoadRef.current) {
      editLoadRef.current = false;
    } else {
      form.setValue('template_id', '', { shouldValidate: false });
    }
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



  const tipoExameSelecionado = tipoExameId
    ? tiposExame.find(t => t.id === tipoExameId)
    : null;

  // Seções dinâmicas baseadas no tipo de exame
  const examSections = useMemo(() => {
    if (!tipoExameSelecionado) return [];
    return getSectionsForExame(tipoExameSelecionado.codigo);
  }, [tipoExameSelecionado, tiposExame]);

  const solicitanteId = form.watch('solicitante_id');
  useEffect(() => {
    if (solicitanteId) {
      const solicitante = solicitantes.find(s => s.id === solicitanteId);
      if (solicitante) {
        form.setValue('b602_solicitante_nome', solicitante.nome, { shouldValidate: false });
      }
    }
  }, [solicitanteId, solicitantes]);

  const handleNovo = () => {
    setEditingRep(null);
    setError(null);
    setSuccess(null);
    setTemplatesVinculados([]);
    setCamposPreenchidosGdl(new Set());
    setGdlApplied(false);
    form.reset(emptyForm());
    setSubmitting(false);
    setShowForm(true);
    document.body.style.pointerEvents = '';
  };

  const handleCancelar = () => {
    setShowForm(false);
    setEditingRep(null);
    form.reset(emptyForm());
    setTemplatesVinculados([]);
    setCamposPreenchidosGdl(new Set());
    setGdlApplied(false);
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

    // Parse campos_especificos via service registry

    const tipo = tiposExame.find(t => t.id === rep.tipo_exame_id);
    const especificos = deserializeCamposEspecificos(tipo?.codigo ?? '', rep.campos_especificos);

    editLoadRef.current = true;

    form.reset({
      ...emptyForm(),
      ...especificos,
      numero: rep.numero,
      solicitante_id: rep.solicitante_id || '',
      tipo_exame_id: rep.tipo_exame_id || '',
      template_id: templateId,
      data_requisicao: rep.data_requisicao?.split('T')[0] || '',
      tipo_solicitacao: rep.tipo_solicitacao || '',
      numero_documento: rep.numero_documento || '',
      data_documento: rep.data_documento?.split('T')[0] || '',
      autoridade_solicitante: rep.autoridade_solicitante || '',
      data_acionamento: rep.data_acionamento || '',
      data_chegada: rep.data_chegada || '',
      data_saida: rep.data_saida || '',
      local_fato: rep.local_fato || '',
      latitude: rep.latitude != null ? String(rep.latitude) : '',
      longitude: rep.longitude != null ? String(rep.longitude) : '',
      observacoes: rep.observacoes || '',
    });
    // Armazenar toggles originais para aviso ao desmarcar
    const toggleKeys = ['b602_cartuchos_toggle', 'b602_estojos_toggle', 'b602_armas_toggle'];
    const origToggles: Record<string, string> = {};
    for (const key of toggleKeys) {
      origToggles[key] = especificos?.[key as keyof typeof especificos] as string || 'off';
    }
    togglesOriginaisRef.current = origToggles;
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

  const handlePreviewRep = async (rep: REP) => {
    try {
      setPreviewLoading(true);
      setError(null);

      const rRep = await window.ipcAPI.rep.findById(rep.id);
      if (!rRep.success || !rRep.data) {
        setError('Erro ao carregar dados da REP');
        return;
      }
      const repData = rRep.data;

      let solicitanteNome = '';
      let tipoExameNome = '';
      let tipoExameCodigo = '';
      if (repData.solicitante_id) {
        const s = solicitantes.find(s => s.id === repData.solicitante_id);
        if (s) solicitanteNome = s.nome;
      }
      if (repData.tipo_exame_id) {
        const t = tiposExame.find(t => t.id === repData.tipo_exame_id);
        if (t) {
          tipoExameNome = t.nome;
          tipoExameCodigo = t.codigo;
        }
      }

      const tipoExameHeader = tipoExameCodigo
        ? `${tipoExameCodigo} - ${tipoExameNome || ''}`
        : tipoExameNome || '-';

      const repHeaderTemplate = `<p style="text-align:right">{{data_atual}}</p>\n<p style="text-align:right">FLS. {{pagina}}/{{totalPaginas}}</p>`;
      const { html: headerTemplate } = buildHeaderTemplate(repHeaderTemplate, {
        data_atual: new Date().toLocaleDateString('pt-BR'),
      });

      let html = buildRepHtml(repData, solicitanteNome, tipoExameNome);
      html = html.replace('</h2>', `</h2>\n<p style="font-size:14px;color:#555;margin-top:0;margin-bottom:16px">Tipo de exame: ${tipoExameHeader}</p>`);

      const margins = await getMargens();
      const result = await window.ipcAPI.template.previewPDF(html, margins, headerTemplate || undefined);

      if (result.success && result.data) {
        const byteChars = atob(result.data);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
        if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
        const url = URL.createObjectURL(blob);
        setPreviewBlobUrl(url);
        setPreviewOpen(true);
      } else {
        setError(result.error || 'Erro ao gerar PDF da REP');
      }
    } catch (e: any) {
      setError('Erro ao gerar preview: ' + e.message);
    } finally {
      setPreviewLoading(false);
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
    // Verificar toggles desmarcados
    if (editingRep) {
      const toggleKeys = ['b602_cartuchos_toggle', 'b602_estojos_toggle', 'b602_armas_toggle'];
      const toggleLabels: Record<string, string> = {
        'b602_cartuchos_toggle': 'Cartuchos',
        'b602_estojos_toggle': 'Estojos',
        'b602_armas_toggle': 'Armas',
      };
      const desmarcados: string[] = [];
      for (const key of toggleKeys) {
        const original = togglesOriginaisRef.current[key] || 'off';
        const atual = (data as Record<string, string>)[key] || 'off';
        if (original === 'on' && atual === 'off') {
          desmarcados.push(key);
        }
      }
      if (desmarcados.length > 0) {
        // Verificar se existe laudo vinculado
        try {
          const r = await window.ipcAPI.laudo.findByRepId(editingRep.id);
          if (r.success && r.data) {
            setTogglesDesmarcados(desmarcados);
            dadosPendentesRef.current = data;
            setDialogoToggleAberto(true);
            setSubmitting(false);
            return;
          }
        } catch { /* prosseguir se não conseguir verificar */ }
      }
    }

    await executarSalvar(data);
  });

  const executarSalvar = async (data: any) => {
    try {
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
  };

  const handleConfirmarDesmarcar = async () => {
    setDialogoToggleAberto(false);
    const data = dadosPendentesRef.current;
    if (data) {
      await executarSalvar(data);
    }
  };

  const handleSalvarSolicitanteQC = async () => {
    setSolicitanteQCError(null);
    setSolicitanteQCErrors({});

    const validation = createSolicitanteSchema.safeParse(solicitanteQCFormData);
    if (!validation.success) {
      const fieldErrors: Partial<Record<keyof CreateSolicitanteInput, string>> = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as keyof CreateSolicitanteInput;
        fieldErrors[field] = err.message;
      });
      setSolicitanteQCErrors(fieldErrors);
      return;
    }

    try {
      setSolicitanteQCSubmitting(true);
      const r = await window.ipcAPI.solicitante.create(solicitanteQCFormData);
      if (r.success) {
        await carregarSolicitantes();
        if (r.data?.id) form.setValue('solicitante_id', r.data.id);
        setSolicitanteQCOpen(false);
        setSolicitanteQCFormData({ nome: '', tipo: '', endereco: '', telefone: '', email: '' });
      } else {
        setSolicitanteQCError(r.error || 'Erro ao criar solicitante');
      }
    } catch (e: any) {
      setSolicitanteQCError(e.message || 'Erro ao criar solicitante');
    } finally {
      setSolicitanteQCSubmitting(false);
    }
  };

  const handleSalvarTipoExameQC = async () => {
    setTipoExameQCError(null);

    if (!tipoExameQCFormData.codigo.trim()) {
      setTipoExameQCError('O código do exame no GDL é obrigatório.');
      return;
    }
    if (!tipoExameQCFormData.nome.trim()) {
      setTipoExameQCError('O nome do tipo de exame é obrigatório.');
      return;
    }

    try {
      setTipoExameQCSubmitting(true);
      const r = await window.ipcAPI.tipoExame.create(tipoExameQCFormData);
      if (r.success) {
        await carregarTiposExame();
        if (r.data?.id) form.setValue('tipo_exame_id', r.data.id);
        setTipoExameQCOpen(false);
        setTipoExameQCFormData({ codigo: '', nome: '', descricao: '' });
      } else {
        setTipoExameQCError(r.error || 'Erro ao criar tipo de exame');
      }
    } catch (e: any) {
      setTipoExameQCError(e.message || 'Erro ao criar tipo de exame');
    } finally {
      setTipoExameQCSubmitting(false);
    }
  };

  const getGdlFieldStyle = (fieldName: string): string => {
    return camposPreenchidosGdl.has(fieldName)
      ? 'bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-800'
      : '';
  };

  const handleAplicarGdl = (campos: Record<string, string>, modo: 'substituir' | 'mesclar') => {
    const novosPreenchidos = new Set<string>();

    for (const [key, value] of Object.entries(campos)) {
      if (modo === 'substituir' || !form.getValues(key as any)) {
        form.setValue(key as any, value, { shouldValidate: true });
      }
      if (value) {
        novosPreenchidos.add(key);
      }
    }

    setCamposPreenchidosGdl(novosPreenchidos);
    setGdlApplied(true);
    setSuccess('Dados do GDL aplicados ao formulário. Campos com fundo verde foram preenchidos automaticamente.');
    setTimeout(() => setSuccess(null), 6000);
  };

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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => handlePreviewRep(rep)} disabled={previewLoading} title="Visualizar PDF">
                  <Eye size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Visualizar PDF</TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="sm" onClick={() => { setTimelineRep(rep); setTimelineOpen(true); }} title="Histórico">
              <Clock size={14} />
            </Button>
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
  ], [handleEditar, handleDelete, repsComLaudo, handleCriarLaudo, handlePreviewRep, previewLoading]);

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

        {/* Diálogo de aviso ao desmarcar toggles */}
        <Dialog open={dialogoToggleAberto} onOpenChange={setDialogoToggleAberto}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atenção: seção será removida do laudo</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2">
                  <p className="text-sm">
                    Desmarcar{' '}
                    {togglesDesmarcados.map((t, i) => {
                      const labels: Record<string, string> = {
                        'b602_cartuchos_toggle': '"Possui Cartuchos?"',
                        'b602_estojos_toggle': '"Possui Estojos?"',
                        'b602_armas_toggle': '"Possui Arma(s)?"',
                      };
                      return <strong key={t}>{labels[t] || t}</strong>;
                    }).reduce((acc, el, i) => {
                      if (i === 0) return [el as React.ReactNode];
                      if (i < togglesDesmarcados.length - 1) return [...(acc as React.ReactNode[]), ', ' as React.ReactNode, el as React.ReactNode];
                      return [...(acc as React.ReactNode[]), ' e ' as React.ReactNode, el as React.ReactNode];
                    }, [] as React.ReactNode[])}
                    {' '}removerá a seção/bloco correspondente do laudo. Edições manuais nessa seção serão perdidas.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setDialogoToggleAberto(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleConfirmarDesmarcar}>
                Continuar
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

      {timelineRep && (
        <RepTimelineDialog
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
          repId={timelineRep.id}
          repNumero={timelineRep.numero}
        />
      )}

      {/* Preview PDF da REP */}
      <Dialog open={previewOpen} onOpenChange={(open) => {
        if (!open && previewBlobUrl) {
          URL.revokeObjectURL(previewBlobUrl);
          setPreviewBlobUrl('');
        }
        setPreviewOpen(open);
      }}>
        <DialogContent className="max-w-[90vw] w-[1000px] h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Pré-visualização da REP (PDF)
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-slate-100 dark:bg-slate-800">
            {previewLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Gerando PDF...
              </div>
            ) : (
              <iframe
                src={previewBlobUrl}
                className="w-full h-full border-0"
                title="Preview PDF"
              />
            )}
          </div>
          <div className="p-4 border-t flex justify-end gap-2 bg-background">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
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
        <RepStepper
          form={form}
          tipoExameId={tipoExameId}
          tipoExameSelecionado={tipoExameSelecionado}
          repNumero={form.watch('numero')}
          repModo={editingRep ? 'editar' : 'nova'}
          tipoExameNome={
            tipoExameSelecionado
              ? `${tipoExameSelecionado.codigo} - ${tipoExameSelecionado.nome}`
              : undefined
          }
          showForm={showForm}
        >
          <Card className="flex-1 min-w-0">
            <CardHeader>
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <CardTitle>
                    {editingRep
                      ? `Editar REP ${editingRep.numero}`
                      : 'Nova Requisição de Exame Pericial'}
                  </CardTitle>
                  <CardDescription>
                    Campos marcados com <span className="font-semibold">*</span> são obrigatórios.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGdlModalOpen(true)}
                    className="flex items-center gap-1"
                    title="Consultar dados de REP no GDL"
                  >
                    <Network size={14} />
                    GDL
                  </Button>
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
                  onSubmit={handleSalvar}
                >
                  {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                  {success && <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900/50"><AlertDescription className="text-green-800 dark:text-green-400">{success}</AlertDescription></Alert>}
                  {gdlApplied && camposPreenchidosGdl.size > 0 && !success && (
                    <Alert className="bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-800">
                      <AlertDescription className="text-green-800 dark:text-green-400">
                        {camposPreenchidosGdl.size} campo(s) preenchido(s) via GDL.
                        Campos com fundo verde foram preenchidos automaticamente.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-8">
                    {/* ============================================ */}
                    {/* SEÇÃO 1: Dados da Solicitação */}
                    {/* ============================================ */}
                    <RepStepSection stepId="dados-solicitacao">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText size={16} className="text-primary" />
                        <h3 className="text-base font-semibold">Dados da Solicitação</h3>
                      </div>
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
                                    className={getGdlFieldStyle('numero')}
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
                                  <Input type="date" className={getGdlFieldStyle('data_requisicao')} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <FormField
                            control={form.control}
                            name="solicitante_id"
                            render={({ field }) => (
                              <FormItem>
                                <LabelWithPlaceholder field="solicitante_id" mostrar={mostrarPlaceholders}>Solicitante <ClipboardPen size={14} className="inline cursor-pointer text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setSolicitanteQCOpen(true); }} /></LabelWithPlaceholder>
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
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <FormField
                            control={form.control}
                            name="tipo_solicitacao"
                            render={({ field }) => {
                              const isOutros = field.value && !['BOU', 'BO PM', 'BO PC', 'Ofício', 'CECOMP'].includes(field.value) && field.value !== '';
                              return (
                                <FormItem>
                                  <LabelWithPlaceholder field="tipo_solicitacao" mostrar={mostrarPlaceholders}>Tipo de Solicitação *<HelpIcon text="Ex: Ofício, BOU, BO PM, BO PC, CECOMP" /></LabelWithPlaceholder>
                                  <Select
                                    value={isOutros ? 'Outros' : field.value}
                                    onValueChange={(v) => {
                                      if (v === 'Outros') {
                                        field.onChange('');
                                      } else {
                                        field.onChange(v);
                                      }
                                    }}
                                  >
                                    <FormControl>
                                      <SelectTrigger className={getGdlFieldStyle('tipo_solicitacao')}><SelectValue placeholder="Selecione..." /></SelectTrigger>
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
                                  {(isOutros || field.value === '') && (
                                    <Input
                                      className="mt-2"
                                      placeholder="Especifique o tipo..."
                                      value={isOutros ? field.value : ''}
                                      onChange={(e) => field.onChange(e.target.value)}
                                      maxLength={50}
                                    />
                                  )}
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                        </div>
                        <div>
                          <FormField
                            control={form.control}
                            name="numero_documento"
                            render={({ field }) => (
                              <FormItem>
                                <LabelWithPlaceholder field="numero_documento" mostrar={mostrarPlaceholders}>Nº da Solicitação *<HelpIcon text="Número do ofício ou documento que originou a solicitação" /></LabelWithPlaceholder>
                                <FormControl>
                                  <Input placeholder="Requisição nº" className={getGdlFieldStyle('numero_documento')} {...field} />
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
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <FormField
                            control={form.control}
                            name="tipo_exame_id"
                            render={({ field }) => (
                              <FormItem>
                                <LabelWithPlaceholder field="tipo_exame_id" mostrar={mostrarPlaceholders}>Tipo de Exame <ClipboardPen size={14} className="inline cursor-pointer text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setTipoExameQCOpen(true); }} /></LabelWithPlaceholder>
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
                      </div>

                      <div className="mt-4">
                        <FormField
                          control={form.control}
                          name="observacoes"
                          render={({ field }) => (
                            <FormItem>
                              <LabelWithPlaceholder field="observacoes" mostrar={mostrarPlaceholders}>Observações</LabelWithPlaceholder>
                              <FormControl>
                                <Textarea placeholder="Observações gerais..." rows={3} className={getGdlFieldStyle('observacoes')} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </RepStepSection>

                    {/* ============================================ */}
                    {/* SEÇÕES DINÂMICAS: Campos Específicos */}
                    {/* ============================================ */}
                    {examSections.map(s => (
                      <RepStepSection key={s.id} stepId={`section-${s.id}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <s.icon size={16} className="text-primary" />
                          <h3 className="text-base font-semibold">{s.label}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">{s.description}</p>
                        <s.component form={form} mostrarPlaceholders={mostrarPlaceholders} />
                      </RepStepSection>
                    ))}
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 mt-4">
                    <Button variant="outline" type="button" onClick={handleCancelar}>Cancelar</Button>
                    <Button type="submit" disabled={submitting || !form.formState.isValid} className="flex items-center gap-2">
                      <Plus size={16} /> {submitting ? 'Salvando...' : editingRep ? 'Atualizar' : 'Criar'} REP
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </RepStepper>
      )}
    </div>

      {/* Quick-create Solicitante Dialog */}
      <Dialog open={solicitanteQCOpen} onOpenChange={setSolicitanteQCOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Solicitante</DialogTitle>
            <DialogDescription>
              Preencha as informações para cadastrar um novo solicitante.
            </DialogDescription>
          </DialogHeader>
          <SolicitanteFormFields
            formData={solicitanteQCFormData}
            onChange={setSolicitanteQCFormData}
            errors={solicitanteQCErrors}
            error={solicitanteQCError}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setSolicitanteQCOpen(false);
                setSolicitanteQCError(null);
                setSolicitanteQCErrors({});
                setSolicitanteQCFormData({ nome: '', tipo: '', endereco: '', telefone: '', email: '' });
              }}
              disabled={solicitanteQCSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSalvarSolicitanteQC} disabled={solicitanteQCSubmitting}>
              {solicitanteQCSubmitting ? 'Criando...' : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick-create Tipo Exame Dialog */}
      <Dialog open={tipoExameQCOpen} onOpenChange={setTipoExameQCOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo Tipo de Exame</DialogTitle>
            <DialogDescription>
              Preencha as informações para criar um novo tipo de exame.
            </DialogDescription>
          </DialogHeader>
          <TipoExameFormFields
            formData={tipoExameQCFormData}
            onChange={setTipoExameQCFormData}
            error={tipoExameQCError}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setTipoExameQCOpen(false);
                setTipoExameQCError(null);
                setTipoExameQCFormData({ codigo: '', nome: '', descricao: '' });
              }}
              disabled={tipoExameQCSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSalvarTipoExameQC} disabled={tipoExameQCSubmitting}>
              {tipoExameQCSubmitting ? 'Criando...' : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <GdlConsultaModal
        open={gdlModalOpen}
        onOpenChange={setGdlModalOpen}
        onAplicar={handleAplicarGdl}
        temDadosExistentes={
          !!form.getValues('numero') ||
          !!form.getValues('tipo_solicitacao') ||
          !!form.getValues('numero_documento')
        }
      />
      </TooltipProvider>
  );
};
