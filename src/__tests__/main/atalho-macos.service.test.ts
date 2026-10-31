import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const simulacoes = vi.hoisted(() => ({
  caminhos: {} as Record<string, string>,
  empacotado: true,
  aviso: vi.fn(),
  informacao: vi.fn(),
  criarLink: vi.fn(async () => undefined),
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
vi.mock('node:fs/promises', async importar => {
  const original = await importar<typeof import('node:fs/promises')>();
  const simulado = { ...original, symlink: simulacoes.criarLink, lstat: vi.fn(original.lstat) };
  return { ...simulado, default: simulado };
});

import { criarAtalhoMesaMacOS } from '../../main/services/atalho-macos.service';

let raiz: string;
let aplicativo: string;

function caminhoRegistro(): string {
  return path.join(simulacoes.caminhos.userData, 'integracao-desktop', 'macos.json');
}

async function prepararAplicativo(destino: string): Promise<void> {
  aplicativo = destino;
  simulacoes.caminhos.exe = path.join(aplicativo, 'Contents', 'MacOS', 'laWdo');
  await mkdir(path.dirname(simulacoes.caminhos.exe), { recursive: true });
  await writeFile(simulacoes.caminhos.exe, 'executavel de teste');
}

beforeEach(async () => {
  vi.clearAllMocks();
  simulacoes.empacotado = true;
  raiz = await realpath(await mkdtemp(path.join(os.tmpdir(), 'lawdo-atalho-macos-')));
  simulacoes.caminhos = {
    home: raiz,
    desktop: path.join(raiz, 'Mesa'),
    userData: path.join(raiz, 'dados'),
  };
  await mkdir(simulacoes.caminhos.desktop);
  await prepararAplicativo(path.join(raiz, 'Applications', 'laWdo.app'));
  vi.stubGlobal('process', { ...process, platform: 'darwin', getuid: () => 1000, env: {} });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(raiz, { recursive: true, force: true });
});

describe('atalho na Mesa do macOS', () => {
  it('cria um link para o aplicativo instalado e registra a criação por usuário', async () => {
    await criarAtalhoMesaMacOS();
    expect(symlink).toHaveBeenCalledWith(aplicativo, path.join(simulacoes.caminhos.desktop, 'laWdo.app'), 'dir');
    expect(await readFile(caminhoRegistro(), 'utf8')).toBe('{"versao":1,"criado":true}');
    expect(simulacoes.informacao).toHaveBeenCalledWith('Atalho do laWdo criado na Mesa.', expect.any(Object));
  });

  it('preserva espaços e caracteres especiais no caminho sem usar shell', async () => {
    await prepararAplicativo(path.join(raiz, 'Applications', 'Pasta com espaços $ &', 'laWdo.app'));
    await criarAtalhoMesaMacOS();
    expect(symlink).toHaveBeenCalledWith(aplicativo, path.join(simulacoes.caminhos.desktop, 'laWdo.app'), 'dir');
  });

  it('não recria o atalho na segunda abertura nem após remoção voluntária', async () => {
    await criarAtalhoMesaMacOS();
    // O link está simulado e continua ausente; o registro impede sua recriação.
    await criarAtalhoMesaMacOS();
    expect(symlink).toHaveBeenCalledTimes(1);
  });

  it.each(['arquivo', 'diretorio'])('preserva um %s existente na Mesa', async tipo => {
    const destino = path.join(simulacoes.caminhos.desktop, 'laWdo.app');
    if (tipo === 'arquivo') await writeFile(destino, 'personalizado');
    else await mkdir(destino);
    await criarAtalhoMesaMacOS();
    expect(symlink).not.toHaveBeenCalled();
    expect(simulacoes.aviso).toHaveBeenCalledWith('Atalho existente na Mesa preservado.', { atalho: destino });
    if (tipo === 'arquivo') expect(await readFile(destino, 'utf8')).toBe('personalizado');
  });

  it('preserva inclusive um link existente sem destino válido', async () => {
    const entrada = await lstat(simulacoes.caminhos.exe);
    vi.mocked(lstat).mockResolvedValueOnce(Object.assign(entrada, { isSymbolicLink: () => true }));
    await criarAtalhoMesaMacOS();
    expect(symlink).not.toHaveBeenCalled();
  });

  it.each(['Volumes/laWdo', 'Downloads', 'Applications-legado'])('não cria link para aplicação executada de %s', async pasta => {
    await prepararAplicativo(path.join(raiz, pasta, 'laWdo.app'));
    await criarAtalhoMesaMacOS();
    expect(symlink).not.toHaveBeenCalled();
    expect(simulacoes.informacao).not.toHaveBeenCalled();
  });

  it('aguarda a instalação em Aplicativos após uma abertura pelo DMG', async () => {
    await prepararAplicativo(path.join(raiz, 'Volumes', 'laWdo', 'laWdo.app'));
    await criarAtalhoMesaMacOS();
    await prepararAplicativo(path.join(raiz, 'Applications', 'laWdo.app'));
    await criarAtalhoMesaMacOS();
    expect(symlink).toHaveBeenCalledTimes(1);
    expect(symlink).toHaveBeenCalledWith(aplicativo, expect.any(String), 'dir');
  });

  it.each(['home', 'ausente'])('não cria pasta de Mesa quando configurada como %s', async destino => {
    simulacoes.caminhos.desktop = destino === 'home' ? raiz : path.join(raiz, 'ausente');
    await criarAtalhoMesaMacOS();
    expect(symlink).not.toHaveBeenCalled();
    expect(simulacoes.aviso).toHaveBeenCalled();
  });

  it('não interrompe a abertura quando o macOS nega acesso à Mesa', async () => {
    simulacoes.criarLink.mockRejectedValueOnce(Object.assign(new Error('Acesso negado'), { code: 'EPERM' }));
    await expect(criarAtalhoMesaMacOS()).resolves.toBeUndefined();
    expect(simulacoes.aviso).toHaveBeenCalledWith('Não foi possível preparar o atalho do macOS.', { erro: 'Acesso negado' });
    expect(simulacoes.informacao).not.toHaveBeenCalled();
    await expect(readFile(caminhoRegistro())).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['{invalido', '{}', '{"versao":2,"criado":true}', '{"versao":1,"criado":"sim"}'])('ignora registro inválido: %s', async estado => {
    await mkdir(path.dirname(caminhoRegistro()), { recursive: true });
    await writeFile(caminhoRegistro(), estado);
    await criarAtalhoMesaMacOS();
    expect(symlink).not.toHaveBeenCalled();
    expect(simulacoes.aviso).toHaveBeenCalled();
  });

  it('não cria atalho quando o executável não está dentro de um bundle .app', async () => {
    await prepararAplicativo(path.join(raiz, 'Applications', 'outra-pasta'));
    await criarAtalhoMesaMacOS();
    expect(symlink).not.toHaveBeenCalled();
  });

  it.each(['linux', 'win32'])('não atua em %s', async plataforma => {
    vi.stubGlobal('process', { ...process, platform: plataforma });
    await criarAtalhoMesaMacOS();
    expect(symlink).not.toHaveBeenCalled();
  });

  it('não atua em desenvolvimento', async () => {
    simulacoes.empacotado = false;
    await criarAtalhoMesaMacOS();
    expect(symlink).not.toHaveBeenCalled();
  });

  it('não atua como root', async () => {
    vi.stubGlobal('process', { ...process, getuid: () => 0 });
    await criarAtalhoMesaMacOS();
    expect(symlink).not.toHaveBeenCalled();
  });

  it.each(['LAWDO_SMOKE_SCHEMA', 'LAWDO_SMOKE_JANELA', 'LAWDO_TESTE_CARGA'])('não atua no modo %s', async modo => {
    process.env[modo] = '1';
    await criarAtalhoMesaMacOS();
    expect(symlink).not.toHaveBeenCalled();
  });
});
