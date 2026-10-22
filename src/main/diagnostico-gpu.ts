import { app } from 'electron';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { modoDiagnosticoHabilitado, type PreparacaoSessaoDiagnostico } from './services/diagnostico-sessao.service.js';
import { DiagnosticoGpuService } from './services/diagnostico-gpu.service.js';
import { consultarEventosWindowsGpu } from './services/diagnostico-gpu-windows.js';
import type { DiagnosticoEventosService } from './services/diagnostico-eventos.service.js';
import { sanitizarTextoGpu } from './services/diagnostico-gpu-dados.js';

export let preparacaoGpu: PreparacaoSessaoDiagnostico | undefined;
export let diagnosticoGpu: DiagnosticoGpuService | null = null;
let eventos: DiagnosticoEventosService | null = null;
let contexto: () => Record<string, unknown> = () => ({});
const pendentes: Array<{ dados: Record<string, unknown>; incidenteId: string }> = [];
let encerramento: Promise<void> | null = null;
let removerObservadores: (() => void) | null = null;

export function prepararDiagnosticoGpu(): void {
  if (!modoDiagnosticoHabilitado(app.isPackaged, process.env) || diagnosticoGpu) return;
  try {
    const workspace = realpathSync(app.getAppPath());
    const sessionId = randomUUID();
    const iniciadoEm = new Date().toISOString();
    const caminhoSessao = path.join(workspace, 'tmp', 'diagnostico-agente', 'sessoes', `${iniciadoEm.replace(/[:.]/g, '-')}-${sessionId}`);
    mkdirSync(caminhoSessao, { recursive: true });
    preparacaoGpu = { workspace, sessionId, iniciadoEm, caminhoSessao };
    const arquivoNativo = path.join(caminhoSessao, 'chromium-gpu.log');
    writeFileSync(arquivoNativo, '', { mode: 0o600 });
    app.commandLine.appendSwitch('enable-logging', 'file');
    app.commandLine.appendSwitch('log-file', arquivoNativo);
    app.commandLine.appendSwitch('vmodule', 'gpu*=1,gl_*=1,angle*=1,viz*=1,shared_context*=1,command_buffer*=1');
    diagnosticoGpu = new DiagnosticoGpuService({
      diretorio: caminhoSessao, arquivoNativo,
      ambienteExecucao: { plataforma: process.platform, arquitetura: process.arch, windows: os.release(), electron: process.versions.electron, chromium: process.versions.chrome, node: process.versions.node,
        parametrosGraficos: Object.fromEntries(['use-angle', 'use-gl', 'disable-gpu', 'disable-gpu-compositing', 'disable-gpu-rasterization'].map(chave => [chave, app.commandLine.hasSwitch(chave) ? sanitizarTextoGpu(app.commandLine.getSwitchValue(chave)) || true : false])) },
      obterInformacoes: () => app.getGPUInfo('complete'), obterRecursos: () => app.getGPUFeatureStatus(), obterMetricas: () => app.getAppMetrics(),
      obterContexto: () => contexto(), consultarWindows: consultarEventosWindowsGpu,
      registrar: async (dados, incidenteId) => {
        if (!eventos) { pendentes.push({ dados, incidenteId }); if (pendentes.length > 100) pendentes.shift(); return; }
        await eventos.registrar({ origem: 'main', categoria: dados.evento === 'gpu_encerrada' ? 'erro' : 'sessao', nivel: dados.evento === 'gpu_encerrada' ? 'error' : 'info', correlacaoId: incidenteId, dados });
      },
    });
    const aoEncerrar = (_evento: Electron.Event, detalhes: Electron.Details) => {
      if (detalhes.type === 'GPU') void diagnosticoGpu?.registrarFalha(detalhes.reason, detalhes.exitCode).catch(() => undefined);
    };
    const aoAtualizar = () => { void diagnosticoGpu?.atualizarAmbiente().catch(() => undefined); };
    app.on('child-process-gone', aoEncerrar);
    app.on('gpu-info-update', aoAtualizar);
    const aoSair = () => { void encerrarDiagnosticoGpu(); };
    app.once('will-quit', aoSair);
    removerObservadores = () => { app.removeListener('child-process-gone', aoEncerrar); app.removeListener('gpu-info-update', aoAtualizar); app.removeListener('will-quit', aoSair); };
    void app.whenReady().then(() => diagnosticoGpu?.iniciar()).catch(() => undefined);
  } catch {
    // A observação gráfica é auxiliar e não pode impedir a abertura do aplicativo.
    diagnosticoGpu = null;
  }
}

export async function conectarDiagnosticoGpu(servicoEventos: DiagnosticoEventosService, obterContexto: () => Record<string, unknown>): Promise<void> {
  eventos = servicoEventos; contexto = obterContexto;
  for (const pendente of pendentes.splice(0)) {
    await eventos.registrar({ origem: 'main', categoria: 'erro', nivel: 'error', correlacaoId: pendente.incidenteId, dados: pendente.dados }).catch(() => undefined);
  }
}

export function encerrarDiagnosticoGpu(): Promise<void> {
  if (encerramento) return encerramento;
  removerObservadores?.(); removerObservadores = null;
  encerramento = (diagnosticoGpu?.encerrar() ?? Promise.resolve()).catch(() => undefined).finally(() => { eventos = null; });
  return encerramento;
}
