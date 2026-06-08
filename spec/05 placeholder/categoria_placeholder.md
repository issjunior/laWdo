# Planejamento: Gerenciamento de Categorias de Placeholders

Este documento detalha o plano técnico para implementar a funcionalidade de criação, edição e exclusão de categorias de placeholders personalizadas pelo usuário, garantindo alta performance, segurança de dados e uma interface premium.

## Background e Decisões

A partir de um aprofundamento nos requisitos técnicos e na UX do sistema, definimos a seguinte abordagem arquitetural e visual:

1. **Estrutura de Banco de Dados Robusta:** Uma tabela dedicada `categorias_placeholders` será criada.
2. **Edição Segura de Categorias de Sistema:** Categorias de sistema ("REP", "Perito", "Todos", "Sem Categoria") terão suas `chave` e `label` travadas (readonly), mas o usuário poderá alterar suas cores e ícones.
3. **Design System Consistente:** A seleção de ícones será feita através de um Picker com uma lista curada (20 a 40 ícones do `lucide-react`) validada pelo backend. Para cores, limitaremos a escolha a um conjunto predefinido de estilos Tailwind (blue, red, emerald, violet, etc.), impedindo hexadecimais aleatórios que quebrem a harmonia visual.
4. **Exclusão Atômica e Segura:** Ao excluir uma categoria, um alerta pedirá confirmação para os placeholders nela inseridos. No backend, a migração dos placeholders para a categoria "Sem Categoria" e o delete da categoria de origem ocorrerão obrigatoriamente dentro de uma **transação atômica** (`BEGIN TRANSACTION`, `COMMIT`, `ROLLBACK`).
5. **Drag-and-Drop de Alta Performance:** Usaremos `@dnd-kit` com `framer-motion` (propriedade `layout`), combinados com um *debounce* nas chamadas de atualização para o backend para otimizar operações em lote no SQLite.
6. **Sincronização e Cache com `electron-store`:** A persistência da ordem das categorias e o cache local para renderização ultra-rápida do Menu de Contexto (antes mesmo do React estar totalmente hidratado) serão geridos via `electron-store`.

## Proposed Changes

### 1. Backend: Banco de Dados e IPC
- **Migration `categorias_placeholders`:** (id, chave UNIQUE, label UNIQUE, descricao, cor, icone, is_sistema, ordem).
- **Seed do Sistema:** Ao invés de strings hardcoded, o banco será populado com as categorias iniciais. Guardaremos o `id` (ou utilizaremos UUIDs fixos) da categoria "Sem Categoria" para facilitar as referências.
- **IPC Handlers & Transações Estritas:**
  - `findAll`, `create`, `update`, `delete`.
  - No `update`, aplicar *whitelisting*: se `is_sistema === true`, apenas os campos `cor` e `icone` podem ser modificados no banco.
  - No `create`/`update`, validar explicitamente se o nome do ícone enviado faz parte da lista permitida e se a cor é uma das paletas de Tailwind registradas.
  - No `delete`, abrir uma **transação atômica**:
    1. Buscar o `id` da categoria "Sem Categoria".
    2. Executar `UPDATE placeholders SET categoria_id = ? WHERE categoria_id = ?`.
    3. Executar `DELETE FROM categorias_placeholders WHERE id = ?`.
    4. Se falhar em qualquer passo, emitir `ROLLBACK`.
- **Placeholder Model:** Adicionar/atualizar referências para `categoria_id` e remover suporte à antiga string literal.

### 2. Frontend: PlaceholdersPage.tsx
#### [MODIFY] src/renderer/pages/PlaceholdersPage.tsx
- **Carregamento Otimista e Debounce:** Carregar os dados dinamicamente. Para o `onDragEnd` (Drag-and-Drop), o estado do React é atualizado de imediato. Um `setTimeout` gerenciará o debounce de 1~2 segundos para enviar a atualização massiva ao backend via lote.
- **Dnd-kit e Framer Motion:**
  - Áreas `Droppable` por categoria.
  - Cards `Draggable` usando `framer-motion` para animações fluidas na troca de colunas.
- **UI do "Gerenciar Categorias" (Modal):**
  - **Color Picker:** Renderizar botões (badges arredondados) com as cores disponíveis (ex: slate, red, amber, emerald, blue, indigo, violet, pink) baseadas no Tailwind.
  - **Icon Picker:** Um grid simplificado com 20-40 ícones populares predefinidos do `lucide-react`.
  - Formulário trava a edição do "Nome/Chave" quando for categoria do sistema, deixando livre apenas o seletor de cor e ícone.
- **Proteção de Exclusão:** Um `AlertDialog` bloqueante que exibe a contagem de placeholders associados à categoria, explicando que eles serão repassados para a "Sem Categoria".

### 3. Frontend: LaudosPage.tsx e Menu de Contexto
#### [MODIFY] src/main/ipc/store.ts (Criação de Store se necessário)
- Adicionar/Configurar o `electron-store` no Electron Main para lidar com as preferências das categorias.
#### [MODIFY] src/renderer/pages/LaudosPage.tsx
- **Menu de Contexto Instantâneo:** Ao inicializar a aplicação, tentar carregar do cache do `electron-store` a estrutura das categorias. Isso torna o carregamento do `ContextMenu` assíncrono muito mais responsivo, sem precisar realizar uma query pesada a cada clique direito.
- Sincronizar esse Store de Preferências através de IPC bidirecional sempre que as categorias sofrerem alterações (Create/Update/Delete ou reordenação).

## Verification Plan

### Automated/Manual Tests
1. **Transações (Atômicas):** Simular um erro artificialmente durante a deleção da categoria para assegurar que a query de `UPDATE placeholders` sofra `ROLLBACK` corretamente (pode ser verificado injetando erro temporário no SQLite e checando integridade dos dados).
2. **Edição de Categorias de Sistema:**
   - Abrir o Gerenciador de Categorias. Tentar mudar o título de "REP" (o campo deve estar disable).
   - Tentar contornar via console enviando request IPC para atualizar "REP" modificando chave. O backend deve recursar/filtrar silenciosamente ou lançar erro.
   - Mudar a cor da "REP" para vermelho. Salvar. Funciona.
3. **Menu de Contexto & electron-store:**
   - Apagar o banco de dados. Restaurar tudo e iniciar o aplicativo.
   - Criar uma nova categoria. Abrir um laudo e clicar no botão direito para validar que o cache refletiu imediatamente no menu, agrupando os dados com as cores certas.
4. **Validação Visual de Cores e Ícones:** Confirmar se as badges e as seleções de grid aparecem alinhadas visualmente com o padrão do painel (nada fora da paleta curada do Tailwind).

## Status da Execução

- [x] **Fase 1 (Backend):** Migration V15 criada (tabela `categorias_placeholders`), schema de `placeholders` atualizado com `categoria_id`, serviços e handlers IPC implementados e tipados no `preload`.
  - Service: `src/main/services/categoria-placeholder.service.ts` — CRUD com whitelist para categorias de sistema, delete atômico com transação, tree methods
  - Handlers: `src/main/ipc/handlers/categoria-placeholder.handlers.ts`
  - Migration v22 posterior adicionou `parent_id` para suporte a hierarquia (ver `novo_layout.md`)
- [x] **Fase 2 (Frontend):** `LaudosPage` — Context Menu dinâmico via componente `PlaceholderContextMenu` (`src/renderer/components/editor/PlaceholderContextMenu.tsx`) com suporte a single e multi-seção.
  - `PlaceholdersPage` — o layout Kanban (Drag-and-Drop de cards entre colunas) foi substituído pelo layout hierárquico 2-painéis documentado em `novo_layout.md`. O gerenciamento de categorias (Modal com ColorPicker + IconPicker) permanece via `ManageCategoriesModal`.

## Divergências da Implementação Final

| Aspecto | Planejado | Implementado |
|---------|-----------|--------------|
| Layout da PlaceholdersPage | Kanban com colunas `Droppable` e cards `Draggable` (dnd-kit) | Layout 2-painéis: `SortableCategoryTree` (árvore com drag para aninhar) + DataTable (ver `novo_layout.md`) |
| Drag-and-Drop | Movimentar placeholders entre colunas | Movimentar categorias na árvore (aninhamento hierárquico). Placeholders são atribuídos via select de categoria no formulário. |
| electron-store | Cache de categorias | Não implementado. Categorias são carregadas via `findArvore()` a cada inicialização da página. |

## Estrutura de Arquivos Resultante

```
src/
├── main/
│   ├── database/index.ts                  # Migrations v15 + v22 (parent_id)
│   ├── services/
│   │   ├── categoria-placeholder.service.ts  # CRUD + tree methods
│   │   └── placeholder.service.ts           # CRUD + seed sistema + seed exam-specific
│   └── ipc/handlers/
│       ├── categoria-placeholder.handlers.ts
│       └── placeholder.handlers.ts
├── preload/index.ts                       # IPC bridge (categoria.findArvore, placeholder.*)
└── renderer/
    ├── components/
    │   ├── editor/
    │   │   ├── TinyMceEditor.tsx           # insertPlaceholder cmd + conversão local
    │   │   └── PlaceholderContextMenu.tsx   # Menu de contexto reutilizável
    │   ├── placeholders/
    │   │   └── ManageCategoriesModal.tsx
    │   └── rep/exam-fields/
    │       └── placeholders.ts             # Manifest de placeholders de exame
    ├── lib/
    │   ├── utils.ts                        # converterPlaceholdersTextuais
    │   └── category-constants.ts           # ALLOWED_COLORS + ICON_CATEGORIES
    └── pages/
        ├── PlaceholdersPage.tsx            # Layout 2-painéis (SortableCategoryTree + DataTable)
        └── LaudosPage.tsx                  # aplicarPlaceholders (DOMParser) + PlaceholderContextMenu
```
