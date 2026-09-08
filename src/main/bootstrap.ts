import { app, dialog } from 'electron';
import { access, rename } from 'node:fs/promises';
import path from 'node:path';

const diretorioTemporarioSmoke = process.env.LAWDO_SMOKE_USER_DATA;
let migracaoConcluida = true;
if (process.env.LAWDO_SMOKE_SCHEMA === '1' && diretorioTemporarioSmoke) {
  app.setPath('userData', diretorioTemporarioSmoke);
} else {
  const diretorioAppData = app.getPath('appData');
  const diretorioDados = path.join(diretorioAppData, 'laWdo');
  const diretorioLegado = path.join(diretorioAppData, 'laudo-pericial-electron');

  const existe = async (caminho: string): Promise<boolean> => {
    try {
      await access(caminho);
      return true;
    } catch {
      return false;
    }
  };

  if (!await existe(diretorioDados) && await existe(diretorioLegado)) {
    try {
      await rename(diretorioLegado, diretorioDados);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro inesperado';
      await app.whenReady();
      await dialog.showMessageBox({
        type: 'error',
        title: 'Não foi possível migrar os dados locais',
        message: 'Os dados existentes foram preservados.',
        detail: `Não foi possível mover os dados de ${diretorioLegado} para ${diretorioDados}. ${mensagem}`,
      });
      migracaoConcluida = false;
    }
  }

  if (migracaoConcluida) app.setPath('userData', diretorioDados);
}

if (migracaoConcluida) await import('./index.js');
else app.exit(1);
