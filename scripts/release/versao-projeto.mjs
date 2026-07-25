import { readFile } from 'node:fs/promises';

const versaoSemVerEstavel = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function falhar(mensagem) {
  throw new Error(mensagem);
}

export function validarVersaoSemVerEstavel(versao, origem) {
  if (!versaoSemVerEstavel.test(versao)) {
    falhar(`${origem} deve conter uma versão SemVer estável no formato X.Y.Z.`);
  }
}

export function incrementarVersaoPatch(versao) {
  validarVersaoSemVerEstavel(versao, 'A versão atual');
  const [major, minor, patch] = versao.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

export function obterVersaoProjeto(pacote, lock) {
  const versaoPacote = pacote?.version;
  const versaoLock = lock?.version;
  const versaoRaizLock = lock?.packages?.['']?.version;

  if (
    typeof versaoPacote !== 'string'
    || typeof versaoLock !== 'string'
    || typeof versaoRaizLock !== 'string'
  ) {
    falhar('package.json e package-lock.json devem declarar a versão do projeto.');
  }

  validarVersaoSemVerEstavel(versaoPacote, 'package.json');

  if (versaoLock !== versaoPacote || versaoRaizLock !== versaoPacote) {
    falhar(
      `Versões divergentes: package.json=${versaoPacote}, `
      + `package-lock.json=${versaoLock}, package-lock.json.packages[""]=${versaoRaizLock}.`
    );
  }

  return versaoPacote;
}

export function planejarVersaoProjeto({ versaoProjeto, ultimaVersaoPublicada, modo }) {
  validarVersaoSemVerEstavel(versaoProjeto, 'A versão do projeto');
  validarVersaoSemVerEstavel(ultimaVersaoPublicada, 'A última versão publicada');

  if (modo !== 'criar' && modo !== 'retomar') {
    falhar('O modo deve ser criar ou retomar.');
  }

  const proximaVersao = incrementarVersaoPatch(ultimaVersaoPublicada);

  if (versaoProjeto === ultimaVersaoPublicada) {
    if (modo === 'retomar') {
      falhar(`Não há versão preparada para retomada. A próxima versão esperada é ${proximaVersao}.`);
    }

    return {
      versao: proximaVersao,
      incrementar: true,
    };
  }

  if (versaoProjeto === proximaVersao) {
    return {
      versao: proximaVersao,
      incrementar: false,
    };
  }

  falhar(
    `A versão do projeto (${versaoProjeto}) deve ser a última publicada `
    + `(${ultimaVersaoPublicada}) ou o próximo patch (${proximaVersao}).`
  );
}

export async function lerVersaoProjeto() {
  const [pacote, lock] = await Promise.all([
    readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../../package-lock.json', import.meta.url), 'utf8'),
  ]);

  return obterVersaoProjeto(JSON.parse(pacote), JSON.parse(lock));
}
