import { appendFile, readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  schemaEventoDiagnostico,
  type EventoDiagnostico,
} from '../../shared/diagnostico/contratos.js';

export interface FiltrosEventosDiagnostico {
  depoisDe: number;
  limite: number;
  categorias?: EventoDiagnostico['categoria'][];
  niveis?: EventoDiagnostico['nivel'][];
  origens?: EventoDiagnostico['origem'][];
  janelaId?: number;
  correlacaoId?: string;
}

const chavesSensiveis = /senha|password|token|secret|api.?key|cpf|rg|email|telefone|foto|avatar|endere[cç]o|textcontent|innertext|\bvalue\b|conteudo(?:editavel)?|mensagem/i;

export function sanitizarDadosDiagnostico(valor: unknown, profundidade = 0): unknown {
  if (profundidade >= 6) return '[profundidade_maxima]';
  if (valor === null || typeof valor === 'boolean' || typeof valor === 'number') return valor;
  if (typeof valor === 'string') {
    if (valor === 'undefined') return null;
    return valor.length > 2_000 ? `${valor.slice(0, 2_000)}...[truncado]` : valor;
  }
  if (Array.isArray(valor)) return valor.slice(0, 100).map(item => sanitizarDadosDiagnostico(item, profundidade + 1));
  if (typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor as Record<string, unknown>).slice(0, 100).map(([chave, conteudo]) => [
      chave,
      chavesSensiveis.test(chave) ? '[redigido]' : sanitizarDadosDiagnostico(conteudo, profundidade + 1),
    ]));
  }
  return String(valor);
}

export class DiagnosticoEventosService {
  private sequencia = 0;
  private eventos: EventoDiagnostico[] = [];
  private filaPersistencia: Promise<void> = Promise.resolve();
  private operacoesPendentes = 0;

  constructor(private readonly caminhoEventos: string) {}

  async registrar(evento: Omit<EventoDiagnostico, 'sequencia' | 'timestamp' | 'dados'> & { dados?: Record<string, unknown> }): Promise<EventoDiagnostico> {
    const eventoPersistido = schemaEventoDiagnostico.parse({
      ...evento,
      sequencia: ++this.sequencia,
      timestamp: new Date().toISOString(),
      dados: sanitizarDadosDiagnostico(evento.dados ?? {}) as Record<string, unknown>,
    });
    const linha = `${JSON.stringify(eventoPersistido)}\n`;
    this.operacoesPendentes += 1;
    this.filaPersistencia = this.filaPersistencia.then(() => appendFile(this.caminhoEventos, linha, 'utf8')).finally(() => { this.operacoesPendentes -= 1; });
    await this.filaPersistencia;
    this.eventos.push(eventoPersistido);
    return eventoPersistido;
  }

  consultar(filtros: FiltrosEventosDiagnostico): { eventos: EventoDiagnostico[]; proximoCursor: number; truncado: boolean } {
    const eventosCompativeis = this.eventos.filter(evento => (
      evento.sequencia > filtros.depoisDe
      && (!filtros.categorias || filtros.categorias.includes(evento.categoria))
      && (!filtros.niveis || filtros.niveis.includes(evento.nivel))
      && (!filtros.origens || filtros.origens.includes(evento.origem))
      && (!filtros.janelaId || filtros.janelaId === evento.janelaId)
      && (!filtros.correlacaoId || filtros.correlacaoId === evento.correlacaoId)
    ));
    const eventos = eventosCompativeis.slice(0, filtros.limite);
    return {
      eventos,
      proximoCursor: eventos.at(-1)?.sequencia ?? filtros.depoisDe,
      truncado: eventosCompativeis.length > eventos.length,
    };
  }

  get ultimoCursor(): number {
    return this.sequencia;
  }

  get pendenciasPersistencia(): number {
    return this.operacoesPendentes;
  }

  static async lerNdjson(caminhoEventos: string): Promise<EventoDiagnostico[]> {
    let conteudo: string;
    try {
      conteudo = await readFile(caminhoEventos, 'utf8');
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw erro;
    }
    return conteudo.split('\n').flatMap(linha => {
      if (!linha.trim()) return [];
      try {
        const resultado = schemaEventoDiagnostico.safeParse(JSON.parse(linha));
        return resultado.success ? [resultado.data] : [];
      } catch {
        return [];
      }
    });
  }
}

async function tamanhoDiretorio(caminho: string): Promise<number> {
  const entradas = await readdir(caminho, { withFileTypes: true });
  const tamanhos = await Promise.all(entradas.map(async entrada => {
    const caminhoEntrada = path.join(caminho, entrada.name);
    return entrada.isDirectory() ? tamanhoDiretorio(caminhoEntrada) : (await stat(caminhoEntrada)).size;
  }));
  return tamanhos.reduce((total, tamanho) => total + tamanho, 0);
}

export async function limparSessoesDiagnostico(caminhoSessoes: string, sessionIdAtiva: string | null): Promise<void> {
  let diretorios;
  try {
    diretorios = (await readdir(caminhoSessoes, { withFileTypes: true })).filter(entrada => entrada.isDirectory());
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw erro;
  }
  const sessoes = await Promise.all(diretorios
    .filter(entrada => !sessionIdAtiva || !entrada.name.endsWith(`-${sessionIdAtiva}`))
    .map(async entrada => ({ caminho: path.join(caminhoSessoes, entrada.name), nome: entrada.name, tamanho: await tamanhoDiretorio(path.join(caminhoSessoes, entrada.name)) })));
  sessoes.sort((a, b) => a.nome.localeCompare(b.nome));
  let total = sessoes.reduce((soma, sessao) => soma + sessao.tamanho, 0);
  while (sessoes.length > 5 || total > 100 * 1024 * 1024) {
    const sessao = sessoes.shift();
    if (!sessao) break;
    await rm(sessao.caminho, { recursive: true, force: true });
    total -= sessao.tamanho;
  }
}
