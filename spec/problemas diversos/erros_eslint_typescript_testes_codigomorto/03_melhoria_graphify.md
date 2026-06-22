# 🕸️ Análise Estrutural do Grafo — LaudoPericial

```
╔══════════════════════════════════════════════════════════╗
║  📅 Última atualização: 2026-06-22                      ║
║  📡 Fonte: graphify-out/GRAPH_REPORT.md + graph.json    ║
║  🧠 Gerado por: LLM (curadoria humana)                  ║
║  ⏳ Estalece se: graphify for reconstruído               ║
╚══════════════════════════════════════════════════════════╝
```

> **Dados do grafo:** 2.942 nós · 3.691 edges · 226 comunidades (183 exibidas, 43 finas omitidas)
> **Commit base:** `118dab6d` | Corpus: 217 arquivos, ~215.555 palavras

---

## 🔄 Como Atualizar Este Arquivo

Este arquivo é uma **análise curada por LLM** dos artefatos gerados automaticamente pelo [Graphify](https://github.com/safishamsi/graphify/tree/v8). Não é gerado automaticamente — precisa ser regerado manualmente quando o grafo mudar significativamente.

### Passo a passo

```bash
# 1. Reconstruir o grafo (se o código mudou)
graphify update . --force

# 2. Pedir ao Claude (ou outro LLM) para regerar a análise com base nos artefatos:
#    - graphify-out/GRAPH_REPORT.md  (relatório de destaques)
#    - graphify-out/graph.json       (grafo completo)
#    - graphify-out/graph.html       (visualização interativa)
```

### Quando atualizar

| Situação | Ação |
|----------|------|
| `git rev-parse HEAD` ≠ commit base deste arquivo | ⚠️ Regenerar (commit base desatualizado) |
| Novo módulo/feature adicionado | ✅ Regenerar (novos nós podem mudar comunidades) |
| Refactor grande (muitos arquivos deletados/renomeados) | ✅ Regenerar (comunidades podem se reorganizar) |
| Apenas correções de bugs (sem mudança estrutural) | ❌ Não necessário |

### Checklist de verificação de estalecimento

- [ ] `git rev-parse HEAD` corresponde ao commit base abaixo?
- [ ] `graphify-out/graph.json` existe e foi reconstruído recentemente?
- [ ] As métricas abaixo (nós, edges, comunidades) ainda batem com o grafo atual?

> **Commit base atual:** `118dab6d` | **HEAD do repositório:** execute `git rev-parse HEAD` para comparar.

---

## 1. Código Potencialmente Morto / Subutilizado

**1.575 nós isolados (53,5% do grafo)** têm grau ≤1 — a maioria são chaves de configuração (`root`, `browser`, `es2022`, `node`, `extends`, etc.) extraídas como nós sem conexões reais. Isso é esperado para configs, mas **o índice caiu de 60% → 53,5%** em relação à análise anterior (maio), indicando que as conexões reais do código estão melhores mapeadas.

### Dados da comunidade de código morto (Community 220)
O grafo agora captura explicitamente uma comunidade de **33 nós** dedicada a **arquivos órfãos confirmados** (22/06/2026), com scripts de verificação (`ts-prune`, `eslint-plugin-import`, `npm run build`) integrados ao fluxo. Isso é um avanço — a auditoria de dead code está sistematizada.

### God nodes com baixa conectividade suspeita

| Nó | Grau | Risco |
|----|------|-------|
| `cryptoUtils` | Grau baixo | Export aggregator — pode conter código sem uso |
| `isEncrypted()` | Grau ≤3 | Função não chamada externamente |
| `generateSecureHash()` | Grau ≤3 | Possível dead code (já havia sido reportado em maio) |

**Recomendação:** Rodar `npx ts-prune` contra o código atual (lista de ~310 itens conhecida) para confirmar remoções seguras.

---

## 2. God Nodes — Abstrações Centrais do Sistema

O grafo identificou **10 nós mais conectados** (god nodes) que formam o núcleo do sistema:

| Nó | Grau | Função |
|----|------|--------|
| `logError()` | **120** | 🥇 Nó mais conectado — hub de cross-community bridge |
| `logInfo()` | **80** | 🥈 Log estruturado |
| `executeNonQuery()` | **44** | 🥉 Banco de dados |
| `logDebug()` | **39** | Depuração |
| `getLogger()` | **30** | Factory de logger |
| `registerIpcHandlers()` | **28** | Registro de handlers IPC |
| `scripts` | **26** | Scripts package.json |
| `executeQuery()` | **25** | Consultas SQL |
| `LaudoService` | **21** | Serviço central de laudos |
| `cn()` | **17** | Utilitário de classes CSS |

**🟢 Ponto positivo:** `logError()` com betweenness centrality 0.006 conecta 10 comunidades diferentes (IPC, Segurança, Database, Services) — refatorações no logger impactam todo o sistema. **Ponto de atenção:** `LaudoService` com apenas 21 edges para o domínio central do sistema pode indicar sub-uso ou camada de abstração incompleta.

---

## 3. Coesão das Comunidades

### Comunidades mais coesas (destaques positivos)

| Comunidade | Coesão | Nós | Descrição |
|-----------|--------|-----|-----------|
| **Community 66** | **0.67** | 3 | `Badge()`, `BadgeProps`, `badgeVariants` — UI atômica |
| **Community 71** | **0.67** | 3 | Componentes de exame (Acionamento, LocalFato) |
| **Community 207** | **0.67** | 3 | Arquitetura do Manifest — código vs ID |
| **Community 53** | **0.40** | 3 | Build: `main()`, `OUT_DIR`, `walkDir()` |
| **Community 39** | **0.25** | 8 | Arquitetura geral: Electron, IPC, React, SQLite |
| **Community 65** | **0.50** | 3 | Botão (`Button`, `ButtonProps`, `buttonVariants`) |

### Comunidades pouco coesas (oportunidades de refatoração)

| Comunidade | Coesão | Nós | Problema |
|-----------|--------|-----|----------|
| **Community 0** | 0.10 | 34 | Handlers IPC genéricos misturados — dividir por domínio |
| **Community 1** | **0.04** | 49 | Dependências npm — esperado, mas fraco |
| **Community 18** | **0.04** | 59 | BaseService — baixa coesão para o maior CRUD |
| **Community 29** | 0.04 | 44 | Erros compilação — agrupamento artificial |
| **Community 3** | 0.06 | 42 | Placeholders — coesão baixa, muitos sub-sistemas |

**🟢 Evolução positiva:** A coesão máxima subiu de **0.29** (maio) → **0.67** (junho), indicando que novos módulos estão mais focados. A **Community 39** (Arquitetura Geral) com 0.25 documenta bem a estrutura de alto nível.

**🔴 Atenção:** `BaseService` (Community 18) tem coesão 0.04 com 59 nós — o maior agrupamento do grafo e um dos menos coesos, sugerindo que o service base virou um "god class".

---

## 4. Segurança

### Pontos positivos
- Módulo de criptografia dedicado em **Community 10**: `encrypt()`, `decrypt()`, `hashPassword()`, `verifyPassword()`, `deriveKey()` — coesão 0.05 (baixa, mas funcional)
- `sanitizeInput()` presente em **Community 111** com coesão 0.14
- Schema de validação Zod robusto (várias comunidades de schemas com coesão 0.14–0.25)

### Pontos de atenção

| Problema | Detalhe |
|----------|---------|
| `generateSecureHash()` | Grau baixo — reportado como potencial dead code em maio, continua com baixa conectividade |
| `isEncrypted()` | Grau baixo — mesmo status |
| `cryptoUtils` | Grau baixo — export aggregator questionável |
| Criptografia seletiva | Apenas `senha` é criptografada (documentado em problemas conhecidos) — dados sensíveis de laudos periciais podem estar em plaintext |

**Recomendação:** Verificar se `generateSecureHash()` e `isEncrypted()` foram ou serão removidos — o commit `9ef6a0c` ("ajuste_remove_codigo_morto_crypto") sugere que parte disso já foi endereçado.

---

## 5. Oportunidades de Arquitetura

### Cross-Community Bridges (alto impacto)

| Nó | Betweenness | Comunidades que conecta |
|----|------------|------------------------|
| `logError()` | **0.006** | 10 comunidades — o hub mais crítico do sistema |
| `dependencies` | **0.003** | Community 1 ↔ 48 ↔ 158 |
| Planos de implementação | **0.003** | 7 comunidades de documentação de features |

### Hyperedges — Fluxos de Dados Identificados

1. **Template Document Import Pipeline** — ImportDialog → SectionDetection → TinyMCE
2. **AI-Assisted Laudo Editing Flow** — Groq API → AISectionToolbar → Placeholder System
3. **Laudo Editing Core System** — Laudo → TinyMCE → Placeholders → Imagens
4. **REP Form Architecture** — Progressive Disclosure → Section Registry → JSON Column
5. **Placeholder Full Cycle** — Manifest → Seed → Resolver → ContextMenu
6. **Sprint 4 Laudo Features** — Editor → IA → Preview → Upload

### Oportunidades de Simplificação

| Community | Coesão | Ação Recomendada |
|-----------|--------|------------------|
| **Community 18** (BaseService) | 0.04 | Quebrar em services menores por domínio (já existe separação parcial em `src/main/services/`) |
| **Community 0** (IPC Handlers) | 0.10 | Organizar handlers por domínio (`laudo/`, `ia/`, `backup/`, `config/`) |
| **Community 3** (Placeholders) | 0.06 | Sub-sistemas de placeholders estão fragmentados em 42 nós — consolidar |

---

## 6. Dependências

**49 dependências runtime** em **Community 1** (coesão 0.04) — baixa coesão esperada para um catálogo de pacotes. O grafo agora captura conexões reais de import via inferência:
- `@dnd-kit/*` — conectado a `SortableCategoryTree` (Community 166)
- `clsx` — chamado por `cn()` (Community 48)
- `bcrypt` — módulo de criptografia (Community 10)

**Recomendação:** Manter `depcheck` no fluxo de CI. O grafo mostra que dependências como `framer-motion` e `yet-another-react-lightbox` têm baixa representação — confirmar uso real.

---

## Resumo de Ações Prioritárias

1. **🏥 Verificar `generateSecureHash()`/`isEncrypted()`** — o commit `9ef6a0c` pode já ter resolvido; confirmar e remover nós mortos do código
2. **🔪 Quebrar `BaseService`** — coesão 0.04 com 59 nós é insustentável a longo prazo
3. **📦 Auditar dependências** — 49 pacotes runtime, alguns podem ser residuais
4. **🧹 ts-prune periódico** — ~310 candidatos a dead code conhecidos, revisar em lote
5. **🏗️ Refatorar IPC Handlers** — coesão 0.10 para o módulo central de comunicação é baixa
6. **🔒 Expandir criptografia** — além de `senha`, considerar dados sensíveis de laudos

---

## Notas Técnicas

- **1.575 nós isolados** (53,5%) — melhora em relação a maio (60%), mas ainda alto; maioria são chaves de config
- **43 comunidades finas** (<3 nós) omitidas do relatório — podem ser analisadas individualmente via `graphify query`
- **55 edges inferidos** (avg confidence 0.81) — 1% do total, confiabilidade boa
- **`logError()`** é o maior cross-community bridge com betweenness 0.006 — conecta 10 comunidades
- **99% dos nós extraídos diretamente** (1% inferido) — alta fidelidade do grafo
- **Custo de extração: 0 tokens** — grafo construído via AST (tree-sitter), sem LLM

---

## 🔗 Referências Cruzadas

- [`🏥 Painel de Saúde do Sistema`](./00_saude_do_sistema.md) — métricas quantitativas (build, lint, testes, dead code)
- [`🪶 Abordagem Leve Anti-Código Morto`](./01_abordagem_leve_pre_knip.md) — plano de ação manual
- [`🔍 Plano Knip Futuro`](./02_plano_knip_futuro.md) — automação futura de detecção de dead code
- [`graphify-out/GRAPH_REPORT.md`](../../../graphify-out/GRAPH_REPORT.md) — fonte primária dos dados (gerado pelo graphify)
- [`graphify-out/graph.json`](../../../graphify-out/graph.json) — grafo completo queryable
