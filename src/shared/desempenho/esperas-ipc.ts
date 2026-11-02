import { CANAIS_COM_INTERACAO_USUARIO } from '../diagnostico/canais.js';
import type { EventoDesempenhoEntrada } from './contratos.js';

export function esperaIpcInformativa(entrada: Pick<EventoDesempenhoEntrada, 'origem' | 'evento'> & { canal?: string | null }): boolean {
  return entrada.origem === 'ipc' && entrada.evento !== 'falhou'
    && (['cancelado', 'indisponivel'].includes(entrada.evento) || CANAIS_COM_INTERACAO_USUARIO.some(canal => canal === entrada.canal));
}
