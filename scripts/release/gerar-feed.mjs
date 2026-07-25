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

function escaparHtml(valor) {
  return String(valor)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function rotuloPlataforma(plataforma) {
  return { windows: 'Windows', linux: 'Linux', macos: 'macOS' }[plataforma] ?? plataforma;
}

function rotuloFormato(formato) {
  return { nsis: 'Instalador', AppImage: 'AppImage', deb: 'Pacote DEB', dmg: 'DMG', zip: 'ZIP' }[formato] ?? formato;
}

function formatarTamanho(tamanho) {
  if (tamanho < 1024) return `${tamanho} B`;
  const unidades = ['KB', 'MB', 'GB'];
  let valor = tamanho / 1024;
  let indice = 0;
  while (valor >= 1024 && indice < unidades.length - 1) {
    valor /= 1024;
    indice += 1;
  }
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(valor)} ${unidades[indice]}`;
}

function obterDownloads(candidatos) {
  return [...candidatos.entries()]
    .flatMap(([chave, manifesto]) => {
      const [canal, destino] = chave.split('/');
      const [plataforma, arquitetura] = destino.split('-');
      return manifesto.artefatos
        .filter(artefato => artefato.canal === canal && artefato.plataforma === plataforma && artefato.arquitetura === arquitetura && artefato.formato !== 'zip')
        .map(artefato => ({ ...artefato, versao: manifesto.versao }));
    })
    .sort((primeiro, segundo) =>
      rotuloPlataforma(primeiro.plataforma).localeCompare(rotuloPlataforma(segundo.plataforma), 'pt-BR')
      || primeiro.arquitetura.localeCompare(segundo.arquitetura)
      || primeiro.formato.localeCompare(segundo.formato)
    );
}

function botoesDownload(downloads) {
  if (downloads.length === 0) return '';
  const ordemPlataformas = ['windows', 'linux', 'macos'];
  const grupos = ordemPlataformas.map(plataforma => {
    const artefatos = downloads.filter(artefato => artefato.plataforma === plataforma);
    if (artefatos.length === 0) return '';
    const botoes = artefatos.map(artefato => `
            <a class="download" href="${escaparHtml(artefato.url)}" rel="noopener noreferrer">
              <span class="download-info"><strong>${escaparHtml(artefato.arquitetura)} · ${escaparHtml(rotuloFormato(artefato.formato))}</strong><small>v${escaparHtml(artefato.versao)} · ${escaparHtml(formatarTamanho(artefato.tamanho))}</small></span>
              <b aria-hidden="true">↓</b>
            </a>`).join('');
    return `<section class="grupo-plataforma" aria-label="Downloads para ${escaparHtml(rotuloPlataforma(plataforma))}"><h3>${escaparHtml(rotuloPlataforma(plataforma))}</h3><div class="lista-downloads">${botoes}
          </div></section>`;
  }).join('');
  return `<section class="downloads" aria-labelledby="titulo-downloads"><div class="downloads-header"><div><p class="rotulo">Versão disponível</p><h2 id="titulo-downloads">Downloads</h2></div><a class="historico" href="https://github.com/issjunior/laWdo/releases" rel="noopener noreferrer">Histórico de versões <span aria-hidden="true">↗</span></a></div><p class="downloads-introducao">Escolha o instalador compatível com seu sistema operacional.</p><div class="grupos-plataforma">${grupos}</div></section>`;
}

function paginaInicial(downloads) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="laWdo reduz retrabalho administrativo na elaboração de laudos periciais.">
  <title>laWdo — elaboração de laudos periciais</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #dde5f0; color: #151c2c; }
    * { box-sizing: border-box; } body { min-width: 320px; min-height: 100svh; margin: 0; overflow: hidden; background: linear-gradient(135deg, #e8effc 0%, #dde5f0 46%, #d5e1f1 100%); }
    #flickering-grid { position: fixed; inset: 0; z-index: 0; width: 100%; height: 100%; pointer-events: none; mask-image: radial-gradient(ellipse at center, #000, transparent 76%); }
    main { position: relative; z-index: 1; width: min(1180px, calc(100% - 48px)); height: 100svh; margin: auto; padding: clamp(14px, 2.4vh, 26px) 0; display: grid; grid-template-rows: minmax(0, 1fr) auto; }
    .conteudo { min-height: 0; display: grid; grid-template-columns: minmax(300px, .83fr) minmax(510px, 1.17fr); gap: clamp(28px, 5vw, 76px); align-items: center; }
    .apresentacao { display: grid; justify-items: start; align-content: center; } .logo-principal { width: min(76%, 365px); max-height: 39svh; object-fit: contain; filter: drop-shadow(0 18px 20px rgba(26, 85, 224, .16)); }
    .rotulo { margin: 0; color: #1a55e0; font-size: .68rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; } h1 { max-width: 520px; margin: 10px 0 12px; font-size: clamp(2.2rem, 4.1vw, 4.2rem); line-height: .98; letter-spacing: -.07em; } .introducao { max-width: 500px; margin: 0; color: #5d7191; font-size: clamp(.9rem, 1.35vw, 1.05rem); line-height: 1.5; }
    .beneficios { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 16px; } .beneficios span { border: 1px solid #b3c4d9; border-radius: 999px; padding: 5px 9px; background: rgba(255, 255, 255, .58); color: #3a4a62; font-size: .7rem; font-weight: 700; }
    .downloads { align-self: center; border: 1px solid rgba(179, 196, 217, .94); border-radius: 20px; padding: clamp(18px, 2.5vw, 28px); background: rgba(255, 255, 255, .82); box-shadow: 0 18px 45px rgba(25, 65, 124, .12); backdrop-filter: blur(15px); }
    .downloads-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; } h2 { margin: 3px 0 0; font-size: clamp(1.35rem, 2vw, 1.8rem); letter-spacing: -.045em; } .historico { display: inline-flex; align-items: center; gap: 5px; color: #1a55e0; font-size: .75rem; font-weight: 800; text-decoration: none; white-space: nowrap; } .historico:hover { text-decoration: underline; }
    .downloads-introducao { margin: 9px 0 15px; color: #5d7191; font-size: .82rem; } .grupos-plataforma { display: grid; gap: 13px; } .grupo-plataforma { display: grid; gap: 7px; } .grupo-plataforma h3 { margin: 0; color: #3a4a62; font-size: .76rem; font-weight: 800; letter-spacing: .03em; } .lista-downloads { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
    .download { min-height: 56px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid #c4d2e6; border-radius: 11px; padding: 8px 10px 8px 12px; background: rgba(248, 251, 255, .86); color: #151c2c; text-decoration: none; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease, background .18s ease; } .download:hover { border-color: #1a55e0; background: #fff; box-shadow: 0 7px 16px rgba(26, 85, 224, .13); transform: translateY(-1px); }
    .download-info { display: grid; gap: 2px; min-width: 0; } .download strong { font-size: .78rem; } .download small { color: #5d7191; font-size: .67rem; } .download b { width: 25px; height: 25px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 50%; background: #e8effc; color: #1a55e0; font-size: 1rem; }
    footer { padding-top: 10px; color: #5d7191; font-size: .7rem; } @media (max-width: 900px) { body { overflow: auto; } main { height: auto; min-height: 100svh; padding: 20px 0; } .conteudo { grid-template-columns: 1fr; gap: 24px; padding: 28px 0; } .apresentacao { justify-items: center; text-align: center; } .beneficios { justify-content: center; } .downloads { width: 100%; } } @media (max-width: 560px) { main { width: min(100% - 28px, 1180px); } .lista-downloads { grid-template-columns: 1fr; } .downloads-header { align-items: flex-start; flex-direction: column; gap: 7px; } .logo-principal { width: min(82%, 300px); } }
  </style>
</head>
<body>
  <canvas id="flickering-grid" aria-hidden="true"></canvas>
  <main>
    <section class="conteudo">
      <div class="apresentacao"><img class="logo-principal" src="logo.png" alt="laWdo"><h1>Menos retrabalho.<br>Mais perícia.</h1><p class="introducao">O laWdo organiza o fluxo administrativo para que você dedique mais tempo à análise técnica.</p><div class="beneficios"><span>Dados organizados</span><span>Menos digitação</span><span>Mais foco pericial</span></div></div>
      <div>
        ${botoesDownload(downloads)}
      </div>
    </section>
    <footer>laWdo · apoio ao fluxo pericial, sem substituir o julgamento técnico humano.</footer>
  </main>
  <script>
    (() => {
      const canvas = document.getElementById('flickering-grid');
      const contexto = canvas.getContext('2d');
      const tamanhoQuadrado = 4;
      const espaco = 6;
      const opacidadeMaxima = .25;
      let colunas = 0;
      let linhas = 0;
      let quadrados = new Float32Array();
      let ultimoQuadro = 0;
      const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function redimensionar() {
        const proporcao = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * proporcao;
        canvas.height = window.innerHeight * proporcao;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        colunas = Math.ceil(window.innerWidth / (tamanhoQuadrado + espaco));
        linhas = Math.ceil(window.innerHeight / (tamanhoQuadrado + espaco));
        quadrados = new Float32Array(colunas * linhas);
        for (let indice = 0; indice < quadrados.length; indice += 1) quadrados[indice] = Math.random() * opacidadeMaxima;
        contexto.setTransform(proporcao, 0, 0, proporcao, 0, 0);
      }

      function desenhar(tempo) {
        const delta = (tempo - ultimoQuadro) / 1000;
        ultimoQuadro = tempo;
        contexto.clearRect(0, 0, window.innerWidth, window.innerHeight);
        for (let coluna = 0; coluna < colunas; coluna += 1) {
          for (let linha = 0; linha < linhas; linha += 1) {
            const indice = coluna * linhas + linha;
            if (!reduzirMovimento && Math.random() < .4 * delta) quadrados[indice] = Math.random() * opacidadeMaxima;
            contexto.fillStyle = 'rgba(107, 114, 128, ' + quadrados[indice] + ')';
            contexto.fillRect(coluna * (tamanhoQuadrado + espaco), linha * (tamanhoQuadrado + espaco), tamanhoQuadrado, tamanhoQuadrado);
          }
        }
        if (!reduzirMovimento) window.requestAnimationFrame(desenhar);
      }

      window.addEventListener('resize', redimensionar, { passive: true });
      redimensionar();
      window.requestAnimationFrame(desenhar);
    })();
  </script>
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

  const downloads = obterDownloads(candidatos);

  await mkdir(saida, { recursive: true });
  await writeFile(join(saida, 'index.html'), paginaInicial(downloads), 'utf8');
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
