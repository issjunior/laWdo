# Sistema Laudo Pericial PCP

Repositório único contendo a migração do sistema de laudos periciais da Polícia Científica do Paraná.

## 📁 Estrutura do Projeto

```
/
├── src/                      # Código fonte Electron (main/preload/renderer)
├── public/                   # Assets estáticos
├── python/                   # Integração Python (scripts reutilizáveis)
├── laudo-streamlit/          # Versão anterior (Streamlit + Python) - mantida como referência
├── migracao/                 # Documentação e planejamento da migração
└── README.md
```

## 🚀 Projeto Atual: Electron Desktop

Aplicativo desktop para automação de laudos periciais.

**Tecnologias:**

- Electron + Vite + TypeScript
- React + Shadcn/ui
- SQLite (local)
- Node.js (main process)
- Zod (validação)
- Tailwind CSS

### 🔒 Segurança

**Criptografia AES-256-GCM aplicada SOMENTE ao campo `senha` do perito.**

- **Senha do perito:** Criptografada (AES-256-GCM + bcrypt + PBKDF2)
- **Campos de contato (telefone, email, endereço):** NÃO são criptografados - são dados operacionais de uso diário

Essa decisão equilibra proteção de credenciais de acesso com funcionalidade do sistema para dados de contato.

### Comandos de Desenvolvimento

```bash
# Instalação e execução
npm install
npm run dev        # Desenvolvimento (watch + Electron)
npm run build      # Build de produção
npm run start      # Executar build existente

# Qualidade
npm run lint       # Checagem ESLint
npm run lint:fix   # Correção automática
npm run format     # Formatação Prettier
npm run type-check # Checagem de tipos

# Builds individuais
npm run build:main     # Processo principal
npm run build:preload  # Scripts de preload
npm run build:renderer # Frontend React
```

## 📋 Plano de Migração

A migração está organizada em 10 sprints no diretório `migracao/`.

### Sprints Concluídas ✅

1. **Sprint 0 - Fundação e Segurança:** ✅ COMPLETA
   - Infraestrutura Electron
   - Banco SQLite com schema inicial (8 tabelas; hoje 9)
   - Criptografia de senha (AES-256-GCM + bcrypt)
   - Sistema de logs e tratamento de erros
   - IPC bridge segura

2. **Sprint 1 - Arquitetura Base:** ✅ COMPLETA
   - Validação Zod para todas as entidades
   - Handlers IPC e serviços de negócio
   - Integração Shadcn/ui com React Hook Form

3. **Sprint 2 - Cadastros Estruturais:** ✅ COMPLETA
   - Interface Perfil do Perito
   - CRUD Solicitantes (órgãos varas delegacias)
   - CRUD Tipos de Exame
   - Dashboard com estatísticas
   - Tema dark/light com persistência
   - Login obrigatório (AuthPage)

4. **Sprint 3 - Gestão de REPs:** ✅ COMPLETA
   - CRUD completo de Requisições de Exame Pericial
   - Formulário inline com campos condicionais
   - Migration v9

5. **Sprint 5 - Placeholders:** ✅ COMPLETA
   - CRUD de placeholders
   - 22 placeholders do sistema (seed)
   - Sintaxe canônica `{{chave}}`

### Sprints em Andamento

6. **Sprint 4 - Edição de Laudos:** 🔄 PARCIAL
   - Cabeçalho de laudos com editor HTML ✅
   - Integração TinyMCE ⬜
   - Auto-save e versionamento ⬜

### Sprints Pendentes

7. **Sprint 6 - IA Assistiva:** 📋 PENDENTE (Opcional)
   - Integração com APIs Groq e Gemini

8. **Sprint 7 - Exportação Multi-formato:** 📋 PENDENTE
   - PDF, DOCX e ODT

9. **Sprint 8 - Auditoria e Backup:** 📋 PENDENTE

10. **Sprint 9-10 - Performance e Distribuição:** 📋 PENDENTE

## 📊 Status Atual

**Data:** 07 de maio de 2026  
**Status:** ✅ Sprints 0, 1, 2, 3 e 5 completas | 🔄 Sprint 4 parcial  
**Progresso:** ~75% do projeto completo

### Páginas Implementadas (8)

| Página | Rota | Status |
|---|---|---|
| AuthPage (Login) | `/login` | ✅ |
| Dashboard | `/` | ✅ |
| Solicitantes | `/solicitantes` | ✅ |
| Tipos de Exame | `/tipos-exame` | ✅ |
| Cabeçalho | `/cabecalho` | ✅ |
| REPs | `/reps` | ✅ |
| Placeholders | `/placeholders` | ✅ |
| Perfil | `/perfil` | ✅ |

## 📝 Documentação

- `migracao/planejamento_migracao_tecnica.md` - Roadmap técnico detalhado
- `migracao/planejamento_migracao_checklist.md` - Checklist de sprints
- `migracao/progresso_real_atual.md` - Status atualizado do projeto
- `migracao/relatorio_sprint_1.md` - Relatório detalhado da Sprint 1
- `migracao/relatorio_sprint_2.md` - Relatório detalhado da Sprint 2

## 🔄 Reutilização de Código

Abordagem híbrida de migração:

- **Lógica de negócio complexa:** Reutilizada do projeto Streamlit via `child_process`
- **Geradores de documentos:** Compatibilidade mantida
- **Banco de dados:** Schema SQLite compatível
- **UI/UX:** Totalmente redesenhada com Electron + React

## 👥 Equipe

Desenvolvido para a Polícia Científica do Paraná.

## ⚠️ Problemas Conhecidos

Ver [migracao/problemas_conhecidos.md](migracao/problemas_conhecidos.md) para lista atualizada de problemas e soluções.

## 📄 Licença

Uso interno - Polícia Científica do Paraná.

### 🎉 Destaques Técnicos Recentes

- ✅ **8 páginas implementadas:** Dashboard, Auth, Perfil, Solicitantes, TiposExame, Cabeçalho, REPs, Placeholders
- ✅ **7 serviços de negócio:** User, Solicitante, TipoExame, Configuracao, REP, Placeholder + BaseService
- ✅ **6 módulos IPC:** Handlers para todas as entidades implementadas
- ✅ **Build vitorioso:** Compilação TypeScript/Vite 100% funcional
- ✅ **Migração ESM concluída:** Projeto migrado para ECMAScript Modules
- ✅ **Login obrigatório:** AuthPage bloqueia acesso sem autenticação
- ✅ **Tema dark/light:** Persistência de tema com Tailwind CSS
- ✅ **Sidebar colapsável:** Menu com seções agrupadas e navegação por ícones
- ✅ **Placeholders:** 22 placeholders do sistema com sintaxe `{{chave}}`
- ✅ **Validação Zod:** Todos os forms validados com mensagens em português
- ✅ **Segurança robusta:** Criptografia de senha com padrões industriais

## Regra de Acesso (Atualizada em 06/05/2026)
- O laWdo deve abrir apenas para usuario autenticado (login obrigatorio).
