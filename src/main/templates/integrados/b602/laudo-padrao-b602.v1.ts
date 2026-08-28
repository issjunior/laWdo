import type { DefinicaoTemplateIntegrado } from '../tipos.js';

const tituloArma = 'ARMA {{b602_arma_1_letra}} - {{b602_arma_1_tipo}} {{b602_arma_1_marca}} {{b602_arma_1_modelo}}';

export const laudoPadraoB602V1: DefinicaoTemplateIntegrado = {
  chave: 'laudo-padrao-b602',
  versao: 1,
  versaoFormato: 1,
  nome: 'Laudo Padrão B-602',
  descricao: 'Laudo de Exame de Prestabilidade e Eficiência de Vestígios Balísticos.',
  tipoExame: { codigo: 'B-602', nome: 'Eficiência e Prestabilidade' },
  secoes: [
    {
      chave: 'preambulo', nome: 'PREÂMBULO', ordem: 0,
      conteudo: '<p style="text-align: justify; text-indent: 35.43pt;">Aos <span class="placeholder-tag" contenteditable="false" data-placeholder="{{data_extenso_recebimento_rep}}">{{data_extenso_recebimento_rep}}</span>, nesta cidade de&nbsp;<span class="placeholder-tag" contenteditable="false" data-placeholder="{{perito_lotacao}}">{{perito_lotacao}}</span> e na POLÍCIA CIENTÍFICA DO PARANÁ, foi designado o <span class="placeholder-tag" contenteditable="false" data-placeholder="{{perito_cargo}}">{{perito_cargo}}</span> <span class="placeholder-tag" contenteditable="false" data-placeholder="{{perito_nome}}">{{perito_nome}}</span>, para proceder ao exame dos vestígios balísticos abaixo discriminados, recebidos nesta Seção em <span class="placeholder-tag" contenteditable="false" data-placeholder="{{data_recebimento_rep}}">{{data_recebimento_rep}}</span>, a fim de ser atendida solicitação contida no <span class="placeholder-tag" contenteditable="false" data-placeholder="{{tipo_solicitacao_rep}}">{{tipo_solicitacao_rep}}</span> nº <span class="placeholder-tag" contenteditable="false" data-placeholder="{{numero_solicitacao_rep}}">{{numero_solicitacao_rep}}</span>, datado de <span class="placeholder-tag" contenteditable="false" data-placeholder="{{data_solicitacao_rep}}">{{data_solicitacao_rep}}</span>, oriundo da <span class="placeholder-tag" contenteditable="false" data-placeholder="{{solicitante_nome}}">{{solicitante_nome}}</span>.</p>\n<p style="text-align: justify; text-indent: 35.43pt;">Em consequência, o Perito procedeu ao exame solicitado, relatando-o com verdade e com todas as circunstâncias relevantes, da forma como segue:</p>',
    },
    {
      chave: 'objetivo', nome: 'OBJETIVO', ordem: 1,
      conteudo: '<p style="text-align: justify; text-indent: 35.43pt;">A perícia tem como objetivo a efetivação do exame descritivo da totalidade do material, bem como a sua eficiência e prestabilidade, para instruir os autos da investigação policial abaixo descrita.</p>\n<p style="text-align: center;"><span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_tabela_dados_investigacao}}">{{b602_tabela_dados_investigacao}}</span></p>',
    },
    {
      chave: 'material-apresentado', nome: 'MATERIAL APRESENTADO A EXAME', ordem: 2,
      conteudo: '<p style="text-align: justify; text-indent: 35.43pt;">Foi encaminhado a esta Instituição, em embalagens plásticas transparentes lacradas, conforme ofício recebido, os seguintes materiais:</p>\n<p style="text-align: center;"><span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_tabela_material_enc}}">{{b602_tabela_material_enc}}</span></p>',
    },
    {
      chave: 'dos-exames', nome: 'DOS EXAMES', ordem: 3, repetirTitulo: tituloArma,
      conteudo: '<div class="cond-bloco" data-cond-bloco="b602_cartuchos_toggle">\n<h3 style="text-align: center;">DOS CARTUCHOS</h3>\n<p><span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_tabela_cartuchos}}">{{b602_tabela_cartuchos}}</span></p>\n</div>\n<div class="cond-bloco" data-cond-bloco="b602_estojos_toggle">\n<h3>DOS ESTOJOS</h3>\n<p><span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_tabela_estojos}}">{{b602_tabela_estojos}}</span></p>\n</div>',
    },
    {
      chave: 'das-armas', chavePai: 'dos-exames', nome: 'DAS ARMAS', ordem: 4, repetirPara: 'armas', repetirTitulo: tituloArma,
      conteudo: '<p><strong>a) Identificação da arma:</strong></p>\n<p style="text-indent: 35.43pt;">Trata-se de <span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_arma_1_tipo}}">{{b602_arma_1_tipo}}</span> marca <span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_arma_1_marca}}">{{b602_arma_1_marca}}</span>, modelo <span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_arma_1_modelo}}">{{b602_arma_1_modelo}}</span>, calibre <span class="placeholder-tag" contenteditable="false" data-placeholder="{{b602_arma_1_calibre}}">{{b602_arma_1_calibre}}</span>.</p>\n<p><strong>b) Características da arma:</strong></p>\n<p style="text-indent: 35.43pt;">Caracteristicas da arma <span class="campo-reservado" data-reservado="true">XXX</span> ...</p>\n<div class="cond-bloco" data-cond-bloco="b602_arma_N_funcionamento_eficiencia_v2" data-bloco-pericial="funcionamento" data-cond-versao="2">\n<p><strong>c) Funcionamento e Eficiência:</strong></p>\n<p style="text-align: justify; text-indent: 35.43pt;">Buscando atestar tais atributos da arma, o Perito submeteu-a ao teste de tiro, usando as munições de correspondente calibre encaminhadas para o exame. Observou-se o funcionamento normal de seus componentes. Nestas condições, verificou-se estar a arma eficiente para a realização de tiros.</p>\n</div>\n<div class="cond-bloco" data-cond-bloco="b602_arma_N_coleta_padroes_v2" data-bloco-pericial="coleta" data-cond-versao="2">\n<p><strong>d) Coleta de Padrões Balísticos:</strong></p>\n<p style="text-align: justify; text-indent: 35.43pt;">Cumpre informar que foram coletados padrões balísticos da arma em exame, com o propósito de viabilizar futuros exames complementares e/ou inclusão no <em>Banco Nacional de Perfis Balísticos</em>, conforme descrito no Relatório de Coleta de Padrão nº <span class="campo-reservado" data-reservado="true">xxx</span>/2026.</p>\n</div>',
    },
    { chave: 'conclusao', nome: 'CONCLUSÃO', ordem: 5, conteudo: '<p style="text-align: justify; text-indent: 35.43pt;">Concluídos os exames descritos neste laudo, constatou-se que arma e&nbsp;munições recebidas (intactas) encontravam-se eficientes para a realização de&nbsp;disparos.</p>' },
    { chave: 'consideracoes-finais', nome: 'CONSIDERAÇÕES FINAIS', ordem: 6, conteudo: '<p style="text-align: justify; text-indent: 35.43pt;">O material descrito neste documento, após examinado, foi devidamente&nbsp;identificado, embalado e lacrado com o lacre no L230498006 (Arma “A”) e&nbsp;no V251191025 (Estojos recebidos deflagrados), conforme requerido pelos artigos&nbsp;158-A a 158-F do Código de Processo Penal (Lei no 13.964/2019), e encaminhado&nbsp;para a Central de Custódia da Polícia Científica do Paraná.</p>' },
    { chave: 'encerramento', nome: 'ENCERRAMENTO', ordem: 7, conteudo: '<p style="text-align: justify; text-indent: 35.43pt;">Este laudo foi redigido pelo Perito que realizou o exame, o qual o&nbsp;subscreve digitalmente. São estas as declarações que, em sua consciência, tem o&nbsp;Perito a prestar. Nada mais havendo, deu-se por encerrado o exame solicitado,&nbsp;lavrando-se o presente laudo, emitido por meio do Sistema de Gestão de&nbsp;Documentos e Laudos (GDL), conforme a Instrução Normativa no 001/2020-PCP,&nbsp;para atendimento às deliberações da Autoridade requisitante.</p>' },
  ],
};
