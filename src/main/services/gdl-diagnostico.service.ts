import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

interface ContextoConsulta { remetenteId: number; capturaId: string; janelaId: number; correlacaoId: string; numero: string; ano: string; ambiente?: string; camposOriginais?: string[]; estruturaOriginalCompleta?: boolean }
interface ObservadorConsulta {
  obterCaptura: (remetenteId: number) => { capturaId: string; janelaId: number } | null;
  registrar: (contexto: ContextoConsulta, dados: Record<string, unknown>) => Promise<unknown>;
}
const contextoConsulta = new AsyncLocalStorage<ContextoConsulta>();
let observador: ObservadorConsulta | null = null;

export function configurarObservadorGdl(entrada: ObservadorConsulta | null): void { observador = entrada; }

export async function observarConsultaGdl<T>(remetenteId: number, numero: string, ano: string, consultar: () => Promise<T>): Promise<T> {
  let captura = null;
  try { captura = observador?.obterCaptura(remetenteId) ?? null; } catch { /* A coleta não interfere na consulta. */ }
  if (!captura) return consultar();
  return contextoConsulta.run({ ...captura, remetenteId, correlacaoId: randomUUID(), numero, ano }, consultar);
}

export function definirAmbienteConsultaGdl(ambiente: string): void {
  const contexto = contextoConsulta.getStore();
  if (contexto) contexto.ambiente = ambiente;
}

export function destinoApiGdlPermitido(url: string, metodo: string): boolean {
  const destino = new URL(url);
  if (!['http:', 'https:'].includes(destino.protocol) || destino.username || destino.password) return false;
  const rota = destino.pathname.toLowerCase();
  return metodo === 'GET' && /\/api\/(rep\/obter(?:\/\d+)?|unidadesmedida)$/.test(rota)
    || metodo === 'POST' && /\/api\/repsinvestigacaopolicial\/listarreps$/.test(rota);
}

function classificarAndamento(texto: string): string {
  const descricao = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (descricao.includes('rep aberta')) return 'abertura';
  if (descricao.includes('distribu')) return 'distribuicao';
  if (descricao.includes('status')) return 'status';
  if (descricao.includes('rep atualizada')) return 'atualizacao';
  if (descricao.includes('origem')) return 'origem';
  if (descricao.includes('peca')) return 'peca';
  return 'outros';
}

export function resumirRespostaGdl(valor: unknown) {
  const campos: Array<{ caminho: string; tipo: string; preenchido: boolean; quantidade?: number }> = [];
  const datas: Array<{ caminho: string; data: string }> = [];
  const andamentos: Array<{ classe: string; data: string | null }> = [];
  const motivosOmissao = new Set<string>();
  const chaveSegura = /^[\p{L}\p{M}\p{N}_ .ºª/():?,;+#%°-]{1,80}$/u;
  const normalizarNome = (nome: string) => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const fila: Array<{ item: unknown; caminho: string; profundidade: number }> = [{ item: valor, caminho: '', profundidade: 0 }];
  const adicionar = (item: unknown, caminho: string, profundidade: number) => {
    if (profundidade > 5) { motivosOmissao.add('profundidade'); return; }
    if (fila.length + campos.length >= 100) { motivosOmissao.add('limite_caminhos'); return; }
    fila.push({ item, caminho, profundidade });
  };
  while (fila.length) {
    const atual = fila.shift();
    if (!atual) break;
    const { item, caminho, profundidade } = atual;
    campos.push({ caminho, tipo: item === null ? 'null' : Array.isArray(item) ? 'array' : typeof item,
      preenchido: item !== null && item !== undefined && item !== '', ...(Array.isArray(item) ? { quantidade: item.length } : {}) });
    const nome = normalizarNome(caminho);
    const dataRelevante = /(?:entrada|recebimento|requis|solicit|documento|origem|origens|andamentos).*data|data.*(?:entrada|recebimento|requis|solicit|documento|origem|origens)|andamentos.*datahora/.test(nome);
    if (typeof item === 'string' && dataRelevante && /^(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})(?:[T ][\d:.+Z-]+)?$/.test(item)) {
      if (datas.length + andamentos.length < 20) datas.push({ caminho, data: item });
      else motivosOmissao.add('limite_exemplos');
    }
    if (Array.isArray(item)) {
      if (/andamentos$/i.test(caminho)) {
        for (const entrada of item.slice(0, 20)) {
          if (datas.length + andamentos.length >= 20) { motivosOmissao.add('limite_exemplos'); break; }
          if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) continue;
          const registro: Record<string, unknown> = entrada;
          const data = typeof registro.dataHora === 'string' && /^\d{4}-\d{2}-\d{2}[T ][\d:.+Z-]+$/.test(registro.dataHora) ? registro.dataHora : null;
          andamentos.push({ classe: typeof registro.descricao === 'string' ? classificarAndamento(registro.descricao) : 'outros', data });
        }
        if (item.length > 20) motivosOmissao.add('limite_exemplos');
      }
      // A amostra estrutural da coleção não afirma que todos os itens têm os mesmos campos.
      if (item.length) adicionar(item[0], `${caminho}[]`, profundidade + 1);
    } else if (item && typeof item === 'object') {
      for (const [chave, conteudo] of Object.entries(item)) {
        if (!chaveSegura.test(chave)) { motivosOmissao.add('nome_nao_suportado'); continue; }
        adicionar(conteudo, caminho ? `${caminho}.${chave}` : chave, profundidade + 1);
      }
    }
  }
  const nivelRaizCompleto = valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    && Object.keys(valor).every(chave => chaveSegura.test(chave) && campos.some(campo => campo.caminho === chave));
  const camposDeInteresse = ['dataEntradaSolicitacao', 'dataHoraEntrada', 'quesitoAberto', 'andamentos', 'arquivosAdicionais'];
  const naoObservados = camposDeInteresse.filter(chave => !campos.some(campo => campo.caminho.toLowerCase() === chave.toLowerCase()));
  return { campos, datas, andamentos, nivelRaizCompleto,
    camposDeInteresseAusentes: nivelRaizCompleto ? naoObservados : [],
    camposDeInteresseNaoConclusivos: nivelRaizCompleto ? [] : naoObservados,
    motivosOmissao: [...motivosOmissao], truncado: motivosOmissao.size > 0 };
}

export async function registrarRespostaGdl(dados: Record<string, unknown>, texto?: string, normalizado?: unknown): Promise<void> {
  const contexto = contextoConsulta.getStore();
  if (!contexto || !observador) return;
  try {
    if (observador.obterCaptura(contexto.remetenteId)?.capturaId !== contexto.capturaId) return;
    let resumo = {};
    if (texto !== undefined) {
      try { const valor: unknown = JSON.parse(texto); resumo = resumirRespostaGdl(valor); }
      catch { resumo = { jsonValido: false }; }
    }
    if (normalizado !== undefined) resumo = resumirRespostaGdl(normalizado);
    dados = { ...dados, ...resumo };
    if (dados.etapa === 'resposta_original' && 'campos' in resumo && Array.isArray(resumo.campos)) {
      contexto.camposOriginais = resumo.campos.flatMap(item => item && typeof item === 'object' && 'caminho' in item && typeof item.caminho === 'string' ? [item.caminho] : []);
      contexto.estruturaOriginalCompleta = 'truncado' in resumo && resumo.truncado === false;
    }
    if (dados.etapa === 'resposta_normalizada' && Array.isArray(dados.campos)) {
      const caminhos = dados.campos.flatMap(item => item && typeof item === 'object' && 'caminho' in item && typeof item.caminho === 'string' ? [item.caminho] : []);
      const comparacaoEstruturalConclusiva = contexto.estruturaOriginalCompleta === true && dados.truncado === false;
      dados = { ...dados, comparacaoEstruturalConclusiva,
        camposAusentesAposNormalizacao: comparacaoEstruturalConclusiva ? contexto.camposOriginais?.filter(item => !caminhos.includes(item)) ?? [] : [],
        camposIntroduzidosNaNormalizacao: comparacaoEstruturalConclusiva ? caminhos.filter(item => !contexto.camposOriginais?.includes(item)) : [] };
    }
    await observador.registrar(contexto, { ...dados, ambiente: contexto.ambiente ?? 'nao_identificado', ...resumo });
  } catch { /* Falhas diagnósticas não alteram o resultado da API. */ }
}
