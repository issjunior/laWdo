import { writeFile, rename, readFile } from 'node:fs/promises';
import { stripVTControlCharacters } from 'node:util';
import path from 'node:path';
import { compararResultados, estatisticas } from './configuracao.mjs';

export function resumirOperacoes(eventos, inicio, fim) {
  const grupos = new Map();
  for (const evento of eventos) {
    const horario = Date.parse(evento.timestamp);
    if (!Number.isFinite(horario) || horario < inicio || horario > fim || !Number.isFinite(evento.duracaoMs)) continue;
    const operacao = evento.operacao || evento.canal;
    if (!operacao) continue;
    const origem = evento.origem ?? 'desconhecida';
    const categoria = evento.categoria ?? 'sem_categoria';
    const chave = JSON.stringify([origem, categoria, operacao]);
    if (!grupos.has(chave)) grupos.set(chave, { origem, categoria, operacao, duracoes: [] });
    grupos.get(chave).duracoes.push(evento.duracaoMs);
  }
  return [...grupos.values()].map(({ duracoes, ...identificacao }) => ({ ...identificacao, ...estatisticas(duracoes) })).sort((a, b) => b.p95 - a.p95);
}

export async function lerEventosDesempenho(diretorio) {
  const eventos = [];
  for (const arquivo of ['performance.log.2', 'performance.log.1', 'performance.log']) {
    try {
      for (const linha of (await readFile(path.join(diretorio, 'logs', arquivo), 'utf8')).split('\n')) {
        if (linha.trim()) eventos.push(JSON.parse(linha));
      }
    } catch (erro) { if (erro.code !== 'ENOENT') throw erro; }
  }
  return eventos;
}

export function resumirProcessos(amostras) {
  const grupos = new Map();
  for (const amostra of amostras) {
    const totais = new Map();
    for (const processo of amostra.amostras) {
      const total = totais.get(processo.papel) ?? { cpu: 0, memoriaKb: 0, memoriaDisponivel: true };
      total.cpu += processo.cpu;
      total.memoriaKb += processo.memoriaKb ?? 0;
      total.memoriaDisponivel &&= Number.isFinite(processo.memoriaKb);
      totais.set(processo.papel, total);
    }
    for (const [papel, total] of totais) {
      const grupo = grupos.get(papel) ?? { cpu: [], memoriaKb: [] };
      grupo.cpu.push(total.cpu); grupo.memoriaKb.push(total.memoriaDisponivel ? total.memoriaKb : null);
      grupos.set(papel, grupo);
    }
  }
  return [...grupos].map(([papel, valores]) => ({ papel, cpu: estatisticas(valores.cpu), memoriaKb: estatisticas(valores.memoriaKb), variacaoMemoriaKb: Number.isFinite(valores.memoriaKb.at(-1)) && Number.isFinite(valores.memoriaKb[0]) ? valores.memoriaKb.at(-1) - valores.memoriaKb[0] : null }));
}

export function gerarHtml(resultado) {
  const escapar = valor => stripVTControlCharacters(String(valor ?? '')).replace(/[&<>"']/g, caractere => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caractere]);
  const numero = valor => typeof valor === 'number' ? valor.toFixed(1) : 'indisponível';
  const casos = resultado.casos.map(caso => `<details open><summary>${escapar(caso.chave)} — ${escapar(caso.estado)}</summary>
    <p>Entrada → próximo frame (aproximação): p95 ${numero(caso.metricas?.entradaFrame?.p95)} ms; ${caso.metricas?.entradaFrame?.quantidade ?? 0} entradas. Amostras ocultas: ${caso.metricas?.amostrasOcultas ?? 0}.</p>
    <p>Atraso do renderer: p95 ${numero(caso.metricas?.atrasoRenderer?.p95)} ms, máximo ${numero(caso.metricas?.atrasoRenderer?.maximo)} ms. Long tasks: ${caso.metricas?.longTasks?.quantidade ?? 0}, máximo ${numero(caso.metricas?.longTasks?.maximo)} ms.</p>
    <p>Cadência de recebimento das teclas: mediana ${numero(caso.metricas?.cadenciaRecepcaoMs?.mediana)} ms, p95 ${numero(caso.metricas?.cadenciaRecepcaoMs?.p95)} ms (inclui pausas do roteiro). Esperas por fila cheia no gerador: ${(caso.acoes ?? []).flatMap(acao => acao.entrada?.envios ?? []).reduce((total, envio) => total + envio.contrapressoes, 0)}.</p>
    <p>Amostras sem foco: ${caso.metricas?.amostrasSemFoco ?? 0}. Entradas sem frame concluído: ${caso.metricas?.entradasSemFrame ?? 0}. Caracteres recebidos: ${caso.metricas?.entradasRecebidas ?? 0}.</p>
    ${caso.erro ? `<p class="aviso">${escapar(caso.erro)}</p>` : ''}
    <table><thead><tr><th>Ação</th><th>Estado</th><th>Duração total (ms)</th><th>Entrada/frame p95 (ms)</th></tr></thead><tbody>${(caso.acoes ?? []).map(acao => `<tr><td>${escapar(acao.nome)}</td><td>${escapar(acao.estado)}</td><td>${numero(acao.duracaoMs)}</td><td>${numero(acao.metricas?.entradaFrame?.p95)}</td></tr>`).join('')}</tbody></table>
    <h3>Operações e IPCs medidos</h3><table><thead><tr><th>Origem / categoria</th><th>Operação</th><th>Amostras</th><th>Mediana</th><th>p95</th><th>Máximo (ms)</th></tr></thead><tbody>${(caso.operacoes ?? []).map(item => `<tr><td>${escapar(item.origem)} / ${escapar(item.categoria)}</td><td>${escapar(item.operacao)}</td><td>${item.quantidade}</td><td>${numero(item.mediana)}</td><td>${numero(item.p95)}</td><td>${numero(item.maximo)}</td></tr>`).join('')}</tbody></table>
    <h3>Processos</h3><table><thead><tr><th>Papel</th><th>CPU p95 (%)</th><th>Memória p95 (MiB)</th><th>Variação (MiB)</th></tr></thead><tbody>${(caso.processos ?? []).map(item => `<tr><td>${escapar(item.papel)}</td><td>${numero(item.cpu.p95)}</td><td>${numero(typeof item.memoriaKb.p95 === 'number' ? item.memoriaKb.p95 / 1024 : null)}</td><td>${numero(typeof item.variacaoMemoriaKb === 'number' ? item.variacaoMemoriaKb / 1024 : null)}</td></tr>`).join('')}</tbody></table>
    <p>Capturas diagnósticas: ${caso.diagnostico?.segmentos?.length ?? 0}. ${escapar((caso.lacunas ?? []).join('; '))}</p>
    ${caso.tela ? `<a href="${escapar(caso.tela)}">Tela de evidência</a>` : ''}</details>`).join('');
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Carga do laWdo</title>
    <style>body{font:15px system-ui;max-width:1200px;margin:32px auto;padding:0 20px;background:#f4f5f7;color:#172033}h1{font-size:28px}details{overflow-x:auto;background:white;padding:18px;margin:18px 0;border:1px solid #d5dbe4;border-radius:10px}summary{font-weight:700;cursor:pointer}table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:8px;border-bottom:1px solid #e1e5eb}th{background:#edf1f6}.aviso{color:#9a3412;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#1749a0}</style>
    <h1>Carga do editor do laWdo</h1><p>Relatório de desenvolvimento. Sem aprovação ou reprovação de release.</p>
    <p>Execução: ${escapar(resultado.estado)} · Perfil: ${escapar(resultado.contexto.perfil)} · Semente: ${resultado.contexto.semente}</p>
    <p>Referência observacional: entrada/frame p95 de 100 ms. Duração da ação inclui cadência de digitação e esperas intencionais; não é latência da interface. Crescimento de memória isolado não comprova vazamento.</p>
    <nav>${resultado.casos.map((caso, indice) => `<a href="#caso-${indice}">${escapar(caso.chave)}</a>`).join(' · ')}</nav>
    <h2>Contexto e comparabilidade</h2><pre>${escapar(JSON.stringify(resultado.contexto, null, 2))}</pre>
    ${resultado.comparacao ? `<h2>Comparação</h2><pre>${escapar(JSON.stringify(resultado.comparacao, null, 2))}</pre>` : ''}
    ${resultado.erro ? `<p class="aviso">${escapar(resultado.erro)}</p>` : ''}
    ${casos.replace(/<details open>/g, (() => { let indice = 0; return () => `<details open id="caso-${indice++}">`; })())}
    <h2>Como investigar</h2><p>Comece pelas operações de maior p95 e correlacione os horários de acoes.json, processos.json e diagnostico.json de cada caso. Resultados com janela oculta, API ausente ou coleta degradada não sustentam uma conclusão de regressão. Use a mesma massa, máquina, semente e roteiro para comparar versões.</p></html>`;
}

export async function gravarRelatorio(diretorio, resultado, referencia) {
  if (referencia) {
    try { resultado.comparacao = compararResultados(JSON.parse(await readFile(referencia, 'utf8')), resultado); }
    catch (erro) { resultado.comparacao = { compativel: false, incompatibilidades: ['arquivo_referencia'], erro: erro.message, deltas: [] }; }
  }
  const temporario = path.join(diretorio, 'resultado.parcial.json');
  await writeFile(temporario, JSON.stringify(resultado, null, 2));
  await rename(temporario, path.join(diretorio, 'resultado.json'));
  await writeFile(path.join(diretorio, 'relatorio.html'), gerarHtml(resultado));
}
