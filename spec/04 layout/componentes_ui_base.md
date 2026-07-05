# Componentes base de UI

## Escopo

`src/renderer/components/ui/` concentra os wrappers compartilhados do design system local.
Os arquivos auditados com cobertura faltante hoje sao:

- `badge.tsx`
- `button.tsx`
- `card.tsx`
- `context-menu.tsx`
- `dialog.tsx`
- `dropdown-menu.tsx`
- `select.tsx`
- `sheet.tsx`
- `sidebar.tsx`
- `table.tsx`
- `textarea.tsx`

## Papel da camada `ui/`

Essa pasta cumpre tres funcoes no estado atual:

1. encapsular primitivas Radix/shadcn
2. padronizar classes e variantes com `cn` e, quando necessario, `cva`
3. impedir que paginas e features importem Radix cru diretamente para casos comuns

## Componentes por grupo

### Acoes e status

- `button.tsx`: botao com variantes e tamanhos reutilizados pela aplicacao inteira
- `badge.tsx`: pills de status, filtros e rotulos curtos

### Containers

- `card.tsx`: casca base para blocos de pagina, metricas, dialogs internos e areas informativas
- `table.tsx`: wrappers semanticos para tabela, header, body, row e cell

### Entrada de dados

- `select.tsx`: wrapper de Select usado em formularios, filtros e configuracoes
- `textarea.tsx`: textarea com a mesma linguagem visual dos inputs do projeto

### Sobreposicoes e menus

- `dialog.tsx`: base para modais de confirmacao, formularios e previews
- `sheet.tsx`: painel lateral usado por fluxos como assistencia de IA
- `dropdown-menu.tsx`: menus de acao compactos
- `context-menu.tsx`: menus contextuais, inclusive no editor

### Navegacao estrutural

- `sidebar.tsx`: primitives da barra lateral usada pelo layout principal

## Regra de uso no projeto

O renderer deve preferir esses wrappers a importar componentes Radix diretamente quando ja houver equivalente em `ui/`.

Isso garante:

- consistencia visual
- consistencia de comportamento
- manutencao centralizada de classes

## Relacao com `globals.css`

Os wrappers de `ui/` vivem combinados com as variaveis e tokens definidos em `src/renderer/styles/globals.css`.
O projeto nao cria CSS avulso por componente para esses casos; a camada `ui/` assume a composicao via classes Tailwind e tokens globais.

## Regra pratica

Quando uma feature precisa de:

- botao padrao
- card padrao
- dialog
- menu
- select
- sidebar

o caminho esperado e reutilizar `src/renderer/components/ui/*`.
So vale abrir nova abstracao de estilo quando o padrao base nao for suficiente e a diferenca fizer sentido para mais de um fluxo.
