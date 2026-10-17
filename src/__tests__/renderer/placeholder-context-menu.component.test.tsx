import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlaceholderContextMenu } from '@/components/editor/PlaceholderContextMenu'
import { PLACEHOLDERS_COMUNS } from '@shared/catalogos/placeholders-comuns.catalogo'

describe('placeholders comuns no menu de contexto', () => {
  it('oferece todos os campos REP/Laudo mesmo sem registros locais e insere a chave selecionada', async () => {
    const inserir = vi.fn()
    render(<PlaceholderContextMenu editorId="template" categorias={[]} placeholders={[]} onInsertPlaceholder={inserir}>
      <div>Editor do template</div>
    </PlaceholderContextMenu>)
    fireEvent.contextMenu(screen.getByText('Editor do template'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'REP/Laudo' }))
    for (const campo of PLACEHOLDERS_COMUNS.filter(item => item.categoria_id === 'cat-rep')) {
      expect(await screen.findByText(`{{${campo.chave}}}`)).toBeInTheDocument()
    }
    fireEvent.click(screen.getByText('{{solicitante_nome}}'))
    expect(inserir).toHaveBeenCalledExactlyOnceWith('template', 'solicitante_nome')
  })

  it('evita duplicação, corrige o agrupamento de chaves comuns e preserva personalizados', async () => {
    render(<PlaceholderContextMenu editorId="template" categorias={[
      { id: 'cat-rep', label: 'REP/Laudo', icone: 'FileText', cor: 'blue', is_sistema: 1 },
      { id: 'cat-custom', label: 'Meus campos', icone: 'Tag', cor: 'blue' },
    ]} placeholders={[
      { id: 'legado', chave: 'solicitante_nome', descricao: 'Órgão do cadastro', categoria_id: 'categoria-antiga' },
      { id: 'custom', chave: 'meu_campo', descricao: 'Meu campo', categoria_id: 'cat-custom' },
    ]} onInsertPlaceholder={vi.fn()}><div>Editor do template</div></PlaceholderContextMenu>)
    fireEvent.contextMenu(screen.getByText('Editor do template'))
    expect(screen.getAllByRole('menuitem', { name: 'REP/Laudo' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('menuitem', { name: 'REP/Laudo' }))
    expect(await screen.findAllByText('{{solicitante_nome}}')).toHaveLength(1)
    expect(screen.getByText('Órgão do cadastro')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Meus campos' }))
    expect(await screen.findByText('{{meu_campo}}')).toBeInTheDocument()
  })
})
