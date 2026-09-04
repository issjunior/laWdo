import { describe, expect, it } from 'vitest'
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
})
