import { configuracaoService } from './configuracao.service.js';
import { CHAVE_LISTAGEM_REPS_GDL_HABILITADA } from '../../shared/gdl/listagem.js';

let versaoPreferencia = 0;

export async function obterListagemRepsGdlHabilitada(): Promise<boolean> {
  return await configuracaoService.obter(CHAVE_LISTAGEM_REPS_GDL_HABILITADA) === 'true';
}

export async function definirListagemRepsGdlHabilitada(habilitada: boolean): Promise<void> {
  await configuracaoService.salvar(CHAVE_LISTAGEM_REPS_GDL_HABILITADA, String(habilitada), 'texto', 'Listagem de REPs do GDL');
  versaoPreferencia += 1;
}

export function obterVersaoPreferenciaListagem(): number {
  return versaoPreferencia;
}

export async function exigirListagemRepsGdlHabilitada(versao?: number): Promise<void> {
  if ((versao !== undefined && versao !== versaoPreferencia) || !await obterListagemRepsGdlHabilitada()) {
    throw new Error('A listagem de REPs do GDL está desativada.');
  }
}
