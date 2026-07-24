import { access, copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
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

function paginaInicial() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="laWdo reduz retrabalho administrativo na elaboração de laudos periciais.">
  <title>laWdo — elaboração de laudos periciais</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #08131d; color: #edf5fb; }
    * { box-sizing: border-box; } body { margin: 0; min-width: 320px; background: radial-gradient(circle at 10% 8%, #1a5367 0, transparent 28rem), #08131d; }
    main { width: min(1050px, calc(100% - 40px)); min-height: 100svh; margin: auto; display: grid; grid-template-rows: auto 1fr auto; }
    header { display: flex; align-items: center; gap: 13px; padding: 20px 0; } header img { width: 52px; height: 52px; object-fit: contain; } .marca { font-weight: 800; font-size: 1.35rem; letter-spacing: -.05em; } .marca span { color: #63d6cb; }
    .conteudo { display: grid; grid-template-columns: 1.08fr .92fr; gap: 34px; align-items: center; padding: 24px 0; } .rotulo { color: #6ee4d7; font-size: .72rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
    h1 { font-size: clamp(2.5rem, 5vw, 4.65rem); line-height: .98; letter-spacing: -.07em; margin: 13px 0 18px; } .introducao { max-width: 600px; margin: 0; color: #b8ccd9; font-size: clamp(1rem, 1.7vw, 1.16rem); line-height: 1.58; }
    .painel { display: grid; gap: 12px; } article { border: 1px solid #29485b; background: rgba(11, 31, 45, .78); border-radius: 15px; padding: 20px; } article.proposta { background: linear-gradient(145deg, #124c55, #13324a); border-color: #28616a; } h2 { margin: 0 0 8px; font-size: 1.05rem; } p { margin: 0; color: #afc3d1; line-height: 1.5; } ul { margin: 13px 0 0; padding-left: 18px; color: #d5e3eb; line-height: 1.58; } footer { border-top: 1px solid #203b4d; padding: 18px 0 24px; color: #7f9aab; font-size: .82rem; }
    @media (max-width: 720px) { main { width: min(100% - 28px, 1050px); } .conteudo { grid-template-columns: 1fr; align-content: center; gap: 20px; padding: 22px 0 30px; } h1 { font-size: 3rem; } }
  </style>
</head>
<body>
  <main>
    <header><img src="logo.png" alt="Logo do laWdo"><div class="marca">la<span>W</span>do</div></header>
    <section class="conteudo">
      <div><div class="rotulo">Elaboração de laudos periciais</div><h1>Menos retrabalho.<br>Mais perícia.</h1><p class="introducao">O laWdo organiza dados administrativos para reduzir digitação repetitiva, conferências manuais e erros que afastam o perito da análise técnica.</p></div>
      <div class="painel">
        <article><h2>O desafio</h2><p>Ofícios, REPs e referências internas circulam por documentos diferentes, exigindo cópias e novas conferências.</p><ul><li>Menos erro humano de digitação.</li><li>Menos rodadas de revisão administrativa.</li></ul></article>
        <article class="proposta"><h2>A proposta</h2><p>A integração com o GDL aproveita os dados na origem. O laWdo auxilia as partes administrativas do laudo e deixa a interpretação, a análise e a conclusão nas mãos humanas.</p></article>
      </div>
    </section>
    <footer>laWdo · apoio ao fluxo pericial, sem substituir o julgamento técnico humano.</footer>
  </main>
</body>
</html>`;
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

  await mkdir(saida, { recursive: true });
  await writeFile(join(saida, 'index.html'), paginaInicial(), 'utf8');
  await copyFile(resolve('src/renderer/assets/logo.png'), join(saida, 'logo.png'));

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
  process.stdout.write(`Feed gerado com ${candidatos.size} índice(s).\n`);
}

executar().catch(erro => {
  process.stderr.write(`${erro instanceof Error ? erro.message : 'Erro inesperado'}\n`);
  process.exitCode = 1;
});
