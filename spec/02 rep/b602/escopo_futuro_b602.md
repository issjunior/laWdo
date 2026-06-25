# Escopo Futuro: Evoluções Adiadas do B-602

> **Status:** Referência futura
> **Relacionada a:** `criar_input_personalizado_por_demanda.md`
> **Objetivo:** registrar o que foi deliberadamente retirado da entrega atual para eventual implementação posterior

---

## 1. Contexto

Atualização de 2026-06-24: a entrega atual do B-602 já implementa:

- subexames por arma
- toggles por arma
- repetição por arma dentro de `repetir_para = 'armas'`
- hierarquia de template com `parent_id`
- sincronização de laudo com reconciliação estrutural

Este arquivo agora preserva apenas o que realmente continua fora do código atual.

---

## 2. Itens adiados

### 2.1 Hierarquia real de seções no template

**Status atual:** implementado no código.

**Ideia:** permitir que `secoes_template` tenha `parent_id`, formando uma estrutura de 1 nível:

- H2 pai
- H3 filhos
- repetição de armas dentro de um filho específico

**Motivação futura:**

- organizar melhor blocos como `DOS EXAMES`
- separar visualmente cartuchos, estojos e armas
- permitir templates mais estruturados

**Principais impactos:**

- migration em `secoes_template`
- ajustes em `TemplateService`
- ajustes em handlers IPC de template
- UI hierárquica em `TemplatesPage`
- novo builder com agrupamento por pai/filho

### 2.2 Parser H3/H4 no editor de laudos

**Status atual:** implementado no código.

**Ideia:** fazer `LaudosPage` entender:

- H2 como seção principal
- H3 como subseção editável
- eventualmente H4 como subbloco interno

**Motivação futura:**

- editar cada arma como um bloco próprio
- melhorar navegação no modo multi
- reduzir o tamanho de editores muito longos

**Principais impactos:**

- reescrever `parseConteudoEmSecoes()`
- reconstrução hierárquica do HTML
- novo modelo de estado do editor

### 2.3 Sub-editores por arma no modo multi

**Ideia:** cada arma repetida virar um editor próprio no `LaudosPage`.

**Motivação futura:**

- edição mais localizada
- UX melhor quando houver muitas armas
- menor risco de mexer no conteúdo da arma errada

**Riscos:**

- mais acoplamento entre expansão HTML e editor
- serialização mais sensível à ordem das armas
- aumento considerável de complexidade visual e técnica

### 2.4 `toggles_snapshot` no banco

**Ideia:** salvar no `laudo` um snapshot dos toggles da REP na última sincronização.

**Motivação futura:**

- detectar com precisão mudanças `on → off` e `off → on`
- exibir diálogo mais inteligente antes de remover conteúdo

**Principais impactos:**

- migration em `laudos`
- lógica extra de persistência e comparação
- mudança no contrato de sincronização

### 2.5 Preservação de conteúdo removido na sincronização

**Ideia:** quando um toggle passar de `on` para `off`, permitir preservar o conteúdo removido como referência.

**Motivação futura:**

- reduzir perda de trabalho manual
- dar mais segurança ao perito ao sincronizar

**Riscos:**

- comportamento menos previsível
- HTML final pode acumular blocos “preservados”
- reconciliação mais difícil de manter

### 2.6 Hash de ordenação ou identidade estável por arma

**Ideia 1:** usar hash da ordem/composição das armas para detectar reordenação.

**Ideia 2:** dar UUID estável para cada arma no JSON da REP.

**Motivação futura:**

- evitar ambiguidade quando armas forem reordenadas
- permitir sincronização menos posicional

**Observação:**

isso só passa a valer a pena se a aplicação começar a depender de edição manual forte dentro dos blocos de arma.

### 2.7 `findSecoesFilhas` ou endpoints de árvore

**Ideia:** expor via IPC consultas específicas para árvore de seções.

**Motivação futura:**

- simplificar renderer caso a hierarquia de template cresça

**Observação:**

não faz sentido enquanto `findSecoesByTemplate()` continuar suficiente para montar a estrutura em memória.

### 2.8 Condições complexas

**Ideia:** suportar regras além de toggle simples:

- `AND`
- `OR`
- comparações por tipo de arma
- combinações por múltiplos campos

**Motivação futura:**

- templates mais expressivos
- regras especializadas por cenário

**Risco:**

- aumenta bastante a superfície de erro
- exige modelo formal de condição

---

## 3. Quando revisitar

Vale reabrir este escopo se surgir um ou mais sinais:

- o perito começar a editar muito o conteúdo dentro de cada arma
- laudos com muitas armas ficarem ruins de navegar
- a sincronização destrutiva passar a causar perda de trabalho relevante
- houver demanda real por seções agrupadas em `DOS EXAMES > Cartuchos / Estojos / Armas`
- o template começar a exigir regras condicionais mais sofisticadas

Se esses sinais não existirem, a implementação atual deve continuar simples.

---

## 4. Ordem recomendada para uma fase futura

Se esse escopo voltar, a sequência sugerida é:

1. `parent_id` em `secoes_template`
2. builder hierárquico H2/H3
3. parser H2/H3 no `LaudosPage`
4. só depois avaliar sub-editores por arma
5. por último, avaliar `toggles_snapshot` e preservação de conteúdo

Regra: não implementar preservação de conteúdo antes de estabilizar a estrutura hierárquica.

---

## 5. Decisão arquitetural registrada

Esses itens foram adiados por escolha consciente, não por esquecimento.

Motivos principais:

- manter a entrega atual pequena e confiável
- reduzir acoplamento entre formulário, template, builder e editor
- evitar abrir duas frentes arquiteturais ao mesmo tempo
- priorizar UX direta em vez de infraestrutura antecipada

---

## 6. Observação final

Se uma fase futura reabrir este escopo, o ideal é criar uma nova spec própria a partir deste arquivo, em vez de expandir novamente a spec da entrega atual.

Este documento serve como memória de produto e arquitetura, não como ordem de implementação imediata.
