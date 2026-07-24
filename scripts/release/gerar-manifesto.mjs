import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';

import {
  assinarManifesto,
  calcularHashSha256,
  normalizarManifesto,
  serializarCanonico,
} from './manifesto.mjs';

function falhar(mensagem) {
  throw new Error(mensagem);
}

function obterArgumentos() {
  const argumentos = new Map();
  for (let indice = 2; indice < process.argv.length; indice += 2) {
    const nome = process.argv[indice];
    const valor = process.argv[indice + 1];
    if (!nome?.startsWith('--') || valor === undefined) {
      falhar('Use pares de argumentos no formato --nome valor.');
    }
    argumentos.set(nome.slice(2), valor);
  }
  return argumentos;
}

async function listarArquivos(diretorio) {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  const arquivos = await Promise.all(
    entradas.map(async entrada => {
      const caminho = join(diretorio, entrada.name);
      if (entrada.isDirectory()) {
        return listarArquivos(caminho);
      }
      return entrada.isFile() ? [caminho] : [];
    })
  );
  return arquivos.flat();
}

function identificarOrigem(caminho, diretorioArtefatos) {
  const [origem] = relative(diretorioArtefatos, caminho).split(/[\\/]/);
  const correspondencia = /^release-.+-(windows|linux|macos)-(x64|arm64)$/.exec(origem);
  if (!correspondencia) {
    falhar(`Não foi possível identificar plataforma e arquitetura em ${caminho}.`);
  }
  return { plataforma: correspondencia[1], arquitetura: correspondencia[2] };
}

function identificarFormato(caminho, plataforma) {
  const nome = basename(caminho);
  if (plataforma === 'windows' && nome.endsWith('.exe') && !caminho.includes('win-unpacked'))
    return 'nsis';
  if (plataforma === 'linux' && nome.endsWith('.AppImage')) return 'AppImage';
  if (plataforma === 'linux' && nome.endsWith('.deb')) return 'deb';
  if (plataforma === 'macos' && nome.endsWith('.dmg')) return 'dmg';
  if (plataforma === 'macos' && nome.endsWith('.zip')) return 'zip';
  return null;
}

function canalDaPlataforma(plataforma) {
  return plataforma === 'macos' ? 'experimental' : 'stable';
}

async function gerarManifesto() {
  const argumentos = obterArgumentos();
  const diretorioArtefatos = resolve(argumentos.get('diretorio') ?? 'artefatos');
  const saida = resolve(argumentos.get('saida') ?? 'publicacao/manifesto.json');
  const saidaAssinatura = resolve(argumentos.get('assinatura') ?? 'publicacao/manifesto.json.sig');
  const versao = argumentos.get('versao');
  const commit = argumentos.get('commit');
  const versaoSchema = Number(argumentos.get('versao-schema'));
  const urlRelease = argumentos.get('url-release');
  const chavePrivada = process.env.CHAVE_PRIVADA_ASSINATURA;
  const notas = process.env.NOTAS_ATUALIZACAO?.trim() ?? '';

  if (!versao || !commit || !urlRelease || !chavePrivada || !notas) {
    falhar('Informe --versao, --commit, --url-release, NOTAS_ATUALIZACAO e o secret CHAVE_PRIVADA_ASSINATURA.');
  }

  const arquivos = await listarArquivos(diretorioArtefatos);
  const artefatos = [];
  for (const caminho of arquivos) {
    const { plataforma, arquitetura } = identificarOrigem(caminho, diretorioArtefatos);
    const formato = identificarFormato(caminho, plataforma);
    if (!formato) continue;

    const nome = basename(caminho);
    const metadados = await stat(caminho);
    artefatos.push({
      plataforma,
      arquitetura,
      formato,
      canal: canalDaPlataforma(plataforma),
      nome,
      tamanho: metadados.size,
      hashSha256: await calcularHashSha256(caminho),
      url: `${urlRelease}/${encodeURIComponent(nome)}`,
    });
  }

  if (artefatos.length === 0) {
    falhar('Nenhum artefato público compatível foi encontrado.');
  }

  const nomes = new Set();
  for (const artefato of artefatos) {
    if (nomes.has(artefato.nome)) {
      falhar(`Nome de asset duplicado: ${artefato.nome}.`);
    }
    nomes.add(artefato.nome);
  }

  const canais = [...new Set(artefatos.map(artefato => artefato.canal))];
  const manifesto = normalizarManifesto({
    versao,
    commit,
    dataPublicacao: new Date().toISOString(),
    canais,
    versaoSchema,
    requerBackupCompletoImagens: false,
    notas,
    artefatos,
  });
  const assinatura = assinarManifesto(manifesto, chavePrivada);

  await mkdir(resolve(saida, '..'), { recursive: true });
  await writeFile(saida, `${serializarCanonico(manifesto)}\n`, 'utf8');
  await writeFile(saidaAssinatura, `${assinatura}\n`, 'utf8');
  process.stdout.write(`Manifesto gerado com ${artefatos.length} artefato(s).\n`);
}

gerarManifesto().catch(erro => {
  process.stderr.write(`${erro instanceof Error ? erro.message : 'Erro inesperado'}\n`);
  process.exitCode = 1;
});
