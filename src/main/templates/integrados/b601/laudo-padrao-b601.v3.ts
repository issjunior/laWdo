import { padronizarFigurasTemplate } from '../padronizar-figuras.js';
import { laudoPadraoB601V2 } from './laudo-padrao-b601.v2.js';

export const laudoPadraoB601V3 = padronizarFigurasTemplate(laudoPadraoB601V2, 3);
