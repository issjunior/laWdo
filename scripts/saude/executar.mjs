import { spawn } from 'node:child_process';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = process.cwd();
const inicio = new Date();
const identificador = inicio.toISOString().replace(/[:.]/g, '-');
const diretorio = path.join(raiz, 'tmp', 'saude', identificador);
const incluirInstalacaoLimpa = process.argv.includes('--instalacao-limpa');
const pularPacote = process.argv.includes('--sem-pacote');
const caminhoPainel = path.join(raiz, 'spec', 'problemas diversos', 'erros_eslint_typescript_testes_codigomorto', '00_saude_do_sistema.md');

const fasesPadrao = [
  ['dependencias', 'npm', ['ls', '--depth=0'], 'bloqueante'],
  ['tipagem', 'npm', ['run', 'type-check'], 'bloqueante'],
  ['lint', 'npm', ['run', 'lint'], 'bloqueante'],
  ['cobertura', 'npm', ['run', 'test:coverage'], 'bloqueante'],
  ['release', 'npm', ['run', 'test:release'], 'bloqueante'],
  ['carga', 'npm', ['run', 'test:carga:unitarios'], 'bloqueante'],
  ['saude_scripts', 'npm', ['run', 'test:saude'], 'bloqueante'],
  ['build', 'npm', ['run', 'build'], 'bloqueante'],
  ['knip', process.execPath, ['scripts/check-knip.mjs', '--no-exit-code', '--reporter', 'json'], 'observacional'],
  ['codigo_morto', 'npm', ['run', 'dead-code:check'], 'observacional'],
  ['schema', 'npm', ['run', 'smoke:schema'], 'bloqueante'],
  ['auditoria_completa', 'npm', ['audit', '--json'], 'observacional'],
  ['auditoria_producao', 'npm', ['audit', '--omit=dev', '--json'], 'bloqueante'],
];

export function extrairResumoCobertura(saida) {
  const correspondencia = saida.match(/All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
  if (!correspondencia) return undefined;
  return { statements: Number(correspondencia[1]), branches: Number(correspondencia[2]), functions: Number(correspondencia[3]), lines: Number(correspondencia[4]) };
}

export function extrairResumoTestes(saida) {
  const arquivos = saida.match(/Test Files\s+(\d+) passed/);
  const testes = saida.match(/Tests\s+(\d+) passed/);
  return arquivos && testes ? { arquivos: Number(arquivos[1]), testes: Number(testes[1]) } : undefined;
}

export function extrairMaiorChunk(saida) {
  const tamanhos = [...saida.matchAll(/\s([\d.]+) kB(?:\s*│|$)/gm)].map(correspondencia => Number(correspondencia[1]));
  return tamanhos.length ? Math.max(...tamanhos) : undefined;
}

export function extrairAuditoria(saida) {
  return extrairUltimoJson(saida)?.metadata?.vulnerabilities;
}

export function extrairUltimoJson(saida) {
  try {
    return JSON.parse(saida.trim());
  } catch {
    // Saídas compostas podem conter cabeçalhos antes do JSON final.
  }
  for (const linha of saida.trim().split(/\r?\n/).reverse()) {
    try {
      return JSON.parse(linha);
    } catch {
      continue;
    }
  }
  return undefined;
}

export function extrairKnip(saida) {
  const dados = extrairUltimoJson(saida);
  if (!Array.isArray(dados?.issues)) return undefined;
  const achados = dados.issues.reduce((total, item) => total + Object.entries(item)
    .filter(([chave, valor]) => chave !== 'file' && chave !== 'owners' && Array.isArray(valor))
    .reduce((subtotal, [, valor]) => subtotal + valor.length, 0), 0);
  return { arquivos: dados.issues.length, achados };
}

export function extrairCandidatosTsPrune(saida) {
  return saida.split(/\r?\n/).filter(linha => /^\\[^:]+:\d+\s+-\s+/.test(linha)).length;
}

export function extrairVersaoSchema(saida) {
  return Number(saida.match(/versão\s+(\d+)/i)?.[1]) || undefined;
}

export function auditoriaAceitavel(nome, auditoria) {
  if (!auditoria) return false;
  if (nome === 'auditoria_producao') return auditoria.total === 0;
  return (auditoria.high ?? 0) === 0 && (auditoria.critical ?? 0) === 0;
}

export function classificarFase(nome, codigo, saida) {
  if (nome === 'knip') {
    const knip = extrairKnip(saida);
    if (codigo !== 0 || !knip) return { resultado: 'falha', detalhe: 'Knip não gerou relatório JSON válido.' };
    return { resultado: knip.achados ? 'alerta' : 'aprovado', detalhe: `${knip.achados} achado(s) em ${knip.arquivos} arquivo(s).`, knip };
  }
  if (nome === 'codigo_morto') {
    if (codigo !== 0) return { resultado: 'falha', detalhe: 'ts-prune não concluiu a varredura.' };
    const candidatos = extrairCandidatosTsPrune(saida);
    return { resultado: candidatos ? 'alerta' : 'aprovado', detalhe: candidatos ? `${candidatos} candidato(s) requer(em) revisão humana.` : 'Nenhum candidato retornado.', candidatos };
  }
  if (nome.startsWith('auditoria')) {
    const auditoria = extrairAuditoria(saida);
    if (!auditoria) return { resultado: 'falha', detalhe: 'npm audit não gerou relatório JSON válido.' };
    if (!auditoriaAceitavel(nome, auditoria)) return { resultado: 'falha', detalhe: 'Foram encontradas vulnerabilidades bloqueantes.', auditoria };
    const total = auditoria.total ?? 0;
    return { resultado: total ? 'alerta' : 'aprovado', detalhe: total ? `${total} alerta(s) não bloqueante(s).` : 'Sem vulnerabilidades.', auditoria };
  }
  return codigo === 0 ? { resultado: 'aprovado', detalhe: 'Aprovado.' } : { resultado: 'falha', detalhe: 'Comando retornou erro.' };
}

function formatarNumero(valor, casas = 2) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(valor);
}

function formatarData(data) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(data));
}

function resultadoPorNome(resumo, nome) {
  return resumo.fases.find(fase => fase.nome === nome);
}

function linhaFase(resumo, nome, rotulo) {
  const fase = resultadoPorNome(resumo, nome);
  return `| ${rotulo} | ${fase?.resultado === 'aprovado' ? 'Aprovado' : fase?.detalhe ?? 'Não executado'} |`;
}

export function gerarPainel(resumo) {
  const { metricas } = resumo;
  const cobertura = metricas.cobertura;
  const testes = metricas.testes;
  const instalacaoLimpa = resumo.instalacaoLimpa ? 'Instalação limpa aprovada.' : 'Sem instalação limpa nesta execução.';
  const bloqueantes = [
    linhaFase(resumo, 'dependencias', 'Dependências'), linhaFase(resumo, 'tipagem', 'Tipagem'), linhaFase(resumo, 'lint', 'Lint'),
    `| Cobertura | ${testes && cobertura ? `${testes.testes} testes em ${testes.arquivos} arquivos; statements/branches/funções/linhas: ${formatarNumero(cobertura.statements)}% / ${formatarNumero(cobertura.branches)}% / ${formatarNumero(cobertura.functions)}% / ${formatarNumero(cobertura.lines)}%.` : 'Aprovada.'} |`,
    linhaFase(resumo, 'release', 'Testes de release'), linhaFase(resumo, 'carga', 'Testes de carga'), linhaFase(resumo, 'saude_scripts', 'Testes do executor'),
    `| Build | Aprovado${metricas.maiorChunkKb ? `; maior chunk: ${formatarNumero(metricas.maiorChunkKb)} kB.` : '.'} |`,
    `| Schema | Aprovado${metricas.versaoSchema ? `; versão ${metricas.versaoSchema}.` : '.'} |`,
    linhaFase(resumo, 'auditoria_producao', 'Auditoria de produção'), linhaFase(resumo, 'pacote', 'Pacote Windows'), linhaFase(resumo, 'smoke_imagens', 'Smoke de imagens'), linhaFase(resumo, 'diff', 'Integridade do diff'),
  ];
  const knip = metricas.knip;
  const auditoria = metricas.auditoria_completa;
  const observacoes = [
    `| Knip | ${knip ? `${knip.achados} achado(s) em ${knip.arquivos} arquivo(s).` : resultadoPorNome(resumo, 'knip')?.detalhe ?? 'Não executado.'} |`,
    `| ts-prune | ${resultadoPorNome(resumo, 'codigo_morto')?.detalhe ?? 'Não executado.'} |`,
    `| Auditoria completa | ${auditoria ? `${auditoria.total ?? 0} alerta(s): moderados ${auditoria.moderate ?? 0}, altos ${auditoria.high ?? 0}, críticos ${auditoria.critical ?? 0}.` : 'Não executada.'} |`,
  ];
  return `# Painel de Saúde do Sistema\n\n> Gerado automaticamente em ${formatarData(resumo.fim)} a partir de \`${path.relative(raiz, resumo.diretorio)}\\resumo.json\`. Estado da árvore de trabalho; não representa validação remota de CI.\n\n## Evidência da execução\n\n- Ambiente: Node ${resumo.ambiente.node} / npm ${resumo.ambiente.npm}. ${instalacaoLimpa}\n- Execução completa: pacote e smoke Windows incluídos.\n- Logs por fase: \`${path.relative(raiz, resumo.diretorio)}\`.\n\n## Gates bloqueantes aprovados\n\n| Frente | Evidência |\n|---|---|\n${bloqueantes.join('\n')}\n\n## Observações que exigem análise\n\n| Frente | Evidência |\n|---|---|\n${observacoes.join('\n')}\n\nOs achados observacionais não autorizam remoção automática. O grafo ajuda a localizar relações, mas consumidores, usos dinâmicos e entrypoints precisam ser confirmados no código antes de remover símbolos; consulte \`DEAD_CODE_EXCEPTIONS.md\` para falsos positivos já validados.\n\n## Limites da evidência\n\nA cobertura é serializada para evitar contenção entre SQLite, arquivos temporários e LibreOffice. O smoke de imagens usa perfil isolado e massa sintética; ele não equivale a validar um laudo real, o editor, o GDL ou a estabilidade prolongada de memória.\n\nA auditoria completa pode registrar alertas transitivos moderados. Vulnerabilidades altas, críticas ou de produção impedem a aprovação.\n`;
}

export function deveAtualizarPainel(resumo) {
  return resumo.sucesso && resumo.completa;
}

async function atualizarPainel(resumo) {
  const temporario = `${caminhoPainel}.${process.pid}.tmp`;
  await writeFile(temporario, gerarPainel(resumo), 'utf8');
  await rename(temporario, caminhoPainel);
}

function executar(comando, argumentos, indice) {
  return new Promise((resolve, reject) => {
    const usarCliNpm = process.platform === 'win32' && comando === 'npm' && process.env.npm_execpath;
    const executavel = usarCliNpm ? process.execPath : comando;
    const argumentosExecutaveis = usarCliNpm ? [process.env.npm_execpath, ...argumentos] : argumentos;
    const processo = spawn(executavel, argumentosExecutaveis, { cwd: raiz, env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let saida = '';
    const registrar = dados => { saida += dados.toString(); };
    processo.stdout.on('data', registrar);
    processo.stderr.on('data', registrar);
    processo.once('error', reject);
    processo.once('exit', async codigo => {
      const arquivo = path.join(diretorio, `${String(indice).padStart(2, '0')}-${comando.replace(/[^a-z0-9]/gi, '-')}.log`);
      await writeFile(arquivo, saida, 'utf8');
      resolve({ codigo: codigo ?? 1, saida, arquivo });
    });
  });
}

async function principal() {
  await mkdir(diretorio, { recursive: true });
  const versaoNpm = process.env.npm_config_user_agent?.match(/npm\/([^\s]+)/)?.[1] ?? 'não informada';
  const resumo = { versao: 2, inicio: inicio.toISOString(), diretorio, completa: !pularPacote, instalacaoLimpa: incluirInstalacaoLimpa, ambiente: { node: process.version.replace(/^v/, ''), npm: versaoNpm }, sucesso: false, fases: [], metricas: {} };
  const fases = [
    ...(incluirInstalacaoLimpa ? [['instalacao_limpa', 'npm', ['ci', '--strict-allow-scripts'], 'bloqueante']] : []),
    ...fasesPadrao,
    ...(!pularPacote ? [['pacote', 'npm', ['run', 'pack'], 'bloqueante'], ['smoke_imagens', 'npm', ['run', 'smoke:imagens', '--', '--executavel', 'dist/win-unpacked/laWdo.exe'], 'bloqueante']] : []),
    ['diff', 'git', ['diff', '--check'], 'bloqueante'],
  ];
  try {
    for (const [nome, comando, argumentos, criticidade] of fases) {
      const iniciadoEm = Date.now();
      const resultado = await executar(comando, argumentos, resumo.fases.length + 1);
      const classificacao = classificarFase(nome, resultado.codigo, resultado.saida);
      const fase = { nome, criticidade, codigo: resultado.codigo, resultado: classificacao.resultado, detalhe: classificacao.detalhe, duracaoMs: Date.now() - iniciadoEm, log: path.relative(raiz, resultado.arquivo) };
      resumo.fases.push(fase);
      if (nome === 'cobertura') Object.assign(resumo.metricas, { testes: extrairResumoTestes(resultado.saida), cobertura: extrairResumoCobertura(resultado.saida) });
      if (nome === 'build') resumo.metricas.maiorChunkKb = extrairMaiorChunk(resultado.saida);
      if (nome === 'knip') resumo.metricas.knip = classificacao.knip;
      if (nome.startsWith('auditoria')) resumo.metricas[nome] = classificacao.auditoria;
      if (nome === 'schema') resumo.metricas.versaoSchema = extrairVersaoSchema(resultado.saida);
      if (nome === 'smoke_imagens') resumo.metricas.smokeImagens = extrairUltimoJson(resultado.saida);
      if (classificacao.resultado === 'falha') throw new Error(`Fase ${nome} falhou: ${classificacao.detalhe}`);
    }
    resumo.sucesso = true;
  } catch (erro) {
    resumo.falha = erro instanceof Error ? erro.message : 'Falha inesperada';
    process.exitCode = 1;
  } finally {
    resumo.fim = new Date().toISOString();
    await writeFile(path.join(diretorio, 'resumo.json'), `${JSON.stringify(resumo, null, 2)}\n`, 'utf8');
    const linhas = [`# Saúde do sistema`, '', `Resultado: ${resumo.sucesso ? 'aprovado' : 'falhou'}`, `Execução completa: ${resumo.completa ? 'sim' : 'não'}`, `Artefato: \`${path.relative(raiz, diretorio)}\``, '', '## Fases', '', ...resumo.fases.map(fase => `- ${fase.nome} (${fase.criticidade}): ${fase.resultado} — ${fase.detalhe} ([log](${fase.log}))`)];
    if (resumo.falha) linhas.push('', `Falha: ${resumo.falha}`);
    await writeFile(path.join(diretorio, 'resumo.md'), `${linhas.join('\n')}\n`, 'utf8');
    if (deveAtualizarPainel(resumo)) await atualizarPainel(resumo);
    process.stdout.write(`${JSON.stringify(resumo, null, 2)}\n`);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) principal();
