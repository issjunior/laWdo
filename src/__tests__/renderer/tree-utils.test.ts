import { describe, expect, it } from 'vitest'
import {
  buildParentOptions,
  findCat,
  flattenTree,
  insertIntoTree,
  moveNodeInTree,
  removeFromTree,
  toTreeNode,
  updateNodeInTree,
  type CategoriaFull,
} from '../../renderer/lib/tree-utils'

function criarCategoria(
  id: string,
  subcategorias: CategoriaFull[] = [],
  parcial: Partial<CategoriaFull> = {},
): CategoriaFull {
  return {
    id,
    chave: id,
    label: `Categoria ${id}`,
    descricao: null,
    cor: 'blue',
    icone: 'Folder',
    parent_id: null,
    is_sistema: 0,
    ordem: 0,
    subcategorias,
    ...parcial,
  }
}

function criarArvore(): CategoriaFull[] {
  return [
    criarCategoria('a', [criarCategoria('a1', [criarCategoria('a11')])]),
    criarCategoria('b'),
  ]
}

describe('operações imutáveis em árvores de categorias', () => {
  it('localiza categorias em qualquer profundidade e retorna null quando ausentes', () => {
    const arvore = criarArvore()

    expect(findCat(arvore, 'a11')?.label).toBe('Categoria a11')
    expect(findCat(arvore, 'inexistente')).toBeNull()
  })

  it('remove um nó aninhado preservando a árvore original', () => {
    const arvore = criarArvore()

    const { node, tree } = removeFromTree(arvore, 'a1')

    expect(node?.id).toBe('a1')
    expect(findCat(tree, 'a1')).toBeNull()
    expect(findCat(arvore, 'a1')).not.toBeNull()
    expect(tree).not.toBe(arvore)
  })

  it('mantém a mesma referência quando tenta remover ou mover um nó inexistente', () => {
    const arvore = criarArvore()

    expect(removeFromTree(arvore, 'x').tree).toBe(arvore)
    expect(moveNodeInTree(arvore, 'x', 'a')).toBe(arvore)
  })

  it('insere e move nós entre níveis sem alterar a entrada', () => {
    const arvore = criarArvore()
    const nova = criarCategoria('c')
    const inserida = insertIntoTree(arvore, 'a1', nova)
    const movida = moveNodeInTree(inserida, 'b', 'a1')
    const elevada = moveNodeInTree(movida, 'a11', null)

    expect(findCat(inserida, 'a1')?.subcategorias.map(({ id }) => id)).toEqual(['a11', 'c'])
    expect(findCat(movida, 'a1')?.subcategorias.map(({ id }) => id)).toEqual(['a11', 'c', 'b'])
    expect(elevada.map(({ id }) => id)).toEqual(['a', 'a11'])
    expect(findCat(arvore, 'b')).not.toBeNull()
  })

  it('atualiza somente o nó indicado e preserva seus descendentes', () => {
    const arvore = criarArvore()

    const atualizado = updateNodeInTree(arvore[0], 'a1', { label: 'Novo nome' })

    expect(findCat([atualizado], 'a1')?.label).toBe('Novo nome')
    expect(findCat([atualizado], 'a11')).not.toBeNull()
    expect(arvore[0].subcategorias[0].label).toBe('Categoria a1')
  })

  it('achata a árvore em ordem de pré-percurso', () => {
    expect(flattenTree(criarArvore()).map(({ id }) => id)).toEqual(['a', 'a1', 'a11', 'b'])
  })

  it('exclui o próprio nó e seus descendentes das opções de pai', () => {
    const opcoes = buildParentOptions(criarArvore(), 'a1', 'Sem pai')

    expect(opcoes).toEqual([
      { value: '__none__', label: 'Sem pai' },
      { value: 'a', label: 'Categoria a' },
      { value: 'b', label: 'Categoria b' },
    ])
  })

  it('converte para o contrato visual aplicando fallbacks recursivamente', () => {
    const categoria = criarCategoria('a', [criarCategoria('a1')], { cor: '', icone: '' })

    expect(toTreeNode(categoria)).toMatchObject({
      id: 'a',
      cor: 'slate',
      icone: 'Tag',
      subcategorias: [{ id: 'a1', cor: 'blue', icone: 'Folder' }],
    })
  })
})
