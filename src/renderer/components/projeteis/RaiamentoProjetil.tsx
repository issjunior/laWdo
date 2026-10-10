interface DadosRaiamento {
  calibres: RegExp;
  raiamentoOrientacao: string;
  tipo: string;
}

const dadosPorGrupo: DadosRaiamento[] = [
  { calibres: /^(?:\.38 (?:special|spl)(?:$|[ +])|\.?357 mag(?:num)?(?:$| ))/i, raiamentoOrientacao: '06 Dextrógiro / Sinistrógiro', tipo: 'Convencional' },
  { calibres: /^(?:9\s*(?:x19\s*mm|mm luger)|\.?(?:9x19))(?:$|[ +])/i, raiamentoOrientacao: '06 Dextrógiro', tipo: 'Convencional, Poligonal ou Poligonal Aprimorado' },
  { calibres: /^\.380 (?:acp|auto)(?:$|[ +])/i, raiamentoOrientacao: '06 Dextrógiro', tipo: 'Convencional ou Poligonal' },
  { calibres: /^(?:\.40\s*s\s*&\s*w|40\s*s\s*&\s*w)(?:$|[ +])/i, raiamentoOrientacao: '06 Dextrógiro', tipo: 'Convencional ou Poligonal' },
  { calibres: /^\.45 (?:acp|auto)(?:$|[ +])/i, raiamentoOrientacao: '06 Dextrógiro', tipo: 'Convencional ou Poligonal' },
  { calibres: /^(?:\.25 auto|25 auto|6,35mm browning)(?:$|[ (])/i, raiamentoOrientacao: '06 (orientação não informada)', tipo: 'Convencional' },
  { calibres: /^(?:\.32 auto|32 auto|7,65mm browning)(?:$|[ (])/i, raiamentoOrientacao: '06 (orientação não informada)', tipo: 'Convencional' },
  { calibres: /^10\s*mm auto(?:$| )/i, raiamentoOrientacao: '06 (orientação não informada)', tipo: 'Convencional ou Poligonal' },
  { calibres: /^(?:\.223 rem(?:ington)?|5,56\s*x\s*45\s*mm|5,56mm)(?:$|[- (])/i, raiamentoOrientacao: '06 Dextrógiro', tipo: 'Convencional' },
  { calibres: /^(?:\.308 win(?:chester)?|7,62\s*x\s*51\s*mm)(?:$|[ (])/i, raiamentoOrientacao: '04 ou 06 Dextrógiro', tipo: 'Convencional' },
  { calibres: /^(?:\.22 (?:lr|curto)|22 lr)(?:$|\.)/i, raiamentoOrientacao: '06 Dextrógiro', tipo: 'Convencional' },
  { calibres: /^(?:\.44 (?:magnum|rem magmum|rem magnum|remington magnum|s&w spl|wcf)|\.44-40)(?:$| )/i, raiamentoOrientacao: '06 Dextrógiro', tipo: 'Convencional' },
];

export function RaiamentoProjetil({ calibre }: { calibre: string }) {
  const dados = dadosPorGrupo.find(grupo => grupo.calibres.test(calibre.trim()));
  if (!dados) return null;

  return <p className="text-xs text-muted-foreground">
    Raiamento e orientação (grupo de calibre): {dados.raiamentoOrientacao}. Tipo: {dados.tipo}.
  </p>;
}
