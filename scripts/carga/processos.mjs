import { execFileSync } from 'node:child_process';

// Recebe apenas handles retornados pelos lançamentos deste executor.
export function encerrarProcessoCriado(processo, plataforma = process.platform, executarArquivo = execFileSync) {
  if (!processo || processo.exitCode !== null || processo.signalCode || !Number.isSafeInteger(processo.pid) || processo.pid <= 0) return;
  if (plataforma === 'win32') {
    executarArquivo('taskkill', ['/PID', String(processo.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } else processo.kill('SIGKILL');
}
