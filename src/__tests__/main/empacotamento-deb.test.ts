import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Packager } from 'app-builder-lib/out/packager';
import { AppInfo } from 'app-builder-lib/out/appInfo';
import { expandMacro } from 'app-builder-lib/out/util/macroExpander';
import { getConfig } from 'app-builder-lib/out/util/config/load';
import type { Configuration } from 'app-builder-lib';

let configuracao: Configuration;
let empacotador: Packager;
let aplicativo: AppInfo;

beforeAll(async () => {
  const raiz = path.resolve(import.meta.dirname, '../../..');
  const lida = await getConfig<Configuration>({ projectDir: raiz, configFilename: 'electron-builder', packageKey: 'build', packageMetadata: null }, path.join(raiz, 'electron-builder.yml'));
  if (!lida) throw new Error('Configuração de empacotamento ausente');
  configuracao = lida.result;
  empacotador = new Packager({ projectDir: raiz, config: configuracao });
  await empacotador.validateConfig();
  aplicativo = new AppInfo(empacotador, null);
});

describe('identidade dos pacotes Debian', () => {
  it.each(['x64', 'arm64'])('inclui arquitetura %s no nome, sem empacotar a aplicação', arquitetura => {
    const padrao = configuracao.deb?.artifactName;
    expect(typeof padrao).toBe('string');
    if (typeof padrao !== 'string') throw new Error('Nome do pacote Debian não configurado');
    const nome = expandMacro(padrao, arquitetura, aplicativo, { ext: 'deb' });
    expect(nome).toBe(`laWdo-${aplicativo.version}-${arquitetura}.deb`);
    expect(nome).not.toContain('${');
  });
});
