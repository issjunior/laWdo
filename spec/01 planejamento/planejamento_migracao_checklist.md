# 🚀 Planejamento de Migração: Laudo Pericial para Electron (v1)

Este documento detalha o roadmap de migração para a nova arquitetura desktop e o estado atual de cada funcionalidade.

> **Última atualização:** 13/06/2026 — Schema v24, 37 placeholders de sistema, GDL, Wizards, Timeline, Gemini IA.

---

## 🏗️ Stack Tecnológica Definida

- **Framework Desktop:** Electron + Vite + TypeScript
- **Frontend:** React com TypeScript
- **Backend:** Node.js (Electron Main Process)
- **Banco de Dados:** SQLite (`app.getPath('userData')`, schema v24)
- **Editor de Texto:** TinyMCE (Rich Text Editor)
- **Exportação:** Preview PDF via `webContents.printToPDF()` (Electron nativo), importação DOCX/PDF (mammoth + unpdf)
- **Segurança:** Criptografia via `safeStorage` do Electron (chaves IA), bcrypt + PBKDF2 (senhas), validação de entrada, prepared statements
- **IA/LLM:** Groq SDK + Google Gemini (chaves criptografadas via `safeStorage`)
- **Logs e Auditoria:** Rotação de arquivos com limite de 5 MB, página `LogsPage` dedicada

---

## 🔒 Nota Importante sobre Criptografia

**CRÍTICO:** A criptografia é aplicada de forma seletiva:
- **`safeStorage` do Electron** (`encrypt`/`decrypt`/`isAvailable`): chaves de API IA (`api_key_groq`, `api_key_gemini`) e credenciais GDL — migration v24 migrou chaves existentes do SQLite para `safeStorage`.
- **bcrypt + PBKDF2**: campo `senha_hash` da tabela `users` (credenciais do perito).
- **Campos NÃO criptografados:** `telefone`, `email`, `endereco` e demais dados de exibição.

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
- [x] Implementar criptografia de **senha do usuário** (bcrypt + PBKDF2).
- [x] Sistema de validação de entrada e proteção contra injeção SQL.
- [x] Página de **Tratamento de Erros e Recuperação** (ErrorBoundary React).
- [x] Banco de dados SQLite com schema inicial (8 tabelas; expandido para **24 migrations** até v24).
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


### Sprint 3: Gestão de Requisições (REP) ✅ **COMPLETADA**

**✅ TAREFAS CONCLUÍDAS:**

- [x] Página REPs com CRUD completo
- [x] Formulário inline na tabela
- [x] Campo `tipo_solicitacao` com dados condicionais por `eh_local`
- [x] Data padrão de hoje no formulário
- [x] Migration v9 (tabela reps)
- [x] Service `rep.service.ts`
- [x] Handlers IPC `rep.handlers.ts`
- [x] 22 placeholders base do sistema mapeados (expandidos para 37 no Sprint 5 com campos específicos de exame)
- [x] Seção "Requisições (REPs)" no menu lateral
- [x] Integração com validação Zod

**📊 DETALHES:**
- Página com tabela e formulário inline
- Campos condicionais baseados no tipo de solicitante


### Sprint 4: Núcleo - Edição de Laudos 🔄 **PARCIAL**

**✅ CONCLUÍDO:**

- [x] Página Cabeçalho de Laudos (`CabecalhoPage`)
- [x] Editor HTML com suporte a placeholders
- [x] Tabela `configuracoes` (migration v8)
- [x] Service `configuracao.service.ts`
- [x] Handlers IPC `configuracao.handlers.ts`
- [x] Página Laudos (`LaudosPage`) com editor multi-seção
- [x] Integração TinyMCE: plugins completos, toolbar em 2 linhas, modo floating responsivo
- [x] Suporte a Ilustrações via painel inline/pop-out (`IlustracoesPanel` / `IlustracoesPanelWindow`) com upload, thumbnails, lightbox, legendas inline
- [x] Drag-and-drop para reordenação de figuras (via `@dnd-kit`)
- [x] Scroll-sync entre editor e painel de ilustrações (`IntersectionObserver`)
- [x] Comandos TinyMCE: `insertLaudoImage`, `removeLaudoImage`, `replaceLaudoImage`, `reindexFiguras`, `scanAndWrapImages`
- [x] Numeração automática de figuras (`Figura 01:`, `Figura 02:` etc.)
- [x] Seção ILUSTRAÇÕES dinâmica (criada/removida conforme figuras no editor)
- [x] Protocolo customizado `laudo-img://` para servir imagens locais
- [x] Serviço `imagem.service.ts` + handlers `imagem.handlers.ts`
- [x] CSP atualizado com `laudo-img:`
- [x] Preview interno de PDF para laudos e templates via handler `template:previewPDF`
- [x] Página de Margens (`MargensPage`) e cabeçalho customizado para PDF
- [x] Máquina de estados completa: `Em andamento → Concluído → Entregue`
- [x] Exclusão de laudos finalizados com senha
- [x] Pop-out de ilustrações em janela separada (IPC Electron)

**⬜ PENDENTES:**

- [ ] **Snapshots** do Laudo (versões) no máximo 3 (três).
- [ ] Geração nativa de PDF final com imagens e persistência em disco.
- [ ] Exportação para **DOCX** (Word).
- [ ] Exportação para **ODT** (Open Document Text).

> **Nota:** Migration v14 (`imagens_laudo`) foi **pulada** (o schema vai de v13 direto para v15). Imagens são armazenadas como data URIs inline no HTML do editor.

### Sprint 5: Motor de Placeholders ✅ **COMPLETADA**

- [x] CRUD de placeholders (página `PlaceholdersPage`)
- [x] 37 placeholders do sistema (22 base + 15 campos específicos de exame) — seed via `placeholder.service.ts`
- [x] Schema alinhado com sintaxe `{{chave}}` como padrão canônico
- [x] Categorias hierárquicas de placeholders com subcategorias via `parent_id` (migration v22)
- [x] 8 categorias de sistema + categorias dinâmicas de exame (I-801, B-602)
- [x] Instruções visuais colapsáveis com antes/depois
- [x] Service `placeholder.service.ts` + `categoria-placeholder.service.ts`
- [x] Handlers IPC `placeholder.handlers.ts`
- [x] Menu suspenso no editor para inserção rápida de placeholders (comando TinyMCE)
- [x] Resolução automática de placeholders para valores reais da REP antes de consultas IA

### Sprint 6: Assistência IA ✅ **COMPLETADA**

- [x] Página `ModelosIAPage` com suporte a múltiplos provedores.
- [x] **Groq** integrado (modelo `meta-llama/llama-4-scout-17b-16e-instruct`).
- [x] **Google Gemini** integrado como segundo provedor (modelos `gemini-2.5-flash` e `gemini-2.5-pro`).
- [x] Seleção de provedor e modelo na `ModelosIAPage`.
- [x] Chaves de API criptografadas via `safeStorage` do Electron (migration v24).
- [x] Handlers de IA: revisão, adequação, descrição de imagens e perguntas livres.
- [x] Painel de assistente integrado ao editor (`AISheet`).
- [x] Ferramenta de revisão rápida via toolbar (`AISectionToolbar`).
- [x] Consentimento do usuário na `AISheet` antes de aplicar ações de IA.
- [x] Resolução automática de placeholders antes de consultar LLMs.
- [x] Suporte a descrever fotos locais (`laudo-img://`) convertendo para Base64 no backend.
- [x] Inserção inteligente de respostas da IA no local do cursor no editor.

### Sprint 7: Exportação Multi-formato 🔄 **PARCIAL** — [Ver plano detalhado](../03%20laudo/exportar_laudo.md)

**Objetivo:** Gerar documentos finais em PDF, Word e ODT.

- [x] Preview interno de PDF via `webContents.printToPDF()` do Electron com margens e cabeçalho customizados.
- [x] Interface de Pré-visualização de Impressão (dialog com iframe Blob URL).
- [x] Importação de PDF e DOCX para templates (via `mammoth` + `unpdf`).
- [x] Detecção automática de seções periciais (PREAMBULO, HISTORICO, CONCLUSAO, etc.) na importação.
- [ ] Geração nativa de PDF final com imagens e persistência em disco. *(Planejado: `printToPDF` + `showSaveDialog`)*
- [ ] Exportação para **DOCX** (Word). *(Planejado: `docx` npm + parser DOM nativo no renderer)*
- [ ] Exportação para **ODT** (Open Document Text). *(Planejado: `libreoffice-convert`, requer LibreOffice)*

### Sprint 8: Auditoria e Backup ✅ **COMPLETADA**

- [x] Log de Auditoria cronológico e completo com interface visual (`LogsPage`).
- [x] Ferramenta de **Backup/Restauração** (ZIP: BD + Imagens) com agendamento.
- [x] Backup/restauração via IPC com pacote ZIP e importação de imagens.
- [x] Página `BackupPage` para gestão de arquivos de segurança.
- [x] Exclusão automática de auditoria e chaves IA dos backups.
- [x] Backup pré-restauração automático (`pre_restore_{timestamp}.db`).
### Sprint 9: Integração GDL ✅ **COMPLETADA** (não prevista no roadmap original)

- [x] Página `GdlConfigPage` com cards Homologação/Produção e toggle de senha.
- [x] Service `gdl.service.ts` — chamadas HTTPS à API REST GDL (`testarConexao`, `consultarRep`).
- [x] Handlers IPC `gdl.handlers.ts` — canais `gdl:testar-conexao` e `gdl:consultar-rep`.
- [x] Modal `GdlConsultaModal` — wizard 2 passos (buscar → revisar → aplicar) para preenchimento automático de REP.
- [x] Credenciais criptografadas via `safeStorage` do Electron.
- [x] Suporte a homologação e produção com credenciais separadas.
- [x] Integração na `REPsPage`: botão "GDL", campos preenchidos com fundo verde, banner de status.
- [x] Somente leitura: apenas métodos `GET`, `HEAD`, `OPTIONS`.

### Sprint 10: Wizards e Banco de Peças ✅ **COMPLETADA** (não prevista no roadmap original)

- [x] 4 páginas novas: `WizardsPage`, `WizardEditorPage`, `WizardLaudoPage`, `PecasPage`, `CategoriasPecasPage`.
- [x] 6 tabelas novas (migration v20): `wizards`, `etapas_wizard`, `opcoes_etapa`, `pecas`, `regras_wizard`, `respostas_wizard`.
- [x] Categorização hierárquica de peças com subcategorias (migration v21).
- [x] Motor de matching condicional para determinar peças conforme respostas.
- [x] Árvore de decisões em cascata com preview em tempo real.
- [x] Componente `SortableCategoryTree` com drag-and-drop para ordenação.
- [x] Services: `wizard.service.ts`, `peca.service.ts`, `regra-wizard.service.ts`.
- [x] Handlers IPC: `wizard.handlers.ts` (8 canais), `peca.handlers.ts` (8 canais), `regra-wizard.handlers.ts` (3 canais).
- [x] Histórico de interações wizard ↔ laudos (tabela `respostas_wizard`, colunas `wizard_id` e `respostas_wizard` em `laudos`).

### Sprint 11: Timeline e Ciclo de Vida ✅ **COMPLETADA** (não prevista no roadmap original)

- [x] Componente `DualTrackTimeline` — linha do tempo de trilha dupla (REP azul + Laudo violeta).
- [x] Conexões direcionais entre eventos, trilha fantasma para períodos sem laudo.
- [x] `RepTimelineDialog` — acesso via ícone na tabela de REPs, Laudos, e aba na `LogsPage`.
- [x] Estilos completos com animações, dots coloridos, gradientes em `globals.css`.
- [x] Máquina de estados do laudo: `Em andamento → Concluído → Entregue`.
- [x] Exclusão com senha para laudos finalizados.
- [x] Auditoria de transições com snapshot antes/depois.
- [x] Página de histórico `HistoricoRepLaudosPage` (aba em REPsPage).

### Sprint 12: Design e Tema ✅ **COMPLETADA** (antigo Sprint 10, antecipado)

- [x] Design tokens completos em `globals.css` (1671 linhas).
- [x] Tema claro com paleta azul-slate (variáveis CSS `:root`).
- [x] Tema escuro com paleta navy profundo (variáveis CSS `.dark`, +400 linhas de overrides).
- [x] Sidebar com gradiente navy, animações de collapse.
- [x] Header com gradiente sutil, cards com sombras elevadas.
- [x] Badges de status com cores semânticas (âmbar/verde/azul).
- [x] Scrollbar customizada em ambos temas.
- [x] Componentes shadcn/ui (New York, base Zinc, ícones Lucide, 24 componentes).

### Sprint 13: Performance e UX

- [ ] Otimização de queries e renderização (índices, `React.memo`, virtualização de listas).
- [ ] Implementação de atalhos de teclado globais (salvar Ctrl+S, navegação, tema, inserir placeholder).
- [ ] Lazy loading de imagens no editor.

### Sprint 14: Distribuição e Entrega

- [ ] Geração de instalador `.exe` (electron-builder configurado em `electron-builder.yml`, NSIS target x64).
- [ ] Manual completo do usuário e documentação técnica.

---

> [!IMPORTANT]
> **Segurança em Primeiro Lugar:** A proteção dos dados críticos do sistema (especialmente senhas de peritos) é a prioridade zero. Todas as queries devem usar _prepared statements_ e **apenas dados sensíveis devem ser criptografados**.

## Regras de Negócio e Escopo (Atualizado em 13/06/2026)

- [x] Login obrigatório para abrir o sistema (AuthPage).
- [x] Renderer bloqueia acesso ao layout principal sem sessão autenticada.
- [x] Autenticação ocorre antes da exibição do layout principal.
- [x] Placeholders usam sintaxe canônica `{{chave}}`.
- [x] Seções de instrução nas páginas iniciam recolhidas.
- [x] Todos os serviços estendem `BaseService` (padrão de herança).
- [x] Backup em formato ZIP inclui banco de dados e arquivos de mídia.
- [x] Chaves de API IA e credenciais GDL criptografadas via `safeStorage` do Electron.
- [x] Somente leitura na API GDL (apenas `GET`, `HEAD`, `OPTIONS`).
- [x] Snapshots de auditoria nas transições de status (antes/depois).
- [x] Laudos aceitam múltiplos por REP (tabela `laudos` sem UNIQUE em `rep_id` desde v20).
- [x] Wizards e peças com motor de matching condicional.
- [x] Timeline dual-track REP + Laudo com conexões direcionais.

## Resumo do Schema (v24)

| Versão | Descrição |
|--------|-----------|
| v1 | Schema inicial (8 tabelas: `users`, `solicitantes`, `tipos_exame`, `reps`, `laudos`, `templates`, `placeholders`, `configuracoes`) |
| v2–v7 | Refinamentos de colunas (`ativo`, `codigo`, `eh_local`, `lotacao`, `senha_hash`, etc.) |
| v8 | Tabela `configuracoes` expandida |
| v9 | Expandir colunas `reps` (16 campos) |
| v10–v13 | Ajustes em `reps`, `templates`, `laudos` |
| v14 | **PULADA** — `imagens_laudo` nunca criada |
| v15 | Tabela `categorias_placeholders` + migração de chaves |
| v16 | Garantir 8 categorias de sistema |
| v17 | `campos_especificos` em `reps` |
| v18 | Coluna `foto_url` em `users` |
| v19 | Expandir `logs_auditoria` |
| v20 | Wizards + Banco de Peças (6 tabelas novas) |
| v21 | Categorização de peças |
| v22 | `parent_id` em `categorias_placeholders` (subcategorias) |
| v23 | Remover colunas nativas redundantes de `reps` |
| v24 | Migrar API keys IA para `safeStorage` |

