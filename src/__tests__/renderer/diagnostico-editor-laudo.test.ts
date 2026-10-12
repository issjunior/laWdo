import { afterEach, describe, expect, it, vi } from 'vitest';
import { schemaEventoEditorLaudo } from '@shared/diagnostico/contratos';
import { registrarDiagnosticoEditorLaudo, resumirComparacaoEditorLaudo } from '@/lib/diagnostico-editor-laudo';

const evento = { evento: 'voltar_solicitado', sessao: 2, montagem: 1, modo: 'single' } as const;
const apiOriginal = window.ipcAPI;

afterEach(() => {
  window.ipcAPI = apiOriginal;
});

describe('diagnóstico do editor de laudo', () => {
  it('envia somente durante uma captura de problema', () => {
    const registrar = vi.fn();
    const captura = vi.fn(() => false);
    window.ipcAPI = {
      ...apiOriginal,
      diagnosticoInterno: { ...apiOriginal.diagnosticoInterno, capturaProblemaAtiva: captura, registrarEventoEditorLaudo: registrar },
    };

    registrarDiagnosticoEditorLaudo(evento);
    expect(registrar).not.toHaveBeenCalled();

    captura.mockReturnValue(true);
    registrarDiagnosticoEditorLaudo(evento);
    expect(registrar).toHaveBeenCalledWith(evento);
  });

  it('mostra a estrutura da diferença sem incluir valores do laudo', () => {
    const referencia = '<p><span data-placeholder="{{campo}}">{{campo}}</span></p>';
    const atual = '<p><span data-placeholder="{{campo}}" style="display: none;">{{campo}}</span></p>';
    const resumo = resumirComparacaoEditorLaudo(referencia, atual);

    expect(resumo.pendente).toBe(true);
    expect(resumo.ocultosAtual).toBe(1);
    expect(resumo.diferencas).toEqual([{ posicao: '0/0', tag: 'span', categoria: 'estilo', atributo: 'style' }]);
    expect(JSON.stringify(resumo)).not.toContain('{{campo}}');
  });

  it('descreve diferenças de espaços sem registrar o texto', () => {
    const resumo = resumirComparacaoEditorLaudo('<p>A</p>\n<p>B</p>', '<p>A</p>\n\n<p>B</p>');
    expect(resumo.diferencas).toEqual([expect.objectContaining({
      posicao: '1', categoria: 'texto', tamanhoAnterior: 1, tamanhoAtual: 2,
      apenasEspacosAnterior: true, apenasEspacosAtual: true,
    })]);
    expect(JSON.stringify(resumo)).not.toContain('A</p>');
  });

  it('limita diferenças e rejeita valores ou HTML no contrato', () => {
    const referencia = '<div>' + '<p>A</p>'.repeat(20) + '</div>';
    const atual = '<div>' + '<p>B</p>'.repeat(20) + '</div>';
    const resumo = resumirComparacaoEditorLaudo(referencia, atual);
    expect(resumo.diferencas).toHaveLength(10);
    expect(schemaEventoEditorLaudo.safeParse({ ...evento, ...resumo }).success).toBe(true);
    expect(schemaEventoEditorLaudo.safeParse({ ...evento, conteudo: '<p>sigilo</p>' }).success).toBe(false);
    expect(schemaEventoEditorLaudo.safeParse({ ...evento, diferencas: [{ posicao: '0', tag: 'p', atributo: 'style', categoria: 'estilo', valor: 'sigilo' }] }).success).toBe(false);
  });

  it.each(['editor_script_carregado', 'editor_script_falhou', 'editor_setup_iniciado', 'editor_setup_concluido', 'editor_init_evento', 'editor_instancia_removida'])('aceita o marco %s sem conteúdo', marco => {
    expect(schemaEventoEditorLaudo.safeParse({ ...evento, evento: marco, tentativaInterna: 1 }).success).toBe(true);
  });
});
