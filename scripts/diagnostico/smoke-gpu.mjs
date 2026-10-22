import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const raiz = path.join(workspace, 'tmp', 'smoke-gpu');
await mkdir(raiz, { recursive: true });
const diretorio = await mkdtemp(path.join(raiz, 'execucao-'));
const modulo = nome => JSON.stringify(pathToFileURL(path.join(workspace, 'out', 'main', nome)).href);
const resultado = path.join(diretorio, 'resultado.json');
await writeFile(path.join(diretorio, 'package.json'), JSON.stringify({ name: 'lawdo-smoke-gpu', type: 'module', main: 'main.mjs' }));
await writeFile(path.join(diretorio, 'main.mjs'), String.raw`
import { app, BrowserWindow } from 'electron';
import { appendFile, open, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { prepararDiagnosticoGpu, preparacaoGpu, diagnosticoGpu, conectarDiagnosticoGpu, encerrarDiagnosticoGpu } from ${modulo('diagnostico-gpu.js')};
import { DiagnosticoSessaoService } from ${modulo('services/diagnostico-sessao.service.js')};
const saida = ${JSON.stringify(resultado)};
app.setPath('userData', path.join(app.getAppPath(), 'userdata'));
const antesDeReady = !app.isReady();
prepararDiagnosticoGpu();
let sessao;
let janela;
let falhou = false;
const prazo = setTimeout(() => { app.exit(2); }, 55000);
const aguardar = async (condicao, ms = 12000) => {
  const inicio = Date.now();
  while (!condicao()) { if (Date.now() - inicio > ms) throw new Error('Prazo de espera excedido'); await esperar(100); }
};
async function executarSmoke() {
try {
  await app.whenReady();
  if (!diagnosticoGpu || !preparacaoGpu) throw new Error('Coleta não foi preparada');
  janela = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  await janela.loadURL('data:text/html,<canvas id="c"></canvas><script>document.getElementById("c").getContext("webgl");</script>');
  sessao = new DiagnosticoSessaoService({ obterCaminhoWorkspace: () => app.getAppPath(), empacotado: () => false,
    ambiente: process.env, plataforma: process.platform, pid: process.pid, preparacao: preparacaoGpu });
  await sessao.iniciar();
  await conectarDiagnosticoGpu(sessao.servicoEventos, () => ({ rota: '#/smoke', janelaId: janela.id, zoom: 1 }));
  await aguardar(() => diagnosticoGpu.resumo().ambiente && app.getAppMetrics().some(item => item.type === 'GPU'));
  const arquivo = path.join(preparacaoGpu.caminhoSessao, 'chromium-gpu.log');
  const handle = await open(arquivo, 'a');
  try {
    await appendFile(arquivo, Buffer.alloc(20 * 1024 * 1024 + 1024, 32));
    await handle.write('\n[gpu_smoke] antes_do_truncamento\n');
    await diagnosticoGpu.lerLogNativo();
    await aguardar(() => diagnosticoGpu.resumo().lacunas.includes('LOG_NATIVO_LIMITE_EXCEDIDO_CONTINUIDADE_PARCIAL'));
    const tamanhoAposTruncar = (await stat(arquivo)).size;
    if (tamanhoAposTruncar > 20 * 1024 * 1024) throw new Error('Truncamento não ocorreu');
    await handle.write('[gpu_smoke] append_no_handle_original\n');
  } finally { await handle.close(); }
  await diagnosticoGpu.lerLogNativo();
  diagnosticoGpu.coletarAmostra();
  const anterior = app.getAppMetrics().find(item => item.type === 'GPU').pid;
  process.kill(anterior);
  await aguardar(() => diagnosticoGpu.resumo().ultimoIncidenteId);
  const incidenteId = diagnosticoGpu.resumo().ultimoIncidenteId;
  const consultar = componente => diagnosticoGpu.consultar({ incidenteId, componente, depoisDe: 0, limite: 200 });
  await aguardar(() => consultar('incidente').ocorrencias.some(item => item.recuperacao === 'confirmada'), 20000);
  await aguardar(() => consultar('eventos_windows').total > 0, 22000);
  await diagnosticoGpu.lerLogNativo();
  const logs = consultar('logs_nativos');
  if (!logs.registros.some(item => item.linha.includes('append_no_handle_original'))) throw new Error('Append no handle aberto não foi preservado');
  const logNativoContinua = logs.registros.some(item => /GPU process exited unexpectedly/i.test(item.linha));
  if (!logNativoContinua) throw new Error('Mensagem nativa do Chromium ausente após truncamento');
  await encerrarDiagnosticoGpu();
  const persistido = JSON.parse(await readFile(path.join(preparacaoGpu.caminhoSessao, 'gpu', 'incidentes', incidenteId + '.json'), 'utf8'));
  await writeFile(saida, JSON.stringify({ sucesso: true, antesDeReady, mainPid: process.pid, gpuAnterior: anterior,
    ocorrencias: persistido.ocorrencias, amostras: persistido.amostras.length, ambiente: Boolean(persistido.ambienteAnterior),
    logNativoContinua, truncamento: true, eventosWindows: consultar('eventos_windows'), lacunas: persistido.lacunas }, null, 2));
} catch (erro) {
  falhou = true;
  await writeFile(saida, JSON.stringify({ sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha inesperada', resumo: diagnosticoGpu?.resumo() }, null, 2));
} finally {
  clearTimeout(prazo);
  await encerrarDiagnosticoGpu();
  await sessao?.encerrar();
  janela?.destroy();
  app.exit(falhou ? 1 : 0);
}
}
void executarSmoke();
`);
const ambiente = { ...process.env, LAWDO_MODO_DIAGNOSTICO: '1' };
delete ambiente.ELECTRON_RUN_AS_NODE;
const processo = spawn(require('electron'), [diretorio], { cwd: workspace, env: ambiente, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let erros = '';
processo.stderr.on('data', dado => { erros = (erros + dado.toString()).slice(-4000); });
const prazo = setTimeout(() => processo.kill(), 65000);
try {
  const codigo = await new Promise((resolver, rejeitar) => { processo.once('error', rejeitar); processo.once('exit', resolver); });
  const relatorio = JSON.parse(await readFile(resultado, 'utf8'));
  console.log(JSON.stringify({ ...relatorio, artefato: resultado }, null, 2));
  process.exitCode = codigo === 0 && relatorio.sucesso ? 0 : 1;
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : 'Falha no smoke');
  console.error(erros);
  process.exitCode = 1;
} finally { clearTimeout(prazo); }
