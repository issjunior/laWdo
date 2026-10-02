import { app } from 'electron';
import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { executeNonQuery, executeQuery, withTransaction } from '../database/sqlite.js';
import { getSchemaVersion } from '../database/index.js';
import { criarArquivoBackup, type EntradaBackup, type ManifestoBackup } from './backup-arquivo.service.js';
import { configuracaoService } from './configuracao.service.js';
import { safeStorageService } from './safe-storage.service.js';

type Linha = Record<string, string | number | null>;

const TABELAS = [
  'solicitantes', 'tipos_exame', 'templates', 'secoes_template',
  'categorias_placeholders', 'placeholders', 'categorias_pecas', 'pecas',
  'wizards', 'etapas_wizard', 'opcoes_etapa', 'regras_wizard',
] as const;
const CHAVES_PORTATEIS = new Set([
  'cabecalho_laudo', 'cabecalho_paginas', 'pdf_margins', 'margens_pdf',
  'provedor_ia', 'api_key_groq', 'api_key_gemini', 'modelo_ia_padrao', 'modelo_gemini_padrao',
  'privacidade_ia', 'qualidade_imagem_ia', 'perfil_resposta_ia',
  'gdl_ambiente', 'gdl_url_producao', 'gdl_url_homologacao',
  'gdl_login_producao', 'gdl_login_homologacao',
  'gdl_senha_producao', 'gdl_senha_homologacao',
  'gdl_cpf_usuario_producao', 'gdl_cpf_usuario_homologacao',
]);
const CHAVES_SECRETAS = new Set(['api_key_groq', 'api_key_gemini', 'gdl_senha_producao', 'gdl_senha_homologacao']);

interface Perfil {
  nome: string;
  matricula: string | null;
  telefone: string | null;
  cargo: string | null;
  lotacao: string | null;
}
interface DadosConfiguracao {
  tabelas: Record<string, Linha[]>;
  configuracoes: Linha[];
  perfil: Perfil;
  avatar?: string;
}

function objeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

async function usuarioUnico(): Promise<{ id: string; foto_url: string | null } & Perfil> {
  const usuarios = await executeQuery<{ id: string; foto_url: string | null } & Perfil>('SELECT id, foto_url, nome, matricula, telefone, cargo, lotacao FROM users');
  if (usuarios.length !== 1) throw new Error('O backup requer exatamente um usuário local.');
  return usuarios[0];
}

async function montarDados(): Promise<{ dados: DadosConfiguracao; arquivos: EntradaBackup[] }> {
  const tabelas: Record<string, Linha[]> = {};
  for (const tabela of TABELAS) tabelas[tabela] = await executeQuery<Linha>(`SELECT * FROM ${tabela}`);
  const configuracoes: Linha[] = [];
  for (const registro of await executeQuery<Linha>('SELECT * FROM configuracoes')) {
    const chave = registro.chave;
    if (typeof chave !== 'string' || !CHAVES_PORTATEIS.has(chave)) continue;
    configuracoes.push({ ...registro, valor: CHAVES_SECRETAS.has(chave) ? await configuracaoService.obter(chave) : registro.valor });
  }
  const usuario = await usuarioUnico();
  const dados: DadosConfiguracao = {
    tabelas, configuracoes,
    perfil: { nome: usuario.nome, matricula: usuario.matricula, telefone: usuario.telefone, cargo: usuario.cargo, lotacao: usuario.lotacao },
  };
  const arquivos: EntradaBackup[] = [];
  if (usuario.foto_url) {
    const raiz = path.resolve(app.getPath('userData'), 'avatars');
    const avatar = path.resolve(usuario.foto_url);
    if (!avatar.startsWith(`${raiz}${path.sep}`) || !(await stat(avatar)).isFile()) throw new Error('Avatar local inválido.');
    const extensao = path.extname(avatar).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(extensao)) throw new Error('Formato do avatar inválido.');
    dados.avatar = `avatar${extensao}`;
    arquivos.push({ nome: dados.avatar, caminho: avatar });
  }
  return { dados, arquivos };
}

export async function exportarConfig(destino: string, senha: string): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const { dados, arquivos } = await montarDados();
    await criarArquivoBackup(destino, senha, 'configuracao', app.getVersion(), await getSchemaVersion(), [
      { nome: 'configuracao.json', conteudo: Buffer.from(JSON.stringify(dados), 'utf8') }, ...arquivos,
    ]);
    return { success: true, path: destino };
  } catch (erro) {
    return { success: false, error: erro instanceof Error ? erro.message : 'Falha ao criar backup de configuração.' };
  }
}

async function lerConfiguracao(diretorio: string, manifesto: ManifestoBackup): Promise<DadosConfiguracao> {
  if (manifesto.tipo !== 'configuracao' || !manifesto.arquivos.some(item => item.nome === 'configuracao.json')) {
    throw new Error('O arquivo não contém um backup de configuração.');
  }
  const valor: unknown = JSON.parse(await readFile(path.join(diretorio, 'configuracao.json'), 'utf8'));
  if (!objeto(valor) || !objeto(valor.tabelas) || !Array.isArray(valor.configuracoes) || !objeto(valor.perfil)) {
    throw new Error('Dados de configuração inválidos.');
  }
  for (const tabela of TABELAS) {
    if (!Array.isArray(valor.tabelas[tabela]) || !valor.tabelas[tabela].every(objeto)) throw new Error(`Tabela ${tabela} inválida.`);
  }
  if (!valor.configuracoes.every(objeto) || typeof valor.perfil.nome !== 'string') throw new Error('Perfil inválido.');
  if (valor.avatar !== undefined && (!['avatar.png', 'avatar.jpg', 'avatar.jpeg'].includes(String(valor.avatar))
    || !manifesto.arquivos.some(item => item.nome === valor.avatar))) throw new Error('Avatar inválido.');
  return valor as unknown as DadosConfiguracao;
}

export async function previaConfiguracao(diretorio: string, manifesto: ManifestoBackup): Promise<Record<string, unknown>> {
  const dados = await lerConfiguracao(diretorio, manifesto);
  return {
    tipo: 'configuracao', criadoEm: manifesto.criadoEm,
    quantidades: Object.fromEntries(TABELAS.map(tabela => [tabela, dados.tabelas[tabela].length])),
    possuiAvatar: Boolean(dados.avatar),
    possuiCredenciais: dados.configuracoes.some(item => typeof item.chave === 'string' && CHAVES_SECRETAS.has(item.chave)),
    aviso: 'A configuração atual será substituída. REPs e laudos não são importados.',
  };
}

async function inserirLinhas(tabela: string, linhas: Linha[]): Promise<void> {
  const permitidas = new Set((await executeQuery<{ name: string }>(`PRAGMA table_info(${tabela})`)).map(item => item.name));
  for (const linha of linhas) {
    const colunas = Object.keys(linha);
    if (colunas.length === 0 || colunas.some(coluna => !permitidas.has(coluna))) throw new Error(`Colunas inválidas em ${tabela}.`);
    await executeNonQuery(`INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`, colunas.map(coluna => linha[coluna] ?? null));
  }
}

export async function restaurarConfig(diretorio: string, manifesto: ManifestoBackup): Promise<void> {
  const dados = await lerConfiguracao(diretorio, manifesto);
  const [reps] = await executeQuery<{ total: number }>('SELECT COUNT(*) AS total FROM reps');
  const [laudos] = await executeQuery<{ total: number }>('SELECT COUNT(*) AS total FROM laudos');
  if ((reps?.total ?? 0) > 0 || (laudos?.total ?? 0) > 0) throw new Error('Há REPs ou laudos vinculados à configuração atual. Restauração bloqueada.');
  if (dados.configuracoes.some(item => typeof item.chave === 'string' && CHAVES_SECRETAS.has(item.chave)) && !safeStorageService.isAvailable()) {
    throw new Error('A proteção local das credenciais não está disponível.');
  }
  const usuario = await usuarioUnico();
  const avatarDestino = dados.avatar ? path.join(app.getPath('userData'), 'avatars', `${usuario.id}-${randomUUID()}${path.extname(dados.avatar)}`) : null;
  if (avatarDestino && dados.avatar) {
    await mkdir(path.dirname(avatarDestino), { recursive: true });
    await copyFile(path.join(diretorio, dados.avatar), avatarDestino);
  }
  try {
    await withTransaction(async () => {
      await executeNonQuery('PRAGMA defer_foreign_keys = ON');
      for (const tabela of [...TABELAS].reverse()) await executeNonQuery(`DELETE FROM ${tabela}`);
      for (const tabela of TABELAS) await inserirLinhas(tabela, dados.tabelas[tabela]);
      for (const chave of CHAVES_PORTATEIS) await executeNonQuery('DELETE FROM configuracoes WHERE chave = ?', [chave]);
      for (const registro of dados.configuracoes) {
        const chave = registro.chave;
        if (typeof chave !== 'string' || !CHAVES_PORTATEIS.has(chave)) throw new Error('Chave de configuração inválida.');
        const valor = CHAVES_SECRETAS.has(chave) && typeof registro.valor === 'string'
          ? safeStorageService.encrypt(registro.valor) : registro.valor;
        await executeNonQuery('INSERT INTO configuracoes (chave, valor, tipo, descricao) VALUES (?, ?, ?, ?)',
          [chave, valor ?? null, registro.tipo ?? 'texto', registro.descricao ?? null]);
      }
      await executeNonQuery('UPDATE users SET nome = ?, matricula = ?, telefone = ?, cargo = ?, lotacao = ?, foto_url = ? WHERE id = ?',
        [dados.perfil.nome, dados.perfil.matricula, dados.perfil.telefone, dados.perfil.cargo, dados.perfil.lotacao, avatarDestino, usuario.id]);
      if ((await executeQuery('PRAGMA foreign_key_check')).length > 0) throw new Error('O backup contém vínculos inválidos.');
    });
  } catch (erro) {
    if (avatarDestino) await rm(avatarDestino, { force: true });
    throw erro;
  }
}
