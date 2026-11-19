import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditoriaAceitavel,
  classificarFase,
  deveAtualizarPainel,
  extrairAuditoria,
  extrairKnip,
  extrairMaiorChunk,
  extrairResumoCobertura,
  extrairResumoTestes,
  gerarPainel,
} from './executar.mjs';

test('extrai métricas do relatório de cobertura', () => {
  assert.deepEqual(extrairResumoTestes('Test Files  2 passed (2)\nTests  9 passed (9)'), { arquivos: 2, testes: 9 });
  assert.deepEqual(extrairResumoCobertura('All files | 63.88 | 56 | 63.23 | 67.53 |'), { statements: 63.88, branches: 56, functions: 63.23, lines: 67.53 });
});

test('extrai maior chunk e auditoria', () => {
  assert.equal(extrairMaiorChunk('a.js 12.4 kB\nb.js 490.41 kB'), 490.41);
  assert.deepEqual(extrairAuditoria('{"metadata":{"vulnerabilities":{"moderate":12}}}'), { moderate: 12 });
  assert.deepEqual(extrairAuditoria('{\n  "metadata": {\n    "vulnerabilities": { "moderate": 12 }\n  }\n}'), { moderate: 12 });
  assert.equal(auditoriaAceitavel('auditoria_completa', { moderate: 12, high: 0, critical: 0 }), true);
  assert.equal(auditoriaAceitavel('auditoria_producao', { total: 1 }), false);
});

test('classifica gates e observações sem tratar achados como aprovação', () => {
  const knip = JSON.stringify({ issues: [{ file: 'src/legado.ts', files: [{ name: 'src/legado.ts' }], exports: [{ name: 'legado' }] }] });
  assert.deepEqual(extrairKnip(knip), { arquivos: 1, achados: 2 });
  assert.equal(classificarFase('knip', 0, knip).resultado, 'alerta');
  assert.equal(classificarFase('knip', 2, 'erro').resultado, 'falha');
  assert.equal(classificarFase('codigo_morto', 0, '\\src\\legado.ts:1 - legado').resultado, 'alerta');
  assert.equal(classificarFase('tipagem', 1, '').resultado, 'falha');
});

test('gera painel integral somente para execução completa aprovada', () => {
  const resumo = {
    sucesso: true,
    completa: true,
    instalacaoLimpa: false,
    fim: '2026-11-19T15:00:00.000Z',
    diretorio: 'C:\\projeto\\tmp\\saude\\execucao',
    ambiente: { node: '24.21.0', npm: '11.17.0' },
    metricas: {
      testes: { testes: 9, arquivos: 2 },
      cobertura: { statements: 63.88, branches: 56, functions: 63.23, lines: 67.53 },
      maiorChunkKb: 490.41,
      versaoSchema: 51,
      knip: { arquivos: 0, achados: 0 },
      auditoria_completa: { total: 12, moderate: 12, high: 0, critical: 0 },
    },
    fases: ['dependencias', 'tipagem', 'lint', 'release', 'carga', 'saude_scripts', 'auditoria_producao', 'pacote', 'smoke_imagens', 'diff'].map(nome => ({ nome, resultado: 'aprovado', detalhe: 'Aprovado.' })),
  };
  const painel = gerarPainel(resumo);
  assert.equal(deveAtualizarPainel(resumo), true);
  assert.match(painel, /## Gates bloqueantes aprovados/);
  assert.match(painel, /## Observações que exigem análise/);
  assert.match(painel, /Sem instalação limpa nesta execução/);
  assert.match(painel, /12 alerta\(s\): moderados 12/);
  assert.equal(deveAtualizarPainel({ ...resumo, sucesso: false }), false);
  assert.equal(deveAtualizarPainel({ ...resumo, completa: false }), false);
});
