import { _electron as electron } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, readFile, cp, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { parentPort } from 'node:worker_threads';
import { CENARIOS, VERSAO_ROTEIRO, interpretarArgumentos, validarIsolamento, hash } from './configuracao.mjs';
import { verificarSessaoLivre, instalarColetorRenderer, lerMetricasRenderer, resumirMetricasRenderer, ColetaDiagnostica } from './diagnostico.mjs';
import { autenticarEAbrir, trocarModo, digitar, salvar, executarCenario, planejarCombinacoes, inspecionarDocumento, validarIntegridade } from './cenarios.mjs';
import { gravarRelatorio, lerEventosDesempenho, resumirOperacoes, resumirProcessos } from './relatorio.mjs';
import { encerrarProcessoCriado } from './processos.mjs';

const require = createRequire(import.meta.url);
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const opcoes = interpretarArgumentos(process.argv.slice(2));
if (opcoes.ajuda) {
  process.stdout.write('Uso: npm run test:carga -- [--perfil rapido|estresse] [--massa controle|representativa|estresse] [--semente inteiro] [--repeticoes 1..10] [--cenario digitacao|texto|figuras|placeholders|encadeamento|saida|atalho|resistencia] [--comparar resultado.json] [--trace] [--sem-build]\n');
  process.exit(0);
}
await verificarSessaoLivre(workspace);
const raiz = path.join(workspace, 'tmp/teste-carga');
await mkdir(raiz, { recursive: true });
const diretorio = await mkdtemp(path.join(raiz, 'execucao-'));
const ambiente = { ...process.env };
delete ambiente.ELECTRON_RUN_AS_NODE;
let aplicacao;
let interrompido = false;
let filho;
let concluirCancelamento;
const cancelamento = new Promise(resolver => { concluirCancelamento = resolver; });

function executarProcesso(comando, argumentos, env, prazoMs) {
  return new Promise((resolver, rejeitar) => {
    filho = spawn(comando, argumentos, { cwd: workspace, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const processo = filho;
    let saida = '';
    const receber = parte => { saida = (saida + parte.toString()).slice(-8000); };
    processo.stdout.on('data', receber);
    processo.stderr.on('data', receber);
    const prazo = setTimeout(() => {
      try { encerrarProcessoCriado(processo); } catch { /* O encerramento do processo também pode ter acabado de ocorrer. */ }
      rejeitar(new Error(`Processo excedeu ${prazoMs} ms. ${saida}`));
    }, prazoMs);
    processo.once('error', erro => { clearTimeout(prazo); rejeitar(erro); });
    processo.once('exit', codigo => {
      clearTimeout(prazo);
      if (filho === processo) filho = null;
      if (codigo === 0) resolver(); else rejeitar(new Error(`Processo encerrou com código ${codigo}. ${saida}`));
    });
  });
}

async function encerrarAplicacao() {
  const atual = aplicacao;
  aplicacao = null;
  if (!atual) return;
  const processo = atual.process();
  let prazo;
  try {
    await Promise.race([atual.close(), new Promise((_, rejeitar) => { prazo = setTimeout(() => rejeitar(new Error('Timeout ao encerrar aplicativo de teste.')), 10_000); })]);
  } catch {
    encerrarProcessoCriado(processo);
  } finally { clearTimeout(prazo); }
}

const cancelar = () => {
  interrompido = true;
  concluirCancelamento();
  try { encerrarProcessoCriado(filho); } catch { /* O filho pode já ter encerrado. */ }
  void encerrarAplicacao();
};
const limiteExecucao = setTimeout(cancelar, 90 * 60_000);
limiteExecucao.unref();
process.once('SIGINT', cancelar);
process.once('SIGTERM', cancelar);
const receberMensagem = mensagem => { if (mensagem === 'cancelar') cancelar(); };
parentPort?.on('message', receberMensagem);
const resultado = {
  estado: 'preparando', iniciadaEm: new Date().toISOString(), casos: [],
  contexto: { versaoRoteiro: VERSAO_ROTEIRO, semente: opcoes.semente, repeticoes: opcoes.repeticoes, perfil: opcoes.perfil, massa: opcoes.massa, cenario: opcoes.cenario, instrumentacao: 'electron-playwright-entrada-frame-v1',
    maquina: { nome: os.hostname(), plataforma: process.platform, arquitetura: process.arch, cpu: os.cpus()[0]?.model, nucleos: os.cpus().length, memoriaTotal: os.totalmem(), sistema: os.release() },
    node: process.version, trace: opcoes.trace, semBuild: opcoes.semBuild },
};
const identificacao = argumentos => { try { return execFileSync('git', argumentos, { cwd: workspace, encoding: 'utf8', windowsHide: true }).trim(); } catch { return null; } };
resultado.contexto.commit = identificacao(['rev-parse', 'HEAD']);
resultado.contexto.branch = identificacao(['branch', '--show-current']);
resultado.contexto.alteracoesLocais = identificacao(['status', '--short']);
resultado.contexto.diffHash = hash(identificacao(['diff', 'HEAD']) ?? '');
resultado.contexto.instrumentacao = hash((await Promise.all((await readdir(path.join(workspace, 'scripts/carga')))
  .filter(nome => nome.endsWith('.mjs') && !nome.endsWith('.test.mjs')).sort()
  .map(async nome => nome + '\n' + await readFile(path.join(workspace, 'scripts/carga', nome), 'utf8')))).join('\n') + '\n' + process.version + '\n' + require('playwright/package.json').version);
resultado.contexto.ferramentas = Object.fromEntries(['playwright', 'electron', 'tinymce'].map(nome => [nome, require(`${nome}/package.json`).version]));

async function executarCaso(nome, modo, repeticao, origem, massa, resistencia = false) {
  const chave = resistencia ? `${nome}-${modo}-resistencia` : `${nome}-${modo}-${repeticao}`;
  const dados = path.join(diretorio, chave, 'userData');
  await cp(origem, dados, { recursive: true, errorOnExist: true, force: false });
  await validarIsolamento(workspace, dados);
  const caso = { chave, massa: nome, modo, repeticao, resistencia, estado: 'iniciando', acoes: [], lacunas: [], iniciadaEm: new Date().toISOString() };
  resultado.casos.push(caso);
  let coleta;
  let temporizadorProcessos;
  let amostragem = Promise.resolve();
  const processos = [];
  let pagina;
  let inicio;
  let traceIniciado = false;
  const limiteCaso = setTimeout(() => { caso.lacunas.push('Prazo máximo do caso excedido.'); void encerrarAplicacao(); }, resistencia ? 15 * 60_000 : 12 * 60_000);
  try {
    if (interrompido) throw new Error('Execução interrompida.');
    await verificarSessaoLivre(workspace);
    aplicacao = await electron.launch({ args: [workspace], cwd: workspace, executablePath: require('electron'), env: { ...ambiente, LAWDO_TESTE_CARGA: '1', LAWDO_SMOKE_JANELA: '1', LAWDO_SMOKE_USER_DATA: dados, LAWDO_MODO_DIAGNOSTICO: '1' }, timeout: 60_000 });
    const isolamento = await aplicacao.evaluate(({ app }) => ({ caminho: app.getPath('userData'), sessao: app.getPath('sessionData'), empacotado: app.isPackaged, pid: process.pid, versoes: process.versions }));
    if (path.resolve(isolamento.caminho) !== path.resolve(dados) || path.resolve(isolamento.sessao) !== path.join(dados, 'sessao') || isolamento.empacotado) throw new Error('Aplicativo iniciou sem isolamento confirmado.');
    caso.versoes = isolamento.versoes;
    const contexto = aplicacao.context();
    await contexto.addInitScript(instalarColetorRenderer);
    if (opcoes.trace) { await contexto.tracing.start({ screenshots: false, snapshots: false }); traceIniciado = true; }
    pagina = await aplicacao.firstWindow();
    pagina.setDefaultTimeout(30_000);
    await pagina.evaluate(instalarColetorRenderer);
    caso.janela = await pagina.evaluate(() => ({ largura: globalThis.innerWidth, altura: globalThis.innerHeight, escala: globalThis.devicePixelRatio }));
    await pagina.bringToFront();
    await autenticarEAbrir(pagina);
    await trocarModo(pagina, modo);
    // Aquecimento fora dos intervalos medidos; não muda o documento original.
    await digitar(pagina, ' AQUECIMENTO_CARGA', 10);
    await salvar(pagina);
    const perfil = await pagina.evaluate(() => globalThis.window.ipcAPI.desempenho.iniciarDetalhada());
    if (!perfil.success) throw new Error('Não foi possível ativar as medições detalhadas.');
    coleta = new ColetaDiagnostica(workspace, isolamento.pid);
    await coleta.iniciar();
    let coletando = false;
    const amostrar = () => {
      if (coletando || !aplicacao) return;
      coletando = true;
      amostragem = aplicacao.evaluate(({ app, BrowserWindow }) => {
        const renderers = new Map(BrowserWindow.getAllWindows().map(janela => [janela.webContents.getOSProcessId(), janela.id]));
        return app.getAppMetrics().map(metrica => ({ pid: metrica.pid, papel: metrica.type === 'Tab' ? renderers.has(metrica.pid) ? 'renderer-principal' : 'renderer-auxiliar' : metrica.type, cpu: metrica.cpu.percentCPUUsage, memoriaKb: metrica.memory?.workingSetSize ?? null }));
      }).then(amostras => processos.push({ horario: Date.now(), amostras })).catch(erro => caso.lacunas.push(`Amostragem de processos: ${erro.message}`)).finally(() => { coletando = false; });
    };
    amostrar();
    temporizadorProcessos = setInterval(amostrar, 1000);
    const registrar = async (acao, executar) => {
      if (interrompido) throw new Error('Execução interrompida.');
      const registro = { nome: acao, inicio: Date.now(), estado: 'executando' };
      caso.acoes.push(registro);
      await writeFile(path.join(diretorio, chave, 'acoes.json'), JSON.stringify(caso.acoes, null, 2));
      try {
        registro.entrada = await Promise.race([executar(), cancelamento.then(() => { throw new Error('Execução interrompida.'); })]);
        registro.estado = 'concluido';
      }
      catch (erro) { registro.estado = 'achado'; registro.erro = erro.message; throw erro; }
      finally {
        registro.fim = Date.now();
        registro.duracaoMs = registro.fim - registro.inicio;
        registro.metricas = interrompido ? { coletaIncompleta: true } : await lerMetricasRenderer(pagina, registro.inicio, registro.fim).catch(() => ({ coletaIncompleta: true }));
        const esperados = registro.entrada?.caracteresEsperados ?? registro.entrada?.envios?.reduce((total, envio) => total + envio.horarios.length, 0);
        if (esperados !== undefined) {
          registro.metricas.caracteresEsperados = esperados;
          registro.metricas.caracteresConferidos = registro.metricas.entradasRecebidas === esperados;
          if (!registro.metricas.caracteresConferidos) caso.lacunas.push(`Coleta de teclas incompleta em ${acao}.`);
        }
      }
    };
    const parametros = { pagina, modo, diretorio: dados, registrar };
    inicio = Date.now();
    const roteiro = resistencia ? [] : opcoes.cenario ? [opcoes.cenario] : CENARIOS;
    for (const cenario of roteiro) await executarCenario(cenario, parametros);
    if (resistencia) {
      const limite = Date.now() + 10 * 60_000;
      const combinacoes = planejarCombinacoes(opcoes.semente, 500);
      caso.combinacoes = [];
      let indice = 0;
      while (Date.now() < limite) {
        const cenario = combinacoes[indice++ % combinacoes.length];
        caso.combinacoes.push(cenario);
        await executarCenario(cenario, parametros);
      }
    }
    caso.metricas = resumirMetricasRenderer(caso.acoes.flatMap(acao => acao.metricas?.amostras ?? [{ indisponivel: true }]));
    // A leitura de integridade fica fora dos intervalos medidos das ações.
    const htmlAtual = await pagina.evaluate(() => [...globalThis.document.querySelectorAll('iframe.tox-edit-area__iframe')].map(iframe => iframe.contentDocument?.body.innerHTML ?? '').join('\n'));
    const referencia = inspecionarDocumento(htmlAtual);
    validarIntegridade(referencia, massa);
    await salvar(pagina);
    const persistido = await pagina.evaluate(() => globalThis.window.ipcAPI.laudo.findById('carga-laudo'));
    if (!persistido.success || typeof persistido.data?.conteudo !== 'string') throw new Error('Não foi possível ler o laudo salvo.');
    validarIntegridade(inspecionarDocumento(persistido.data.conteudo), massa, referencia);
    caso.integridade = { verificada: true, figuras: referencia.figuras.map(figura => ({ ...figura })), tabelas: referencia.tabelas, celulas: referencia.celulas, hashCelulas: referencia.hashCelulas, placeholders: referencia.chavesPlaceholders.length };
    caso.estado = 'concluido';
  } catch (erro) {
    caso.estado = interrompido ? 'interrompido' : inicio && !caso.lacunas.includes('Prazo máximo do caso excedido.') ? 'achado' : 'inconclusivo';
    caso.erro = erro instanceof Error ? erro.stack : String(erro);
    if (!interrompido && pagina && !pagina.isClosed()) {
      const tela = path.join(chave, 'evidencia.png');
      await pagina.screenshot({ path: path.join(diretorio, tela), timeout: 5000 }).then(() => { caso.tela = tela.split(path.sep).join('/'); }).catch(() => caso.lacunas.push('Tela indisponível.'));
      caso.metricas ??= await lerMetricasRenderer(pagina, inicio ?? Date.now(), Date.now()).catch(() => null);
    }
  } finally {
    clearTimeout(limiteCaso);
    clearInterval(temporizadorProcessos);
    let prazoAmostragem;
    await Promise.race([amostragem, new Promise(resolver => { prazoAmostragem = setTimeout(() => { caso.lacunas.push('Amostragem de processos não respondeu.'); resolver(); }, 5000); })]);
    clearTimeout(prazoAmostragem);
    if (coleta) caso.diagnostico = await coleta.encerrar().catch(erro => ({ erros: [erro.message] }));
    if (traceIniciado && aplicacao) await aplicacao.context().tracing.stop({ path: path.join(diretorio, chave, 'trace.zip') }).catch(erro => caso.lacunas.push(erro.message));
    await encerrarAplicacao();
    caso.finalizadaEm = new Date().toISOString();
    caso.processos = resumirProcessos(processos);
    if (caso.acoes.length) caso.metricas = resumirMetricasRenderer(caso.acoes.flatMap(acao => acao.metricas?.amostras ?? [{ indisponivel: true }]));
    caso.operacoes = resumirOperacoes(await lerEventosDesempenho(dados), inicio ?? 0, Date.now());
    if (caso.metricas?.coletaIncompleta) caso.lacunas.push('Coleta do renderer incompleta.');
    if (caso.metricas?.amostrasOcultas) caso.lacunas.push('A janela ficou oculta durante parte da medição.');
    if (caso.metricas?.amostrasSemFoco) caso.lacunas.push('A janela perdeu o foco durante parte da medição.');
    if (caso.diagnostico?.segmentos?.some(segmento => segmento.metricas?.degradacao?.ativa)) caso.lacunas.push('Captura diagnóstica degradada.');
    for (const erro of caso.diagnostico?.erros ?? []) caso.lacunas.push(`Diagnóstico: ${erro}`);
    await writeFile(path.join(diretorio, chave, 'acoes.json'), JSON.stringify(caso.acoes, null, 2));
    await writeFile(path.join(diretorio, chave, 'processos.json'), JSON.stringify(processos, null, 2));
    await writeFile(path.join(diretorio, chave, 'diagnostico.json'), JSON.stringify(caso.diagnostico ?? null, null, 2));
    process.stdout.write(`${chave}: ${caso.estado}\n`);
  }
}

try {
  if (!opcoes.semBuild) {
    const npm = process.env.npm_execpath;
    if (!npm) throw new Error('Execute pelo comando npm run test:carga.');
    for (const etapa of ['prebuild', 'build:diagnostico', 'postbuild']) {
      process.stdout.write(`Preparando ${etapa}...\n`);
      await executarProcesso(process.execPath, [npm, 'run', etapa], ambiente, 300_000);
    }
  }
  const artefatos = ['out/renderer/index.html'];
  for (const camada of ['main', 'preload']) {
    const pasta = path.join('out', camada);
    artefatos.push(...(await readdir(path.join(workspace, pasta), { recursive: true })).filter(nome => nome.endsWith('.js')).map(nome => path.join(pasta, nome)));
  }
  resultado.contexto.buildHash = hash((await Promise.all(artefatos.sort().map(async nome => nome + hash(await readFile(path.join(workspace, nome)))))).join('\n'));
  const somenteResistencia = opcoes.cenario === 'resistencia';
  const nomes = somenteResistencia ? ['estresse'] : opcoes.massa ? [opcoes.massa] : opcoes.perfil === 'estresse' ? ['controle', 'representativa', 'estresse'] : ['representativa'];
  const massas = [];
  for (const nome of nomes) {
    if (interrompido) break;
    const origem = path.join(diretorio, `base-${nome}`);
    await mkdir(origem, { recursive: true });
    await writeFile(path.join(origem, 'isolamento.json'), JSON.stringify({ finalidade: 'teste-carga', versao: 1 }));
    await writeFile(path.join(origem, 'preparacao.json'), JSON.stringify({ nome, semente: opcoes.semente }));
    process.stdout.write(`Gerando massa ${nome}...\n`);
    await executarProcesso(require('electron'), [path.join(workspace, 'scripts/carga/preparar.mjs'), origem], ambiente, 120_000);
    const massa = JSON.parse(await readFile(path.join(origem, 'massa.json'), 'utf8'));
    massas.push(massa);
    for (const modo of somenteResistencia ? [] : ['single', 'multi']) for (let repeticao = 1; repeticao <= opcoes.repeticoes && !interrompido; repeticao++) {
      await executarCaso(nome, modo, repeticao, origem, massa);
      await gravarRelatorio(diretorio, resultado);
    }
    if (opcoes.perfil === 'estresse' && nome === 'estresse' && (!opcoes.cenario || somenteResistencia) && !interrompido) {
      await executarCaso(nome, 'multi', 1, origem, massa, true);
      await gravarRelatorio(diretorio, resultado);
    }
  }
  resultado.contexto.massasHash = hash(JSON.stringify(massas));
  resultado.massas = massas;
  resultado.estado = interrompido ? 'interrompida' : 'concluida';
  if (resultado.casos.some(caso => caso.estado === 'inconclusivo')) { resultado.estado = 'incompleta'; process.exitCode = 1; }
} catch (erro) {
  resultado.estado = interrompido ? 'interrompida' : 'erro_executor';
  resultado.erro = erro instanceof Error ? erro.stack : String(erro);
  process.exitCode = interrompido ? 130 : 1;
} finally {
  clearTimeout(limiteExecucao);
  await encerrarAplicacao();
  resultado.finalizadaEm = new Date().toISOString();
  await gravarRelatorio(diretorio, resultado, opcoes.comparar);
  process.stdout.write(`Relatório: ${path.join(diretorio, 'relatorio.html')}\n`);
  process.removeListener('SIGINT', cancelar);
  process.removeListener('SIGTERM', cancelar);
  parentPort?.off('message', receberMensagem);
  if (interrompido) process.exitCode = 130;
}
if (parentPort) process.exit(process.exitCode ?? 0);
