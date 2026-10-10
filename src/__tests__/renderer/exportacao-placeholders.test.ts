import { describe, expect, it, vi } from 'vitest'
import { buildPlaceholderMapping } from '../../renderer/lib/exportacao-placeholders'

describe('placeholders de exportação', () => {
  it('usa a data da última execução GDL somente no placeholder por extenso', () => {
    const placeholders = buildPlaceholderMapping({
      repData: {
        data_requisicao: '2026-08-23',
        campos_especificos: JSON.stringify({
          integracaoGdl: { dataExecucaoLaudo: '2026-08-25' },
        }),
      },
    })

    expect(placeholders.data_recebimento_rep).toBe('23/08/2026')
    expect(placeholders.data_extenso_recebimento_rep).toBe('25 de agosto de 2026')
  })

  it('mantém data de recebimento como fallback sem metadado GDL', () => {
    const placeholders = buildPlaceholderMapping({
      repData: { data_requisicao: '2026-08-23' },
    })

    expect(placeholders.data_extenso_recebimento_rep).toBe('23 de agosto de 2026')
  })

  it('inclui valores padrão de placeholders personalizados na resolução', () => {
    const placeholders = buildPlaceholderMapping({
      repData: {},
      placeholdersPersonalizados: [{ chave: 'nome_laboratorio', valor: 'Núcleo de Perícias' }],
    })

    expect(placeholders.nome_laboratorio).toBe('Núcleo de Perícias')
  })

  it('resolve as expressões do perito conforme o perfil da sessão', () => {
    const usuario = { id: 'perita-1', username: 'perita', nome: 'Ana', email: 'ana@example.test', cargo: 'Perito Oficial Criminal', forma_tratamento: 'feminino' }
    try {
      vi.mocked(window.sessionStorage.getItem).mockReturnValue(JSON.stringify(usuario))
      expect(buildPlaceholderMapping({ repData: {} })).toMatchObject({
        perito_nome: 'Ana',
        perito_cargo: 'Perita Oficial Criminal',
        perito_artigo: 'a',
        perito_titulo: 'Perita',
        perito_designado: 'designada',
        perito_pelo: 'pela',
        perito_qual: 'a qual',
      })
    } finally {
      vi.mocked(window.sessionStorage.getItem).mockReset()
    }
  })
})
