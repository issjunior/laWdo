# Redesign Dark Mode — Correções de Visibilidade

## 🐛 Bug Crítico Encontrado

**Seletor CSS `.dark body` nunca funcionou!**

```css
/* ❌ ANTES — seletor descendente: "body dentro de .dark" */
.dark body {
  color: #e4edf8; /* NUNCA aplicado */
}

/* ✅ DEPOIS — seletor composto: "body COM classe .dark" */
body.dark {
  color: #e4edf8; /* Agora funciona! */
}
```

O `document.body.classList.add('dark')` coloca a classe **no próprio body**. O seletor `.dark body` procura um `<body>` **dentro** de um elemento `.dark` — que não existe. Por isso o `body { color: #181f2e }` (cor escura do light mode) sempre ganhava, causando textos invisíveis.

## Correções Realizadas

### 1. Seletor `body.dark` — [globals.css:99](file:///c:/Users/Jr/Documents/Codigos/LaudoPericial/src/renderer/styles/globals.css#L98-L102)

```diff
-  .dark body {
+  body.dark {
     background-color: #0d1220;
     color: #e4edf8;
   }
```

### 2. Tipografia explícita em dark mode

Adicionados overrides para **todas** as tags de texto, garantindo visibilidade independente de herança:

| Elemento | Cor Dark |
|---|---|
| `h1, h2, h3, h4` | `#f1f5f9` (quase branco) |
| `label`, `.text-sm.font-medium` | `#d8e2ee` |
| `p` | `#c8d5e4` |
| Dialog `h2/h3/label/p` | `#e4edf8` |

### 3. Botões com texto visível

- `button` genérico em dark: `#e4edf8` (brilhante)
- Botões com `bg-primary`: cor escura para contraste no azul
- Botões `bg-destructive`: branco puro

Isso corrige o botão "Apenas Ativos" (`variant="outline"`) que herdava `#181f2e` do body.

### Build
- ✅ Compilou sem erros (46.10 kB CSS)
