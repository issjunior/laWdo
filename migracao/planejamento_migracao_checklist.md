# 🚀 Planejamento de Migração: Laudo Pericial para Electron (v1)

Este documento detalha o roadmap atualizado de migração para a nova arquitetura desktop. O planejamento foi refinado para incluir suporte a múltiplos formatos de exportação e infraestrutura de segurança avançada.

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
- [x] Banco de dados SQLite com schema completo (8 tabelas).
- [x] Sistema de logs com rotação automática (5MB).
- [x] Arquitetura IPC segura e tipada.
- [x] Configuração de segurança Electron (CSP, headers, sanitização).

### Sprint 1: Arquitetura Base ✅ **COMPLETADA**

**✅ TAREAS CONCLUÍDAS:**

- [x] Validação Zod para todas as 8 entidades.
- [x] Handlers IPC específicos para operações de CRUD (3 entidades principais implementadas).
- [x] Serviços de negócio básicos (user com criptografia de senha, solicitante, tipo-exame).
- [x] Integração Shadcn/ui com React Hook Form + Zod.
- [x] Componentes UI básicos configurados (Button, Card, Input, Label, Form).
- [x] Formulário de Perfil do Perito com validação completa.
- [x] Correções técnicas e melhorias na arquitetura.

**📊 DETALHES:** 
- Schemas Zod criados para todas as entidades
- Handlers IPC para Usuário com criptografia de senha, Solicitante e TipoExame implementados
- Integração completa entre frontend e backend
- Build pipeline functional e testado
- Ver relatório completo em `relatorio_sprint_1.md`

### Sprint 2: Perfil e Cadastros de Apoio ✅ **COMPLETADA**

**✅ TAREAS CONCLUÍDAS:**

- [x] Componentes Shadcn/ui base (Button, Card, Input, Label, Table, Form)
- [x] Página Perfil do Perito com validação Zod
- [x] Página Solicitantes com CRUD completo em tabela
- [x] Página Tipos de Exame com gerenciamento de templates
- [x] Handlers IPC para Usuário (senha criptografada), Solicitante e TipoExame (24 canais)
- [x] Schemas Zod para todas as 8 entidades
- [x] Interface IPC segura com validação no preload
- [x] Sistema de rotas com React Router
- [x] Dashboard avançado com estatísticas (adiantado da Sprint 3)
- [x] Correção de criptografia em campos de contato (telefone/email)

**📊 DETALHES:**
- 4 páginas implementadas (Dashboard, Perfil, Solicitantes, TiposExame)
- 6 componentes Shadcn/ui configurados
- 24 handlers IPC implementados
- Ver relatório completo em `relatorio_sprint_2.md`

### Sprint 3: Gestão de Requisições (REP) 🔄 **EM ANDAMENTO (30%)**

**✅ ITENS ADIANTADOS:**
- [x] Página Dashboard com estatísticas e ações rápidas
- [x] Sistema de rotas configurado para todas as páginas
- [x] Componentes de layout criados (Header, Sidebar, Footer)
- [x] Correção de roteamento: BrowserRouter → HashRouter (compatibilidade Electron)

**⬜ PENDENTES:**
- [ ] Dashboard de REPs com filtros e paginação
- [ ] Fluxo de criação de Nova REP e alteração de Status
- [ ] Páginas REP (Requisição de Exame Pericial)
- [ ] Handlers IPC: `rep.handlers.ts`
- [ ] Service: `rep.service.ts`
- [ ] CRUD completo de REPs
- [ ] Fluxo de atribuição de peritos às REPs
- [ ] Transições de status (Pendente → Em Andamento → Concluído)
- [ ] Integrar páginas com chamadas IPC reais (remover mocks)

### Sprint 4: Núcleo - Edição de Laudos

- [ ] Integração robusta com TinyMCE.
- [ ] **Auto-save** e sistema de **Snapshots** (versões).
- [ ] Suporte a Imagens/Ilustrações locais por laudo.

### Sprint 5: Motor de Placeholders

- [ ] Interpretador de placeholders (Parser).
- [ ] Gerenciamento de **Placeholders Customizados**.

### Sprint 6: Assistência IA (Opcional)

- [ ] Integração com APIs Groq e Gemini.
- [ ] Painel de Assistente IA com ações rápidas de correção e melhoria.

### Sprint 7: Exportação Multi-formato

**Objetivo:** Gerar documentos finais em PDF, Word e ODT.

- [ ] Geração nativa de PDF com imagens.
- [ ] Exportação para **DOCX** (Word).
- [ ] Exportação para **ODT** (Open Document Text).
- [ ] Interface de Pré-visualização de Impressão.

### Sprint 8: Auditoria e Backup

- [ ] Log de Auditoria cronológico e completo.
- [ ] Ferramenta de **Backup/Restauração** (ZIP: BD + Imagens).

### Sprint 9: Performance e UX

- [ ] Otimização de queries e renderização.
- [ ] Implementação de atalhos de teclado e feedback visual fluido.

### Sprint 10: Distribuição e Entrega

- [ ] Refino de design e tema claro/escuro.
- [ ] Geração de instalador `.exe` e versão portátil.
- [ ] Manual completo do usuário e documentação técnica.

---

> [!IMPORTANT]
> **Segurança em Primeiro Lugar:** A proteção dos dados críticos do sistema (especialmente senhas de peritos) é a prioridade zero. Todas as queries devem usar _prepared statements_ e **apenas dados sensíveis devem ser criptografados**.
