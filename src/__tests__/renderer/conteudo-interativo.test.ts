import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from 'tinymce';
import { toast } from 'sonner';
import { registrarConteudoInterativo } from '@/lib/conteudo-interativo';
import { conferirNumeracaoTabelasEditores } from '@/lib/numeracao-tabelas';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/desempenho-editor-laudo', () => ({ medirOperacaoEditorLaudo: (_nome: string, executar: () => unknown) => executar() }));

function preparar(confirmar = async () => true, laudoId?: string, somenteLeitura = false) {
  document.body.innerHTML = '<div class="cond-bloco" data-cond-bloco="teste"><div data-b601-grupo="105"><table><thead><tr><th>TABELA 1 – Exame</th></tr></thead><tbody><tr><td>Valor</td></tr></tbody></table><p>Texto</p><img src="imagem.png"></div></div>';
  const eventos = new Map<string, () => void>();
  const editor = {
    getDoc: () => document,
    getBody: () => document.body,
    getContent: () => document.body.innerHTML,
    mode: { isReadOnly: () => somenteLeitura },
    dom: { addStyle: vi.fn() },
    undoManager: { ignore: (acao: () => void) => acao(), transact: (acao: () => void) => acao() },
    on: (nomes: string, acao: () => void) => nomes.split(' ').forEach(nome => eventos.set(nome, acao)),
    dispatch: vi.fn(),
  } as unknown as Editor;
  registrarConteudoInterativo(editor, { laudoId, confirmar, aoAlterar: vi.fn(), aoRestaurar: vi.fn() });
  const bloco = document.querySelector<HTMLElement>('.cond-bloco')!;
  const clicar = (acao: string) => bloco.querySelector<HTMLButtonElement>(`:scope > [data-controles-conteudo] [data-acao-conteudo="${acao}"]`)!.click();
  return { editor, bloco, clicar, encerrar: () => eventos.get('remove')?.() };
}

afterEach(() => { document.body.innerHTML = ''; document.body.removeAttribute('data-laudo-edicao-direta'); vi.clearAllMocks(); });

describe('edição de conteúdo interativo B-601', () => {
  it('libera blocos aninhados no laudo, conserva cores e ações sem Editar/Concluir', () => {
    const { bloco, encerrar } = preparar(undefined, 'laudo-teste');
    try {
      expect(bloco).toHaveAttribute('contenteditable', 'true');
      expect(bloco.querySelector('[data-b601-grupo]')).toHaveAttribute('contenteditable', 'true');
      expect(bloco.querySelector('td')).toHaveAttribute('contenteditable', 'true');
      expect(bloco.querySelector('th')).toHaveAttribute('contenteditable', 'false');
      expect(bloco).toHaveClass('conteudo-laudo-condicional');
      expect(bloco.querySelector('[data-acao-conteudo="editar"]')).toBeNull();
      expect(bloco.querySelector('[data-acao-conteudo="excluir"]')).not.toBeDisabled();
      expect(bloco.textContent).not.toContain('Em edição');
    } finally { encerrar(); }
  });

  it('mantém os blocos e as ações bloqueados no laudo somente leitura', () => {
    const { bloco, encerrar } = preparar(undefined, 'laudo-teste', true);
    try {
      expect(bloco).toHaveAttribute('contenteditable', 'false');
      expect(bloco.querySelector('td')).toHaveAttribute('contenteditable', 'false');
      expect(bloco.querySelector('[data-acao-conteudo="excluir"]')).toBeDisabled();
      expect(bloco.querySelector('[data-acao-conteudo="editar"]')).toBeNull();
    } finally { encerrar(); }
  });

  it('preserva as travas na conferência e permite editar e concluir o bloco', () => {
    const { editor, bloco, clicar, encerrar } = preparar();
    try {
      const antes = Array.from(bloco.querySelectorAll('td, th'), celula => celula.getAttribute('contenteditable'));
      conferirNumeracaoTabelasEditores([editor], false);
      expect(Array.from(bloco.querySelectorAll('td, th'), celula => celula.getAttribute('contenteditable'))).toEqual(antes);
      clicar('editar');
      expect(bloco.getAttribute('data-cond-em-edicao')).toBe('true');
      clicar('editar');
      expect(bloco.hasAttribute('data-cond-em-edicao')).toBe(false);
      expect(toast.error).not.toHaveBeenCalled();
    } finally { encerrar(); }
  });

  it('tolera a normalização de células e classes de grupos internos antes da edição', () => {
    const { bloco, clicar, encerrar } = preparar();
    try {
      bloco.querySelector('td')!.setAttribute('contenteditable', 'true');
      bloco.querySelector('[data-b601-grupo]')!.classList.remove('conteudo-laudo');
      clicar('editar');
      expect(bloco.getAttribute('data-cond-em-edicao')).toBe('true');
      expect(toast.error).not.toHaveBeenCalled();
    } finally { encerrar(); }
  });

  it.each(['texto', 'estilo', 'imagem', 'remoção'] as const)('rejeita mudança real de %s durante a confirmação', async tipo => {
    const { bloco, clicar, encerrar } = preparar(async () => {
      if (tipo === 'texto') document.querySelector('td')!.textContent = 'Alterado';
      if (tipo === 'estilo') document.querySelector('td')!.setAttribute('style', 'color: red');
      if (tipo === 'imagem') document.querySelector('img')!.setAttribute('src', 'outra.png');
      if (tipo === 'remoção') document.querySelector('.cond-bloco')!.remove();
      return true;
    });
    try {
      clicar('excluir');
      await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
      expect(bloco.hasAttribute('data-cond-suprimido')).toBe(false);
    } finally { encerrar(); }
  });
});
