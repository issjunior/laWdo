import { describe, expect, it } from 'vitest'
import {
  obterCampoPersonalizadoI801PorChaveGdl,
  obterPendenciaPecaI801,
  obterTipoPecaI801PorCodigo,
} from '../../shared/catalogos/i801.catalogo'

describe('catálogo I-801', () => {
  type PecaMinima = {
    tipoCodigo: string
    comuns: { unidadeMedida: string; dataEntrada: string }
  }

  const criarPeca = (sobrescrita: Partial<PecaMinima> = {}): PecaMinima => ({
    tipoCodigo: 'caminhonete',
    comuns: { unidadeMedida: 'UNIDADE', dataEntrada: '2026-10-21' },
    ...sobrescrita,
  })

  it('exige somente os campos obrigatórios do item I-801', () => {
    expect(obterPendenciaPecaI801(criarPeca())).toBeUndefined()
    expect(obterPendenciaPecaI801(criarPeca({ tipoCodigo: '' }))).toBe('Tipo do item obrigatório')
    expect(obterPendenciaPecaI801(criarPeca({ comuns: { unidadeMedida: '', dataEntrada: '2026-10-21' } }))).toBe('Medida obrigatória')
    expect(obterPendenciaPecaI801(criarPeca({ comuns: { unidadeMedida: 'UNIDADE', dataEntrada: '' } }))).toBe('Data de entrada obrigatória')
  })

  it('declara candidatos do GDL sem certificá-los para preenchimento automático', () => {
    const tipo = obterTipoPecaI801PorCodigo('caminhonete')
    const campo = obterCampoPersonalizadoI801PorChaveGdl(tipo, 'placa')

    expect(campo).toMatchObject({ id: 'placa', label: 'Placa', mapeamentoApiConfirmado: false })
  })
})
