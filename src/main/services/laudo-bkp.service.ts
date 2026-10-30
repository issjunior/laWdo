import { placeholderService } from './placeholder.service.js';
import { getLogger } from '../utils/logger.js';
import { app } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { DomUtils, parseDocument } from 'htmlparser2';
import { z } from 'zod';
import { esquemaPacoteLaudo, type PacoteLaudo, type PreviaBkpLaudo } from '../../shared/types/laudo-bkp.types.js';
import { executeNonQuery, executeQuery, withTransaction } from '../database/sqlite.js';
import { capturarEstruturaLaudo } from './laudo-estrutura.service.js';
import { capturarApresentacaoLaudo } from './apresentacao-laudo.service.js';
import { laudoService } from './laudo.service.js';
import { criarArquivoLaudo, extrairArquivoLaudo, type EntradaArquivoLaudo } from './laudo-bkp-arquivo.service.js';

const extensoes: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/webp': 'webp' };

async function hashArquivo(caminho: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const parte of createReadStream(caminho)) hash.update(parte);
  return hash.digest('hex');
}

function referenciasImagens(html: string): Set<string> {
  const documento = parseDocument(html);
  for (const dummy of DomUtils.findAll(elemento => elemento.attribs['data-dummy'] === 'true', documento.children)) DomUtils.removeElement(dummy);
  return new Set(DomUtils.findAll(elemento => 'data-image-id' in elemento.attribs, documento.children).map(elemento => elemento.attribs['data-image-id']));
}

function validarHtml(html: string): void {
  const documento = parseDocument(html);
  const elementos = DomUtils.findAll(() => true, documento.children);
  if (elementos.length > 500000) throw new Error('HTML do laudo excede o limite de complexidade.');
  for (const elemento of elementos) {
    if (['script', 'iframe', 'object', 'embed', 'base', 'link', 'meta', 'style', 'form', 'input', 'button'].includes(elemento.name)) throw new Error('O BKP contém conteúdo ativo não permitido.');
    for (const [chave, valor] of Object.entries(elemento.attribs)) {
      if (/^on/i.test(chave) || ['srcdoc', 'formaction', 'action'].includes(chave)
        || (chave === 'style' && /url\s*\(|expression\s*\(|@import|behavior\s*:/i.test(valor))
        || (['href', 'src', 'xlink:href'].includes(chave) && /^\s*(javascript|vbscript):/i.test(valor))) throw new Error('Atributo ativo não permitido no BKP.');
      if (chave === 'src' && elemento.name === 'img' && !/^data:image\/(?:jpeg|png|gif|bmp|webp);base64,/i.test(valor)
        && !(elemento.parent && 'attribs' in elemento.parent && elemento.parent.attribs['data-dummy'] === 'true')) throw new Error('Imagem externa não permitida no BKP.');
    }
  }
}

export async function exportarBkpLaudo(laudoId: string, destino: string): Promise<void> {
  const entradas: EntradaArquivoLaudo[] = [];
  const pacote = await withTransaction(async () => {
    const laudo = await laudoService.findById(laudoId);
    if (!laudo) throw new Error('Laudo não encontrado.');
    const [rep] = await executeQuery<Record<string, unknown>>('SELECT * FROM reps WHERE id = ?', [laudo.rep_id]);
    if (!rep) throw new Error('REP não encontrada.');
    const [tipoExame] = await executeQuery<Record<string, unknown>>('SELECT * FROM tipos_exame WHERE id = ?', [rep.tipo_exame_id]);
    const [solicitante] = rep.solicitante_id ? await executeQuery<Record<string, unknown>>('SELECT * FROM solicitantes WHERE id = ?', [rep.solicitante_id]) : [];
    const estrutura = await capturarEstruturaLaudo(laudo);
    const registros = await executeQuery<Record<string, unknown>>('SELECT * FROM imagens_laudo WHERE laudo_id = ?', [laudo.id]);
    const imagens = registros.map(registro => ({
      caminho: z.string().parse(registro.caminho_relativo),
      imagem: esquemaPacoteLaudo.shape.imagens.element.parse({ ...registro,
        arquivo: `imagens/${registro.id}.${extensoes[String(registro.mime_type)] ?? 'invalido'}` }),
    }));
    const porId = new Map(imagens.map(item => [item.imagem.id, item]));
    const usadas = new Set<string>();
    for (const referencia of referenciasImagens(laudo.conteudo)) {
      let id: string | null = referencia;
      const cadeia = new Set<string>();
      while (id) {
        if (cadeia.has(id)) throw new Error('Ciclo nas imagens originais.');
        cadeia.add(id);
        const item = porId.get(id);
        if (!item) throw new Error(`Imagem necessária ausente: ${id}.`);
        usadas.add(id);
        id = item.imagem.imagem_origem_id;
      }
    }
    const selecionadas = imagens.filter(item => usadas.has(item.imagem.id));
    const raiz = selecionadas.length ? await realpath(path.join(app.getPath('userData'), 'imagens', 'laudos')) : '';
    for (const item of selecionadas) {
      const origem = await realpath(path.resolve(app.getPath('userData'), item.caminho));
      if (!origem.startsWith(`${raiz}${path.sep}`) || !(await stat(origem)).isFile()) throw new Error('Caminho de imagem fora da pasta permitida.');
      if (await hashArquivo(origem) !== item.imagem.sha256 || (await stat(origem)).size !== item.imagem.tamanho) throw new Error('Imagem do laudo alterada ou corrompida.');
      entradas.push({ nome: item.imagem.arquivo, caminho: origem });
    }
    const bruto: unknown = JSON.parse(laudo.respostas_wizard || '{}');
    if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) throw new Error('Respostas do wizard inválidas.');
    const respostas = Object.fromEntries(Object.entries(bruto).filter(([chave]) => !chave.startsWith('_')));
    const todas = await executeQuery<Record<string, unknown>>('SELECT chave, valor, descricao FROM placeholders');
    const fontes = [laudo.conteudo, ...estrutura.template.secoes.map(secao => secao.conteudo ?? ''), ...(estrutura.wizard?.pecas.map(peca => peca.conteudo) ?? [])];
    const referencias = new Set(fontes.flatMap(fonte => Array.from(fonte.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g), item => item[1])));
    const cadastrados = esquemaPacoteLaudo.shape.placeholders.parse(todas).filter(item => !placeholderService.ehChaveSistema(item.chave));
    let expandiu = true;
    while (expandiu) {
      expandiu = false;
      for (const item of cadastrados.filter(item => referencias.has(item.chave))) {
        for (const referencia of item.valor.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) {
          if (!referencias.has(referencia[1])) { referencias.add(referencia[1]); expandiu = true; }
        }
      }
    }
    const placeholders = cadastrados.filter(item => referencias.has(item.chave));
    return esquemaPacoteLaudo.parse({ formato: 1, rep, tipoExame, solicitante: solicitante ?? null,
      laudo: { ...laudo, respostas }, estrutura, placeholders, imagens: selecionadas.map(item => item.imagem) });
  });
  validarPacoteConteudo(pacote);
  entradas.unshift({ nome: 'laudo.json', conteudo: Buffer.from(JSON.stringify(pacote), 'utf8') });
  await criarArquivoLaudo(destino, app.getVersion(), entradas);
}

function validarPacoteConteudo(pacote: PacoteLaudo): void {
  const fontes = [pacote.laudo.conteudo, ...pacote.estrutura.template.secoes.map(secao => secao.conteudo ?? ''), ...(pacote.estrutura.wizard?.pecas.map(peca => peca.conteudo) ?? []), ...pacote.placeholders.map(item => item.valor)];
  for (const fonte of fontes) validarHtml(fonte);
  const imagens = new Set(pacote.imagens.map(imagem => imagem.id));
  for (const referencia of referenciasImagens(pacote.laudo.conteudo)) if (!imagens.has(referencia)) throw new Error('Figura referenciada ausente no BKP.');
}

export async function lerBkpLaudo(arquivo: string, diretorio: string): Promise<PacoteLaudo> {
  const manifesto = await extrairArquivoLaudo(arquivo, diretorio);
  const pacote = esquemaPacoteLaudo.parse(JSON.parse(await readFile(path.join(diretorio, 'laudo.json'), 'utf8')));
  const esperados = new Set(['laudo.json', ...pacote.imagens.map(imagem => imagem.arquivo)]);
  if (esperados.size !== manifesto.arquivos.length || manifesto.arquivos.some(item => !esperados.has(item.nome))) throw new Error('Conteúdo do contêiner não corresponde ao laudo.');
  for (const imagem of pacote.imagens) {
    const entrada = manifesto.arquivos.find(item => item.nome === imagem.arquivo);
    if (!entrada || entrada.sha256 !== imagem.sha256 || entrada.tamanho !== imagem.tamanho) throw new Error('Metadados da imagem não correspondem ao arquivo.');
  }
  validarPacoteConteudo(pacote);
  return pacote;
}

export async function analisarConflitosBkp(pacote: PacoteLaudo): Promise<{ previa: PreviaBkpLaudo; identidade: string; repId?: string; laudoId?: string }> {
  const [origem] = await executeQuery<{ id: string; numero: string }>('SELECT id, numero FROM reps WHERE id = ?', [pacote.estrutura.origem.repId]);
  const [rep] = await executeQuery<{ id: string }>('SELECT id FROM reps WHERE numero = ?', [pacote.rep.numero]);
  const laudos = rep ? await executeQuery<{ id: string }>('SELECT id FROM laudos WHERE rep_id = ?', [rep.id]) : [];
  let bloqueio: string | undefined;
  if (origem && origem.numero !== pacote.rep.numero) bloqueio = 'A identidade da REP de origem corresponde a outro número nesta instalação.';
  if (laudos.length > 1) bloqueio = 'A REP de destino possui vários laudos. A substituição está bloqueada.';
  const estado = rep ? await executeQuery('SELECT * FROM reps WHERE id = ?', [rep.id]) : [];
  const estadoLaudos = rep ? await executeQuery('SELECT * FROM laudos WHERE rep_id = ? ORDER BY id', [rep.id]) : [];
  return { previa: { numeroRep: pacote.rep.numero, tipoExame: `${pacote.tipoExame.codigo} — ${pacote.tipoExame.nome}`, status: pacote.laudo.status,
    figuras: referenciasImagens(pacote.laudo.conteudo).size, substituiRep: Boolean(rep), substituiLaudo: Boolean(laudos.length), bloqueio },
    identidade: createHash('sha256').update(JSON.stringify([estado, estadoLaudos])).digest('hex'), repId: rep?.id, laudoId: laudos[0]?.id };
}

function remapearTexto(texto: string, ids: Map<string, string>, chaves: Map<string, string>): string {
  return texto.replace(/(data-(?:image-id|image-original-id|secao-id|parent-id|repeat-owner|peca-id)\s*=\s*["'])([^"']+)(["'])/g,
    (trecho, prefixo: string, id: string, sufixo: string) => ids.has(id) ? `${prefixo}${ids.get(id)}${sufixo}` : trecho)
    .replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (trecho, chave: string) => chaves.has(chave) ? `{{${chaves.get(chave)}}}` : trecho);
}

export async function importarBkpLaudo(pacote: PacoteLaudo, diretorio: string, usuarioId: string, identidadeEsperada: string, confirmarSubstituicao: boolean): Promise<string> {
  const inicial = await analisarConflitosBkp(pacote);
  const laudoIdDestino = inicial.laudoId ?? randomUUID();
  const pastaId = randomUUID();
  const pasta = path.join(app.getPath('userData'), 'imagens', 'laudos', laudoIdDestino, pastaId);
  const ids = new Map<string, string>();
  const estrutura = structuredClone(pacote.estrutura);
  for (const item of [...pacote.imagens, ...estrutura.template.secoes, ...(estrutura.wizard?.etapas ?? []), ...(estrutura.wizard?.opcoes ?? []), ...(estrutura.wizard?.pecas ?? []), ...(estrutura.wizard?.regras ?? [])]) {
    if (ids.has(item.id)) throw new Error('Identidades sobrepostas na estrutura do pacote.');
    ids.set(item.id, randomUUID());
  }
  const idNovo = (id: string) => { const novo = ids.get(id); if (!novo) throw new Error('Referência interna ausente.'); return novo; };
  const caminhos = new Map<string, string>();
  let concluida = false;
  const arquivosAnteriores: string[] = [];
  try {
    await mkdir(pasta, { recursive: true });
    for (const imagem of pacote.imagens) {
      const relativo = path.posix.join('imagens', 'laudos', laudoIdDestino, pastaId, `${idNovo(imagem.id)}.${extensoes[imagem.mime_type]}`);
      const destino = path.join(app.getPath('userData'), relativo);
      await copyFile(path.join(diretorio, imagem.arquivo), destino);
      if (await hashArquivo(destino) !== imagem.sha256) throw new Error('Imagem alterada antes da importação.');
      caminhos.set(imagem.id, relativo);
    }
    const laudoId = await withTransaction(async () => {
      const conflitos = await analisarConflitosBkp(pacote);
      if (conflitos.previa.bloqueio) throw new Error(conflitos.previa.bloqueio);
      if (conflitos.identidade !== identidadeEsperada) throw new Error('O caso foi alterado após a prévia. Analise o arquivo novamente.');
      if (conflitos.repId && !confirmarSubstituicao) throw new Error('Confirme a substituição do caso.');
      const [usuario] = await executeQuery<{ id: string }>('SELECT id FROM users WHERE id = ?', [usuarioId]);
      if (!usuario) throw new Error('Usuário local não encontrado.');
      let [tipo] = await executeQuery<{ id: string }>('SELECT id FROM tipos_exame WHERE codigo = ?', [pacote.tipoExame.codigo]);
      if (!tipo) {
        tipo = { id: randomUUID() };
        await executeNonQuery('INSERT INTO tipos_exame (id, codigo, nome, descricao) VALUES (?, ?, ?, ?)', [tipo.id, pacote.tipoExame.codigo, pacote.tipoExame.nome, pacote.tipoExame.descricao]);
      }
      let solicitanteId: string | null = null;
      if (pacote.solicitante) {
        const valores = Object.values(pacote.solicitante);
        const [existente] = await executeQuery<{ id: string }>('SELECT id FROM solicitantes WHERE nome = ? AND tipo = ? AND endereco IS ? AND telefone IS ? AND email IS ?', valores);
        solicitanteId = existente?.id ?? randomUUID();
        if (!existente) await executeNonQuery('INSERT INTO solicitantes (id, nome, tipo, endereco, telefone, email) VALUES (?, ?, ?, ?, ?, ?)', [solicitanteId, ...valores]);
      }
      const personalizados = pacote.placeholders.filter(item => !placeholderService.ehChaveSistema(item.chave));
      const chaves = new Map<string, string>();
      const valoresLocais = new Map<string, string>();
      for (const placeholder of personalizados) {
        const [local] = await executeQuery<{ valor: string }>('SELECT valor FROM placeholders WHERE chave = ?', [placeholder.chave]);
        if (local) valoresLocais.set(placeholder.chave, local.valor);
        if (local && local.valor !== placeholder.valor) chaves.set(placeholder.chave, `${placeholder.chave.slice(0, 150)}_importado_${randomUUID().replaceAll('-', '')}`);
      }
      let mudou = true;
      while (mudou) {
        mudou = false;
        for (const placeholder of personalizados) {
          if (chaves.has(placeholder.chave) || !valoresLocais.has(placeholder.chave)) continue;
          const dependencias = Array.from(placeholder.valor.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g), item => item[1]);
          if (dependencias.some(chave => chaves.has(chave))) {
            chaves.set(placeholder.chave, `${placeholder.chave.slice(0, 150)}_importado_${randomUUID().replaceAll('-', '')}`);
            mudou = true;
          }
        }
      }
      for (const placeholder of personalizados) {
        if (valoresLocais.has(placeholder.chave) && !chaves.has(placeholder.chave)) continue;
        await executeNonQuery('INSERT INTO placeholders (id, chave, valor, descricao) VALUES (?, ?, ?, ?)',
          [randomUUID(), chaves.get(placeholder.chave) ?? placeholder.chave, remapearTexto(placeholder.valor, ids, chaves), placeholder.descricao]);
      }
      const remapear = (texto: string) => remapearTexto(texto, ids, chaves);
      for (const secao of estrutura.template.secoes) {
        secao.id = idNovo(secao.id);
        secao.parent_id = secao.parent_id ? idNovo(secao.parent_id) : null;
        if (secao.conteudo) secao.conteudo = remapear(secao.conteudo);
      }
      if (estrutura.wizard) {
        estrutura.wizard.id = randomUUID();
        for (const etapa of estrutura.wizard.etapas) { etapa.id = idNovo(etapa.id); etapa.etapa_pai_id = etapa.etapa_pai_id ? idNovo(etapa.etapa_pai_id) : null; }
        for (const opcao of estrutura.wizard.opcoes) { opcao.valor = ids.get(opcao.valor) ?? opcao.valor; opcao.id = idNovo(opcao.id); opcao.etapa_id = idNovo(opcao.etapa_id); opcao.etapa_filha_id = opcao.etapa_filha_id ? idNovo(opcao.etapa_filha_id) : null; }
        for (const peca of estrutura.wizard.pecas) { peca.id = idNovo(peca.id); peca.conteudo = remapear(peca.conteudo); }
        for (const regra of estrutura.wizard.regras) {
          regra.id = idNovo(regra.id); regra.peca_id = idNovo(regra.peca_id);
          regra.secao_template_id = regra.secao_template_id ? idNovo(regra.secao_template_id) : null;
          regra.condicoes = Object.fromEntries(Object.entries(regra.condicoes).map(([id, valor]) => [idNovo(id), Array.isArray(valor) ? valor.map(item => ids.get(item) ?? item) : ids.get(valor) ?? valor]));
        }
      }
      const repId = conflitos.repId ?? randomUUID();
      const dadosRep = { ...pacote.rep, solicitante_id: solicitanteId, tipo_exame_id: tipo.id, usuario_id: usuarioId };
      const colunasRep = Object.keys(dadosRep);
      if (conflitos.repId) await executeNonQuery(`UPDATE reps SET ${colunasRep.map(coluna => `${coluna} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...Object.values(dadosRep), repId]);
      else await executeNonQuery(`INSERT INTO reps (id, ${colunasRep.join(', ')}) VALUES (?, ${colunasRep.map(() => '?').join(', ')})`, [repId, ...Object.values(dadosRep)]);
      const id = laudoIdDestino;
      const apresentacao = await capturarApresentacaoLaudo(usuarioId);
      const respostas = Object.fromEntries(Object.entries(pacote.laudo.respostas).filter(([chave]) => !chave.startsWith('_')).map(([chave, valor]) => [idNovo(chave), Array.isArray(valor) ? valor.map(item => ids.get(item) ?? item) : ids.get(valor) ?? valor]));
      const dadosLaudo = { rep_id: repId, perito_id: usuarioId, template_id: null, conteudo: remapear(pacote.laudo.conteudo), status: pacote.laudo.status,
        data_inicio: pacote.laudo.data_inicio, data_conclusao: pacote.laudo.data_conclusao, data_entrega: pacote.laudo.data_entrega,
        versao: pacote.laudo.versao, tipo_criacao: pacote.laudo.tipo_criacao, wizard_id: null, respostas_wizard: JSON.stringify(respostas),
        apresentacao_json: JSON.stringify(apresentacao), estrutura_incorporada_json: JSON.stringify(estrutura) };
      const colunasLaudo = Object.keys(dadosLaudo);
      if (conflitos.laudoId) {
        const antigas = await executeQuery<{ caminho_relativo: string }>('SELECT DISTINCT caminho_relativo FROM imagens_laudo WHERE laudo_id = ?', [id]);
        arquivosAnteriores.push(...antigas.map(imagem => imagem.caminho_relativo));
        await executeNonQuery('DELETE FROM respostas_wizard WHERE laudo_id = ?', [id]);
        await executeNonQuery('DELETE FROM imagens_laudo WHERE laudo_id = ?', [id]);
        await executeNonQuery(`UPDATE laudos SET ${colunasLaudo.map(coluna => `${coluna} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...Object.values(dadosLaudo), id]);
      } else await executeNonQuery(`INSERT INTO laudos (id, ${colunasLaudo.join(', ')}) VALUES (?, ${colunasLaudo.map(() => '?').join(', ')})`, [id, ...Object.values(dadosLaudo)]);
      for (const imagem of pacote.imagens) {
        await executeNonQuery('INSERT INTO imagens_laudo (id, laudo_id, nome_arquivo, caminho_relativo, mime_type, tamanho, sha256, legenda, origem, sequencia, imagem_origem_id, ajustes_json, disponivel_painel, temporaria_sessao, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
          [idNovo(imagem.id), id, imagem.nome_arquivo, caminhos.get(imagem.id), imagem.mime_type, imagem.tamanho, imagem.sha256, imagem.legenda, imagem.origem, imagem.sequencia, imagem.imagem_origem_id ? idNovo(imagem.imagem_origem_id) : null, imagem.ajustes_json, imagem.disponivel_painel, imagem.created_at]);
      }
      await executeNonQuery("INSERT INTO logs_auditoria (usuario_id, acao, tipo_acao, modulo, entidade, entidade_id, nivel, mensagem) VALUES (?, ?, 'importacao', 'laudo', 'laudos', ?, 'info', ?)",
        [usuarioId, conflitos.laudoId ? 'Substituição por BKP' : 'Importação de BKP', id, `Laudo da REP ${pacote.rep.numero} importado de BKP`]);
      return id;
    });
    concluida = true;
    const raizImagens = path.resolve(app.getPath('userData'), 'imagens', 'laudos');
    for (const relativo of arquivosAnteriores) {
      try {
        const absoluto = path.resolve(app.getPath('userData'), relativo);
        if (!absoluto.startsWith(`${raizImagens}${path.sep}`)) continue;
        const referencias = await executeQuery('SELECT id FROM imagens_laudo WHERE caminho_relativo = ?', [relativo]);
        if (referencias.length === 0) await rm(absoluto, { force: true });
      } catch (erro) {
        getLogger('laudo').warn('Não foi possível remover uma imagem substituída pelo BKP.', { erro: erro instanceof Error ? erro.message : 'Erro inesperado' });
      }
    }
    return laudoId;
  } finally {
    if (!concluida) await rm(pasta, { recursive: true, force: true });
  }
}
