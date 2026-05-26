# Margens do PDF — Documentação de implementação

> **Data:** 2026-05-26
> **Versão:** v1.2
> **Objetivo:** Permitir ao usuário configurar margens customizadas para geração de PDF dos laudos via sidebar.

---

## 1. Visão geral

O sistema permite configurar 4 margens (Superior, Direita, Inferior, Esquerda) em centímetros, aplicadas na geração de PDF pelo `printToPDF` do Electron. Os valores são persistidos na tabela `configuracoes` (chave `pdf_margens`) e consumidos antes de cada chamada a `previewPDF`.

Toda a lógica compartilhada (tipo `Margins`, constantes, fetch do banco, conversão cm→pt) está centralizada em **`src/renderer/lib/margens.ts`** — as 3 páginas consumidoras usam apenas `await getMargens()`.

### Arquitetura do fluxo

```
MargensPage                  Configurações DB (SQLite)
  │ slider cm                   │ chave: pdf_margens
  │ "Salvar"                    │ valor: {"top":2.5,"right":2,"bottom":2.5,"left":3}
  ├──► configuracao.salvar ────►
  │
  ▼
LaudosPage / TemplatesPage / CabecalhoPage  "Visualizar"
  │
  ├──► const margins = await getMargens()     ← shared lib/margens.ts
  │
  ├──► previewPDF(html, margins)
  │         │ IPC invoke('template:previewPDF', { html, margins })
  │         ▼
  │    template.handlers.ts (main process)
  │         │ cm → in: cm * CM_TO_INCHES (1 / 2.54)
  │         │ body { padding: 15px 20px }  (reduzido, margens reais no printToPDF)
  │         │ printToPDF({ margins })
  │         ▼
  │    Buffer PDF → base64 → Blob → iframe
```

---

## 2. Estrutura de arquivos

```
src/
├── renderer/
│   ├── pages/
│   │   ├── MargensPage.tsx          ← NOVO: página de configuração das margens
│   │   ├── LaudosPage.tsx           ← MODIFICADO: await getMargens() antes de previewPDF
│   │   ├── TemplatesPage.tsx        ← MODIFICADO: await getMargens() antes de previewPDF
│   │   └── CabecalhoPage.tsx        ← MODIFICADO: await getMargens() antes de previewPDF
│   ├── lib/
│   │   └── margens.ts               ← NOVO: tipo Margins, constantes, getMargens(), helpers
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppSidebar.tsx        ← MODIFICADO: +1 item "Margens do PDF"
│   │   └── ui/
│   │       └── slider.tsx            ← NOVO: componente Slider (Radix UI)
│   └── App.tsx                       ← MODIFICADO: +1 lazy import, +1 rota /margens
├── main/
│   └── ipc/handlers/
│       └── template.handlers.ts      ← MODIFICADO: aceita { html, margins }, const CM_TO_PT
├── preload/
│   └── index.ts                      ← MODIFICADO: previewPDF(html, margins?)
└── migracao/
    └── margens_pdf.md                ← ESTE ARQUIVO
```

---

## 3. Módulo compartilhado: `lib/margens.ts`

**Local:** `src/renderer/lib/margens.ts`

Centraliza toda a lógica reutilizável das margens. As páginas consumidoras importam apenas o que precisam.

### Exportações

| Export | Tipo | Descrição |
|---|---|---|
| `Margins` | `interface` | `{ top: number; right: number; bottom: number; left: number }` |
| `PDF_MARGINS_KEY` | `string` | `'pdf_margins'` — chave na tabela `configuracoes` |
| `DEFAULT_MARGINS` | `Margins` | `{ top: 2.5, right: 2.0, bottom: 2.5, left: 3.0 }` |
| `MARGINS_MIN` | `number` | `0` (cm) |
| `MARGINS_MAX` | `number` | `5` (cm) |
| `MARGINS_STEP` | `number` | `0.1` (cm) |
| `CM_TO_INCHES` | `number` | `0.3937` — fator de conversão centímetros → polegadas (`1 / 2.54`) |
| `MARGINS_A4_MM` | `object` | `{ width: 210, height: 297 }` — dimensões A4 em mm |
| `clampMargin(value)` | `function` | Arredonda para step 0.1 e limita entre MIN/MAX |
| `getMargens()` | `async function` | Busca + parse do banco, retorna `Margins \| undefined` |
| `marginsToInches(m)` | `function` | Converte `Margins` (cm) → `{ top, right, bottom, left }` (polegadas) |

### Uso

```ts
// MargensPage.tsx — importações
import { type Margins, PDF_MARGINS_KEY, DEFAULT_MARGINS, MARGINS_MIN, MARGINS_MAX, MARGINS_STEP, MARGINS_A4_MM, clampMargin } from '@/lib/margens';

// LaudosPage / TemplatesPage / CabecalhoPage — única linha
import { getMargens } from '@/lib/margens';
// ... uso:
const result = await window.ipcAPI.template.previewPDF(html, await getMargens());
```

---

## 4. Componentes e suas responsabilidades

### 4.1. `MargensPage.tsx`

**Local:** `src/renderer/pages/MargensPage.tsx`

Página de configuração com:

- **Header:** Título "Margens do PDF", descrição, badge "Personalizado"/"Padrão"
- **Preview visual (Card esquerdo):** Retângulo A4 em escala com overlays coloridos nas 4 margens:
  - Superior: azul (`#3b82f6`)
  - Direita: verde (`#22c55e`)
  - Inferior: laranja (`#f97316`)
  - Esquerda: roxo (`#a855f7`)
  - Área de conteúdo com borda tracejada e label "conteúdo"
  - Labels com valor em cm sobre cada margem
- **Controles (Card direito):** 4 grupos, cada um com:
  - `Label` + ícone direcional + `Input` numérico (0–5 cm, step 0.1)
  - `Slider` (Radix UI) sincronizado com o input
  - Escala 0–5 cm abaixo de cada slider
- **Footer:** Botões "Restaurar padrão" e "Salvar margens"
- **Feedback:** Alert de sucesso ao salvar, skeleton enquanto carrega

**Importações do lib:** `Margins`, `PDF_MARGINS_KEY`, `DEFAULT_MARGINS`, `MARGINS_MIN`, `MARGINS_MAX`, `MARGINS_STEP`, `MARGINS_A4_MM`, `clampMargin`

**Estados:**
- `margins` — estado local com as 4 margens em cm
- `loading` — true enquanto busca do banco
- `saving` — true durante persistência
- `saved` — true por 2.5s após salvar (mostra alert verde)
- `isCustom` — true se margens !== padrão (controla o badge)

**Comportamento theming (light/dark):**
- Todas as cores usam classes Tailwind (`bg-card`, `text-foreground`, `bg-primary`, etc.)
- Overlays de margem usam gradientes com opacidade 30%, visíveis nos dois temas
- Texto dos labels usa `text-{color}-600 dark:text-{color}-400`
- Slider track usa `bg-primary/20`, range usa `bg-primary`, thumb usa `bg-background`
- Nenhuma cor hardcoded — respeita `globals.css`

### 4.2. `Slider` (shadcn/ui)

**Local:** `src/renderer/components/ui/slider.tsx`

Componente padrão shadcn/ui baseado em `@radix-ui/react-slider`. Encapsula:
- `Root` — container flexível
- `Track` — trilha com `bg-primary/20`, altura `h-1.5`
- `Range` — preenchimento com `bg-primary`
- `Thumb` — alça com `bg-background`, borda `border-primary/50`, focus ring

**Dependência:** `@radix-ui/react-slider` (instalada via npm)

---

## 5. Pipeline do PDF — Caminho A (margens via IPC)

### 5.1. Preload bridge

```ts
// src/preload/index.ts (tipo)
previewPDF: (html: string, margins?: {
  top: number; right: number; bottom: number; left: number
}) => Promise<UserResponse>;

// src/preload/index.ts (implementação)
previewPDF: (html, margins?) =>
  ipcRenderer.invoke('template:previewPDF', { html, margins }),
```

### 5.2. Main process handler

```ts
// src/main/ipc/handlers/template.handlers.ts
const CM_TO_INCHES = 1 / 2.54;  // ← constante nomeada

ipcMain.handle('template:previewPDF', async (_event, opts: {
  html: string;
  margins?: { top: number; right: number; bottom: number; left: number }
}) => {
  const { html, margins } = opts;
  const hasMargins = margins && (
    margins.top > 0 || margins.right > 0 ||
    margins.bottom > 0 || margins.left > 0
  );
  const bodyPadding = hasMargins ? '15px 20px' : '50px 60px';

  // ... monta docHtml com body { padding: bodyPadding } ...

  const pdfMargins = margins
    ? {
        top:    margins.top    * CM_TO_INCHES,
        right:  margins.right  * CM_TO_INCHES,
        bottom: margins.bottom * CM_TO_INCHES,
        left:   margins.left   * CM_TO_INCHES,
      }
    : { top: 0, bottom: 0, left: 0, right: 0 };

  await win.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    margins: pdfMargins,
  });
});
```

**Lógica de padding CSS:**
- Se margens > 0: `padding: 15px 20px` (mínimo, pois as margens reais já existem)
- Se margens = 0 (padrão/compatível): `padding: 50px 60px` (simula margem visual)

**Conversão de unidades:**
- 1 cm = 0.3937 polegadas (in) — constante `CM_TO_INCHES = 1 / 2.54` no handler
- O `printToPDF` do Electron espera margens em polegadas

### 5.3. Renderer callers (3 páginas) — via `getMargens()`

Cada página (`LaudosPage`, `TemplatesPage`, `CabecalhoPage`) usa o helper centralizado:

```ts
import { getMargens } from '@/lib/margens';

const result = await window.ipcAPI.template.previewPDF(html, await getMargens());
```

Se a chave `pdf_margins` não existir ou o parse falhar, `getMargens()` retorna `undefined` → comportamento padrão (zero margins, padding CSS de 50px 60px).

---

## 6. Persistência

| Campo | Valor |
|---|---|
| Tabela | `configuracoes` (chave-valor) |
| Chave | `PDF_MARGINS_KEY` = `'pdf_margins'` |
| Formato | JSON: `{"top":2.5,"right":2.0,"bottom":2.5,"left":3.0}` |
| Tipo | `json` |
| Descrição | `Margens padrão para geração de PDF` |
| Valores padrão | `DEFAULT_MARGINS`: `top: 2.5, right: 2.0, bottom: 2.5, left: 3.0` (cm) |
| Range | `MARGINS_MIN` a `MARGINS_MAX`: `0.0` a `5.0` cm, step `MARGINS_STEP` = `0.1` |

---

## 7. Sidebar

**Item:** `Margens do PDF` no grupo **Configurações**

```ts
// src/renderer/components/layout/AppSidebar.tsx
{ title: 'Margens do PDF', path: '/margens', icon: Ruler },
```

Posição: entre "Modelos IA" e "Backup" no menu.

**Ícone:** `Ruler` (lucide-react)

---

## 8. Rotas

```tsx
// src/renderer/App.tsx
const MargensPage = lazy(() =>
  import('@/pages/MargensPage').then(m => ({ default: m.MargensPage }))
);

<Route path="/margens" element={<MargensPage />} />
```

---

## 9. Manutenção e extensão

### Alterar valores padrão

Edite `DEFAULT_MARGINS` em **`src/renderer/lib/margens.ts`**:

```ts
export const DEFAULT_MARGINS: Margins = { top: 2.5, right: 2.0, bottom: 2.5, left: 3.0 };
```

### Alterar range dos sliders

Edite `MARGINS_MIN`, `MARGINS_MAX` e `MARGINS_STEP` em **`src/renderer/lib/margens.ts`**:

```ts
export const MARGINS_MIN = 0;
export const MARGINS_MAX = 5;
export const MARGINS_STEP = 0.1;
```

### Alterar conversão cm → polegadas

Edite `CM_TO_INCHES` em **`src/renderer/lib/margens.ts`** (`1 / 2.54`).
O handler do main process tem sua própria cópia em `src/main/ipc/handlers/template.handlers.ts`.

### Adicionar novo consumidor das margens

Se uma nova página precisar gerar PDF com margens:

```ts
import { getMargens } from '@/lib/margens';

const result = await window.ipcAPI.template.previewPDF(html, await getMargens());
```

**Apenas 2 linhas.** Nenhuma string mágica, nenhum JSON.parse, nenhum try/catch.

### Alterar unidade (cm → mm, etc.)

1. Atualize labels e placeholders em `MargensPage.tsx`
2. Ajuste constantes em `lib/margens.ts` (`MARGINS_STEP`, `MARGINS_MIN`, `MARGINS_MAX`, `DEFAULT_MARGINS`)
3. Atualize `CM_TO_INCHES` em `lib/margens.ts` e `template.handlers.ts` com o novo fator
4. Se mudar a chave do banco, altere `PDF_MARGINS_KEY`

### Testar

1. Acesse **Configurações → Margens do PDF**
2. Altere um slider — o preview visual deve atualizar em tempo real
3. Clique **Salvar margens** — badge deve mudar para "Personalizado"
4. Vá em **Laudos → Editor de Laudos** e clique **Visualizar**
5. O PDF deve refletir as margens configuradas
6. Clique **Restaurar padrão** e **Salvar** — badge volta a "Padrão"

---

## 10. Checklist de verificação pós-deploy

- [ ] `npm run build` compila sem erros (main + preload + renderer)
- [ ] Página `/margens` acessível via sidebar
- [ ] Sliders sincronizados com inputs numéricos
- [ ] Preview visual A4 responde em tempo real
- [ ] Persistência funciona (salvar → recarregar página → valores mantidos)
- [ ] PDF gerado com margens customizadas (Laudos, Templates, Cabeçalho)
- [ ] PDF gerado corretamente sem margens configuradas (compatibilidade)
- [ ] Layout consistente nos temas light e dark
- [ ] Badge "Personalizado"/"Padrão" reflete estado real
- [ ] Botão "Restaurar padrão" funciona e badge atualiza
- [ ] Nenhuma string mágica `'pdf_margins'` fora de `lib/margens.ts`
- [ ] Nenhum JSON.parse de margens fora de `getMargens()`
- [ ] Nenhum `1 / 2.54` hardcoded (constante `CM_TO_INCHES`)
