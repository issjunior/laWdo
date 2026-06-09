# Plano: Campos Personalizados B-602 (Eficiência e Prestabilidade)

> **Status:** Planejamento concluído — aguardando implementação
> **Baseado em:** `criar_input_personalizados_exame.md` (guia de 4 passos), `cicar_placeholder.md` (ciclo completo de placeholder)
> **Tipo de exame:** B-602 (já cadastrado no banco via TiposExamePage)

---

## 1. Visão Geral do Formulário

### Ordem no Stepper

| # | Passo | Visibilidade | Toggle? |
|---|-------|-------------|---------|
| 1 | Dados da Solicitação | Sempre visível (fixo) | Não |
| 2 | Documentos Associados | Sempre visível (fixo) | Não |
| 3 | Dados da Investigação | Sempre visível (dinâmico) | Não |
| 4 | Material Encaminhado | Toggle | Sim — "Possui Material Encaminhado?" |
| 5 | Cartuchos | Toggle | Sim — "Possui Cartuchos?" |
| 6 | Estojos | Toggle | Sim — "Possui Estojos?" |

### Comportamento dos Toggles

- **Padrão inicial:** todos **desligados** (seções 4-6 ocultas do stepper)
- **Ao ligar:** seção aparece no stepper com 1 linha pré-renderizada
- **Ao desligar:** seção some do stepper, dados preenchidos **persistem** no form mas não são serializados
- **Ao religar:** dados anteriores reaparecem intactos
- **Linhas por tabela:** mínimo 1 (quando ativo), sem limite máximo
- **Coluna "Item":** auto-incremental (1, 2, 3...) em cada linha
- **Botão "+"**: adiciona linha abaixo da última
- **Botão "X"**: remove linha (desabilitado se só houver 1)

### Remoção Definitiva de Colunas Nativas da Tabela `reps`

**Motivação:** Os campos `nome_envolvido`, `numero_bo`, `numero_ip`, `lacre_entrada` e `lacre_saida` não são verdadeiramente universais — sua relevância e obrigatoriedade variam por tipo de exame. Por exemplo, B-602 exige múltiplos nomes de envolvidos (array 1-10), enquanto um futuro B-700 pode não precisar de envolvido algum. Manter esses campos como colunas nativas força todos os tipos de exame a conviverem com inputs que podem ser irrelevantes, duplicados ou semanticamente inadequados.

**Decisão:** Remover essas 5 colunas da tabela `reps` e passar a tratá-las exclusivamente como campos personalizados via `campos_especificos` JSON — cada tipo de exame define se, como e onde esses dados aparecem.

**Colunas removidas:**

| Coluna | Nova localização | Observação |
|---|---|---|
| `nome_envolvido` | `campos_especificos` (por tipo) | Cada tipo define seu próprio formato (texto único, array, etc.) |
| `numero_bo` | `campos_especificos` (por tipo) | Cada tipo define máscara e obrigatoriedade |
| `numero_ip` | `campos_especificos` (por tipo) | Cada tipo define obrigatoriedade |
| `lacre_entrada` | `campos_especificos` (por tipo) | Cada tipo define obrigatoriedade |
| `lacre_saida` | `campos_especificos` (por tipo) | Cada tipo define obrigatoriedade |

**Coluna mantida como nativa:**

| Coluna | Motivo |
|---|---|
| `solicitante_id` | É FK → `solicitantes` — estabelece relacionamento no banco. O texto do nome que consta no documento (`b602_solicitante_nome`) é campo personalizado separado, sem conflito. |

**Impacto no B-602:** O B-602 não precisa ocultar nada condicionalmente — ele simplesmente fornece seus equivalentes via `campos_especificos`: `b602_numero_bo`, `b602_numero_ip`, `b602_envolvidos` (array), `b602_numero_lacre` (por linha da tabela material_enc). A remoção das colunas nativas elimina qualquer duplicidade.

---

## 2. Definição dos Campos

### 2.1 Seção: Dados da Investigação (sempre visível)

| name (no form) | Label | Tipo | Obrigatório | Detalhes |
|---|---|---|---|---|
| `b602_envolvidos` | Envolvido(s) | Array de text inputs (1-10) | Sim | Botão "+" adiciona, "X" remove. Mín 1, máx 10. Placeholder "Nome do envolvido" |
| `b602_data_ocorrencia` | Data da Ocorrência | date | Sim | |
| `b602_local` | Local | text | Sim | Placeholder "bairro / cidade / PR" |
| `b602_numero_bo` | Nº do BO | text (máscara) | BO ou IP* | Máscara `AAAA/NNNNNN` (reutilizar `formatarNumeroBO`) |
| `b602_numero_ip` | Nº do IP | text | BO ou IP* | |
| `b602_solicitante_nome` | Solicitante | text | Sim | Nome que consta no documento (não é FK, é texto livre) |

> \* **Regra BO ou IP:** pelo menos um dos dois (`b602_numero_bo` ou `b602_numero_ip`) deve estar preenchido para B-602.

### 2.2 Seção: Material Encaminhado (toggle)

**Campos por linha (todos obrigatórios):**

| name (sufixo `_{n}` por linha) | Label | Tipo | Opções / Padrão |
|---|---|---|---|
| `natureza` | Natureza | dropdown | **Arma** (padrão), Munição, Acessório |
| `quantidade` | Quantidade | numérico | Padrão `01` |
| `tipo` | Tipo | dropdown | Artesanal, Carabina, Cartucho, Espingarda, Garrucha, **Pistola** (padrão), Revólver (ordem alfabética) |
| `dito_oficio` | Dito do Ofício | text | Pré-preenchido `""` (aspas vazias), placeholder `"texto texto"` |
| `numero_lacre` | Nº do Lacre | text | |

**Formato visual:** inputs lado a lado na mesma row horizontal (grid responsivo, colapsa em telas menores).

### 2.3 Seção: Cartuchos (toggle)

**Campos por linha (todos obrigatórios exceto observação):**

| name (sufixo `_{n}`) | Label | Tipo | Opções / Padrão |
|---|---|---|---|
| `quantidade` | Quantidade | numérico | — |
| `calibre` | Calibre | dropdown | .380 AUTO, 9 mm Luger, .38 SPL |
| `marca` | Marca | dropdown | Aguila, Blazer, **CBC** (padrão), R-P (Remington), Speer |
| `origem` | Origem | dropdown | **Brasil** (padrão) + lista padrão de países |
| `espoleta` | Espoleta | dropdown | Latonada, Niquelada |
| `estojo` | Estojo | dropdown | Latonada, Niquelada |
| `projetil` | Projétil | dropdown | CHOG – Chumbo Ogival, CHPP – Chumbo Ponta Plana, CSCV – Chumbo Semi Canto Vivo, CHCV – Chumbo Canto Vivo, EXPP – Expansivo Ponta Plana, ETOG – Encamisado Total Ogival, EXPO – Expansivo Ponta Oca, ETPP – Encamisado Total Ponta Plana, ETPT – Encamisado Total Pontiagudo |
| `observacao` | Observação | checkbox múltiplo (não obrigatório) | Intacto, NTA, Picotado, Percutido, Não deflagrado |

### 2.4 Seção: Estojos (toggle)

**Idêntica ao Cartuchos, porém sem o campo `projetil`:**

| name (sufixo `_{n}`) | Label | Tipo | Opções / Padrão |
|---|---|---|---|
| `quantidade` | Quantidade | numérico | — |
| `calibre` | Calibre | dropdown | .380 AUTO, 9 mm Luger, .38 SPL |
| `marca` | Marca | dropdown | Aguila, Blazer, **CBC** (padrão), R-P (Remington), Speer |
| `origem` | Origem | dropdown | **Brasil** (padrão) + lista padrão países |
| `espoleta` | Espoleta | dropdown | Latonada, Niquelada |
| `estojo` | Estojo | dropdown | Latonada, Niquelada |
| `observacao` | Observação | checkbox múltiplo (não obrigatório) | Intacto, NTA, Picotado, Percutido, Não deflagrado |

---

## 3. Estrutura JSON (`campos_especificos`)

```json
{
  "b602": {
    "envolvidos": ["João Silva", "Maria Souza"],
    "data_ocorrencia": "2026-03-15",
    "local": "Centro / Curitiba / PR",
    "numero_bo": "2026/123456",
    "numero_ip": "",
    "solicitante_nome": "Delegacia de Furtos e Roubos",
    "material_enc": [
      {
        "natureza": "Arma",
        "quantidade": "01",
        "tipo": "Pistola",
        "dito_oficio": "\"texto exemplificativo\"",
        "numero_lacre": "ABC123"
      },
      {
        "natureza": "Munição",
        "quantidade": "02",
        "tipo": "Revólver",
        "dito_oficio": "\"outro texto\"",
        "numero_lacre": "DEF456"
      }
    ],
    "cartuchos": [
      {
        "quantidade": "10",
        "calibre": "9 mm Luger",
        "marca": "CBC",
        "origem": "Brasil",
        "espoleta": "Latonada",
        "estojo": "Latonada",
        "projetil": "ETOG – Encamisado Total Ogival",
        "observacao": ["Intacto"]
      }
    ],
    "estojos": [
      {
        "quantidade": "5",
        "calibre": ".38 SPL",
        "marca": "Aguila",
        "origem": "Argentina",
        "espoleta": "Niquelada",
        "estojo": "Niquelada",
        "observacao": ["Percutido"]
      }
    ]
  }
}
```

**Serialização condicional:** Arrays `material_enc`, `cartuchos`, `estojos` só são incluídos no JSON se o toggle correspondente estiver ligado **e** houver dados preenchidos.

---

## 4. Chaves de Placeholder (Template System)

### Categoria no sistema

| Propriedade | Valor |
|---|---|
| `codigo` | `B-602` |
| `cor` | `red` |
| `ícone` | `Crosshair` |
| `label` | `B-602 - Eficiência e Prestabilidade` |

### 4.1 Tabelas completas (renderiza `<table>` HTML)

| Chave | Descrição |
|---|---|
| `b602_tabela_dados_investigacao` | Tabela HTML com os dados da investigação |
| `b602_tabela_material_enc` | Tabela HTML Material Encaminhado |
| `b602_tabela_cartuchos` | Tabela HTML Cartuchos |
| `b602_tabela_estojos` | Tabela HTML Estojos |

### 4.2 Dados da Investigação (singletons)

| Chave | Valor |
|---|---|
| `b602_envolvidos` | Lista de envolvidos (texto) |
| `b602_envolvido_1`...`b602_envolvido_10` | Envolvido individual |
| `b602_data_ocorrencia` | Data formatada |
| `b602_local` | Local |
| `b602_numero_bo` | Nº BO formatado |
| `b602_numero_ip` | Nº IP |
| `b602_solicitante_nome` | Solicitante |

### 4.3 Material Encaminhado (células por linha)

| Chave | Valor |
|---|---|
| `b602_material_enc_{N}_natureza` | Natureza do item N |
| `b602_material_enc_{N}_quantidade` | Quantidade |
| `b602_material_enc_{N}_tipo` | Tipo |
| `b602_material_enc_{N}_dito_oficio` | Dito do Ofício |
| `b602_material_enc_{N}_numero_lacre` | Nº Lacre |

### 4.4 Cartuchos (células por linha)

| Chave | Valor |
|---|---|
| `b602_cartucho_{N}_quantidade` | Quantidade |
| `b602_cartucho_{N}_calibre` | Calibre |
| `b602_cartucho_{N}_marca` | Marca |
| `b602_cartucho_{N}_origem` | Origem |
| `b602_cartucho_{N}_espoleta` | Espoleta |
| `b602_cartucho_{N}_estojo` | Estojo |
| `b602_cartucho_{N}_projetil` | Projétil |
| `b602_cartucho_{N}_observacao` | Observação |

### 4.5 Estojos (células por linha)

| Chave | Valor |
|---|---|
| `b602_estojo_{N}_quantidade` | Quantidade |
| `b602_estojo_{N}_calibre` | Calibre |
| `b602_estojo_{N}_marca` | Marca |
| `b602_estojo_{N}_origem` | Origem |
| `b602_estojo_{N}_espoleta` | Espoleta |
| `b602_estojo_{N}_estojo` | Estojo |
| `b602_estojo_{N}_observacao` | Observação |

---

## 5. Menu de Contexto no Editor de Laudo

```
📁 B-602 - Eficiência e Prestabilidade  (Crosshair, red)
   ├── 📊 Dados da Investigação
   │   ├── {{b602_tabela_dados_investigacao}}
   │   ├── {{b602_envolvidos}}
   │   ├── {{b602_envolvido_1}} ... {{b602_envolvido_10}}
   │   ├── {{b602_data_ocorrencia}}
   │   ├── {{b602_local}}
   │   ├── {{b602_numero_bo}}
   │   ├── {{b602_numero_ip}}
   │   └── {{b602_solicitante_nome}}
   ├── 📊 Material Encaminhado
   │   ├── {{b602_tabela_material_enc}}
   │   ├── {{b602_material_enc_1_natureza}} ... {{b602_material_enc_1_numero_lacre}}
   │   └── ...
   ├── 📊 Cartuchos
   │   ├── {{b602_tabela_cartuchos}}
   │   └── ...
   └── 📊 Estojos
       ├── {{b602_tabela_estojos}}
       └── ...
```

---

## 6. Estratégia de Implementação

### Abordagem: Atômica (tudo em um commit)

A remoção das 5 colunas nativas e a criação do B-602 devem ocorrer **no mesmo commit**, garantindo que o build nunca quebre em um estado intermediário. A ordem dentro do commit segue a dependência de dados: banco primeiro, depois frontend remove o velho, depois frontend adiciona o novo.

**Justificativa:** O sistema está em desenvolvimento, sem dados de produção a preservar. Fazer em etapas separadas criaria estados intermediários quebrados (ex: frontend referenciando colunas que não existem mais no banco, ou inputs duplicados coexistindo).

### Verificação de impacto nos tipos existentes

Os tipos I-801 e LOC **não dependem** dos 5 campos a serem removidos:
- **I-801** usa apenas `numeracao_*` (via `EXAM_FIELD_MAP['I-801'] = ['numeracao']`, service próprio)
- **LOC** usa apenas `local_fato`, `acionamento` (via `EXAM_FIELD_MAP['LOC'] = ['local_fato', 'acionamento']`)
- Ambos continuam funcionando após a remoção, apenas perdem acesso aos campos que viraram personalizados (serão atualizados em tasks futuras)

### Ordem de implementação

| # | O quê | Arquivos | Por quê primeiro |
|---|---|---|---|
| **1** | Database migration | `database/index.ts`, `database.ts`, `rep.handlers.ts`, `rep.schema.ts` | Limpar o banco antes do frontend referenciar colunas inexistentes |
| **2** | Remover campos nativos do frontend | `REPsPage.tsx`, `LaudosPage.tsx`, `types.ts` | Frontend para de referenciar colunas removidas |
| **3** | Criar componente B-602 | `exam-fields/b602.tsx` | Feature nova sobre base limpa |
| **4** | Criar ExamService B-602 | `exam-fields/services/b602.service.ts` | Serialização/desserialização do JSON |
| **5** | Registrar no sistema | `exam-fields/index.ts`, `placeholders.ts` | SECTION_REGISTRY, EXAM_FIELD_MAP, EXAM_SERVICE_REGISTRY |
| **6** | Placeholders B-602 no seed | `placeholder.service.ts` | Remove placeholders dos campos nativos, adiciona B-602 |
| **7** | Conectar REPsPage ao B-602 | `REPsPage.tsx` (adições) | emptyForm, FIELD_PLACEHOLDER, superRefine, form.trigger, handleEditar |
| **8** | Resolução no Laudo | `LaudosPage.tsx` | aplicarPlaceholders com b602_tabela_* e b602_envolvido_N |
| **9** | Build & verificação | — | Compilar, lint, testar fluxo completo |

---

## 7. Implementação — Arquivos e Checklist Detalhada

### Passo 1 — Database Migration (remoção de colunas nativas)

**Arquivos:** `src/main/database/index.ts`, `src/main/types/database.ts`, `src/main/ipc/handlers/rep.handlers.ts`, `src/lib/validators/rep.schema.ts`

Nova migration para remover as 5 colunas da tabela `reps`:
```sql
ALTER TABLE reps DROP COLUMN nome_envolvido;
ALTER TABLE reps DROP COLUMN numero_bo;
ALTER TABLE reps DROP COLUMN numero_ip;
ALTER TABLE reps DROP COLUMN lacre_entrada;
ALTER TABLE reps DROP COLUMN lacre_saida;
```

Atualizar `CURRENT_SCHEMA_VERSION`, remover campos do `REPRow`, remover sanitização do `rep.handlers.ts` (create/update), remover campos do `rep.schema.ts`.

### Passo 2 — Remover campos nativos do frontend

**Arquivos:** `src/renderer/pages/REPsPage.tsx`, `src/renderer/components/rep/exam-fields/types.ts`, `src/renderer/pages/LaudosPage.tsx`

**`types.ts`:** Remover `nome_envolvido`, `numero_bo`, `numero_ip`, `lacre_entrada`, `lacre_saida` do `REPFormData`.

**`REPsPage.tsx`:** Remover do JSX (seções Dados da Solicitação e Documentos Associados), `emptyForm()`, `FIELD_PLACEHOLDER`, `repFormSchema` (regras base), `prepareForApi()`, `handleEditar().form.reset()`.

**`LaudosPage.tsx`:** Remover do `mapping` do `aplicarPlaceholders()` as referências a `nome_envolvido`, `numero_bo`, `numero_ip`, `lacre_entrada`, `lacre_saida` (serão resolvidos via `campos_especificos` no futuro).

### Passo 3 — Componente React B-602

**Arquivo:** `src/renderer/components/rep/exam-fields/b602.tsx`

Contém 4 sub-componentes exportados:
- `DadosInvestigacaoFields` — envolvidos dinâmicos (1-10), data, local, BO, IP, solicitante
- `MaterialEncFields` — toggle + linhas com Item auto-incremental + inputs horizontais
- `CartuchosFields` — toggle + linhas
- `EstojosFields` — toggle + linhas

Cada sub-componente recebe `ExamSectionProps` (`form`, `mostrarPlaceholders`).

### Passo 4 — ExamService B-602

**Arquivo:** `src/renderer/components/rep/exam-fields/services/b602.service.ts`

- `serialize(data)` → objeto `{ b602: { ... } }` conforme estrutura JSON
- `deserialize(json)` → `Partial<REPFormData>` populando B-602 fields
- `fieldDefaults` — `dito_oficio`: `""`, `quantidade`: `"01"`, `natureza`: `"Arma"`, `tipo`: `"Pistola"`, `marca`: `"CBC"`, `origem`: `"Brasil"`
- `fieldMasks` — `b602_numero_bo` com `formatarNumeroBO`

### Passo 5 — Registry

**Arquivo:** `src/renderer/components/rep/exam-fields/index.ts`

Adicionar ao `SECTION_REGISTRY`:
```ts
dados_investigacao: { id, label: 'Dados da Investigação', icon: Search, description: '...', component: DadosInvestigacaoFields, requiredFields: ['b602_envolvidos_0', 'b602_data_ocorrencia', 'b602_local', 'b602_solicitante_nome'] },
material_enc: { id, label: 'Material Encaminhado', icon: Package, description: '...', component: MaterialEncFields, requiredFields: [] },
cartuchos: { id, label: 'Cartuchos', icon: CircleDot, description: '...', component: CartuchosFields, requiredFields: [] },
estojos: { id, label: 'Estojos', icon: Cylinder, description: '...', component: EstojosFields, requiredFields: [] },
```

Atualizar `EXAM_FIELD_MAP`:
```ts
'B-602': ['dados_investigacao', 'material_enc', 'cartuchos', 'estojos'],
```

Atualizar `EXAM_SERVICE_REGISTRY`:
```ts
'B-602': b602Service,
```

### Passo 4 — Tipos

**Arquivo:** `src/renderer/components/rep/exam-fields/types.ts`

Adicionar ao `REPFormData` todos os campos B-602 (com prefixo `b602_`).

### Passo 6 — Placeholders (renderer)

**Arquivo:** `src/renderer/components/rep/exam-fields/placeholders.ts`

Adicionar:
- Categoria `cat-exam-B-602` ao `EXAM_PLACEHOLDER_CATEGORIES`
- Campos ao `CAMPOS_ESPECIFICOS_PLACEHOLDERS` (com `jsonPath` e `categoria_exam_codigo`)

### Passo 7 — REPsPage.tsx — Adições B-602

| Item | Descrição |
|---|---|
| `emptyForm()` | Adicionar defaults para todos os campos B-602 |
| `FIELD_PLACEHOLDER` | Adicionar entradas para campos B-602 |
| `repFormSchema` / `superRefine` | Validação condicional: `b602_envolvidos_0`, `b602_data_ocorrencia`, `b602_local`, `b602_solicitante_nome`; regra BO ou IP |
| `form.trigger()` | Incluir paths B-602 ao trocar tipo |
| `handleEditar().form.reset()` | Incluir campos B-602 da desserialização |
| Integrar toggles com stepper | Filtrar dynamic steps conforme estado dos toggles |

### Passo 8 — step-registry

**Arquivo:** `src/renderer/components/rep/step-registry.ts`

Os passos dinâmicos 3-6 são gerados automaticamente por `getDynamicSteps('B-602')` a partir do `EXAM_FIELD_MAP`. O toggle de cada seção 4-6 é gerenciado pelo próprio componente B-602.

**Desafio arquitetural:** Os toggles do B-602 controlam visibilidade de seções no stepper. Abordagem:
- Adicionar ao `useRepStepper` o conceito de `activeDynamicSections: Set<string>` controlado por estado no REPsPage
- Os toggles B-602 chamam `setActiveSections` que filtra os steps dinâmicos
- Ou: usar `react-hook-form` watch nos campos de toggle do B-602 para derivar steps visíveis

### Passo 9 — Seed de Placeholders (main process)

**Arquivo:** `src/main/services/placeholder.service.ts`

- Remover do `PLACEHOLDERS_SISTEMA` as chaves `nome_envolvido`, `numero_bo`, `numero_ip`, `lacre_entrada`, `lacre_saida` e suas renomeações (`RENOMEACOES`)
- Adicionar arrays locais com `EXAM_PLACEHOLDER_CATEGORIES` e `CAMPOS_ESPECIFICOS_PLACEHOLDERS` do B-602
- Atualizar proteção contra deleção no método `delete()` incluindo as chaves B-602

### Passo 10 — Resolução no Laudo

**Arquivo:** `src/renderer/pages/LaudosPage.tsx`

- `aplicarPlaceholders()` — suporte a placeholders de tabela (`b602_tabela_*`) renderizando `<table>` HTML
- `aplicarPlaceholders()` — suporte a `b602_envolvido_N` (acessa array por índice)
- Placeholders B-602 resolvidos automaticamente via `CAMPOS_ESPECIFICOS_PLACEHOLDERS` no loop `jsonPath.split('.')` já existente

---

## 8. Checklist de Implementação

### Fase 1 — Database Migration
- [ ] Nova migration removendo `nome_envolvido`, `numero_bo`, `numero_ip`, `lacre_entrada`, `lacre_saida` da tabela `reps`
- [ ] Atualizar `CURRENT_SCHEMA_VERSION`
- [ ] Atualizar `REPRow` em `database.ts`
- [ ] Atualizar `rep.handlers.ts` (create/update)
- [ ] Atualizar `rep.schema.ts` (remover campos)

### Fase 2 — Remoção de campos nativos do frontend
- [ ] Remover `nome_envolvido`, `numero_bo`, `numero_ip`, `lacre_entrada`, `lacre_saida` do `REPFormData` em `types.ts`
- [ ] Remover campos do JSX (Dados da Solicitação e Documentos Associados) em `REPsPage.tsx`
- [ ] Remover do `emptyForm()`, `FIELD_PLACEHOLDER`, `repFormSchema`, `prepareForApi()`, `handleEditar().form.reset()`
- [ ] Remover referências no `mapping` do `aplicarPlaceholders()` em `LaudosPage.tsx`

### Fase 3 — Componente B-602 + Service
- [ ] Criar `src/renderer/components/rep/exam-fields/b602.tsx`
  - [ ] `DadosInvestigacaoFields` com envolvidos dinâmicos (1-10)
  - [ ] `MaterialEncFields` com toggle + linhas + Item auto-incremental
  - [ ] `CartuchosFields` com toggle + linhas
  - [ ] `EstojosFields` com toggle + linhas (sem projetil)
- [ ] Criar `src/renderer/components/rep/exam-fields/services/b602.service.ts`
  - [ ] `serialize()` com exclusão condicional de toggles desligados
  - [ ] `deserialize()` populando arrays de linhas e estado dos toggles
  - [ ] `fieldDefaults` e `fieldMasks`

### Fase 4 — Registry + Tipos + Placeholders
- [ ] Adicionar 4 entradas ao `SECTION_REGISTRY` em `exam-fields/index.ts`
- [ ] Mapear `'B-602': [...]` no `EXAM_FIELD_MAP`
- [ ] Registrar `b602Service` no `EXAM_SERVICE_REGISTRY`
- [ ] Adicionar campos B-602 ao `REPFormData` em `exam-fields/types.ts`
- [ ] Adicionar `cat-exam-B-602` ao `EXAM_PLACEHOLDER_CATEGORIES`
- [ ] Adicionar placeholders B-602 ao `CAMPOS_ESPECIFICOS_PLACEHOLDERS`
- [ ] Atualizar seed no `placeholder.service.ts` (remover nativos, adicionar B-602)

### Fase 5 — REPsPage.tsx — Adições B-602
- [ ] `emptyForm()` — adicionar defaults B-602
- [ ] `FIELD_PLACEHOLDER` — adicionar entradas B-602
- [ ] `repFormSchema` — campos B-602 opcionais + superRefine condicional (BO ou IP, envolvidos, etc.)
- [ ] `form.trigger()` — paths B-602
- [ ] `handleEditar()` — campos B-602 no `form.reset()`
- [ ] Integrar toggles com stepper (filtrar dynamic steps)

### Fase 6 — Resolução no Laudo
- [ ] `aplicarPlaceholders()` — suporte a placeholders de tabela (`b602_tabela_*`)
- [ ] `aplicarPlaceholders()` — suporte a `b602_envolvido_N` (array index)

### Fase 7 — Build & Verificação
- [ ] `npm run build` compila sem erros
- [ ] `npm run lint` sem novos erros
- [ ] Testar: nova REP com B-602, preencher campos, salvar, editar
- [ ] Testar: toggles liga/desliga, linhas múltiplas, validação condicional
- [ ] Testar: placeholders na PlaceholdersPage
- [ ] Testar: preview PDF com placeholders B-602 resolvidos
