import { describe, expect, it } from 'vitest'

import { obterOpcoesAlturaEditor, obterPluginsTinyMce } from '@/components/editor/TinyMceEditor'

describe('obterOpcoesAlturaEditor', () => {
  it('deixa o documento crescer sem limite vertical quando a altura automática está ativa', () => {
    expect(obterOpcoesAlturaEditor(560, true)).toEqual({
      min_height: 560,
      autoresize_bottom_margin: 24,
      resize: false,
    })
  })

  it('preserva a altura fixa para os usos que não são documento fluido', () => {
    expect(obterOpcoesAlturaEditor(400, false)).toEqual({
      height: 400,
      resize: true,
    })
  })

  it('habilita o plugin de crescimento somente no documento fluido', () => {
    expect(obterPluginsTinyMce(true)).toContain('autoresize')
    expect(obterPluginsTinyMce(false)).not.toContain('autoresize')
  })
})
