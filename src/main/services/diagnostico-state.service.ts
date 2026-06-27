import fs from 'fs';
import os from 'os';
import path from 'path';
import { app } from 'electron';

type OrigemFalha = 'main' | 'renderer';

interface ContextoRendererDiagnostico {
  rota?: string;
  hash?: string;
  tituloJanela?: string;
  painelIlustracoes?: boolean;
  usuario?: Record<string, unknown> | null;
  contextoTela?: Record<string, unknown>;
  atualizadoEm?: string;
}

interface ErroRendererDiagnostico {
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  tipo: 'error' | 'unhandledrejection';
}

const DIAGNOSTICO_DIR = path.join(app.getPath('userData'), 'diagnostico-state-dumps');

let ultimoContextoRenderer: ContextoRendererDiagnostico | null = null;

function garantirDiretorioDiagnostico(): void {
  if (!fs.existsSync(DIAGNOSTICO_DIR)) {
    fs.mkdirSync(DIAGNOSTICO_DIR, { recursive: true });
  }
}

function gerarNomeArquivo(origem: OrigemFalha): string {
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  return `${iso}_${origem}_estado-snapshot.json`;
}

function sanitizarValor(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 5) {
    return '[profundidade_maxima]';
  }

  if (valor == null) {
    return valor;
  }

  if (typeof valor === 'string') {
    return valor.length > 500 ? `${valor.slice(0, 500)}...[truncado]` : valor;
  }

  if (typeof valor === 'number' || typeof valor === 'boolean') {
    return valor;
  }

  if (Array.isArray(valor)) {
    return valor.slice(0, 20).map(item => sanitizarValor(item, profundidade + 1));
  }

  if (typeof valor === 'object') {
    const entrada = valor as Record<string, unknown>;
    const saida: Record<string, unknown> = {};

    for (const [chave, conteudo] of Object.entries(entrada)) {
      const chaveNormalizada = chave.toLowerCase();

      if (
        chaveNormalizada.includes('senha')
        || chaveNormalizada.includes('password')
        || chaveNormalizada.includes('token')
        || chaveNormalizada.includes('secret')
        || chaveNormalizada.includes('api')
        || chaveNormalizada.includes('cpf')
        || chaveNormalizada.includes('rg')
        || chaveNormalizada.includes('email')
        || chaveNormalizada.includes('telefone')
        || chaveNormalizada.includes('foto')
        || chaveNormalizada.includes('avatar')
        || chaveNormalizada.includes('endereco')
      ) {
        saida[chave] = '[redigido]';
        continue;
      }

      saida[chave] = sanitizarValor(conteudo, profundidade + 1);
    }

    return saida;
  }

  return String(valor);
}

function obterResumoMemoria() {
  const memoriaProcesso = process.memoryUsage();

  return {
    rssMb: Math.round(memoriaProcesso.rss / 1024 / 1024),
    heapTotalMb: Math.round(memoriaProcesso.heapTotal / 1024 / 1024),
    heapUsedMb: Math.round(memoriaProcesso.heapUsed / 1024 / 1024),
    externalMb: Math.round(memoriaProcesso.external / 1024 / 1024),
    sistemaTotalMb: Math.round(os.totalmem() / 1024 / 1024),
    sistemaLivreMb: Math.round(os.freemem() / 1024 / 1024),
  };
}

function escreverSnapshot(origem: OrigemFalha, erro: Record<string, unknown>): string {
  garantirDiretorioDiagnostico();

  const snapshot = {
    timestamp: new Date().toISOString(),
    origem,
    erro: sanitizarValor(erro),
    renderer: sanitizarValor(ultimoContextoRenderer),
    processo: {
      pid: process.pid,
      platform: process.platform,
      arch: process.arch,
      node: process.versions.node,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      memoria: obterResumoMemoria(),
    },
    sistemaOperacional: {
      release: os.release(),
      version: os.version(),
      hostname: os.hostname(),
    },
  };

  const caminho = path.join(DIAGNOSTICO_DIR, gerarNomeArquivo(origem));
  fs.writeFileSync(caminho, JSON.stringify(snapshot, null, 2), 'utf-8');
  return caminho;
}

export function atualizarContextoRendererDiagnostico(contexto: ContextoRendererDiagnostico): void {
  ultimoContextoRenderer = {
    ...contexto,
    atualizadoEm: new Date().toISOString(),
  };
}

export function registrarErroFatalRendererDiagnostico(erro: ErroRendererDiagnostico): string {
  return escreverSnapshot('renderer', erro as unknown as Record<string, unknown>);
}

export function registrarErroFatalMainDiagnostico(erro: unknown, tipo: 'uncaughtException' | 'unhandledRejection'): string {
  const detalhe = erro instanceof Error
    ? { tipo, message: erro.message, stack: erro.stack }
    : { tipo, detail: String(erro) };

  return escreverSnapshot('main', detalhe);
}
