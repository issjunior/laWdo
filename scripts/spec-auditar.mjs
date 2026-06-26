import { executarAuditoria } from './spec-lib.mjs';

function lerArgumento(nome, args) {
  const indice = args.indexOf(nome);
  return indice >= 0 ? args[indice + 1] : null;
}

function temFlag(nome, args) {
  return args.includes(nome);
}

function imprimirAjuda() {
  console.log([
    'Uso: node scripts/spec-auditar.mjs [--modo diff|total|focado] [--alvo "<subdiretorio>"] [--modelo "<nome>"]',
    '',
    'Exemplos:',
    '  node scripts/spec-auditar.mjs',
    '  node scripts/spec-auditar.mjs --modo total',
    '  node scripts/spec-auditar.mjs --modo focado --alvo "03 laudo"'
  ].join('\n'));
}

try {
  const args = process.argv.slice(2);

  if (temFlag('--ajuda', args) || temFlag('-h', args)) {
    imprimirAjuda();
    process.exit(0);
  }

  const modo = lerArgumento('--modo', args) ?? (lerArgumento('--alvo', args) ? 'focado' : 'diff');
  const alvo = lerArgumento('--alvo', args);
  const modeloIa = lerArgumento('--modelo', args) ?? undefined;

  const auditoria = executarAuditoria({ modo, alvo, modeloIa });
  console.log(auditoria.relatorioMarkdown);
  console.log('');
  console.log(`Artefato JSON: ${auditoria.artefatos.arquivoAuditoria}`);
  console.log(`Relatório Markdown: ${auditoria.artefatos.arquivoRelatorio}`);
} catch (error) {
  console.error(`Erro na auditoria de spec: ${error.message}`);
  process.exit(1);
}
