import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const versaoSemVer =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const commitValido = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const hashValido = /^[0-9a-f]{64}$/;

const formatosPorPlataforma = {
  windows: new Set(['nsis']),
  linux: new Set(['AppImage', 'deb']),
  macos: new Set(['dmg', 'zip']),
};

function falhar(mensagem) {
  throw new Error(mensagem);
}

function objetoRegistro(valor, nome) {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    falhar(`${nome} deve ser um objeto.`);
  }

  return valor;
}

function textoObrigatorio(valor, nome) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    falhar(`${nome} deve ser um texto não vazio.`);
  }

  return valor.trim();
}

function urlHttps(valor, nome) {
  const texto = textoObrigatorio(valor, nome);

  try {
    const url = new URL(texto);
    if (url.protocol !== 'https:') {
      falhar(`${nome} deve usar HTTPS.`);
    }
  } catch {
    falhar(`${nome} deve ser uma URL válida.`);
  }

  return texto;
}

function inteiroNaoNegativo(valor, nome) {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    falhar(`${nome} deve ser um inteiro não negativo.`);
  }

  return valor;
}

function normalizarArtefato(valor) {
  const artefato = objetoRegistro(valor, 'artefato');
  const plataforma = textoObrigatorio(artefato.plataforma, 'artefato.plataforma');
  const arquitetura = textoObrigatorio(artefato.arquitetura, 'artefato.arquitetura');
  const formato = textoObrigatorio(artefato.formato, 'artefato.formato');

  if (arquitetura !== 'x64' && arquitetura !== 'arm64') {
    falhar('artefato.arquitetura deve ser x64 ou arm64.');
  }

  if (!formatosPorPlataforma[plataforma]?.has(formato)) {
    falhar(`artefato.formato não é suportado para ${plataforma}.`);
  }

  const hashSha256 = textoObrigatorio(artefato.hashSha256, 'artefato.hashSha256').toLowerCase();
  if (!hashValido.test(hashSha256)) {
    falhar('artefato.hashSha256 deve ter 64 caracteres hexadecimais.');
  }

  return {
    plataforma,
    arquitetura,
    formato,
    nome: textoObrigatorio(artefato.nome, 'artefato.nome'),
    tamanho: inteiroNaoNegativo(artefato.tamanho, 'artefato.tamanho'),
    hashSha256,
    url: urlHttps(artefato.url, 'artefato.url'),
  };
}

export function normalizarManifesto(valor) {
  const manifesto = objetoRegistro(valor, 'manifesto');
  const versao = textoObrigatorio(manifesto.versao, 'manifesto.versao');
  const commit = textoObrigatorio(manifesto.commit, 'manifesto.commit').toLowerCase();
  const canal = textoObrigatorio(manifesto.canal, 'manifesto.canal');
  const dataPublicacao = textoObrigatorio(manifesto.dataPublicacao, 'manifesto.dataPublicacao');

  if (!versaoSemVer.test(versao)) {
    falhar('manifesto.versao deve respeitar o formato SemVer.');
  }

  if (!commitValido.test(commit)) {
    falhar('manifesto.commit deve ser um SHA Git de 40 ou 64 caracteres hexadecimais.');
  }

  if (canal !== 'stable' && canal !== 'experimental') {
    falhar('manifesto.canal deve ser stable ou experimental.');
  }

  if (Number.isNaN(Date.parse(dataPublicacao))) {
    falhar('manifesto.dataPublicacao deve ser uma data ISO 8601 válida.');
  }

  if (typeof manifesto.requerBackupCompletoImagens !== 'boolean') {
    falhar('manifesto.requerBackupCompletoImagens deve ser booleano.');
  }

  if (!Array.isArray(manifesto.artefatos) || manifesto.artefatos.length === 0) {
    falhar('manifesto.artefatos deve conter ao menos um item.');
  }

  const artefatos = manifesto.artefatos.map(normalizarArtefato);
  const chaves = new Set();
  for (const artefato of artefatos) {
    const chave = `${artefato.plataforma}/${artefato.arquitetura}/${artefato.formato}`;
    if (chaves.has(chave)) {
      falhar(`manifesto.artefatos possui entrada duplicada para ${chave}.`);
    }
    chaves.add(chave);
  }

  return {
    versaoManifesto: 1,
    versao,
    commit,
    dataPublicacao: new Date(dataPublicacao).toISOString(),
    canal,
    versaoSchema: inteiroNaoNegativo(manifesto.versaoSchema, 'manifesto.versaoSchema'),
    requerBackupCompletoImagens: manifesto.requerBackupCompletoImagens,
    notas: textoObrigatorio(manifesto.notas, 'manifesto.notas'),
    artefatos: artefatos.sort((primeiro, segundo) => {
      const chavePrimeiro = `${primeiro.plataforma}/${primeiro.arquitetura}/${primeiro.formato}`;
      const chaveSegundo = `${segundo.plataforma}/${segundo.arquitetura}/${segundo.formato}`;
      return chavePrimeiro.localeCompare(chaveSegundo);
    }),
  };
}

export function serializarCanonico(valor) {
  if (Array.isArray(valor)) {
    return `[${valor.map(serializarCanonico).join(',')}]`;
  }

  if (typeof valor === 'object' && valor !== null) {
    return `{${Object.keys(valor)
      .sort()
      .map(chave => `${JSON.stringify(chave)}:${serializarCanonico(valor[chave])}`)
      .join(',')}}`;
  }

  if (typeof valor === 'number' && !Number.isFinite(valor)) {
    falhar('O conteúdo canônico não aceita números não finitos.');
  }

  if (typeof valor === 'undefined' || typeof valor === 'function' || typeof valor === 'symbol') {
    falhar('O conteúdo canônico contém um tipo não serializável.');
  }

  return JSON.stringify(valor);
}

function chaveEd25519(chave, tipo) {
  const chaveAssimetrica = tipo === 'privada' ? createPrivateKey(chave) : createPublicKey(chave);
  if (chaveAssimetrica.asymmetricKeyType !== 'ed25519') {
    falhar(`A chave ${tipo} deve usar Ed25519.`);
  }

  return chaveAssimetrica;
}

export function assinarManifesto(manifesto, chavePrivada) {
  const conteudo = Buffer.from(serializarCanonico(normalizarManifesto(manifesto)), 'utf8');
  return sign(null, conteudo, chaveEd25519(chavePrivada, 'privada')).toString('base64');
}

export function verificarManifesto(manifesto, assinaturaBase64, chavePublica) {
  if (typeof assinaturaBase64 !== 'string' || assinaturaBase64.trim() === '') {
    return false;
  }

  try {
    const conteudo = Buffer.from(serializarCanonico(normalizarManifesto(manifesto)), 'utf8');
    return verify(
      null,
      conteudo,
      chaveEd25519(chavePublica, 'pública'),
      Buffer.from(assinaturaBase64, 'base64')
    );
  } catch {
    return false;
  }
}

export async function calcularHashSha256(caminho) {
  const conteudo = await readFile(caminho);
  return createHash('sha256').update(conteudo).digest('hex');
}
