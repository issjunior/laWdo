interface MarcadorBlocoPericial {
  legado: string;
  versionado: string;
  tipo: 'funcionamento' | 'coleta';
}

const MARCADORES_BLOCOS_PERICIAIS: MarcadorBlocoPericial[] = [
  {
    legado: 'b602_arma_N_func_toggle',
    versionado: 'b602_arma_N_funcionamento_eficiencia_v2',
    tipo: 'funcionamento',
  },
  {
    legado: 'b602_arma_N_coleta_toggle',
    versionado: 'b602_arma_N_coleta_padroes_v2',
    tipo: 'coleta',
  },
];

function atualizarWrapper(
  conteudo: string,
  marcador: MarcadorBlocoPericial,
): string {
  const regex = new RegExp(
    `<div\\b([^>]*\\bdata-cond-bloco="${marcador.legado}"[^>]*)>`,
    'gi',
  );

  return conteudo.replace(regex, (_match, atributos: string) => {
    let atualizados = atributos.replace(
      /\bdata-cond-bloco="[^"]*"/i,
      `data-cond-bloco="${marcador.versionado}"`,
    );

    if (!/\bdata-bloco-pericial=/i.test(atualizados)) {
      atualizados += ` data-bloco-pericial="${marcador.tipo}"`;
    }
    if (!/\bdata-cond-versao=/i.test(atualizados)) {
      atualizados += ' data-cond-versao="2"';
    }

    return `<div${atualizados}>`;
  });
}

/** Atualiza somente os marcadores legados do template padrão B-602. */
export function atualizarMarcadoresTemplateB602(conteudo: string): string {
  return MARCADORES_BLOCOS_PERICIAIS.reduce(
    (resultado, marcador) => atualizarWrapper(resultado, marcador),
    conteudo,
  );
}
