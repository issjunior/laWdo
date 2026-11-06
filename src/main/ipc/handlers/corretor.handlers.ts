import { ipcMain } from 'electron';
import { configurarCorretor, obterEstadoCorretor, validarPalavraCorretor } from '../../services/corretor.service.js';
import type { RespostaCorretor } from '../../../shared/types/corretor.types.js';

export function registrarCorretorHandlers(): void {
  for (const acao of ['obter', 'configurar', 'adicionar', 'remover'] as const) {
    ipcMain.handle(`corretor:${acao}`, async (evento, entrada: unknown): Promise<RespostaCorretor> => {
      try {
        const sessao = evento.sender.session;
        if (acao === 'configurar') await configurarCorretor(sessao, entrada);
        if (acao === 'adicionar' || acao === 'remover') {
          const palavra = validarPalavraCorretor(entrada);
          const sucesso = acao === 'adicionar'
            ? sessao.addWordToSpellCheckerDictionary(palavra)
            : sessao.removeWordFromSpellCheckerDictionary(palavra);
          if (!sucesso) throw new Error('Não foi possível atualizar o dicionário.');
        }
        return { success: true, data: await obterEstadoCorretor(sessao) };
      } catch (erro: unknown) {
        return { success: false, error: erro instanceof Error ? erro.message : 'Erro ao acessar o corretor.' };
      }
    });
  }
}
