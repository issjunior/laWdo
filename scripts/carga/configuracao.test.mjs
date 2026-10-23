import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { interpretarArgumentos, criarAleatorio, validarIsolamento, estatisticas, compararResultados, MASSAS } from './configuracao.mjs';
import { gerarBitmap, gerarDocumento } from './massa.mjs';
import { gerarHtml, resumirOperacoes } from './relatorio.mjs';
import { inspecionarDocumento, validarIntegridade, planejarCombinacoes } from './cenarios.mjs';
import { encerrarProcessoCriado } from './processos.mjs';
import { resumirMetricasRenderer } from './diagnostico.mjs';

test('resumo preserva entradas de frames substituídos e deduplica tarefas compartilhadas', () => {
  const amostra = inicio => ({ entradas: [{ inicio, recebidaEm: inicio + 2, caractere: true, duracao: 12, visivel: true }], atrasos: [], tarefas: [{ inicio: 30, duracao: 80 }], longTasksDisponivel: true });
  const resultado = resumirMetricasRenderer([amostra(1), amostra(20), amostra(20)]);
  assert.equal(resultado.entradaFrame.quantidade, 2);
  assert.equal(resultado.longTasks.quantidade, 1);
  assert.equal(resultado.cadenciaRecepcaoMs.mediana, 19);
  assert.equal(resultado.coletaIncompleta, false);
});

test('não mistura IPC do renderer com tempo medido no processo principal', () => {
  const evento = (origem, duracaoMs) => ({ timestamp: new Date(50).toISOString(), origem, categoria: 'ipc', canal: 'laudo:updateConteudo', duracaoMs });
  const resumo = resumirOperacoes([evento('main', 1), evento('renderer', 10), evento('renderer', 30)], 0, 100);
  assert.equal(resumo.length, 2);
  assert.equal(resumo.find(item => item.origem === 'main').p95, 1);
  assert.equal(resumo.find(item => item.origem === 'renderer').quantidade, 2);
  assert.equal(resumo.find(item => item.origem === 'renderer').p95, 30);
});

test('perda de foco e entrada sem frame são limitações explícitas', () => {
  const entrada = (inicio, duracao, foco = true) => ({ inicio, recebidaEm: inicio + 1, duracao, foco, visivel: true, caractere: true });
  const resumo = resumirMetricasRenderer([{ entradas: [entrada(1, 12), entrada(2, null), entrada(3, 1000, false)], atrasos: [], tarefas: [], longTasksDisponivel: true }]);
  assert.equal(resumo.entradaFrame.p95, 12);
  assert.equal(resumo.entradasSemFrame, 1);
  assert.equal(resumo.amostrasSemFoco, 1);
  assert.equal(resumo.coletaIncompleta, true);
});

test('opções recusam entradas ambíguas e preservam parâmetros de reprodução', () => {
  assert.equal(interpretarArgumentos([]).perfil, 'rapido');
  assert.equal(interpretarArgumentos(['--perfil', 'estresse', '--massa', 'estresse']).massa, 'estresse');
  assert.throws(() => interpretarArgumentos(['--massa', 'controle']));
  assert.throws(() => interpretarArgumentos(['--massa', 'toString']));
  assert.equal(interpretarArgumentos(['--perfil', 'estresse', '--cenario', 'resistencia']).cenario, 'resistencia');
  assert.throws(() => interpretarArgumentos(['--cenario', 'resistencia']));
  assert.throws(() => interpretarArgumentos(['--perfil', 'estresse', '--massa', 'controle', '--cenario', 'resistencia']));
  assert.deepEqual(interpretarArgumentos(['--semente', '0', '--perfil', 'estresse', '--cenario', 'saida']).semente, 0);
  for (const argumentos of [['--semente', '-1'], ['--semente', 'NaN'], ['--semente', '4294967296'], ['--perfil', 'outro'], ['--cenario', 'outro'], ['--perfil'], ['--desconhecido']]) assert.throws(() => interpretarArgumentos(argumentos));
});

test('gerador produz sequência e bitmap idênticos para a mesma semente', () => {
  const a = criarAleatorio(3); const b = criarAleatorio(3);
  assert.deepEqual(Array.from({ length: 50 }, a), Array.from({ length: 50 }, b));
  assert.deepEqual(gerarBitmap(4, 8, 6), gerarBitmap(4, 8, 6));
  assert.notDeepEqual(gerarBitmap(4, 8, 6), gerarBitmap(5, 8, 6));
  assert.deepEqual(planejarCombinacoes(5, 50), planejarCombinacoes(5, 50));
});

test('massas têm estrutura conhecida, sem depender da normalização do aplicativo', () => {
  for (const [nome, configuracao] of Object.entries(MASSAS)) {
    const imagens = Array.from({ length: configuracao.imagens }, (_, indice) => ({ id: `imagem-${indice}`, dataUri: 'data:image/jpeg;base64,YWJj' }));
    const documento = gerarDocumento(nome, imagens);
    const estrutura = inspecionarDocumento(documento.html);
    validarIntegridade(estrutura, documento.resumo);
    assert.equal(estrutura.figuras.length, configuracao.imagens);
    assert.throws(() => validarIntegridade(inspecionarDocumento(documento.html.replace(`MARCADOR_${nome}_0`, 'REMOVIDO')), documento.resumo));
    assert.throws(() => validarIntegridade({ ...estrutura, celulas: 0 }, documento.resumo));
    assert.throws(() => validarIntegridade(inspecionarDocumento(documento.html.replace('CARGA_T0_L0_C0', 'PERDIDO')), documento.resumo), /célula/);
    assert.throws(() => validarIntegridade(inspecionarDocumento(documento.html.replace('data-placeholder="{{carga_0}}"', '')), documento.resumo), /Placeholders/);
    assert.throws(() => validarIntegridade(inspecionarDocumento(documento.html.replace('CARGA_T0_L0_C0', 'CARGA_T0_L0_C0 CARGA_CELULA')), documento.resumo, estrutura), /células/);
    if (configuracao.secoes > 10) assert.throws(() => validarIntegridade(inspecionarDocumento(documento.html.replace(`MARCADOR_${nome}_1 `, 'REMOVIDO ')), documento.resumo), /Marcador/);
    if (configuracao.imagens > 1) assert.throws(() => validarIntegridade({ ...estrutura, figuras: estrutura.figuras.slice().reverse() }, documento.resumo, estrutura), /Numeração|preservadas/);
  }
});

test('células aceitam apenas marcadores de edição e preservam a detecção de corrupção', () => {
  const documento = gerarDocumento('controle', []);
  const conferir = valor => validarIntegridade(inspecionarDocumento(documento.html.replace('CARGA_T0_L0_C0', valor)), documento.resumo);
  for (const valor of [
    'CARGA_T0_L0_C0 CARGA_CELULA CARGA_CELULA CARGA_CELULA',
    'CARGA_T0_L0_C0CARGA_CELULACARGA_CELULA',
    'CARGA_T0_L0_C0 CARGA_CELULACARGA_CELULA CARGA_CELULA ',
    'CARGA_T0_L0_C0 CARGA_CELCARGA_CELULAULA CARGA_CELULA',
  ]) assert.doesNotThrow(() => conferir(valor));
  for (const valor of [
    'CARGA_T0_L0_C CARGA_CELULA',
    'CARGA_T0_L0_C9 CARGA_CELULA',
    'CARGA_T0_L0_C0 CORROMPIDO CARGA_CELULA',
    'CARGA_T0_L0_ C0 CARGA_CELULA',
    'CARGA_T0_L0_C0 CARGA_CELUL',
  ]) assert.throws(() => conferir(valor), /célula|Células/);
});

test('figura sem descrição mantém validação estrita do número', () => {
  const imagens = Array.from({ length: MASSAS.representativa.imagens }, (_, indice) => ({ id: `imagem-${indice}`, dataUri: 'data:image/jpeg;base64,YWJj' }));
  const documento = gerarDocumento('representativa', imagens);
  const estrutura = inspecionarDocumento(documento.html);
  estrutura.figuras[0].legenda = 'Figura 01';
  assert.doesNotThrow(() => validarIntegridade(estrutura, documento.resumo));
  estrutura.figuras[0].legenda = 'Figura 010';
  assert.throws(() => validarIntegridade(estrutura, documento.resumo), /Numeração/);
  estrutura.figuras[0].legenda = 'Figura 02';
  assert.throws(() => validarIntegridade(estrutura, documento.resumo), /Numeração/);
});

test('isolamento exige marcador e rejeita a raiz e diretórios externos', async () => {
  const temporario = await mkdtemp(path.join(os.tmpdir(), 'lawdo-carga-unitario-'));
  try {
    const raiz = path.join(temporario, 'tmp/teste-carga');
    const dados = path.join(raiz, 'execucao/dados');
    await mkdir(dados, { recursive: true });
    await assert.rejects(validarIsolamento(temporario, dados));
    await writeFile(path.join(dados, 'isolamento.json'), JSON.stringify({ finalidade: 'teste-carga', versao: 1 }));
    assert.equal(await validarIsolamento(temporario, dados), dados);
    await assert.rejects(validarIsolamento(temporario, raiz));
    await assert.rejects(validarIsolamento(temporario, temporario));
  } finally {
    const destino = await realpath(temporario);
    assert.equal(path.dirname(destino), await realpath(os.tmpdir()));
    assert.ok(path.basename(destino).startsWith('lawdo-carga-unitario-'));
    await rm(destino, { recursive: true, force: true });
  }
});

test('estatísticas não inventam p95 para conjuntos sem amostras', () => {
  assert.equal(estatisticas([]).p95, null);
  assert.deepEqual(estatisticas([1, 3, 2, Infinity]), { quantidade: 3, mediana: 2, p95: 3, maximo: 3 });
});

test('comparação recusa massas, roteiros ou coletas incompatíveis', () => {
  const referencia = { contexto: { versaoRoteiro: 1, semente: 1, repeticoes: 3, perfil: 'rapido', massa: null, cenario: null, maquina: 'pc', instrumentacao: 'v1', massasHash: 'abc', trace: false }, casos: [{ chave: 'a', estado: 'concluido', metricas: { entradaFrame: { p95: 20 } } }] };
  const atual = structuredClone(referencia);
  atual.casos[0].metricas.entradaFrame.p95 = 30;
  assert.equal(compararResultados(referencia, atual).deltas[0].entradaFrameP95Ms, 10);
  atual.contexto.semente++;
  assert.equal(compararResultados(referencia, atual).compativel, false);
  atual.contexto.semente--;
  atual.casos[0].metricas.amostrasOcultas = 1;
  assert.equal(compararResultados(referencia, atual).compativel, false);
});

test('relatório HTML escapa achados e nomes de cenário', () => {
  const html = gerarHtml({ estado: 'concluida', contexto: { perfil: 'rapido', semente: 1 }, casos: [{ chave: '<script>ruim</script>', estado: 'achado', erro: '<img src=x onerror=alert(1)>' }] });
  assert.ok(!html.includes('<script>ruim'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('Sem aprovação ou reprovação'));
});

test('cancelamento atua somente sobre o handle vivo informado pelo executor', () => {
  const chamadas = [];
  const executar = (...argumentos) => chamadas.push(argumentos);
  encerrarProcessoCriado({ pid: 123, exitCode: 0 }, 'win32', executar);
  encerrarProcessoCriado({ pid: -1, exitCode: null }, 'win32', executar);
  encerrarProcessoCriado(null, 'win32', executar);
  assert.equal(chamadas.length, 0);
  encerrarProcessoCriado({ pid: 123, exitCode: null }, 'win32', executar);
  assert.deepEqual(chamadas[0].slice(0, 2), ['taskkill', ['/PID', '123', '/T', '/F']]);
});
