import { _electron as electron } from 'playwright';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const raizIsolada = path.join(workspace, 'tmp', 'teste-carga');
const marcador = 'SMOKE_E2E_LAUDO_PERSISTIDO';
const tentativas = Number.parseInt(process.env.LAWDO_SMOKE_TENTATIVAS ?? '2', 10);

if (!Number.isInteger(tentativas) || tentativas < 1) {
  throw new Error('LAWDO_SMOKE_TENTATIVAS deve ser um número inteiro positivo.');
}

async function garantirBuild() {
  await Promise.all([
    access(path.join(workspace, 'out', 'main', 'bootstrap.js')),
    access(path.join(workspace, 'out', 'renderer', 'index.html')),
  ]).catch(() => {
    throw new Error('Build ausente. Execute npm run build antes de npm run test:e2e:smoke.');
  });
}

function executarElectron(script, diretorio) {
  const variaveis = { ...process.env };
  delete variaveis.ELECTRON_RUN_AS_NODE;
  return new Promise((resolver, rejeitar) => {
    const processo = spawn(require('electron'), [script, diretorio], {
      cwd: workspace,
      windowsHide: true,
      env: variaveis,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let saida = '';
    const registrar = parte => { saida = (saida + parte.toString()).slice(-8_000); };
    processo.stdout.on('data', registrar);
    processo.stderr.on('data', registrar);
    processo.once('error', rejeitar);
    processo.once('exit', codigo => codigo === 0 ? resolver() : rejeitar(new Error(`Preparação E2E falhou (${codigo}). ${saida}`)));
  });
}

function ambiente(diretorio) {
  const variaveis = { ...process.env };
  delete variaveis.ELECTRON_RUN_AS_NODE;
  return {
    ...variaveis,
    LAWDO_TESTE_CARGA: '1',
    LAWDO_SMOKE_JANELA: '1',
    LAWDO_SMOKE_USER_DATA: diretorio,
  };
}

async function abrirAplicacao(diretorio) {
  const aplicacao = await electron.launch({
    args: [workspace],
    cwd: workspace,
    executablePath: require('electron'),
    env: ambiente(diretorio),
    timeout: 60_000,
  });
  const isolamento = await aplicacao.evaluate(({ app }) => ({
    userData: app.getPath('userData'),
    sessionData: app.getPath('sessionData'),
    empacotado: app.isPackaged,
  }));
  if (path.resolve(isolamento.userData) !== path.resolve(diretorio)
    || path.resolve(isolamento.sessionData) !== path.join(diretorio, 'sessao')
    || isolamento.empacotado) {
    await aplicacao.close().catch(() => undefined);
    throw new Error('O Electron iniciou fora do perfil isolado do smoke.');
  }
  await aplicacao.context().tracing.start({ screenshots: true, snapshots: true });
  const pagina = await aplicacao.firstWindow();
  pagina.setDefaultTimeout(30_000);
  return { aplicacao, pagina };
}

async function autenticar(pagina) {
  await pagina.getByLabel('Usuário', { exact: true }).fill('smoke.perito');
  await pagina.getByPlaceholder('Digite sua senha', { exact: true }).fill('SmokeE2E!2026');
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  await pagina.waitForFunction(() => !globalThis.location.hash.includes('login'));
}

async function aguardarEditor(pagina) {
  const iframe = pagina.locator('iframe.tox-edit-area__iframe:visible').first();
  await iframe.waitFor({ timeout: 60_000 });
  return pagina.frameLocator('iframe.tox-edit-area__iframe:visible').first().locator('body');
}

async function criarESalvarLaudo(pagina) {
  await pagina.evaluate(() => { globalThis.location.hash = '/reps'; });
  await pagina.getByLabel('Criar laudo para REP 123456/2026', { exact: true }).click();
  await pagina.getByLabel('Tipo de Exame', { exact: true }).click();
  await pagina.getByRole('option', { name: 'E2E - SMOKE', exact: true }).click();
  await pagina.getByLabel('Template', { exact: true }).click();
  await pagina.getByRole('option', { name: 'Template Smoke E2E', exact: true }).click();
  await pagina.getByRole('button', { name: 'Criar Laudo', exact: true }).click();
  await pagina.getByText('Laudo criado com sucesso!', { exact: true }).waitFor({ timeout: 60_000 });
  await pagina.evaluate(() => { globalThis.location.hash = '/laudos'; });
  await pagina.getByRole('button', { name: 'Editar laudo da REP 123456/2026', exact: true }).click();

  const corpo = await aguardarEditor(pagina);
  await corpo.click();
  await corpo.press('Control+End');
  await corpo.pressSequentially(` ${marcador}`);
  await pagina.getByRole('button', { name: 'Salvar', exact: true }).click();
  await pagina.getByRole('status').filter({ hasText: /^Salvo$/ }).first().waitFor({ timeout: 60_000 });
}

async function confirmarPersistencia(pagina) {
  await pagina.evaluate(() => { globalThis.location.hash = '/laudos'; });
  await pagina.getByRole('button', { name: 'Editar laudo da REP 123456/2026', exact: true }).click();
  const corpo = await aguardarEditor(pagina);
  if (!(await corpo.innerText()).includes(marcador)) throw new Error('O conteúdo salvo não foi preservado após reiniciar o Electron.');
}

async function executarTentativa(numeroTentativa) {
  const diretorio = await mkdtemp(path.join(raizIsolada, 'e2e-smoke-'));
  await writeFile(path.join(diretorio, 'isolamento.json'), JSON.stringify({ finalidade: 'teste-carga', versao: 1 }));

  let aplicacao;
  let preservarEvidencias = false;
  try {
    await executarElectron(path.join(workspace, 'scripts', 'e2e', 'preparar-smoke.mjs'), diretorio);
    ({ aplicacao } = await abrirAplicacao(diretorio));
    const primeiraJanela = await aplicacao.firstWindow();
    await autenticar(primeiraJanela);
    await criarESalvarLaudo(primeiraJanela);
    await aplicacao.context().tracing.stop();
    await aplicacao.close();
    aplicacao = undefined;

    ({ aplicacao } = await abrirAplicacao(diretorio));
    const segundaJanela = await aplicacao.firstWindow();
    await autenticar(segundaJanela);
    await confirmarPersistencia(segundaJanela);
    await aplicacao.context().tracing.stop();
    await aplicacao.close();
    aplicacao = undefined;
    await rm(diretorio, { recursive: true, force: true });
    console.log(`Smoke E2E concluído na tentativa ${numeroTentativa}: criação e persistência de laudo confirmadas.`);
  } catch (erro) {
    preservarEvidencias = true;
    const pagina = aplicacao ? await aplicacao.firstWindow().catch(() => undefined) : undefined;
    if (pagina && !pagina.isClosed()) {
      await pagina.screenshot({ path: path.join(diretorio, 'evidencia.png') }).catch(() => undefined);
      await aplicacao.context().tracing.stop({ path: path.join(diretorio, 'trace.zip') }).catch(() => undefined);
    }
    await writeFile(
      path.join(diretorio, 'diagnostico.txt'),
      `Tentativa ${numeroTentativa}/${tentativas}\n\n${erro instanceof Error ? erro.stack ?? erro.message : String(erro)}`,
    );
    const falha = erro instanceof Error ? erro : new Error(String(erro));
    falha.diretorioEvidencias = diretorio;
    throw falha;
  } finally {
    if (!preservarEvidencias) await aplicacao?.context().tracing.stop().catch(() => undefined);
    await aplicacao?.close().catch(() => undefined);
  }
}

await garantirBuild();
await mkdir(raizIsolada, { recursive: true });

let ultimaFalha;
for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
  try {
    await executarTentativa(tentativa);
    ultimaFalha = undefined;
    break;
  } catch (erro) {
    ultimaFalha = erro;
    const diretorio = erro instanceof Error ? erro.diretorioEvidencias : undefined;
    if (tentativa < tentativas && diretorio) {
      console.warn(`Smoke E2E falhou na tentativa ${tentativa}/${tentativas}; repetindo em perfil isolado novo.`);
      await rm(diretorio, { recursive: true, force: true });
    }
  }
}

if (ultimaFalha) {
  const diretorio = ultimaFalha instanceof Error ? ultimaFalha.diretorioEvidencias : undefined;
  if (diretorio) console.error(`Evidências do smoke preservadas em ${diretorio}`);
  throw ultimaFalha;
}
