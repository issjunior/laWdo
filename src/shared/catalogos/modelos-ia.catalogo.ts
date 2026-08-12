export const PROVEDORES_IA = ['groq', 'gemini'] as const;

export type ProvedorIa = typeof PROVEDORES_IA[number];

export interface ModeloIaCatalogo {
  id: string;
  provedor: ProvedorIa;
  rotulo: string;
  suportaVisao: boolean;
  mimesImagem: readonly string[];
  limiteBytesImagem: number;
  janelaContextoCaracteres: number;
  reservaRespostaCaracteres: number;
}

const MARGEM_SEGURANCA_CONTEXTO = 0.2;

export const MODELOS_IA: readonly ModeloIaCatalogo[] = [
  {
    id: 'llama-3.3-70b-versatile',
    provedor: 'groq',
    rotulo: 'Llama 3.3 70B (padrão — recomendado)',
    suportaVisao: false,
    mimesImagem: [],
    limiteBytesImagem: 0,
    janelaContextoCaracteres: 96_000,
    reservaRespostaCaracteres: 16_000,
  },
  {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    provedor: 'groq',
    rotulo: 'Llama 4 Scout 17B Instruct (imagens)',
    suportaVisao: true,
    mimesImagem: ['image/jpeg', 'image/png'],
    limiteBytesImagem: 4 * 1024 * 1024,
    janelaContextoCaracteres: 96_000,
    reservaRespostaCaracteres: 16_000,
  },
  {
    id: 'gemma2-9b-it',
    provedor: 'groq',
    rotulo: 'Gemma 2 9B',
    suportaVisao: false,
    mimesImagem: [],
    limiteBytesImagem: 0,
    janelaContextoCaracteres: 32_000,
    reservaRespostaCaracteres: 8_000,
  },
  {
    id: 'mixtral-8x7b-32768',
    provedor: 'groq',
    rotulo: 'Mixtral 8x7B',
    suportaVisao: false,
    mimesImagem: [],
    limiteBytesImagem: 0,
    janelaContextoCaracteres: 24_000,
    reservaRespostaCaracteres: 6_000,
  },
  {
    id: 'gemini-2.5-flash',
    provedor: 'gemini',
    rotulo: 'Gemini 2.5 Flash (padrão — recomendado)',
    suportaVisao: true,
    mimesImagem: ['image/jpeg', 'image/png', 'image/webp'],
    limiteBytesImagem: 15 * 1024 * 1024,
    janelaContextoCaracteres: 80_000,
    reservaRespostaCaracteres: 20_000,
  },
  {
    id: 'gemini-2.5-pro',
    provedor: 'gemini',
    rotulo: 'Gemini 2.5 Pro (raciocínio avançado)',
    suportaVisao: true,
    mimesImagem: ['image/jpeg', 'image/png', 'image/webp'],
    limiteBytesImagem: 15 * 1024 * 1024,
    janelaContextoCaracteres: 160_000,
    reservaRespostaCaracteres: 20_000,
  },
  {
    id: 'gemini-2.0-flash',
    provedor: 'gemini',
    rotulo: 'Gemini 2.0 Flash',
    suportaVisao: true,
    mimesImagem: ['image/jpeg', 'image/png', 'image/webp'],
    limiteBytesImagem: 15 * 1024 * 1024,
    janelaContextoCaracteres: 96_000,
    reservaRespostaCaracteres: 16_000,
  },
];

const MODELOS_PADRAO: Record<ProvedorIa, string> = {
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.5-flash',
};

export function listarModelosIa(provedor: ProvedorIa): ModeloIaCatalogo[] {
  return MODELOS_IA.filter(modelo => modelo.provedor === provedor);
}

export function obterModeloIa(provedor: ProvedorIa, id: string | null | undefined): ModeloIaCatalogo {
  return MODELOS_IA.find(modelo => modelo.provedor === provedor && modelo.id === id)
    || MODELOS_IA.find(modelo => modelo.id === MODELOS_PADRAO[provedor])!;
}

export function obterModeloPadraoIa(provedor: ProvedorIa): ModeloIaCatalogo {
  return obterModeloIa(provedor, MODELOS_PADRAO[provedor]);
}

export function calcularOrcamentoEntradaIa(modelo: ModeloIaCatalogo): number {
  const disponivel = modelo.janelaContextoCaracteres - modelo.reservaRespostaCaracteres;
  return Math.floor(disponivel * (1 - MARGEM_SEGURANCA_CONTEXTO));
}
