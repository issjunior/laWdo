# Scroll do Stepper — Espaçamento com Footer

> **Status:** ✅ Resolvido  
> **Data:** 20/06/2026  
> **Arquivos afetados:** `useRepStepper.ts`, `globals.css`

## Problema

Ao clicar nos passos do stepper no formulário de REP, o scroll levava até a seção correta, mas deixava **espaço vazio excessivo abaixo do footer** ou a seção ficava **colada no topo do viewport** sem folga.

## Causa

A troca de `main.scrollTo()` (com offset manual de 16px) por `el.scrollIntoView({ block: 'start' })` removeu dois comportamentos:

1. **Offset de 16px** — o cálculo manual tinha `main.scrollTop + elTop - mainTop - 16`. O `scrollIntoView` nativo não aplica offset.
2. **Controle de posicionamento** — `block: 'start'` sempre alinha o topo do elemento com o topo do scroll container, mesmo quando o elemento já está parcialmente visível. Isso pode causar over-scroll e espaço vazio no final do conteúdo.

## Solução

Duas mudanças complementares:

### 1. `useRepStepper.ts` — `block: 'nearest'` em vez de `block: 'start'`

```ts
// src/renderer/components/rep/useRepStepper.ts
el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
```

`block: 'nearest'` faz scroll somente do **mínimo necessário** para o elemento ficar visível. Se já está visível, não mexe. Isso evita over-scroll e o espaço vazio abaixo do footer.

### 2. `globals.css` — `scroll-margin-top` nos elementos `[data-step]`

```css
/* src/renderer/styles/globals.css */
[data-step] {
  scroll-margin-top: 16px;
}
```

Devolve a folga de 16px que o cálculo manual antigo provia. O browser respeita `scroll-margin` ao calcular a posição de scroll — é o equivalente nativo ao offset manual.

## Por que isso funciona

| Mecanismo | Efeito |
|-----------|--------|
| `block: 'nearest'` | Scroll mínimo — sem over-scroll, sem espaço vazio |
| `scroll-margin-top: 16px` | Folga de 16px acima da seção — respiro visual |

A combinação garante que:
- Seções acima do viewport → scroll até o topo com 16px de folga
- Seções abaixo do viewport → scroll até a base com 16px de folga
- Seções já visíveis → sem scroll (sem "pulos" desnecessários)

## Verificação

- [x] Scroll ao clicar nos passos do stepper funciona
- [x] Sem espaço vazio abaixo do footer
- [x] Seção alvo com 16px de respiro no topo
- [x] Scroll spy (IntersectionObserver) continua operando
- [x] Typecheck limpo

## Referências

- `spec/02 rep/steps_preenchimento_form.md` — especificação do stepper
- [`scrollIntoView` — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView)
- [`scroll-margin` — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-margin)
