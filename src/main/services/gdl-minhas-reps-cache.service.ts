import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { z } from 'zod';
import * as gdlService from './gdl.service.js';
import type { MinhaRepGdl, SnapshotMinhasRepsGdl } from '../../shared/types/gdl-minhas-reps.types.js';

const VALIDADE_MS = 10 * 60 * 1000;
const esquemaRep = z.object({
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

async function contexto(usuarioId: string): Promise<{ chave: string; arquivo: string }> {
  const identidadeGdl = await gdlService.obterIdentidadeMinhasReps();
  const chave = createHash('sha256').update(JSON.stringify({ usuarioId, identidadeGdl })).digest('hex');
  return { chave, arquivo: path.join(app.getPath('userData'), 'gdl', `minhas-reps-${chave}.json`) };
}

async function lerSnapshot(arquivo: string): Promise<SnapshotMinhasRepsGdl | null> {
  try {
    const conteudo: unknown = JSON.parse(await readFile(arquivo, 'utf8'));
    return esquemaSnapshot.safeParse(conteudo).data ?? null;
  } catch (erro: unknown) {
    if (erro instanceof Error && 'code' in erro && erro.code === 'ENOENT') return null;
    return null;
  }
}

async function salvarSnapshot(arquivo: string, snapshot: SnapshotMinhasRepsGdl): Promise<void> {
  await mkdir(path.dirname(arquivo), { recursive: true });
  const temporario = `${arquivo}.${randomUUID()}.tmp`;
  await writeFile(temporario, JSON.stringify(snapshot), 'utf8');
  await rename(temporario, arquivo);
}

async function consultarTodas(): Promise<SnapshotMinhasRepsGdl> {
  const reps: MinhaRepGdl[] = [];
  const paginasVistas = new Set<string>();
  let listagemId: string | null = null;
  for (let pagina = 1; pagina <= 500; pagina += 1) {
    const resposta = await gdlService.listarMinhasReps(pagina);
    if (resposta.paginaAtual !== pagina || (listagemId && resposta.listagemId !== listagemId)) {
      throw new Error('A paginação do GDL mudou durante a consulta.');
    }
    listagemId = resposta.listagemId;
    const assinatura = resposta.reps.map(rep => `${rep.idGdl}`).join('|');
    if (paginasVistas.has(assinatura)) throw new Error('A paginação do GDL se repetiu.');
    paginasVistas.add(assinatura);
    reps.push(...resposta.reps);
    if (!resposta.temProxima) {
      if (reps.length > 0) {
        const naturezas = await gdlService.consultarNaturezasMinhasReps(listagemId);
        const porId = new Map(naturezas.map(item => [item.idGdl, item.naturezaExameComCodigo]));
        if (porId.size !== reps.length || reps.some(rep => !porId.has(rep.idGdl))) {
          throw new Error('Os códigos de exame não correspondem à listagem atual.');
        }
        for (const rep of reps) rep.naturezaExameComCodigo = porId.get(rep.idGdl) ?? null;
      }
      const snapshot = { reps, atualizadoEm: new Date().toISOString() };
      return esquemaSnapshot.parse(snapshot);
    }
  }
  throw new Error('A listagem do GDL excedeu o limite de páginas.');
}

export async function obterMinhasRepsEmCache(usuarioId: string): Promise<SnapshotMinhasRepsGdl | null> {
  const { arquivo } = await contexto(usuarioId);
  return lerSnapshot(arquivo);
}

export async function atualizarMinhasRepsEmCache(usuarioId: string, forcar: boolean): Promise<SnapshotMinhasRepsGdl> {
  const { chave, arquivo } = await contexto(usuarioId);
  const ativa = consultas.get(chave);
  if (ativa) return ativa;
  const consulta = (async () => {
    const anterior = await lerSnapshot(arquivo);
    if (!forcar && anterior && Date.now() - Date.parse(anterior.atualizadoEm) < VALIDADE_MS) return anterior;
    const proxima = fila.then(async () => {
      const snapshot = await consultarTodas();
      if ((await contexto(usuarioId)).chave !== chave) throw new Error('A configuração do GDL mudou durante a consulta.');
      await salvarSnapshot(arquivo, snapshot);
      return snapshot;
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
