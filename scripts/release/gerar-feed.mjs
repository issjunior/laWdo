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

function paginaInicial() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="laWdo reduz retrabalho e erros administrativos na elaboração de laudos periciais.">
  <title>laWdo — menos retrabalho, mais perícia</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #09121d; color: #edf5fb; }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 320px; background: radial-gradient(circle at 15% 10%, #174a66 0, transparent 28rem), radial-gradient(circle at 85% 30%, #1d3c65 0, transparent 26rem), #09121d; }
    main { width: min(1120px, calc(100% - 40px)); margin: auto; }
    .topo { display: flex; justify-content: space-between; align-items: center; padding: 26px 0; }
    .marca { font-size: 1.25rem; font-weight: 800; letter-spacing: -.05em; }
    .marca span { color: #63d6cb; }
    .selo { color: #a9c1d4; font-size: .8rem; border: 1px solid #29445a; padding: 8px 11px; border-radius: 999px; }
    .hero { padding: 88px 0 74px; max-width: 850px; }
    .rotulo { color: #63d6cb; text-transform: uppercase; letter-spacing: .14em; font-size: .72rem; font-weight: 800; }
    h1 { font-size: clamp(2.65rem, 7vw, 5.7rem); line-height: .98; letter-spacing: -.07em; margin: 18px 0 24px; }
    .hero p { color: #bfd1df; max-width: 650px; font-size: clamp(1.05rem, 2vw, 1.28rem); line-height: 1.65; margin: 0; }
    .acoes { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
    .botao { display: inline-flex; align-items: center; text-decoration: none; font-weight: 750; border-radius: 10px; padding: 13px 18px; background: #63d6cb; color: #06201f; }
    .botao.secundario { background: transparent; color: #d7e6ef; border: 1px solid #426276; }
    section { padding: 62px 0; border-top: 1px solid #1f394c; }
    h2 { font-size: clamp(1.9rem, 4vw, 3rem); letter-spacing: -.05em; margin: 0 0 14px; }
    .introducao { color: #a9c1d4; max-width: 690px; line-height: 1.65; margin: 0 0 30px; }
    .grade { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .cartao { padding: 24px; border: 1px solid #27465b; border-radius: 16px; background: rgba(11, 29, 43, .72); }
    .numero { color: #63d6cb; font-size: .8rem; font-weight: 800; letter-spacing: .1em; }
    h3 { margin: 10px 0 8px; font-size: 1.08rem; }
    .cartao p { margin: 0; color: #abc0cf; line-height: 1.55; }
    .solucao { display: grid; grid-template-columns: 1.1fr .9fr; gap: 34px; align-items: start; }
    .destaque { padding: 28px; border-radius: 18px; background: linear-gradient(145deg, #134d56, #12324a); }
    .destaque p { margin: 0; color: #d8edf0; font-size: 1.1rem; line-height: 1.6; }
    ol { margin: 0; padding: 0; list-style: none; counter-reset: etapas; }
    li { counter-increment: etapas; padding: 0 0 18px 48px; position: relative; color: #b7cbd8; line-height: 1.55; }
    li::before { content: counter(etapas); position: absolute; left: 0; top: -2px; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: #1e5060; color: #7ce6dd; font-weight: 800; }
    li strong { color: #f2f8fc; display: block; }
    footer { color: #7f9aad; padding: 34px 0 46px; font-size: .9rem; }
    @media (max-width: 720px) { main { width: min(100% - 28px, 1120px); } .hero { padding: 62px 0 52px; } .grade, .solucao { grid-template-columns: 1fr; } .selo { display: none; } }
  </style>
</head>
<body>
  <main>
    <header class="topo"><div class="marca">la<span>W</span>do</div><div class="selo">Laudos periciais com menos atrito</div></header>
    <section class="hero">
      <div class="rotulo">Elaboração de laudos periciais</div>
      <h1>Menos retrabalho.<br>Mais perícia.</h1>
      <p>O laWdo organiza as partes administrativas do laudo para reduzir digitação repetitiva, conferências manuais e erros que afastam o perito da análise que realmente importa.</p>
      <div class="acoes"><a class="botao" href="https://github.com/issjunior/laWdo/releases/latest">Baixar a versão mais recente</a><a class="botao secundario" href="https://github.com/issjunior/laWdo">Conhecer o projeto</a></div>
    </section>
    <section>
      <div class="rotulo">O problema</div>
      <h2>Informação crítica não deveria ser redigitada.</h2>
      <p class="introducao">Números de ofícios, REPs e dados administrativos percorrem diferentes documentos. Cada cópia cria uma nova oportunidade para erro e uma nova rodada de conferência.</p>
      <div class="grade">
        <article class="cartao"><div class="numero">01</div><h3>Numerações repetidas</h3><p>Referências externas e internas são digitadas mais de uma vez em etapas diferentes do trabalho.</p></article>
        <article class="cartao"><div class="numero">02</div><h3>Conferência em cadeia</h3><p>A mesma informação exige sucessivas revisões para garantir que permaneceu coerente.</p></article>
        <article class="cartao"><div class="numero">03</div><h3>Erro humano evitável</h3><p>Digitação manual e cópias entre documentos aumentam o risco de inconsistências.</p></article>
        <article class="cartao"><div class="numero">04</div><h3>Tempo longe da análise</h3><p>Esforço administrativo consome a atenção que deveria estar dedicada à fundamentação do laudo.</p></article>
      </div>
    </section>
    <section class="solucao">
      <div><div class="rotulo">A proposta</div><h2>Dados uma vez. Contexto quando necessário.</h2><p class="introducao">O laWdo conecta a origem dos dados ao documento final e oferece apoio de escrita nas partes administrativas, sem substituir a responsabilidade técnica humana.</p><div class="destaque"><p>A solução automatiza o que é repetitivo para que o julgamento, a análise e a conclusão permaneçam nas mãos de quem faz perícia.</p></div></div>
      <ol>
        <li><strong>Integração com o GDL</strong>Dados são aproveitados na origem, reduzindo redigitação e conferências repetitivas.</li>
        <li><strong>Assistência na confecção do laudo</strong>Partes administrativas são organizadas e preenchidas com consistência.</li>
        <li><strong>Humano no centro da decisão</strong>O sistema apoia o fluxo; a interpretação técnica e a redação pericial continuam humanas.</li>
      </ol>
    </section>
    <footer>laWdo · tecnologia para reduzir atrito administrativo na elaboração de laudos periciais.</footer>
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
