import { readFile, writeFile } from 'node:fs/promises';

import { normalizarManifesto } from './manifesto.mjs';
import { gerarNotasRelease } from './notas-release.mjs';

async function executar() {
  const caminhoManifesto = process.env.CAMINHO_MANIFESTO;
  const caminhoSaida = process.env.CAMINHO_SAIDA;
  const alteracoes = process.env.NOTAS_ATUALIZACAO;

  if (!caminhoManifesto || !caminhoSaida || !alteracoes) {
    throw new Error('Informe CAMINHO_MANIFESTO, CAMINHO_SAIDA e NOTAS_ATUALIZACAO.');
  }

  const manifesto = normalizarManifesto(JSON.parse(await readFile(caminhoManifesto, 'utf8')));
  await writeFile(caminhoSaida, gerarNotasRelease(manifesto, alteracoes), 'utf8');
}

executar().catch(erro => {
  process.stderr.write(`${erro instanceof Error ? erro.message : 'Erro inesperado'}\n`);
  process.exitCode = 1;
});
