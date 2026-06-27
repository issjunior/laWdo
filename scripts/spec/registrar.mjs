import { executarRegistro } from './lib.mjs';

function lerArgumento(nome, args) {
  const indice = args.indexOf(nome);
  return indice >= 0 ? args[indice + 1] : null;
}

function temFlag(nome, args) {
  return args.includes(nome);
}

function imprimirAjuda() {
  console.log([
    'Uso: node scripts/spec/registrar.mjs [--plano ".codex/spec/plano-registrar.json"]',
    '',
    'O plano precisa conter:',
    '{',
    '  "headAuditado": "<sha-ou-sem-head>",',
    '  "instrucoes": [',
    '    { "acao": "atualizar", "arquivo": "spec/03 laudo/menu_contexto.md", "conteudo": "# ..." }',
    '  ]',
    '}'
  ].join('\n'));
}

try {
  const args = process.argv.slice(2);

  if (temFlag('--ajuda', args) || temFlag('-h', args)) {
    imprimirAjuda();
    process.exit(0);
  }

  const plano = lerArgumento('--plano', args) ?? undefined;
  const resumo = executarRegistro({ plano });

  console.log(`Plano aplicado: ${resumo.plano}`);
  console.log(`Criados: ${resumo.criados}`);
  console.log(`Atualizados: ${resumo.atualizados}`);
  console.log(`Inalterados: ${resumo.inalterados}`);

  if (resumo.arquivos.length) {
    console.log('');
    for (const arquivo of resumo.arquivos) {
      console.log(`- ${arquivo.acao}: ${arquivo.arquivo}`);
    }
  }
} catch (error) {
  console.error(`Erro no registro de spec: ${error.message}`);
  process.exit(1);
}
