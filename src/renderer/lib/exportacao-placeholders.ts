import { CAMPOS_ESPECIFICOS_PLACEHOLDERS } from '@/components/rep/exam-fields/placeholders';
import { buildDadosInvestigacaoTable, buildNumberedTable, buildArmasTabela } from '@/lib/tabelas-placeholder';

function numToLetra(n: number): string {
  if (n < 26) return String.fromCharCode(65 + n);
  return numToLetra(Math.floor(n / 26) - 1) + String.fromCharCode(65 + (n % 26));
}

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

interface RepExportacaoData {
  numero?: string;
  data_requisicao?: string;
  prazo?: string;
  tipo_solicitacao?: string;
  numero_documento?: string;
  data_documento?: string;
  data_acionamento?: string;
  data_chegada?: string;
  data_saida?: string;
  observacoes?: string;
  local_fato?: string;
  autoridade_solicitante?: string;
  latitude?: string;
  longitude?: string;
  campos_especificos?: string;
}

interface PeritoSessaoData {
  nome?: string;
  cargo?: string;
  especialidade?: string;
  lotacao?: string;
  matricula?: string;
}

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function lerPeritoSessao(): PeritoSessaoData | null {
  try {
    const userJson = sessionStorage.getItem('lawdo_auth_user');
    if (!userJson) return null;
    const parsed: unknown = JSON.parse(userJson);
    if (!isRecord(parsed)) return null;
    return {
      nome: typeof parsed.nome === 'string' ? parsed.nome : undefined,
      cargo: typeof parsed.cargo === 'string' ? parsed.cargo : undefined,
      especialidade: typeof parsed.especialidade === 'string' ? parsed.especialidade : undefined,
      lotacao: typeof parsed.lotacao === 'string' ? parsed.lotacao : undefined,
      matricula: typeof parsed.matricula === 'string' ? parsed.matricula : undefined,
    };
  } catch {
    return null;
  }
}

export interface ExportacaoContext {
  repData: RepExportacaoData;
  solicitanteNome?: string;
  tipoExameNome?: string;
  tipoExameCodigo?: string;
}

function buildPlaceholderMapping(ctx: ExportacaoContext): Record<string, string> {
  const repData = ctx.repData;
  const perito = lerPeritoSessao();

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
        if (placeholder.computed) continue; // valor gerado em runtime (ex: letra da arma)
        if (!placeholder.jsonPath) continue;
        const partes = placeholder.jsonPath.split('.');
        let valor: unknown = especificos;
        for (const parte of partes) {
          valor = (valor as Record<string, unknown>)?.[parte];
        }
        if (valor !== undefined && valor !== null && valor !== '') {
          mapping[placeholder.chave] = String(valor);
        }
      }

      // Fallback: se local for string (formato antigo), extrair sub-campos
      const b602Fallback = especificos.b602 as Record<string, unknown> | undefined;
      if (b602Fallback && typeof b602Fallback.local === 'string') {
        const partesLocal = (b602Fallback.local as string).split('/').map(s => s.trim()).filter(Boolean);
        if (partesLocal.length >= 3 && !mapping['b602_local_bairro']) mapping['b602_local_bairro'] = partesLocal[0];
        if (partesLocal.length >= 2 && !mapping['b602_local_cidade']) mapping['b602_local_cidade'] = partesLocal[partesLocal.length >= 3 ? 1 : 0];
        if (partesLocal.length >= 2 && !mapping['b602_local_uf']) mapping['b602_local_uf'] = partesLocal[partesLocal.length - 1];
      }

      if (!mapping['b602_solicitante_nome']) {
        mapping['b602_solicitante_nome'] = ctx.solicitanteNome || '';
      }

      const b602 = especificos.b602 as Record<string, unknown> | undefined;
      if (b602) {
        const envolvidos = b602.envolvidos as string[] | undefined;
        if (envolvidos && envolvidos.length > 0) {
          mapping['b602_envolvidos'] = envolvidos.filter(Boolean).join(', ');
        }
        mapping['b602_data_ocorrencia'] = String(b602.data_ocorrencia || '');
        const localVal = b602.local;
        if (localVal && typeof localVal === 'object') {
          const loc = localVal as Record<string, string>;
          mapping['b602_local'] = [loc.bairro, loc.cidade, loc.uf].filter(Boolean).join(' / ');
        } else {
          mapping['b602_local'] = String(localVal || '');
        }
        mapping['b602_numero_bo'] = String(b602.numero_bo || '');
        mapping['b602_numero_ip'] = String(b602.numero_ip || '');
        mapping['b602_solicitante_nome'] = String(b602.solicitante_nome || '');

        mapping['b602_tabela_dados_investigacao'] = buildDadosInvestigacaoTable(b602, ctx.solicitanteNome);

        const material = b602.material_enc as Record<string, string>[] | undefined;
        if (material && material.length > 0) {
          mapping['b602_tabela_material_enc'] = buildNumberedTable(
            'TABELA 2 – MATERIAL ENCAMINHADO',
            ['Natureza', 'Qtd', 'Tipo', 'Dito do Ofício', 'Nº do Lacre'],
            material.map(m => [m.natureza || '', m.quantidade || '', m.tipo || '', m.dito_oficio || '', m.numero_lacre || ''])
          );
        }

        const cartuchos = b602.cartuchos as Record<string, unknown>[] | undefined;
        if (cartuchos && cartuchos.length > 0) {
          mapping['b602_tabela_cartuchos'] = buildNumberedTable(
            'TABELA 3 – CARTUCHOS',
            ['Qtd', 'Calibre', 'Marca', 'Origem', 'Espoleta', 'Estojo', 'Projétil', 'Observação'],
            cartuchos.map(c => [
              String(c.quantidade || ''),
              String(c.calibre || ''),
              String(c.marca || ''),
              String(c.origem || ''),
              String(c.espoleta || ''),
              String(c.estojo || ''),
              String(c.projetil || ''),
              Array.isArray(c.observacao) ? (c.observacao as string[]).join(', ') : String(c.observacao || ''),
            ])
          );
        }

        const estojos = b602.estojos as Record<string, unknown>[] | undefined;
        if (estojos && estojos.length > 0) {
          mapping['b602_tabela_estojos'] = buildNumberedTable(
            'TABELA 4 – ESTOJOS',
            ['Qtd', 'Calibre', 'Marca', 'Origem', 'Espoleta', 'Estojo', 'Observação'],
            estojos.map(e => [
              String(e.quantidade || ''),
              String(e.calibre || ''),
              String(e.marca || ''),
              String(e.origem || ''),
              String(e.espoleta || ''),
              String(e.estojo || ''),
              Array.isArray(e.observacao) ? (e.observacao as string[]).join(', ') : String(e.observacao || ''),
            ])
          );
        }

        // Tabela de armas
        mapping['b602_tabela_armas'] = buildArmasTabela(b602);

        // Totais
        const materialEnc = b602.material_enc as Record<string, string>[] | undefined;
        if (materialEnc) {
          mapping['b602_total_material_enc'] = String(
            materialEnc.reduce((sum, item) => sum + (parseInt(String(item.quantidade || '0')) || 0), 0)
          );
        }
        if (cartuchos) {
          mapping['b602_total_cartuchos'] = String(
            cartuchos.reduce((sum, item) => sum + (parseInt(String(item.quantidade || '0')) || 0), 0)
          );
        }
        if (estojos) {
          mapping['b602_total_estojos'] = String(
            estojos.reduce((sum, item) => sum + (parseInt(String(item.quantidade || '0')) || 0), 0)
          );
        }
        const armas = b602.armas as Record<string, string>[] | undefined;
        if (armas) {
          mapping['b602_total_armas'] = String(
            armas.reduce((sum, item) => sum + (parseInt(String(item.quantidade || '0')) || 0), 0)
          );

          // --- Placeholders individuais de armas ---
          armas.forEach((arma, i) => {
            const idx = i + 1;
            mapping[`b602_arma_${idx}_letra`] = numToLetra(i);
            mapping[`b602_arma_${idx}_tipo`] = arma.tipo || '';
            mapping[`b602_arma_${idx}_marca`] = arma.marca || '';
            mapping[`b602_arma_${idx}_modelo`] = arma.modelo || '';
            mapping[`b602_arma_${idx}_calibre`] = arma.calibre || '';
            mapping[`b602_arma_${idx}_numeracao_serie`] = arma.numeracao_serie || '';
            mapping[`b602_arma_${idx}_numeracao_cano`] = arma.numeracao_cano || '';
            mapping[`b602_arma_${idx}_capacidade_carregador`] = arma.capacidade_carregador || '';
            mapping[`b602_arma_${idx}_comprimento_cano`] = arma.comprimento_cano || '';
            mapping[`b602_arma_${idx}_acabamento`] = arma.acabamento || '';
            mapping[`b602_arma_${idx}_funcionamento`] = arma.funcionamento || '';
            mapping[`b602_arma_${idx}_estado_conservacao`] = arma.estado_conservacao || '';
            mapping[`b602_arma_${idx}_quantidade`] = arma.quantidade || '';
            mapping[`b602_arma_${idx}_dito_oficio`] = arma.dito_oficio || '';
            mapping[`b602_arma_${idx}_numero_lacre`] = arma.numero_lacre || '';
            mapping[`b602_arma_${idx}_func_toggle`] = String(arma.func_toggle || 'off');
            mapping[`b602_arma_${idx}_coleta_toggle`] = String(arma.coleta_toggle || 'off');
          });
        }
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

export function limparIndicadoresCondicionais(html: string): string {
  let result = html.replace(
    /<p[^>]*data-cond-label="true"[^>]*>\[Condicional:\s*([^\]]+)\]<\/p>/gi,
    '<h3>$1</h3>'
  );
  result = result.replace(
    /<div[^>]*\bdata-cond-bloco="[^"]*"[^>]*>/gi,
    (match) => match.replace(/\s*style="[^"]*"/gi, '')
  );
  return result;
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

    return limparIndicadoresCondicionais(resultado);
  } catch {
    let resultado = html;
    Object.entries(mapping).forEach(([chave, valor]) => {
      const displayValue = valor || '';
      const escapedChave = chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tagRegex = new RegExp(`\\{\\{${escapedChave}\\}\\}`, 'gi');
      resultado = resultado.replace(tagRegex, displayValue);
    });
    return limparIndicadoresCondicionais(resultado);
  }
}
