import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function deveRepetirAnalise(codigo, saida) {
  return codigo !== 0 && /RangeError: Array buffer allocation failed/.test(saida) && /oxc-parser/.test(saida);
}

function executar(argumentos, ambiente) {
  const caminho = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../node_modules/knip/bin/knip.js');
  return new Promise((resolve, reject) => {
    let saida = '';
    const processo = spawn(process.execPath, [caminho, ...argumentos], { env: ambiente, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    processo.stdout.on('data', dados => process.stdout.write(dados));
    processo.stderr.on('data', dados => {
      saida = (saida + dados.toString()).slice(-32_768);
      process.stderr.write(dados);
    });
    processo.once('error', reject);
    processo.once('exit', codigo => resolve({ codigo: codigo ?? 1, saida }));
  });
}

async function principal() {
  const argumentos = process.argv.slice(2);
  let resultado = await executar(argumentos, process.env);
  if (process.env.KNIP_DISABLE_RAW_TRANSFER !== '1' && deveRepetirAnalise(resultado.codigo, resultado.saida)) {
    process.stderr.write('Knip: repetindo sem raw transfer após falha conhecida de alocação do oxc-parser.\n');
    resultado = await executar(argumentos, { ...process.env, KNIP_DISABLE_RAW_TRANSFER: '1' });
  }
  process.exitCode = resultado.codigo;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  principal().catch(erro => { process.stderr.write(`${erro instanceof Error ? erro.message : 'Falha ao executar Knip'}\n`); process.exitCode = 1; });
}
