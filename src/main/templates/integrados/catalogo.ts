import { laudoPadraoB602V12 } from './b602/laudo-padrao-b602.v12.js';
import { laudoPadraoB601V3 } from './b601/laudo-padrao-b601.v3.js';
import { laudoPadraoB601LocalNecropsiaV5 } from './b601/laudo-padrao-b601-local-necropsia.v5.js';
import { laudoPadraoI801V1 } from './i801/laudo-padrao-i801.v1.js';
import type { DefinicaoTemplateIntegrado } from './tipos.js';

export const catalogoTemplatesIntegrados: readonly DefinicaoTemplateIntegrado[] = [laudoPadraoB602V12, laudoPadraoB601V3, laudoPadraoB601LocalNecropsiaV5, laudoPadraoI801V1];
