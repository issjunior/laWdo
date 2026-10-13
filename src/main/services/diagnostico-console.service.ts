import { createHash } from 'node:crypto';
import type { DiagnosticoSourceMapService, LocalizacaoOriginalDiagnostico } from './diagnostico-source-map.service.js';

interface AvisoConsoleDiagnostico {
  mensagem: string;
  origem: string | null;
  linha: number | null;
  principal: boolean;
  agregada: boolean;
}

const classificacoes = [
  {
    padrao: /^Failed to load resource: the server responded with a status of/i,
    codigo: 'RECURSO_HTTP_INDISPONIVEL',
    descricao: 'Um recurso não foi carregado; verifique a origem e a resposta HTTP.',
  },
  {
    padrao: /^Refused to .+ because it violates the following Content Security Policy directive/i,
    codigo: 'BLOQUEIO_POLITICA_CONTEUDO',
    descricao: 'A política de segurança de conteúdo bloqueou uma operação do renderer.',
  },
  {
    padrao: /^ResizeObserver loop (?:limit exceeded|completed with undelivered notifications)/i,
    codigo: 'CICLO_OBSERVADOR_LAYOUT',
    descricao: 'O observador de layout não concluiu todas as notificações neste quadro.',
  },
  {
    padrao: /^Each child in a list should have a unique ["']key["'] prop\./,
    codigo: 'CHAVE_LISTA_REACT',
    descricao: 'Uma lista React foi renderizada sem chave estável para cada elemento.',
  },
  {
    padrao: /^Falha ao (?:atualizar placeholder visualmente|preparar a visualização dos placeholders)\./,
    codigo: 'FALHA_VISUAL_PLACEHOLDER',
    descricao: 'A atualização visual de placeholders falhou; verifique o editor e a localização.',
  },
  {
    padrao: /^\[ilustracoes\] [^\n]*: remount\b/,
    codigo: 'REMONTAGEM_EDITOR_ILUSTRACOES',
    descricao: 'O editor de ilustrações foi remontado; verifique o ciclo de vida do editor.',
  },
] as const;

function classificarMensagem(mensagem: string): { classificacaoTecnica: string; descricaoTecnica: string } {
  const classificacao = classificacoes.find(item => item.padrao.test(mensagem));
  return classificacao
    ? { classificacaoTecnica: classificacao.codigo, descricaoTecnica: classificacao.descricao }
    : { classificacaoTecnica: 'NAO_CLASSIFICADO', descricaoTecnica: 'Conteúdo omitido por segurança; use a assinatura e a localização para agrupar ocorrências.' };
}

export async function prepararAvisoConsoleDiagnostico(
  aviso: AvisoConsoleDiagnostico,
  resolvedor: Pick<DiagnosticoSourceMapService, 'resolver'> | null,
): Promise<Record<string, unknown>> {
  let localizacaoOriginal: LocalizacaoOriginalDiagnostico = { disponivel: false, motivo: 'MAPA_AUSENTE' };
  if (resolvedor) {
    try {
      localizacaoOriginal = await resolvedor.resolver(aviso.origem, aviso.linha, 1);
    } catch {
      localizacaoOriginal = { disponivel: false, motivo: 'FALHA_RESOLUCAO' };
    }
  }

  return {
    assinatura: createHash('sha256').update(aviso.mensagem).digest('hex').slice(0, 16),
    linha: aviso.linha,
    origem: aviso.origem,
    principal: aviso.principal,
    localizacaoOriginal,
    agregada: aviso.agregada,
    ...classificarMensagem(aviso.mensagem),
    conteudoOmitido: true,
  };
}
