# Componentes base de UI

## Escopo e regra de uso

`src/renderer/components/ui/` concentra wrappers compartilhados do design system local. Eles encapsulam primitivas Radix, shadcn e bibliotecas de layout, padronizam classes com `cn`/`cva` e evitam importações diretas quando já existe equivalente local. Estilos são compostos com Tailwind e tokens de `globals.css`; não há CSS avulso por componente.

## Grupos atuais

- Ações e status: `button.tsx`, `badge.tsx`.
- Containers e dados: `card.tsx`, `table.tsx`.
- Entrada: `select.tsx`, `textarea.tsx`.
- Sobreposições e menus: `dialog.tsx`, `sheet.tsx`, `dropdown-menu.tsx`, `context-menu.tsx`.
- Navegação: `sidebar.tsx`.
- Layout redimensionável: `resizable.tsx`, wrapper de `react-resizable-panels`.

`sheet.tsx` permanece disponível para fluxos em sobreposição, mas o Assistente IA do editor não usa Sheet, portal, overlay ou posicionamento fixo. O dock atual é composto por `PainelLateralRedimensionavel.tsx` sobre `resizable.tsx`, reserva espaço real e mantém o editor montado.

## Painéis, rolagem e sidebar

O layout do laudo mantém um trilho direito permanente e mostra um único dock integrado por vez. IA usa largura de 360 a 640 px e Ilustrações de 320 a 720 px. `use-largura-painel-persistida.ts` normaliza e persiste a largura em pixels somente após interação; aberto/recolhido não é persistido.

O conteúdo do laudo usa a rolagem da página, enquanto divisor e conteúdo lateral ficam `sticky`, a 1 rem do topo e com altura máxima de `100dvh - 3rem`. A rolagem de coleções internas, como a fila de ilustrações e as mensagens da IA, permanece contida no painel. Isso impede que a expansão do editor limite a viewport do dock, sem criar uma segunda rolagem para o documento.

O editor nunca recebe menos de 560 px. Quando um dock aberto não cabe junto ao editor e ao trilho, `PainelLateralRedimensionavel` calcula `560 + largura mínima do painel + 56` e pede ao controlador que o recolha via `ResizeObserver`. Esse recolhimento é uma proteção responsiva local: não altera a largura persistida, não desmonta o editor e o dock pode ser aberto novamente quando houver espaço.

A sidebar esquerda suporta recolhimento temporário enquanto o dock está expandido. Esse estado não altera o cookie da preferência normal; uma expansão manual prevalece durante a abertura atual e uma nova abertura do dock pode aplicar novamente o recolhimento temporário.

## Decisão de extensão

Features devem reutilizar wrappers existentes para botões, diálogos, menus, selects, sidebar e painéis redimensionáveis. Uma abstração nova só se justifica quando reduz duplicação real ou estabiliza um comportamento compartilhado; diferenças exclusivas de uma feature permanecem no componente da própria feature. Alterações no dock devem preservar, em conjunto, limites, persistência por interação, montagem estável do editor, rolagem externa do documento e recolhimento sob largura insuficiente.

Testes de layout cobrem limites, persistência de largura, trilho, montagem estável do editor e interação temporária com a sidebar; `painel-lateral-redimensionavel.component.test.tsx` cobre a estrutura sticky e o limiar mínimo.
