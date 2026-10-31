import { defineConfig } from 'vitest/config';
import configuracao from './vitest.config.ts';

export default defineConfig({
  ...configuracao,
  test: {
    ...configuracao.test,
    include: [
      'src/__tests__/shared/b601-coleta.test.ts',
      'src/__tests__/main/{imagem-laudo-previa.integration,conclusao-imagens-laudo.integration,status-rep-laudo.integration,config-backup-regressao.integration,ia-execucao.service,atalho-linux.service,atalho-macos.service,empacotamento-deb}.test.ts',
      'src/__tests__/main/{laudo-bkp-arquivo.service,laudo-bkp.handlers,laudo-bkp.integration,laudo-estrutura.migration}.test.ts',
      'src/__tests__/renderer/{conteudo-interativo,conteudo-protegido,preparacao-conteudo-editor,template-fotos-b601,b601-coleta,conteudo-comparavel-laudo,tabelas-apresentacao,apresentacao-placeholders,exportacao-placeholders,exportacao-placeholders-b602,imagens-impressao-laudo}.test.ts',
      'src/__tests__/renderer/{inicializacao-saida-laudo,tiny-mce-editor-inicializacao,modelos-ia-configuracao,templates-concorrencia,laudos-exclusao}.component.test.tsx',
      'src/__tests__/renderer/{contexto-campo-laudo,b601-campos-projetil,campos-reservados,sincronizacao-editor-laudo}.test.ts',
      'src/__tests__/renderer/{importar-bkp-laudo,projeteis-laudo}.component.test.tsx',
    ],
  },
});
