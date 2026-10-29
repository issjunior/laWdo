import { describe, expect, it } from 'vitest';
import {
  atualizarFotosColetaTemplateB601,
  juntarComplementoB601,
  obterBlocosColetaTemplateB601,
  separarComplementoB601,
} from '@/components/template/b601-complemento.utils';

describe('edição das fotografias do template B-601', () => {
  const modelo = '<div data-b601-modelo-coleta="true"></div>';

  it.each(['b601_agrupados:105', 'b601_agrupados:101'])('estabiliza o conteúdo após a sincronização dos editores em %s', repeticao => {
    let conteudo = modelo;
    const blocosIniciais = obterBlocosColetaTemplateB601(conteudo, repeticao);
    for (const bloco of blocosIniciais) {
      conteudo = atualizarFotosColetaTemplateB601(conteudo, bloco.origem, bloco.fotos);
    }
    const estabilizado = conteudo;

    for (let rodada = 0; rodada < 5; rodada++) {
      const blocos = obterBlocosColetaTemplateB601(conteudo, repeticao);
      expect(blocos.map(bloco => bloco.fotos)).toEqual(blocosIniciais.map(bloco => bloco.fotos));
      for (const bloco of blocos) {
        conteudo = atualizarFotosColetaTemplateB601(conteudo, bloco.origem, bloco.fotos);
      }
      expect(conteudo).toBe(estabilizado);
    }
  });

  it('preserva os quadros por origem e o complemento ao editar e reabrir', () => {
    let conteudo = juntarComplementoB601(modelo, '<p>Observações finais</p>');
    conteudo = atualizarFotosColetaTemplateB601(conteudo, 'LOCAL', '<p>Fotografias do local</p>');
    conteudo = atualizarFotosColetaTemplateB601(conteudo, 'NECRÓPSIA', '<p>Fotografias da necrópsia</p>');

    const blocos = obterBlocosColetaTemplateB601(conteudo, 'b601_agrupados:105');
    expect(blocos.map(bloco => ({ origem: bloco.origem, fotos: bloco.fotos }))).toEqual([
      { origem: 'LOCAL', fotos: '<p>Fotografias do local</p>' },
      { origem: 'NECRÓPSIA', fotos: '<p>Fotografias da necrópsia</p>' },
    ]);
    expect(separarComplementoB601(conteudo).complemento).toBe('<p>Observações finais</p>');
  });

  it('preserva um quadro esvaziado sem restaurar fotografias padrão', () => {
    const conteudo = atualizarFotosColetaTemplateB601(modelo, 'LOCAL', '');
    expect(obterBlocosColetaTemplateB601(conteudo, 'b601_agrupados:105')[0].fotos).toBe('');
  });
});
