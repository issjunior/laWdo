import { app, nativeImage } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import bcrypt from 'bcrypt';
import { MASSAS, QUANTIDADE_IMAGENS_ADICIONAIS, validarIsolamento, hash } from './configuracao.mjs';
import { gerarBitmap, gerarDocumento } from './massa.mjs';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
async function preparar() {
  const diretorio = await validarIsolamento(workspace, process.argv[2]);
  app.setPath('userData', diretorio);
  const prazo = setTimeout(() => app.exit(2), 120_000);
  const importar = nome => import(pathToFileURL(path.join(workspace, 'out/main', nome)).href);
  let fechar;
  try {
    await app.whenReady();
    const { nome, semente } = JSON.parse(await readFile(path.join(diretorio, 'preparacao.json'), 'utf8'));
    const massa = MASSAS[nome];
    if (!massa || !Number.isSafeInteger(semente)) throw new Error('Preparação inválida.');
    const { setupDatabase } = await importar('database/index.js');
    const { executeNonQuery: gravar, closeDatabase } = await importar('database/sqlite.js');
    fechar = closeDatabase;
    await setupDatabase();
    await gravar('INSERT INTO users (id,nome,email,username,senha_hash,forma_tratamento,ativo) VALUES (?,?,?,?,?,?,?)', ['carga-perito', 'Perito Fictício de Carga', 'carga@example.invalid', 'carga.perito', await bcrypt.hash('CargaFicticia!2026', 10), 'masculino', 1]);
    await gravar('INSERT INTO tipos_exame (id,nome,codigo) VALUES (?,?,?)', ['carga-exame', 'Exame Fictício de Carga', 'CARGA']);
    await gravar('INSERT INTO templates (id,nome,tipo_exame_id) VALUES (?,?,?)', ['carga-template', 'Template Fictício', 'carga-exame']);
    await gravar('INSERT INTO reps (id,numero,tipo_exame_id,data_requisicao,usuario_id,status,campos_especificos) VALUES (?,?,?,?,?,?,?)', ['carga-rep', '999999/2026', 'carga-exame', '2026-01-01', 'carga-perito', 'Em andamento', '{}']);
    await gravar('INSERT INTO laudos (id,rep_id,perito_id,template_id,conteudo,status) VALUES (?,?,?,?,?,?)', ['carga-laudo', 'carga-rep', 'carga-perito', 'carga-template', '<p>Preparação fictícia</p>', 'Em andamento']);
    await gravar('INSERT INTO categorias_placeholders (id,chave,label) VALUES (?,?,?)', ['carga-categoria', 'carga', 'Carga fictícia']);
    for (let indice = 0; indice < massa.placeholders; indice++) {
      await gravar('INSERT INTO placeholders (id,chave,valor,categoria_id) VALUES (?,?,?,?)', [`carga-ph-${indice}`, `carga_${indice}`, `Valor fictício ${indice}`, 'carga-categoria']);
    }
    const { salvarImagemLaudo, arquivarImagemLaudo } = await importar('services/imagem-laudo.service.js');
    const imagens = [];
    await mkdir(path.join(diretorio, 'entradas'), { recursive: true });
    for (let indice = 0; indice < massa.imagens; indice++) {
      const bytes = nativeImage.createFromBitmap(gerarBitmap(semente + indice, massa.largura, massa.altura), { width: massa.largura, height: massa.altura }).toJPEG(massa.qualidade);
      if (!bytes.length) throw new Error('Imagem fictícia inválida.');
      const id = `carga-imagem-${indice}`;
      const dataUri = `data:image/jpeg;base64,${bytes.toString('base64')}`;
      await salvarImagemLaudo('carga-laudo', { id, nomeArquivo: `${id}.jpg`, dataUri, legenda: `Foto fictícia ${indice + 1}`, origem: 'local', sequencia: indice + 1 });
      await arquivarImagemLaudo('carga-laudo', id);
      await writeFile(path.join(diretorio, 'entradas', `${id}.jpg`), bytes);
      imagens.push({ id, dataUri });
    }
    // A imagem adicional fica disponível para inserção pela interface em todas as massas.
    const imagensAdicionais = [];
    for (let indice = 0; indice < QUANTIDADE_IMAGENS_ADICIONAIS; indice++) {
      const extra = nativeImage.createFromBitmap(gerarBitmap((semente + 10_000 + indice) >>> 0, 320, 240), { width: 320, height: 240 }).toJPEG(65);
      if (!extra.length) throw new Error('Imagem adicional fictícia inválida.');
      const arquivo = `adicional-${indice}.jpg`;
      await writeFile(path.join(diretorio, 'entradas', arquivo), extra);
      imagensAdicionais.push({ arquivo, sha256: hash(extra) });
    }
    const documento = gerarDocumento(nome, imagens);
    await gravar('UPDATE laudos SET conteudo = ? WHERE id = ?', [documento.html, 'carga-laudo']);
    await writeFile(path.join(diretorio, 'massa.json'), JSON.stringify({ ...documento.resumo, imagensAdicionais, semente, versaoGerador: 1 }, null, 2));
    await closeDatabase();
    app.exit(0);
  } catch (erro) {
    await writeFile(path.join(diretorio, 'erro-preparacao.json'), JSON.stringify({ erro: erro instanceof Error ? erro.stack : String(erro) }));
    await fechar?.().catch(() => undefined);
    app.exit(1);
  } finally { clearTimeout(prazo); }

}
void preparar().catch(erro => { process.stderr.write(String(erro)); app.exit(1); });
