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
