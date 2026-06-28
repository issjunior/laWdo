# Ciclo Completo: Placeholders de Campos Específicos de Exame

**Data:** 2026-05-23
**Status:** Implementado
**Depende de:** Migration V17 (campos_especificos), Section Registry (exam-fields)
**Última atualização:** 2026-06-28

---

## 1. Visão Geral

Quando uma REP é criada com um tipo de exame que possui campos específicos (ex: I-801 — Numerações), esses campos são serializados em JSON na coluna `reps.campos_especificos`. Este plano fecha o ciclo completo para que esses campos:

1. Apareçam como **placeholders** na PlaceholdersPage (gerenciáveis, agrupados por tipo de exame)
2. Estejam disponíveis no **menu de contexto** do editor de laudo (single e multi-seção)
3. Sejam **resolvidos** com valores reais no preview/PDF do laudo
4. Tenham **identidade visual** clara (categoria própria com código do exame)

---

## 2. Diagnóstico — Quatro Lacunas

| # | Lacuna | Onde | Impacto |
|---|--------|------|---------|
| 1 | Campos específicos não são registrados como placeholders do sistema | `placeholder.service.ts` seed | Não aparecem na PlaceholdersPage, não são gerenciáveis |
| 2 | `aplicarPlaceholders()` não resolve valores do JSON `campos_especificos` | `LaudosPage.tsx` | `{{numeracao_veiculo}}` fica sem substituição no preview/PDF |
| 3 | Menu de contexto de placeholders só existe no editor single; modo multi-seção não tem | `LaudosPage.tsx` linhas ~1783 (single) vs ~1826 (multi) | Usuário não insere placeholder por clique direito nas seções |
| 4 | Falta identidade visual vinculando placeholder ao tipo de exame | `PlaceholdersPage.tsx`, `globals.css` | UX confusa: "de onde veio `{{numeracao_chassi}}`?" |

---

## 3. Arquitetura da Solução

### Regra de ouro: Manifest usa código, banco usa ID gerado

```
Manifest (placeholders.ts)         Banco (categorias_placeholders)
┌──────────────────────────┐       ┌────────────────────────────────┐
│ categoria_exam_codigo:   │──────▶│ id: 'cat-exam-I-801'           │
│   'I-801'                │       │ chave: 'I-801'                 │
│                          │       │ label: 'I-801 - Numerações...' │
│ cor: 'amber'             │       │ cor: 'amber'                   │
│ icone: 'Hash'            │       │ icone: 'Hash'                  │
│                          │       │ is_sistema: 1                  │
│ placeholder.chave:       │       │                                │
│   'numeracao_veiculo'    │──────▶│ placeholders.chave =           │
│ placeholder.jsonPath:    │       │   'numeracao_veiculo'          │
│   'numeracao.veiculo'    │       │ placeholders.categoria_id =    │
│                          │       │   'cat-exam-I-801'             │
└──────────────────────────┘       └────────────────────────────────┘
```

**Separação clara**: o manifest define `categoria_exam_codigo` (código legível), o seed transforma em `categoria_id = 'cat-exam-{codigo}'` (ID de banco). Nenhum componente renderizado usa código diretamente — sempre via `categoria_id`.

---

## 3.1 Manifest de Placeholders (NOVO)

**Arquivo:** `src/renderer/components/rep/exam-fields/placeholders.ts`

```ts
export interface CampoEspecificoPlaceholder {
  chave: string;
  label: string;
  descricao: string;
  jsonPath: string;              // caminho no JSON: 'numeracao.veiculo'
  categoria_exam_codigo: string; // vincula ao tipo de exame: 'I-801'
}

/** Categorias de exame que terão placeholders próprios — cada uma vira uma coluna no Kanban */
export interface ExamPlaceholderCategory {
  id: string;      // 'cat-exam-I-801' — ID da categoria no banco
  codigo: string;  // 'I-801' — código do exame no GDL
  label: string;   // 'I-801 - Numerações Identificadoras'
  cor: string;     // cor Tailwind (deve estar em ALLOWED_COLORS)
  icone: string;   // nome do ícone lucide-react
}

export const EXAM_PLACEHOLDER_CATEGORIES: ExamPlaceholderCategory[] = [
  {
    id: 'cat-exam-I-801',
    codigo: 'I-801',
    label: 'I-801 - Numerações Identificadoras',
    cor: 'amber',
    icone: 'Hash',
  },
  // Futuros tipos de exame entram aqui
];

export const CAMPOS_ESPECIFICOS_PLACEHOLDERS: CampoEspecificoPlaceholder[] = [
  // ── I-801: Numeração de Veículos ──
  { chave: 'numeracao_veiculo',          label: 'Veículo',            descricao: 'Marca, modelo ou tipo do veículo periciado',       jsonPath: 'numeracao.veiculo',          categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_placa',            label: 'Placa',              descricao: 'Placa de identificação do veículo',                 jsonPath: 'numeracao.placa',            categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_fabricacao',       label: 'Fabricação/Modelo',  descricao: 'Ano de fabricação e modelo do veículo',             jsonPath: 'numeracao.fabricacao',       categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_cor',              label: 'Cor',                descricao: 'Cor do veículo',                                     jsonPath: 'numeracao.cor',              categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_conservacao',      label: 'Conservação',        descricao: 'Estado de conservação do veículo',                   jsonPath: 'numeracao.conservacao',      categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_chassi',           label: 'Chassi',             descricao: 'Nº do chassi (até 17 caracteres alfanuméricos)',    jsonPath: 'numeracao.chassi',           categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_chassi_revelado',  label: 'Chassi Revelado',    descricao: 'Chassi após revelação química',                      jsonPath: 'numeracao.chassi_revelado',  categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_motor',            label: 'Motor',              descricao: 'Nº do motor (até 12 caracteres alfanuméricos)',     jsonPath: 'numeracao.motor',            categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_motor_revelado',   label: 'Motor Revelado',     descricao: 'Motor após revelação química',                       jsonPath: 'numeracao.motor_revelado',   categoria_exam_codigo: 'I-801' },
];

/** Helper: dado um código de exame, retorna o ID da categoria correspondente */
export function getExamCategoryId(codigo: string): string {
  return `cat-exam-${codigo}`;
}

/** Helper: retorna todos os placeholders de um código de exame */
export function getPlaceholdersForExam(codigo: string): CampoEspecificoPlaceholder[] {
  return CAMPOS_ESPECIFICOS_PLACEHOLDERS.filter(p => p.categoria_exam_codigo === codigo);
}
```

---

## 3.2 Seed Automático

**Arquivo:** `src/main/services/placeholder.service.ts`

### 3.2a Nova categoria no seed

```ts
// Dentro de seedSistema(), após o loop de categoriasSistema existente:

// Categorias de exame (campos específicos)
for (const examCat of EXAM_PLACEHOLDER_CATEGORIES) {
  // Resolve conflito: mesma label, ID diferente
  const conflitantes = await this.executeCustomQuery<{ id: string }>(
    'SELECT id FROM categorias_placeholders WHERE label = ? AND id != ?',
    [examCat.label, examCat.id]
  );
  for (const conflito of conflitantes) {
    await executeNonQuery('DELETE FROM categorias_placeholders WHERE id = ?', [conflito.id]);
  }

  const existente = await this.executeCustomQuery<{ id: string }>(
    'SELECT id FROM categorias_placeholders WHERE id = ?', [examCat.id]
  );
  if (existente.length === 0) {
    await executeNonQuery(
      'INSERT INTO categorias_placeholders (id, chave, label, descricao, cor, icone, is_sistema, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [examCat.id, examCat.codigo, examCat.label, `Placeholders do exame ${examCat.codigo}`, examCat.cor, examCat.icone, 1, 10]
    );
  } else {
    await executeNonQuery(
      'UPDATE categorias_placeholders SET is_sistema = 1, chave = ?, label = ?, descricao = ?, cor = ?, icone = ?, updated_at = ? WHERE id = ?',
      [examCat.codigo, examCat.label, `Placeholders do exame ${examCat.codigo}`, examCat.cor, examCat.icone, new Date().toISOString(), examCat.id]
    );
  }
}
```

### 3.2b Placeholders específicos no seed

```ts
// Após o loop de PLACEHOLDERS_SISTEMA existente:

for (const p of CAMPOS_ESPECIFICOS_PLACEHOLDERS) {
  const existing = await this.executeCustomQuery<PlaceholderRow>(
    'SELECT id FROM placeholders WHERE chave = ?', [p.chave]
  );
  if (existing.length === 0) {
    const catId = getExamCategoryId(p.categoria_exam_codigo);
    await this.create({
      chave: p.chave,
      valor: '',          // automático — resolvido no laudo
      descricao: p.descricao,
      categoria_id: catId,
    });
    // NOTA: o BaseService.create() gera o UUID do id automaticamente
  }
}
```

### 3.2c Proteção contra deleção

```ts
// Método delete() já existente — estender a lista de proteção:
async delete(id: string): Promise<boolean> {
  const row = await this.findById(id);
  if (!row) return false;

  const sistemaChaves = [
    ...PLACEHOLDERS_SISTEMA.map(p => p.chave),
    ...CAMPOS_ESPECIFICOS_PLACEHOLDERS.map(p => p.chave),
  ];
  if (sistemaChaves.includes(row.chave)) {
    throw new Error('Placeholders do sistema não podem ser excluídos.');
  }
  return super.delete(id);
}
```

### 3.2d Importações necessárias

O `placeholder.service.ts` (main process) precisa das constantes do manifest. Como está em outro processo (main vs renderer), a abordagem é duplicar as constantes no lado main — mesmo padrão já usado com `ALLOWED_COLORS`.

**Decisão:** O `placeholder.service.ts` conterá sua própria cópia local das listas `EXAM_PLACEHOLDER_CATEGORIES` e `CAMPOS_ESPECIFICOS_PLACEHOLDERS` (sem dependências React/lucide). O renderer importa do `exam-fields/placeholders.ts`.

---

## 3.3 Resolução de Valores no Laudo

**Arquivo:** `src/renderer/pages/LaudosPage.tsx`

### 3.3a Modificar `aplicarPlaceholders()`

Após o `mapping` existente (linhas 104-180), adicionar resolução de `campos_especificos`:

```ts
// Resolver campos_especificos do JSON da REP (tipos como I-801)
if (repData.campos_especificos) {
  try {
    const especificos = JSON.parse(repData.campos_especificos);
    for (const placeholder of CAMPOS_ESPECIFICOS_PLACEHOLDERS) {
      const partes = placeholder.jsonPath.split('.');
      let valor: unknown = especificos;
      for (const parte of partes) {
        valor = (valor as Record<string, unknown>)?.[parte];
      }
      if (valor !== undefined && valor !== null && valor !== '') {
        mapping[placeholder.chave] = String(valor);
      }
    }
  } catch { /* mantém mapping atual */ }
}
```

**Quando `campos_especificos` é preenchido?** Somente ao salvar a REP. No preview do laudo, se a REP já foi salva com campos específicos, o JSON existe e é resolvido. Se a REP ainda não tem campos específicos (ex: tipo não tem, ou nunca salvou), o try/catch simplesmente mantém o mapping atual.

**Sincronização ao trocar tipo de exame:** No `REPsPage.tsx`, `buildCamposEspecificos` é chamado com o código **atual** do tipo de exame. Se o usuário editar uma REP e mudar de I-801 para LOC:

- O `parseCamposEspecificos` carrega os campos numeracao do JSON antigo no formulário
- O Nível 3 troca as seções (numeracao → local_fato)
- Ao salvar, `buildCamposEspecificos(data, 'LOC')` retorna `undefined` (LOC usa colunas nativas)
- Para limpar o JSON antigo: `payload.campos_especificos = campos || null`

```ts
// Em prepareForApi, após o bloco if (codigo):
if (codigo) {
  const campos = buildCamposEspecificos(data, codigo);
  payload.campos_especificos = campos || null; // null limpa JSON de tipo anterior
}
```

E no handler de update, `null` deve ser aceito para remover a coluna:

```ts
// rep.handlers.ts — update
if (data.campos_especificos !== undefined) {
  sanitizedData.campos_especificos = data.campos_especificos; // null é válido
}
```

---

### 3.3b B-602 — Placeholders Individuais de Armas

Em 2026-06-19, foi adicionada a resolução dos placeholders individuais de cada arma. Em 2026-06-28, o conjunto de chaves-base do B-602 foi ampliado e passou a ser tratado como placeholder indexado por contrato.

Hoje o sistema reconhece as chaves-base:

- `b602_arma_N_letra`
- `b602_arma_N_tipo`
- `b602_arma_N_marca`
- `b602_arma_N_modelo`
- `b602_arma_N_calibre`
- `b602_arma_N_numeracao_serie`
- `b602_arma_N_numeracao_cano`
- `b602_arma_N_capacidade_carregador`
- `b602_arma_N_comprimento_cano`
- `b602_arma_N_acabamento`
- `b602_arma_N_funcionamento`
- `b602_arma_N_estado_conservacao`
- `b602_arma_N_quantidade`
- `b602_arma_N_dito_oficio`
- `b602_arma_N_numero_lacre`
- `b602_arma_N_func_toggle`
- `b602_arma_N_coleta_toggle`

`aplicarPlaceholders()` resolve as chaves indexadas concretas a partir de `b602.armas[]`. O campo `letra` continua computado em runtime.

### 3.3c Reconhecimento de placeholders indexados no editor

Em 2026-06-28, o contrato de placeholder deixou de depender apenas de igualdade literal.

Os utilitários em `src/renderer/lib/utils.ts` passaram a considerar chaves-base com `_N_`:

- `placeholderChaveEhValida(chave, chavesValidas)` aceita uma chave concreta se ela casar com a regex derivada de uma chave-base
- `segmentarTextoComPlaceholders()` usa essa mesma validação para destacar placeholders em previews textuais
- `converterPlaceholdersTextuais()` converte no DOM qualquer `{{...}}` reconhecido para `span.placeholder-tag`

Consequência prática:

- o usuário pode digitar manualmente `{{b602_arma_1_tipo}}` no editor do laudo ou do template
- o TinyMCE converte a tag para placeholder visual mesmo sem existir uma entrada literal `b602_arma_1_tipo` em `placeholderChaves`
- o campo `repetir_titulo` do template também consegue mostrar prévia visual para essas chaves

**Detalhes da implementação** em `spec/03 laudo/visualizar_pdf.md` (seção "Placeholder Resolution Pipeline").

---

## 3.4 Menu de Contexto Unificado

**Arquivo:** `src/renderer/pages/LaudosPage.tsx`

### 3.4a Extrair componente reutilizável

```tsx
/** Menu de contexto para inserir placeholders — usado em single e multi-seção */
const PlaceholderContextMenu: React.FC<{
  editorId: string;
  children: React.ReactNode;  // TinyMceEditor
}> = ({ editorId, children }) => (
  <ContextMenu>
    <ContextMenuTrigger asChild>
      {children}
    </ContextMenuTrigger>
    <ContextMenuContent className="w-64">
      <ContextMenuLabel>Inserir Placeholder</ContextMenuLabel>
      <ContextMenuSeparator />
      {categorias
        .sort((a, b) => {
          // Categorias de exame (cat-exam-*) entre sistema e personalizadas
          const aIsExam = (a as any).id?.startsWith('cat-exam-');
          const bIsExam = (b as any).id?.startsWith('cat-exam-');
          // Ordem: sistema → exame → personalizadas
          const ordemA = aIsExam ? 1 : ((a as any).is_sistema === 1 ? 0 : 2);
          const ordemB = bIsExam ? 1 : ((b as any).is_sistema === 1 ? 0 : 2);
          return ordemA - ordemB;
        })
        .map(cat => {
          const items = placeholders.filter(p => p.categoria_id === cat.id);
          if (items.length === 0) return null;
          const IconComp = (LucideIcons as any)[(cat as any).icone] || LucideIcons.Tag;
          return (
            <ContextMenuSub key={cat.id}>
              <ContextMenuSubTrigger>
                <IconComp size={14} className="mr-2" />
                <span>{cat.label}</span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-56 max-h-[350px] overflow-y-auto">
                {items
                  .sort((a, b) => a.chave.localeCompare(b.chave))
                  .map(p => {
                    const isExamPlaceholder = CAMPOS_ESPECIFICOS_PLACEHOLDERS.some(ep => ep.chave === p.chave);
                    return (
                      <ContextMenuItem
                        key={p.id}
                        onClick={() => {
                          const editor = (window as any).tinymce?.get(editorId);
                          if (editor) editor.insertContent(`{{${p.chave}}}`);
                        }}
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <code className="font-mono text-xs font-semibold">{`{{${p.chave}}}`}</code>
                            {isExamPlaceholder && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
                                I-801
                              </Badge>
                            )}
                          </div>
                          {p.descricao && (
                            <span className="text-[10px] text-muted-foreground truncate">{p.descricao}</span>
                          )}
                        </div>
                      </ContextMenuItem>
                    );
                  })}
              </ContextMenuSubContent>
            </ContextMenuSub>
          );
        })}
    </ContextMenuContent>
  </ContextMenu>
);
```

### 3.4b Usar no editor single (substituir linhas ~1783-1823)

```tsx
<PlaceholderContextMenu editorId="laudo-single-editor">
  <TinyMceEditor ... />
</PlaceholderContextMenu>
```

### 3.4c Usar no editor multi-seção (adicionar ao loop de seções, linha ~1860)

```tsx
<PlaceholderContextMenu editorId={`secao-${idx}`}>
  <TinyMceEditor ... />
</PlaceholderContextMenu>
```

---

## 3.5 UX na PlaceholdersPage

**Arquivo:** `src/renderer/pages/PlaceholdersPage.tsx`

### 3.5a Badge de tipo de exame nos cards

Dentro do `DraggableCard`, adicionar após o badge "Fixo" (linha ~88):

```tsx
{/* Badge de tipo de exame para placeholders de campos específicos */}
{!isSysPlaceholder && (() => {
  const examPH = CAMPOS_ESPECIFICOS_PLACEHOLDERS.find(ep => ep.chave === p.chave);
  if (!examPH) return null;
  const examCat = EXAM_PLACEHOLDER_CATEGORIES.find(c => c.codigo === examPH.categoria_exam_codigo);
  return (
    <Badge
      variant="outline"
      className={`text-[10px] h-4 px-1 gap-1 shrink-0 border-${examCat?.cor || 'amber'}-200 text-${examCat?.cor || 'amber'}-600 dark:text-${examCat?.cor || 'amber'}-300 dark:border-${examCat?.cor || 'amber'}-800/60`}
    >
      <Zap size={8} />
      {examPH.categoria_exam_codigo}
    </Badge>
  );
})()}
```

### 3.5b Colunas no Kanban

As categorias `cat-exam-*` serão criadas automaticamente pelo seed. O Kanban já renderiza uma `DroppableColumn` por categoria. A coluna `I-801 - Numerações Identificadoras` aparecerá com ícone `Hash` e cor `amber` — mesma experiência das colunas existentes.

### 3.5c Tooltip com jsonPath

No `DraggableCard`, abaixo da descricao (linha ~115), adicionar sutilmente:

```tsx
{/* jsonPath para placeholders de exame */}
{(() => {
  const examPH = CAMPOS_ESPECIFICOS_PLACEHOLDERS.find(ep => ep.chave === p.chave);
  if (!examPH) return null;
  return (
    <div className="flex items-start gap-2">
      <code className="text-[9px] text-muted-foreground/60 truncate" title={`JSON path: ${examPH.jsonPath}`}>
        {examPH.jsonPath}
      </code>
    </div>
  );
})()}
```

---

## 3.6 Cores Dinâmicas — Sem Mudanças Necessárias

O `tailwind.config.js` já tem safelist com regex que cobre `(bg|text|border|ring) x (12 cores) x (10 shades)`. Novas categorias com cores como `amber`, `teal`, `pink` da lista `ALLOWED_COLORS` funcionam automaticamente com `bg-${cor}-500`, `text-${cor}-600`, etc.

**Única exigência:** a cor da categoria deve estar no array `ALLOWED_COLORS` (12 cores: slate, red, orange, amber, emerald, teal, blue, indigo, violet, fuchsia, pink, rose). As cores do manifest (`amber` para I-801) já estão nessa lista.

---

## 4. Fluxo de Dados Completo

```
┌──────────────────────────────────────────────────────────────────────┐
│  CRIAÇÃO DA REP (REPsPage.tsx)                                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. Usuário seleciona tipo I-801                                      │
│  2. Nível 3 desbloqueia → NumeracaoFields renderizado                 │
│  3. Usuário preenche: veiculo="Gol", placa="ABC1234", chassi="9BW..."│
│  4. Ao salvar:                                                        │
│     buildCamposEspecificos(data, 'I-801')                             │
│     → JSON: {"numeracao":{"veiculo":"Gol","placa":"ABC1234",...}}    │
│     → payload.campos_especificos = JSON string                       │
│  5. IPC → rep.handlers.ts → SQLite reps.campos_especificos           │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  EDIÇÃO DA REP (carregamento)                                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. handleEditar(rep)                                                 │
│  2. parseCamposEspecificos(rep.campos_especificos)                    │
│     → {numeracao_veiculo:"Gol", numeracao_placa:"ABC1234",...}       │
│  3. form.reset({...rep, ...parsed})                                   │
│  4. Se tipo_exame_id mudou: campos antigos no form, novo tipo         │
│     define novas seções. Ao salvar, buildCamposEspecificos usa        │
│     código NOVO → JSON antigo é substituído ou limpo (null).          │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  LAUDO (LaudosPage.tsx)                                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. Editor: menu de contexto → Inserir Placeholder                    │
│     → I-801 - Numerações Identificadoras ▶                           │
│     → {{numeracao_veiculo}}  {{numeracao_placa}} ...                 │
│     → Insere <span data-placeholder="{{numeracao_veiculo}}">...</span>│
│                                                                       │
│  2. Preview PDF (handlePreview):                                      │
│     a. Busca REP por ID                                              │
│     b. aplicarPlaceholders(html, repData, extraContext)              │
│     c. NOVO: parse repData.campos_especificos JSON                   │
│        → mapping['numeracao_veiculo'] = "Gol"                       │
│        → mapping['numeracao_chassi'] = "9BW..."                     │
│     d. DOMParser substitui spans → valores reais no HTML             │
│     e. Gera PDF com valores reais                                    │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  PLACEHOLDERS PAGE (PlaceholdersPage.tsx)                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Na inicialização (carregarDados):                                    │
│  1. seedSistema() → cria cat-exam-I-801 se não existe                │
│                   → cria 9 placeholders de numeração se não existem   │
│  2. findAll() → carrega tudo                                         │
│                                                                       │
│  Kanban:                                                              │
│  ┌──────────────────────────────────────────────┐                    │
│  │ 🔒 REP/Laudo  │ Perito │ # I-801 - Numerações│ ← coluna amber    │
│  │ {{numero_rep}}│        │ {{numeracao_veiculo}}│                   │
│  │ {{local_fato}}│        │ {{numeracao_placa}}  │                   │
│  │ ...           │        │ [I-801] badge        │ ← código do exame│
│  └──────────────────────────────────────────────┘                    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Checklist de Implementação

### Fase 1 — Manifest (renderer)
- [x] Criar `src/renderer/components/rep/exam-fields/placeholders.ts`
- [x] Exportar de `exam-fields/index.ts`: `export * from './placeholders'`

### Fase 2 — Seed (main process)
- [x] `placeholder.service.ts`: Adicionar arrays `EXAM_PLACEHOLDER_CATEGORIES` e `CAMPOS_ESPECIFICOS_PLACEHOLDERS` (cópia local)
- [x] `placeholder.service.ts`: `seedSistema()` — loop de categorias de exame (UPSERT com `is_sistema: 1`)
- [x] `placeholder.service.ts`: `seedSistema()` — loop de placeholders específicos (UPSERT por chave)
- [x] `placeholder.service.ts`: `delete()` — estender `sistemaChaves` com `CAMPOS_ESPECIFICOS_PLACEHOLDERS.map(p => p.chave)`
- [x] `placeholder.service.ts`: Exportar `getExamCategoryId(codigo)` helper

### Fase 3 — Resolução no Laudo
- [x] `LaudosPage.tsx`: `aplicarPlaceholders()` — adicionar parse de `campos_especificos` JSON (linha 198-212)
- [x] `LaudosPage.tsx`: Importar `CAMPOS_ESPECIFICOS_PLACEHOLDERS` do manifest

### Fase 4 — Menu de Contexto Unificado
- [x] `LaudosPage.tsx`: Criar componente `PlaceholderContextMenu` (extraído para `src/renderer/components/editor/PlaceholderContextMenu.tsx`)
- [x] `LaudosPage.tsx`: Substituir contexto do single editor pelo componente reutilizável (linha 2078)
- [x] `LaudosPage.tsx`: Adicionar `<PlaceholderContextMenu>` em cada editor do modo multi-seção (linha 2128)

### Fase 5 — UX na PlaceholdersPage
- [x] Layout atual migrou para `SortableCategoryTree` + DataTable; o spec antigo do card Kanban não é mais a referência do comportamento vigente

### Fase 6 — Sincronização e Limpeza
- [x] `REPsPage.tsx`: `prepareForApi()` — `payload.campos_especificos = serializeCamposEspecificos(codigo, data) || null` (linha 160)
- [x] `rep.handlers.ts` (update): `campos_especificos: null` é aceito (`null !== undefined`, linha 175)
- [x] PlaceholdersPage: `CAMPOS_ESPECIFICOS_PLACEHOLDERS` usado para proteção de sistema (linhas 291, 314, 338)

### Fase 7 — Guia de novo tipo
- [ ] (vazio — para referência futura)


### Build & Verificação
- [x] `build:main` compila sem erros
- [x] `build:preload` compila sem erros
- [x] `npm run dev` executa sem erros
- [x] Teste manual: criar REP I-801 → ver placeholders na PlaceholdersPage
- [x] Teste manual: editar laudo → menu de contexto com categoria I-801
- [x] Teste manual: preview PDF → `{{chassi}}` resolvido
- [x] Teste manual: digitar `{{b602_arma_1_tipo}}` ou `{{b602_arma_1_numero_lacre}}` no editor converte para placeholder visual

---

## Apêndice A: Documentos Históricos

| Documento | Status | Ação |
|-----------|--------|------|
| `categoria_placeholder.md` | Implementado — V15/V16 | Manter como referência |
| `placeholder-pdf-bug.md` | Resolvido — 2026-05-10 | Manter como lição aprendida |

Ambos descrevem funcionalidades já concluídas. São mantidos no diretório para rastreabilidade histórica, mas não representam trabalho pendente.

---

## Apêndice B: Estrutura de Arquivos Resultante

```
src/
├── renderer/
│   ├── components/
│   │   └── rep/
│   │       └── exam-fields/
│   │           ├── index.ts              # + export placeholders
│   │           ├── types.ts
│   │           ├── placeholders.ts       # NOVO — manifest
│   │           ├── local-fato.tsx
│   │           ├── acionamento.tsx
│   │           └── numeracao.tsx
│   └── pages/
│       ├── LaudosPage.tsx                # MODIFICADO — aplicarPlaceholders, contexto multi
│       ├── PlaceholdersPage.tsx          # MODIFICADO — badge exam, tooltip jsonPath
│       └── REPsPage.tsx                  # MODIFICADO — FIELD_PLACEHOLDER, null campos
├── main/
│   └── services/
│       └── placeholder.service.ts        # MODIFICADO — seed exam cats + placeholders
└── spec/
    └── 05 placeholder/
        ├── categoria_placeholder.md      # HISTÓRICO (concluído)
        ├── placeholder-pdf-bug.md        # HISTÓRICO (resolvido)
        └── ciclo_placeholder.md          # NOVO — este documento
```

---

## Apêndice C: Tailwind Colors — Safelist Existente

```js
// tailwind.config.js
safelist: [{
  pattern: /^(bg|text|border|ring)-(slate|red|orange|amber|emerald|teal|blue|indigo|violet|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900)$/,
  variants: ['hover', 'dark'],
}]
```

**Cores disponíveis para novas categorias:** `slate`, `red`, `orange`, `amber`, `emerald`, `teal`, `blue`, `indigo`, `violet`, `fuchsia`, `pink`, `rose`.

**Já em uso por categorias existentes:** `blue` (REP), `violet` (Perito), `emerald` (Lacres), `orange` (Solicitante), `teal` (Local), `amber` (Datas), `pink` (Personalizados), `slate` (Sem Categoria).

**Nova:** `amber` para I-801. Próximo tipo pode usar `fuchsia`, `rose`, `indigo` (ainda disponíveis para categorias de exames futuros).

---

## Apêndice D: Notas de Evolução Pós-Implementação

### Renomeação de Chaves (RENOMEACOES)

Após a implementação inicial, as chaves de placeholder com prefixo `rep_` foram renomeadas para formas mais curtas e semânticas. O mapeamento está em `src/main/services/placeholder.service.ts:19-47` (`RENOMEACOES`). Exemplos:

| Antiga | Nova |
|--------|------|
| `rep_numero` | `numero_rep` |
| `rep_autoridade_solicitante` | `autoridade_solicitante_rep` |
| `rep_nome_envolvido` | `nome_envolvido` |
| `rep_local_fato` | `local_fato` |
| `rep_latitude` | `latitude` |
| `rep_longitude` | `longitude` |

O `aplicarPlaceholders()` em `LaudosPage.tsx:134-180` mantém compatibilidade retroativa com ambos os formatos (antigo `rep_*` e novo sem prefixo). Chaves renomeadas que perderam o prefixo `rep_` não têm fallback no formato antigo — apenas a nova forma é usada.

### Layout da PlaceholdersPage

O layout Kanban descrito na seção 3.5 (cards `DraggableCard` com badge e tooltip) foi substituído pelo layout 2-painéis com `SortableCategoryTree` + DataTable (ver `novo_layout.md`). Isso torna os itens da Fase 5 (badge visual + tooltip jsonPath) mais difíceis de implementar no formato original — se forem retomados, devem ser adaptados para colunas da DataTable.

### Build & Verificação (atualizado)

- [x] `build:main` compila sem erros
- [x] `build:preload` compila sem erros
- [x] `npm run dev` executa sem erros
- [x] Teste manual: criar REP I-801 → ver placeholders na PlaceholdersPage
- [x] Teste manual: editar laudo → menu de contexto com categoria I-801
- [x] Teste manual: preview PDF → placeholders de numeração resolvidos
