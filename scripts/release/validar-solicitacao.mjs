import { readFile } from 'node:fs/promises'

const versaoSemVer = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

function obterBooleano(nome) {
  return process.env[nome] === 'true'
}

function falhar(mensagem) {
  throw new Error(mensagem)
}

async function validarSolicitacao() {
  const versao = process.env.VERSAO?.trim() ?? ''
  const plataformas = {
    windows: obterBooleano('INCLUIR_WINDOWS'),
    linux: obterBooleano('INCLUIR_LINUX'),
    macos: obterBooleano('INCLUIR_MACOS'),
  }
  const confirmacao = process.env.CONFIRMACAO_PLATAFORMAS_OMITIDAS?.trim().toUpperCase()

  if (process.env.GITHUB_REF !== 'refs/heads/main') {
    falhar('A criação de release deve ser iniciada exclusivamente a partir da branch main.')
  }

  if (!versaoSemVer.test(versao)) {
    falhar('A versão informada deve respeitar o formato SemVer.')
  }

  if (!Object.values(plataformas).some(Boolean)) {
    falhar('Selecione ao menos uma plataforma para a release.')
  }

  if (Object.values(plataformas).some((incluida) => !incluida) && confirmacao !== 'CONFIRMO') {
    falhar('Para uma release parcial, informe CONFIRMO no campo de confirmação.')
  }

  const pacote = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
  if (pacote.version !== versao) {
    falhar(`A versão informada (${versao}) deve coincidir com package.json (${pacote.version}).`)
  }

  process.stdout.write(`Solicitação válida para v${versao}: ${Object.entries(plataformas)
    .filter(([, incluida]) => incluida)
    .map(([plataforma]) => plataforma)
    .join(', ')}.\n`)
}

validarSolicitacao().catch((erro) => {
  process.stderr.write(`${erro instanceof Error ? erro.message : 'Erro inesperado'}\n`)
  process.exitCode = 1
})
