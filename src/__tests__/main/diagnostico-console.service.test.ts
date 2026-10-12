import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepararAvisoConsoleDiagnostico } from '@main/services/diagnostico-console.service.js';
import { DiagnosticoEventosService } from '@main/services/diagnostico-eventos.service.js';
import { schemaEventoDiagnostico } from '@shared/diagnostico/contratos.js';

const avisoBase = {
  origem: 'file:///aplicativo/renderer.js',
  linha: 12,
  principal: true,
  agregada: false,
};

describe('avisos de console do diagnóstico', () => {
  it('classifica um padrão conhecido sem copiar valores variáveis da mensagem', async () => {
    const dados = await prepararAvisoConsoleDiagnostico({
      ...avisoBase,
      mensagem: 'Falha ao atualizar placeholder visualmente. CPF 123.456.789-00 e token segredo',
    }, { resolver: async () => ({ disponivel: true, arquivo: 'src/renderer/lib/placeholders.ts', linha: 42, coluna: 1 }) });

    expect(dados).toMatchObject({
      classificacaoTecnica: 'FALHA_VISUAL_PLACEHOLDER',
      conteudoOmitido: true,
      origem: avisoBase.origem,
      linha: avisoBase.linha,
      principal: true,
      localizacaoOriginal: { disponivel: true, arquivo: 'src/renderer/lib/placeholders.ts', linha: 42, coluna: 1 },
    });
    expect(dados.assinatura).toMatch(/^[a-f0-9]{16}$/);
    expect(JSON.stringify(dados)).not.toContain('123.456.789-00');
    expect(JSON.stringify(dados)).not.toContain('segredo');
  });

  it('mantém a assinatura de avisos desconhecidos e indica a omissão', async () => {
    const aviso = { ...avisoBase, mensagem: 'Aviso sem padrão: dado sigiloso' };
    const primeiro = await prepararAvisoConsoleDiagnostico(aviso, null);
    const segundo = await prepararAvisoConsoleDiagnostico(aviso, null);

    expect(primeiro).toMatchObject({
      classificacaoTecnica: 'NAO_CLASSIFICADO',
      conteudoOmitido: true,
      localizacaoOriginal: { disponivel: false, motivo: 'MAPA_AUSENTE' },
    });
    expect(primeiro.assinatura).toBe(segundo.assinatura);
    expect(primeiro.descricaoTecnica).toContain('Conteúdo omitido');
    expect(JSON.stringify(primeiro)).not.toContain('dado sigiloso');
  });

  it('persiste o aviso mesmo se a resolução do source map falhar', async () => {
    const diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-console-'));
    try {
      const caminhoEventos = path.join(diretorio, 'eventos.ndjson');
      const servico = new DiagnosticoEventosService(caminhoEventos);
      const dados = await prepararAvisoConsoleDiagnostico(
        { ...avisoBase, mensagem: 'ResizeObserver loop limit exceeded' },
        { resolver: async () => { throw new Error('caminho privado'); } },
      );

      await servico.registrar({ origem: 'main', categoria: 'console', nivel: 'warn', dados });
      const persistido = schemaEventoDiagnostico.parse(JSON.parse(await readFile(caminhoEventos, 'utf8')));

      expect(persistido.dados).toMatchObject({
        classificacaoTecnica: 'CICLO_OBSERVADOR_LAYOUT',
        localizacaoOriginal: { disponivel: false, motivo: 'FALHA_RESOLUCAO' },
      });
      expect(JSON.stringify(persistido)).not.toContain('caminho privado');
    } finally {
      await rm(diretorio, { recursive: true, force: true });
    }
  });
});
