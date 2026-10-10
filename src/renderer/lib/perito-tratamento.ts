export type FormaTratamentoLaudo = 'masculino' | 'feminino';

export function obterFormasPerito(cargo: string | null | undefined, forma: FormaTratamentoLaudo = 'masculino') {
  const feminino = forma === 'feminino';
  const cargoBase = cargo?.trim() || 'Perito Criminal';
  const cargoTratado = feminino
    ? cargoBase.replace(/^Perito\b/, 'Perita').replace(/^Técnico\b/, 'Técnica')
    : cargoBase.replace(/^Perita\b/, 'Perito').replace(/^Técnica\b/, 'Técnico');
  const cargoTecnico = /^Técnic[oa]\b/.test(cargoTratado);

  return {
    perito_cargo: cargoTratado,
    perito_artigo: feminino ? 'a' : 'o',
    perito_titulo: cargoTecnico ? (feminino ? 'Técnica' : 'Técnico') : (feminino ? 'Perita' : 'Perito'),
    perito_designado: feminino ? 'designada' : 'designado',
    perito_pelo: feminino ? 'pela' : 'pelo',
    perito_qual: feminino ? 'a qual' : 'o qual',
  };
}
