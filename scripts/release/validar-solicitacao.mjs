import { lerVersaoProjeto } from './versao-projeto.mjs';

function obterBooleano(nome) {
  return process.env[nome] === 'true';
}

function falhar(mensagem) {
  throw new Error(mensagem);
}

async function validarSolicitacao() {
  const plataformas = {
    windows: obterBooleano('INCLUIR_WINDOWS'),
    linux: obterBooleano('INCLUIR_LINUX'),
    macos: obterBooleano('INCLUIR_MACOS'),
  };
  const confirmacao = process.env.CONFIRMACAO_PLATAFORMAS_OMITIDAS?.trim().toUpperCase();
  const modo = process.env.MODO?.trim();
  const notasAtualizacao = process.env.NOTAS_ATUALIZACAO?.trim() ?? '';

  if (process.env.GITHUB_REF !== 'refs/heads/main') {
    falhar('A criação de release deve ser iniciada exclusivamente a partir da branch main.');
  }

  if (modo !== 'criar' && modo !== 'retomar') {
    falhar('O modo deve ser criar ou retomar.');
  }

  if (notasAtualizacao.length < 10 || /\bPENDENTE\b|<[^>]+>/i.test(notasAtualizacao)) {
    falhar('Informe um resumo final da atualização, sem placeholders, para o manifesto assinado.');
  }

  if (!Object.values(plataformas).some(Boolean)) {
    falhar('Selecione ao menos uma plataforma para a release.');
  }

  if (Object.values(plataformas).some(incluida => !incluida) && confirmacao !== 'CONFIRMO') {
    falhar('Para uma release parcial, informe CONFIRMO no campo de confirmação.');
  }

  const versao = await lerVersaoProjeto();

  process.stdout.write(
    `Solicitação válida sobre a versão atual ${versao}: ${Object.entries(plataformas)
      .filter(([, incluida]) => incluida)
      .map(([plataforma]) => plataforma)
      .join(', ')}.\n`
  );
}

validarSolicitacao().catch(erro => {
  process.stderr.write(`${erro instanceof Error ? erro.message : 'Erro inesperado'}\n`);
  process.exitCode = 1;
});
