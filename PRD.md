# PRD - Product Requirements Document: laWdo

## 1. Visão Geral do Produto

O **laWdo** é uma evolução do sistema atual baseado em Streamlit para uma aplicação nativa de alta performance utilizando **Electron**. O objetivo é fornecer aos Peritos Criminais da Polícia Científica uma ferramenta robusta, offline-first, para a gestão de Requisições de Exame Pericial (REP) e a elaboração de laudos técnicos com auxílio de Inteligência Artificial.

## 2. Objetivos Estratégicos

- **Edição Avançada:** Oferecer um editor Rich Text (TinyMCE) modular e segmentado por seções.
- **Gestão de Mídias:** Otimizar o manuseio de imagens locais, garantindo organização e numeração automática de figuras.
- **Automação Inteligente:** Integrar modelos de linguagem (LLMs) para revisão de texto e descrição técnica de evidências fotográficas.
- **Portabilidade de Dados:** Manter a base de dados em SQLite e imagens aparte para fácil backup e eventual sincronização com nuvem.

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

### FR5: Gestão de Ilustrações

- **Inserção de Imagens:** Upload de fotos locais para o diretório do laudo.
- **Legendas Automáticas:** Sistema de numeração sequencial (Figura 1:, Figura 2:) com legendas.
- **Seção de Ilustrações:** Geração automática de uma seção Ilustração se caso o usuario optar pelo uso de inserçao automática de figuras no laudo.

### FR6: Sistema de Placeholders

- **Substituição Dinâmica:** Uso de tags como `{{numero_rep}}` e `{{perito_nome}}` no texto.
- **Placeholders Customizados:** Interface com layout 2-painéis (árvore hierárquica de categorias + DataTable de placeholders) com suporte a subcategorias aninhadas (parent_id), ordenação drag-and-drop, cores e ícones por categoria.
- **Resolução Automática:** Placeholders são automaticamente resolvidos para valores reais antes do envio de texto à IA.

### FR7: Assistente IA

- **Provedores Múltiplos:** Suporte a Groq e Google Gemini como provedores de LLM, selecionáveis pelo usuário na página de configuração (ModelosIAPage) com chaves de API independentes.
- **Melhoria de Texto:** Revisão gramatical e adequação de tom formal técnico com aprovação expressa do perito (sem substituição silenciosa).
- **Descrição de Imagens (Vision):** Uso de modelos de visão (Llama 4 Scout via Groq, Gemini 2.5 Flash/Pro via Google) para sugerir descrições técnicas de fotos de evidências, com conversão dinâmica de imagens locais (`laudo-img://`) para Base64 no backend.
- **Chat IA:** Interface de chat para perguntas livres ao modelo, com respostas inseríveis diretamente na posição do cursor no editor.
- **Privacidade:** Chaves de API configuráveis pelo usuário, armazenamento seguro via criptografia no SQLite local (nunca expostas ao renderer), uso recomendado de email institucional `@policiacientifica.pr.gov.br` para evitar uso dos dados em treinamento de modelos.

### FR8: Exportação e Auditoria

- **Múltiplos Formatos:** Geração de PDF, DOCX (Word) e ODT (LibreOffice).
- **Configuração de PDF:** Personalização de cabeçalho institucional (texto, imagem, alinhamento) e margens da página via páginas dedicadas (CabecalhoPage, MargensPage).
- **Log de Auditoria:** Registro de login, exclusões, backup/restauração e transições de status de REPs e Laudos com snapshot antes/depois na tabela `logs_auditoria`. Logs de sistema em JSON estruturado com filtro por módulo e viewer com abas Sistema/Auditoria.
- **Backup/Restauração:** Ferramenta para exportar e importar o banco de dados e as imagens em um pacote ZIP, com exclusão automática da auditoria e chaves de IA dos backups. Agendamento de backup automático com periodicidade configurável pelo usuário.
- **Sincronização com Google Drive:** Envio de backup completo de forma automática por períodos programados pelo usuário.

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

- **Offline-first:** O sistema deve ser totalmente funcional sem internet (exceto funções de IA e sincronização com google drive).
- **Interface Premium:** Design moderno utilizando Shadcn/ui com suporte a Dark Mode.
- **Performance de Banco:** Queries otimizadas no SQLite para suportar milhares de registros sem lentidão.
- **Segurança:** Criptografia de dados sensíveis e sanitização de entradas para prevenir SQL Injection.

## 6. Stack Tecnológica Proposta

- **Runtime:** Electron (Desktop)
- **Bundler:** Vite
- **Linguagem:** TypeScript
- **Frontend:** React
- **Estilização:** Tailwind CSS + Shadcn/ui
- **Banco de Dados:** SQLite (com better-sqlite3)
- **Editor:** TinyMCE (com Bridge para React)
- **Exportação:** Playwright (PDF) e Docx.js (Word)
- **IA:** Google Generative AI (Gemini) + OpenAI-compatible (Groq)
- **Gerenciamento de Estado:** React hooks + serviços no main process via IPC

## 7. Critérios de Aceite

- O laudo final gerado deve ser idêntico visualmente ao modelo oficial da instituição.
- A migração do banco de dados atual para a nova estrutura não deve resultar em perda de dados.

## 8. Status Atual de Implementação

- **Autenticação e Perfil:** Login local com senha criptografada, setup de primeiro acesso (Nome, Matrícula, Lotação), gerenciamento de perfil com avatar.
- **Cadastros Estruturais:** CRUD completo de Solicitantes, Tipos de Exame e Templates de Laudo com formulários reutilizáveis em quick-create dialogs na tela de REPs.
- **Placeholders:** Layout 2-painéis com árvore hierárquica de categorias (parent_id, drag-and-drop, cores e ícones) e DataTable de placeholders. Placeholders de sistema fixos no cabeçalho do laudo. Resolução automática antes do envio à IA.
- **Editor de Laudos:** TinyMCE independente por seção com menu de contexto para inserção de placeholders. Upload de imagens locais com protocolo `laudo-img://` e numeração automática de figuras. Snapshot das últimas 3 versões salvas.
- **Wizard de Peças:** Modo alternativo de criação de laudos via árvore de perguntas em cascata. Editor visual de wizard (WizardEditorPage), banco de peças com categorias hierárquicas (PecasPage, CategoriasPecasPage), motor de regras condicionais, WizardLaudoPage com stepper e preview em tempo real.
- **Assistente IA:** Suporte a Groq e Google Gemini como provedores com seleção na ModelosIAPage. Revisão gramatical, adequação de tom técnico, descrição de imagens (Vision via Llama 4 Scout e Gemini 2.5 Flash/Pro) com conversão Base64 no backend, chat IA e inserção no cursor. Chaves criptografadas no SQLite (nunca expostas ao renderer).
- **Timeline Dual-Track:** Linha do tempo de trilha dupla (REP + Laudo) com eixo cronológico, conexões direcionais, trilha fantasma e acesso via tabelas de REPs/Laudos e aba dedicada nos Logs.
- **Logs e Auditoria:** Sistema modular com JSON estruturado, viewer com abas Sistema/Auditoria/Timeline, filtro por módulo, registro de transições de status com snapshot antes/depois, exclusão autenticada por senha.
- **Backup/Restauração:** Exportação/importação ZIP com banco + imagens, exclusão automática de auditoria e chaves de IA dos backups, agendamento de backup automático com periodicidade configurável.
- **Configuração de Impressão:** Páginas de Cabeçalho PDF (texto, imagem brasão/logo, alinhamento) e Margens (superior, inferior, esquerda, direita).
- **Dashboard:** Indicadores de REPs pendentes/em andamento/concluídas, produtividade e tabelas com colunas fixas (sticky) para referência.
- **Em desenvolvimento:** Geração de PDF final persistente, exportação DOCX/ODT, apêndice automático de figuras.
