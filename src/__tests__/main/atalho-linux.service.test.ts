import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chmod, copyFile, lstat, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const simulacoes = vi.hoisted(() => ({
  caminhos: {} as Record<string, string>,
  empacotado: true,
  aviso: vi.fn(),
  informacao: vi.fn(),
  executar: vi.fn((
    _arquivo: string, _argumentos: string[], _opcoes: unknown,
    retorno: (erro: Error | null, saida: string, erroSaida: string) => void,
  ) => retorno(null, '', '')),
}));

vi.mock('electron', () => ({
  app: {
    get isPackaged() { return simulacoes.empacotado; },
    getPath: (nome: string) => simulacoes.caminhos[nome],
  },
}));
vi.mock('../../main/utils/logger.js', () => ({
  getLogger: () => ({ warn: simulacoes.aviso, info: simulacoes.informacao }),
}));
vi.mock('node:child_process', async importar => {
  const original = await importar<typeof import('node:child_process')>();
  const simulado = { ...original, execFile: simulacoes.executar };
  return { ...simulado, default: simulado };
});
vi.mock('node:fs/promises', async importar => {
  const original = await importar<typeof import('node:fs/promises')>();
  const simulado = {
    ...original,
    copyFile: vi.fn(original.copyFile),
    chmod: vi.fn(original.chmod),
    stat: vi.fn(original.stat),
    lstat: vi.fn(original.lstat),
  };
  return { ...simulado, default: simulado };
});

import { criarAtalhoDesktopLinux } from '../../main/services/atalho-linux.service';

let raiz: string;
let recursos: string;
let imagem: string;

function caminhoAtalho(appImage = false): string {
  return path.join(simulacoes.caminhos.desktop, appImage ? 'laWdo-AppImage.desktop' : 'laWdo.desktop');
}

function caminhoRegistro(appImage = false): string {
  return path.join(simulacoes.caminhos.userData, 'integracao-desktop', appImage ? 'appimage.json' : 'deb.json');
}

beforeEach(async () => {
  vi.clearAllMocks();
  simulacoes.empacotado = true;
  raiz = await mkdtemp(path.join(os.tmpdir(), 'lawdo-atalho-'));
  recursos = path.join(raiz, 'recursos');
  imagem = path.join(raiz, 'laWdo 0.1.22.AppImage');
  simulacoes.caminhos = {
    home: raiz,
    desktop: path.join(raiz, 'Área de trabalho'),
    userData: path.join(raiz, 'dados'),
    exe: path.join(raiz, 'laWdo'),
  };
  await mkdir(simulacoes.caminhos.desktop);
  await mkdir(path.join(recursos, 'assets'), { recursive: true });
  await writeFile(path.join(recursos, 'assets', 'icone-linux.png'), 'icone de teste');
  await writeFile(simulacoes.caminhos.exe, 'executavel de teste');
  await writeFile(imagem, 'appimage de teste');
  vi.stubGlobal('process', {
    ...process, platform: 'linux', getuid: () => 1000, env: {}, resourcesPath: recursos,
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(raiz, { recursive: true, force: true });
});

describe('atalho no desktop Linux', () => {
  it('cria o atalho Debian na pasta localizada e registra permissão e confiança', async () => {
    await criarAtalhoDesktopLinux();
    const conteudo = await readFile(caminhoAtalho(), 'utf8');
    expect(conteudo).toContain('Name=laWdo\n');
    expect(conteudo).toContain('Terminal=false\n');
    expect(conteudo).toContain('X-laWdo-Gerenciado=true\n');
    expect(vi.mocked(chmod)).toHaveBeenCalledWith(caminhoAtalho(), 0o755);
    expect(simulacoes.executar).toHaveBeenCalledWith(
      'gio', ['set', caminhoAtalho(), 'metadata::trusted', 'true'], { timeout: 3000 }, expect.any(Function),
    );
    expect(await readFile(caminhoRegistro(), 'utf8')).toMatch(/"versao":1,"hash":"[a-f0-9]{64}"/);
    expect(simulacoes.informacao).toHaveBeenCalledWith('Confiança do atalho registrada pelo gio.', expect.any(Object));
  });

  it('usa o AppImage original e um ícone persistente, permitindo coexistência com o Debian', async () => {
    await criarAtalhoDesktopLinux();
    process.env.APPIMAGE = imagem;
    await criarAtalhoDesktopLinux();
    const conteudo = await readFile(caminhoAtalho(true), 'utf8');
    expect(conteudo).toContain('Name=laWdo (AppImage)\n');
    expect(conteudo).toContain('laWdo 0.1.22.AppImage"\n');
    expect(conteudo).not.toContain(recursos);
    expect(await readFile(path.join(simulacoes.caminhos.userData, 'integracao-desktop', 'icone.png'), 'utf8'))
      .toBe('icone de teste');
    expect(await readFile(caminhoAtalho(), 'utf8')).toContain('Name=laWdo\n');
    await expect(stat(caminhoRegistro(true))).resolves.toBeDefined();
  });

  it('não reescreve nem duplica o atalho na segunda abertura', async () => {
    await criarAtalhoDesktopLinux();
    await criarAtalhoDesktopLinux();
    expect(copyFile).toHaveBeenCalledTimes(1);
    expect(simulacoes.executar).toHaveBeenCalledTimes(1);
  });

  it('não recria um atalho removido pelo usuário', async () => {
    await criarAtalhoDesktopLinux();
    await rm(caminhoAtalho());
    await criarAtalhoDesktopLinux();
    await expect(stat(caminhoAtalho())).rejects.toMatchObject({ code: 'ENOENT' });
    expect(copyFile).toHaveBeenCalledTimes(1);
  });

  it('atualiza somente o atalho gerenciado quando o AppImage muda de caminho', async () => {
    process.env.APPIMAGE = imagem;
    await criarAtalhoDesktopLinux();
    const anterior = await readFile(caminhoRegistro(true), 'utf8');
    imagem = path.join(raiz, 'nova.AppImage');
    await writeFile(imagem, 'nova imagem');
    process.env.APPIMAGE = imagem;
    await criarAtalhoDesktopLinux();
    const conteudo = await readFile(caminhoAtalho(true), 'utf8');
    expect(conteudo).toContain('nova.AppImage"\n');
    expect(conteudo).not.toContain('0.1.22');
    expect(await readFile(caminhoRegistro(true), 'utf8')).not.toBe(anterior);
  });

  it.each([false, true])('preserva arquivo personalizado, com registro prévio: %s', async registrado => {
    if (registrado) await criarAtalhoDesktopLinux();
    await writeFile(caminhoAtalho(), '[Desktop Entry]\nName=Personalizado\n');
    await criarAtalhoDesktopLinux();
    expect(await readFile(caminhoAtalho(), 'utf8')).toBe('[Desktop Entry]\nName=Personalizado\n');
    expect(simulacoes.aviso).toHaveBeenCalledWith(expect.stringContaining('preservado'));
  });

  it('preserva links no caminho do atalho', async () => {
    const entrada = await lstat(simulacoes.caminhos.exe);
    vi.mocked(lstat).mockResolvedValueOnce(Object.assign(entrada, { isSymbolicLink: () => true }));
    await criarAtalhoDesktopLinux();
    expect(copyFile).not.toHaveBeenCalled();
    expect(simulacoes.aviso).toHaveBeenCalled();
  });

  it('ignora registro malformado sem sobrescrever o atalho', async () => {
    await criarAtalhoDesktopLinux();
    const anterior = await readFile(caminhoAtalho(), 'utf8');
    await writeFile(caminhoRegistro(), '{invalido');
    await criarAtalhoDesktopLinux();
    expect(await readFile(caminhoAtalho(), 'utf8')).toBe(anterior);
    expect(simulacoes.aviso).toHaveBeenCalled();
  });

  it.each(['{}', '{"versao":1,"hash":42}', '{"versao":2,"hash":"invalido"}'])('valida o formato do registro %s', async estado => {
    await mkdir(path.dirname(caminhoRegistro()), { recursive: true });
    await writeFile(caminhoRegistro(), estado);
    await criarAtalhoDesktopLinux();
    expect(copyFile).not.toHaveBeenCalled();
    expect(simulacoes.aviso).toHaveBeenCalled();
  });

  it('escapa aspas, dólar, crase, percentual e barra no comando, sem executar shell', async () => {
    process.env.APPIMAGE = path.join(raiz, 'espaço " $ ` % ; & \\ teste.AppImage');
    const entrada = await stat(imagem);
    vi.mocked(stat).mockResolvedValueOnce(await stat(simulacoes.caminhos.desktop)).mockResolvedValueOnce(entrada);
    await criarAtalhoDesktopLinux();
    const linha = (await readFile(caminhoAtalho(true), 'utf8')).split('\n').find(valor => valor.startsWith('Exec='));
    expect(linha).toContain('espaço ');
    expect(linha).toContain('\\\\"');
    expect(linha).toContain('\\\\$');
    expect(linha).toContain('\\\\`');
    expect(linha).toContain('%%');
    expect(linha).toContain('\\\\\\\\ teste');
    expect(simulacoes.executar).toHaveBeenCalledWith('gio', expect.any(Array), { timeout: 3000 }, expect.any(Function));
  });

  it.each(['', 'relativo.AppImage', 'ausente'])('não usa executável montado como fallback para APPIMAGE inválido: %s', async valor => {
    process.env.APPIMAGE = valor === 'ausente' ? path.join(raiz, 'ausente.AppImage') : valor;
    await criarAtalhoDesktopLinux();
    expect(copyFile).not.toHaveBeenCalled();
    expect(simulacoes.aviso).toHaveBeenCalled();
  });

  it('rejeita quebra de linha no executável sem injetar campos no atalho', async () => {
    process.env.APPIMAGE = `${imagem}\nTerminal=true`;
    const entrada = await stat(imagem);
    vi.mocked(stat).mockResolvedValueOnce(await stat(simulacoes.caminhos.desktop)).mockResolvedValueOnce(entrada);
    await criarAtalhoDesktopLinux();
    expect(copyFile).not.toHaveBeenCalled();
    expect(simulacoes.aviso).toHaveBeenCalled();
  });

  it.each(['home', 'ausente'])('não cria pasta de desktop quando configurada como %s', async destino => {
    simulacoes.caminhos.desktop = destino === 'home' ? raiz : path.join(raiz, 'ausente');
    await criarAtalhoDesktopLinux();
    expect(copyFile).not.toHaveBeenCalled();
    expect(simulacoes.aviso).toHaveBeenCalled();
  });

  it('trata falha de permissão sem rejeitar a inicialização nem registrar sucesso', async () => {
    vi.mocked(copyFile).mockRejectedValueOnce(Object.assign(new Error('Sem permissão'), { code: 'EACCES' }));
    await expect(criarAtalhoDesktopLinux()).resolves.toBeUndefined();
    expect(simulacoes.aviso).toHaveBeenCalled();
    await expect(stat(caminhoRegistro())).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['gio ausente', 'timeout'])('preserva o atalho e registra separadamente a falha de confiança: %s', async mensagem => {
    simulacoes.executar.mockImplementationOnce((_arquivo, _argumentos, _opcoes, retorno) => retorno(new Error(mensagem), '', ''));
    await expect(criarAtalhoDesktopLinux()).resolves.toBeUndefined();
    await expect(stat(caminhoAtalho())).resolves.toBeDefined();
    await expect(stat(caminhoRegistro())).resolves.toBeDefined();
    expect(simulacoes.aviso).toHaveBeenCalledWith(expect.stringContaining('Permitir iniciar'), { erro: mensagem });
    expect(simulacoes.informacao).not.toHaveBeenCalledWith('Confiança do atalho registrada pelo gio.', expect.anything());
  });

  it.each(['win32', 'darwin'])('não cria arquivos em %s', async plataforma => {
    vi.stubGlobal('process', { ...process, platform: plataforma });
    await criarAtalhoDesktopLinux();
    expect(copyFile).not.toHaveBeenCalled();
    expect(simulacoes.executar).not.toHaveBeenCalled();
  });

  it('não cria arquivos em desenvolvimento', async () => {
    simulacoes.empacotado = false;
    await criarAtalhoDesktopLinux();
    expect(copyFile).not.toHaveBeenCalled();
  });

  it('não cria arquivos para root', async () => {
    vi.stubGlobal('process', { ...process, getuid: () => 0 });
    await criarAtalhoDesktopLinux();
    expect(copyFile).not.toHaveBeenCalled();
  });

  it.each(['LAWDO_SMOKE_SCHEMA', 'LAWDO_SMOKE_JANELA', 'LAWDO_TESTE_CARGA'])('não cria arquivos no modo %s', async modo => {
    process.env[modo] = '1';
    await criarAtalhoDesktopLinux();
    expect(copyFile).not.toHaveBeenCalled();
    expect(simulacoes.executar).not.toHaveBeenCalled();
  });
});
