# PRD - Product Requirements Document: laWdo

## 1. Visão Geral do Produto

O **laWdo** é uma evolução do sistema atual baseado em Streamlit para uma aplicação nativa de alta performance utilizando **Electron**. O objetivo é fornecer aos Peritos Criminais da Polícia Científica uma ferramenta robusta, offline-first, para a gestão de Requisições de Exame Pericial (REP) e a elaboração de laudos técnicos com auxílio de Inteligência Artificial.

## 2. Objetivos Estratégicos

- **Edição Avançada:** Oferecer um editor Rich Text (TinyMCE) modular e segmentado por seções.
- **Gestão de Mídias:** Otimizar o manuseio de imagens locais, garantindo organização e numeração automática de figuras.
- **Automação Inteligente:** Integrar modelos de linguagem (LLMs) para revisão de texto e descrição técnica de evidências fotográficas.
- **Portabilidade de Dados:** Manter a base de dados em SQLite e imagens apartadas para backup local. Integrações de sincronização em nuvem permanecem como evolução futura.

## 3. Público-Alvo

- Peritos Criminais.

## 4. Requisitos Funcionais (FR)

### FR1: Gestão de Acesso e Perfil

- **Fluxo de Primeiro Acesso:** Configuração inicial de dados do perito (Nome, Matrícula, Lotação).
- **Autenticação Local:** Login com usuário e senha criptografada.
- **Perfil do Usuário:** Gerenciamento de dados institucionais e configuração de pastas de exportação.

### FR2: Cadastros Estruturais

- **Solicitantes:** Cadastro de Delegacias, Varas e outros órgãos requisitantes com formulários reutilizáveis (quick-create inline nos formulários de REP).
- **Tipos de Exame:** Definição de categorias de perícia (Ex: Homicídio, Trânsito) com formulários reutilizáveis (quick-create inline nos formulários de REP).
- **Templates de Laudo:** Criação de modelos reutilizáveis com seções pré-definidas (Preâmbulo, Histórico, Exames, Conclusão).

### FR3: Gestão de REPs (Requisição de Exame Pericial)

- **Registro de REP:** Captura de dados de acionamento, envolvidos, lacres de entrada/saída, localização com inputs personalizados a depender do tipo de exame (campos dinâmicos por categoria de exame, reutilização de formulários de Solicitante e Tipo Exame via quick-create dialogs).
- **Indicadores:** Dashboard com indicadores de REPs pendentes, em andamento e concluídas e outros indicadores de produtividade.
- **Timeline Dual-Track:** Linha do tempo de trilha dupla (REP azul + Laudo violeta) com eixo cronológico compartilhado, conexões direcionais entre eventos, trilha fantasma para períodos sem laudo e acesso via ícone em tabelas de REPs, Laudos e aba dedicada na página de Logs.
- **Ciclo de Vida:** Rastreamento completo do ciclo de vida da REP (Pendente → Em Andamento → Concluído) e Laudo (Em andamento → Concluído → Entregue) com ícones visuais de status nas tabelas.

### FR4: Editor de Laudos (O Coração do Sistema)

- **Estrutura Modular:** Edição do laudo dividida por seções independentes baseadas no template ou visualização do laudo sob um unico editor de texto (padrão).
- **Rich Text Editor:** Suporte a formatação avançada, tabelas e listas via TinyMCE.
- **Snapshots:** Histórico das últimas 3 versões salvas para recuperação de desastres.
- **Área de Trabalho:** Trilho permanente à direita com docks redimensionáveis e mutuamente exclusivos para Assistente IA e Ilustrações, sem sobrepor ou desmontar o editor.

### FR5: Gestão de Ilustrações

- **Inserção de Imagens:** Upload de fotos locais para o diretório do laudo.
- **Placeholders de Imagem:** Inserção de figuras dummy (SVG placeholder) substituíveis por imagens reais via clique direto no editor ou via painel de ilustrações.
- **Legendas Automáticas:** Sistema de numeração sequencial (Figura 1:, Figura 2:) com legendas.
- **Seção de Ilustrações:** Geração automática de uma seção Ilustração se caso o usuario optar pelo uso de inserçao automática de figuras no laudo.
- **Painel de Ilustrações:** Modo híbrido em dock/pop-out, com largura integrada e dimensões da janela persistidas, sincronização via IPC e coexistência com a janela destacada do Assistente IA.

### FR6: Sistema de Placeholders

- **Substituição Dinâmica:** Uso de tags como `{{numero_rep}}` e `{{perito_nome}}` no texto.
- **Placeholders Customizados:** Interface com layout 2-painéis (árvore hierárquica de categorias + DataTable de placeholders) com suporte a subcategorias aninhadas (parent_id), ordenação drag-and-drop, cores e ícones por categoria.
- **Resolução para IA:** No envio integral, os valores atuais dos placeholders são apresentados à IA em contexto textual somente para leitura, sem alterar o HTML nem expor seus marcadores; no modo protegido, esse contexto não é enviado.

### FR7: Assistente IA

- **Provedores Múltiplos:** Suporte a Groq e Google Gemini, com catálogo compartilhado de modelos, capacidades de visão, limites e orçamento de contexto. A seleção e as chaves independentes são configuradas somente na página Modelos de IA.
- **Painel Único:** Assistente disponível como dock direito redimensionável ou janela destacada reencaixável, com o mesmo contexto, histórico, progresso, confirmação e operação ativa.
- **Transformações Controladas:** Revisão gramatical, linguagem técnico-pericial, clareza, resumo, expansão e reescrita livre sobre seleção, seção ou documento; pedidos livres também podem inserir texto no cursor originalmente capturado.
- **Aplicação Segura:** Cada proposta permanece ligada ao alvo e ao fingerprint de origem, passa por comparação lado a lado e só altera fragmentos textuais. A estrutura HTML, figuras, formatação e tokens protegidos são revalidados, e a aplicação usa uma única operação de undo sem salvar automaticamente.
- **Laudos Grandes:** Planejamento determinístico e processamento sequencial em lotes, com confirmação prévia, progresso, cancelamento, retomada temporária após falha e entrega atômica sem alteração parcial do documento.
- **Descrição de Imagens:** O renderer envia apenas os IDs do laudo e da imagem persistida. O main valida pertencimento, formato, tamanho e suporte do modelo; a descrição resultante é destinada exclusivamente à cópia manual.
- **Preferências e Privacidade:** Perfil local de tom, detalhamento e instruções personalizadas. A preferência `Enviar conteúdo integralmente` decide entre envio de texto/imagem ou mascaramento; chaves permanecem protegidas no main e conteúdo pericial não entra em logs.
- **Segurança da Sessão:** IPC tipado e validado, operação vinculada ao renderer proprietário, revisão monotônica entre editor e janela e URL destacada contendo somente o identificador da sessão.

### FR8: Exportação e Auditoria

- **Múltiplos Formatos:** Geração de PDF, DOCX (Word) e ODT (LibreOffice).
- **Configuração de PDF:** Personalização de cabeçalho institucional (texto, imagem, alinhamento) e margens da página via páginas dedicadas (CabecalhoPage, MargensPage).
- **Log de Auditoria:** Registro de login, exclusões, backup/restauração e transições de status de REPs e Laudos com snapshot antes/depois na tabela `logs_auditoria`. Logs de sistema em JSON estruturado com filtro por módulo e viewer com abas Sistema/Auditoria.
- **Backup/Restauração:** Ferramenta para exportar e importar o banco de dados e as imagens em um pacote ZIP, com exclusão automática da auditoria e chaves de IA dos backups. Agendamento de backup automático com periodicidade configurável pelo usuário.
- **Sincronização com Google Drive:** Evolução futura para envio automático de backups; não há integração implementada no estado atual.

### FR9: Wizard de Peças e Laudo Assistido

- **Modo Wizard:** Alternativa ao modo Template para criação de laudos. O perito responde perguntas em cascata (árvore de decisão) e o sistema monta o laudo automaticamente com peças de texto pré-cadastradas inseridas nas seções corretas.
- **Editor de Wizard:** Interface visual para montagem da árvore de etapas (perguntas + opções em cascata) com vínculo de peças via dialog de busca ou criação inline. Suporte a tipos de input: select, radio, checkbox, text e image.
- **Banco de Peças:** Cadastro de trechos HTML reutilizáveis entre wizards, organizados por categorias hierárquicas (CategoriasPecasPage) com busca, tags e edição inline.
- **Regras de Composição:** Motor de matching condicional que determina quais peças aparecem em quais seções do laudo conforme as respostas do perito.
- **WizardLaudoPage:** Página dedicada com stepper de perguntas, preview em tempo real do laudo (peças agrupadas por seção), seleção/desmarcação de peças individuais e salvamento de progresso para continuação posterior.
- **Retroatividade:** Respostas salvas permitem que o perito altere opções e o sistema reaplique automaticamente as peças corretas.

### FR10: Configuração de Impressão

- **Cabeçalho PDF:** Personalização de cabeçalho institucional com texto, upload de imagem (brasão/logo) e alinhamento configurável.
- **Margens:** Ajuste de margens superior, inferior, esquerda e direita da página para conformidade com normas institucionais.

## 5. Requisitos Não Funcionais (NFR)

- **Offline-first:** O sistema deve ser totalmente funcional sem internet, exceto pelas funções de IA.
- **Interface Premium:** Design moderno utilizando Shadcn/ui com suporte a Dark Mode.
- **Performance de Banco:** Queries otimizadas no SQLite para suportar milhares de registros sem lentidão.
- **Segurança:** Criptografia de dados sensíveis, sanitização de entradas, isolamento do renderer Electron e validação de dados externos nas fronteiras IPC, JSON, banco e provedores de IA.

## 6. Stack Tecnológica Atual

- **Runtime:** Electron (Desktop)
- **Bundler:** Vite
- **Linguagem:** TypeScript
- **Frontend:** React
- **Estilização:** Tailwind CSS + Shadcn/ui
- **Banco de Dados:** SQLite (com sqlite3)
- **Editor:** TinyMCE (com Bridge para React)
- **Exportação:** `webContents.printToPDF` do Electron (PDF), `docx` (Word) e `libreoffice-convert` (ODT, quando o LibreOffice está disponível)
- **IA:** Google Gemini e Groq por endpoints compatíveis com OpenAI
- **Gerenciamento de Estado:** React hooks + serviços no main process via IPC

## 7. Critérios de Aceite

- O laudo final gerado deve ser idêntico visualmente ao modelo oficial da instituição.
- A migração do banco de dados atual para a nova estrutura não deve resultar em perda de dados.

## 8. Status Atual de Implementação

- **Autenticação e Perfil:** Login local com senha criptografada, setup de primeiro acesso (Nome, Matrícula, Lotação), gerenciamento de perfil com avatar.
- **Cadastros Estruturais:** CRUD completo de Solicitantes, Tipos de Exame e Templates de Laudo com formulários reutilizáveis em quick-create dialogs na tela de REPs.
- **Placeholders:** Layout 2-painéis com árvore hierárquica de categorias (parent_id, drag-and-drop, cores e ícones) e DataTable de placeholders. Placeholders de sistema fixos no cabeçalho do laudo. Para IA, valores resolvidos são enviados apenas como contexto textual no modo integral, sem modificar o HTML de origem.
- **Editor de Laudos:** TinyMCE independente por seção com menu de contexto para inserção de placeholders. Upload de imagens locais com protocolo `laudo-img://` e numeração automática de figuras. Substituição de figuras dummy por imagens reais com atualização correta de `data-mce-src` via API do TinyMCE. Snapshot das últimas 3 versões salvas.
- **Painel de Ilustrações:** Dock direito redimensionável e janela destacada, com dimensões persistidas, sincronização por IPC, reordenação, edição de legendas, substituição de figuras e rolagem da seleção restrita à lista interna.
- **Wizard de Peças:** Modo alternativo de criação de laudos via árvore de perguntas em cascata. Editor visual de wizard (WizardEditorPage), banco de peças com categorias hierárquicas (PecasPage, CategoriasPecasPage), motor de regras condicionais, WizardLaudoPage com stepper e preview em tempo real.
- **Assistente IA:** Painel único em dock ou janela destacada, com ações de transformação e inserção, seleção explícita de escopo, comparação editável apenas no texto, aplicação atômica com undo, lotes sequenciais, confirmação, cancelamento e retomada temporária. Groq e Gemini usam catálogo compartilhado; imagens persistidas são descritas por ID e ficam disponíveis apenas para cópia. Perfil e privacidade são configurados na ModelosIAPage, e chaves nunca são expostas ao renderer.
- **Timeline Dual-Track:** Linha do tempo de trilha dupla (REP + Laudo) com eixo cronológico, conexões direcionais, trilha fantasma e acesso via tabelas de REPs/Laudos e aba dedicada nos Logs.
- **Logs e Auditoria:** Sistema modular com JSON estruturado, viewer com abas Sistema/Auditoria/Timeline, filtro por módulo, registro de transições de status com snapshot antes/depois, exclusão autenticada por senha.
- **Backup/Restauração:** Exportação/importação ZIP com banco + imagens, exclusão automática de auditoria e chaves de IA dos backups, agendamento de backup automático com periodicidade configurável.
- **Configuração de Impressão:** Páginas de Cabeçalho PDF (texto, imagem brasão/logo, alinhamento) e Margens (superior, inferior, esquerda, direita).
- **Exportação:** PDF gerado pelo Electron, DOCX e ODT; a exportação ODT é habilitada somente quando o LibreOffice está disponível.
- **Dashboard:** Indicadores de REPs pendentes/em andamento/concluídas, produtividade e tabelas com colunas fixas (sticky) para referência.
- **Evolução futura:** sincronização de backups com Google Drive.
