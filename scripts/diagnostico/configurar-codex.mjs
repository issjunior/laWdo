import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const diretorioScript = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(diretorioScript, '..', '..');
const servidor = path.join(workspace, 'out', 'main', 'diagnostico-mcp.js');

if (!existsSync(servidor)) {
  console.error('Build do servidor MCP não encontrado. Execute npm run build antes de configurar o Codex.');
  process.exitCode = 1;
} else {
  const executar = argumentos => spawnSync('codex', argumentos, { cwd: workspace, encoding: 'utf8', shell: false });
  const existente = executar(['mcp', 'get', 'lawdoDiagnostico']);
  if (existente.status === 0) {
    const remocao = executar(['mcp', 'remove', 'lawdoDiagnostico']);
    if (remocao.status !== 0) {
      console.error(remocao.stderr || remocao.stdout || 'Não foi possível atualizar a configuração MCP existente.');
      process.exitCode = 1;
    }
  }
  if (!process.exitCode) {
    const adicao = executar(['mcp', 'add', 'lawdoDiagnostico', '--', 'node', servidor, workspace]);
    if (adicao.status !== 0) {
      console.error(adicao.stderr || adicao.stdout || 'Não foi possível configurar o servidor MCP do laWdo.');
      process.exitCode = 1;
    } else {
      console.log('Servidor MCP lawdoDiagnostico configurado. Reinicie o Codex antes de usar as ferramentas.');
    }
  }
}
