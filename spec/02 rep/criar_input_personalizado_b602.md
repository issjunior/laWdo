# Plano: Campos Personalizados B-602 (Eficiência e Prestabilidade)

> **Status:** Implementado (2026-06-11)
> **Baseado em:** `criar_input_personalizados_exame.md` (guia de 4 passos), `ciclo_placeholder.md` (ciclo completo de placeholder)
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
| 7 | Arma | Toggle + sub-toggles | Sim — "Possui Arma?" com sub-seções "Funcionamento e Eficiência" e "Coleta de Padrões Balísticos" |

### Comportamento dos Toggles

- **Padrão inicial:** todos **desligados** (seções 4-7 ocultas do stepper)
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
| `b602_envolvidos_0`...`b602_envolvidos_9` | Envolvido(s) | Array de text inputs (1-10) | Sim | Botao "+" adiciona, "X" remove. Min 1, max 10. Placeholder "Nome do envolvido". Ao editar REP com dados salvos, linhas expandem automaticamente via lazy initializer no `useState`. |
| `b602_data_ocorrencia` | Data da Ocorrência | date | Sim | |
| `b602_local_bairro` | Bairro | text | Não | Placeholder "Bairro" |
| `b602_local_cidade` | Cidade | text | Sim | Placeholder "Cidade" |
| `b602_local_uf` | UF | select (UF_OPTS) | Sim | Dropdown com 27 UFs (AC, AL, AP, ... TO) |
| `b602_numero_bo` | Nº do BO | text (máscara) | BO ou IP* | Máscara `AAAA/NNNNNN` (reutilizar `formatarNumeroBO`) |
| `b602_numero_ip` | Nº do IP | text | BO ou IP* | |
| `b602_solicitante_nome` | Unidade Policial | text (disabled) | Não | Auto-preenchido via `useEffect` que observa `solicitante_id`. Campo `disabled` com tooltip "Preenchido automaticamente com o nome do Solicitante selecionado acima." |

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

### 2.5 Seção: Arma (toggle + sub-toggles)

**Toggle pai:** `b602_armas_toggle` — "Possui Arma?"

**Sub-toggles** (controlam sub-tabelas dentro da seção Arma):

| Toggle | `id` | `subtitulo` (usado no `<h3>` do bloco condicional) |
|---|---|---|
| Funcionamento e Eficiência | `b602_armas_funcionamento_toggle` | `FUNCIONAMENTO E EFICIÊNCIA` |
| Coleta de Padrões Balísticos | `b602_armas_coleta_toggle` | `COLETA DE PADRÕES BALÍSTICOS` |

O campo `subtitulo` é usado pelo editor de laudo como texto do `<h3 data-cond-bloco>` quando o condicional é inserido.

**Campos por linha da tabela `armas` (todos obrigatórios exceto observação):**

| name (sufixo `_{n}`) | Label | Tipo | Opções / Padrão |
|---|---|---|---|
| `num_lacre` | Nº do Lacre | text | — |
| `marca` | Marca | text | — |
| `calibre` | Calibre | dropdown | .380 AUTO, 9 mm Luger, .38 SPL |
| `capacidade` | Capacidade | text | — |
| `tipo` | Tipo | dropdown | Artesanal, Carabina, Espingarda, Garrucha, Pistola, Revólver |
| `funcionamento` | Funcionamento | dropdown | Automático, Semiautomático, Repetição, Ação por alavanca, Ação por bombeamento |
| `observacao` | Observação | checkbox múltiplo (não obrigatório) | Intacto, NTA, Picotado, Percutido, Não deflagrado |

### 2.6 `ExamToggle` — interface completa

```ts
export interface ExamToggle {
  id: string;             // identificador único do toggle
  label: string;          // label visível no formulário
  subtitulo?: string;     // texto do <h3> no bloco condicional do editor
  sectionId?: string;     // id da seção no SECTION_REGISTRY (se houver)
  subToggles?: ExamToggle[]; // sub-toggles aninhados (ex: Funcionamento, Coleta)
}
```

### 2.7 `EXAM_TOGGLES` — registro

```ts
export const EXAM_TOGGLES: Record<string, ExamToggle[]> = {
  'B-602': [
    { id: 'b602_cartuchos_toggle', label: 'Cartuchos', subtitulo: 'DOS CARTUCHOS', sectionId: 'cartuchos' },
    { id: 'b602_estojos_toggle', label: 'Estojos', subtitulo: 'DOS ESTOJOS', sectionId: 'estojos' },
    {
      id: 'b602_armas_toggle', label: 'Arma', subtitulo: 'DA ARMA', sectionId: 'armas',
      subToggles: [
        { id: 'b602_armas_funcionamento_toggle', label: 'Funcionamento e Eficiência', subtitulo: 'FUNCIONAMENTO E EFICIÊNCIA' },
        { id: 'b602_armas_coleta_toggle', label: 'Coleta de Padrões Balísticos', subtitulo: 'COLETA DE PADRÕES BALÍSTICOS' },
      ],
    },
  ],
};
```

---

## 3. Estrutura JSON (`campos_especificos`)

```json
{
  "b602": {
    "envolvidos": ["João Silva", "Maria Souza"],
    "data_ocorrencia": "2026-03-15",
    "local": { "bairro": "Centro", "cidade": "Curitiba", "uf": "PR" },
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
    ],
    "armas": [
      {
        "num_lacre": "XYZ789",
        "marca": "Taurus",
        "calibre": "9 mm Luger",
        "capacidade": "17",
        "tipo": "Pistola",
        "funcionamento": "Semiautomático",
        "observacao": ["Intacto"]
      }
    ],
    "armas_funcionamento": [
      {
        "num_lacre": "XYZ789",
        "resultado": "Eficiente",
        "observacao": "Disparo de prova realizado"
      }
    ],
    "armas_coleta": [
      {
        "num_lacre": "XYZ789",
        "padrao": "Microcomparação",
        "observacao": "Projétil e estojo coletados"
      }
    ]
  }
}
```

**Serialização condicional:** Arrays `material_enc`, `cartuchos`, `estojos`, `armas`, `armas_funcionamento`, `armas_coleta` só são incluídos no JSON se o toggle correspondente estiver ligado **e** houver dados preenchidos.

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
| `b602_tabela_armas` | Tabela HTML Armas (inclui funcionamento e coleta se ativos) |

### 4.2 Dados da Investigação (singletons)

| Chave | Valor |
|---|---|
| `b602_envolvidos` | Lista de envolvidos (texto) |
| `b602_envolvido_1`...`b602_envolvido_10` | Envolvido individual |
| `b602_data_ocorrencia` | Data formatada |
| `b602_local` | Local completo (bairro / cidade / UF) |
| `b602_local_bairro` | Bairro do local da ocorrência |
| `b602_local_cidade` | Cidade do local da ocorrência |
| `b602_local_uf` | UF do local da ocorrência |
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

### 4.6 Armas (células por linha)

| Chave | Valor |
|---|---|
| `b602_arma_{N}_num_lacre` | Nº do Lacre |
| `b602_arma_{N}_marca` | Marca |
| `b602_arma_{N}_calibre` | Calibre |
| `b602_arma_{N}_capacidade` | Capacidade |
| `b602_arma_{N}_tipo` | Tipo |
| `b602_arma_{N}_funcionamento` | Funcionamento |
| `b602_arma_{N}_observacao` | Observação |

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
   ├── 📊 Estojos
   │   ├── {{b602_tabela_estojos}}
   │   └── ...
   └── 📊 Armas
       ├── {{b602_tabela_armas}}
       ├── Arma 1 ──┐
       │   ├── {{b602_arma_1_num_lacre}}
       │   ├── {{b602_arma_1_marca}}
       │   ├── {{b602_arma_1_calibre}}
       │   ├── {{b602_arma_1_capacidade}}
       │   ├── {{b602_arma_1_tipo}}
       │   ├── {{b602_arma_1_funcionamento}}
       │   └── {{b602_arma_1_observacao}}
       └── Arma N ── (dinâmico)
```

### `B602_MENU_STRUCTURE` — localização

A constante `B602_MENU_STRUCTURE` e seus tipos auxiliares (`MenuSection`, `MenuEntry`, `MenuGroup`, `MenuField`, `MenuSectionItem`) estão em:

- **Estrutura do menu:** `src/renderer/components/rep/exam-fields/b602.tsx` (export)
- **Tipos:** `src/renderer/components/rep/exam-fields/types.ts`
- **Registro:** `src/renderer/components/rep/exam-fields/index.ts` → `EXAM_MENU_REGISTRY['B-602']`

> **Nota:** O arquivo `b602-menu.ts` foi eliminado por modularização excessiva. Seu conteúdo foi incorporado ao `b602.tsx` e `types.ts`.

### Seções do menu B-602

A estrutura cobre 5 seções:

1. `dados_investigacao` — field `b602_tabela_dados_investigacao`, group `Envolvidos` (prefix `b602_envolvido_`) + singletons
2. `material_enc` — field `b602_tabela_material_enc`, group `Item` (prefix `b602_material_enc_`)
3. `cartuchos` — field `b602_tabela_cartuchos`, group `Cartucho` (prefix `b602_cartucho_`)
4. `estojos` — field `b602_tabela_estojos`, group `Estojo` (prefix `b602_estojo_`)
5. `armas` — field `b602_tabela_armas`, group `Arma` (prefix `b602_arma_`)

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
'B-602': ['dados_investigacao', 'material_enc', 'cartuchos', 'estojos', 'armas'],
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

#### ✅ Correção: Renderização de tabelas no preview (2026-06-09)

**Bug:** Placeholders de tabela (`b602_tabela_*`) eram exibidos como texto escapado (`&lt;table&gt;...`) no preview/PDF em vez de renderizar como tabela HTML.

**Causa:** `aplicarPlaceholders()` linha 309 usava `span.replaceWith(valor)` — o método `ChildNode.replaceWith(string)` trata o argumento como texto puro, não como HTML. O HTML da tabela era injetado como nó de texto e escapado na serialização.

**Correção:** `LaudosPage.tsx:308` — trocado `span.replaceWith(valor)` por:
```ts
span.replaceWith(doc.createRange().createContextualFragment(valor));
```
`createContextualFragment` faz parse do HTML e cria nós DOM reais. Funciona universalmente para qualquer valor de placeholder (texto puro ou HTML), cobrindo tabelas do B-602 e futuros tipos de exame com valores HTML.

#### ✅ Layout das Tabelas B-602 (2026-06-09)

As 4 tabelas do B-602 foram redesenhadas com layout profissional formal e coluna `Item` auto-incremental.

**Arquivo:** `src/renderer/pages/LaudosPage.tsx`

**Funções implementadas:**

| Função | Escopo | Descrição |
|--------|--------|-----------|
| `TABLE_STYLES` | Módulo | Objeto com estilos `table`, `title`, `th`, `td`, `item` |
| `style(obj)` | Módulo | Converte objeto camelCase → string CSS inline |
| `buildNumberedTable(titulo, headers, rows)` | Módulo | Gera tabelas 2–4 com título + cabeçalho + Item sequencial |
| `buildDadosInvestigacaoTable(b602)` | Módulo | Gera TABELA 1 com layout customizado de 5 linhas e colspan |

**Estilos unificados:**

| Elemento | Fundo | Texto | Borda |
|----------|-------|-------|-------|
| Título da tabela | `#d9d9d9` | `#000` negrito, centralizado | `1px solid #000` |
| Cabeçalho (`<th>`) | `#e8e8e8` | `#000`, `font-weight:600`, centralizado | `1px solid #000` |
| Células (`<td>`) | transparente | `#000`, `font-size:12px` | `1px solid #000` |
| Coluna Item | idem `<td>` | centralizado, `width:50px` | `1px solid #000` |

**Layout de cada tabela:**

**TABELA 1 – DADOS DA INVESTIGAÇÃO** (`buildDadosInvestigacaoTable`):
```
┌──────────────────────────────────────────────────────────┐
│              TABELA 1 – DADOS DA INVESTIGAÇÃO             │  ← colspan=4, #d9d9d9
├──────────────┬───────────────────────────────────────────┤
│ Envolvido(s):│ valor (colspan=3)                         │  ← label 25%, negrito
├──────────────┬────────────────┬──────────────┬───────────┤
│ Data da Oco: │ valor (25%)    │ Local:       │ valor     │  ← 4 col iguais
├──────────────┼────────────────┼──────────────┼───────────┤
│ Boletim de   │ valor (25%)    │ Nº do IP:    │ valor     │
│ Ocorrência:  │                │              │           │
├──────────────┴────────────────┬───────────────────────────────┤
│ Unidade Policial: (colspan=1) │ valor (colspan=3)             │  ← 25%/75%
└───────────────────────────────┴───────────────────────────────┘
```
- 5 linhas fixas, layout com colspan variável por linha
- Labels em `<td>` com `font-weight:600`, sem `<thead>`
- Células vazias → `-`
- Linha 1: título centralizado

**TABELA 2 – MATERIAL ENCAMINHADO** (`buildNumberedTable`):
```
┌────┬──────────┬─────┬──────┬─────────────────┬───────────┐
│               TABELA 2 – MATERIAL ENCAMINHADO             │  ← #d9d9d9
├────┼──────────┼─────┼──────┼─────────────────┼───────────┤
│Item│Natureza  │ Qtd │ Tipo │ Dito do Ofício  │Nº do Lacre│  ← #e8e8e8
├────┼──────────┼─────┼──────┼─────────────────┼───────────┤
│  1 │ Arma     │ 01  │Pistola│"texto"          │ ABC123    │
├────┼──────────┼─────┼──────┼─────────────────┼───────────┤
│  N │ ...      │ ... │ ...  │ ...             │ ...       │  ← dinâmico
└────┴──────────┴─────┴──────┴─────────────────┴───────────┘
```

**TABELA 3 – CARTUCHOS** (`buildNumberedTable`):
```
┌────┬─────┬─────────┬───────┬────────┬──────────┬───────┬──────────────────┬───────────┐
│                                  TABELA 3 – CARTUCHOS                                    │
├────┼─────┼─────────┼───────┼────────┼──────────┼───────┼──────────────────┼───────────┤
│Item│ Qtd │ Calibre │ Marca │ Origem │ Espoleta │Estojo │ Projétil         │ Observação│
├────┼─────┼─────────┼───────┼────────┼──────────┼───────┼──────────────────┼───────────┤
│  1 │ 10  │ 9 mm L  │ CBC   │ Brasil │ Latonada │Laton. │ ETOG – Encamisa..│ Intacto   │
└────┴─────┴─────────┴───────┴────────┴──────────┴───────┴──────────────────┴───────────┘
```

**TABELA 4 – ESTOJOS** (`buildNumberedTable`):
```
┌────┬─────┬─────────┬───────┬────────┬──────────┬───────┬───────────┐
│                         TABELA 4 – ESTOJOS                              │
├────┼─────┼─────────┼───────┼────────┼──────────┼───────┼───────────┤
│Item│ Qtd │ Calibre │ Marca │ Origem │ Espoleta │Estojo │ Observação│
├────┼─────┼─────────┼───────┼────────┼──────────┼───────┼───────────┤
│  1 │ 5   │ .38 SPL │Aguila │Argentina│Niquelada│Niquel.│ Percutido │
└────┴─────┴─────────┴───────┴────────┴──────────┴───────┴───────────┘
```

**Correção de ordem `<thead>` (2026-06-09):** O título das TABELAS 2–4 estava fora do `<thead>`, fazendo o navegador renderizá-lo após o cabeçalho. Movido para dentro do `<thead>` como primeira `<tr>`, garantindo a ordem correta: título → cabeçalho → dados.

**Comportamento:**
- Toggle desligado → array vazio → `buildNumberedTable` retorna `''` → placeholder some do preview
- Células vazias → `-` (travessão)
- Coluna Item: numeração sequencial automática (`1`, `2`, `3`...), largura fixa `50px`, centralizada
- Título e cabeçalho no `<thead>` → repetem no topo se a tabela quebrar entre páginas do PDF

**Ajustes de alinhamento (2026-06-09):**
- Cabeçalho das TABELAS 2–4: `textAlign: center` — todas as colunas (`Item`, `Natureza`, `Qtd`, etc.) centralizadas
- TABELA 1, linha 5: `Unidade Policial:` reduzido para 25% de largura (`colspan=1`), nome do solicitante ocupa 75% (`colspan=3`)

---

## 8. Checklist de Implementação

### Fase 1 — Database Migration ✅
- [x] Nova migration (v23) removendo `nome_envolvido`, `numero_bo`, `numero_ip`, `lacre_entrada`, `lacre_saida` da tabela `reps`
- [x] Atualizar `CURRENT_SCHEMA_VERSION`
- [x] Atualizar `REPRow` em `database.ts`
- [x] Atualizar `rep.handlers.ts` (create/update)
- [x] Atualizar `rep.schema.ts` (remover campos)

### Fase 2 — Remoção de campos nativos do frontend ✅
- [x] Remover `nome_envolvido`, `numero_bo`, `numero_ip`, `lacre_entrada`, `lacre_saida` do `REPFormData` em `types.ts`
- [x] Remover campos do JSX em `REPsPage.tsx` (substituído Accordion por Stepper)
- [x] Remover do `emptyForm()`, `FIELD_PLACEHOLDER`, `repFormSchema`, `prepareForApi()`, `handleEditar().form.reset()`
- [x] Remover referências no `mapping` do `aplicarPlaceholders()` em `LaudosPage.tsx`

### Fase 3 — Componente B-602 + Service ✅
- [x] Criar `src/renderer/components/rep/exam-fields/b602.tsx`
  - [x] `DadosInvestigacaoFields` com envolvidos dinâmicos (1-10)
  - [x] `MaterialEncFields` com toggle + linhas + Item auto-incremental
  - [x] `CartuchosFields` com toggle + linhas
  - [x] `EstojosFields` com toggle + linhas (sem projetil)
- [x] Criar `src/renderer/components/rep/exam-fields/services/b602.service.ts`
  - [x] `serialize()` com exclusão condicional de toggles desligados
  - [x] `deserialize()` populando arrays de linhas e estado dos toggles
  - [x] `fieldDefaults` e `fieldMasks`

### Fase 4 — Registry + Tipos + Placeholders ✅
- [x] Adicionar 4 entradas ao `SECTION_REGISTRY` em `exam-fields/index.ts`
- [x] Mapear `'B-602': [...]` no `EXAM_FIELD_MAP`
- [x] Registrar `b602Service` no `EXAM_SERVICE_REGISTRY`
- [x] Adicionar campos B-602 ao `REPFormData` em `exam-fields/types.ts`
- [x] Adicionar `cat-exam-B-602` ao `EXAM_PLACEHOLDER_CATEGORIES`
- [x] Adicionar placeholders B-602 ao `CAMPOS_ESPECIFICOS_PLACEHOLDERS`
- [x] Atualizar seed no `placeholder.service.ts` (com B-602)

### Fase 5 — REPsPage.tsx — Adições B-602 ✅
- [x] `emptyForm()` — adicionar defaults B-602
- [x] `FIELD_PLACEHOLDER` — adicionar entradas B-602
- [x] `repFormSchema` — campos B-602 opcionais + superRefine condicional (BO ou IP, envolvidos, etc.)
- [x] `form.trigger()` — paths B-602
- [x] `handleEditar()` — campos B-602 no `form.reset()` (via `...especificos`)
- [x] Integrar com stepper (dynamic steps baseados no tipo de exame)

### Fase 6 — Resolução no Laudo ✅
- [x] `aplicarPlaceholders()` — suporte a placeholders de tabela (`b602_tabela_*`) — **corrigido 2026-06-09**: `createContextualFragment` no lugar de `replaceWith(string)`
- [x] `aplicarPlaceholders()` — suporte a `b602_envolvido_N` (array index)

### Fase 7 — Build & Verificação ✅
- [x] `npm run build` compila sem erros (2138 módulos)
- [x] `npm run lint` sem novos erros
- [x] Testar: nova REP com B-602, preencher campos, salvar, editar
- [x] Testar: toggles liga/desliga, linhas múltiplas, validação condicional
- [x] Testar: placeholders na PlaceholdersPage
- [x] Testar: preview PDF com placeholders B-602 resolvidos

---

## 9. Ajustes de Layout e Arquitetura (2026-06-12)

### 9.1 Layout: card com flexbox responsivo

`DadosInvestigacaoFields` usa card (`border rounded-lg p-4 bg-muted/30 space-y-4 overflow-hidden`).

**Linhas individuais** (envolvidos, data+local, BO+IP, unidade):
flexbox responsivo (`flex flex-col md:flex-row gap-2 items-start`), com labels
`shrink-0 md:w-[150px] md:pt-2.5` (ou `md:w-[60px]` para labels curtos) e inputs
em `flex-1 min-w-0 w-full`.

**Grids de 2 colunas** (Data+Local, BO+IP): `grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0`.

Labels obrigatorios mantem `*` mas erros de validacao so aparecem ao tentar salvar (ver 9.3).

Nova ordem: Envolvidos | Data Ocorrencia + Local | BO + IP | Unidade Policial.

Botao "+" (`h-8 w-8`, apenas icon `Plus`) inline ao lado do ultimo input de envolvido.
Botao "X" (`h-8 w-8`, apenas icon `X`) visivel quando `envolvidos.length > 1`.

### 9.2 Mascara Local

Input `b602_local` ganhou mascara ativa `formatarLocal()`: ao digitar `/`,
normaliza para ` / `. Maximo 3 segmentos (bairro opcional / cidade / UF).

### 9.3 Validacao: onChange → onSubmit

`useForm` em `REPsPage.tsx` alterado de `mode: 'onChange'` para `mode: 'onSubmit'`.
Erros de validacao Zod so aparecem apos tentativa de salvar. Apos o primeiro
submit, react-hook-form re-ativa `onChange` para campos corrigidos.

`useEffect` com `form.trigger()` removido (linhas 580-585), pois com `onSubmit`
dispararia erros imediatamente.

### 9.4 Uniao `b602-menu.ts` → `b602.tsx`

Arquivo `b602-menu.ts` (130 linhas) eliminado por modularizacao excessiva:

| Conteudo | Destino |
|----------|---------|
| `B602_MENU_STRUCTURE` | `b602.tsx` (export) |
| Tipos `MenuSection`, `MenuEntry`, `MenuGroup`, `MenuField`, `MenuSectionItem` | `types.ts` |
| `getGroupCount()` | `services/b602.service.ts` (export) |

Ajustes:
- `index.ts`: importa `B602_MENU_STRUCTURE` de `./b602`, tipos de `./types`
- `PlaceholderContextMenu.tsx`: importa `getGroupCount` de `services/b602.service`

### 9.5 Label: Solicitante → Unidade Policial

Label do campo `b602_solicitante_nome` alterado para "Unidade Policial"
no form (`b602.tsx`) e no menu de contexto (mesmo arquivo apos uniao).
Nome do campo no banco e tipos mantidos inalterados.

### 9.6 Auto-expansao de linhas na edicao (2026-06-13)

Ao editar uma REP B-602 com dados ja salvos, as linhas de envolvidos, material encaminhado,
cartuchos e estojos **expandem automaticamente** na primeira renderizacao, sem flash visual.
Isso resolve o problema de abrir o form de edicao mostrando apenas 1 linha quando ha
multiplos itens salvos.

**Mecanismo:** lazy initializer no `useState` que le `form.getValues()` durante a
inicializacao do componente, ja que `form.reset()` ocorre antes de `setShowForm(true)`
em `handleEditar`.

```tsx
// DadosInvestigacaoFields (b602.tsx)
const [numEnvolvidos, setNumEnvolvidos] = useState(() => {
  let maxIndex = 0;
  for (let i = 0; i < 10; i++) {
    const valor = form.getValues(`b602_envolvidos_${i}` as any);
    if (valor && typeof valor === 'string' && valor.trim() !== '') {
      maxIndex = i;
    }
  }
  return Math.max(1, maxIndex + 1);
});
```

Mesmo padrao aplicado nos 4 componentes: `DadosInvestigacaoFields`, `MaterialEncFields`,
`CartuchosFields`, `EstojosFields`.

**useEffect complementar:** adicionado `useEffect` com `form.watch` nos mesmos componentes
para lidar com expansao/retracao durante edicao manual (botoes +/-). O `useEffect` observa
os campos via `watch` e ajusta `numLinhas`/`numEnvolvidos` se necessario.

### 9.7 Layout responsivo e Unidade Policial (2026-06-13)

**Layout responsivo** nos campos de `DadosInvestigacaoFields`:
- Grid `flex flex-col md:flex-row` com labels `shrink-0 md:w-[150px]`
- Inputs em `flex-1 min-w-0 w-full` para evitar overflow
- Container com `overflow-hidden` e `space-y-4`

**Unidade Policial** (`b602_solicitante_nome`):
- Campo `disabled` com `className="bg-muted cursor-not-allowed"` e placeholder "Preenchido automaticamente"
- Tooltip via `Tooltip`/`TooltipTrigger`/`TooltipContent` explicando: "Preenchido automaticamente com o nome do Solicitante selecionado acima."
- Auto-preenchimento via `useEffect` em `REPsPage.tsx` que observa `form.watch('solicitante_id')` → `form.setValue('b602_solicitante_nome', solicitante.nome)`
- Validacao Zod removida (`b602_solicitante_nome` nao e mais obrigatorio para B-602)
- Preview HTML (`buildRepHtml`) usa fallback: `solicitanteNome || s(b602.solicitante_nome)`

**Botoes Adicionar/Remover:**
- Botao "+" alterado de `variant="outline" size="sm"` com texto "Adicionar" para `variant="outline" size="icon" className="h-8 w-8"` apenas com icone `Plus`
- Botao "X" mantido como `variant="ghost" size="icon" className="h-8 w-8"` apenas com icone `X`
