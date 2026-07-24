import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import {
  assinarManifesto,
  chavePublicaReleasePadrao,
  normalizarManifesto,
  serializarCanonico,
  verificarManifesto,
} from './manifesto.mjs';

function falhar(mensagem) {
  throw new Error(mensagem);
}

function obterArgumentos() {
  const valores = new Map();
  for (let indice = 2; indice < process.argv.length; indice += 2) {
    const nome = process.argv[indice];
    const valor = process.argv[indice + 1];
    if (!nome?.startsWith('--') || valor === undefined) falhar('Use pares no formato --nome valor.');
    valores.set(nome.slice(2), valor);
  }
  return valores;
}

function compararVersoes(primeira, segunda) {
  const partes = versao => versao.split(/[.+-]/).slice(0, 3).map(Number);
  const [a1, b1, c1] = partes(primeira);
  const [a2, b2, c2] = partes(segunda);
  return a1 - a2 || b1 - b2 || c1 - c2 || primeira.localeCompare(segunda);
}

async function listarManifestos(diretorio) {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  const encontrados = [];
  for (const entrada of entradas) {
    const caminho = join(diretorio, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...(await listarManifestos(caminho)));
    if (entrada.isFile() && entrada.name === 'manifesto.json') encontrados.push(caminho);
  }
  return encontrados;
}

async function estaSuspensa(caminhoManifesto) {
  try {
    await access(join(resolve(caminhoManifesto, '..'), '.suspensa'));
    return true;
  } catch {
    return false;
  }
}

async function executar() {
  const valores = obterArgumentos();
  const diretorio = resolve(valores.get('diretorio') ?? 'releases-publicadas');
  const saida = resolve(valores.get('saida') ?? 'feed');
  const chavePrivada = process.env.CHAVE_PRIVADA_ASSINATURA;
  if (!chavePrivada) falhar('Informe o secret CHAVE_PRIVADA_ASSINATURA.');

  const chavePublica = valores.has('chave-publica')
    ? await readFile(valores.get('chave-publica'), 'utf8')
    : chavePublicaReleasePadrao;
  const caminhosManifestos = await listarManifestos(diretorio);
  if (caminhosManifestos.length === 0) falhar('Nenhum manifesto publicado foi encontrado.');
  const manifestos = [];
  for (const caminhoManifesto of caminhosManifestos) {
    const diretorioManifesto = resolve(caminhoManifesto, '..');
    if (await estaSuspensa(caminhoManifesto)) continue;
    const manifesto = normalizarManifesto(JSON.parse(await readFile(caminhoManifesto, 'utf8')));
    const assinatura = (await readFile(join(diretorioManifesto, 'manifesto.json.sig'), 'utf8')).trim();
    if (!verificarManifesto(manifesto, assinatura, chavePublica)) {
      falhar(`Manifesto inválido: ${relative(diretorio, caminhoManifesto)}.`);
    }
    manifestos.push(manifesto);
  }
  const candidatos = new Map();
  for (const manifesto of manifestos) {
    for (const artefato of manifesto.artefatos) {
      const chave = `${artefato.canal}/${artefato.plataforma}-${artefato.arquitetura}`;
      const atual = candidatos.get(chave);
      if (!atual || compararVersoes(manifesto.versao, atual.versao) > 0) candidatos.set(chave, manifesto);
    }
  }

  for (const [chave, manifesto] of candidatos) {
    const [canal, destino] = chave.split('/');
    const [plataforma, arquitetura] = destino.split('-');
    const indice = normalizarManifesto({
      ...manifesto,
      canais: [canal],
      artefatos: manifesto.artefatos.filter(artefato =>
        artefato.canal === canal && artefato.plataforma === plataforma && artefato.arquitetura === arquitetura
      ),
    });
    const diretorioDestino = join(saida, canal);
    await mkdir(diretorioDestino, { recursive: true });
    const caminhoIndice = join(diretorioDestino, `${destino}.json`);
    await writeFile(caminhoIndice, `${serializarCanonico(indice)}\n`, 'utf8');
    await writeFile(`${caminhoIndice}.sig`, `${assinarManifesto(indice, chavePrivada)}\n`, 'utf8');
  }
  if (candidatos.size === 0) {
    await mkdir(saida, { recursive: true });
    await writeFile(join(saida, 'index.html'), '<!doctype html><title>Feed laWdo</title>\n', 'utf8');
  }
  process.stdout.write(`Feed gerado com ${candidatos.size} índice(s).\n`);
}

executar().catch(erro => {
  process.stderr.write(`${erro instanceof Error ? erro.message : 'Erro inesperado'}\n`);
  process.exitCode = 1;
});
