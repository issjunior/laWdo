import { CAMPOS_ESPECIFICOS_PLACEHOLDERS } from '@/components/rep/exam-fields/placeholders';

function formatarData(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    const data = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
    if (isNaN(data.getTime())) return iso;
    return data.toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function formatarDataExtenso(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    const data = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
    if (isNaN(data.getTime())) return iso;
    return data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
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

export interface ExportacaoContext {
  repData: any;
  solicitanteNome?: string;
  tipoExameNome?: string;
  tipoExameCodigo?: string;
}

function buildPlaceholderMapping(ctx: ExportacaoContext): Record<string, string> {
  const repData = ctx.repData;
  let perito: any = null;
  try {
    const userJson = sessionStorage.getItem('lawdo_auth_user');
    if (userJson) perito = JSON.parse(userJson);
  } catch { /* ignora */ }

  const mapping: Record<string, string> = {
    'rep_numero': repData.numero || '',
    'rep_data_requisicao': formatarData(repData.data_requisicao),
    'rep_prazo': repData.prazo || '',
    'rep_tipo_solicitacao': repData.tipo_solicitacao || '',
    'rep_numero_documento': repData.numero_documento || '',
    'rep_data_documento': formatarData(repData.data_documento),
    'rep_data_acionamento': formatarDataHora(repData.data_acionamento),
    'rep_data_chegada': formatarDataHora(repData.data_chegada),
    'rep_data_saida': formatarDataHora(repData.data_saida),
    'rep_observacoes': repData.observacoes || '',

    'rep.numero': repData.numero || '',
    'rep.documento': repData.numero_documento || '',
    'rep.local': repData.local_fato || '',
    'rep.data': formatarData(repData.data_requisicao),
    'rep.autoridade': repData.autoridade_solicitante || '',
    'rep.requisicao': repData.numero_documento || '',

    'solicitante_nome': ctx.solicitanteNome || '',
    'tipo_exame_nome': ctx.tipoExameNome || '',
    'tipo_exame_codigo': ctx.tipoExameCodigo || '',

    'NUMERO_REP': repData.numero || '',
    'NUMERO': repData.numero || '',
    'LOCAL_FATO': repData.local_fato || '',
    'AUTORIDADE': repData.autoridade_solicitante || '',

    'numero_rep': repData.numero || '',
    'data_recebimento_rep': formatarData(repData.data_requisicao),
    'tipo_solicitacao_rep': repData.tipo_solicitacao || '',
    'numero_solicitacao_rep': repData.numero_documento || '',
    'data_solicitacao_rep': formatarData(repData.data_documento),
    'data_acionamento_local': formatarDataHora(repData.data_acionamento),
    'data_chegada_local': formatarDataHora(repData.data_chegada),
    'data_saida_local': formatarDataHora(repData.data_saida),
    'observacoes_rep': repData.observacoes || '',
    'autoridade_solicitante_rep': repData.autoridade_solicitante || '',
    'local_fato': repData.local_fato || '',
    'latitude': repData.latitude || '',
    'longitude': repData.longitude || '',

    'perito.nome': perito?.nome || '',
    'perito.cargo': perito?.cargo || 'Perito Criminal',
    'perito.especialidade': perito?.especialidade || '',

    'perito_nome': perito?.nome || '',
    'perito_cargo': perito?.cargo || 'Perito Criminal',
    'perito_lotacao': perito?.lotacao || '',
    'perito_matricula': perito?.matricula || '',

    'data_atual': new Date().toLocaleDateString('pt-BR'),
    'data_extenso_recebimento_rep': formatarDataExtenso(repData.data_requisicao),
  };

  if (repData.campos_especificos) {
    try {
      const especificos = JSON.parse(repData.campos_especificos);
      for (const placeholder of CAMPOS_ESPECIFICOS_PLACEHOLDERS) {
        const partes = placeholder.jsonPath.split('.');
        let valor: unknown = especificos;
        for (const parte of partes) {
          valor = (valor as Record<string, unknown>)?.[parte];
        }
        if (valor !== undefined && valor !== null && valor !== '') {
          mapping[placeholder.chave] = String(valor);
        }
      }

      const b602 = especificos.b602 as Record<string, unknown> | undefined;
      if (b602) {
        const envolvidos = b602.envolvidos as string[] | undefined;
        if (envolvidos && envolvidos.length > 0) {
          mapping['b602_envolvidos'] = envolvidos.filter(Boolean).join(', ');
        }
        mapping['b602_data_ocorrencia'] = String(b602.data_ocorrencia || '');
        mapping['b602_local'] = String(b602.local || '');
        mapping['b602_numero_bo'] = String(b602.numero_bo || '');
        mapping['b602_numero_ip'] = String(b602.numero_ip || '');
        mapping['b602_solicitante_nome'] = String(b602.solicitante_nome || '');
      }

      const i801 = especificos.i801 as Record<string, unknown> | undefined;
      if (i801) {
        mapping['veiculo'] = String(i801.veiculo || '');
        mapping['placa'] = String(i801.placa || '');
        mapping['fabricacao_modelo'] = String(i801.fabricacao_modelo || '');
        mapping['cor'] = String(i801.cor || '');
        mapping['conservacao'] = String(i801.conservacao || '');
        mapping['chassi'] = String(i801.chassi || '');
        mapping['chassi_revelado'] = String(i801.chassi_revelado || '');
        mapping['motor'] = String(i801.motor || '');
        mapping['motor_revelado'] = String(i801.motor_revelado || '');
      }
    } catch { /* mantém mapping atual */ }
  }

  return mapping;
}

export function resolverPlaceholdersExportacao(html: string, ctx: ExportacaoContext): string {
  const mapping = buildPlaceholderMapping(ctx);

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const placeholderSpans = doc.querySelectorAll('span[data-placeholder]');
    placeholderSpans.forEach(span => {
      const rawPlaceholder = span.getAttribute('data-placeholder') || '';
      const chaveMatch = rawPlaceholder.match(/^\{\{(.+)\}\}$/);
      if (chaveMatch) {
        const chave = chaveMatch[1];
        const valor = mapping[chave];
        if (valor !== undefined) {
          span.replaceWith(doc.createRange().createContextualFragment(valor));
        }
      }
    });

    let resultado = doc.body.innerHTML;

    Object.entries(mapping).forEach(([chave, valor]) => {
      const displayValue = valor || '';
      const escapedChave = chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tagRegex = new RegExp(`\\{\\{${escapedChave}\\}\\}`, 'gi');
      resultado = resultado.replace(tagRegex, displayValue);
    });

    return resultado;
  } catch {
    let resultado = html;
    Object.entries(mapping).forEach(([chave, valor]) => {
      const displayValue = valor || '';
      const escapedChave = chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tagRegex = new RegExp(`\\{\\{${escapedChave}\\}\\}`, 'gi');
      resultado = resultado.replace(tagRegex, displayValue);
    });
    return resultado;
  }
}
