import { describe, expect, it } from 'vitest'
import { criarChaveMemoriaConsultaIa, localizarEvidenciasConsultaIa, serializarBlocosContextoIa } from '../../renderer/lib/ia-consulta-contexto'
import { numeracaoService } from '../../renderer/components/rep/exam-fields/services/numeracao.service'
import type { REPFormData } from '../../renderer/components/rep/exam-fields/types'

function criarFormulario(campos: Partial<REPFormData>): REPFormData {
  return new Proxy(campos, {
    get(alvo, propriedade: string) {
      return alvo[propriedade] ?? ''
    },
  }) as REPFormData
}

describe('contexto de consulta de IA e numeração', () => {
  it('serializa apenas conteúdo relevante preservando títulos, âncoras e ordem', () => {
    const blocos = serializarBlocosContextoIa(
      '<style>ignorar</style><h2 id="arma-a">Arma A</h2><p> Texto   útil </p><table><tr><td>não duplicar</td></tr></table><script>ignorar</script><p data-mce-bogus="1">rascunho</p>',
      'secao-1', 'Introdução', 4,
    )
    expect(criarChaveMemoriaConsultaIa('secao', 2, 'abc')).toBe('secao:2:abc')
    expect(blocos).toEqual([
      expect.objectContaining({ id: 'secao-1:5', tipo: 'titulo', titulo: 'Arma A', ancora: 'arma-a', ordem: 4 }),
      expect.objectContaining({ id: 'secao-1:6', tipo: 'paragrafo', titulo: 'Arma A', texto: 'Texto útil', ordem: 5 }),
      expect.objectContaining({ id: 'secao-1:7', tipo: 'tabela', texto: 'não duplicar', ordem: 6 }),
    ])
  })

  it('só localiza evidências existentes e sem repetição', () => {
    const blocos = serializarBlocosContextoIa('<p>Primeiro</p><p>Segundo</p>', 's', 'Seção')
    expect(localizarEvidenciasConsultaIa(blocos, [blocos[1].id, blocos[0].id])).toEqual([blocos[1], blocos[0]])
    expect(localizarEvidenciasConsultaIa(blocos, [blocos[0].id, blocos[0].id])).toBeNull()
    expect(localizarEvidenciasConsultaIa(blocos, ['ausente'])).toBeNull()
  })

  it('preserva defaults de numeração, trata placa sem identificação e limita a máscara de fabricação', () => {
    expect(numeracaoService.deserialize({ numeracao: { placa: 'sem identificação', conservacao: '' } })).toMatchObject({ numeracao_placa: '', numeracao_conservacao: 'regular' })
    expect(numeracaoService.serialize(criarFormulario({ numeracao_veiculo: 'Carro', numeracao_placa: 'ABC1234' }))).toMatchObject({ numeracao: { veiculo: 'Carro', placa: 'ABC1234', conservacao: 'regular' } })
    expect(numeracaoService.fieldMasks?.numeracao_fabricacao?.('20a25123456')).toBe('2025/1234')
  })
})
