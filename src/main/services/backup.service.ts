import { app } from 'electron';
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DomUtils, parseDocument } from 'htmlparser2';
import { closeDatabase, criarBackupConsistente, executeQuery } from '../database/sqlite.js';
import { CURRENT_SCHEMA_VERSION, getSchemaVersion } from '../database/index.js';
import { criarArquivoBackup, type EntradaBackup, type ManifestoBackup } from './backup-arquivo.service.js';
import { abrirBancoBackup, consultarBackup, encerrarBancoBackup, executarBackup, verificarBancoBackup } from './backup-sqlite.service.js';
import { configuracaoService } from './configuracao.service.js';
import { safeStorageService } from './safe-storage.service.js';

const DIRETORIO_DADOS = app.getPath('userData');
const BANCO_ATIVO = path.join(DIRETORIO_DADOS, 'laudopericial.db');
const DIRETORIO_IMAGENS = path.join(DIRETORIO_DADOS, 'imagens');
const DIRETORIO_AVATARES = path.join(DIRETORIO_DADOS, 'avatars');
const MARCADOR_RESTAURACAO = path.join(DIRETORIO_DADOS, 'restauracao-pendente.json');
const CHAVES_SECRETAS = ['api_key_groq', 'api_key_gemini', 'gdl_senha_producao', 'gdl_senha_homologacao'];

interface UsuarioOrigem {
  id: string;
  foto_url: string | null;
}

interface CredencialLocal {
  username: string;
  email: string;
  senha_hash: string;
}

interface SegredoPortatil {
  chave: string;
  valor: string;
}

interface ImagemBackup {
  id: string;
  laudo_id: string;
  caminho_relativo: string;
  imagem_origem_id: string | null;
}

async function filtrarImagensDoSnapshot(conexao: Awaited<ReturnType<typeof abrirBancoBackup>>): Promise<string[]> {
  const laudos = await consultarBackup<{ id: string; conteudo: string }>(conexao, 'SELECT id, conteudo FROM laudos');
  const imagens = await consultarBackup<ImagemBackup>(conexao,
    'SELECT id, laudo_id, caminho_relativo, imagem_origem_id FROM imagens_laudo');
  const porId = new Map(imagens.map(imagem => [imagem.id, imagem]));
  const preservadas = new Set<string>();
  for (const laudo of laudos) {
    const documento = parseDocument(laudo.conteudo);
    const exemplos = DomUtils.findAll(elemento => elemento.attribs['data-dummy'] === 'true', documento.children);
    for (const exemplo of exemplos) DomUtils.removeElement(exemplo);
    const referencias = DomUtils.findAll(elemento => 'data-image-id' in elemento.attribs, documento.children);
    for (const referencia of referencias) {
      let id: string | null = referencia.attribs['data-image-id'].trim();
      const cadeia = new Set<string>();
      while (id !== null) {
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error(`Referência de imagem inválida no laudo ${laudo.id}.`);
        const imagem = porId.get(id);
        if (!imagem || imagem.laudo_id !== laudo.id) {
          throw new Error(`Imagem ${id} ausente ou vinculada a outro laudo (laudo ${laudo.id}).`);
        }
        if (cadeia.has(id)) throw new Error(`Ciclo nas imagens de origem do laudo ${laudo.id}.`);
        if (preservadas.has(id)) break;
        cadeia.add(id);
        id = imagem.imagem_origem_id;
      }
      for (const imagemId of cadeia) preservadas.add(imagemId);
    }
  }
  // A poda afeta apenas a cópia; o banco ativo e a fila de ilustrações permanecem intactos.
  await executarBackup(conexao, 'BEGIN TRANSACTION');
  try {
    for (const imagem of imagens) {
      if (!preservadas.has(imagem.id)) await executarBackup(conexao, 'DELETE FROM imagens_laudo WHERE id = ?', [imagem.id]);
    }
    await verificarBancoBackup(conexao);
    await executarBackup(conexao, 'COMMIT');
  } catch (erro) {
    await executarBackup(conexao, 'ROLLBACK');
    throw erro;
  }
  return [...new Set(imagens.filter(imagem => preservadas.has(imagem.id))
    .map(imagem => imagem.caminho_relativo.replace(/\\/g, '/')))];
}

interface MarcadorRestauracao {
  diretorioAnterior: string;
  bancoAnterior: boolean;
  imagensAnteriores: boolean;
  avataresAnteriores: boolean;
  pronto: boolean;
}

function caminhoRelativoSeguro(relativo: string, raiz: string): string {
  if (!relativo || relativo.includes('\\') || relativo.startsWith('/') || relativo.split('/').includes('..')) {
    throw new Error('Caminho de imagem inválido no banco.');
  }
  const absoluto = path.resolve(DIRETORIO_DADOS, relativo);
  if (!absoluto.startsWith(`${path.resolve(raiz)}${path.sep}`)) throw new Error('Imagem fora da pasta permitida.');
  return absoluto;
}

async function prepararBancoCompleto(diretorio: string): Promise<{ banco: string; entradas: EntradaBackup[] }> {
  const banco = path.join(diretorio, 'laudopericial.db');
  await criarBackupConsistente(banco);
  const conexao = await abrirBancoBackup(banco);
  let usuario: UsuarioOrigem;
  let caminhosImagens: string[] = [];
  try {
    const versao = await verificarBancoBackup(conexao);
    if (versao !== CURRENT_SCHEMA_VERSION) throw new Error('Banco local precisa estar atualizado para criar backup.');
    const usuarios = await consultarBackup<UsuarioOrigem>(conexao, 'SELECT id, foto_url FROM users');
    if (usuarios.length !== 1) throw new Error('O backup requer exatamente um usuário local.');
    usuario = usuarios[0];
    caminhosImagens = await filtrarImagensDoSnapshot(conexao);
    await executarBackup(conexao, 'UPDATE users SET username = ?, email = ?, senha_hash = ? WHERE id = ?',
      [`backup-${usuario.id}`, `backup-${usuario.id}@invalid.local`, randomUUID(), usuario.id]);
    for (const chave of CHAVES_SECRETAS) await executarBackup(conexao, 'UPDATE configuracoes SET valor = NULL WHERE chave = ?', [chave]);
  } finally {
    await encerrarBancoBackup(conexao);
  }
  const entradas: EntradaBackup[] = [{ nome: 'laudopericial.db', caminho: banco }];
  for (const caminhoImagem of caminhosImagens) {
    const absoluto = caminhoRelativoSeguro(caminhoImagem.replace(/\\/g, '/'), DIRETORIO_IMAGENS);
    const arquivo = await stat(absoluto).catch((erro: unknown) => {
      if (erro && typeof erro === 'object' && 'code' in erro && erro.code === 'ENOENT') {
        throw new Error(`Imagem necessária ao backup ausente: ${caminhoImagem}.`);
      }
      throw erro;
    });
    if (!arquivo.isFile()) throw new Error(`Imagem necessária ao backup inválida: ${caminhoImagem}.`);
    entradas.push({ nome: caminhoImagem.replace(/\\/g, '/'), caminho: absoluto });
  }
  if (usuario.foto_url) {
    const raiz = path.resolve(DIRETORIO_AVATARES);
    const avatar = path.resolve(usuario.foto_url);
    if (!avatar.startsWith(`${raiz}${path.sep}`) || !(await stat(avatar)).isFile()) throw new Error('Avatar do perito ausente.');
    entradas.push({ nome: `avatars/${usuario.id}${path.extname(avatar).toLowerCase()}`, caminho: avatar });
  }
  const segredos: SegredoPortatil[] = [];
  for (const chave of CHAVES_SECRETAS) {
    const valor = await configuracaoService.obter(chave);
    if (valor) segredos.push({ chave, valor });
  }
  entradas.push({ nome: 'segredos.json', conteudo: Buffer.from(JSON.stringify(segredos), 'utf8') });
  return { banco, entradas };
}

export async function criarBackup(destino: string, senha: string): Promise<{ success: boolean; path?: string; error?: string }> {
  const diretorio = path.join(DIRETORIO_DADOS, `backup-temporario-${randomUUID()}`);
  try {
    await mkdir(diretorio, { recursive: true });
    const { entradas } = await prepararBancoCompleto(diretorio);
    await criarArquivoBackup(destino, senha, 'completo', app.getVersion(), await getSchemaVersion(), entradas);
    return { success: true, path: destino };
  } catch (erro) {
    return { success: false, error: erro instanceof Error ? erro.message : 'Falha ao criar backup completo.' };
  } finally {
    await rm(diretorio, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function previaBackupCompleto(diretorio: string, manifesto: ManifestoBackup): Promise<Record<string, unknown>> {
  if (manifesto.tipo !== 'completo') throw new Error('O arquivo não contém um backup completo.');
  const caminhoBanco = path.join(diretorio, 'laudopericial.db');
  const banco = await abrirBancoBackup(caminhoBanco, true);
  try {
    const versao = await verificarBancoBackup(banco);
    if (versao > CURRENT_SCHEMA_VERSION) throw new Error('Backup criado por uma versão mais recente do laWdo.');
    if (versao !== CURRENT_SCHEMA_VERSION) throw new Error('Backup com schema diferente da versão atual.');
    const usuarios = await consultarBackup<UsuarioOrigem>(banco, 'SELECT id, foto_url FROM users');
    if (usuarios.length !== 1) throw new Error('O backup requer exatamente um perfil de perito.');
    const imagensBanco = await consultarBackup<{ caminho_relativo: string }>(banco,
      'SELECT DISTINCT caminho_relativo FROM imagens_laudo');
    const imagensArquivo = manifesto.arquivos.filter(item => item.nome.startsWith('imagens/'));
    const caminhos = new Set(imagensBanco.map(item => item.caminho_relativo.replace(/\\/g, '/')));
    if (caminhos.size !== imagensArquivo.length || imagensArquivo.some(item => !caminhos.has(item.nome))) {
      throw new Error('Imagens do backup não correspondem aos vínculos dos laudos.');
    }
    for (const caminho of caminhos) caminhoRelativoSeguro(caminho, DIRETORIO_IMAGENS);
    const [reps] = await consultarBackup<{ total: number }>(banco, 'SELECT COUNT(*) AS total FROM reps');
    const [laudos] = await consultarBackup<{ total: number }>(banco, 'SELECT COUNT(*) AS total FROM laudos');
    return {
      tipo: 'completo', criadoEm: manifesto.criadoEm, versaoSchema: versao,
      reps: reps?.total ?? 0, laudos: laudos?.total ?? 0,
      imagens: imagensArquivo.length,
      possuiAvatar: manifesto.arquivos.some(item => item.nome.startsWith('avatars/')),
      aviso: 'Banco, imagens e perfil serão substituídos. O login e a senha locais serão preservados.',
    };
  } finally {
    await encerrarBancoBackup(banco);
  }
}

async function prepararBancoRestaurado(diretorio: string, manifesto: ManifestoBackup): Promise<void> {
  await previaBackupCompleto(diretorio, manifesto);
  const usuariosLocais = await executeQuery<CredencialLocal>('SELECT username, email, senha_hash FROM users');
  if (usuariosLocais.length !== 1) throw new Error('A restauração requer exatamente um usuário local.');
  const banco = await abrirBancoBackup(path.join(diretorio, 'laudopericial.db'));
  try {
    const [origem] = await consultarBackup<UsuarioOrigem>(banco, 'SELECT id, foto_url FROM users');
    const local = usuariosLocais[0];
    await executarBackup(banco, 'UPDATE users SET username = ?, email = ?, senha_hash = ? WHERE id = ?',
      [local.username, local.email, local.senha_hash, origem.id]);
    const avatar = manifesto.arquivos.find(item => item.nome.startsWith(`avatars/${origem.id}.`));
    await executarBackup(banco, 'UPDATE users SET foto_url = ? WHERE id = ?',
      [avatar ? path.join(DIRETORIO_AVATARES, path.basename(avatar.nome)) : null, origem.id]);
    const lido: unknown = JSON.parse(await readFile(path.join(diretorio, 'segredos.json'), 'utf8'));
    if (!Array.isArray(lido) || !lido.every(item => item && typeof item === 'object' && CHAVES_SECRETAS.includes(String(item.chave)) && typeof item.valor === 'string')) {
      throw new Error('Credenciais do backup inválidas.');
    }
    if (lido.length > 0 && !safeStorageService.isAvailable()) throw new Error('Proteção local de credenciais indisponível.');
    for (const segredo of lido as SegredoPortatil[]) {
      await executarBackup(banco, 'UPDATE configuracoes SET valor = ? WHERE chave = ?', [safeStorageService.encrypt(segredo.valor), segredo.chave]);
    }
    await verificarBancoBackup(banco);
  } finally {
    await encerrarBancoBackup(banco);
  }
}

async function moverSeExistir(origem: string, destino: string): Promise<boolean> {
  try {
    await stat(origem);
    await rename(origem, destino);
    return true;
  } catch (erro) {
    if (erro && typeof erro === 'object' && 'code' in erro && erro.code === 'ENOENT') return false;
    throw erro;
  }
}

async function existe(caminho: string): Promise<boolean> {
  try {
    await stat(caminho);
    return true;
  } catch (erro) {
    if (erro && typeof erro === 'object' && 'code' in erro && erro.code === 'ENOENT') return false;
    throw erro;
  }
}

export async function restaurarBackupExtraido(diretorio: string, manifesto: ManifestoBackup): Promise<void> {
  await prepararBancoRestaurado(diretorio, manifesto);
  const anterior = path.join(DIRETORIO_DADOS, `restauracao-anterior-${randomUUID()}`);
  await mkdir(anterior, { recursive: true });
  const marcador: MarcadorRestauracao = {
    diretorioAnterior: anterior,
    bancoAnterior: await existe(BANCO_ATIVO),
    imagensAnteriores: await existe(DIRETORIO_IMAGENS),
    avataresAnteriores: await existe(DIRETORIO_AVATARES),
    pronto: false,
  };
  const instalados = { banco: false, imagens: false, avatares: false };
  const bancoNovo = path.join(diretorio, 'laudopericial.db');
  const imagensNovas = path.join(diretorio, 'imagens');
  const avataresNovos = path.join(diretorio, 'avatars');
  await mkdir(imagensNovas, { recursive: true });
  await mkdir(avataresNovos, { recursive: true });
  await closeDatabase();
  try {
    await writeFile(MARCADOR_RESTAURACAO, JSON.stringify(marcador), 'utf8');
    if (marcador.bancoAnterior) await moverSeExistir(BANCO_ATIVO, path.join(anterior, 'laudopericial.db'));
    if (marcador.imagensAnteriores) await moverSeExistir(DIRETORIO_IMAGENS, path.join(anterior, 'imagens'));
    if (marcador.avataresAnteriores) await moverSeExistir(DIRETORIO_AVATARES, path.join(anterior, 'avatars'));
    await rename(bancoNovo, BANCO_ATIVO);
    instalados.banco = true;
    await rename(imagensNovas, DIRETORIO_IMAGENS);
    instalados.imagens = true;
    await rename(avataresNovos, DIRETORIO_AVATARES);
    instalados.avatares = true;
    marcador.pronto = true;
    await writeFile(MARCADOR_RESTAURACAO, JSON.stringify(marcador), 'utf8');
  } catch (erro) {
    await reverterRestauracao(marcador, instalados);
    throw erro;
  }
}

async function reverterRestauracao(
  marcador: MarcadorRestauracao,
  instalados = { banco: true, imagens: true, avatares: true },
): Promise<void> {
  const bancoAnterior = path.join(marcador.diretorioAnterior, 'laudopericial.db');
  const imagensAnteriores = path.join(marcador.diretorioAnterior, 'imagens');
  const avataresAnteriores = path.join(marcador.diretorioAnterior, 'avatars');
  if (await existe(bancoAnterior) || (!marcador.bancoAnterior && instalados.banco)) await rm(BANCO_ATIVO, { force: true });
  if (await existe(imagensAnteriores) || (!marcador.imagensAnteriores && instalados.imagens)) await rm(DIRETORIO_IMAGENS, { recursive: true, force: true });
  if (await existe(avataresAnteriores) || (!marcador.avataresAnteriores && instalados.avatares)) await rm(DIRETORIO_AVATARES, { recursive: true, force: true });
  if (await existe(bancoAnterior)) await copyFile(bancoAnterior, BANCO_ATIVO);
  if (await existe(imagensAnteriores)) await rename(imagensAnteriores, DIRETORIO_IMAGENS);
  if (await existe(avataresAnteriores)) await rename(avataresAnteriores, DIRETORIO_AVATARES);
  await rm(MARCADOR_RESTAURACAO, { force: true });
  await rm(marcador.diretorioAnterior, { recursive: true, force: true });
}

function validarMarcador(valor: unknown): MarcadorRestauracao {
  if (!valor || typeof valor !== 'object') throw new Error('Marcador de restauração inválido.');
  const marcador = valor as Partial<MarcadorRestauracao>;
  if (typeof marcador.diretorioAnterior !== 'string'
    || path.dirname(path.resolve(marcador.diretorioAnterior)) !== path.resolve(DIRETORIO_DADOS)
    || !path.basename(marcador.diretorioAnterior).startsWith('restauracao-anterior-')
    || typeof marcador.bancoAnterior !== 'boolean'
    || typeof marcador.imagensAnteriores !== 'boolean'
    || typeof marcador.avataresAnteriores !== 'boolean'
    || typeof marcador.pronto !== 'boolean') throw new Error('Marcador de restauração inválido.');
  return marcador as MarcadorRestauracao;
}

export async function concluirRestauracaoPendente(): Promise<void> {
  try {
    const marcador = validarMarcador(JSON.parse(await readFile(MARCADOR_RESTAURACAO, 'utf8')) as unknown);
    if (!marcador.pronto) throw new Error('Restauração interrompida antes da instalação completa.');
    await rm(marcador.diretorioAnterior, { recursive: true, force: true });
    await rm(MARCADOR_RESTAURACAO, { force: true });
  } catch (erro) {
    if (erro && typeof erro === 'object' && 'code' in erro && erro.code === 'ENOENT') return;
    throw erro;
  }
}

export async function reverterRestauracaoPendente(): Promise<boolean> {
  try {
    const marcador = validarMarcador(JSON.parse(await readFile(MARCADOR_RESTAURACAO, 'utf8')) as unknown);
    await closeDatabase();
    await reverterRestauracao(marcador);
    return true;
  } catch (erro) {
    if (erro && typeof erro === 'object' && 'code' in erro && erro.code === 'ENOENT') return false;
    throw erro;
  }
}
