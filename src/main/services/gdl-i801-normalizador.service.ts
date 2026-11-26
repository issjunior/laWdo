import { randomUUID } from 'node:crypto'
import { obterCampoPersonalizadoI801PorChaveGdl, obterTipoPecaI801PorLabel } from '../../shared/catalogos/i801.catalogo.js'
import { converterValorPersonalizadoI801 } from '../../shared/gdl/i801-campos-adicionais.js'
import type { PecaI801 } from '../../shared/types/i801.types.js'
import type { MetadadosIntegracaoGdl } from '../../shared/types/b602-gdl.types.js'
import type { ResultadoImportacaoI801 } from '../../shared/types/gdl-importacao.types.js'
import type { GdlRepValidada } from './gdl.schema.js'
import { criarCamposComuns, montarImportacaoBalistica, normalizarNomeCampo } from './gdl-balistica-normalizador.service.js'

export function converterRepI801(rep: GdlRepValidada, metadados?: MetadadosIntegracaoGdl): ResultadoImportacaoI801 {
  let recebeuCampoCondicional = false
  const pecas: PecaI801[] = rep.pecas.map(entrada => {
    const tipo = obterTipoPecaI801PorLabel(entrada.tipoPeca)
    const numeroAnalises = Number(entrada.numeroAnalises)
    const comuns = { ...criarCamposComuns(entrada), numeroAnalises: Number.isSafeInteger(numeroAnalises) && numeroAnalises > 0 ? numeroAnalises : 1 }
    const personalizados: PecaI801['personalizados'] = {}
    const extrasGdl: Record<string, unknown> = {}
    for (const [chave, valor] of Object.entries(entrada)) {
      const campo = normalizarNomeCampo(chave)
      if (['codpeca', 'tipopeca', 'identificacao', 'quantidade', 'unidademedida', 'numeroanalises', 'examinadoinloco', 'dataentrada', 'lacreentrada', 'lacresaida', 'consumida', 'quantidadedescricao', 'dataliberacao', 'codigovestigio', 'observacao'].includes(campo)) continue
      const campoPersonalizado = obterCampoPersonalizadoI801PorChaveGdl(tipo, chave)
      const convertido = campoPersonalizado?.mapeamentoApiConfirmado
        ? converterValorPersonalizadoI801(campoPersonalizado, valor)
        : undefined
      if (campoPersonalizado?.mapeamentoApiConfirmado && convertido !== undefined) {
        personalizados[campoPersonalizado.id] = convertido
        continue
      }
      extrasGdl[chave] = valor
      if (campoPersonalizado) recebeuCampoCondicional = true
    }
    return { idLocal: randomUUID(), origem: 'gdl', alteradaLocalmente: false, codPecaGdl: entrada.codPeca,
      tipoCodigo: tipo?.codigo ?? '', tipoPeca: entrada.tipoPeca, comuns, personalizados, extrasGdl }
  })
  return montarImportacaoBalistica(rep, 'I-801', pecas, metadados, [
    ...pecas.filter(peca => !peca.tipoCodigo).map(peca => ({
      codigo: 'TIPO_PECA_NAO_CONFIRMADO',
      mensagem: `O tipo ${peca.tipoPeca} não pertence ao catálogo I-801; revise-o antes de salvar.`,
    })),
    ...(recebeuCampoCondicional ? [{
      codigo: 'CAMPOS_I801_PARA_REVISAO',
      mensagem: 'Campos condicionais recebidos do GDL foram preservados para revisão, pois seu contrato ainda não foi confirmado.',
    }] : []),
  ])
}
