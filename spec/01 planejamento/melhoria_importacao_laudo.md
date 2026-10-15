# Planejamento — melhoria da importação de templates de laudo

**Registro:** 13/10/2026.

**Status:** componentes 1–6 e simplificação da revisão implementados em 13/10/2026. TypeScript, lint, build e 783 testes existentes passaram. Homologação visual da revisão simplificada e reimportação do ODT original ainda pendentes; não considerar o aceite concluído.

**Finalidade:** permitir a implementação em outra sessão sem repetir decisões já confirmadas. Este arquivo é um plano, não documentação de funcionalidade existente. O nome do arquivo menciona laudo, mas o destino escolhido é um **template reutilizável**, não um laudo preenchido vinculado a uma REP.

## 1. Objetivo e decisões confirmadas

Melhorar a importação existente de PDF/DOCX e adicionar **leitura nativa de ODT**, mantendo o processamento local e produzindo conteúdo editável no padrão do laWdo.

| Tema | Decisão confirmada |
|---|---|
| Destino | Criar template personalizado: importar, editar e salvar diretamente. Não criar fluxo de importação de laudo preenchido. |
| Formatos | PDF, DOCX e ODT. Manter separado o fluxo de pacote ZIP de template. DOC, RTF e HTML não entram nesta entrega. |
| ODT | Ler diretamente no laWdo, sem depender de LibreOffice instalado ou embarcado. |
| Prioridade | Preservar conteúdo e estrutura útil, adaptando a apresentação ao laWdo. Não reproduzir exatamente a paginação ou aparência original. |
| Tabelas | Preservar texto original, cabeçalhos, rótulos, linhas, colunas e mesclagens. Limpeza manual no editor, sem classificação de células ou substituição automática por XXX. |
| Avisos | Detalhes recolhidos, agrupados por código e categoria (adaptação ou limitação), com contagem e localização. Sem confirmações ou bloqueio do salvamento. |
| Imagens | Todas as imagens do corpo tornam-se dummies, incluindo fotos, desenhos e gráficos. Não tentar distinguir automaticamente o tipo de imagem. |
| Legendas | Substituir legendas originais por legenda genérica Figura XX: XXX. |
| Cabeçalhos/rodapés | Adotar os padrões do laWdo. Descartar os elementos originais quando identificáveis, incluindo logotipos e paginação. Avisar sobre casos incertos. |
| Texto preenchido | Preservar parágrafos e tabelas. Usuário troca dados específicos por placeholders ou XXX manualmente. Sem inferência automática ou IA. |
| Seções | Detectar títulos e oferecer edição, divisão, união, exclusão e reordenação, preservando o conteúdo. |
| PDFs escaneados | Avisar e orientar OCR externo. Não implementar OCR nesta entrega. |
| PDF com estrutura incerta | Preservar conteúdo recuperável e apresentar limitações nos detalhes opcionais. Usuário pode corrigir, reconstruir ou descartar trechos, sem confirmação obrigatória. |
| Homologação | Usar documentos sintéticos e exemplos representativos fornecidos pelo usuário antes de considerar a melhoria concluída. |
| Testes novos | Criar somente depois da implementação e da aprovação do usuário, com foco eficiente em regressões. Antes disso, executar testes existentes aplicáveis. |

Não modificar automaticamente o catálogo de naturezas, templates integrados publicados ou laudos existentes. Não inventar redação pericial nem novos placeholders de domínio. Preservar placeholders explícitos já presentes, inclusive em células de tabela; eles são referências do modelo, não dados concretos a apagar.

## 2. Estado atual confrontado com a spec

Este diagnóstico registra o baseline anterior à implementação. Os componentes concluídos e o ponto de retomada estão na seção 10; não tratar os problemas desta tabela como ainda não corrigidos sem conferir esse registro.

Referência documental consultada: `spec/03 laudo/importacao_template.md`. Ela descreve a implementação antiga e contém afirmações que não correspondem integralmente ao código. Deve ser usada como contexto, não como prova de comportamento.

| Área | Evidência no código e consequência |
|---|---|
| Entrada | `src/main/ipc/handlers/importacao.handlers.ts` abre seletor para PDF/DOCX e valida novamente a extensão. ODT precisa entrar tanto no seletor quanto no serviço. |
| Serviço | `src/main/services/importacao.service.ts` usa unpdf, mammoth e sanitize-html, com limite de 20 MB. Validação atual usa extensão e tamanho, sem comprovar a estrutura real do documento. |
| Títulos | A implementação reconhece PREÂMBULO inicial e numeração principal sequencial. Não implementa a lista ampla de palavras-chave descrita na spec. |
| PDF | Extrai texto plano, sem preservar estruturas de tabelas ou posições das imagens. Há descarte automático da primeira página quando encontra assinatura digital. O fallback pode voltar a usar todas as páginas, tornando o descarte inconsistente. |
| DOCX | Converte para HTML, mas o fallback com menos de duas seções pode reconstruir tudo a partir de texto bruto e perder tabelas, listas, imagens e formatação. O recorte dos headings também precisa ser corrigido; conteúdo antes do primeiro heading não pode desaparecer. |
| Sanitização | A whitelist atual não cobre integralmente figure/figcaption, rowspan/colspan e atributos dos dummies. Sua ampliação deve preservar apenas metadados necessários e continuar bloqueando HTML inseguro. |
| Revisão | `src/renderer/components/template/ImportTemplateDialog.tsx` já permite editar, incluir/excluir e reordenar seções. Ainda não oferece classificação de células ambíguas ou divisão/união explícita de seções. |
| Salvamento | O diálogo chama template:create e depois createSecao várias vezes. Não verifica todas as respostas e pode anunciar sucesso com cadastro parcial. |
| Operação reutilizável | `template:salvarCompleto` já existe, com transação em `src/main/services/template.service.ts`, permitindo salvar template e seções juntos. |
| Tipagem IPC | Em `src/preload/index.ts`, importarArquivo usa resposta genérica com IpcPayload; salvarCompleto também recebe payload genérico. Alinhar contratos sem introduzir any. Conferir também `src/preload/types.ts`. |

Reaproveitar: processamento no main, revisão no TinyMCE, escolha do tipo de exame, pipeline de sanitização/placeholders, componentes locais de interface e salvamento completo transacional.

Substituir a expectativa antiga de fidelidade visual por estrutura editável e transformações explícitas. A meta antiga de menos de 15 segundos para 20 páginas é referência para medição, não garantia comprovada para todos os documentos.

## 3. Arquitetura proposta

### Pipeline comum

`Selecionar arquivo → validar → extrair por formato → normalizar blocos → transformar em modelo → detectar seções → sanitizar → revisar → salvar atomicamente`.

Separar leitores por formato e regras comuns quando houver responsabilidades reais. Evitar uma única função com extração, heurísticas, limpeza, UI e persistência misturadas. A representação intermediária deve distinguir parágrafos, títulos, listas, tabelas e figuras, mantendo sua ordem e referência de origem quando disponível.

Extrair e transformar localmente no main. Não importar módulos Node/Electron no renderer. Se o custo de parsing bloquear o processo principal, executar o trabalho em worker controlado pelo main; isso não altera o contrato público nem autoriza expor acesso livre ao Node.

### Contratos e identidade

Criar contratos puros compartilhados para:

- Resultado com nome do arquivo, formato, seções, avisos e resumo de quantidades de tabelas e figuras.
- Seção com identificador estável, título, conteúdo sanitizado e indicação de inclusão.
- Aviso com identificador, código, categoria (`adaptacao` ou `limitacao`), mensagem e referência à seção, elemento e página quando conhecida. Sem campo de obrigatoriedade.
- Não retornar classificações nem cópias temporárias de células; o texto permanece no HTML editável.

Identificadores não podem depender apenas do índice da seção ou da tabela. Divisão, união e reordenação preservam o vínculo dos avisos; excluir um elemento remove somente seus avisos. Não persistir esses metadados temporários no banco de templates.

Reutilizar `template:importarArquivo` e `template:salvarCompleto`. Alinhar entradas e saídas entre handler, allowlist, IpcAPI, wrappers e renderer. Qualquer canal adicional realmente necessário deve seguir o contrato de segurança do projeto. Validar dados desconhecidos antes de alimentar estado tipado.

Não há mudança de schema prevista: usar templates e seções existentes. Se a implementação exigir mudança real de schema, ela necessita migration; não incrementar versão sem migration.

## 4. Leitores e regras por formato

### ODT nativo

- Usar leitor ZIP e parser XML leves, com tratamento por namespace, sem depender dos prefixos literais escolhidos pelo produtor do documento.
- Reaproveitar bibliotecas já disponíveis quando adequadas; tornar diretas as dependências efetivamente usadas em produção. Não depender apenas de dependência transitiva de mammoth ou de pacote de desenvolvimento.
- Verificar mimetype, manifesto e content.xml. Ler styles.xml quando necessário para estilos, listas, cabeçalhos/rodapés e interpretação do corpo.
- Suportar títulos, parágrafos, espaços/quebras explícitas, formatação básica, listas, tabelas, células cobertas/mescladas, repetições de linhas/células e referências de imagens.
- Processar repetições com limites; não expandir contagens arbitrárias vindas do arquivo. Nunca extrair caminhos do pacote livremente para o filesystem.
- Ler somente os recursos necessários à estrutura. Não carregar nem persistir fotos originais: reconhecer a ocorrência e inserir dummy na posição correspondente.
- Ignorar metadados sem conteúdo visual, incluindo `office:forms`. Campos com texto disponível são incorporados como texto, sem aviso por campo; respeitar campos ocultos.
- Elementos desconhecidos preservam conteúdo recuperável. Registrar adaptação de apresentação ou limitação real quando nada puder ser recuperado, com referências quando disponíveis. Não inserir mensagens técnicas artificiais no documento.
- Rejeitar documentos criptografados/protegidos nesta entrega, orientando o usuário a fornecer uma cópia desprotegida. Não criar fluxo de senha.

### DOCX

- Manter mammoth como extrator de estrutura, preservando HTML em todos os caminhos, inclusive ausência ou baixa quantidade de headings.
- Propagar mensagens relevantes de conversão para a revisão.
- Detectar títulos sobre os blocos existentes. Não usar reconstrução total por rawText como fallback.
- Preservar todo o preâmbulo e conteúdo antes do primeiro título, bem como títulos sem corpo e o conteúdo depois do último título.
- Substituir imagens pelo mecanismo de dummy sem persistir base64 da foto no template. Preservar integralmente texto e estrutura das tabelas.

### PDF

- Reaproveitar unpdf; a versão local 1.8.1 expõe extractTextItems e getDocumentProxy. Conferir APIs na retomada, antes de implementar.
- Usar coordenadas, dimensões, tamanho de fonte e página para reconstruir linhas/parágrafos e sugerir títulos. Considerar colunas e ordem de leitura; não tratar toda linha extraída como parágrafo independente.
- Preferir estruturas marcadas quando disponíveis; usar geometria apenas com evidência suficiente. Não prometer reconstrução perfeita de tabelas ou mesclagens sem informação estrutural.
- Identificar ocorrências/posições de imagens pela estrutura e operações da página, sem preservar seus pixels. Converter ocorrências do corpo em dummies; posição incerta gera limitação, sem inserção por adivinhação.
- Não descartar a primeira página pela mera presença de assinatura. Assinatura digital é metadado, não prova de que a página é capa inútil.
- Remover elementos recorrentes de cabeçalho/rodapé e paginação somente quando identificáveis. Candidatos incertos permanecem na revisão com aviso.
- Documento inteiramente sem texto extraível: interromper com orientação de OCR. Documento misto: importar conteúdo legível e identificar páginas/trechos não recuperados nos detalhes opcionais.
- Estrutura ambígua: preservar texto recuperado, sinalizar origem e permitir corrigir, reconstruir ou excluir. Avisos não exigem ação explícita antes de salvar.

## 5. Transformação em template

### Tabelas

Preservar texto original, dimensões, cabeçalhos, rótulos, linhas, colunas, mesclagens e placeholders. Não inferir papéis de células, substituir valores por XXX ou manter cópias temporárias por célula. O usuário edita e limpa os dados diretamente no TinyMCE; pode salvar o conteúdo preservado sem classificações ou confirmações.

Tabelas usadas para organizar imagens mantêm sua organização e recebem dummies nas células. Continuam sujeitas à sanitização e aos limites de processamento. Não registrar textos originais em logs para auditoria.

### Figuras e legendas

Reutilizar o contrato já reconhecido pelo laWdo: figure com classe laudo-figure, data-image-id estável, data-dummy=true, imagem dummy local/embarcada e figcaption. Não importar internamente uma feature do renderer no main. Extrair gerador puro comum somente se houver reutilização real.

Conferir `src/renderer/lib/figura-html.ts`, a criação de dummy no TinyMceEditor e os consumidores de figuras/pendências/exportação. O dummy importado deve permitir substituição posterior pelo usuário e aparecer nas pendências existentes.

Legenda final: Figura XX: XXX. Não manter alt/title com descrição da foto original. Quando a legenda estiver em parágrafo separado, substituí-la apenas quando o vínculo com a figura estiver identificado; em dúvida, sinalizar para revisão, evitando apagar texto narrativo adjacente.

### Texto, títulos e seções

Preservar texto narrativo e placeholders {{...}}. O usuário permanece responsável por transformar dados específicos dos parágrafos e tabelas em variáveis do modelo. Não introduzir detecção de nomes, números de REP ou conclusões por IA.

Combinar headings estruturais, numeração e títulos periciais como sinais, sem cortar conteúdo por uma palavra-chave isolada dentro de um parágrafo. Se não houver títulos confiáveis, usar Documento Completo. Manter introdução anterior ao primeiro título e seções tituladas mesmo sem texto, tabelas ou figuras.

Na revisão, disponibilizar divisão em limite de bloco escolhido pelo usuário e união de seções adjacentes, preservando a ordem dos blocos. Reordenar ou excluir seções não pode deslocar um aviso para conteúdo diferente.

## 6. Revisão, sanitização e salvamento

- Atualizar rótulos, filtros e mensagens para PDF, DOCX e ODT. Cancelar seleção de arquivo não é erro; não exibir toast de falha para cancelamento normal.
- Mostrar resumo compacto com seções, tabelas preservadas e figuras substituídas, seguido pelos dados do template e editor. Manter orientação discreta sobre placeholders ou XXX.
- Exibir “Detalhes da importação” inicialmente recolhido, agrupando avisos por código e categoria, com contagem, motivo e localização. Sem cartões, confirmações por ocorrência ou painel de classificação de tabelas.
- Salvar diretamente, sem confirmação geral ou bloqueio por avisos. Exigir nome do template, tipo de exame e ao menos uma seção incluída; todas as incluídas precisam de nome válido. Arquivo inválido, protegido, acima dos limites ou PDF totalmente sem texto continuam interrompendo o processamento.
- Se usuário sair de uma revisão alterada, usar confirmação de descarte conforme o padrão local de alterações pendentes.
- Sanitizar HTML produzido e revisado no main antes da persistência. Permitir somente atributos necessários a tabelas/mesclagens, placeholders, campos XXX e dummies. Escapar valores externos; bloquear scripts, handlers HTML, URLs inseguras e carregamento de recursos externos.
- Não usar regex de HTML como mecanismo único de segmentação ou transformação estrutural. Processar elementos/blocos e evitar cortes no meio de tabelas, listas, placeholders ou figuras.
- Salvar como novo template personalizado via template:salvarCompleto, com chaves locais estáveis para seções e resposta verificada. Não alterar templates integrados nem sobrescrever templates existentes automaticamente.
- Falha de persistência mantém a revisão aberta e informa o erro. A transação não pode deixar apenas parte das seções ou template vazio. Sucesso fecha a revisão e recarrega a listagem.

## 7. Proteções operacionais e dependências

Manter o limite de entrada de 20 MB. Além disso, limitar tamanho descompactado, quantidade de entradas e expansões de elementos repetidos antes de alocar recursos. Os valores concretos desses limites internos devem ser registrados no código e conferidos com os documentos de homologação; não usar apenas o tamanho comprimido como proteção.

Parsing XML não pode resolver DTD/entidades externas. ZIP não pode permitir traversal, recursos externos ou extração irrestrita. PDF deve ter execução de conteúdo ativo desabilitada. Sempre liberar recursos do documento e remover temporários criados pelo processo, inclusive em falha.

Não embutir LibreOffice, OCR, modelos de IA ou dependências gráficas nativas apenas para essa importação. A estimativa anterior de aumento inferior a 1 MB no instalador é hipótese baseada no reaproveitamento de ZIP/XML; medir depois do empacotamento, sem prometer esse valor.

Esta melhoria não remove a dependência atual de LibreOffice para a exportação ODT. Importação e exportação têm requisitos independentes.

## 8. Sequência de implementação e homologação

1. Reler este plano e AGENTS.md. Conferir estado do repositório e código atual; preservar alterações anteriores de naturezas de exame, que não pertencem à importação. Organizar o trabalho conforme as regras de branch por feature, sem commit/publicação sem autorização.
2. Conferir documentação atual das bibliotecas com Context7. Estabelecer contratos tipados e representação intermediária; mapear geradores/consumidores de dummies e campos reservados.
3. Implementar leitor ODT e corrigir extração/segmentação DOCX. Preservar conteúdo integral e apresentar elementos não suportados.
4. Melhorar extração PDF, removendo descarte indevido da primeira página e adicionando avisos por página/elemento.
5. Preservar texto/estrutura de tabelas e aplicar dummies, legendas, títulos e sanitização.
6. Estender revisão com detalhes opcionais agrupados, edição no TinyMCE, divisão/união e proteção de descarte. Integrar salvamento transacional direto.
7. Executar validações existentes e homologar documentos sintéticos e exemplos do usuário, incluindo editor, reabertura, geração e exportação de laudo.
8. Somente após aprovação da implementação, criar testes eficientes de regressão. Sugerir atualização da spec de importação e demais specs realmente impactadas; aguardar autorização para registrar estado atual.

Não criar/alterar testes durante a implementação ou a homologação. Rodar type-check e lint após mudanças de código; mudanças em banco/IPC também exigem npm test. Se teste existente falhar, registrar resultado e causa provável sem modificá-lo antecipadamente. Validar empacotamento quando houver mudança de dependência ou inclusão de worker/arquivo necessário ao runtime.

## 9. Aceite e testes futuros

### Aceite funcional

- ODT importa em instalação sem LibreOffice; PDF/DOCX continuam disponíveis e o pacote ZIP mantém seu fluxo próprio.
- Documentos com zero/um/vários títulos não perdem introdução, final do documento, títulos vazios, listas ou tabelas silenciosamente.
- Tabelas preservam texto original, estrutura, mesclagens e placeholders; limpeza manual no TinyMCE, sem classificação ou substituição automática.
- Imagens do corpo, isoladas ou em tabelas, tornam-se dummies substituíveis, com legenda genérica e sem conteúdo original persistido.
- PDFs assinados preservam a primeira página útil. PDFs escaneados não geram template vazio; PDFs mistos identificam páginas sem extração.
- Detalhes permanecem vinculados ao conteúdo após reorganização, ficam recolhidos inicialmente e não exigem confirmações ou bloqueiam salvamento. Campos ODT com texto não geram avisos individuais; metadados não visuais são ignorados.
- Falha ao salvar não cria template parcial; o conteúdo revisado continua disponível para nova tentativa.
- Template salvo reabre, gera laudo, mantém dummies/campos pendentes e exporta conteúdo consistente com o editor.
- Arquivos inválidos, protegidos, acima do limite ou de expansão excessiva falham com mensagem legível e sem travar a interface.

### Testes específicos após aprovação

Criar fixtures sintéticas, sem dados pessoais nem consultas a sistemas reais. Cobrir ODT com namespaces/estilos/listas/células repetidas e mescladas; DOCX com poucos headings e conteúdo anterior ao primeiro; PDF textual, assinado, escaneado e misto; placeholders fragmentados por formatação; dummies e legendas; preservação/edição manual de tabelas e detalhes agrupados sem bloqueio; identidade na divisão/união/reordenação; segurança de arquivos/HTML e salvamento atômico.

Priorizar testes que reproduzam perdas ou falhas concretas e invariantes de round-trip, sem espelhar a implementação. Não assumir que um teste de texto extraído comprova layout ou comportamento no TinyMCE. A homologação visual continua necessária.

## 10. Referências e ponto de retomada

- `spec/03 laudo/importacao_template.md`: contexto do fluxo antigo; divergências registradas na seção 2.
- ODF Packages: https://docs.oasis-open.org/office/OpenDocument/v1.3/OpenDocument-v1.3-part2-packages.html
- unpdf, extração estruturada de texto: https://github.com/unjs/unpdf/blob/main/_autodocs/api-reference/text.md
- Fontes de verdade da implementação: importacao.service.ts, importacao.handlers.ts, ImportTemplateDialog.tsx, template.service.ts e contratos do preload, conferidos em 13/10/2026.

### Componente 1 — identidade da revisão e salvamento transacional

Implementado em `src/renderer/components/template/ImportTemplateDialog.tsx`:

- Validar a resposta desconhecida da importação antes de alimentar o estado; usar UUID em cada seção (inicialmente local; geração transferida ao main no componente 2).
- Usar a identidade da seção nas chaves React, no drag-and-drop, no editor e nos controles. Reordenação e exclusão não reutilizam a identidade de outra seção.
- Substituir `template:create` + chamadas separadas de `createSecao` por uma chamada a `template:salvarCompleto`, com `chave_local` estável, sem ID de template existente. Reutilizar a transação existente para criar uma cópia personalizada completa.
- Conferir sucesso e ID retornado; manter revisão aberta em falha. Exigir nome de todas as seções incluídas, sem descartá-las silenciosamente.
- Cancelamento normal do seletor não gera toast de erro. Bloquear fechamento durante importação/salvamento e retorno à seleção durante salvamento.

Branch de trabalho: `feature/melhoria-importacao-laudo`. Sem commit ou publicação. Alterações anteriores de tipos de exame/banco permanecem no checkout e não fazem parte deste componente. Não criar nova branch para a retomada.

Validação: `npm run type-check`, `npm run lint` e `git diff --check` passaram; `npm test` passou com 149 arquivos e 783 testes. Nenhum teste criado ou alterado. Homologação visual do diálogo e do editor ainda pendente.

### Componente 2 — contratos e validação das fronteiras IPC

Implementado na mesma branch, em 13/10/2026:

- `src/shared/types/importacao-template.types.ts`: contrato puro do resultado, formato efetivamente suportado (PDF/DOCX), seção com identidade e resposta que distingue sucesso, cancelamento e falha.
- `src/shared/types/template.types.ts`: entrada de salvamento completo/seções e identificação do template salvo, compartilhadas entre as camadas.
- Serviço de importação gera UUIDs no main ao compor o resultado; renderer valida formato, campos e IDs não vazios/duplicados, preservando as identidades recebidas.
- Handler de importação retorna cancelamento tipado; diálogo não depende mais de comparar texto de erro para reconhecer cancelamento.
- `src/preload/types.ts` e `src/preload/index.ts` tipam resultado da importação, entrada e resposta de `salvarCompleto`. Canais existentes e allowlist mantidos, sem adicionar canal.
- `src/renderer/index.tsx` alinha os dois métodos na declaração global de `window.ipcAPI`, que antes os tratava como métodos legados genéricos. Os demais métodos legados não foram migrados neste componente.
- Handler de `salvarCompleto` recebe `unknown` e valida template, cada seção e campos opcionais antes de normalizar ou chamar o serviço. Os contratos não substituem a validação em runtime. A transação e as verificações de chaves/hierarquia continuam no serviço existente.

Não houve alteração de dependências, APIs de bibliotecas ou schema. Nenhum teste criado/alterado. Validação: `npm test` passou com 149 arquivos e 783 testes; `npm run type-check`, `npm run lint` e `git diff --check` passaram na versão final. Sem commit ou publicação. Homologação visual permanece pendente.

### Componentes 3–6 — leitores, transformações e revisão

Implementados na mesma branch, sem commit/publicação:

- `src/main/services/importacao/estrutura.ts`: blocos estruturais com identidade, tipo e página de origem. Segmentação por DOM preserva introdução, listas, tabelas, figuras, final e títulos sem corpo; não há fallback que reconstrua DOCX por texto bruto.
- `pacote.ts` e `odt.ts`: leitura nativa ODT via ZIP/XML, resolução por URI de namespace independentemente do prefixo, mimetype/manifesto/corpo, estilos básicos, listas, espaços/quebras, tabelas, mesclagens, células cobertas e repetições limitadas. Imagens/objetos/desenhos viram referências dummy sem ler seus pixels. Cabeçalhos/rodapés declarados não são incorporados. Metadados não visuais são ignorados e campos textuais não geram avisos individuais. Elementos desconhecidos preservam conteúdo recuperável e registram adaptação ou limitação, sem mensagens técnicas inseridas no documento; não há senha, OCR ou LibreOffice no leitor.
- `docx.ts`: mammoth mantém HTML em todos os caminhos, ignora acesso a arquivos externos, não lê imagens originais e propaga mensagens de conversão. Cabeçalhos/rodapés são descartados com aviso. Preserva introdução, headings únicos/vazios, tabelas e final.
- `pdf.ts` e `pdf-marcado.ts`: coordenadas/fontes recompõem linhas e parágrafos; estrutura marcada é priorizada quando cobre o texto e as figuras detectadas. Tabelas marcadas preservam linhas/células/cabeçalhos; mesclagens e geometria incerta geram avisos opcionais, sem prometer reconstrução perfeita. Não descarta a primeira página pela assinatura. Paginação reconhecível e margens recorrentes com evidência são removidas; casos restantes são revisados por página. Imagens com posição confiável viram dummies; posições incertas geram limitações para eventual inserção manual/descarte, sem adivinhação. PDF totalmente sem texto exige OCR externo; páginas não legíveis em documento misto geram aviso de limitação.
- `transformacao.ts`: tabelas preservam todo o texto original, estrutura, mesclagens, placeholders e figuras, incluindo tabelas aninhadas. Sem classificação de células, limpeza automática ou cópias temporárias dos originais. Placeholders fragmentados por formatação são reunidos. Legenda estrutural seguramente vinculada é descartada em favor de Figura XX: XXX; vínculo incerto gera aviso opcional.
- `src/shared/figura/html.ts`: gerador puro usado tanto pelo main quanto pelo renderer, com dummy SVG embarcado e contrato `laudo-figure`/`data-image-id`/`data-dummy`. A fachada `src/renderer/lib/figura-html.ts` mantém os imports existentes.
- `sanitizacao.ts`: allowlist de HTML, estilos, mesclagens e metadados necessários. Remove scripts, handlers e referências externas; imagens são normalizadas ao dummy embarcado. Não restaura placeholders crus depois da sanitização. Ao salvar a importação, sanitiza novamente no main e remove metadados temporários. `importado_de_documento` restringe esse caminho à criação de novo template/seções, sem reescrever templates existentes.
- `worker.ts` e `importacao.service.ts`: parsing em worker controlado pelo main, uma importação por vez, limite de memória e timeout; resposta desconhecida validada antes do IPC. Sem temporários de documentos/fotos no fluxo de produção. Worker não herda flags de execução da sessão (verificação sintética encontrou e corrigiu herança indevida de `--input-type`).
- `RevisaoImportacaoPanel.tsx` e `importacao-revisao.ts`: resumo compacto e orientação sobre limpeza manual. Detalhes recolhidos em `<details>`, agrupados por código/categoria com contagem e localização. Sem cartões, seletores ou confirmações; contratos antigos de classificação e obrigatoriedade removidos.
- `ImportTemplateDialog.tsx`: PDF/DOCX/ODT disponíveis, ZIP continua separado; dividir em limite de bloco escolhido e unir seções adjacentes preservam conteúdo/ordem/identidades. Vínculos por elemento/página são localizados no conteúdo atual; vínculos por seção são ajustados na divisão/união. Reordenação/exclusão não atribuem avisos a outra seção. Confirmação de descarte ao fechar/voltar, registro no controle global de alterações pendentes e editor desabilitado durante salvamento. Callback de conteúdo usa ID em vez de índice para evitar stale closures após reordenação. Salvar chama diretamente a operação transacional, sem confirmação geral ou bloqueio por avisos; valida nome, tipo de exame e seções incluídas.

### Limites operacionais implementados

Entrada: 20 MB. Pacote: 2000 entradas, 32 MB por entrada, 80 MB de tamanho declarado total. XML/conteúdo HTML: 12 MB; descompressão XML limitada antes da alocação, com conferência de tamanho e CRC. Árvores: 100000 nós e profundidade 80. ODT: contagens individuais de repetição/mesclagem até 500, 30000 elementos expandidos. Tabela: 20000 células; placeholders por bloco: 2000. PDF: 300 páginas, 100000 fragmentos de texto e 150000 operações por página. Worker: 256 MB de geração antiga/32 MB de geração jovem do V8, timeout de 60 segundos. Os limites de V8 não equivalem a um limite de toda a memória nativa/externa; conferir desempenho com os exemplos de homologação. Sem nova dependência ou mudança de schema.

### Validações e ponto de retomada

Na entrega inicial, Context7 foi consultado para unpdf, htmlparser2, mammoth, adm-zip, sanitize-html, Electron/ASAR e TinyMCE React. TypeScript, lint, testes existentes, build e pack passaram. O smoke do worker dentro de app.asar no runtime Electron validou o processamento empacotado daquela versão. Documentos sintéticos cobriram PDF textual/marcado/misto/sem texto, DOCX, ODT com prefixos alternativos e repetições, sanitização, limites, placeholders e dummies. A classificação e limpeza automática daquela versão foram substituídas pela decisão abaixo; não retomá-las.

### Simplificação da revisão — 13/10/2026

A primeira inspeção válida do ODT do usuário mostrou 1 seção, 8 tabelas, 6 figuras e pelo menos 28 confirmações individuais, embora a importação tivesse retornado sucesso. Metadados de formulários e campos como variable-input eram convertidos em pendências mesmo quando o texto permanecia disponível. Capturas e inspeções posteriores ficaram indisponíveis; esse diagnóstico usa a primeira inspeção e o código.

Decisão aprovada: importar → editar o documento → salvar diretamente. Preservar texto de tabelas e limpar manualmente; avisos opcionais agrupados, sem classificação de células, confirmações individuais ou confirmação geral. Essas escolhas substituem as decisões anteriores de limpeza automática e revisão obrigatória.

Implementado nos leitores, transformação, sanitização, contratos compartilhados e diálogo/painel de revisão. Permanecem imagens dummy, legendas, placeholders, limites, referências de origem, divisão/união/remoção de seções, confirmação de descarte e proteção durante salvamento. Nenhuma mudança de schema ou dependência.

Validação da versão simplificada: npm run type-check, npm run lint, npm test (149 arquivos, 783 testes) e npm run build passaram. Nenhum teste criado ou alterado. Smoke temporário de ODT via worker confirmou 28 campos textuais sem avisos individuais, metadados invisíveis ignorados, conteúdo desconhecido recuperável preservado sem marcador técnico, categorias de adaptação/limitação, texto original de tabela, mesclagem, placeholder fragmentado e figura dummy. DOCX sintético confirmou preservação de introdução, tabela preenchida e final. A renderização do painel real confirmou detalhes recolhidos e agrupamento sem controles de classificação ou confirmação. A homologação do arquivo original e da edição interativa continua pendente; smoke sintético não comprova layout no TinyMCE.

O diagnóstico está desconectado nesta sessão. Reiniciar o laWdo com o build atualizado e reimportar o ODT original: a revisão anteriormente aberta já contém células limpas pela versão anterior e não pode restaurar o texto original. Conferir detalhes recolhidos, ausência de classificações/confirmações, salvamento direto, mesclagens, placeholders, figuras e divisão/união/remoção no editor. Completar reabertura do template, geração/exportação de laudo e exemplos de produtores distintos. Não repetir implementação, criar outra branch ou antecipar testes novos.

Sem commit/publicação; preservar alterações anteriores de tipos de exame/banco. A aprovação do plano não autoriza atualizar specs de estado atual automaticamente. Após homologação, sugerir atualização de spec/03 laudo/importacao_template.md pelo fluxo /spec.
