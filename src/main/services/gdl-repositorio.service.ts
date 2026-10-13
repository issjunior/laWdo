import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { z } from 'zod';
import { identificarNaturezaExame } from '../../shared/gdl/natureza-exame.js';
import type { DetalhesRepGdl } from '../../shared/gdl/natureza-exame.js';
import type { MinhaRepGdl, SnapshotMinhasRepsGdl } from '../../shared/types/gdl-minhas-reps.types.js';

const campo = z.object({ estado: z.enum(['ausente', 'vazio', 'presente']), valor: z.string() });
const detalhe = z.object({ natureza: z.string().nullable(), quesito: campo, dataSolicitacao: campo });
const grade = z.object({ idGdl: z.number().int().positive(), numero: z.string(), ano: z.string(), naturezaExame: z.string(),
  naturezaExameComCodigo: z.string().nullable(), status: z.enum(['Aberta e Distribuída', 'Laudo em Execução', 'Concluída e Não Remetida']),
  dataDesignacao: z.string().nullable(), quantidadeFotos: z.number().nullable() });
const registro = z.object({ idGdl: z.number().int().positive(), numero: z.string(), ano: z.string(),
  acessoDetalhesEm: z.string().datetime().optional(),
  ultimosDetalhesReconhecidos: z.object({
    natureza: z.object({ consultadoEm: z.string().datetime(), valor: z.string() }).optional(),
    quesito: z.object({ consultadoEm: z.string().datetime(), dados: campo }).optional(),
    dataSolicitacao: z.object({ consultadoEm: z.string().datetime(), dados: campo }).optional(),
  }).optional(),
  grade: z.object({ consultadoEm: z.string().datetime(), dados: grade }).optional(),
  api: z.object({ consultadoEm: z.string().datetime(), natureza: z.string().nullable(), status: z.string().nullable(), dados: z.unknown() }).optional(),
  detalhes: z.object({ consultadoEm: z.string().datetime(), dados: detalhe }).optional(),
});
const esquema = z.object({ versao: z.literal(1), registros: z.array(registro), listagem: z.object({ ids: z.array(z.number()), atualizadoEm: z.string().datetime() }).optional() });
type Repositorio = z.infer<typeof esquema>;
const filas = new Map<string, Promise<unknown>>();

function arquivoRepositorio(usuarioId: string, identidade: string): string {
  const chave = createHash('sha256').update(JSON.stringify({ usuarioId, identidade })).digest('hex');
  return path.join(app.getPath('userData'), 'gdl', `reps-${chave}.json`);
}
async function ler(arquivo: string, paraGravar = false): Promise<Repositorio> {
  try { const valor: unknown = JSON.parse(await readFile(arquivo, 'utf8')); return esquema.parse(valor); }
  catch (erro: unknown) {
    const inexistente = erro instanceof Error && 'code' in erro && erro.code === 'ENOENT';
    if (paraGravar && !inexistente) throw new Error('O repositório local não pôde ser validado; o arquivo anterior foi preservado.');
    return { versao: 1, registros: [] };
  }
}
async function alterar(usuarioId: string, identidade: string, operacao: (repositorio: Repositorio) => void, validarAntesDeSalvar?: () => Promise<void>): Promise<void> {
  const arquivo = arquivoRepositorio(usuarioId, identidade);
  const anterior = filas.get(arquivo) ?? Promise.resolve();
  const proxima = anterior.catch(() => undefined).then(async () => {
    const repositorio = await ler(arquivo, true);
    operacao(repositorio);
    const validado = esquema.parse(repositorio);
    await mkdir(path.dirname(arquivo), { recursive: true });
    const temporario = `${arquivo}.${randomUUID()}.tmp`;
    try { await writeFile(temporario, JSON.stringify(validado), 'utf8'); await validarAntesDeSalvar?.(); await rename(temporario, arquivo); }
    finally { await rm(temporario, { force: true }); }
  });
  filas.set(arquivo, proxima);
  try { await proxima; } finally { if (filas.get(arquivo) === proxima) filas.delete(arquivo); }
}
function obterRegistro(repositorio: Repositorio, idGdl: number, numero: string, ano: string) {
  const existente = repositorio.registros.find(item => item.idGdl === idGdl);
  if (existente && (existente.numero !== numero || existente.ano !== ano)) throw new Error('Identidade da REP divergente no repositório local.');
  if (existente) return existente;
  const novo: z.infer<typeof registro> = { idGdl, numero, ano };
  repositorio.registros.push(novo);
  return novo;
}
export async function registrarGradeGdl(usuarioId: string, identidade: string, snapshot: SnapshotMinhasRepsGdl, validarAntesDeSalvar?: () => Promise<void>): Promise<void> {
  await alterar(usuarioId, identidade, repositorio => {
    for (const rep of snapshot.reps) obterRegistro(repositorio, rep.idGdl, rep.numero, rep.ano).grade = { consultadoEm: snapshot.atualizadoEm, dados: rep };
    repositorio.listagem = { ids: snapshot.reps.map(rep => rep.idGdl), atualizadoEm: snapshot.atualizadoEm };
  }, validarAntesDeSalvar);
}
export async function registrarConsultaRepositorioGdl(usuarioId: string, identidade: string, idGdl: number, numero: string, ano: string,
  observacao: { fonte: 'api'; natureza: string | null; status: string | null; dados: unknown } | { fonte: 'detalhes'; dados: DetalhesRepGdl } | { fonte: 'acesso_detalhes' }, validarAntesDeSalvar?: () => Promise<void>): Promise<void> {
  await alterar(usuarioId, identidade, repositorio => {
    const rep = obterRegistro(repositorio, idGdl, numero, ano);
    const consultadoEm = new Date().toISOString();
    if (observacao.fonte === 'api') rep.api = { consultadoEm, natureza: observacao.natureza, status: observacao.status, dados: observacao.dados };
    else if (observacao.fonte === 'detalhes') {
      const anterior = rep.detalhes;
      const ultimos = rep.ultimosDetalhesReconhecidos ?? {};
      if (observacao.dados.natureza) ultimos.natureza = { consultadoEm, valor: observacao.dados.natureza };
      else if (!ultimos.natureza && anterior?.dados.natureza) ultimos.natureza = { consultadoEm: anterior.consultadoEm, valor: anterior.dados.natureza };
      for (const nome of ['quesito', 'dataSolicitacao'] as const) {
        if (observacao.dados[nome].estado !== 'ausente') ultimos[nome] = { consultadoEm, dados: observacao.dados[nome] };
        else if (!ultimos[nome] && anterior && anterior.dados[nome].estado !== 'ausente') ultimos[nome] = { consultadoEm: anterior.consultadoEm, dados: anterior.dados[nome] };
      }
      rep.ultimosDetalhesReconhecidos = ultimos;
      rep.detalhes = { consultadoEm, dados: observacao.dados };
    }
    else rep.acessoDetalhesEm = consultadoEm;
  }, validarAntesDeSalvar);
}
export async function obterRepRepositorioGdl(usuarioId: string, identidade: string, idGdl: number, numero: string, ano: string) {
  const arquivo = arquivoRepositorio(usuarioId, identidade);
  await filas.get(arquivo)?.catch(() => undefined);
  const rep = (await ler(arquivo)).registros.find(item => item.idGdl === idGdl && item.numero === numero && item.ano === ano);
  return rep ?? null;
}
export async function obterListaRepositorioGdl(usuarioId: string, identidade: string): Promise<SnapshotMinhasRepsGdl | null> {
  const arquivo = arquivoRepositorio(usuarioId, identidade);
  await filas.get(arquivo)?.catch(() => undefined);
  const repositorio = await ler(arquivo);
  if (!repositorio.listagem) return null;
  const reps: MinhaRepGdl[] = repositorio.listagem.ids.flatMap(id => {
    const rep = repositorio.registros.find(item => item.idGdl === id);
    if (!rep?.grade) return [];
    const naturezaGrade = identificarNaturezaExame(rep.grade.dados.naturezaExame);
    const naturezaDetalhes = rep.ultimosDetalhesReconhecidos?.natureza?.valor ?? rep.detalhes?.dados.natureza;
    const horarioNatureza = rep.ultimosDetalhesReconhecidos?.natureza?.consultadoEm ?? rep.detalhes?.consultadoEm;
    const naturezaApi = rep.api?.natureza;
    const observacaoExplicita = naturezaDetalhes && (!rep.api || (horarioNatureza && horarioNatureza >= rep.api.consultadoEm))
      ? naturezaDetalhes : naturezaApi && identificarNaturezaExame(naturezaApi).codigoExplicito ? naturezaApi : naturezaDetalhes;
    const identificacao = observacaoExplicita ? identificarNaturezaExame(observacaoExplicita) : naturezaGrade;
    const codigo = identificacao.codigoExplicito ?? identificacao.codigoSugerido;
    const compativel = !codigo || (naturezaGrade.codigoExplicito ? naturezaGrade.codigoExplicito === codigo : naturezaGrade.candidatos.some(item => item.codigo === codigo));
    const posterior = rep.grade.consultadoEm > (horarioNatureza ?? rep.api?.consultadoEm ?? '');
    const divergente = Boolean(observacaoExplicita && posterior && !compativel);
    const natureza = divergente ? naturezaGrade : identificacao;
    const candidata = natureza.candidatos.find(item => item.codigo === natureza.codigoSugerido);
    return [{ ...rep.grade.dados, naturezaExameComCodigo: divergente ? null : observacaoExplicita ?? (candidata ? `${candidata.codigo} - ${candidata.descricao}` : null),
      naturezaConfirmada: Boolean(observacaoExplicita && !divergente), naturezaDivergente: divergente,
      naturezaConsultadaEm: horarioNatureza ?? rep.api?.consultadoEm,
      statusNecessitaAtualizacao: Boolean((rep.acessoDetalhesEm && rep.acessoDetalhesEm > rep.grade.consultadoEm) || (rep.detalhes && rep.detalhes.consultadoEm > rep.grade.consultadoEm)) }];
  });
  return { reps, atualizadoEm: repositorio.listagem.atualizadoEm };
}
