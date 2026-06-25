# Plano: B-602 — Subexames por Arma Sob Demanda

> **Status:** Em planejamento
> **Foco:** intuitividade, resiliência a erros, modularidade e UX
> **Premissa:** o sistema ainda está em desenvolvimento, então esta entrega **não precisa de retrocompatibilidade**
> **Escopo futuro relacionado:** `escopo_futuro_b602.md`

---

## 1. Resumo

Hoje o B-602 possui dois toggles globais:

- `b602_armas_funcionamento_toggle`
- `b602_armas_coleta_toggle`

Eles valem para todas as armas ao mesmo tempo. Isso é ruim para UX e não representa o caso real em que cada arma pode exigir uma combinação diferente de subexames.

Esta entrega troca esse modelo por **toggles por arma**:

- cada arma pode ter `func_toggle` independente
- cada arma pode ter `coleta_toggle` independente
- a seção repetível de armas no template continua existindo
- dentro de cada arma, blocos condicionais são exibidos ou removidos conforme os toggles daquela arma

### Resultado esperado

Exemplo:

- Arma 1: funcionamento `on`, coleta `on`
- Arma 2: funcionamento `on`, coleta `off`
- Arma 3: funcionamento `off`, coleta `off`

O laudo gerado deve conter:

- uma subseção H3 para cada arma
- bloco de funcionamento apenas nas armas com `func_toggle = on`
- bloco de coleta apenas nas armas com `coleta_toggle = on`

Sem alterar a arquitetura geral do editor de laudos.

---

## 2. Objetivos e Não Objetivos

### Objetivos

- tornar o preenchimento do B-602 mais intuitivo para o perito
- reduzir erro operacional ao evitar toggles globais ambíguos
- manter a implementação pequena e modular
- reaproveitar a infraestrutura já existente de:
  - `repetir_para = 'armas'`
  - `repetir_titulo`
  - `data-cond-bloco`
  - sincronização de seções do laudo

### Não objetivos desta entrega

- não implementar hierarquia real de seções com `parent_id`
- não criar editor H3/H4 aninhado no `LaudosPage`
- não adicionar `toggles_snapshot` no banco
- não criar merge inteligente ou preservação automática de conteúdo removido
- não suportar condições compostas (`AND`, `OR`, etc.)
- não suportar blocos condicionais aninhados dentro de outros blocos condicionais

Esses pontos podem existir em uma fase futura, mas não devem contaminar esta entrega.

---

## 3. Decisões de Design

| Tema | Decisão |
|---|---|
| Granularidade | toggle por arma, não global |
| Persistência | salvar `func_toggle` e `coleta_toggle` dentro de cada item de `b602.armas[]` |
| Banco de dados | sem migration |
| Template | continuar com seções planas já existentes |
| Repetição | continuar usando `repetir_para = 'armas'` |
| Título da arma | continuar usando `repetir_titulo` |
| Condição por arma | usar identificadores com `_N_` no template |
| Sincronização | regeneração destrutiva apenas da seção repetível de armas |
| UX | toggle visível dentro de cada card de arma |
| Robustez | bloquear escopo extra; sem árvore de seções; sem merge heurístico |

### Convenção de nomenclatura

Para manter consistência entre formulário, JSON e placeholders:

- **formulário:** `b602_armas_${i}_func_toggle`, `b602_armas_${i}_coleta_toggle`
- **JSON:** `b602.armas[i].func_toggle`, `b602.armas[i].coleta_toggle`
- **template/condição:** `b602_arma_N_func_toggle`, `b602_arma_N_coleta_toggle`
- **placeholders existentes por arma:** manter `b602_arma_N_*`

Regra: no formulário a coleção continua no plural (`armas`), mas no template a referência por item continua no singular (`arma`), como já ocorre nos placeholders atuais.

---

## 4. Contrato de Dados

### 4.1 Formulário

Remover do `REPFormData`:

- `b602_armas_funcionamento_toggle`
- `b602_armas_coleta_toggle`

Adicionar por arma, via chaves dinâmicas:

- `b602_armas_0_func_toggle`
- `b602_armas_0_coleta_toggle`
- `b602_armas_1_func_toggle`
- `b602_armas_1_coleta_toggle`
- etc.

`REPFormData` já possui `[key: string]: string`, então não é necessário declarar todas as combinações manualmente.

### 4.2 JSON salvo em `campos_especificos`

```json
{
  "b602": {
    "armas_toggle": "on",
    "armas": [
      {
        "tipo": "Pistola",
        "marca": "Taurus",
        "modelo": "PT100",
        "calibre": ".40",
        "func_toggle": "on",
        "coleta_toggle": "on"
      },
      {
        "tipo": "Revólver",
        "marca": "S&W",
        "modelo": "686",
        "calibre": ".357",
        "func_toggle": "on",
        "coleta_toggle": "off"
      }
    ]
  }
}
```

### 4.3 Template

Os blocos condicionais dentro da seção repetível de armas devem usar:

```html
<div data-cond-bloco="b602_arma_N_func_toggle">
  <h3>FUNCIONAMENTO E EFICIÊNCIA</h3>
  <p>...</p>
</div>

<div data-cond-bloco="b602_arma_N_coleta_toggle">
  <h3>COLETA DE PADRÕES BALÍSTICOS</h3>
  <p>...</p>
</div>
```

Durante a expansão da arma:

- `_N_` vira `_1_`, `_2_`, `_3_`, etc.
- cada bloco é mantido ou removido conforme o toggle da arma corrente

---

## 5. UX

### 5.1 REP B-602

Dentro de cada card de arma:

- exibir dois checkboxes logo abaixo dos dados principais
- labels claras:
  - `Funcionamento e Eficiência`
  - `Coleta de Padrões Balísticos`
- default para novas armas: ambos `off`

Comportamento esperado:

- adicionar arma nova não deve herdar toggle da arma anterior
- remover arma deve limpar também os toggles daquela arma
- o perito deve entender visualmente que os subexames pertencem àquela arma específica

### 5.2 Template

No `TemplatesPage`, para seções com `repetir_para = 'armas'`:

- manter o campo `repetir_titulo`
- exibir ajuda curta explicando:
  - placeholders por arma usam `_1_` como modelo
  - blocos condicionais por arma usam `_N_`
  - a seção repetível será regenerada a partir da REP

### 5.3 Editor TinyMCE

O menu de bloco condicional deve oferecer ações específicas para arma:

- `Funcionamento por arma`
- `Coleta por arma`

Essas ações inserem o `data-cond-bloco` já no formato correto com `_N_`.

Isso evita que o perito precise decorar identificadores internos.

---

## 6. Arquitetura da Solução

### 6.1 O que permanece como está

- `secoes_template` continua plana
- `repetir_para = 'armas'` continua sendo a forma de gerar subseções por arma
- `repetir_titulo` continua definindo o H3 de cada arma
- `LaudosPage` continua trabalhando com seções H2 no modo multi
- `laudo:sincronizarSecoes` continua existindo sem novo contrato IPC

### 6.2 O que muda

- `ArmasFields` passa a controlar toggles por item
- `b602.service.ts` passa a serializar/desserializar toggles por arma
- o builder da seção repetível processa condições por arma em vez de toggles globais
- a exportação passa a expor placeholders de toggle por arma

### 6.3 Estratégia de sincronização

Para manter previsibilidade:

- a seção repetível de armas é tratada como derivada da REP
- ao sincronizar, o bloco de armas é reexpandido do zero
- edições manuais dentro desse bloco podem ser perdidas

Essa regra deve ser explícita na UI e na spec. É uma escolha consciente para simplificar e evitar merge inconsistente.

---

## 7. Implementação

### 7.1 `src/renderer/components/rep/exam-fields/types.ts`

- remover os dois toggles globais do tipo
- manter o uso de index signature para os novos campos dinâmicos

### 7.2 `src/renderer/components/rep/exam-fields/b602.tsx`

Em `ArmasFields`:

- remover o card final de sub-toggles globais
- adicionar dois checkboxes dentro de cada arma:
  - `b602_armas_${index}_func_toggle`
  - `b602_armas_${index}_coleta_toggle`
- ao excluir a arma, limpar também esses dois campos

### 7.3 `src/renderer/components/rep/exam-fields/services/b602.service.ts`

#### `serialize()`

Para cada arma:

```ts
{
  ...dadosDaArma,
  func_toggle: valor || 'off',
  coleta_toggle: valor || 'off',
}
```

Remover do JSON final:

- `armas_funcionamento_toggle`
- `armas_coleta_toggle`

#### `deserialize()`

Para cada arma do array:

- popular `b602_armas_${i}_func_toggle`
- popular `b602_armas_${i}_coleta_toggle`

#### `fieldDefaults`

Definir defaults para a primeira arma:

- `b602_armas_0_func_toggle: 'off'`
- `b602_armas_0_coleta_toggle: 'off'`

E garantir que novas armas usem o mesmo padrão na UI.

### 7.4 `src/renderer/components/rep/exam-fields/index.ts`

- remover `subToggles` do toggle `b602_armas_toggle`
- manter `EXAM_TOGGLES` apenas para seções principais:
  - cartuchos
  - estojos
  - armas

Se o editor precisar de um menu próprio para subexames por arma, criar uma estrutura separada. Não misturar “toggle de exibição de seção” com “condição interna da arma”.

### 7.5 `src/renderer/pages/REPsPage.tsx`

- remover defaults globais do `emptyForm`
- remover validações locais dos toggles globais
- continuar disparando `laudo.sincronizarSecoes(laudoId)` após salvar REP, sem expandir o contrato

### 7.6 `src/main/services/secao-builder.service.ts`

Adicionar uma etapa específica para seções repetíveis de armas:

1. expandir placeholders `_1_` do conteúdo base para o índice atual
2. converter `b602_arma_N_func_toggle` em `b602_arma_${idx}_func_toggle`
3. converter `b602_arma_N_coleta_toggle` em `b602_arma_${idx}_coleta_toggle`
4. avaliar o toggle da arma corrente
5. remover blocos desligados

#### Helpers sugeridos

- `substituirIndicePlaceholders(html, idx)`
- `resolverCondicoesDaArma(html, idx, arma)`
- `normalizarCondicaoArma(condicao, idx)`

#### Regra de robustez

Esta entrega **não suporta** bloco condicional aninhado. O helper pode assumir que cada `data-cond-bloco` é plano e autocontido.

### 7.7 `src/main/services/laudo.service.ts`

Não adicionar snapshot nem merge heurístico.

Manter a abordagem atual:

- colapsar blocos repetíveis antigos
- reexpandir bloco de armas com base na REP atual
- reconciliar com o HTML existente no nível já suportado hoje

Mas ajustar o processamento para as novas condições por arma.

### 7.8 `src/renderer/components/editor/TinyMceEditor.tsx`

Adicionar comandos específicos para inserir blocos por arma:

- `insertCondBlocoArmaFunc`
- `insertCondBlocoArmaColeta`

Ou equivalente, desde que o resultado inserido seja:

```html
<div data-cond-bloco="b602_arma_N_func_toggle" class="cond-bloco">
  <h3>FUNCIONAMENTO E EFICIÊNCIA</h3>
  <p>&nbsp;</p>
</div>
```

e

```html
<div data-cond-bloco="b602_arma_N_coleta_toggle" class="cond-bloco">
  <h3>COLETA DE PADRÕES BALÍSTICOS</h3>
  <p>&nbsp;</p>
</div>
```

### 7.9 `src/renderer/lib/exportacao-placeholders.ts`

Expor para template/exportação:

- `b602_arma_1_func_toggle`
- `b602_arma_1_coleta_toggle`
- etc.

Isso melhora previsibilidade e observabilidade na exportação.

### 7.10 `src/main/services/placeholder.service.ts`

Atualizar o seed dos placeholders do B-602 para incluir:

- `b602_arma_N_func_toggle`
- `b602_arma_N_coleta_toggle`

O cadastro pode ser conceitual/genérico no nível da documentação do placeholder. Não é necessário materializar vinte linhas fixas se a UI já trabalha com grupo repetível.

---

## 8. Modularização

Para reduzir acoplamento, separar responsabilidades:

### Renderer

- `b602.tsx`: apenas UI do formulário
- `b602.service.ts`: apenas serialização, desserialização e defaults
- `index.ts`: apenas registro das seções/toggles principais

### Main

- `secao-builder.service.ts`: regras de expansão e filtragem de bloco repetível
- `laudo.service.ts`: sincronização do laudo usando o builder

### Editor

- `TinyMceEditor.tsx`: apenas comandos de inserção assistida

Regra: não espalhar lógica de condição por arma em `TemplatesPage`, `LaudosPage` e `exportacao-placeholders` ao mesmo tempo. A verdade de avaliação da condição deve ficar concentrada no builder.

---

## 9. Resiliência a Erros

### Regras obrigatórias

- toggle ausente deve ser tratado como `off`
- arma sem dados suficientes não deve quebrar a expansão
- seção repetível com zero armas deve gerar grupo vazio
- HTML sem `data-cond-bloco` deve continuar funcionando
- `data-cond-bloco` desconhecido deve ser removido silenciosamente da seção repetível de armas

### Regras de simplicidade

- sem parser hierárquico novo no laudo
- sem migration de banco
- sem diffs complexos de sincronização
- sem heurística para preservar conteúdo removido

Essas escolhas são intencionais. Elas reduzem superfície de erro e deixam a entrega mais auditável.

---

## 10. Fora de Escopo Removido do Plano Anterior

Os itens abaixo não pertencem mais a esta spec:

- `parent_id` em `secoes_template`
- UI hierárquica no `TemplatesPage`
- parser H3/H4 no `LaudosPage`
- sub-editores por arma no modo multi
- `toggles_snapshot` em `laudos`
- diálogo de preservação de conteúdo removido
- hash de ordenação de armas
- `findSecoesFilhas`
- novos canais IPC para árvore de seções

Se algum desses pontos voltar a ser necessário, deve virar uma spec própria.

Referência já registrada para consulta futura:

- `spec\02 rep\b602\escopo_futuro_b602.md`

---

## 11. Checklist

- [ ] remover toggles globais do B-602
- [ ] adicionar toggles por arma no formulário
- [ ] serializar toggles por arma em `campos_especificos`
- [ ] desserializar toggles por arma ao editar REP
- [ ] atualizar `EXAM_TOGGLES` para não representar subexames globais
- [ ] adicionar comandos do TinyMCE para blocos condicionais por arma
- [ ] adaptar `secao-builder.service.ts` para avaliar `b602_arma_N_func_toggle` e `b602_arma_N_coleta_toggle`
- [ ] adaptar sincronização do laudo para regenerar corretamente a seção repetível de armas
- [ ] expor placeholders de toggle por arma na exportação
- [ ] atualizar seed/manifests de placeholders do B-602

---

## 12. Critérios de Aceite

### Formulário

1. Ao marcar `Possui Arma(s)?`, cada arma exibida possui seus próprios toggles.
2. Arma nova começa com `func_toggle = off` e `coleta_toggle = off`.
3. Remover uma arma remove também seus toggles.

### Persistência

4. Salvar a REP produz `b602.armas[].func_toggle` e `b602.armas[].coleta_toggle`.
5. Reabrir a REP restaura corretamente os toggles de cada arma.

### Template e geração

6. Uma seção com `repetir_para = 'armas'` continua gerando H3 por arma via `repetir_titulo`.
7. Bloco `b602_arma_N_func_toggle` aparece apenas para armas com `func_toggle = on`.
8. Bloco `b602_arma_N_coleta_toggle` aparece apenas para armas com `coleta_toggle = on`.

### Sincronização

9. Alterar toggle de uma arma e salvar a REP atualiza a seção repetível de armas no laudo.
10. A sincronização não exige migration nem novo canal IPC.

### UX

11. O perito consegue inserir blocos condicionais por arma sem digitar identificadores manualmente.
12. A interface deixa claro que os subexames pertencem à arma individual, não ao conjunto todo.

---

## 13. Observação Final

O valor desta entrega está em **resolver bem um problema real sem abrir uma frente arquitetural paralela**.

Se a implementação exigir:

- árvore de seções
- parser H3/H4
- merge de conteúdo
- snapshot em banco

então o escopo saiu do trilho. A solução correta para esta fase é menor, mais previsível e mais fácil de manter.

Ainda assim, durante a implementação, se surgir um bloqueio real de UX, consistência ou manutenção, é válido sugerir a adoção pontual de alguma feature documentada em `escopo_futuro_b602.md`, desde que isso seja feito como exceção justificada e não como expansão automática de escopo.
