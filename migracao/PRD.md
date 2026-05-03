# PRD - Product Requirements Document: Laudo Pericial Desktop (PCP)

## 1. Visão Geral do Produto
O **Laudo Pericial Desktop** é uma evolução do sistema atual baseado em Streamlit para uma aplicação nativa de alta performance utilizando **Electron**. O objetivo é fornecer aos Peritos Criminais da Polícia Científica uma ferramenta robusta, offline-first, para a gestão de Requisições de Exame Pericial (REP) e a elaboração de laudos técnicos com auxílio de Inteligência Artificial.

## 2. Objetivos Estratégicos
- **Performance Nativa:** Eliminar o lag de renderização do Streamlit, proporcionando uma interface instantânea.
- **Edição Avançada:** Oferecer um editor Rich Text (TinyMCE) modular e segmentado por seções.
- **Gestão de Mídias:** Otimizar o manuseio de imagens locais, garantindo organização e numeração automática de figuras.
- **Automação Inteligente:** Integrar modelos de linguagem (LLMs) para revisão de texto e descrição técnica de evidências fotográficas.
- **Portabilidade de Dados:** Manter a base de dados em SQLite para fácil backup e eventual sincronização com nuvem.

## 3. Público-Alvo
- Peritos Oficiais Criminais da Polícia Científica do Paraná.

## 4. Requisitos Funcionais (FR)

### FR1: Gestão de Acesso e Perfil
- **Fluxo de Primeiro Acesso:** Configuração inicial de dados do perito (Nome, Matrícula, Lotação).
- **Autenticação Local:** Login com usuário e senha criptografada.
- **Perfil do Usuário:** Gerenciamento de dados institucionais e configuração de pastas de exportação.

### FR2: Cadastros Estruturais
- **Solicitantes:** Cadastro de Delegacias, Varas e outros órgãos requisitantes.
- **Tipos de Exame:** Definição de categorias de perícia (Ex: Homicídio, Trânsito).
- **Templates de Laudo:** Criação de modelos reutilizáveis com seções pré-definidas (Preâmbulo, Histórico, Exames, Conclusão).

### FR3: Gestão de REPs (Requisição de Exame Pericial)
- **Registro de REP:** Captura de dados de acionamento, envolvidos, lacres de entrada/saída e localização.
- **Controle de Prazos:** Dashboard com indicadores de REPs pendentes, em andamento e atrasadas.
- **Histórico de Status:** Rastreamento do ciclo de vida da requisição (Pendente -> Em Andamento -> Concluído).

### FR4: Editor de Laudos (O Coração do Sistema)
- **Estrutura Modular:** Edição do laudo dividida por seções independentes baseadas no template.
- **Rich Text Editor:** Suporte a formatação avançada, tabelas e listas via TinyMCE.
- **Auto-save:** Salvamento automático no SQLite a cada 30 segundos.
- **Snapshots:** Histórico das últimas 3 versões salvas para recuperação de desastres.

### FR5: Gestão de Ilustrações
- **Inserção de Imagens:** Upload de fotos locais para o diretório do laudo.
- **Legendas Automáticas:** Sistema de numeração sequencial (Figura 1, Figura 2...) com legendas obrigatórias.
- **Apêndice de Figuras:** Geração automática de uma seção final contendo todas as imagens do laudo.

### FR6: Sistema de Placeholders
- **Substituição Dinâmica:** Uso de tags como `{{numero_rep}}` e `{{perito_nome}}` no texto.
- **Placeholders Customizados:** Interface para o usuário definir termos próprios.

### FR7: Assistente IA
- **Melhoria de Texto:** Revisão gramatical e adequação de tom formal técnico.
- **Descrição de Imagens (Vision):** Uso de modelos de visão para sugerir descrições técnicas de fotos de evidências.
- **Privacidade:** Chaves de API configuráveis pelo usuário e armazenamento seguro.

### FR8: Exportação e Auditoria
- **Múltiplos Formatos:** Geração de PDF, DOCX (Word) e ODT (LibreOffice).
- **Log de Auditoria:** Registro detalhado de quem, quando e o que foi alterado em cada laudo.
- **Backup/Restauração:** Ferramenta para exportar e importar o banco de dados e as imagens em um pacote ZIP.

## 5. Requisitos Não Funcionais (NFR)
- **Offline-first:** O sistema deve ser totalmente funcional sem internet (exceto funções de IA).
- **Interface Premium:** Design moderno utilizando Shadcn/ui com suporte a Dark Mode.
- **Performance de Banco:** Queries otimizadas no SQLite para suportar milhares de registros sem lentidão.
- **Segurança:** Criptografia de dados sensíveis e sanitização de entradas para prevenir SQL Injection.

## 6. Stack Tecnológica Proposta
- **Runtime:** Electron (Desktop)
- **Bundler:** Vite
- **Linguagem:** TypeScript
- **Frontend:** React
- **Estilização:** Tailwind CSS + Shadcn/ui
- **Banco de Dados:** SQLite (com Prisma ou Kysely)
- **Editor:** TinyMCE (com Bridge para React)
- **Exportação:** Playwright (PDF) e Docx.js (Word)

## 7. Critérios de Aceite
- O laudo final gerado deve ser idêntico visualmente ao modelo oficial da instituição.
- A migração do banco de dados atual para a nova estrutura não deve resultar em perda de dados.
