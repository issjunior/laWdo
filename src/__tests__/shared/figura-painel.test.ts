import { describe, expect, it } from 'vitest';
import { ehAcaoPainelFiguras, ehEstadoPainelFiguras, ehResultadoInsercaoFiguras } from '../../shared/figura/painel';

const figura = {
  id: 'figura-1', url: 'data:image/png;base64,AA==', thumbnailUrl: 'data:image/png;base64,AA==',
  legenda: 'Vista geral', numero_figura: 1, sequencia: 1, created_at: '2026-11-14T00:00:00.000Z',
};

describe('contrato do painel de figuras', () => {
  it('aceita o estado canônico e resultados correlacionados', () => {
    expect(ehEstadoPainelFiguras({
      sessaoId: 3, figurasNoEditor: [figura], figurasDevolvidas: [figura], imagensProtegidas: ['figura-1'],
      syncEnabled: true, figuraAtivaId: 'figura-1', figuraAtivaOcorrenciaId: 'ocorrencia-1',
      resultadoOperacao: { solicitacaoId: 'pedido-1', sucesso: true, valor: { inseridas: ['figura-1'], falhas: [] } },
    })).toBe(true);
  });

  it('rejeita estado e resultados malformados nas fronteiras IPC', () => {
    expect(ehEstadoPainelFiguras({ ...figura, figurasNoEditor: [figura] })).toBe(false);
    expect(ehEstadoPainelFiguras({ figurasNoEditor: [{ ...figura, url: 1 }], syncEnabled: true, figuraAtivaId: null })).toBe(false);
    expect(ehResultadoInsercaoFiguras({ inseridas: ['a', 'a'], falhas: [] })).toBe(false);
    expect(ehResultadoInsercaoFiguras({ inseridas: ['fora'], falhas: [] }, ['esperada'])).toBe(false);
  });

  it('valida operações e a sessão obrigatória das solicitações confirmadas', () => {
    expect(ehAcaoPainelFiguras('ready', [])).toBe(true);
    expect(ehAcaoPainelFiguras('deleteFile', ['figura-1'])).toBe(true);
    expect(ehAcaoPainelFiguras('solicitarOperacao', ['pedido', 'laudo', 2, 'deleteImage', 'figura-1', undefined, 'ocorrencia-1'])).toBe(true);
    expect(ehAcaoPainelFiguras('solicitarOperacao', ['pedido', 'laudo', -1, 'deleteImage', 'figura-1', undefined, 'ocorrencia-1'])).toBe(false);
    expect(ehAcaoPainelFiguras('replaceImage', ['figura-1', { ...figura, origem: 'local' }, 0])).toBe(false);
    expect(ehAcaoPainelFiguras('deleteImage', ['figura-1'])).toBe(false);
  });
});
