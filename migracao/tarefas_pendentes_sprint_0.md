# Tarefas Pendentes - Sprint 0

## 🎯 **PRIORIDADE ALTA (concluir primeiro)**

### 1. Configurar Conexão SQLite Funcionando
- [ ] **Implementar driver SQLite3 no main process**
  - Arquivo: `src/main/database/index.ts`
  - Testar conexão básica
  - Criar função `getConnection()`
- [ ] **Criar tabela de teste**
  - SQL básico: `CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)`
  - Testar INSERT/SELECT
- [ ] **Integrar com sistema IPC**
  - Adicionar handlers para queries básicas
  - Testar do renderer process

### 2. Execução Completa do Electron
- [ ] **Testar `npm run dev` completamente**
  ```bash
  npm run dev
  # Verificar se:
  # 1. Electron abre janela
  # 2. React frontend carrega
  # 3. IPC funciona (ping, logs)
  # 4. Console não mostra erros
  ```
- [ ] **Corrigir eventuais problemas**
  - Caminhos de assets
  - Configurações de dev server
  - Permissões do sistema

## 🎯 **PRIORIDADE MÉDIA**

### 3. Schema Básico do Banco de Dados
- [ ] **Analisar schema do projeto Streamlit**
  ```bash
  # Examinar laudo-streamlit/laudopericial.db
  # Usar: sqlite3 laudopericial.db .schema
  ```
- [ ] **Criar schema inicial mínimo**
  - Tabela `users` (peritos)
  - Tabela `reps` (requisições)
  - Tabela `laudos` (documentos)
  - Relacionamentos básicos
- [ ] **Implementar migrations básicas**
  - Sistema de versionamento simples
  - Script para criar/atualizar schema

### 4. Sistema de Criptografia
- [ ] **Implementar bcrypt para senhas**
  - Arquivo: `src/main/security/crypto.ts`
  - Funções: `hashPassword`, `verifyPassword`
- [ ] **Criptografar dados sensíveis**
  - Dados do perito (email, matrícula)
  - Chaves de API (futuro)
- [ ] **Integrar com armazenamento**
  - Criptografar antes de salvar no SQLite
  - Descriptografar ao recuperar

### 5. Página de Tratamento de Erros
- [ ] **Criar componente React de erro**
  - Arquivo: `src/renderer/components/ErrorBoundary.tsx`
  - UI amigável com opções de recuperação
- [ ] **Implementar no main process**
  - Capturar erros não tratados
  - Redirecionar para página de erro
- [ ] **Opções de recuperação**
  - Reiniciar aplicativo
  - Restaurar backup do banco
  - Limpar cache

## 🎯 **PRIORIDADE BAIXA**

### 6. Testes Unitários Básicos
- [ ] **Configurar ambiente de testes**
  - Jest ou Vitest
  - Arquivo de configuração
- [ ] **Testar funções de segurança**
  - `sanitizeInput`
  - `validateSqlQuery`
- [ ] **Testar utilitários**
  - Funções de log
  - Validação de dados

### 7. Integração Python (Opcional)
- [ ] **Configurar child_process**
  - Comunicação Node.js ↔ Python
  - Serialização JSON
- [ ] **Copiar scripts do projeto Streamlit**
  ```bash
  # Copiar geradores de documentos
  cp laudo-streamlit/generators/* python/
  ```
- [ ] **Interface básica**
  - Função `callPythonScript(script, args)`
  - Tratamento de erros e timeout

## 📋 **Checklist Rápido de Conclusão**

### PARA CONSIDERAR SPRINT 0 CONCLUÍDA:
- [ ] SQLite conectando e respondendo queries
- [ ] `npm run dev` abre Electron sem erros
- [ ] Schema básico criado (3-4 tabelas principais)
- [ ] Senhas sendo criptografadas com bcrypt
- [ ] Página de erro funcional
- [ ] Build de produção funcionando (`npm run build`)

### BÔNUS (não obrigatório para conclusão):
- [ ] Testes unitários implementados
- [ ] Integração Python funcionando
- [ ] Documentação técnica completa
- [ ] Sistema de backup automático

## ⏱️ **Estimativa de Tempo**

### Otimista (1-2 dias):
1. **Dia 1:** SQLite + Execução Electron (4-6 horas)
2. **Dia 2:** Criptografia + Página de erros (3-4 horas)

### Realista (2-3 dias):
1. **Dia 1:** SQLite funcionando (4 horas)
2. **Dia 2:** Schema + Criptografia (4 horas)  
3. **Dia 3:** Página de erros + Testes (3 horas)

### Pessimista (3-4 dias):
1. **Dia 1-2:** Problemas com SQLite/dependências
2. **Dia 3:** Correções e ajustes
3. **Dia 4:** Finalização e testes

## 🔧 **Comandos para Testar**

```bash
# 1. Verificar dependências
npm list --depth=0

# 2. Testar build
npm run build

# 3. Testar type checking
npm run type-check

# 4. Testar linting
npm run lint

# 5. Executar em desenvolvimento (objetivo principal)
npm run dev
```

## 📝 **Notas Importantes**

### Problemas Conhecidos:
1. **Warnings de dependências depreciadas** - Não crítico, pode ignorar por agora
2. **Caminhos de assets** - Verificar se ícones/imagens carregam corretamente
3. **Configuração de dev server** - Porta 3000 pode estar em uso

### Dependências Externas:
- **Node.js** 18+ ✓ Instalado
- **Python** 3.11+ (apenas para integração futura)
- **SQLite3** ✓ Incluído no npm package

### Próximos Passos Após Conclusão:
1. **Criar Pull Request** para merge na `main`
2. **Iniciar Sprint 1** (Arquitetura Base)
3. **Configurar CI/CD** básico

---

**Status atual:** 70% completo  
**Última atualização:** 02/05/2026  
**Próximo checkpoint:** Testar `npm run dev` completamente