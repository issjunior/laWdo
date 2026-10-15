import { lerDadosB601, validarDadosB601 } from '@shared/types/b601.types'
import { combinarEnvolvido, separarEnvolvido } from '@shared/utils/envolvido'
import type { ExamService } from './types'

export const b601Service: ExamService = {
  codigo: 'B-601',
  serialize(data, contexto) {
    const atual = contexto?.b601
    if (!atual) throw new Error('O contexto das peças B-601 não está disponível.')
    const envolvidos = Array.from({ length: 10 }, (_, indice) => combinarEnvolvido(
      data[`b601_envolvidos_qualificacao_${indice}`] || '', data[`b601_envolvidos_${indice}`] || '',
    )).filter(Boolean)
    const dados = validarDadosB601({
      ...atual.dados, envolvidos,
      data_ocorrencia: data.b601_data_ocorrencia || '',
      local: { bairro: data.b601_local_bairro || '', cidade: data.b601_local_cidade || '', uf: data.b601_local_uf || '' },
      numero_bo: data.b601_numero_bo || '', numero_ip: data.b601_numero_ip || '',
      solicitante_nome: data.b601_solicitante_nome || '',
    })
    return { ...atual.raiz, b601: dados }
  },
  deserialize(json) {
    const { dados } = lerDadosB601(JSON.stringify(json))
    const campos: Record<string, string> = {
      b601_data_ocorrencia: dados.data_ocorrencia, b601_local_bairro: dados.local.bairro,
      b601_local_cidade: dados.local.cidade, b601_local_uf: dados.local.uf,
      b601_numero_bo: dados.numero_bo, b601_numero_ip: dados.numero_ip, b601_solicitante_nome: dados.solicitante_nome,
    }
    dados.envolvidos.forEach((envolvido, indice) => {
      const { nome, qualificacao } = separarEnvolvido(envolvido)
      campos[`b601_envolvidos_${indice}`] = nome
      campos[`b601_envolvidos_qualificacao_${indice}`] = qualificacao
    })
    return campos
  },
}
