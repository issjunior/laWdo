import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DiagnosticoSourceMapService } from '@main/services/diagnostico-source-map.service.js';

const diretorios: string[] = [];
afterEach(async () => { await Promise.all(diretorios.splice(0).map(diretorio => rm(diretorio, { recursive: true, force: true }))); });

describe('DiagnosticoSourceMapService', () => {
  it('resolve uma posição gerada para o arquivo original local', async () => {
    const diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-map-'));
    diretorios.push(diretorio);
    const gerado = path.join(diretorio, 'main', 'index.js');
    await mkdir(path.dirname(gerado), { recursive: true });
    await writeFile(gerado, 'x\n');
    await writeFile(`${gerado}.map`, JSON.stringify({ version: 3, sources: ['../src/main/index.ts'], mappings: 'AAAA' }));
    await expect(new DiagnosticoSourceMapService(diretorio).resolver(gerado, 1, 1)).resolves.toMatchObject({ disponivel: true, arquivo: path.join(diretorio, 'src', 'main', 'index.ts'), linha: 1, coluna: 1 });
  });

  it('recusa fontes fora do build e mapas inexistentes', async () => {
    const diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-map-'));
    diretorios.push(diretorio);
    const servico = new DiagnosticoSourceMapService(diretorio);
    await expect(servico.resolver(path.join(os.tmpdir(), 'externo.js'), 1, 1)).resolves.toMatchObject({ motivo: 'ORIGEM_FORA_DO_BUILD' });
  });
});
