import { CHAVE_HOMOLOGACAO_GDL_HABILITADA, resolverAmbienteGdl } from '@shared/gdl/ambiente'
import type { AmbienteGdl } from '@shared/gdl/ambiente'

export async function obterPreferenciasAmbienteGdl(): Promise<{ ambiente: AmbienteGdl; homologacaoHabilitada: boolean }> {
  try {
    const [respostaAmbiente, respostaHabilitacao] = await Promise.all([
      window.ipcAPI.configuracao.obter('gdl_ambiente'),
      window.ipcAPI.configuracao.obter(CHAVE_HOMOLOGACAO_GDL_HABILITADA),
    ])
    const homologacaoHabilitada = respostaHabilitacao.success && respostaHabilitacao.data === 'true'
    return {
      ambiente: resolverAmbienteGdl(respostaAmbiente.success ? respostaAmbiente.data : null, String(homologacaoHabilitada)),
      homologacaoHabilitada,
    }
  } catch {
    return { ambiente: 'producao', homologacaoHabilitada: false }
  }
}

export async function obterPreferenciasAmbienteGdlEstritas(): Promise<{ ambiente: AmbienteGdl; homologacaoHabilitada: boolean }> {
  const [respostaAmbiente, respostaHabilitacao] = await Promise.all([
    window.ipcAPI.configuracao.obter('gdl_ambiente'),
    window.ipcAPI.configuracao.obter(CHAVE_HOMOLOGACAO_GDL_HABILITADA),
  ])
  if (!respostaAmbiente.success || !respostaHabilitacao.success) throw new Error('Não foi possível ler as preferências de ambiente do GDL.')
  const ambiente = respostaAmbiente.data
  const habilitacao = respostaHabilitacao.data
  if (ambiente !== null && ambiente !== 'producao' && ambiente !== 'homologacao') throw new Error('A preferência de ambiente do GDL é inválida.')
  if (habilitacao !== null && habilitacao !== 'true' && habilitacao !== 'false') throw new Error('A preferência de homologação do GDL é inválida.')
  const homologacaoHabilitada = habilitacao === 'true'
  return { ambiente: resolverAmbienteGdl(ambiente, habilitacao), homologacaoHabilitada }
}
