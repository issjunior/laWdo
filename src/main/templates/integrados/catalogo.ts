import { laudoPadraoB602V10 } from './b602/laudo-padrao-b602.v10.js';
import { laudoPadraoB601V2 } from './b601/laudo-padrao-b601.v2.js';
import { laudoPadraoB601LocalNecropsiaV1 } from './b601/laudo-padrao-b601-local-necropsia.v1.js';
import type { DefinicaoTemplateIntegrado } from './tipos.js';

export const catalogoTemplatesIntegrados: readonly DefinicaoTemplateIntegrado[] = [laudoPadraoB602V10, laudoPadraoB601V2, laudoPadraoB601LocalNecropsiaV1];
