import { executarAuditoria, executarRegistro } from './spec-lib.mjs';

function lerArgumento(nome, args) {
  const indice = args.indexOf(nome);
  return indice >= 0 ? args[indice + 1] : null;
}

function temFlag(nome, args) {
  return args.includes(nome);
}

function imprimirAjuda() {
  console.log([
    'Uso:',
    '  node scripts/spec.mjs',
    '  node scripts/spec.mjs auditar [--modo diff|total|focado] [--alvo "<subdiretorio>"]',
    '  node scripts/spec.mjs registrar [--plano ".codex/spec/plano-registrar.json"]',
    '',
    'Sem subcomando, o script executa a auditoria padrão (git diff).'
  ].join('\n'));
}

try {
  const args = process.argv.slice(2);

  if (temFlag('--ajuda', args) || temFlag('-h', args)) {
    imprimirAjuda();
    process.exit(0);
  }

  const [subcomando, ...resto] = args;

  if (!subcomando || subcomando === 'auditar') {
    const modo = lerArgumento('--modo', resto) ?? (lerArgumento('--alvo', resto) ? 'focado' : 'diff');
    const alvo = lerArgumento('--alvo', resto);
    const modeloIa = lerArgumento('--modelo', resto) ?? undefined;
    const auditoria = executarAuditoria({ modo, alvo, modeloIa });

    console.log(auditoria.relatorioMarkdown);
    console.log('');
    console.log(`Próximo passo: revisar ${auditoria.artefatos.arquivoRelatorio} e, se aprovar, gerar ${auditoria.artefatos.arquivoPlanoRegistrar} para usar com "npm run spec:registrar".`);
    process.exit(0);
  }

  if (subcomando === 'registrar') {
    const plano = lerArgumento('--plano', resto) ?? undefined;
    const resumo = executarRegistro({ plano });
    console.log(`Registro concluído. Criados: ${resumo.criados}, atualizados: ${resumo.atualizados}, inalterados: ${resumo.inalterados}.`);
    process.exit(0);
  }

  throw new Error(`Subcomando desconhecido: ${subcomando}`);
} catch (error) {
  console.error(`Erro no fluxo spec: ${error.message}`);
  process.exit(1);
}
