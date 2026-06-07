# 🚀 Planejamento de Migração: Laudo Pericial para Electron (v1)

Este documento detalha o roadmap atualizado de migração para a nova arquitetura desktop. O planejamento foi refinado para incluir suporte a múltiplos formatos de exportação, infraestrutura de segurança avançada, integração com IA (Groq) e sistema de backup/restauração robusto.

---

## 🏗️ Stack Tecnológica Definida

- **Framework Desktop:** Electron + Vite + TypeScript
- **Frontend:** React com TypeScript
- **Backend:** Node.js (Electron Main Process)
- **Banco de Dados:** SQLite (armazenamento local)
- **Editor de Texto:** TinyMCE (Rich Text Editor)
- **Exportação:** `electron-pdf` (PDF), `docx` (Word) e `odt` (Open Document)
- **Segurança:** Criptografia de dados sensíveis, validação de entrada, proteção contra injeção SQL
- **Logs e Auditoria:** Rotação de arquivos com limite de 5 MB

---

## 🔒 Nota Importante sobre Criptografia

**CRÍTICO:** A criptografia AES-256-GCM é aplicada **SOMENTE** aos dados mais sensíveis do sistema:
- **Campos criptografados:** `senha` da tabela `users` (credenciais do perito)
- **Campos NÃO criptografados:** `telefone`, `email`, `endereco` e demais dados de exibição

Essa decisão de segurança equilibra **proteção de dados críticos** com **funcionalidade do sistema**. Campos de contato e endereço são acessíveis apenas para autenticação do perito e armazenamento seguro de seus dados cadastrais, não são informações confidenciais que exigem criptografia.

---

## 🔄 Ciclo de Vida e Estados (Regras de Negócio)

- **REP (Requisição de Exame Pericial):** `Pendente`, `Em Andamento`, `Concluído`
- **Laudo:** `Em andamento`, `Concluído`, `Entregue`
- > [!NOTE]
  > O laudo já "nasce" com status de **Em andamento** ao ser vinculado a uma REP.

---

---

## 🛠️ Ferramentas de Desenvolvimento

### Skill de Referência de Migração
**Descrição:** Ferramenta auxiliar para consulta do projeto legado (`laudo-streamlit/`) durante a migração.

**Uso:** Quando implementar funcionalidades, use `Skill("skill-referencia-migracao")` para:
1. Localizar implementações equivalentes no projeto legado
2. Entender a lógica de negócio existente
3. Adaptar para a nova arquitetura Electron/TypeScript/React
4. Preserver funcionalidades sem copiar código diretamente

**Recursos disponíveis:**
- Mapa estrutural completo do legado
- Localização de todas as páginas e componentes
- Banco de dados e queries existentes
- Templates e modelos de documentos

**Quando usar:** Todo desenvolvimento de novas funcionalidades para garantir nenhuma feature seja perdida na migração.

---

## 📁 Estrutura de Diretórios Recomendada

```text
projeto/
├── src/
│   ├── main/                    # Electron Main Process (Backend)
│   │   ├── index.ts
│   │   ├── database/            # SQLite e operações de BD
│   │   ├── ipc/                 # Handlers IPC
│   │   ├── security/            # Criptografia e validação
│   │   ├── services/            # Lógica de negócio
│   ├── preload/                 # Preload scripts (Bridge IPC)
│   ├── renderer/                # React Frontend (App.tsx, components, pages)
│   └── shared/                  # Tipos e constantes compartilhadas
├── public/
│   ├── images/                  # Imagens dos laudos (armazenadas localmente)
├── python/                      # Scripts Python reutilizáveis (opcional)
└── package.json
```

---

## 🗓️ Roadmap de Sprints

### Sprint 0: Fundação e Segurança Crítica ✅ **COMPLETADA**

- [x] Inicializar projeto Electron + Vite + TypeScript.
- [x] Implementar criptografia de **senha do usuário** (AES-256-GCM + bcrypt + PBKDF2).
- [x] Sistema de validação de entrada e proteção contra injeção SQL.
- [x] Página de **Tratamento de Erros e Recuperação** (ErrorBoundary React).
- [x] Banco de dados SQLite com schema inicial (8 tabelas; 9 após migrations v1→v9).
- [x] Sistema de logs com rotação automática (5MB).
- [x] Arquitetura IPC segura e tipada.
- [x] Configuração de segurança Electron (CSP, headers, sanitização).

### Sprint 1: Arquitetura Base ✅ **COMPLETADA**

**✅ TAREFAS CONCLUÍDAS:**

- [x] Validação Zod para todas as entidades.
- [x] Handlers IPC específicos para operações de CRUD (8 entidades implementadas).
- [x] Serviços de negócio (user, solicitante, tipo-exame, configuracao, rep, placeholder, template, laudo).
- [x] Integração Shadcn/ui com React Hook Form + Zod.
- [x] Componentes UI básicos configurados (Button, Card, Input, Label, Form, Table, Dialog).
- [x] Formulário de Perfil do Perito com validação completa.
- [x] Correções técnicas e melhorias na arquitetura.
- [x] Migração para ECMAScript Modules (ESM).

**📊 DETALHES:** 
- Schemas Zod criados para todas as entidades
- 8 módulos de handlers IPC implementados
- Integração completa entre frontend e backend
- Build pipeline funcional e testado
- Ver relatório completo em `relatorio_sprint_1.md`

### Sprint 2: Perfil e Cadastros de Apoio ✅ **COMPLETADA**

**✅ TAREFAS CONCLUÍDAS:**

- [x] Componentes Shadcn/ui base (Button, Card, Input, Label, Table, Form)
- [x] Página Perfil do Perito com validação Zod
- [x] Página Solicitantes com CRUD completo em tabela e toggle ativo/inativo
- [x] Página Tipos de Exame com gerenciamento de templates, campo eh_local e toggle
- [x] Handlers IPC para Usuário (senha criptografada), Solicitante e TipoExame
- [x] Schemas Zod para todas as entidades
- [x] Interface IPC segura com validação no preload
- [x] Sistema de rotas com HashRouter
- [x] Dashboard avançado com estatísticas
- [x] Tema dark/light com persistência
- [x] Login obrigatório (AuthPage) antes do layout principal
- [x] Sidebar colapsável com seções agrupadas

**📊 DETALHES:**
- 4 páginas base implementadas (Dashboard, Perfil, Solicitantes, TiposExame)
- Componentes Shadcn/ui configurados
- Múltiplos handlers IPC implementados
- Ver relatório completo em `relatorio_sprint_2.md`

### Sprint 3: Gestão de Requisições (REP) ✅ **COMPLETADA**

**✅ TAREFAS CONCLUÍDAS:**

- [x] Página REPs com CRUD completo
- [x] Formulário inline na tabela
- [x] Campo `tipo_solicitacao` com dados condicionais por `eh_local`
- [x] Data padrão de hoje no formulário
- [x] Migration v9 (tabela reps)
- [x] Service `rep.service.ts`
- [x] Handlers IPC `rep.handlers.ts`
- [x] 22 placeholders do sistema mapeados
- [x] Seção "Requisições (REPs)" no menu lateral
- [x] Integração com validação Zod

**📊 DETALHES:**
- Página com tabela e formulário inline
- Campos condicionais baseados no tipo de solicitante
- Ver relatório completo em `relatorio_sprint_3.md`

### Sprint 4: Núcleo - Edição de Laudos 🔄 **PARCIAL**

**✅ CONCLUÍDO:**

- [x] Página Cabeçalho de Laudos (`CabecalhoPage`)
- [x] Editor HTML com suporte a placeholders
- [x] Tabela `configuracoes` (migration v8)
- [x] Service `configuracao.service.ts`
- [x] Handlers IPC `configuracao.handlers.ts`
- [x] Menu em Cadastros
- [x] Página Laudos (`LaudosPage`) com editor multi-seção (09/05/2026)
- [x] Integração TinyMCE: plugins completos, toolbar em 2 linhas, modo floating responsivo (09/05/2026)
- [x] Suporte a Imagens/Ilustrações locais por laudo via diálogo nativo Electron (09/05/2026)
- [x] Protocolo customizado `laudo-img://` para servir imagens locais (09/05/2026)
- [x] Serviço `imagem.service.ts` + handlers `imagem.handlers.ts` (09/05/2026)
- [x] Migration v14: tabela `imagens_laudo` (09/05/2026)
- [x] CSP atualizado com `laudo-img:` (09/05/2026)
- [x] Preview interno de PDF para laudos e templates via handler `template:previewPDF`.

**⬜ PENDENTES:**

- [ ] **Snapshots** do Laudo (versões) no máximo 3 (três).
- [ ] Painel lateral de gestão de imagens.
- [ ] Drag-and-drop para reordenação de figuras.
- [ ] Geração automática de seção "Figuras".

### Sprint 5: Motor de Placeholders ✅ **COMPLETADA**

- [x] CRUD de placeholders (página `PlaceholdersPage`)
- [x] 22 placeholders do sistema (seed)
- [x] Schema alinhado com sintaxe `{{chave}}` como padrão canônico
- [x] Instruções visuais colapsáveis com antes/depois
- [x] Service `placeholder.service.ts`
- [x] Handlers IPC `placeholder.handlers.ts`
- [x] Menu em Cadastros

**⬜ PENDENTE (para Sprint 4):**

- [x] Menu suspenso no editor para inserção rápida de tags (placeholders inseridos via comando TinyMCE)

### Sprint 6: Assistência IA ✅ **COMPLETADA**

- [x] Página `ModelosIAPage` e configuração de chave Groq para IA.
- [x] Handlers de IA implementados para revisão, adequação, descrição de imagens e perguntas livres.
- [x] Painel de assistente integrado ao editor de laudos (`AISheet`).
- [x] Ferramenta de revisão rápida via toolbar no editor.
- [x] Todas as ações de IA (revisar/adequar) passam por consentimento do usuário na `AISheet` antes de aplicar.
- [x] Resolução automática de placeholders para valores reais da REP antes de consultar as LLMs.
- [x] Suporte para descrever fotos locais (`laudo-img://`) convertendo-as dinamicamente para Base64 no backend.
- [x] Migração de modelo vision descontinuado para o novo e ativo `meta-llama/llama-4-scout-17b-16e-instruct`.
- [x] Inserção inteligente de descrições e respostas da IA diretamente no local do cursor no editor Rich Text.

### Sprint 7: Exportação Multi-formato

**Objetivo:** Gerar documentos finais em PDF, Word e ODT.

- [x] Preview interno de PDF via handler Electron `template:previewPDF`.
- [ ] Geração nativa de PDF final com imagens e persistência.
- [ ] Exportação para **DOCX** (Word).
- [ ] Exportação para **ODT** (Open Document Text).
- [x] Interface de Pré-visualização de Impressão.

### Sprint 8: Auditoria e Backup ✅ **COMPLETADA**

- [x] Log de Auditoria cronológico e completo com interface visual (`LogsPage`).
- [x] Ferramenta de **Backup/Restauração** (ZIP: BD + Imagens).
- [x] Backup/restauração via IPC com pacote ZIP e importação de imagens.
- [x] Página `BackupPage` para gestão fácil de arquivos de segurança.
### Sprint 9: Performance e UX

- [ ] Otimização de queries e renderização.
- [ ] Implementação de atalhos de teclado e feedback visual fluido.

### Sprint 10: Distribuição e Entrega

- [ ] Refino de design e tema claro/escuro.
- [ ] Geração de instalador `.exe`.
- [ ] Manual completo do usuário e documentação técnica.

---

> [!IMPORTANT]
> **Segurança em Primeiro Lugar:** A proteção dos dados críticos do sistema (especialmente senhas de peritos) é a prioridade zero. Todas as queries devem usar _prepared statements_ e **apenas dados sensíveis devem ser criptografados**.

## Regras de Negócio e Escopo (Atualizado em 12/05/2026)

- [x] Login obrigatório para abrir o sistema (AuthPage).
- [x] Renderer bloqueia acesso ao layout principal sem sessão autenticada.
- [x] Autenticação ocorre antes da exibição do layout principal.
- [x] Placeholders usam sintaxe canônica `{{chave}}`.
- [x] Seções de instrução nas páginas iniciam recolhidas.
- [x] Todos os serviços estendem `BaseService` (padrão de herança).
- [x] Backup em formato ZIP inclui banco de dados e arquivos de mídia.

