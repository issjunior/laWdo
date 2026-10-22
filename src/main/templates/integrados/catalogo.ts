import { laudoPadraoB602V7 } from './b602/laudo-padrao-b602.v7.js';
import { laudoPadraoB601V1 } from './b601/laudo-padrao-b601.v1.js';
import type { DefinicaoTemplateIntegrado } from './tipos.js';

export const catalogoTemplatesIntegrados: readonly DefinicaoTemplateIntegrado[] = [laudoPadraoB602V7, laudoPadraoB601V1];
