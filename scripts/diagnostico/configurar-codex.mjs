import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const diretorioScript = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(diretorioScript, '..', '..');
const servidor = path.join(workspace, 'out', 'main', 'diagnostico-mcp.js');

const mensagemFalha = (resultado, fallback) => {
  const detalhes = [resultado.error?.message, resultado.stderr, resultado.stdout]
    .filter(valor => typeof valor === 'string' && valor.trim())
    .map(valor => valor.trim());
  return detalhes.join('\n') || fallback;
};

const obterExecutavelCodex = () => {
  if (process.platform !== 'win32') return 'codex';

  const diretorioBin = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin')
    : null;
  if (!diretorioBin || !existsSync(diretorioBin)) return 'codex';

  try {
    const executavel = readdirSync(diretorioBin, { withFileTypes: true })
      .filter(entrada => entrada.isDirectory())
      .map(entrada => path.join(diretorioBin, entrada.name, 'codex.exe'))
      .find(existe => existsSync(existe));
    return executavel ?? 'codex';
  } catch {
    return 'codex';
  }
};

if (!existsSync(servidor)) {
  console.error('Build do servidor MCP não encontrado. Execute npm run build antes de configurar o Codex.');
  process.exitCode = 1;
} else {
  const executar = argumentos => spawnSync(obterExecutavelCodex(), argumentos, { cwd: workspace, encoding: 'utf8', shell: false });
  const existente = executar(['mcp', 'get', 'lawdoDiagnostico']);
  if (existente.status === 0) {
    const remocao = executar(['mcp', 'remove', 'lawdoDiagnostico']);
    if (remocao.status !== 0) {
      console.error(mensagemFalha(remocao, 'Não foi possível atualizar a configuração MCP existente.'));
      process.exitCode = 1;
    }
  }
  if (!process.exitCode) {
    const adicao = executar(['mcp', 'add', 'lawdoDiagnostico', '--', process.execPath, servidor, workspace]);
    if (adicao.status !== 0) {
      console.error(mensagemFalha(adicao, 'Não foi possível configurar o servidor MCP do laWdo.'));
      process.exitCode = 1;
    } else {
      console.log('Servidor MCP lawdoDiagnostico configurado. Reinicie o Codex antes de usar as ferramentas.');
    }
  }
}
