import { esquemaRepsMesmoCasoGdl, type RepsMesmoCasoGdl } from '@shared/gdl/reps-mesmo-caso';

const consultas = new Map<string, Promise<RepsMesmoCasoGdl>>();

export function possuiTabelaColetaB601(html: string): boolean {
  return html.includes('b601_tabela_material_coleta') || /data-b601-coleta\s*=\s*["']true["']/.test(html);
}

export function consultarRepsColetaLaudo(laudoId: string): Promise<RepsMesmoCasoGdl> {
  const pendente = consultas.get(laudoId);
  if (pendente) return pendente;
  const consulta = (async () => {
    const resposta: unknown = await window.ipcAPI.gdl.consultarRepsMesmoCaso(laudoId);
    if (!resposta || typeof resposta !== 'object' || !('success' in resposta) || !('data' in resposta)) {
      const mensagem = resposta && typeof resposta === 'object' && 'error' in resposta && typeof resposta.error === 'string' ? resposta.error : 'Resposta inválida do GDL.';
      throw new Error(mensagem);
    }
    const resultado = esquemaRepsMesmoCasoGdl.safeParse(resposta.data);
    if (resposta.success !== true || !resultado.success) throw new Error('error' in resposta && typeof resposta.error === 'string' ? resposta.error : 'O GDL retornou referências inválidas.');
    return resultado.data;
  })();
  consultas.set(laudoId, consulta);
  void consulta.then(() => consultas.delete(laudoId), () => consultas.delete(laudoId));
  return consulta;
}

export const MENSAGEM_FALHA_CONSULTA_GDL = 'Não foi possível acessar o GDL. Verifique sua conexão e a VPN institucional e tente novamente.';
