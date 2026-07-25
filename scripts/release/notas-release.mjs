const rotulosPlataforma = {
  windows: 'Windows',
  linux: 'Linux',
  macos: 'macOS',
};

function escaparCelula(valor) {
  return String(valor).replaceAll('|', '\\|');
}

export function gerarNotasRelease(manifesto, alteracoes) {
  const resumo = alteracoes.trim();
  if (!resumo) throw new Error('As alterações da release não podem ficar vazias.');

  const linhasInstaladores = manifesto.artefatos.map(artefato => (
    `| ${rotulosPlataforma[artefato.plataforma] ?? artefato.plataforma} `
    + `| ${escaparCelula(artefato.arquitetura)} `
    + `| ${escaparCelula(artefato.formato)} `
    + `| [${escaparCelula(artefato.nome)}](${artefato.url}) |`
  ));

  return [
    '## Alterações',
    '',
    resumo,
    '',
    '## Correções',
    '',
    '- Nenhuma correção adicional informada.',
    '',
    '**Instaladores**',
    '',
    '| Plataforma | Arquitetura | Formato | Download |',
    '| --- | --- | --- | --- |',
    ...linhasInstaladores,
    '',
  ].join('\n');
}
