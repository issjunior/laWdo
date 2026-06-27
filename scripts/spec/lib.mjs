import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const raizProjeto = path.resolve(__dirname, '..', '..');
const manifestoPath = path.join(raizProjeto, 'spec', '09 automacao-spec', 'manifesto.json');

function executarGit(args, permitirFalha = false) {
  try {
    return execFileSync('git', args, {
      cwd: raizProjeto,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    if (permitirFalha) {
      return '';
    }

    const detalhe = error.stderr?.toString?.().trim() || error.message;
    throw new Error(`Falha ao executar git ${args.join(' ')}: ${detalhe}`);
  }
}

function lerJson(caminho) {
  return JSON.parse(fs.readFileSync(caminho, 'utf8'));
}

function escreverArquivo(caminho, conteudo) {
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, conteudo, 'utf8');
}

function normalizarRelativo(caminho) {
  return caminho.replace(/\\/g, '/').replace(/^\.\//, '');
}

function relativoParaAbsoluto(caminhoRelativo) {
  return path.join(raizProjeto, caminhoRelativo);
}

function obterHeadAtual() {
  return executarGit(['rev-parse', 'HEAD'], true) || 'sem-head';
}

function obterArquivosUntracked() {
  const bruto = executarGit(['ls-files', '--others', '--exclude-standard'], true);
  if (!bruto) {
    return [];
  }

  return bruto
    .split(/\r?\n/)
    .map(normalizarRelativo)
    .filter(Boolean);
}

function obterArquivosMudadosDiff() {
  const diff = executarGit(['diff', '--name-only', 'HEAD', '--'], true);
  const arquivos = new Set();

  for (const origem of [diff, obterArquivosUntracked().join('\n')]) {
    if (!origem) {
      continue;
    }

    for (const linha of origem.split(/\r?\n/)) {
      const arquivo = normalizarRelativo(linha.trim());

      if (arquivo) {
        arquivos.add(arquivo);
      }
    }
  }

  return [...arquivos].sort();
}

function obterArquivosRepo() {
  const rastreados = executarGit(['ls-files'], true);
  const arquivos = new Set();

  for (const origem of [rastreados, obterArquivosUntracked().join('\n')]) {
    if (!origem) {
      continue;
    }

    for (const linha of origem.split(/\r?\n/)) {
      const arquivo = normalizarRelativo(linha.trim());

      if (arquivo) {
        arquivos.add(arquivo);
      }
    }
  }

  return [...arquivos].sort();
}

function globParaRegex(glob) {
  const marcador = '__GLOB_DUPLO__';
  const escapado = normalizarRelativo(glob)
    .replace(/\*\*/g, marcador)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
    .replace(new RegExp(marcador, 'g'), '.*');

  return new RegExp(`^${escapado}$`);
}

function correspondeAlgumGlob(caminho, globs = []) {
  const arquivo = normalizarRelativo(caminho);
  return globs.some(glob => globParaRegex(glob).test(arquivo));
}

function carregarManifesto() {
  const manifesto = lerJson(manifestoPath);
  return {
    ...manifesto,
    caminho: 'spec/09 automacao-spec/manifesto.json'
  };
}

function garantirDiretorioEstado(manifesto) {
  fs.mkdirSync(relativoParaAbsoluto(manifesto.artefatos.diretorioEstado), { recursive: true });
}

function extrairCommitGraphify() {
  const caminhoRel = 'graphify-out/GRAPH_REPORT.md';
  const caminhoAbs = relativoParaAbsoluto(caminhoRel);

  if (!fs.existsSync(caminhoAbs)) {
    return {
      caminho: caminhoRel,
      existe: false
    };
  }

  const conteudo = fs.readFileSync(caminhoAbs, 'utf8');
  const match = conteudo.match(/Built from commit:\s*`([^`]+)`/);

  return {
    caminho: caminhoRel,
    existe: true,
    commit: match?.[1] ?? null
  };
}

function filtrarArquivosRelevantes(arquivos) {
  return arquivos.filter(arquivo => {
    if (!arquivo) {
      return false;
    }

    const normalizado = normalizarRelativo(arquivo);

    if (normalizado.startsWith('.codex/')) return false;
    if (normalizado.startsWith('node_modules/')) return false;
    if (normalizado.startsWith('out/')) return false;
    if (normalizado.startsWith('dist/')) return false;
    if (normalizado.startsWith('build/')) return false;
    if (normalizado.startsWith('release/')) return false;
    if (normalizado.startsWith('graphify-out/')) return false;
    if (normalizado.startsWith('spec/') && normalizado !== 'spec/09 automacao-spec/manifesto.json') return false;
    if (normalizado === '.gitignore') return true;

    return true;
  });
}

function obterSpecsEstadoAtual(manifesto) {
  return manifesto.specs.filter(spec => spec.tipo === 'estado_atual');
}

function coletarSubdiretoriosTocados(arquivos, manifesto) {
  const subdirs = new Set();

  for (const arquivo of arquivos) {
    for (const grupo of manifesto.gruposSugestao) {
      if (correspondeAlgumGlob(arquivo, grupo.globsCodigo)) {
        subdirs.add(grupo.subdiretorio);
      }
    }
  }

  return [...subdirs].sort();
}

function resolverBaseArquivos({ modo = 'diff', alvo = null }, manifesto) {
  if (modo === 'total') {
    return filtrarArquivosRelevantes(obterArquivosRepo());
  }

  if (modo === 'focado') {
    if (!alvo) {
      throw new Error('Modo focado exige --alvo.');
    }

    const specs = obterSpecsEstadoAtual(manifesto).filter(spec =>
      spec.arquivo.startsWith(`spec/${alvo}/`)
    );

    const todos = obterArquivosRepo();
    const base = todos.filter(arquivo =>
      specs.some(spec => correspondeAlgumGlob(arquivo, spec.globsCodigo))
    );

    return filtrarArquivosRelevantes(base);
  }

  return filtrarArquivosRelevantes(obterArquivosMudadosDiff());
}

function construirResumoSpecs(specsComMudanca) {
  return specsComMudanca.map(item => ({
    arquivo: item.spec.arquivo,
    descricao: item.spec.descricao,
    motivos: item.motivos
  }));
}

function construirSugestoesNovosSpecs(arquivosSemCobertura, manifesto) {
  const sugestoes = new Map();

  for (const arquivo of arquivosSemCobertura) {
    const grupo = manifesto.gruposSugestao.find(item =>
      correspondeAlgumGlob(arquivo, item.globsCodigo)
    );

    if (!grupo) {
      continue;
    }

    const chave = grupo.subdiretorio;
    const atual = sugestoes.get(chave) ?? {
      subdiretorio: chave,
      descricao: grupo.descricao,
      arquivos: []
    };

    atual.arquivos.push(arquivo);
    sugestoes.set(chave, atual);
  }

  return [...sugestoes.values()]
    .map(item => ({
      ...item,
      arquivos: item.arquivos.sort()
    }))
    .sort((a, b) => a.subdiretorio.localeCompare(b.subdiretorio));
}

function formatarListaArquivos(arquivos) {
  if (!arquivos.length) {
    return 'Nenhum.';
  }

  return arquivos.map(arquivo => `\`${arquivo}\``).join(', ');
}

function formatarRelatorioMarkdown(auditoria) {
  if (!auditoria.baseArquivos.length) {
    return '## /spec — Relatório\n\nNenhuma alteração relevante detectada para auditoria de spec.';
  }

  const linhas = [
    '## /spec — Relatório',
    '',
    `**Modo:** ${auditoria.rotuloModo}`,
    `**Modelo IA:** ${auditoria.modeloIa}`,
    `**Base:** ${formatarListaArquivos(auditoria.baseArquivos)}`,
    '',
    '### Specs que precisam de atualização'
  ];

  if (auditoria.specsQuePrecisam.length) {
    for (const spec of auditoria.specsQuePrecisam) {
      linhas.push(`- \`${spec.arquivo}\` — ${spec.descricao} | fontes: ${formatarListaArquivos(spec.motivos)}`);
    }
  } else {
    linhas.push('- Nenhum.');
  }

  linhas.push('', '### Specs sem alterações necessárias');

  if (auditoria.specsSemMudanca.length) {
    for (const arquivo of auditoria.specsSemMudanca) {
      linhas.push(`- \`${arquivo}\``);
    }
  } else {
    linhas.push('- Nenhum.');
  }

  linhas.push('', '### Sugestão de novo spec');

  if (auditoria.sugestoesNovoSpec.length) {
    for (const sugestao of auditoria.sugestoesNovoSpec) {
      linhas.push(`- \`spec/${sugestao.subdiretorio}/\` — ${sugestao.descricao} | arquivos sem cobertura: ${formatarListaArquivos(sugestao.arquivos)}`);
    }
  } else {
    linhas.push('- Nenhuma.');
  }

  if (auditoria.avisos.length) {
    linhas.push('', '### Observações');
    for (const aviso of auditoria.avisos) {
      linhas.push(`- ${aviso}`);
    }
  }

  return linhas.join('\n');
}

export function executarAuditoria({
  modo = 'diff',
  alvo = null,
  modeloIa = process.env.CODEX_MODEL_NAME || 'gpt-5'
} = {}) {
  const manifesto = carregarManifesto();
  garantirDiretorioEstado(manifesto);

  const baseArquivos = resolverBaseArquivos({ modo, alvo }, manifesto);
  const specsEstadoAtual = obterSpecsEstadoAtual(manifesto);
  const specsComMudanca = [];
  const arquivosCobertos = new Set();

  for (const spec of specsEstadoAtual) {
    const motivos = baseArquivos.filter(arquivo => correspondeAlgumGlob(arquivo, spec.globsCodigo));

    if (motivos.length) {
      specsComMudanca.push({
        spec,
        motivos
      });

      for (const arquivo of motivos) {
        arquivosCobertos.add(arquivo);
      }
    }
  }

  const subdiretoriosTocados = modo === 'focado'
    ? [alvo]
    : coletarSubdiretoriosTocados(baseArquivos, manifesto);

  const specsSemMudanca = specsEstadoAtual
    .filter(spec => subdiretoriosTocados.some(subdir => spec.arquivo.startsWith(`spec/${subdir}/`)))
    .filter(spec => !specsComMudanca.some(item => item.spec.arquivo === spec.arquivo))
    .map(spec => spec.arquivo)
    .sort();

  const arquivosSemCobertura = baseArquivos.filter(arquivo => !arquivosCobertos.has(arquivo));
  const sugestoesNovoSpec = construirSugestoesNovosSpecs(arquivosSemCobertura, manifesto);

  const headAuditado = obterHeadAtual();
  const infoGraphify = extrairCommitGraphify();
  const avisos = [];

  if (!infoGraphify.existe) {
    avisos.push('`graphify-out/GRAPH_REPORT.md` não encontrado; a auditoria usou apenas diff e manifesto.');
  } else if (infoGraphify.commit && infoGraphify.commit !== headAuditado) {
    avisos.push(`Grafo estrutural possivelmente desatualizado: commit do graphify = \`${infoGraphify.commit}\`, HEAD atual = \`${headAuditado}\`.`);
  }

  if (!specsComMudanca.length && !sugestoesNovoSpec.length && baseArquivos.length) {
    avisos.push('Nenhum spec de estado atual foi mapeado como impactado pelas mudanças analisadas.');
  }

  const rotuloModo = modo === 'focado'
    ? `focado: ${alvo}`
    : modo === 'total'
      ? 'auditoria total'
      : 'padrão (git diff)';

  const auditoria = {
    versao: manifesto.versao,
    geradoEm: new Date().toISOString(),
    headAuditado,
    modo,
    alvo,
    rotuloModo,
    modeloIa,
    baseArquivos,
    specsQuePrecisam: construirResumoSpecs(specsComMudanca),
    specsSemMudanca,
    sugestoesNovoSpec,
    avisos,
    manifesto: manifesto.caminho,
    artefatos: manifesto.artefatos
  };

  auditoria.relatorioMarkdown = formatarRelatorioMarkdown(auditoria);

  escreverArquivo(relativoParaAbsoluto(manifesto.artefatos.arquivoAuditoria), `${JSON.stringify(auditoria, null, 2)}\n`);
  escreverArquivo(relativoParaAbsoluto(manifesto.artefatos.arquivoRelatorio), `${auditoria.relatorioMarkdown}\n`);

  return auditoria;
}

function validarCaminhoSpec(caminhoRelativo) {
  const normalizado = normalizarRelativo(caminhoRelativo);

  if (!normalizado.startsWith('spec/')) {
    throw new Error(`Registro recusado: "${normalizado}" está fora de spec/.`);
  }

  const absoluto = path.resolve(raizProjeto, normalizado);
  const pastaSpec = path.resolve(raizProjeto, 'spec');

  if (!absoluto.startsWith(pastaSpec)) {
    throw new Error(`Registro recusado: "${normalizado}" resolve fora do diretório spec/.`);
  }

  return {
    absoluto,
    relativo: normalizado
  };
}

export function executarRegistro({ plano = null } = {}) {
  const manifesto = carregarManifesto();
  garantirDiretorioEstado(manifesto);

  const caminhoPlano = plano ?? manifesto.artefatos.arquivoPlanoRegistrar;
  const caminhoPlanoAbs = relativoParaAbsoluto(caminhoPlano);

  if (!fs.existsSync(caminhoPlanoAbs)) {
    throw new Error(`Plano de registro não encontrado em "${caminhoPlano}".`);
  }

  const planoRegistro = lerJson(caminhoPlanoAbs);
  const headAtual = obterHeadAtual();

  if (!Array.isArray(planoRegistro.instrucoes) || !planoRegistro.instrucoes.length) {
    throw new Error('Plano de registro inválido: nenhuma instrução encontrada.');
  }

  if (planoRegistro.headAuditado && planoRegistro.headAuditado !== headAtual) {
    throw new Error(`HEAD divergente. Auditoria foi gerada em "${planoRegistro.headAuditado}" e o repositório agora está em "${headAtual}". Rode nova auditoria antes de registrar.`);
  }

  let criados = 0;
  let atualizados = 0;
  let inalterados = 0;
  const arquivos = [];

  for (const instrucao of planoRegistro.instrucoes) {
    if (!instrucao || typeof instrucao !== 'object') {
      throw new Error('Plano de registro inválido: instrução malformada.');
    }

    const { absoluto, relativo } = validarCaminhoSpec(instrucao.arquivo);

    if (typeof instrucao.conteudo !== 'string') {
      throw new Error(`Plano de registro inválido: conteúdo ausente para "${relativo}".`);
    }

    const existia = fs.existsSync(absoluto);
    const anterior = existia ? fs.readFileSync(absoluto, 'utf8') : null;
    const proximo = instrucao.conteudo.endsWith('\n') ? instrucao.conteudo : `${instrucao.conteudo}\n`;

    if (anterior === proximo) {
      inalterados += 1;
      arquivos.push({ arquivo: relativo, acao: 'inalterado' });
      continue;
    }

    escreverArquivo(absoluto, proximo);

    if (existia) {
      atualizados += 1;
      arquivos.push({ arquivo: relativo, acao: 'atualizado' });
    } else {
      criados += 1;
      arquivos.push({ arquivo: relativo, acao: 'criado' });
    }
  }

  return {
    geradoEm: new Date().toISOString(),
    headAtual,
    plano: caminhoPlano,
    criados,
    atualizados,
    inalterados,
    arquivos
  };
}
