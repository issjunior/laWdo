import { notificarListaGdlAtualizada } from './gdl-agendamento-eventos.service.js';
import { obterListaRepositorioGdl, registrarGradeGdl } from './gdl-repositorio.service.js';
import { identificarNaturezaExame } from '../../shared/gdl/natureza-exame.js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { z } from 'zod';
import * as gdlService from './gdl.service.js';
import { exigirListagemRepsGdlHabilitada, obterVersaoPreferenciaListagem } from './gdl-listagem-preferencia.service.js';
import type { MinhaRepGdl, SnapshotMinhasRepsGdl } from '../../shared/types/gdl-minhas-reps.types.js';
import { VALIDADE_CACHE_LISTAGEM_MS } from '../../shared/gdl/listagem.js';

const esquemaRep = z.object({
  oficioReiterando: z.boolean().optional(),
  idGdl: z.number().int().positive(),
  numero: z.string().regex(/^\d+$/),
  ano: z.string().regex(/^\d{4}$/),
  naturezaExame: z.string().min(1),
  naturezaExameComCodigo: z.string().min(1).nullable(),
  status: z.enum(['Aberta e Distribuída', 'Laudo em Execução', 'Concluída e Não Remetida']),
  dataDesignacao: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(),
  quantidadeFotos: z.number().int().nonnegative().nullable(),
});
const esquemaSnapshot = z.object({ reps: z.array(esquemaRep), atualizadoEm: z.string().datetime() });
const consultas = new Map<string, Promise<SnapshotMinhasRepsGdl>>();
let fila: Promise<unknown> = Promise.resolve();

async function contexto(usuarioId: string): Promise<{ chave: string; identidadeGdl: string; arquivo: string }> {
  const identidadeGdl = await gdlService.obterIdentidadeMinhasReps();
  const chave = createHash('sha256').update(JSON.stringify({ usuarioId, identidadeGdl })).digest('hex');
  return { chave, identidadeGdl, arquivo: path.join(app.getPath('userData'), 'gdl', `minhas-reps-${chave}.json`) };
}

function normalizarNaturezaRep(rep: MinhaRepGdl): MinhaRepGdl {
  const identificacao = identificarNaturezaExame(rep.naturezaExame);
  const candidata = identificacao.candidatos.find(item => item.codigo === identificacao.codigoSugerido);
  return { ...rep, naturezaExameComCodigo: candidata ? `${candidata.codigo} - ${candidata.descricao}` : null };
}

async function lerSnapshot(arquivo: string): Promise<SnapshotMinhasRepsGdl | null> {
  try {
    const conteudo: unknown = JSON.parse(await readFile(arquivo, 'utf8'));
    const snapshot = esquemaSnapshot.safeParse(conteudo).data;
    if (!snapshot) return null;
    snapshot.reps = snapshot.reps.map(normalizarNaturezaRep);
    return snapshot;
  } catch (erro: unknown) {
    if (erro instanceof Error && 'code' in erro && erro.code === 'ENOENT') return null;
    return null;
  }
}


async function consultarTodas(versao: number, validar: () => Promise<void>): Promise<SnapshotMinhasRepsGdl> {
  const reps: MinhaRepGdl[] = [];
  const paginasVistas = new Set<string>();
  let listagemId: string | null = null;
  for (let pagina = 1; pagina <= 500; pagina += 1) {
    await exigirListagemRepsGdlHabilitada(versao);
    await validar();
    const resposta = await gdlService.listarMinhasReps(pagina);
    await exigirListagemRepsGdlHabilitada(versao);
    if (resposta.paginaAtual !== pagina || (listagemId && resposta.listagemId !== listagemId)) {
      throw new Error('A paginação do GDL mudou durante a consulta.');
    }
    listagemId = resposta.listagemId;
    const assinatura = resposta.reps.map(rep => `${rep.idGdl}`).join('|');
    if (paginasVistas.has(assinatura)) throw new Error('A paginação do GDL se repetiu.');
    paginasVistas.add(assinatura);
    reps.push(...resposta.reps);
    if (!resposta.temProxima) {
      const snapshot = { reps: reps.map(normalizarNaturezaRep), atualizadoEm: new Date().toISOString() };
      return esquemaSnapshot.parse(snapshot);
    }
  }
  throw new Error('A listagem do GDL excedeu o limite de páginas.');
}

export async function obterMinhasRepsEmCache(usuarioId: string): Promise<SnapshotMinhasRepsGdl | null> {
  const { arquivo, identidadeGdl } = await contexto(usuarioId);
  const atual = await obterListaRepositorioGdl(usuarioId, identidadeGdl);
  if (atual) return atual;
  const anterior = await lerSnapshot(arquivo);
  if (anterior) await registrarGradeGdl(usuarioId, identidadeGdl, anterior);
  return anterior ? obterListaRepositorioGdl(usuarioId, identidadeGdl) : null;
}

export async function atualizarMinhasRepsEmCache(usuarioId: string, forcar: boolean, validar: () => Promise<void> = async () => undefined): Promise<SnapshotMinhasRepsGdl> {
  await exigirListagemRepsGdlHabilitada();
  const versao = obterVersaoPreferenciaListagem();
  const { chave, identidadeGdl } = await contexto(usuarioId);
  const ativa = consultas.get(chave);
  if (ativa) return ativa;
  const consulta = (async () => {
    const anterior = await obterMinhasRepsEmCache(usuarioId);
    if (!forcar && anterior && Date.now() - Date.parse(anterior.atualizadoEm) < VALIDADE_CACHE_LISTAGEM_MS) {
      await exigirListagemRepsGdlHabilitada(versao);
      return anterior;
    }
    const proxima = fila.then(async () => {
      await exigirListagemRepsGdlHabilitada(versao);
      const snapshot = await consultarTodas(versao, validar);
      await validar();
      if ((await contexto(usuarioId)).chave !== chave) throw new Error('A configuração do GDL mudou durante a consulta.');
      await exigirListagemRepsGdlHabilitada(versao);
      await registrarGradeGdl(usuarioId, identidadeGdl, snapshot, async () => {
        await validar();
        await exigirListagemRepsGdlHabilitada(versao);
        if ((await contexto(usuarioId)).chave !== chave) throw new Error('A configuração do GDL mudou durante a consulta.');
      });
      await exigirListagemRepsGdlHabilitada(versao);
      notificarListaGdlAtualizada(usuarioId, identidadeGdl);
      return (await obterListaRepositorioGdl(usuarioId, identidadeGdl)) ?? snapshot;
    });
    fila = proxima.catch(() => undefined);
    return proxima;
  })();
  consultas.set(chave, consulta);
  try {
    return await consulta;
  } finally {
    if (consultas.get(chave) === consulta) consultas.delete(chave);
  }
}
