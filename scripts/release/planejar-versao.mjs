import { appendFile } from 'node:fs/promises';

import { lerVersaoProjeto, planejarVersaoProjeto } from './versao-projeto.mjs';

async function planejar() {
  const ultimaVersaoPublicada = process.env.ULTIMA_VERSAO_PUBLICADA?.trim() ?? '';
  const modo = process.env.MODO?.trim() ?? '';
  const saidaGitHub = process.env.GITHUB_OUTPUT;
  const versaoProjeto = await lerVersaoProjeto();
  const planejamento = planejarVersaoProjeto({
    versaoProjeto,
    ultimaVersaoPublicada,
    modo,
  });

  if (!saidaGitHub) {
    throw new Error('GITHUB_OUTPUT não foi informado.');
  }

  await appendFile(
    saidaGitHub,
    `versao=${planejamento.versao}\nincrementar=${planejamento.incrementar}\n`,
    'utf8'
  );
  process.stdout.write(
    planejamento.incrementar
      ? `O projeto será atualizado automaticamente de ${versaoProjeto} para ${planejamento.versao}.\n`
      : `A versão ${planejamento.versao} já está preparada; o fluxo continuará sem novo incremento.\n`
  );
}

planejar().catch(erro => {
  process.stderr.write(`${erro instanceof Error ? erro.message : 'Erro inesperado'}\n`);
  process.exitCode = 1;
});
