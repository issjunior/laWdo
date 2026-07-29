import { describe, expect, it } from 'vitest'
import { encontrarAcaoSupressaoBloco, sincronizarAcoesSupressaoBlocos } from '../../renderer/lib/blocos-periciais'
import { removerFormatacaoPlaceholders } from '../../renderer/lib/utils'

describe('controles transitórios dos blocos periciais', () => {
  const criarRaiz = () => {
    const raiz = document.createElement('div')
    raiz.innerHTML = `
      <div class="cond-bloco" data-cond-bloco="b602_arma_1_funcionamento_eficiencia_v2" data-bloco-pericial="funcionamento"></div>
      <div class="cond-bloco" data-cond-bloco="b602_arma_1_coleta_padroes_v2" data-bloco-pericial="coleta"></div>
      <div class="cond-bloco" data-cond-bloco="b602_estojos_toggle"></div>
    `
    return raiz
  }

  it('adiciona um X somente aos blocos periciais e não duplica em nova sincronização', () => {
    const raiz = criarRaiz()

    expect(sincronizarAcoesSupressaoBlocos(raiz)).toBe(2)
    expect(sincronizarAcoesSupressaoBlocos(raiz)).toBe(0)
    expect(raiz.querySelectorAll('[data-acao-suprimir-bloco="true"]')).toHaveLength(2)
    expect(raiz.querySelectorAll('[data-mce-bogus="all"]')).toHaveLength(2)
    expect(raiz.querySelector('[data-cond-bloco="b602_estojos_toggle"] [data-acao-suprimir-bloco]')).toBeNull()
  })

  it('remove o controle transitório do HTML canônico', () => {
    const raiz = criarRaiz()
    sincronizarAcoesSupressaoBlocos(raiz)

    const resultado = removerFormatacaoPlaceholders(raiz.innerHTML)

    expect(resultado).not.toContain('data-acao-suprimir-bloco')
    expect(resultado).not.toContain('data-mce-bogus')
    expect(resultado).toContain('data-bloco-pericial="funcionamento"')
  })

  it('reconhece o clique em um elemento vindo de outro documento', () => {
    const documentoEditor = document.implementation.createHTMLDocument('TinyMCE')
    const acao = documentoEditor.createElement('span')
    acao.setAttribute('data-acao-suprimir-bloco', 'true')
    documentoEditor.body.append(acao)

    expect(encontrarAcaoSupressaoBloco(acao)).toBe(acao)
  })
})
