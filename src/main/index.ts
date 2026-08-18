import { app, BrowserWindow, shell, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'url';
import squirrelStartup from 'electron-squirrel-startup';
import { setupSecurity } from './security/index.js';
import { setupDatabase } from './database/index.js';
import { getLogger, setupLogging } from './utils/logger.js';
import { registerIpcHandlers } from './ipc/index.js';
import { atualizacaoService } from './services/atualizacao.service.js';
import { carregarEstadoJanelaPrincipal, observarEstadoJanelaPrincipal } from './utils/estado-janela-principal.js';
import { DiagnosticoSessaoService } from './services/diagnostico-sessao.service.js';
import { DiagnosticoPipeService } from './services/diagnostico-pipe.service.js';
import { DiagnosticoInterfaceService } from './services/diagnostico-interface.service.js';
import { DiagnosticoCapturaService } from './services/diagnostico-captura.service.js';
import { DiagnosticoSourceMapService } from './services/diagnostico-source-map.service.js';
import { iaExecucaoService } from './services/ia-execucao.service.js';
import { schemaCapturarTelaEntrada, schemaCriarSnapshotEntrada, schemaExecutarAcaoEntrada, schemaInspecionarInterfaceEntrada, schemaObterEventosEntrada, schemaIniciarCapturaEntrada, schemaStatusCapturaEntrada, schemaFinalizarCapturaEntrada, schemaConsultarCapturaEntrada } from '../shared/diagnostico/contratos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const log = getLogger('sistema');
const caminhoIcone = app.isPackaged
  ? path.join(process.resourcesPath, 'assets/icon.ico')
  : path.join(__dirname, '../../src/renderer/assets/icon.ico');

// Configurações de segurança
if (squirrelStartup) {
  app.quit();
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (squirrelStartup) {
  app.quit();
}

// Variável global para a janela principal
let mainWindow: BrowserWindow | null = null;
let sessaoDiagnostico: DiagnosticoSessaoService | null = null;
let pipeDiagnostico: DiagnosticoPipeService | null = null;
let capturaDiagnostico: DiagnosticoCapturaService | null = null;
let sourceMapsDiagnostico: DiagnosticoSourceMapService | null = null;
let encerramentoDiagnosticoEmAndamento = false;
let temporizadorAtrasoEventLoopDiagnostico: NodeJS.Timeout | null = null;
let atrasoEventLoopDiagnostico: number | null = null;

function iniciarMedicaoAtrasoEventLoop(): void {
  let esperado = performance.now() + 1_000;
  temporizadorAtrasoEventLoopDiagnostico = setInterval(() => {
    const agora = performance.now();
    atrasoEventLoopDiagnostico = Math.max(0, Number((agora - esperado).toFixed(2)));
    esperado = agora + 1_000;
  }, 1_000);
}

function registrarEventoDiagnostico(
  categoria: 'janela' | 'console' | 'erro',
  nivel: 'debug' | 'info' | 'warn' | 'error',
  dados: Record<string, unknown>,
  janela?: BrowserWindow,
): void {
  void sessaoDiagnostico?.servicoEventos?.registrar({
    origem: 'main',
    categoria,
    nivel,
    janelaId: janela?.id,
    rota: janela?.webContents.getURL(),
    dados,
  });
}

function extrairFramesStackDiagnostico(stack: unknown): string[] {
  if (typeof stack !== 'string') return [];
  return stack.split('\n')
    .filter(linha => /^\s*at\s+/.test(linha))
    .map(linha => linha.trim().slice(0, 500))
    .slice(0, 20);
}

function obterJanelaDiagnostico(janelaId?: number): BrowserWindow | null {
  if (janelaId) return BrowserWindow.fromId(janelaId) ?? null;
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows().find(janela => !janela.isDestroyed()) ?? null;
}

async function capturarTelaDiagnostico(janela: BrowserWindow, regiao?: { x: number; y: number; largura: number; altura: number }): Promise<{
  imagemBase64: string;
  janelaId: number;
  capturadaEm: string;
  largura: number;
  altura: number;
  escala: number;
  regiao: { x: number; y: number; largura: number; altura: number };
}> {
  if (janela.isDestroyed() || !janela.isVisible()) throw new Error('JANELA_INDISPONIVEL');
  const limites = janela.getContentBounds();
  const recorte = regiao ?? { x: 0, y: 0, largura: limites.width, altura: limites.height };
  if (recorte.x + recorte.largura > limites.width || recorte.y + recorte.altura > limites.height) throw new Error('ENTRADA_INVALIDA');
  const imagem = await Promise.race([
    janela.webContents.capturePage({ x: recorte.x, y: recorte.y, width: recorte.largura, height: recorte.altura }),
    new Promise<never>((_, rejeitar) => setTimeout(() => rejeitar(new Error('TIMEOUT')), 5_000)),
  ]);
  if (imagem.isEmpty()) throw new Error('CAPTURA_PARCIAL');
  const tamanho = imagem.getSize();
  return {
    imagemBase64: imagem.toPNG().toString('base64'),
    janelaId: janela.id,
    capturadaEm: new Date().toISOString(),
    largura: tamanho.width,
    altura: tamanho.height,
    escala: janela.webContents.getZoomFactor(),
    regiao: recorte,
  };
}

async function iniciarDiagnosticoAssistido(): Promise<void> {
  const sessao = new DiagnosticoSessaoService({
    obterCaminhoWorkspace: () => app.getAppPath(),
    empacotado: () => app.isPackaged,
    ambiente: process.env,
    plataforma: process.platform,
    pid: process.pid,
  });
  const ativa = await sessao.iniciar();
  if (!ativa) return;
  iniciarMedicaoAtrasoEventLoop();
  const interfaceServico = new DiagnosticoInterfaceService();
  sourceMapsDiagnostico = new DiagnosticoSourceMapService(path.join(app.getAppPath(), 'out'));
  let marcadoresDiagnostico: Record<string, string> = {};
  try {
    const manifesto: unknown = JSON.parse(await readFile(path.join(app.getAppPath(), 'out', 'diagnostico-marcadores.json'), 'utf8'));
    if (manifesto && typeof manifesto === 'object' && 'marcadores' in manifesto && typeof (manifesto as { marcadores?: unknown }).marcadores === 'object') {
      marcadoresDiagnostico = (manifesto as { marcadores: Record<string, string> }).marcadores;
    }
  } catch {
    marcadoresDiagnostico = {};
  }
  const coletarEstadoCaptura = async (janelaId: number | undefined, finalidade: 'problema' | 'desempenho') => {
    const janela = obterJanelaDiagnostico(janelaId);
    if (!janela) throw new Error('JANELA_NAO_ENCONTRADA');
    const erros: Array<{ componente: string; codigo: string; mensagem: string }> = [];
    let tela: Buffer | undefined;
    let interfaceSnapshot: unknown;
    if (finalidade === 'problema') {
      try { tela = Buffer.from((await capturarTelaDiagnostico(janela)).imagemBase64, 'base64'); } catch (erro) { erros.push({ componente: 'tela', codigo: erro instanceof Error ? erro.message : 'ERRO_INTERNO', mensagem: 'A tela não foi capturada.' }); }
      try { interfaceSnapshot = await interfaceServico.inspecionar(janela, 500, 12); } catch (erro) { erros.push({ componente: 'interface', codigo: erro instanceof Error ? erro.message : 'ERRO_INTERNO', mensagem: 'A interface não foi inspecionada.' }); }
    }
    return { janelaId: janela.id, rota: janela.webContents.getURL(), tela, interface: interfaceSnapshot, contexto: { zoom: janela.webContents.getZoomFactor(), largura: janela.getContentBounds().width, altura: janela.getContentBounds().height, versaoAplicativo: app.getVersion(), empacotado: app.isPackaged, sourceMapsDisponiveis: Boolean(sourceMapsDiagnostico) }, erros };
  };
  capturaDiagnostico = new DiagnosticoCapturaService({
    diretorioSessao: () => sessao.diretorioSessao,
    sessionId: () => sessao.ativa?.sessionId ?? null,
    eventos: () => sessao.servicoEventos,
    capturarLinhaBase: coletarEstadoCaptura,
    capturarEstadoFinal: async (janelaId, finalidade) => {
      const estado = await coletarEstadoCaptura(janelaId, finalidade);
      return { tela: estado.tela, interface: estado.interface, contexto: estado.contexto, erros: estado.erros };
    },
    obterMetricas: () => app.getAppMetrics().map(metrica => ({ pid: metrica.pid, tipo: metrica.type, cpu: metrica.cpu.percentCPUUsage, memoriaKb: metrica.memory?.workingSetSize ?? null })),
    obterAtrasoEventLoop: () => atrasoEventLoopDiagnostico,
    obterPendenciasPersistencia: () => sessao.servicoEventos?.pendenciasPersistencia ?? 0,
    obterMarcadores: () => marcadoresDiagnostico,
    alterarSonda: (ativa, finalidade) => {
      const janela = obterJanelaDiagnostico();
      janela?.webContents.send('diagnostico:alterar-captura', { ativa, finalidade });
    },
  });
  const pipe = new DiagnosticoPipeService(
    () => sessao.ativa,
    async ({ requestId, operacao, payload }) => {
      if (operacao === 'diagnostico_status') {
        return {
          requestId,
          ok: true,
          dados: {
            conectado: true,
            modoDiagnostico: true,
            sessionId: ativa.sessionId,
            iniciadoEm: ativa.iniciadoEm,
            pid: ativa.pid,
            ultimoCursor: sessao.servicoEventos?.ultimoCursor ?? 0,
            janelas: BrowserWindow.getAllWindows().map(janela => ({
              janelaId: janela.id,
              titulo: janela.getTitle(),
              focada: janela.isFocused(),
              visivel: janela.isVisible(),
              destruida: janela.isDestroyed(),
            })),
            orientacao: 'Use capturar_tela ou inspecionar_interface para observar a janela.',
          },
        };
      }
      if (operacao === 'obter_eventos') {
        const entrada = schemaObterEventosEntrada.safeParse(payload);
        if (!entrada.success) return { requestId, ok: false, erro: { codigo: 'ENTRADA_INVALIDA', mensagem: 'Os filtros de eventos são inválidos.' } };
        const resultado = sessao.servicoEventos?.consultar(entrada.data);
        return {
          requestId,
          ok: true,
          dados: {
            eventos: resultado?.eventos ?? [],
            cursorAnterior: entrada.data.depoisDe,
            proximoCursor: resultado?.proximoCursor ?? entrada.data.depoisDe,
            ultimoCursorSessao: sessao.servicoEventos?.ultimoCursor ?? 0,
            truncado: resultado?.truncado ?? false,
          },
        };
      }
      if (operacao === 'iniciar_captura') {
        const entrada = schemaIniciarCapturaEntrada.safeParse(payload);
        if (!entrada.success) return { requestId, ok: false, erro: { codigo: 'ENTRADA_INVALIDA', mensagem: 'Os parâmetros da captura são inválidos.' } };
        try { return { requestId, ok: true, dados: await capturaDiagnostico!.iniciar(entrada.data) }; } catch (erro) {
          const codigo = erro instanceof Error && ['CAPTURA_EM_ANDAMENTO', 'SESSAO_INDISPONIVEL', 'JANELA_NAO_ENCONTRADA'].includes(erro.message) ? erro.message : 'ERRO_INTERNO';
          return { requestId, ok: false, erro: { codigo, mensagem: 'Não foi possível iniciar a captura.' } };
        }
      }
      if (operacao === 'status_captura') {
        const entrada = schemaStatusCapturaEntrada.safeParse(payload);
        if (!entrada.success) return { requestId, ok: false, erro: { codigo: 'ENTRADA_INVALIDA', mensagem: 'A consulta da captura é inválida.' } };
        try { return { requestId, ok: true, dados: capturaDiagnostico!.status(entrada.data.capturaId) }; } catch (erro) {
          return { requestId, ok: false, erro: { codigo: erro instanceof Error && erro.message === 'CAPTURA_NAO_ENCONTRADA' ? erro.message : 'ERRO_INTERNO', mensagem: 'A captura não está disponível.' } };
        }
      }
      if (operacao === 'finalizar_captura') {
        const entrada = schemaFinalizarCapturaEntrada.safeParse(payload);
        if (!entrada.success) return { requestId, ok: false, erro: { codigo: 'ENTRADA_INVALIDA', mensagem: 'A finalização da captura é inválida.' } };
        try { return { requestId, ok: true, dados: await capturaDiagnostico!.finalizar(entrada.data) }; } catch (erro) {
          return { requestId, ok: false, erro: { codigo: erro instanceof Error && erro.message === 'CAPTURA_NAO_ENCONTRADA' ? erro.message : 'ERRO_INTERNO', mensagem: 'Não foi possível finalizar a captura.' } };
        }
      }
      if (operacao === 'consultar_captura') {
        const entrada = schemaConsultarCapturaEntrada.safeParse(payload);
        if (!entrada.success) return { requestId, ok: false, erro: { codigo: 'ENTRADA_INVALIDA', mensagem: 'A consulta da captura é inválida.' } };
        try { return { requestId, ok: true, dados: await capturaDiagnostico!.consultar(entrada.data) }; } catch (erro) {
          return { requestId, ok: false, erro: { codigo: erro instanceof Error && ['CAPTURA_NAO_ENCONTRADA', 'ACAO_NAO_SUPORTADA'].includes(erro.message) ? erro.message : 'ERRO_INTERNO', mensagem: 'Não foi possível ler o componente da captura.' } };
        }
      }
      if (operacao === 'capturar_tela') {
        const entrada = schemaCapturarTelaEntrada.safeParse(payload);
        if (!entrada.success) return { requestId, ok: false, erro: { codigo: 'ENTRADA_INVALIDA', mensagem: 'A entrada da captura é inválida.' } };
        const janela = obterJanelaDiagnostico(entrada.data.janelaId);
        if (!janela) return { requestId, ok: false, erro: { codigo: 'JANELA_NAO_ENCONTRADA', mensagem: 'A janela solicitada não existe.' } };
        try {
          const captura = await capturarTelaDiagnostico(janela, entrada.data.regiao);
          await sessao.servicoEventos?.registrar({
            origem: 'agente', categoria: 'acao', nivel: 'info', janelaId: janela.id,
            dados: { operacao: 'capturar_tela', regiao: entrada.data.regiao ?? null },
          });
          return { requestId, ok: true, dados: captura };
        } catch (erro) {
          const codigo = erro instanceof Error && ['JANELA_INDISPONIVEL', 'ENTRADA_INVALIDA', 'TIMEOUT', 'CAPTURA_PARCIAL'].includes(erro.message)
            ? erro.message
            : 'ERRO_INTERNO';
          return { requestId, ok: false, erro: { codigo, mensagem: 'Não foi possível capturar a janela solicitada.' } };
        }
      }
      if (operacao === 'inspecionar_interface') {
        const entrada = schemaInspecionarInterfaceEntrada.safeParse(payload);
        if (!entrada.success) return { requestId, ok: false, erro: { codigo: 'ENTRADA_INVALIDA', mensagem: 'Os parâmetros de inspeção são inválidos.' } };
        const janela = obterJanelaDiagnostico(entrada.data.janelaId);
        if (!janela) return { requestId, ok: false, erro: { codigo: 'JANELA_NAO_ENCONTRADA', mensagem: 'A janela solicitada não existe.' } };
        try {
          const snapshot = await interfaceServico.inspecionar(janela, entrada.data.limiteElementos, entrada.data.profundidadeMaxima);
          await sessao.servicoEventos?.registrar({
            origem: 'agente', categoria: 'acao', nivel: 'info', janelaId: janela.id,
            dados: { operacao: 'inspecionar_interface', revisao: snapshot.revisao, elementos: snapshot.elementos.length },
          });
          return { requestId, ok: true, dados: snapshot };
        } catch (erro) {
          const codigo = erro instanceof Error && erro.message === 'JANELA_INDISPONIVEL' ? 'JANELA_INDISPONIVEL' : 'ERRO_INTERNO';
          return { requestId, ok: false, erro: { codigo, mensagem: 'Não foi possível inspecionar a janela solicitada.' } };
        }
      }
      if (operacao === 'executar_acao') {
        const entrada = schemaExecutarAcaoEntrada.safeParse(payload);
        if (!entrada.success) return { requestId, ok: false, erro: { codigo: 'ENTRADA_INVALIDA', mensagem: 'A ação solicitada é inválida.' } };
        const janela = obterJanelaDiagnostico(entrada.data.janelaId);
        if (!janela) return { requestId, ok: false, erro: { codigo: 'JANELA_NAO_ENCONTRADA', mensagem: 'A janela solicitada não existe.' } };
        try {
          const resultado = await interfaceServico.executarAcao(janela, entrada.data);
          const correlacaoId = crypto.randomUUID();
          await sessao.servicoEventos?.registrar({
            origem: 'agente', categoria: 'acao', nivel: 'info', janelaId: janela.id, correlacaoId,
            dados: { operacao: 'executar_acao', tipo: entrada.data.acao.tipo, elementoId: entrada.data.elementoId },
          });
          return {
            requestId,
            ok: true,
            dados: {
              executada: true, correlacaoId, janelaId: janela.id, elementoId: entrada.data.elementoId,
              tipo: entrada.data.acao.tipo, iniciadaEm: new Date().toISOString(), duracaoMs: resultado.duracaoMs,
              rotaAntes: resultado.rotaAntes, rotaDepois: resultado.rotaDepois, revisaoInvalidada: true,
            },
          };
        } catch (erro) {
          const codigo = erro instanceof Error && ['JANELA_INDISPONIVEL', 'SNAPSHOT_EXPIRADO', 'ELEMENTO_NAO_ENCONTRADO', 'ACAO_NAO_SUPORTADA'].includes(erro.message)
            ? erro.message
            : 'ERRO_INTERNO';
          return { requestId, ok: false, erro: { codigo, mensagem: 'Não foi possível executar a ação solicitada.' } };
        }
      }
      if (operacao === 'criar_snapshot') {
        const entrada = schemaCriarSnapshotEntrada.safeParse(payload);
        if (!entrada.success) return { requestId, ok: false, erro: { codigo: 'ENTRADA_INVALIDA', mensagem: 'Os parâmetros do snapshot são inválidos.' } };
        const janela = obterJanelaDiagnostico(entrada.data.janelaId);
        const diretorioSessao = sessao.diretorioSessao;
        if (!janela) return { requestId, ok: false, erro: { codigo: 'JANELA_NAO_ENCONTRADA', mensagem: 'A janela solicitada não existe.' } };
        if (!diretorioSessao) return { requestId, ok: false, erro: { codigo: 'SESSAO_INDISPONIVEL', mensagem: 'A sessão não possui diretório persistente.' } };
        const snapshotId = randomUUID();
        const diretorioFinal = path.join(diretorioSessao, 'snapshots', snapshotId);
        const diretorioTemporario = `${diretorioFinal}.tmp`;
        const errosCaptura: Array<{ componente: string; codigo: string; mensagem: string }> = [];
        try {
          await mkdir(diretorioTemporario, { recursive: true });
          const eventos = sessao.servicoEventos?.consultar({
            depoisDe: Math.max(0, (sessao.servicoEventos?.ultimoCursor ?? 0) - entrada.data.quantidadeEventos),
            limite: entrada.data.quantidadeEventos,
          }).eventos ?? [];
          await writeFile(path.join(diretorioTemporario, 'eventos.json'), JSON.stringify(eventos, null, 2), 'utf8');
          await writeFile(path.join(diretorioTemporario, 'metadados.json'), JSON.stringify({ snapshotId, sessionId: ativa.sessionId, criadoEm: new Date().toISOString(), janelaId: janela.id }, null, 2), 'utf8');
          let tela = false;
          let interfaceEstrutural = false;
          try {
            const captura = await capturarTelaDiagnostico(janela, entrada.data.regiao ?? undefined);
            await writeFile(path.join(diretorioTemporario, 'tela.png'), Buffer.from(captura.imagemBase64, 'base64'));
            tela = true;
          } catch (erro) {
            errosCaptura.push({ componente: 'tela', codigo: erro instanceof Error ? erro.message : 'ERRO_INTERNO', mensagem: 'A captura da tela não foi concluída.' });
          }
          try {
            const interfaceSnapshot = await interfaceServico.inspecionar(janela, 500, 12);
            await writeFile(path.join(diretorioTemporario, 'interface.json'), JSON.stringify(interfaceSnapshot, null, 2), 'utf8');
            interfaceEstrutural = true;
          } catch (erro) {
            errosCaptura.push({ componente: 'interface', codigo: erro instanceof Error ? erro.message : 'ERRO_INTERNO', mensagem: 'A inspeção estrutural não foi concluída.' });
          }
          await rename(diretorioTemporario, diretorioFinal);
          return {
            requestId, ok: true,
            dados: {
              snapshotId, sessionId: ativa.sessionId, criadoEm: new Date().toISOString(), janelaId: janela.id,
              cursorInicial: eventos.at(0)?.sequencia ?? 0, cursorFinal: eventos.at(-1)?.sequencia ?? 0,
              caminho: diretorioFinal,
              componentes: { metadados: true, eventos: true, tela, interface: interfaceEstrutural }, errosCaptura,
            },
          };
        } catch {
          await rm(diretorioTemporario, { recursive: true, force: true }).catch(() => undefined);
          return { requestId, ok: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível materializar o snapshot.' } };
        }
      }
      return { requestId, ok: false, erro: { codigo: 'ACAO_NAO_SUPORTADA', mensagem: 'Operação diagnóstica ainda não disponível.' } };
    },
  );
  await pipe.iniciar(ativa.pipe);
  ipcMain.on('diagnostico:registrar-evento', (evento, dados: unknown) => {
    if (!dados || typeof dados !== 'object') return;
    const entrada = dados as Record<string, unknown>;
    const fase = typeof entrada.fase === 'string' ? entrada.fase : 'desconhecida';
    const canal = typeof entrada.canal === 'string' ? entrada.canal : 'desconhecido';
    const correlacaoId = typeof entrada.correlacaoId === 'string' ? entrada.correlacaoId : undefined;
    const duracaoMs = typeof entrada.duracaoMs === 'number' ? entrada.duracaoMs : undefined;
    const categoria = entrada.categoria === 'acao' ? 'acao' : 'ipc';
    const nivel = entrada.nivel === 'debug' || entrada.nivel === 'warn' || entrada.nivel === 'error' ? entrada.nivel : 'info';
    void sessao.servicoEventos?.registrar({
      origem: 'preload',
      categoria,
      nivel: fase === 'erro' ? 'error' : nivel,
      janelaId: BrowserWindow.fromWebContents(evento.sender)?.id,
      rota: evento.sender.getURL(),
      correlacaoId,
      dados: categoria === 'acao'
        ? entrada
        : { fase, canal, duracaoMs, erro: typeof entrada.erro === 'string' ? entrada.erro : undefined },
    });
  });
  ipcMain.on('diagnostico:erro-fatal-renderer', (evento, erro: unknown) => {
    if (!erro || typeof erro !== 'object') return;
    const dadosErro = erro as Record<string, unknown>;
    const origem = typeof dadosErro.source === 'string' ? dadosErro.source : null;
    const linha = typeof dadosErro.lineno === 'number' ? dadosErro.lineno : null;
    const coluna = typeof dadosErro.colno === 'number' ? dadosErro.colno : null;
    void sourceMapsDiagnostico?.resolver(origem, linha, coluna).then(localizacaoOriginal => sessao.servicoEventos?.registrar({
      origem: 'renderer', categoria: 'erro', nivel: 'error', janelaId: BrowserWindow.fromWebContents(evento.sender)?.id, rota: evento.sender.getURL(),
      dados: { tipo: dadosErro.tipo === 'unhandledrejection' ? 'unhandledrejection' : 'error', origem, linha, coluna, frames: extrairFramesStackDiagnostico(dadosErro.stack), localizacaoOriginal },
    }));
  });
  sessaoDiagnostico = sessao;
  iaExecucaoService.configurarRegistradorDiagnostico(dados => {
    registrarEventoDiagnostico('erro', 'warn', dados, mainWindow ?? undefined);
  });
  pipeDiagnostico = pipe;
  log.info(`Modo diagnóstico pronto (${ativa.sessionId.slice(0, 8)}).`);
}

async function encerrarDiagnosticoAssistido(): Promise<void> {
  iaExecucaoService.configurarRegistradorDiagnostico();
  await capturaDiagnostico?.interromper('Aplicativo encerrado durante a captura.').catch(() => undefined);
  if (temporizadorAtrasoEventLoopDiagnostico) clearInterval(temporizadorAtrasoEventLoopDiagnostico);
  temporizadorAtrasoEventLoopDiagnostico = null;
  atrasoEventLoopDiagnostico = null;
  await pipeDiagnostico?.encerrar().catch(() => undefined);
  await sessaoDiagnostico?.encerrar().catch(() => undefined);
  pipeDiagnostico = null;
  sessaoDiagnostico = null;
}

const createWindow = async (): Promise<void> => {
  const estado = await carregarEstadoJanelaPrincipal();
  // Criar a janela do navegador
  mainWindow = new BrowserWindow({
    x: estado.x,
    y: estado.y,
    width: estado.largura,
    height: estado.altura,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    icon: caminhoIcone,
    title: 'laWdo',
    show: false, // Mostrar apenas quando estiver pronto
  });
  observarEstadoJanelaPrincipal(mainWindow);
  registrarEventoDiagnostico('janela', 'info', { evento: 'aberta' }, mainWindow);

  mainWindow.on('focus', () => registrarEventoDiagnostico('janela', 'info', { evento: 'foco' }, mainWindow ?? undefined));
  mainWindow.on('blur', () => registrarEventoDiagnostico('janela', 'info', { evento: 'perdeu_foco' }, mainWindow ?? undefined));
  mainWindow.webContents.on('did-finish-load', () => registrarEventoDiagnostico('janela', 'info', { evento: 'carregada' }, mainWindow ?? undefined));
  mainWindow.webContents.on('did-fail-load', (_evento, codigoErro, descricaoErro, urlValidada) => {
    registrarEventoDiagnostico('erro', 'error', {
      evento: 'falha_carregamento', codigoErro, descricaoErro, url: urlValidada,
    }, mainWindow ?? undefined);
  });
  mainWindow.webContents.on('console-message', ({ level, message, lineNumber, sourceId, frame }) => {
    const nivel = level === 'error' ? 'error' : level === 'warning' ? 'warn' : level === 'debug' ? 'debug' : 'info';
    void sourceMapsDiagnostico?.resolver(sourceId, lineNumber, 1).then(localizacaoOriginal => {
      const assinatura = createHash('sha256').update(message).digest('hex').slice(0, 16);
      registrarEventoDiagnostico('console', nivel, { assinatura, linha: lineNumber, origem: sourceId, principal: frame?.parent === null, localizacaoOriginal, agregada: capturaDiagnostico?.finalidadeAtiva() === 'desempenho' }, mainWindow ?? undefined);
    });
  });

  // Carregar a aplicação React
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Mostrar quando estiver pronto
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      if (estado.maximizada) mainWindow.maximize();
      mainWindow.show();
    }
  });

  // Abrir links externos no navegador padrão
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Lidar com fechamento da janela
  mainWindow.on('closed', () => {
    registrarEventoDiagnostico('janela', 'info', { evento: 'fechada' }, mainWindow ?? undefined);
    void capturaDiagnostico?.interromper('Janela encerrada durante a captura.');
    mainWindow = null;
  });
  mainWindow.webContents.on('render-process-gone', (_evento, detalhes) => {
    registrarEventoDiagnostico('erro', 'error', { evento: 'renderer_encerrado', motivo: detalhes.reason, codigo: detalhes.exitCode }, mainWindow ?? undefined);
    void capturaDiagnostico?.interromper(`Renderer encerrado: ${detalhes.reason}.`);
  });
  mainWindow.webContents.on('unresponsive', () => registrarEventoDiagnostico('janela', 'warn', { evento: 'renderer_sem_resposta' }, mainWindow ?? undefined));
  mainWindow.webContents.on('responsive', () => registrarEventoDiagnostico('janela', 'info', { evento: 'renderer_responsivo' }, mainWindow ?? undefined));
};

// Função para alternar DevTools
const toggleDevTools = () => {
  if (mainWindow) {
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    } else {
      mainWindow.webContents.openDevTools();
    }
  }
};

// Este método será chamado quando o Electron terminar de inicializar
app.whenReady().then(async () => {
  try {
    // Inicializar sistemas
    setupSecurity();
    if (await atualizacaoService.processarPendenciaInicializacao()) return;
    await setupDatabase();
    setupLogging();
    await iniciarDiagnosticoAssistido();

    // Registrar handlers IPC
    const preloadPath = path.join(__dirname, '../preload/index.js');
    const rendererHtmlPath = path.join(__dirname, '../renderer/index.html');
    const isDev = process.env.NODE_ENV === 'development';
    registerIpcHandlers({ preloadPath, rendererHtmlPath, isDev });

    // Criar janela
    await createWindow();

    const atrasoVerificacaoAtualizacao = 5_000 + Math.floor(Math.random() * 25_000);
    setTimeout(() => {
      void atualizacaoService.verificar().catch(() => undefined);
    }, atrasoVerificacaoAtualizacao);

    // Registrar atalhos de teclado para DevTools
    // Ctrl+Shift+I - Alternar DevTools (padrão Chrome/Electron)
    // F12 - Alternar DevTools (alternativo)
    // Ctrl+Shift+D - Alternar DevTools (alternativo)
    const shortcuts = [
      'CommandOrControl+Shift+I',
      'F12',
      'CommandOrControl+Shift+D'
    ];

    shortcuts.forEach(shortcut => {
      const ret = globalShortcut.register(shortcut, toggleDevTools);
      if (!ret) {
        console.warn(`❌ Não foi possível registrar atalho: ${shortcut}`);
      } else {
        log.debug(`Atalho registrado: ${shortcut}`);
      }
    });

    log.debug('Aplicação Electron inicializada com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar aplicação:', error);
    app.quit();
  }
});

// Sair quando todas as janelas forem fechadas
app.on('window-all-closed', () => {
  // Desregistrar todos os atalhos de teclado
  globalShortcut.unregisterAll();
  log.debug('Atalhos de teclado desregistrados');

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', evento => {
  if (encerramentoDiagnosticoEmAndamento || !sessaoDiagnostico) return;
  evento.preventDefault();
  encerramentoDiagnosticoEmAndamento = true;
  void encerrarDiagnosticoAssistido().finally(() => app.exit(0));
});

app.on('activate', () => {
  // No macOS, recriar uma janela no app quando
  // o ícone do dock for clicado e não houver janelas abertas
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

