import { laudoPadraoB602V11 } from './b602/laudo-padrao-b602.v11.js';
import { laudoPadraoB601V2 } from './b601/laudo-padrao-b601.v2.js';
import { laudoPadraoB601LocalNecropsiaV2 } from './b601/laudo-padrao-b601-local-necropsia.v2.js';
import type { DefinicaoTemplateIntegrado } from './tipos.js';

export const catalogoTemplatesIntegrados: readonly DefinicaoTemplateIntegrado[] = [laudoPadraoB602V11, laudoPadraoB601V2, laudoPadraoB601LocalNecropsiaV2];
