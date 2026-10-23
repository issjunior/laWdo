import path from 'node:path';
import { realpath, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const VERSAO_ROTEIRO = 1;
export const QUANTIDADE_IMAGENS_ADICIONAIS = 512;
export const CENARIOS = ['digitacao', 'texto', 'figuras', 'placeholders', 'encadeamento', 'saida'];
const CENARIOS_OPCIONAIS = ['atalho', 'resistencia'];
export const MASSAS = {
  controle: { secoes: 8, tabelas: 4, linhas: 12, colunas: 6, placeholders: 24, imagens: 0, largura: 800, altura: 600, qualidade: 65 },
  representativa: { secoes: 12, tabelas: 12, linhas: 20, colunas: 6, placeholders: 80, imagens: 12, largura: 800, altura: 600, qualidade: 65 },
  estresse: { secoes: 24, tabelas: 40, linhas: 40, colunas: 8, placeholders: 200, imagens: 40, largura: 1024, altura: 768, qualidade: 45 },
};

export function interpretarArgumentos(argumentos) {
  const opcoes = { perfil: 'rapido', massa: null, semente: 22102026, repeticoes: 3, cenario: null, comparar: null, trace: false, semBuild: false };
  for (let indice = 0; indice < argumentos.length; indice++) {
    const nome = argumentos[indice];
    if (nome === '--trace') { opcoes.trace = true; continue; }
    if (nome === '--sem-build') { opcoes.semBuild = true; continue; }
    if (nome === '--ajuda') return { ...opcoes, ajuda: true };
    if (!['--perfil', '--massa', '--semente', '--repeticoes', '--cenario', '--comparar'].includes(nome)) throw new Error(`Opção desconhecida: ${nome}`);
    const valor = argumentos[++indice];
    if (!valor || valor.startsWith('--')) throw new Error(`Valor ausente para ${nome}`);
    if (nome === '--perfil') opcoes.perfil = valor;
    if (nome === '--massa') opcoes.massa = valor;
    if (nome === '--cenario') opcoes.cenario = valor;
    if (nome === '--comparar') opcoes.comparar = path.resolve(valor);
    if (nome === '--semente') opcoes.semente = Number(valor);
    if (nome === '--repeticoes') opcoes.repeticoes = Number(valor);
  }
  if (!['rapido', 'estresse'].includes(opcoes.perfil)) throw new Error('Perfil deve ser rapido ou estresse.');
  if (opcoes.massa && (!Object.hasOwn(MASSAS, opcoes.massa) || opcoes.perfil === 'rapido' && opcoes.massa !== 'representativa')) throw new Error('Massa incompatível com o perfil selecionado.');
  if (opcoes.cenario === 'resistencia' && (opcoes.perfil !== 'estresse' || opcoes.massa && opcoes.massa !== 'estresse')) throw new Error('Resistência requer perfil estresse e a massa estresse.');
  if (!Number.isSafeInteger(opcoes.semente) || opcoes.semente < 0 || opcoes.semente > 0xffffffff) throw new Error('Semente deve ser um inteiro entre 0 e 4294967295.');
  if (!Number.isInteger(opcoes.repeticoes) || opcoes.repeticoes < 1 || opcoes.repeticoes > 10) throw new Error('Repetições devem estar entre 1 e 10.');
  if (opcoes.cenario && ![...CENARIOS, ...CENARIOS_OPCIONAIS].includes(opcoes.cenario)) throw new Error(`Cenário inválido. Use: ${[...CENARIOS, ...CENARIOS_OPCIONAIS].join(', ')}`);
  return opcoes;
}

export function criarAleatorio(semente) {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6D2B79F5) >>> 0;
    let valor = Math.imul(estado ^ estado >>> 15, 1 | estado);
    valor ^= valor + Math.imul(valor ^ valor >>> 7, 61 | valor);
    return ((valor ^ valor >>> 14) >>> 0) / 4294967296;
  };
}

export function hash(valor) { return createHash('sha256').update(valor).digest('hex'); }

export async function validarIsolamento(workspace, diretorio) {
  const raiz = await realpath(path.join(workspace, 'tmp', 'teste-carga'));
  const absoluto = await realpath(diretorio);
  const relativo = path.relative(raiz, absoluto);
  if (!relativo || relativo === '..' || relativo.startsWith(`..${path.sep}`) || path.isAbsolute(relativo)) throw new Error('Diretório fora da raiz de testes de carga.');
  const marcador = JSON.parse(await readFile(path.join(absoluto, 'isolamento.json'), 'utf8'));
  if (marcador.finalidade !== 'teste-carga' || marcador.versao !== 1) throw new Error('Marcador de isolamento inválido.');
  return absoluto;
}

export function estatisticas(valores) {
  const ordenados = valores.filter(Number.isFinite).sort((a, b) => a - b);
  const percentil = percentual => ordenados.length ? ordenados[Math.ceil((ordenados.length - 1) * percentual)] : null;
  return { quantidade: ordenados.length, mediana: percentil(0.5), p95: percentil(0.95), maximo: percentil(1) };
}

export function compararResultados(anterior, atual) {
  if (!anterior || typeof anterior !== 'object' || !Array.isArray(anterior.casos) || !anterior.contexto
    || anterior.casos.some(caso => !caso || typeof caso !== 'object' || typeof caso.chave !== 'string')) {
    return { compativel: false, incompatibilidades: ['formato_referencia'], deltas: [] };
  }
  const campos = ['versaoRoteiro', 'semente', 'repeticoes', 'perfil', 'massa', 'cenario', 'maquina', 'instrumentacao', 'massasHash', 'trace'];
  const incompatibilidades = campos.filter(campo => JSON.stringify(anterior.contexto?.[campo]) !== JSON.stringify(atual.contexto?.[campo]) || atual.contexto?.[campo] === undefined);
  if (JSON.stringify(anterior.casos?.map(caso => caso.chave)) !== JSON.stringify(atual.casos?.map(caso => caso.chave))) incompatibilidades.push('casos');
  if ([anterior, atual].some(resultado => resultado.casos?.some(caso => caso.estado !== 'concluido' || caso.metricas?.coletaIncompleta || caso.metricas?.amostrasOcultas || caso.metricas?.amostrasSemFoco || caso.lacunas?.length))) incompatibilidades.push('coleta_incompleta');
  if (incompatibilidades.length) return { compativel: false, incompatibilidades, deltas: [] };
  const deltas = atual.casos.map(caso => {
    const referencia = anterior.casos.find(item => item.chave === caso.chave && item.estado === 'concluido');
    const antes = referencia?.metricas?.entradaFrame?.p95;
    const depois = caso.metricas?.entradaFrame?.p95;
    const processos = (caso.processos ?? []).map(processo => {
      const previo = referencia?.processos?.find(item => item.papel === processo.papel);
      return { papel: processo.papel,
        cpuP95: typeof previo?.cpu?.p95 === 'number' && typeof processo.cpu?.p95 === 'number' ? processo.cpu.p95 - previo.cpu.p95 : null,
        memoriaP95Kb: typeof previo?.memoriaKb?.p95 === 'number' && typeof processo.memoriaKb?.p95 === 'number' ? processo.memoriaKb.p95 - previo.memoriaKb.p95 : null };
    });
    return { chave: caso.chave, entradaFrameP95Ms: typeof antes === 'number' && typeof depois === 'number' ? depois - antes : null, processos };
  });
  return { compativel: true, incompatibilidades: [], deltas };
}
