import type { Session, WebContents } from 'electron';
import { configuracaoService } from './configuracao.service.js';
import type { EstadoCorretor } from '../../shared/types/corretor.types.js';

const CHAVE_ATIVO = 'corretor_ortografico_ativo';

export function registrarContextoCorretor(conteudo: WebContents): void {
  conteudo.on('context-menu', (_evento, parametros) => {
    conteudo.send('corretor:sugestoes', {
      palavra: conteudo.session.isSpellCheckerEnabled() && parametros.isEditable ? parametros.misspelledWord : '',
      sugestoes: parametros.dictionarySuggestions.slice(0, 5),
    });
  });
}

export async function prepararCorretor(sessao: Session): Promise<void> {
  const disponivel = process.platform === 'darwin' || sessao.availableSpellCheckerLanguages.includes('pt-BR');
  if (process.platform !== 'darwin' && disponivel) {
    sessao.setSpellCheckerLanguages(['pt-BR']);
  }
  sessao.setSpellCheckerEnabled(disponivel && await configuracaoService.obter(CHAVE_ATIVO) !== 'false');
}

export async function obterEstadoCorretor(sessao: Session): Promise<EstadoCorretor> {
  return {
    ativo: sessao.isSpellCheckerEnabled(),
    disponivel: process.platform === 'darwin' || sessao.availableSpellCheckerLanguages.includes('pt-BR'),
    palavras: (await sessao.listWordsInSpellCheckerDictionary()).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}

export async function configurarCorretor(sessao: Session, ativo: unknown): Promise<void> {
  if (typeof ativo !== 'boolean') throw new Error('Configuração inválida.');
  if (ativo && process.platform !== 'darwin' && !sessao.availableSpellCheckerLanguages.includes('pt-BR')) {
    throw new Error('O dicionário de português brasileiro não está disponível.');
  }
  await configuracaoService.salvar(CHAVE_ATIVO, String(ativo), 'texto', 'Corretor ortográfico do laudo');
  sessao.setSpellCheckerEnabled(ativo);
}

export function validarPalavraCorretor(palavra: unknown): string {
  if (typeof palavra !== 'string') throw new Error('Informe uma palavra.');
  const normalizada = palavra.trim().normalize('NFC');
  if (normalizada.length > 100 || !/^[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*$/u.test(normalizada)) {
    throw new Error('Informe uma única palavra com até 100 caracteres.');
  }
  return normalizada;
}
