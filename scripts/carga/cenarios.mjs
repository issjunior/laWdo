import assert from 'node:assert/strict';
import { parseDocument } from 'htmlparser2';
import { criarAleatorio, hash, QUANTIDADE_IMAGENS_ADICIONAIS } from './configuracao.mjs';
import { digitarCadenciado } from './entrada.mjs';

const esperar = ms => new Promise(resolver => setTimeout(resolver, ms));

async function aguardarEditor(pagina) {
  await pagina.locator('iframe.tox-edit-area__iframe[data-diagnostico-pronto="true"]').first().waitFor({ timeout: 60_000 });
  await pagina.getByRole('button', { name: 'Documento único', exact: true }).waitFor();
  await pagina.waitForFunction(() => !globalThis.document.querySelector('button[aria-pressed][disabled]'), null, { timeout: 60_000 });
}

function corpoTexto(pagina) {
  return pagina.frameLocator('iframe.tox-edit-area__iframe:visible').first().locator('body');
}

export async function autenticarEAbrir(pagina) {
  await pagina.getByLabel('Usuário', { exact: true }).fill('carga.perito');
  await pagina.getByPlaceholder('Digite sua senha', { exact: true }).fill('CargaFicticia!2026');
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  await pagina.waitForFunction(() => !globalThis.location.hash.includes('login'), null, { timeout: 30_000 });
  await pagina.evaluate(() => { globalThis.location.hash = '/laudos'; });
  await pagina.getByRole('button', { name: 'Editar laudo da REP 999999/2026', exact: true }).click();
  await aguardarEditor(pagina);
}

export async function trocarModo(pagina, modo) {
  const rotulo = modo === 'single' ? 'Documento único' : 'Por seções';
  const botao = pagina.getByRole('button', { name: rotulo, exact: true });
  if (await botao.getAttribute('aria-pressed') !== 'true') await botao.click();
  await aguardarEditor(pagina);
}

export async function salvar(pagina) {
  await pagina.getByRole('button', { name: 'Salvar', exact: true }).click();
  await pagina.getByRole('status').filter({ hasText: /^Salvo$/ }).first().waitFor({ timeout: 90_000 });
}

export async function digitar(pagina, texto, intervalo = 50) {
  const corpo = corpoTexto(pagina);
  await corpo.locator('p').first().click();
  await posicionarNoFimDoParagrafo(corpo);
  if (intervalo > 0) return digitarCadenciado(pagina, texto, intervalo);
  await pagina.keyboard.type(texto, { delay: intervalo });
}

async function posicionarNoFimDoParagrafo(corpo) {
  await corpo.locator('p').first().evaluate(elemento => {
    elemento.ownerDocument.body.focus();
    const intervalo = elemento.ownerDocument.createRange();
    intervalo.selectNodeContents(elemento);
    intervalo.collapse(false);
    const selecao = elemento.ownerDocument.getSelection();
    selecao.removeAllRanges();
    selecao.addRange(intervalo);
  });
}

export async function executarCenario(nome, contexto) {
  const { pagina, modo, diretorio, registrar } = contexto;
  const acao = async (rotulo, executar) => registrar(`${nome}:${rotulo}`, executar);
  if (nome === 'digitacao') {
    await acao('continuo', async () => {
      const envios = [];
      for (let indice = 0; indice < 3; indice++) {
        envios.push(await digitar(pagina, ` CARGA_DIGITACAO_${indice}_abcdefghijklmnop`));
        await esperar(200);
      }
      await esperar(600);
      envios.push(await digitar(pagina, ' CARGA_APOS_PAUSA_abcdefghijklmnop'));
      await esperar(600);
      const texto = await corpoTexto(pagina).innerText();
      for (let indice = 0; indice < 3; indice++) assert.ok(texto.includes(`CARGA_DIGITACAO_${indice}_abcdefghijklmnop`), 'Um bloco da digitação cadenciada foi perdido.');
      assert.ok(texto.includes('CARGA_APOS_PAUSA_abcdefghijklmnop'), 'A digitação cadenciada não foi aplicada ao texto.');
      const antesDoCursor = await corpoTexto(pagina).evaluate(elemento => {
        const selecao = elemento.ownerDocument.getSelection();
        if (!selecao?.focusNode) return '';
        const intervalo = elemento.ownerDocument.createRange();
        intervalo.selectNodeContents(elemento.querySelector('p'));
        intervalo.setEnd(selecao.focusNode, selecao.focusOffset);
        return intervalo.toString();
      });
      assert.ok(antesDoCursor.endsWith('CARGA_APOS_PAUSA_abcdefghijklmnop'), 'A posição do cursor mudou após a pausa de digitação.');
      return { envios };
    });
  } else if (nome === 'texto') {
    await acao('volume_desfazer_refazer', async () => {
      const corpo = corpoTexto(pagina);
      await corpo.locator('p').first().click();
      await posicionarNoFimDoParagrafo(corpo);
      const contarBlocos = () => corpo.evaluate(elemento => (elemento.textContent ?? '').split('BLOCO_VOLUMOSO_FICTICIO').length - 1);
      const quantidadeEsperada = await contarBlocos() + 400;
      await corpo.evaluate((elemento, texto) => {
        const dados = new globalThis.DataTransfer();
        dados.setData('text/plain', texto);
        elemento.dispatchEvent(new globalThis.ClipboardEvent('paste', { clipboardData: dados, bubbles: true, cancelable: true }));
      }, ' BLOCO_VOLUMOSO_FICTICIO '.repeat(400));
      const prazo = Date.now() + 30_000;
      while (await contarBlocos() < quantidadeEsperada) {
        assert.ok(Date.now() < prazo, 'A colagem de texto não foi aplicada pelo editor.');
        await esperar(100);
      }
      await pagina.keyboard.press('Control+z');
      assert.equal(await contarBlocos(), quantidadeEsperada - 400, 'Desfazer não removeu a última colagem.');
      await pagina.keyboard.press('Control+y');
      assert.equal(await contarBlocos(), quantidadeEsperada, 'Refazer não restaurou a colagem.');
      await pagina.keyboard.press('Control+Shift+ArrowLeft');
      await pagina.keyboard.press('Backspace');
      await pagina.keyboard.press('Control+z');
      assert.equal(await contarBlocos(), quantidadeEsperada, 'Desfazer a exclusão perdeu texto colado.');
    });
  } else if (nome === 'placeholders') {
    await acao('alternar_apresentacao', async () => {
      await pagina.getByRole('button', { name: 'Opções de placeholders', exact: true }).click();
      await pagina.getByRole('menuitem', { name: 'Exibir chaves no documento', exact: true }).click();
      await pagina.getByRole('button', { name: 'Dados da REP', exact: true }).click();
    });
    await acao('editar_celula', async () => {
      const celula = corpoTexto(pagina).locator('td').first();
      await celula.click();
      const quantidadeAnterior = (await celula.innerText()).split('CARGA_CELULA').length - 1;
      for (let indice = 0; indice < 3; indice++) {
        await celula.evaluate(elemento => {
          const selecao = elemento.ownerDocument.getSelection();
          const intervalo = elemento.ownerDocument.createRange();
          intervalo.selectNodeContents(elemento);
          intervalo.collapse(false);
          selecao.removeAllRanges();
          selecao.addRange(intervalo);
        });
        await pagina.keyboard.type(' CARGA_CELULA', { delay: 50 });
        assert.equal((await celula.innerText()).split('CARGA_CELULA').length - 1, quantidadeAnterior + indice + 1, 'A edição não foi aplicada à célula selecionada.');
      }
    });
  } else if (nome === 'figuras') {
    await acao('inserir_imagem_local', async () => {
      const antes = await pagina.evaluate(() => [...globalThis.document.querySelectorAll('iframe.tox-edit-area__iframe')].reduce((total, iframe) => total + (iframe.contentDocument?.querySelectorAll('.laudo-figure').length ?? 0), 0));
      await pagina.getByRole('button', { name: 'Painel de Ilustrações', exact: true }).click();
      const indiceImagem = contexto.proximaImagem ?? 0;
      assert.ok(indiceImagem < QUANTIDADE_IMAGENS_ADICIONAIS, 'As imagens fictícias adicionais foram esgotadas.');
      contexto.proximaImagem = indiceImagem + 1;
      await pagina.locator('input[type="file"][multiple]').setInputFiles(`${diretorio}/entradas/adicional-${indiceImagem}.jpg`);
      await pagina.getByRole('button', { name: 'Inserir todas as imagens no laudo', exact: true }).click();
      await pagina.waitForFunction(quantidade => [...globalThis.document.querySelectorAll('iframe.tox-edit-area__iframe')].reduce((total, iframe) => total + (iframe.contentDocument?.querySelectorAll('.laudo-figure').length ?? 0), 0) === quantidade + 1, antes, { polling: 100 });
    });
    await acao('editar_legenda', async () => {
      const legenda = pagina.getByPlaceholder('Descreva a figura...').first();
      await legenda.fill('Legenda fictícia alterada pela suíte');
      await esperar(800);
    });
    await acao('reordenar_remover', async () => {
      let frameFiguras;
      for (const frame of pagina.frames()) if (await frame.locator('.laudo-figure').count()) frameFiguras = frame;
      assert.ok(frameFiguras, 'Nenhuma figura foi inserida.');
      const figuras = frameFiguras.locator('.laudo-figure');
      const antes = await figuras.evaluateAll(elementos => elementos.map(elemento => elemento.getAttribute('data-image-id')));
      if (antes.length > 1) {
        const alvo = frameFiguras.locator('p').filter({ hasText: /^SEPARADOR_FIGURA_/ }).last();
        const anterioresAoAlvo = await alvo.evaluate(elemento => [...elemento.ownerDocument.querySelectorAll('.laudo-figure')]
          .filter(figura => elemento.compareDocumentPosition(figura) & 2).map(figura => figura.getAttribute('data-image-id')));
        const html = await figuras.first().evaluate(elemento => {
          elemento.ownerDocument.body.focus();
          const intervalo = elemento.ownerDocument.createRange();
          intervalo.selectNode(elemento);
          const selecao = elemento.ownerDocument.getSelection();
          selecao.removeAllRanges(); selecao.addRange(intervalo);
          return elemento.outerHTML;
        });
        await pagina.keyboard.press('Backspace');
        await alvo.click();
        await pagina.keyboard.press('Home');
        // A colagem passa pelo plugin do editor, sem tocar no clipboard do usuário.
        await frameFiguras.locator('body').evaluate((elemento, conteudo) => {
          const dados = new globalThis.DataTransfer();
          dados.setData('text/html', conteudo);
          elemento.dispatchEvent(new globalThis.ClipboardEvent('paste', { clipboardData: dados, bubbles: true, cancelable: true }));
        }, html);
        await esperar(600);
        const depois = await figuras.evaluateAll(elementos => elementos.map(elemento => elemento.getAttribute('data-image-id')));
        const esperado = antes.slice(1);
        esperado.splice(anterioresAoAlvo.filter(id => id !== antes[0]).length, 0, antes[0]);
        assert.deepEqual(depois, esperado, 'A movimentação por recorte e colagem não preservou a ordem esperada.');
      }
      // A seleção é preparada; a alteração é feita pelo teclado do editor.
      await figuras.first().evaluate(elemento => {
        elemento.ownerDocument.body.focus();
        const selecao = elemento.ownerDocument.getSelection();
        const intervalo = elemento.ownerDocument.createRange();
        intervalo.selectNode(elemento);
        selecao.removeAllRanges();
        selecao.addRange(intervalo);
      });
      await pagina.keyboard.press('Backspace');
      await esperar(600);
      assert.equal(await figuras.count(), antes.length - 1, 'A exclusão da figura não foi aplicada.');
    });
    if (await pagina.getByRole('button', { name: 'Fechar painel de ilustrações', exact: true }).isVisible()) await pagina.getByRole('button', { name: 'Fechar painel de ilustrações', exact: true }).click();
  } else if (nome === 'encadeamento') {
    await acao('digitar_salvar_trocar_reabrir', async () => {
      await digitar(pagina, ' CARGA_SALVAR_IMEDIATO', 0);
      await salvar(pagina);
      await trocarModo(pagina, modo === 'single' ? 'multi' : 'single');
      await salvar(pagina);
      await pagina.getByRole('button', { name: 'Voltar', exact: true }).first().click();
      await pagina.getByRole('button', { name: 'Editar laudo da REP 999999/2026', exact: true }).click();
      await aguardarEditor(pagina);
      await trocarModo(pagina, modo);
      assert.ok((await corpoTexto(pagina).innerText()).includes('CARGA_SALVAR_IMEDIATO'), 'O texto digitado imediatamente antes de salvar foi perdido.');
      return { caracteresEsperados: ' CARGA_SALVAR_IMEDIATO'.length };
    });
  } else if (nome === 'saida') {
    await acao('cancelar_saida', async () => {
      await digitar(pagina, ' CARGA_CANCELAR_SAIDA', 0);
      await pagina.getByRole('button', { name: 'Voltar', exact: true }).first().click();
      await pagina.getByRole('button', { name: 'Continuar editando', exact: true }).click();
      assert.ok((await corpoTexto(pagina).innerText()).includes('CARGA_CANCELAR_SAIDA'), 'Cancelar a saída perdeu o conteúdo.');
    });
  } else if (nome === 'atalho') {
    await acao('salvar_com_foco_no_iframe', async () => {
      await digitar(pagina, ' CARGA_ATALHO_IFRAME', 0);
      await pagina.keyboard.press('Control+s');
      try {
        await pagina.waitForFunction(async () => {
          const resposta = await globalThis.window.ipcAPI.laudo.findById('carga-laudo');
          return resposta.success && resposta.data?.conteudo.includes('CARGA_ATALHO_IFRAME');
        }, null, { polling: 200, timeout: 5000 });
      } catch (erro) {
        throw new Error('Ctrl+S não persistiu o texto com foco dentro do iframe do editor em cinco segundos.', { cause: erro });
      }
    });
  } else throw new Error(`Cenário não implementado: ${nome}`);
}

export function planejarCombinacoes(semente, quantidade) {
  const aleatorio = criarAleatorio(semente);
  const opcoes = ['digitacao', 'texto', 'figuras', 'placeholders', 'encadeamento', 'saida'];
  return Array.from({ length: quantidade }, () => opcoes[Math.floor(aleatorio() * opcoes.length)]);
}

export function inspecionarDocumento(html) {
  const documento = parseDocument(html);
  const figuras = [];
  let texto = '';
  let tabelas = 0;
  let celulas = 0;
  const valoresCelulas = [];
  const chavesPlaceholders = [];
  const lerTexto = no => no.type === 'text' ? no.data : (no.children ?? []).map(lerTexto).join('');
  const percorrer = no => {
    if (no.type === 'text') texto += no.data;
    if (no.name === 'table') tabelas++;
    if (no.name === 'td' || no.name === 'th') {
      celulas++;
      valoresCelulas.push(lerTexto(no).replace(/\s+/g, ' ').trim());
    }
    const placeholder = /^\{\{(carga_\d+)\}\}$/.exec(no.attribs?.['data-placeholder'] ?? '');
    if (placeholder) chavesPlaceholders.push(placeholder[1]);
    if (no.name === 'figure' && no.attribs?.class?.split(/\s+/).includes('laudo-figure')) {
      let imagem;
      let legenda = '';
      const ler = (filho, emLegenda = false) => {
        if (filho !== no && filho.name === 'figure') throw new Error('Figura aninhada em outra figura.');
        if (filho.name === 'img') imagem = filho.attribs.src;
        if (filho.type === 'text' && emLegenda) legenda += filho.data;
        for (const neto of filho.children ?? []) ler(neto, emLegenda || filho.name === 'figcaption');
      };
      ler(no);
      figuras.push({ id: no.attribs['data-image-id'], legenda: legenda.replace(/\s+/g, ' ').trim(), imagemHash: imagem?.startsWith('data:image/') ? hash(Buffer.from(imagem.split(',')[1], 'base64')) : null });
    }
    for (const filho of no.children ?? []) percorrer(filho);
  };
  percorrer(documento);
  return { texto, tabelas, celulas, valoresCelulas, hashCelulas: hash(JSON.stringify(valoresCelulas)), chavesPlaceholders, figuras };
}

export function validarIntegridade(documento, massa, referencia) {
  let posicaoAnterior = -1;
  for (const marcador of massa.marcadores) {
    const ocorrencias = [...documento.texto.matchAll(new RegExp(marcador + '(?![0-9A-Za-z_])', 'g'))];
    assert.equal(ocorrencias.length, 1, `Marcador perdido ou duplicado: ${marcador}`);
    assert.ok(ocorrencias[0].index > posicaoAnterior, 'Ordem das seções alterada.');
    posicaoAnterior = ocorrencias[0].index;
  }
  assert.equal(documento.tabelas, massa.tabelas, 'Quantidade de tabelas alterada.');
  assert.equal(documento.celulas, massa.celulas, 'Quantidade de células alterada.');
  const rotulosCelulas = new Set();
  for (const valor of documento.valoresCelulas) {
    let original = valor;
    while (original.includes('CARGA_CELULA')) original = original.replace(/\s*CARGA_CELULA\s*/g, '');
    const rotulo = /^CARGA_T(\d+)_L(\d+)_C(\d+)$/.exec(original);
    assert.ok(rotulo, 'Conteúdo original de uma célula perdido.');
    assert.ok(Number(rotulo[1]) < massa.tabelas && Number(rotulo[2]) < massa.linhas && Number(rotulo[3]) < massa.colunas, 'Rótulo de célula fora da massa.');
    rotulosCelulas.add(original);
  }
  assert.equal(rotulosCelulas.size, massa.celulas, 'Células fictícias duplicadas ou perdidas.');
  assert.deepEqual(documento.chavesPlaceholders.slice().sort(), Array.from({ length: massa.placeholders }, (_, indice) => `carga_${indice}`).sort(), 'Placeholders fictícios perdidos ou duplicados.');
  assert.equal(documento.figuras.length, massa.imagens, 'Quantidade final de figuras diferente da esperada.');
  assert.equal(new Set(documento.figuras.map(figura => figura.id)).size, documento.figuras.length, 'IDs de figuras duplicados.');
  documento.figuras.forEach((figura, indice) => {
    const prefixo = `Figura ${String(indice + 1).padStart(2, '0')}`;
    assert.ok(figura.legenda === prefixo || figura.legenda.startsWith(`${prefixo}:`), 'Numeração de figuras incorreta.');
    assert.ok(figura.imagemHash, 'Imagem sem bytes incorporados válidos.');
    const esperado = massa.imagensOriginais?.find(imagem => imagem.id === figura.id)?.sha256;
    assert.ok(esperado ? figura.imagemHash === esperado : massa.imagensAdicionais?.some(imagem => imagem.sha256 === figura.imagemHash), 'Bytes de imagem diferentes da massa fictícia esperada.');
  });
  if (referencia) {
    assert.deepEqual(documento.figuras, referencia.figuras, 'Figuras, imagens, ordem ou legendas não foram preservadas no salvamento.');
    assert.equal(documento.hashCelulas, referencia.hashCelulas, 'Conteúdo ou ordem das células alterados no salvamento.');
    for (const marcador of ['CARGA_SALVAR_IMEDIATO', 'CARGA_CANCELAR_SAIDA', 'CARGA_DIGITACAO_0', 'CARGA_DIGITACAO_1', 'CARGA_DIGITACAO_2', 'CARGA_APOS_PAUSA', 'CARGA_CELULA', 'BLOCO_VOLUMOSO_FICTICIO']) {
      assert.equal(documento.texto.split(marcador).length, referencia.texto.split(marcador).length, `Edição perdida ou duplicada: ${marcador}`);
    }
  }
}
