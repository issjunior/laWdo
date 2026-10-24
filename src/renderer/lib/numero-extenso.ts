const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const CLASSES = [
  ['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões'],
  ['trilhão', 'trilhões'], ['quadrilhão', 'quadrilhões'],
];

function escreverGrupo(numero: number): string {
  if (numero < 10) return UNIDADES[numero];
  if (numero < 20) return DEZ_A_DEZENOVE[numero - 10];
  if (numero < 100) return DEZENAS[Math.floor(numero / 10)] + (numero % 10 ? ` e ${UNIDADES[numero % 10]}` : '');
  if (numero === 100) return 'cem';
  return CENTENAS[Math.floor(numero / 100)] + (numero % 100 ? ` e ${escreverGrupo(numero % 100)}` : '');
}

export function numeroInteiroPorExtenso(numero: number): string {
  if (!Number.isSafeInteger(numero) || numero < 0) return '';
  if (numero === 0) return 'zero';
  const grupos: Array<{ valor: number; classe: number }> = [];
  for (let classe = 0, restante = numero; restante > 0; classe++, restante = Math.floor(restante / 1000)) {
    const valor = restante % 1000;
    if (valor) grupos.unshift({ valor, classe });
  }
  return grupos.map(({ valor, classe }, indice) => {
    const nome = classe === 1 && valor === 1 ? 'mil'
      : `${escreverGrupo(valor)}${classe ? ` ${CLASSES[classe][valor === 1 ? 0 : 1]}` : ''}`;
    const separador = indice === grupos.length - 1 && (valor < 100 || valor % 100 === 0) ? ' e ' : ' ';
    return `${indice ? separador : ''}${nome}`;
  }).join('');
}
