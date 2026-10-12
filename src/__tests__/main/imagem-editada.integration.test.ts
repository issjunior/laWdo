import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { describe, expect, it, vi } from 'vitest';

describe('imagem editada no laudo', () => {
  it('preserva a base, registra os ajustes e permite reabrir a derivada', async () => {
    const diretorio = await fs.mkdtemp(path.join(os.tmpdir(), 'lawdo-figura-editada-'));
    let fecharBanco: (() => Promise<void>) | undefined;
    try {
      vi.mocked(app.getPath).mockReturnValue(diretorio);
      vi.resetModules();
      const banco = await import('../../main/database/index.js');
      const sqlite = await import('../../main/database/sqlite.js');
      const imagens = await import('../../main/services/imagem-laudo.service.js');
      fecharBanco = sqlite.closeDatabase;
      await banco.setupDatabase();
      await sqlite.executeNonQuery("INSERT INTO users (id, nome, email, username, senha_hash) VALUES ('perito', 'Perito', 'perito@teste.local', 'perito', 'hash')");
      await sqlite.executeNonQuery("INSERT INTO reps (id, numero, data_requisicao) VALUES ('rep', '1/2026', '2026-01-01')");
      await sqlite.executeNonQuery("INSERT INTO laudos (id, rep_id, perito_id, template_id, conteudo) VALUES ('laudo', 'rep', 'perito', 'tpl-nao-definido', '<p></p>')");
      const base = await imagens.salvarImagemLaudo('laudo', {
        id: 'original', nomeArquivo: 'original.png', dataUri: 'data:image/png;base64,AAAA', legenda: 'Foto', origem: 'local', sequencia: 1,
      });
      const derivada = await imagens.salvarImagemLaudo('laudo', {
        id: 'editada', nomeArquivo: 'editada.png', dataUri: 'data:image/png;base64,AQEB', legenda: 'Foto', origem: 'local', sequencia: 1,
        imagemOrigemId: base.id, ajustesJson: JSON.stringify({ angulo: 90 }),
      });
      expect(derivada.imagemOrigemId).toBe(base.id);
      expect((await imagens.obterImagemLaudoPorId('laudo', derivada.id)).dataUri).toBe('data:image/png;base64,AQEB');
      await expect(imagens.excluirImagemLaudo('laudo', base.id)).rejects.toThrow('base de uma figura editada');
      const [registro] = await sqlite.executeQuery<{ ajustes_json: string }>('SELECT ajustes_json FROM imagens_laudo WHERE id = ?', [derivada.id]);
      expect(JSON.parse(registro.ajustes_json)).toEqual({ angulo: 90 });
    } finally {
      await fecharBanco?.();
      await fs.rm(diretorio, { recursive: true, force: true });
    }
  });
});
