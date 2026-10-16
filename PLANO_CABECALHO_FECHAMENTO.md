# Plano — Cabeçalho e fechamento dos laudos

Data: 16/10/2026

Status: planejamento aprovado conceitualmente; implementação pendente.

Este arquivo registra a proposta de implementação. Não descreve uma funcionalidade já disponível.

## Objetivo

Configurar, em um único lugar, o cabeçalho e o fechamento usados na criação dos laudos. Permitir desativar cada um sem apagar seu conteúdo e preservar a apresentação dos documentos já criados.

## Decisões acordadas

- Renomear a página “Cabeçalho de Laudos” para “Cabeçalho e fechamento”.
- Organizar a página em duas abas: “Cabeçalho” e “Fechamento”.
- Manter as configurações existentes de cabeçalho da primeira página e de todas as páginas.
- Criar um editor próprio para o fechamento, separado dos templates de conteúdo.
- Disponibilizar dois checkboxes independentes: “Inserir cabeçalho nos laudos” e “Inserir fechamento nos laudos”.
- Desmarcar uma opção impede a inclusão do respectivo conteúdo; o conteúdo continua salvo e editável.
- A reativação ocorre na própria página, marcando e salvando novamente a opção.
- Copiar conteúdo e preferências para cada laudo no momento da criação. Mudanças posteriores na configuração valem para novos laudos.

## Comportamento da página

Cada aba terá seu controle de ativação, editor e ação de salvar. O checkbox do cabeçalho controla conjuntamente o cabeçalho da primeira página e o de todas as páginas, incluindo o contador incorporado a esse cabeçalho. Não haverá controles adicionais por tipo de cabeçalho nesta entrega.

Quando desativado, mostrar junto ao editor: “Desativado — não será incluído nos novos laudos”. Não limpar o editor, ocultar seu conteúdo nem bloquear sua edição.

Ao salvar, persistir conjuntamente a preferência de ativação e o conteúdo correspondente. Informar na página que essas configurações são aplicadas aos novos laudos e que os existentes mantêm sua configuração.

A prévia da configuração deve refletir os valores atuais dos controles, inclusive a ausência dos blocos desativados. A prévia e a exportação de um laudo devem usar a configuração preservada naquele documento.

## Fechamento

O editor permitirá alinhamento, negrito, itálico e espaçamento, com suporte aos placeholders existentes de nome, cargo e lotação do perito. Reproduzir a referência enviada com texto editável, sem converter o bloco em imagem nem fixar os dados pessoais da referência como padrão para outros usuários.

O fechamento será inserido uma única vez, depois de todo o conteúdo que compõe o documento, inclusive ilustrações ou anexos que integrem esse corpo. Deve acompanhar o fluxo do texto, com espaçamento superior configurável, sem posição fixa no pé da página e sem quebra obrigatória antes do bloco.

Manter o bloco inteiro na mesma página quando sua altura permitir. Se não houver espaço restante, deslocá-lo completo para a página seguinte. Validar esse comportamento em cada formato de exportação suportado.

O texto “assinatura digital”, quando utilizado, será apenas uma indicação visual. Esta entrega não implementa assinatura criptográfica.

## Preservação por laudo

Preservar, na criação do laudo:

- ativação e conteúdo do cabeçalho da primeira página e de todas as páginas;
- ativação e conteúdo do fechamento;
- espaçamento do fechamento;
- dados do perito usados nesses blocos, evitando que alterações futuras de nome, cargo ou lotação modifiquem documentos anteriores.

Os campos variáveis próprios do documento, como número da REP e contador de páginas, continuam sendo resolvidos a partir do documento e da paginação. Distinguir esses valores dos dados pessoais preservados do perito.

Salvar novamente, abrir, visualizar ou exportar um laudo não deve substituir sua configuração pela configuração global atual. Não incluir nesta entrega uma ação de atualização em massa ou um controle por laudo para reaplicar os padrões.

## Compatibilidade com instalações e laudos existentes

Em instalações existentes, iniciar o cabeçalho habilitado, respeitando o conteúdo já configurado. Iniciar o fechamento desabilitado e vazio, para evitar sua inclusão inesperada ou duplicação com fechamentos já escritos nos templates.

Antes de alterar o comportamento global, definir e implementar a migração dos laudos existentes. A migração deve preservar o cabeçalho global disponível naquele momento como referência dos documentos antigos, sem acrescentar fechamento. Caso não seja possível reconstruir os dados históricos do perito, registrar essa limitação: a migração não recupera a aparência de exportações anteriores a partir de informações que não foram armazenadas.

Não remover automaticamente fechamentos escritos manualmente em templates ou laudos. Na configuração do novo fechamento, informar de forma breve que um fechamento já presente no corpo do template pode causar duplicação e precisa ser revisado pelo usuário.

## Etapas de implementação

1. Conferir os caminhos de criação, edição, duplicação, prévia e exportação de laudos, além do armazenamento das configurações e dos dados do perito.
2. Definir os contratos de configuração e de cópia por laudo, com defaults explícitos e validação dos dados persistidos. Reutilizar a configuração existente quando adequado.
3. Criar a migração necessária para armazenar os novos campos e preservar os laudos existentes. Incrementar a versão do schema com o respectivo bloco de migração.
4. Ajustar serviços e contratos IPC/preload em conjunto, quando necessário. A criação do laudo deve persistir seu conteúdo e a cópia das configurações de forma consistente.
5. Renomear a página e sua entrada de navegação; implementar abas, checkboxes, editor do fechamento, espaçamento, salvamento e prévia.
6. Integrar a composição dos blocos em todos os caminhos de prévia e exportação, usando uma regra comum que evite divergências e duplicação. Os templates de conteúdo permanecem independentes desses blocos.
7. Garantir que a duplicação de um laudo preserve a configuração do documento de origem; a criação a partir de um template usa os padrões globais vigentes.
8. Incluir as novas configurações e os dados preservados por laudo nos fluxos aplicáveis de backup, restauração e transporte de dados existentes.
9. Executar as validações e conferir manualmente a paginação e a apresentação dos formatos suportados.
10. Ao concluir a implementação, sugerir a atualização das specs afetadas; a escrita em `spec/` depende da decisão do usuário.

## Critérios de aceite

- As quatro combinações de cabeçalho e fechamento habilitados/desabilitados funcionam de forma independente.
- Desativar, salvar e reativar preserva integralmente o conteúdo configurado.
- Cabeçalhos desativados não deixam espaço reservado exclusivo para eles; fechamento desativado não deixa espaçamento residual.
- O fechamento aparece uma única vez ao final e mantém a formatação na prévia e na exportação.
- Um fechamento que caiba em uma página não é dividido quando faltar espaço na página anterior.
- Mudanças globais afetam novos laudos e não alteram os existentes, inclusive quando os dados do perito mudam.
- Reabrir e exportar um laudo usa os dados preservados, independentemente do usuário conectado naquele momento.
- Laudos antigos não recebem automaticamente o novo fechamento.
- Criar por template e duplicar laudo seguem as regras distintas descritas neste plano.
- Backup e restauração mantêm conteúdos, preferências e cópias por laudo.

## Validação da implementação

Executar `npm run type-check`, `npm run lint` e `npm test`, pois a implementação envolve persistência e possivelmente IPC. Não aumentar a contagem de warnings.

Conferir manualmente documentos curtos e longos, término próximo ao limite da página, placeholders, blocos vazios, reativação dos controles, migração e exportações suportadas.

Antes de criar ou alterar testes automatizados, apresentar explicitamente a justificativa e o escopo, conforme as instruções do projeto. Os principais candidatos são migração, preservação da configuração por laudo e combinação dos controles na composição da saída.

Este plano, isoladamente, não requer executar validações de código nem alterar testes.
