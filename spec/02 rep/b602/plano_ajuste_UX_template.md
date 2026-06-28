# Backlog Técnico: Ajuste de UX do Template B-602

> **Status:** Proposto
> **Escopo:** editor de template em `src/renderer/pages/TemplatesPage.tsx`, com foco nas seções do B-602
> **Objetivo:** tornar a configuração de seções mais intuitiva, reduzir combinações inválidas e isolar a complexidade específica do B-602

---

## 1. Resumo do problema

O fluxo atual funciona, mas a UX ainda expõe o modelo interno da implementação:

- `Sempre visível`, `Sem pai (H2)` e `Não repetir` exigem contexto técnico demais
- os controles de estrutura ficam comprimidos na mesma linha do nome da seção
- a repetição por arma não comunica claramente quando usar nem quais efeitos produz
- a tela aceita combinações semanticamente frágeis
- `TemplatesPage.tsx` concentra UI, regra estrutural e comportamento específico do exame

---

## 2. Diretriz de implementação

Executar em 3 frentes, nesta ordem:

1. clareza da interface
2. guardrails e validações
3. modularização com ganho real

Regra: não abrir refatoração ampla antes de estabilizar a linguagem da UI e as regras de uso.

---

## 3. Backlog

## Epic 1 — Clareza da Interface

### UXT-001 — Reescrever rótulos técnicos para linguagem orientada à tarefa

**Objetivo**

Remover da interface principal a necessidade de entender `H2`, `H3` e termos internos do builder.

**Tarefas**

- trocar `Sempre visível` por `Sempre mostrar`
- trocar `Sem pai (H2)` por `Seção principal`
- trocar `Não repetir` por `Conteúdo único`
- trocar `Arma` por `Uma seção por arma`
- revisar placeholders e textos auxiliares da mesma área para manter consistência

**Arquivos prováveis**

- `src/renderer/pages/TemplatesPage.tsx`

**Critérios de aceite**

- os selects deixam de usar `H2/H3/H4` como linguagem principal
- os novos textos continuam transmitindo a mesma regra funcional

**Prioridade**

Alta

---

### UXT-002 — Adicionar labels explícitas para os controles estruturais

**Objetivo**

Deixar claro o papel de cada select sem exigir tentativa e erro.

**Tarefas**

- incluir labels visíveis para:
  - `Visibilidade`
  - `Estrutura`
  - `Repetição`
- garantir que a disposição continue boa em desktop e mobile

**Arquivos prováveis**

- `src/renderer/pages/TemplatesPage.tsx`

**Critérios de aceite**

- os 3 controles passam a ser legíveis sem depender do valor selecionado
- os labels permanecem visíveis em layouts estreitos

**Prioridade**

Alta

---

### UXT-003 — Reorganizar o cabeçalho de configuração da seção

**Objetivo**

Separar nome, estrutura e ações para reduzir densidade visual.

**Tarefas**

- mover nome da seção e ações principais para uma primeira linha
- mover `Visibilidade`, `Estrutura` e `Repetição` para uma segunda linha
- manter editor e hints abaixo da área estrutural

**Arquivos prováveis**

- `src/renderer/pages/TemplatesPage.tsx`

**Critérios de aceite**

- a configuração da seção não fica toda comprimida em uma única linha
- a hierarquia visual entre “configurar a seção” e “editar conteúdo” fica clara

**Prioridade**

Alta

---

### UXT-004 — Exibir resumo legível da configuração da seção

**Objetivo**

Permitir revisão rápida da configuração sem interpretar 3 selects.

**Tarefas**

- montar resumo textual com base nos valores atuais
- exemplos esperados:
  - `Sempre mostrar · seção principal · conteúdo único`
  - `Mostrar quando houver arma · subseção de DOS EXAMES · uma seção por arma`
- recalcular o resumo em tempo real ao editar a seção

**Arquivos prováveis**

- `src/renderer/pages/TemplatesPage.tsx`

**Critérios de aceite**

- cada seção mostra seu estado estrutural de forma legível
- o resumo acompanha alterações sem delay perceptível

**Prioridade**

Média

---

### UXT-005 — Adicionar ajuda contextual fixa

**Objetivo**

Reduzir dependência de tooltip como única fonte de entendimento.

**Tarefas**

- adicionar texto curto para `Visibilidade`
- adicionar texto curto para `Estrutura`
- adicionar texto curto para `Repetição`
- manter tooltip apenas como complemento

**Arquivos prováveis**

- `src/renderer/pages/TemplatesPage.tsx`

**Critérios de aceite**

- a área explica o comportamento básico sem hover
- os textos não poluem demais a interface

**Prioridade**

Alta

---

## Epic 2 — Guardrails e Resiliência

### UXT-006 — Restringir repetição por arma ao contexto suportado

**Objetivo**

Impedir uso de `repetir_para = armas` fora do contexto do B-602 ou em combinações sem sentido.

**Tarefas**

- mostrar a opção `Uma seção por arma` apenas quando o tipo de exame suportar isso
- impedir ou desestimular o uso fora da estrutura esperada
- se a UI não bloquear automaticamente, pelo menos avisar inline

**Arquivos prováveis**

- `src/renderer/pages/TemplatesPage.tsx`
- eventual helper novo no renderer para regras por tipo de exame

**Critérios de aceite**

- a opção não aparece para exames que não suportam repetição por arma
- a seção não pode ser configurada silenciosamente de forma ambígua

**Prioridade**

Alta

---

### UXT-007 — Aplicar default seguro para `repetir_titulo`

**Objetivo**

Reduzir erro manual quando o usuário escolhe repetição por arma.

**Tarefas**

- preencher `repetir_titulo` automaticamente ao ativar repetição por arma, se estiver vazio
- usar modelo compatível com o fluxo atual do B-602
- evitar sobrescrever título já editado manualmente

**Arquivos prováveis**

- `src/renderer/pages/TemplatesPage.tsx`

**Critérios de aceite**

- ao ativar repetição por arma em seção nova, o campo já vem com padrão útil
- um valor já digitado pelo usuário não é perdido

**Prioridade**

Alta

---

### UXT-008 — Exibir aviso inline sobre sincronização destrutiva

**Objetivo**

Deixar explícito que blocos derivados da REP podem ser reescritos.

**Tarefas**

- manter aviso visível quando `repetir_para = armas`
- revisar a linguagem para não depender de `H3` ou tag específica errada
- explicar que o conteúdo derivado reflete a REP atual

**Arquivos prováveis**

- `src/renderer/pages/TemplatesPage.tsx`

**Critérios de aceite**

- o usuário entende que o bloco repetido é derivado da REP
- a mensagem não contradiz a estrutura real gerada pelo builder

**Prioridade**

Alta

---

### UXT-009 — Validar combinações inválidas ou frágeis antes de salvar

**Objetivo**

Evitar persistir configuração estrutural incoerente.

**Tarefas**

- validar `repetir_titulo` quando `repetir_para = armas`
- validar contexto estrutural mínimo para seção repetível
- detectar situações que merecem aviso, como conteúdo que duplica o mesmo padrão do título repetido
- decidir quais casos são bloqueio e quais casos são apenas warning

**Arquivos prováveis**

- `src/renderer/pages/TemplatesPage.tsx`
- `src/renderer/lib/validators/template.schema.ts` se a validação sair do nível puramente visual

**Critérios de aceite**

- configurações claramente inválidas não são salvas silenciosamente
- warnings aparecem antes do usuário descobrir o problema no laudo final

**Prioridade**

Alta

---

### UXT-010 — Alinhar terminologia da UI com o comportamento real do builder

**Objetivo**

Eliminar a divergência entre o texto mostrado ao usuário e a estrutura real do laudo.

**Tarefas**

- revisar textos que prometem `H3` quando o builder usa outra estrutura
- preferir termos neutros:
  - `seção principal`
  - `subseção`
  - `bloco repetido por arma`
- revisar hints existentes relacionados a repetição

**Arquivos prováveis**

- `src/renderer/pages/TemplatesPage.tsx`
- `src/main/services/secao-builder.service.ts` apenas se for necessário confirmar ou ajustar contrato de comportamento

**Critérios de aceite**

- a UI não promete uma estrutura diferente da que o builder gera
- o texto fica compreensível mesmo sem conhecer HTML

**Prioridade**

Alta

---

## Epic 3 — Modularização

### UXT-011 — Extrair componente `SecaoConfiguracaoTemplate`

**Objetivo**

Reduzir o acoplamento do JSX estrutural dentro de `TemplatesPage.tsx`.

**Tarefas**

- extrair a área de configuração da seção para componente dedicado
- manter no componente:
  - labels
  - selects
  - resumo
  - hints
  - campo de repetição
- deixar `TemplatesPage.tsx` como orquestrador de estado e lista de seções

**Arquivos prováveis**

- `src/renderer/pages/TemplatesPage.tsx`
- novo arquivo em `src/renderer/components/template/` ou pasta equivalente do renderer

**Critérios de aceite**

- `TemplatesPage.tsx` fica materialmente menor e mais legível
- a extração não duplica regra nem cria props caóticas demais

**Prioridade**

Média

---

### UXT-012 — Extrair helpers de apresentação e resumo estrutural

**Objetivo**

Separar regra de exibição da regra de manipulação de estado.

**Tarefas**

- mover builders de label/resumo para helper local ou util do renderer
- centralizar mapeamento entre valor interno e texto exibido
- evitar strings de apresentação espalhadas no JSX

**Arquivos prováveis**

- `src/renderer/pages/TemplatesPage.tsx`
- novo helper do renderer

**Critérios de aceite**

- textos estruturais ficam centralizados
- manutenção de labels e resumo não exige caça manual no JSX

**Prioridade**

Média

---

### UXT-013 — Introduzir registry declarativo de comportamento por exame

**Objetivo**

Remover condicionais ad hoc específicas do B-602 de dentro da renderização.

**Tarefas**

- definir estrutura de configuração por exame
- mapear:
  - opções de repetição
  - textos de ajuda
  - defaults
  - restrições de uso
- usar o registry no fluxo de template

**Arquivos prováveis**

- novo arquivo de configuração no renderer
- `src/renderer/pages/TemplatesPage.tsx`

**Critérios de aceite**

- comportamento específico do B-602 não fica hardcoded em múltiplos pontos do JSX
- a solução permite extensão futura sem acoplamento excessivo

**Prioridade**

Média

---

## 4. Ordem recomendada de execução

### Fase 1 — Clareza imediata

- `UXT-001`
- `UXT-002`
- `UXT-003`
- `UXT-005`
- `UXT-004`

### Fase 2 — Regras e segurança

- `UXT-006`
- `UXT-007`
- `UXT-008`
- `UXT-010`
- `UXT-009`

### Fase 3 — Modularização

- `UXT-011`
- `UXT-012`
- `UXT-013`

---

## 5. Dependências e observações

- `UXT-009` depende de a linguagem e os fluxos básicos já estarem claros na UI
- `UXT-011` não deve vir antes de `UXT-001` a `UXT-010`, para evitar extrair uma interface ainda instável
- qualquer alteração que mude regra funcional real do B-602 deve refletir também nas specs relacionadas

---

## 6. Fora de escopo

- redesign completo do preview PDF
- nova estratégia de repetição além de armas
- ampliar hierarquia além de `H2 → H3`
- reescrever o builder de laudo sem necessidade direta
- refatoração total de `TemplatesPage.tsx`

---

## 7. Critérios de sucesso

O backlog pode ser considerado concluído quando:

1. a configuração de seção deixa de exigir entendimento prévio de `H2/H3`
2. a repetição por arma fica autoexplicativa no fluxo B-602
3. combinações inválidas deixam de ser aceitas silenciosamente
4. a terminologia da UI fica compatível com o comportamento real do builder
5. `TemplatesPage.tsx` passa a concentrar menos responsabilidade visual específica
