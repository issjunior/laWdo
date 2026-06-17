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

## Tema do TinyMCE Editor — Sincronização com Header

O tema do editor TinyMCE segue **exclusivamente** o toggle do Header (`body.dark`). Não há mais toggle independente de tema nas páginas com editor.

### Mecanismo (MutationObserver)

**Arquivo:** `src/renderer/components/editor/TinyMceEditor.tsx`

1. **Inicialização fixa**: skin `oxide` (light) e `content_css` `content/default/content.css` — sem condicional.
2. **No `editor.on('init')`**: verifica `body.dark` atual e aplica imediatamente via `aplicarTemaEditor()`.
3. **`MutationObserver`** no `document.body` (atributo `class`): ao detectar toggle de `.dark`, chama `aplicarTemaEditor()`.
4. **Sem `key={resolved}`**: o editor nunca remonta — cursor, conteúdo e undo history preservados.

### Funções auxiliares (module-level)

| Função | Ação |
|--------|------|
| `ensureDarkSkin()` | Injeta `<link id="tinymce-dark-skin">` com `oxide-dark/skin.css` no `<head>` (se ainda não existe) |
| `removeDarkSkin()` | Remove o `<link id="tinymce-dark-skin">` do `<head>` |
| `aplicarTemaEditor(editor, dark)` | Se dark: `ensureDarkSkin()` + `editor.dom.addClass(body, 'dark-content')`; se light: `removeDarkSkin()` + `editor.dom.removeClass(body, 'dark-content')` |

### Estilos condicionais via classe CSS

O `content_style` usa seletores `body.dark-content` em vez de template literals com ternários:

```css
/* Sempre presente (light default) */
.placeholder-tag { background-color: #e8f0fe; color: #1a73e8; }
.campo-reservado { background-color: rgba(255,193,7,0.2); color: #b45309; }

/* Overrides dark */
body.dark-content { background-color: #222f3e; color: #fff; }
body.dark-content .placeholder-tag { background-color: rgba(138,180,248,0.15); color: #8ab4f8; }
body.dark-content .campo-reservado { background-color: rgba(255,193,7,0.15); color: #fbbf24; }
/* + tabelas, figcaption, hr, code, blockquote */
```

### Páginas afetadas

`TemplatesPage.tsx`, `CabecalhoPage.tsx`, `LaudosPage.tsx` — removido:
- Estado `editorTheme` + `localStorage('laudo_editor_theme')`
- Callback `toggleEditorTheme`
- Botão de alternância de tema na toolbar do editor (ícone Sun/Moon/SunMoon)
- Prop `theme={editorTheme}` dos `<TinyMceEditor>`

---

## Novos Componentes Visuais (2026-06)

### `FlickeringGrid` (`src/renderer/components/ui/flickering-grid.tsx`)

Componente canvas que renderiza um grid de quadrados piscantes animados. Usado como fundo decorativo nas páginas de autenticação.

| Prop | Tipo | Padrão | Descrição |
|------|------|--------|-----------|
| `squareSize` | `number` | `4` | Tamanho do quadrado em px |
| `gridGap` | `number` | `6` | Espaçamento entre quadrados |
| `flickerChance` | `number` | `0.3` | Probabilidade de cada quadrado piscar por frame |
| `color` | `string` | `"rgb(0,0,0)"` | Cor dos quadrados |
| `maxOpacity` | `number` | `0.3` | Opacidade máxima |

**Mecanismo:** `requestAnimationFrame` loop com `CanvasRenderingContext2D`, `IntersectionObserver` para pausar quando fora da viewport, `ResizeObserver` para redimensionar.

**Páginas que o utilizam:**
- `AuthPage.tsx` — fundo atrás do card de login/cadastro
- `LoginForm.tsx` e `FirstUserSetupForm.tsx` — herdado via AuthPage
- `DashboardPage.tsx` — fundo decorativo

### `Lens` (`src/renderer/components/ui/lens.tsx`)

Componente `motion` (framer-motion) que aplica uma máscara radial gradient de ampliação (`zoomFactor`) ao redor do cursor, criando um efeito de lupa. Usado no `IlustracoesPanel` para ampliar miniaturas de imagens.

| Prop | Tipo | Padrão | Descrição |
|------|------|--------|-----------|
| `children` | `ReactNode` | — | Conteúdo a ser ampliado |
| `zoomFactor` | `number` | `1.3` | Fator de zoom |
| `lensSize` | `number` | `170` | Tamanho da lente em px |
| `isStatic` | `boolean` | `false` | Se verdadeiro, usa posição fixa sem follow mouse |
| `lensColor` | `string` | `"black"` | Cor de fundo da lente |

**Mecanismo:** `motion.div` com `maskImage` radial gradient e `WebKitMaskImage`, coordenadas do mouse trackeadas via `onMouseMove`.

---

## Ajustes de Layout (2026-06)

### Logo

- `logo.jpg` (11.6 KB) substituído por `logo.png` (96.5 KB) — formato PNG com fundo transparente
- `AppSidebar.tsx` — logo ajustado para usar `logo.png` com classe `object-contain`

### AuthPage

- Layout reformulado: fundo com `FlickeringGrid`, card centralizado com sombra e vidro fosco
- `LoginForm.tsx` e `FirstUserSetupForm.tsx` — ajustes de padding, alinhamento e responsive breakpoints

### AppSidebar

- Logo com fundo transparente e altura fixa
- Sidebar gradient ajustado para melhor contraste com o novo logo
- Avatar do usuário com `AvatarUploadDialog` para troca de foto

### Header

- Botão dark mode inline (não mais em dropdown)
- Sidebar trigger reposicionado
- Ícone de informações do app em dialog
