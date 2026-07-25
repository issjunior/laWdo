import { readFile } from 'node:fs/promises';

import { normalizarManifesto, verificarManifesto, chavePublicaReleasePadrao } from './manifesto.mjs';

function falhar(mensagem) {
  throw new Error(mensagem);
}

function argumentos() {
  const valores = new Map();
  for (let indice = 2; indice < process.argv.length; indice += 2) {
    const nome = process.argv[indice];
    const valor = process.argv[indice + 1];
    if (!nome?.startsWith('--') || valor === undefined) falhar('Use pares no formato --nome valor.');
    valores.set(nome.slice(2), valor);
  }
  return valores;
}

function validarNotas(notas, versao) {
  const notasNormalizadas = notas.replace(/\r\n?/g, '\n');
  const secoes = [...notasNormalizadas.matchAll(/^## (.+)$/gm)].map(([, secao]) => secao);
  if (!notasNormalizadas.startsWith(`# laWdo v${versao}\n`)) falhar('As notas devem iniciar com o título da versão promovida.');
  if (/\bPENDENTE\b/i.test(notasNormalizadas)) falhar('As notas ainda possuem placeholders pendentes.');
  if (secoes.length !== 2 || secoes[0] !== 'Alterações' || secoes[1] !== 'Correções') {
    falhar('As notas devem conter somente as seções Alterações e Correções.');
  }
}

function urlsDoAssetConferem(artefato, asset) {
  const urlAsset = asset.browser_download_url ?? asset.url;
  if (typeof urlAsset !== 'string') return false;
  if (urlAsset === artefato.url) return true;

  try {
    const urlEsperada = new URL(artefato.url);
    const urlTemporaria = new URL(urlAsset);
    const partesEsperadas = urlEsperada.pathname.split('/');
    const partesTemporarias = urlTemporaria.pathname.split('/');
    const indiceTag = partesEsperadas.length - 2;

    return (
      urlEsperada.origin === urlTemporaria.origin &&
      partesEsperadas.length === partesTemporarias.length &&
      partesEsperadas.at(-1) === artefato.nome &&
      partesTemporarias.at(-1) === artefato.nome &&
      partesEsperadas.slice(0, indiceTag).every((parte, indice) => parte === partesTemporarias[indice]) &&
      /^untagged-[0-9a-f]+$/.test(partesTemporarias[indiceTag])
    );
  } catch {
    return false;
  }
}

async function executar() {
  const valores = argumentos();
  const caminhoManifesto = valores.get('manifesto');
  const caminhoAssinatura = valores.get('assinatura');
  const caminhoNotas = valores.get('notas');
  const caminhoAssets = valores.get('assets');
  const versao = valores.get('versao');
  if (!caminhoManifesto || !caminhoAssinatura || !caminhoNotas || !caminhoAssets || !versao) {
    falhar('Informe --manifesto, --assinatura, --notas, --assets e --versao.');
  }

  const manifesto = normalizarManifesto(JSON.parse(await readFile(caminhoManifesto, 'utf8')));
  const assinatura = (await readFile(caminhoAssinatura, 'utf8')).trim();
  if (manifesto.versao !== versao) falhar('A versão do manifesto diverge da versão solicitada.');
  const chavePublica = valores.has('chave-publica')
    ? await readFile(valores.get('chave-publica'), 'utf8')
    : chavePublicaReleasePadrao;
  if (!verificarManifesto(manifesto, assinatura, chavePublica)) falhar('A assinatura do manifesto é inválida.');

  const assets = JSON.parse(await readFile(caminhoAssets, 'utf8'));
  if (!Array.isArray(assets)) falhar('A lista de assets deve ser um array.');
  const porNome = new Map(assets.map(asset => [asset.name, asset]));
  if (porNome.size !== assets.length) falhar('A release contém nomes de assets duplicados.');
  if (porNome.size !== manifesto.artefatos.length) falhar('A release deve conter somente os instaladores do manifesto.');
  for (const artefato of manifesto.artefatos) {
    const asset = porNome.get(artefato.nome);
    if (!asset || asset.size !== artefato.tamanho || !urlsDoAssetConferem(artefato, asset)) {
      falhar(`O asset ${artefato.nome} diverge do manifesto.`);
    }
  }
  validarNotas(await readFile(caminhoNotas, 'utf8'), versao);
  process.stdout.write(`Rascunho v${versao} validado.\n`);
}

executar().catch(erro => {
  process.stderr.write(`${erro instanceof Error ? erro.message : 'Erro inesperado'}\n`);
  process.exitCode = 1;
});
