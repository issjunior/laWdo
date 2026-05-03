# 🚀 Planejamento de Migração: Laudo Pericial para Electron (v1)

Este documento detalha o roadmap atualizado de migração para a nova arquitetura desktop. O planejamento foi refinado para incluir suporte a múltiplos formatos de exportação e infraestrutura de segurança avançada.

---

## 🏗️ Stack Tecnológica Definida

*   **Framework Desktop:** Electron + Vite + TypeScript
*   **Frontend:** React com TypeScript
*   **Backend:** Node.js (Electron Main Process)
*   **Banco de Dados:** SQLite (armazenamento local)
*   **Editor de Texto:** TinyMCE (Rich Text Editor)
*   **Exportação:** `electron-pdf` (PDF), `docx` (Word) e `odt` (Open Document)
*   **Segurança:** Criptografia de dados sensíveis, validação de entrada, proteção contra injeção SQL
*   **Logs e Auditoria:** Rotação de arquivos com limite de 5 MB

---

## 🔄 Ciclo de Vida e Estados (Regras de Negócio)

*   **REP (Requisição de Exame Pericial):** `Pendente`, `Em Andamento`, `Concluído`
*   **Laudo:** `Em andamento`, `Concluído`, `Entregue`
*   > [!NOTE]
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

### Sprint 0: Fundação e Segurança Crítica
- [ ] Inicializar projeto Electron + Vite + TypeScript.
- [ ] Implementar criptografia de dados sensíveis.
- [ ] Camada de validação de entrada e proteção contra injeção SQL.
- [ ] Página de **Tratamento de Erros e Recuperação**.

### Sprint 1: Arquitetura Base
- [ ] Banco de dados SQLite com migrations automáticas.
- [ ] Schema inicial (users, reps, laudos, etc.).
- [ ] Padrão de IPC tipado com TypeScript.

### Sprint 2: Perfil e Cadastros de Apoio
- [ ] Perfil do Perito (Nome, Cargo, Matrícula, Lotação).
- [ ] CRUD de **Solicitantes** e **Modelos de Cabeçalho**.
- [ ] Gerenciamento de **Templates de Exame**.

### Sprint 3: Gestão de Requisições (REP)
- [ ] Dashboard de REPs com filtros e paginação.
- [ ] Fluxo de criação de Nova REP e alteração de Status.

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
> **Segurança em Primeiro Lugar:** A proteção dos dados dos laudos e do perito é a prioridade zero. Todas as queries devem usar *prepared statements* e dados sensíveis devem ser criptografados.
