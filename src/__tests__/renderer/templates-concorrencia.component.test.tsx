import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplatesPage } from '@/pages/TemplatesPage';
import { juntarComplementoB601 } from '@/components/template/b601-complemento.utils';

interface EditorSimulado { editorId: string; value?: string; onChange: (html: string) => void }
const estado = vi.hoisted(() => ({ editores: new Map<string, EditorSimulado>() }));
vi.mock('@/components/editor/TinyMceEditor', () => ({ TinyMceEditor: (propriedades: EditorSimulado) => {
  estado.editores.set(propriedades.editorId, propriedades);
  return <textarea aria-label={propriedades.editorId} value={propriedades.value || ''} onChange={evento => propriedades.onChange(evento.target.value)} />;
} }));
vi.mock('@/components/editor/PlaceholderContextMenu', () => ({ PlaceholderContextMenu: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/template/ImportTemplateDialog', () => ({ ImportTemplateDialog: () => null }));
vi.mock('@/components/template/SecaoConfiguracaoTemplate', () => ({ SecaoConfiguracaoTemplate: () => null }));
// A geração completa das tabelas é coberta em template-fotos-b601 e shared/b601-coleta.
vi.mock(import('@shared/utils/b601-descricao-agrupada'), async importar => ({
  ...await importar(),
  gerarPreviaDescricaoB601: (tipo, _coleta, fotos = new Map()) => `<div data-b601-grupo="${tipo}">${['LOCAL', 'NECRÓPSIA'].map(origem =>
    `<p>Descrição ${origem}</p><div data-b601-fotos-origem="${origem}">${fotos.get(origem) ?? '<p>Foto inicial</p>'}</div>`).join('')}</div>`,
}));

beforeEach(() => { estado.editores.clear(); });

async function abrir(conteudo: string, repeticao: string) {
  const salvar = vi.fn().mockResolvedValue({ success: false, error: 'Interceptado no teste' });
  Object.assign(window.ipcAPI, {
    template: {
      findAll: vi.fn().mockResolvedValue({ success: true, data: [{ id: 'template', nome: 'Template de regressão', tipo_exame_id: 'b601', qtd_secoes: 1, created_at: '2026-10-28' }] }),
      findSecoes: vi.fn().mockResolvedValue({ success: true, data: [
        { id: 'principal', template_id: 'template', nome: 'Exames', ordem: 1, conteudo: '<p>Exames</p>' },
        { id: 'secao', parent_id: 'principal', template_id: 'template', nome: 'Descrição', ordem: 2, conteudo, repetir_para: repeticao, repetir_titulo: 'Peça examinada' },
      ] }),
      statusIntegrados: vi.fn().mockResolvedValue({ success: true, data: [] }), salvarCompleto: salvar,
    },
    tipoExame: { findAllSemFiltroStatus: vi.fn().mockResolvedValue({ success: true, data: [{ id: 'b601', codigo: 'B-601', nome: 'Balística' }] }) },
    categoria: { findAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
    placeholder: { findAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
  });
  render(<TemplatesPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
  await screen.findByRole('button', { name: 'Atualizar Template' });
  await waitFor(() => expect(estado.editores.size).toBeGreaterThan(1));
  return salvar;
}

describe('edições simultâneas do template', () => {
  it.each([false, true])('preserva descrição e complemento com callbacks na mesma renderização, complemento primeiro: %s', async complementoPrimeiro => {
    const salvar = await abrir(juntarComplementoB601('<p>Descrição antiga</p>', '<p>Complemento antigo</p>'), 'b601_pecas:105');
    const complemento = [...estado.editores.values()].find(editor => editor.editorId.endsWith('-complemento'))!;
    const descricao = [...estado.editores.values()].find(editor => editor.editorId === 'template-secao-secao')!;
    act(() => {
      if (complementoPrimeiro) complemento.onChange('<p>Complemento novo</p>');
      descricao.onChange('<p>Descrição nova</p>');
      if (!complementoPrimeiro) complemento.onChange('<p>Complemento novo</p>');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar Template' }));
    await waitFor(() => expect(salvar).toHaveBeenCalledTimes(1));
    const entrada: unknown = salvar.mock.calls[0][0];
    expect(entrada).toEqual(expect.objectContaining({ secoes: expect.arrayContaining([expect.objectContaining({ id: 'secao', conteudo: juntarComplementoB601('<p>Descrição nova</p>', '<p>Complemento novo</p>') })]) }));
  });

  it('preserva fotos de ambas as origens e complemento com três callbacks antes da renderização', async () => {
    const salvar = await abrir(juntarComplementoB601('<div data-b601-modelo-coleta="true"></div>', '<p>Antigo</p>'), 'b601_agrupados:105');
    const editores = [...estado.editores.values()];
    const local = editores.find(editor => editor.editorId.endsWith('-fotos-0'))!;
    const necropsia = editores.find(editor => editor.editorId.endsWith('-fotos-1'))!;
    const complemento = editores.find(editor => editor.editorId.endsWith('-complemento'))!;
    expect(local).toBeDefined(); expect(necropsia).toBeDefined();
    act(() => { local.onChange('<figure><img src="local.png"><figcaption>Local</figcaption></figure>'); necropsia.onChange(''); complemento.onChange('<p>Complemento novo</p>'); });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar Template' }));
    await waitFor(() => expect(salvar).toHaveBeenCalledTimes(1));
    const entrada: unknown = salvar.mock.calls[0][0];
    expect(entrada).toEqual(expect.objectContaining({ secoes: expect.arrayContaining([expect.objectContaining({ id: 'secao', conteudo: expect.stringContaining('local.png') })]) }));
    const editorAtual = estado.editores.get(complemento.editorId)!;
    expect(editorAtual.value).toBe('<p>Complemento novo</p>');
    expect(estado.editores.get(necropsia.editorId)?.value).toBe('');
  });
});
