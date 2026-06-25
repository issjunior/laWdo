# Spec: Seções Repetíveis para Armas no Template B-602

> **Arquivos relacionados:**
> - Guia geral de inputs por tipo de exame → [`../criar_input_personalizados_exame.md`](../criar_input_personalizados_exame.md)
> - Spec completa B-602 (formulário, placeholders, tabelas) → [`criar_input_personalizado_b602.md`](criar_input_personalizado_b602.md)
> - Salvamento/recuperação de inputs → [`../salvar_input_personalizado.md`](../salvar_input_personalizado.md)

## Resumo

Permitir que uma seção do template seja marcada como "repetir para cada arma". O sistema gera automaticamente uma subseção estrutural para cada arma cadastrada na REP, com título no formato **"ARMA A - TIPO MARCA MODELO"**, resolvendo placeholders com os dados específicos de cada arma.

### Fluxo completo (exemplo com 3 armas)

```
┌─────────────────────────────────────────────────────────┐
│                    1. TEMPLATE                           │
│  Seção marcada com repetir_para = 'armas'                │
│  Nome: "DOS EXAMES"                      ← vira <h2>     │
│  Título H4: "ARMA {{b602_arma_1_letra}} - ..." (novo!)  │
│  Conteúdo: "A arma {{b602_arma_1_tipo}}..."             │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│                 2. REP (formulário B-602)                 │
│  Perito cadastra 3 armas:                                 │
│  ┌──────┬──────────┬────────┬─────────┬─────────┐       │
│  │ Arma │ Tipo     │ Marca  │ Modelo  │ Calibre │       │
│  ├──────┼──────────┼────────┼─────────┼─────────┤       │
│  │  1   │ Pistola  │ Taurus │ PT100   │ .40     │       │
│  │  2   │ Revólver │ S&W    │ 686     │ .357    │       │
│  │  3   │ Esping.  │ CBC    │ Pump    │ 12      │       │
│  └──────┴──────────┴────────┴─────────┴─────────┘       │
│  Salva → JSON armado em campos_especificos.b602.armas    │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│             3. CRIAÇÃO DO LAUDO                           │
│  expandirSecoesRepetiveis() gera HTML com div wrapper:   │
│                                                           │
│  <h2>1. Considerações Iniciais</h2>                       │
│  ... (H2 normal, não repetido)                            │
│                                                           │
│  <h2>2. Das Armas</h2>                                    │
│  <div data-repeat-group="armas" data-repeat-owner="...">  │
│    <h4 data-repeat-item="arma" data-arma-indice="1">      │
│      ARMA A - Pistola Taurus PT100                        │
│    </h4>                                                  │
│    A arma Pistola marca Taurus, calibre .40...            │
│    <h4 data-repeat-item="arma" data-arma-indice="2">      │
│      ARMA B - Revólver S&W 686                            │
│    </h4>                                                  │
│    A arma Revólver marca S&W, calibre .357...             │
│    <h4 data-repeat-item="arma" data-arma-indice="3">      │
│      ARMA C - Espingarda CBC Pump                         │
│    </h4>                                                  │
│    A arma Espingarda marca CBC, calibre 12...             │
│  </div>                                                   │
│                                                           │
│  <h2>3. Conclusão</h2>                                    │
│  ... (H2 normal, não repetido)                            │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│          4. EDIÇÃO DA REP → SYNC DO LAUDO                │
│                                                           │
│  Perito altera arma 2 (.357 → .38) e salva               │
│       ↓                                                   │
│  Builder reexpande o grupo de armas com os dados novos    │
│       ↓                                                   │
│  Reconciliação preserva headings não derivadas da REP     │
│       ↓                                                   │
│  sincronizarSecoesCondicionais()                           │
│    1. Recalcula o HTML base do template                    │
│    2. Reconcila com o HTML atual                           │
│    3. Reescreve apenas o bloco derivado da REP            │
│       ↓                                                   │
│  bloco de armas atualizado; edições fora do grupo         │
│  permanecem preservadas                                   │
└─────────────────────────────────────────────────────────┘
```

> ⚠️ **Observação sobre duplicação:** O título do H3 e o conteúdo são campos independentes. Se o conteúdo começar com os mesmos placeholders do `repetir_titulo` (ex: `ARMA {{b602_arma_1_letra}} - {{b602_arma_1_tipo}}` no H3 e também na primeira linha do conteúdo), o laudo exibirá a informação duplicada — uma vez no `<h3>` e outra vez no corpo. Recomenda-se manter o conteúdo enxuto (apenas a descrição, sem repetir o padrão do H3).

---

## Decisões de Design (definidas na sessão de grilling)

| Decisão | Escolha |
|---------|---------|
| `condicao` vs `repetir_para` — manter ambos? | **Manter ambos.** São ortogonais: `condicao` controla visibilidade (toggle), `repetir_para` controla repetição. Uma seção pode ter os dois. |
| `repetir_titulo` — novo campo? | **Sim.** O nome da seção (`secao.nome`) vira título do H2/H3 pai; `repetir_titulo` define o padrão do heading de cada arma. Fallback: `repetir_titulo \|\| secao.nome` para compatibilidade retroativa. |
| Correção do bug `condicao` não persistido? | **Corrigir junto.** `condicao` está na migration v25 e na interface mas NUNCA foi incluído no INSERT/UPDATE do service. Corrigir no mesmo PR. |
| Edições do perito em subseções expandidas? | **Preservar fora do bloco derivado.** O laudo atual é reconciliado com a base do template, preservando edições manuais fora das seções derivadas da REP. |
| Aviso ao alterar armas na REP? | **Sincronização direta.** O código atual reconcilia o laudo com a REP salva, sem snapshot persistido. |
| Gatilho da sincronização? | **Imediato no save da REP.** Ao confirmar o salvamento, dispara `sincronizarSecoesCondicionais` no laudo vinculado. |
| Laudo aberto durante sync? | **Sem problema.** `/reps` e `/laudos` são rotas separadas — nunca abertas simultaneamente. |
| `_reaplicarBlocosPeca` adaptado? | **Sim — verificação obrigatória.** Reconhecer headings estruturais e manter os blocos de arma fora do parse plano do laudo. |
| Wizard (`gerarLaudoWizard`)? | **Fora do escopo.** Foco exclusivo no modo template. |
| Estratégia de colapsagem? | **DOM/regex híbrido com `data-repeat-group`.** Cada expansão gera `<div data-repeat-group="armas" data-repeat-owner="...">`. Colapsagem remove o wrapper antigo e a reconciliação reinsere o grupo atualizado sem perder o restante do HTML. |
| Limite de N para placeholders de armas? | **Dinâmico, sem limite.** Placeholders genéricos resolvidos em runtime no loop `armas.forEach`. |
| Preview de placeholders de exame? | **Curto prazo:** Aceitar limitação. Adicionar hint "Placeholders de exame são resolvidos na exportação." Resolução completa no preview será PR futuro. |
| Placeholders computados vs JSON? | **Separar explicitamente.** Campo `jsonPath` para dados do JSON, campo `computed: true` para valores gerados em runtime (ex: `letra`). |

---

## Arquitetura: Novo módulo `secao-builder.service.ts`

Para evitar que `laudo.service.ts` acumule lógica de parse/expansão/reconciliação, extrair um módulo dedicado com responsabilidades isoladas e testáveis:

```
src/main/services/secao-builder.service.ts
├── expandirSecoesRepetiveis(secoes: SecaoTemplateRow[], dadosRep: unknown) → string
│   // Aplica repetir_para, gera <div data-repeat-group="armas" data-repeat-owner="..."> com H4s e placeholders reindexados
├── colapsarSecoesExpandidas(html: string) → string
│   // regex para remover os wrappers <div data-repeat-group="...">
├── reconciliarSecoes(htmlOriginal: string, htmlExpansoes: Map<string, string>) → string
│   // Reinsere o grupo atualizado após o heading correspondente
│   // Preserva edições do usuário em seções não derivadas
├── substituirIndicePlaceholders(html: string, idx: number) → string
│   // Troca _1_ por _N_ dentro de {{...}}
└── buildHtml(secoes: SecaoTemplateRow[], htmlExpansoes: Map<string, string>) → string
    // Monta HTML: pais viram <h2>, filhos <h3>, repetíveis de arma viram o bloco expandido
```

**`laudo.service.ts`** passa a ser um **orquestrador** que chama essas funções, sem lógica de parse/expansão inline.

**Por que `data-repeat-group`?** O TinyMCE 8.5 deste projeto preserva `data-*` attributes por padrão. O wrapper `<div>` com `data-repeat-group` permite identificar o bloco repetível e reexpandi-lo na reconciliação sem depender de estrutura fixa de texto.

### Interfaces do módulo

```ts
/** Informação de uma expansão: qual seção do template gerou, e o HTML resultante */
interface GrupoRepeticao {
  secaoId: string;             // id da seção_template original
  nomeSecao: string;           // nome da seção (ex: "Das Armas")
  repeatGroup: string;         // valor do data-repeat-group (ex: "armas")
  html: string;                // HTML completo do wrapper (<div data-repeat-group="...">...</div>)
}

/** Mapeamento: repeatGroup → HTML do wrapper */
type ExpansoesMap = Map<string, string>;
```

Não há mais `SecaoParseada` nem `SecaoExpandida`. O módulo trabalha com strings HTML e DOM selectors, sem depender de structs de parse intermediárias.

---

## Implementação

### 1. Database — Migration v26 + v27

**Arquivo:** `src/main/database/index.ts`

- Bump `CURRENT_SCHEMA_VERSION` de 25 para 26 (depois 26 → 27)
- Migration v26: coluna `repetir_para TEXT`
- Migration v27: coluna `repetir_titulo TEXT`

```ts
// Migration versão 27: Adicionar coluna repetir_titulo
if (fromVersion < 27) {
  try {
    const cols = await executeQuery<{ name: string }>(
      'PRAGMA table_info(secoes_template)'
    );
    if (!cols.some(c => c.name === 'repetir_titulo')) {
      await executeNonQuery(
        'ALTER TABLE secoes_template ADD COLUMN repetir_titulo TEXT'
      );
      log.debug('Migration v27: Coluna repetir_titulo adicionada à tabela secoes_template');
    }
  } catch (error) {
    log.error('Erro ao aplicar migration versão 27', error);
  }
}

// Migration versão 26: Adicionar coluna repetir_para
if (fromVersion < 26) {
  try {
    const cols = await executeQuery<{ name: string }>(
      'PRAGMA table_info(secoes_template)'
    );
    if (!cols.some(c => c.name === 'repetir_para')) {
      await executeNonQuery(
        'ALTER TABLE secoes_template ADD COLUMN repetir_para TEXT'
      );
      log.debug('Migration v26: Coluna repetir_para adicionada à tabela secoes_template');
    }
  } catch (error) {
    log.error('Erro ao aplicar migration versão 26', error);
  }
}
```

---

### 2. Tipos — `SecaoTemplateRow`

**Arquivo:** `src/main/types/database.ts`

```ts
export interface SecaoTemplateRow extends DatabaseRow {
  id: string
  template_id: string
  nome: string
  ordem: number
  conteudo?: string
  condicao?: string | null      // já existe, migration v25
  repetir_para?: string | null   // 'armas' | null
  repetir_titulo?: string | null // NOVO: padrão do título H3 (ex: "ARMA {{b602_arma_1_letra}} - ...")
  created_at: string
  updated_at: string
}
```

---

### 3. Template Service — CRUD completo

**Arquivo:** `src/main/services/template.service.ts`

#### 3a. Corrigir `createSecao()` — adicionar `condicao` (bug fix) + `repetir_para` + `repetir_titulo`

O INSERT atual ignora `condicao`. Corrigir incluindo todos os campos:

```ts
async createSecao(data: Omit<SecaoTemplateRow, 'id' | 'created_at' | 'updated_at'>): Promise<SecaoTemplateRow> {
  const id = randomUUID();
  await executeNonQuery(
    `INSERT INTO secoes_template (id, template_id, nome, ordem, conteudo, condicao, repetir_para, repetir_titulo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [id, data.template_id, data.nome, data.ordem, data.conteudo || null, data.condicao || null, data.repetir_para || null, data.repetir_titulo || null]
  );
  // ...
}
```

#### 3b. Corrigir `updateSecao()` — adicionar `condicao` (bug fix) + `repetir_para` + `repetir_titulo`

Adicionar após o bloco de `conteudo`:

```ts
if (data.condicao !== undefined) { sets.push('condicao = ?'); params.push(data.condicao); }
if (data.repetir_para !== undefined) { sets.push('repetir_para = ?'); params.push(data.repetir_para); }
if (data.repetir_titulo !== undefined) { sets.push('repetir_titulo = ?'); params.push(data.repetir_titulo); }
```

---

### 4. IPC Handlers — Propagar `repetir_para` + `repetir_titulo`

**Arquivo:** `src/main/ipc/handlers/template.handlers.ts`

#### 4a. `template:createSecao`

Adicionar `repetir_para` e `repetir_titulo` ao tipo do parâmetro `data` e propagar para o service:

```ts
ipcMain.handle('template:createSecao', async (_event, data: {
  template_id: string;
  nome: string;
  ordem: number;
  conteudo?: string;
  condicao?: string | null;
  repetir_para?: string | null;  // NOVO v26
  repetir_titulo?: string | null; // NOVO v27
}) => {
  const secao = await templateService.createSecao({
    template_id: data.template_id,
    nome: sanitizeInput(data.nome.trim()),
    ordem: data.ordem ?? 0,
    conteudo: data.conteudo || undefined,
    condicao: data.condicao || undefined,
    repetir_para: data.repetir_para || undefined,
    repetir_titulo: data.repetir_titulo || undefined,
  });
  return { success: true, data: secao, message: 'Seção criada com sucesso' };
});
```

#### 4b. `template:updateSecao`

Adicionar `repetir_para` e `repetir_titulo` ao tipo do parâmetro `data` e propagar:

```ts
ipcMain.handle('template:updateSecao', async (_event, id: string, data: {
  nome?: string;
  ordem?: number;
  conteudo?: string;
  condicao?: string | null;
  repetir_para?: string | null;
  repetir_titulo?: string | null; // NOVO v27
}) => {
  const updateData: Record<string, unknown> = {};
  if (data.nome !== undefined) updateData.nome = sanitizeInput(data.nome);
  if (data.ordem !== undefined) updateData.ordem = data.ordem;
  if (data.conteudo !== undefined) updateData.conteudo = data.conteudo;
  if (data.condicao !== undefined) updateData.condicao = data.condicao;
  if (data.repetir_para !== undefined) updateData.repetir_para = data.repetir_para;
  if (data.repetir_titulo !== undefined) updateData.repetir_titulo = data.repetir_titulo; // NOVO v27
  // ...
});
```

---

### 5. Novo módulo — `secao-builder.service.ts` (CORE)

**Arquivo:** `src/main/services/secao-builder.service.ts` (NOVO)

#### 5a. `substituirIndicePlaceholders()`

```ts
export function substituirIndicePlaceholders(html: string, idx: number): string {
  return html.replace(/\{\{([^}]+)\}\}/g, (_match, chave: string) => {
    return '{{' + chave.replace(/_1_/g, `_${idx}_`) + '}}';
  });
}
```

**Segurança:** O regex só opera dentro de `{{...}}`, então texto em prosa contendo `_1_` nunca é afetado.

#### 5b. `expandirSecoesRepetiveis()`

Retorna um `Map<string, string>` onde a chave é o `repeatGroup` (ex: `'armas'`) e o valor é o HTML completo do wrapper `<div data-repeat-group="...">`.

```ts
export function expandirSecoesRepetiveis(
  secoes: SecaoTemplateRow[],
  camposEspecificos: Record<string, unknown>
): Map<string, string> {
  const resultado = new Map<string, string>();

  for (const secao of secoes) {
    if (!secao.repetir_para) continue; // seções normais são tratadas pelo buildHtml
    if (secao.repetir_para !== 'armas') continue;

    const b602 = camposEspecificos?.b602 as Record<string, unknown> | undefined;
    const armasToggle = b602?.armas_toggle;
    const armas = b602?.armas as Record<string, unknown>[] | undefined;

    // Toggle desligado → grupo vazio (seção some)
    if (armasToggle !== 'on') {
      resultado.set('armas', '');
      continue;
    }
    // Sem armas → grupo vazio (seção some)
    if (!armas || armas.length === 0) {
      resultado.set('armas', '');
      continue;
    }

    const partes: string[] = [];
    for (let i = 0; i < armas.length; i++) {
      const idx = i + 1;
      // O título H3 usa repetir_titulo (se definido) com fallback para o nome da seção
      const nome = substituirIndicePlaceholders(secao.repetir_titulo || secao.nome, idx);
      const conteudo = substituirIndicePlaceholders(secao.conteudo || '', idx);
      partes.push(`<h3>${nome}</h3>\n${conteudo}`);
    }

    resultado.set('armas',
      `<div data-repeat-group="armas">\n${partes.join('\n')}\n</div>`
    );
  }

  return resultado;
}
```

**Nota:** Se toggle desligado ou 0 armas, o grupo é registrado como string vazia. Na reconciliação, o builder remove qualquer `div[data-repeat-group="armas"]` existente e não reinsere nada, preservando o restante do HTML do laudo.

#### 5c. ~~`parseHtmlEmSecoes()`~~ — **Removida**

Não é mais necessária como etapa isolada. O código atual usa `secao-builder.service.ts` para processar wrappers repetíveis e para reconstruir headings estruturais com base em `h2`/`h3`.

#### 5d. `colapsarSecoesExpandidas()`

Remove todos os `<div data-repeat-group>` do HTML, preservando o restante intacto:

```ts
export function colapsarSecoesExpandidas(html: string): string {
  // Remove divs com data-repeat-group (incluindo todo seu conteúdo interno)
  return html.replace(/<div\s+data-repeat-group="[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
}
```

**Nota:** O regex é seguro porque:
- O TinyMCE 8.5 preserva `data-*` attributes (já confirmado)
- O wrapper é gerado pelo sistema, nunca por input do usuário
- O atributo exato (`data-repeat-group="armas"`) evita colisão com outros divs
- O conteúdo removido é todo o bloco repetível gerado pelo sistema — o restante do laudo é preservado pela reconciliação

#### 5e. `reconciliarSecoes()`

Recebe o HTML já colapsado (sem `div[data-repeat-group]`) e o `Map<repeatGroup, html>` da expansão. Reinsere cada grupo após o heading estrutural correspondente:

```ts
export function reconciliarSecoes(
  htmlColapsado: string,
  expansoes: Map<string, string>
): string {
  let html = htmlColapsado;

  for (const [repeatGroup, htmlGrupo] of expansoes) {
    // Encontra o heading marcado com data-repeat-section
    const regexH3 = new RegExp(
      `<h3[^>]*data-repeat-section="${repeatGroup}"[^>]*>[\\s\\S]*?<\\/h3>`, 'i'
    );
    const match = regexH3.exec(html);
    if (!match) continue; // H2 não encontrado → preserva HTML como está

    const h3Completo = match[0];
    const posFimH3 = match.index + h3Completo.length;

    if (htmlGrupo) {
      // Insere o div após o heading da seção
      html = html.slice(0, posFimH3) + '\n' + htmlGrupo + html.slice(posFimH3);
    }
    // Se htmlGrupo for vazio (toggle off ou 0 armas), não insere nada
    // O heading permanece no HTML mas sem conteúdo de arma
  }

  return html;
}
```

**Marcação do heading no `buildHtml`:** O heading das seções repetíveis recebe `data-repeat-section` para que `reconciliarSecoes` encontre o ponto de inserção exato:

```ts
// Em buildHtml:
partes.push(`<h3 data-repeat-section="armas">${contador}.${indice} ${secao.nome}</h3>`);
```

**Reconciliação atual:** o conteúdo derivado da REP é refeito a cada sincronização, mas as edições fora das seções derivadas da REP são preservadas pelo `_reconciliarComBase()` do `laudo.service.ts`.

#### 5f. `buildHtml()`

Monta o HTML final do laudo: seções normais viram `<h2>`/`<h3>` numerados conforme a hierarquia do template. Seções com `repetir_para='armas'` usam o HTML do `expandirSecoesRepetiveis` dentro do wrapper `<div data-repeat-group>`:

```ts
export function buildHtml(
  secoes: SecaoTemplateRow[],
  expansoes: Map<string, string>
): string {
  const partes: string[] = [];

  // ... hierarquia H2/H3 atual + wrapper repeat-group para armas ...

  return partes.join('\n');
}
```

**A numeração atual preserva a hierarquia do template:** pais em `<h2>`, filhos em `<h3>` e o bloco repetível de armas em um wrapper próprio com headings internos por arma.

---

### 6. Laudo Service — Integração com `secao-builder`

**Arquivo:** `src/main/services/laudo.service.ts`

#### 6a. `criarLaudoInicial()`

Substituir o loop atual de `map` com `<h2>` pelo builder:

```ts
async criarLaudoInicial(params: { rep_id: string; template_id: string }): Promise<LaudoRow> {
  // ... guard clause existente ...

  // Buscar seções do template
  const secoes = await templateService.findSecoesByTemplate(params.template_id);

  // Buscar campos_especificos da REP (NOVO)
  const [rep] = await executeQuery<{ campos_especificos?: string | null }>(
    'SELECT campos_especificos FROM reps WHERE id = ?', [params.rep_id]
  );
  const especificos = rep?.campos_especificos ? JSON.parse(rep.campos_especificos) : {};

  const secoesAtivas = filtrarSecoesAtivas(secoes, especificos);
  const expansoes = expandirSecoesRepetiveis(secoesAtivas, especificos);
  const conteudo = buildHtml(secoesAtivas, expansoes, especificos);

  // Inserir laudo (código existente)
  // ...
}
```

**Nota:** No momento da criação da REP, `armas` está vazio → `expandirSecoesRepetiveis` retorna `Map` com `'armas' → ''` → `buildHtml` gera a estrutura do template sem o bloco repetível de armas. Quando a REP é atualizada com armas, `sincronizarSecoesCondicionais` reconcilia o HTML com a nova base.

#### 6b. `sincronizarSecoesCondicionais()`

Atualizar a sincronização para trabalhar com a base estruturada:

```ts
async sincronizarSecoesCondicionais(laudo_id: string): Promise<void> {
  // ... fetch existente de laudo, secoes, rep, especificos ...

  const secoesFiltradas = filtrarSecoesAtivas(secoes, especificos);
  const expansoes = expandirSecoesRepetiveis(secoesFiltradas, especificos);
  const conteudoBase = buildHtml(secoesFiltradas, expansoes, especificos);
  const novoConteudo = this._reconciliarComBase(laudo.conteudo, conteudoBase, especificos);

  // 4. Atualizar se houve mudança (código existente)
  if (novoConteudo !== laudo.conteudo) {
    await executeNonQuery('UPDATE laudos SET conteudo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [novoConteudo, laudo_id]);
  }
}
```

**O que muda em relação ao spec anterior:**
- `colapsarSecoesExpandidas` continua sendo um helper de suporte, mas a sincronização atual usa `_parseBlocosEstruturais()` e `_reconciliarComBase()`
- o HTML derivado da REP é reconstruído por completo, enquanto o restante do laudo é preservado
- o grupo repetível de armas usa headings internos próprios, não H3s globais

#### 6c. `_reaplicarBlocosPeca()` — **Incluso (verificação obrigatória)**

Precisa ignorar o conteúdo de `div[data-repeat-group]` ao reaplicar blocos de peças processuais — os blocos (cabeçalho, rodapé, assinatura) devem ser inseridos **fora** do wrapper. A lógica atual já faz a reaplicação em cima de headings estruturais, então a checagem continua válida, mas o wrapper repetível precisa permanecer intacto.

**Verificação:** Após a implementação do secao-builder, testar se `_reaplicarBlocosPeca` ainda funciona corretamente com laudos contendo armas.

`gerarLaudoWizard()` está **fora do escopo** desta implementação. Foco exclusivo no modo template.

---

### 7. Schema Zod — Adicionar `condicao` (bug fix) + `repetir_para` + `repetir_titulo`

**Arquivo:** `src/renderer/lib/validators/template.schema.ts`

```ts
export const secaoTemplateSchema = z.object({
  id: z.string().uuid(),
  template_id: z.string().uuid(),
  nome: z.string().min(1).max(200),
  ordem: z.number().int().min(0),
  conteudo: z.string().nullable().optional(),
  condicao: z.string().nullable().optional(),       // bug fix: estava ausente
  repetir_para: z.enum(['armas']).nullable().optional(),  // v26
  repetir_titulo: z.string().nullable().optional(),       // v27: padrão H3
  created_at: z.string(),
  updated_at: z.string(),
});
```

---

### 8. TemplatesPage — Estado local resiliente

**Arquivo:** `src/renderer/pages/TemplatesPage.tsx`

#### 8a. Interface `SecaoForm` — adicionar `repetir_para` + `repetir_titulo`

```ts
interface SecaoForm {
  id?: string;
  nome: string;
  conteudo: string;
  condicao?: string;
  repetir_para?: string;    // v26
  repetir_titulo?: string;  // v27
}
```

#### 8b. Interface `SecaoItem` — adicionar `condicao` (bug fix) + `repetir_para` + `repetir_titulo`

```ts
interface SecaoItem {
  id: string;
  template_id: string;
  nome: string;
  ordem: number;
  conteudo?: string;
  condicao?: string | null;       // bug fix: estava ausente
  repetir_para?: string | null;   // v26
  repetir_titulo?: string | null; // v27
}
```

#### 8c. `emptySecaoForm()` — inicializar `repetir_para` + `repetir_titulo`

```ts
const emptySecaoForm = (): SecaoForm => ({
  nome: '', conteudo: '', repetir_para: '', repetir_titulo: '',
});
```

#### 8d. `hydrateSecaoForm()` — NOVA função de hidratação

Substitui o mapeamento inline no `handleEditar`. Garante que TODOS os campos do banco cheguem ao estado local:

```ts
function hydrateSecaoForm(row: SecaoItem): SecaoForm {
  return {
    id: row.id,
    nome: row.nome,
    conteudo: row.conteudo ? unescapeField(row.conteudo) : '',
    condicao: row.condicao || '',
    repetir_para: row.repetir_para || '',
    repetir_titulo: row.repetir_titulo || '',
  };
}
```

#### 8e. `handleEditar` — usar `hydrateSecaoForm`

Substituir o mapeamento atual (linha 344-346):

```ts
// Antes:
secoesDb.map(se => ({ id: se.id, nome: se.nome, conteudo: se.conteudo ? unescapeField(se.conteudo) : '' }))

// Depois:
secoesDb.map(hydrateSecaoForm)
```

#### 8f. `handleSalvar` — propagar `repetir_para` + `repetir_titulo`

Adicionar `repetir_para` e `repetir_titulo` aos objetos passados para `updateSecao` e `createSecao`:

```ts
await window.ipcAPI.template.updateSecao(sec.id, {
  nome: sec.nome.trim(),
  conteudo: sec.conteudo,
  ordem: i,
  condicao: sec.condicao || null,
  repetir_para: sec.repetir_para || null,   // v26
  repetir_titulo: sec.repetir_titulo || null, // v27
});
```

#### 8g. `handleClonar` — propagar `condicao` (bug fix) + `repetir_para` + `repetir_titulo`

```ts
await window.ipcAPI.template.createSecao({
  template_id: novoId,
  nome: sec.nome,
  ordem: i,
  conteudo: sec.conteudo,
  condicao: sec.condicao || null,          // bug fix
  repetir_para: sec.repetir_para || null,  // v26
  repetir_titulo: sec.repetir_titulo || null, // v27
});
```

#### 8h. UI — Select "Repetir para cada" + Input "Título do H3"

No painel de cada seção, ao lado do `<Select>` de condição (~linha 1201), adicionar o select de repetição:

```tsx
<Select
  value={secao.repetir_para || '__none__'}
  onValueChange={(v) => updateSecao(index, 'repetir_para', v === '__none__' ? '' : v)}
>
  <SelectTrigger className="w-[160px] h-8 text-xs">
    <SelectValue placeholder="Repetir para cada..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="__none__">Não repetir</SelectItem>
    <SelectItem value="armas">Arma</SelectItem>
  </SelectContent>
</Select>
```

Quando `repetir_para === 'armas'`, exibir um campo de texto para o padrão do título H3:

```tsx
{secao.repetir_para === 'armas' && (
  <div className="flex items-center gap-2">
    <Label className="text-xs text-muted-foreground whitespace-nowrap">Título do H3:</Label>
    <Input
      value={secao.repetir_titulo || ''}
      onChange={e => updateSecao(index, 'repetir_titulo', e.target.value)}
      placeholder="Ex: ARMA {{b602_arma_1_letra}} - {{b602_arma_1_tipo}} {{b602_arma_1_marca}} {{b602_arma_1_modelo}}"
      className="flex-1 h-8 text-xs font-mono"
    />
  </div>
)}
```

**Hint** exibido quando `repetir_para = 'armas'`:

> Use placeholders com `_1_` como padrão. Ex: `{{b602_arma_1_tipo}}`, `{{b602_arma_1_letra}}`. O campo **Título do H3** define o título de cada subseção. **Atenção:** Edições manuais no conteúdo das subseções de arma serão perdidas ao atualizar a REP — os dados sempre refletem a REP atual.
>
> ⚠️ **Evite duplicação:** se o título do H3 já exibe "ARMA A - Pistola Taurus", não repita os placeholders de tipo/marca/modelo na primeira linha do conteúdo.

---

#### 8i. Hint sobre preview de placeholders

No topo do editor de template (área de preview), adicionar tooltip:

> Placeholders de exame (B-602, I-801) são resolvidos na exportação do laudo. Use a prévia do laudo ou exporte para visualizar os dados reais.

---

### 9. Campo "modelo" nas Armas (B-602)

**Motivação:** O título da subseção precisa de `{{b602_arma_1_modelo}}`. Atualmente o formulário de armas não possui o campo "modelo".

#### 9a. Formulário — `ArmasFields`

**Arquivo:** `src/renderer/components/rep/exam-fields/b602.tsx`

No array `ARMA_CAMPOS` dentro de `ArmasFields` (~linha 994), adicionar após `marca`:

```ts
{ key: 'marca', label: 'Marca *', type: 'input' },
{ key: 'modelo', label: 'Modelo', type: 'input' },   // ← NOVO
{ key: 'calibre', label: 'Calibre *', type: 'input' },
```

#### 9b. Serialização — `b602Service`

**Arquivo:** `src/renderer/components/rep/exam-fields/services/b602.service.ts`

Adicionar `'modelo'` ao array `ARMA_CAMPOS` (linha 17):

```ts
const ARMA_CAMPOS = [
  'tipo', 'marca', 'modelo', 'calibre', 'numeracao_serie', 'numeracao_cano',
  'capacidade_carregador', 'comprimento_cano', 'acabamento',
  'funcionamento', 'estado_conservacao', 'quantidade', 'dito_oficio', 'numero_lacre',
];
```

#### 9c. Tipo `REPFormData`

**Arquivo:** `src/renderer/components/rep/exam-fields/types.ts`

Os campos do formulário usam índice string (`[key: string]: string`), então `b602_armas_0_modelo`, `b602_armas_1_modelo`, etc. são automaticamente suportados. Não é necessário alterar a interface.

---

### 10. Novos placeholders — Categoria B-602

Todos os novos placeholders pertencem à categoria existente **B-602 - Eficiência e Prestabilidade** (`cat-exam-B-602`).

> **Todos os placeholders de arma são DINÂMICOS — sem limite fixo de N.** A resolução acontece no loop `armas.forEach` durante a exportação, suportando qualquer quantidade de armas cadastradas na REP. O seletor de placeholders na UI mostra entradas genéricas (ex: `b602_arma_N_tipo`), resolvidas em runtime para o índice real.

#### 10a. `b602_arma_N_letra` — Letra sequencial (COMPUTADO)

Mapeia índice da arma para letra (0→A, 1→B, ..., 25→Z, 26→AA, 27→AB...). **Valor computado em runtime, não existe no JSON.**

#### 10b. `b602_arma_N_modelo` — Modelo da arma (JSON)

Mapeia para `armas[N-1].modelo`. **Valor extraído do JSON da REP.**

#### 10c. Demais placeholders indexados de arma

Já existem em `exportacao-placeholders.ts` (linhas 225-240):
`b602_arma_N_tipo`, `b602_arma_N_marca`, `b602_arma_N_calibre`, `b602_arma_N_numeracao_serie`, `b602_arma_N_numeracao_cano`, `b602_arma_N_capacidade_carregador`, `b602_arma_N_comprimento_cano`, `b602_arma_N_acabamento`, `b602_arma_N_funcionamento`, `b602_arma_N_estado_conservacao`, `b602_arma_N_quantidade`, `b602_arma_N_dito_oficio`, `b602_arma_N_numero_lacre`

**Arquivos a modificar:**

1. **`src/renderer/components/rep/exam-fields/placeholders.ts`** — `CAMPOS_ESPECIFICOS_PLACEHOLDERS`:

   > **Placeholders genéricos (sem índice fixo).** O seletor exibe entradas com `_N_` (ex: `b602_arma_N_modelo`). A resolução para o índice real (`_1_`, `_2_`, etc.) ocorre em runtime no `exportacao-placeholders.ts`.

   ```ts
   // Placeholder computado (não vem do JSON):
   { chave: 'b602_arma_N_letra', label: 'Letra da Arma', descricao: 'Letra sequencial (A, B, C...)', jsonPath: '', computed: true, categoria_exam_codigo: 'B-602' },
   // Placeholder do JSON:
   { chave: 'b602_arma_N_modelo', label: 'Modelo da Arma', descricao: 'Modelo da arma', jsonPath: 'b602.armas.0.modelo', categoria_exam_codigo: 'B-602' },
   ```

   Atualizar a interface `CampoEspecificoPlaceholder`:
   ```ts
   export interface CampoEspecificoPlaceholder {
     chave: string;
     label: string;
     descricao: string;
     jsonPath?: string;          // caminho no JSON da REP (ausente para computados)
     computed?: true;            // true se o valor é gerado em runtime
     categoria_exam_codigo: string;
   }
   ```

2. **`src/main/services/placeholder.service.ts`** — seed de placeholders:
   - Adicionar `b602_arma_N_letra` e `b602_arma_N_modelo` na categoria `cat-exam-B-602`

3. **`src/renderer/components/rep/exam-fields/b602.tsx`** — `B602_MENU_STRUCTURE`:
   - No grupo "Arma" (prefix `b602_arma_`), adicionar:
     ```ts
     { name: 'letra', label: 'Letra' },
     { name: 'modelo', label: 'Modelo' },
     ```

---

### 11. Resolução na exportação

**Arquivo:** `src/renderer/lib/exportacao-placeholders.ts`

#### 11a. Placeholders computados: `b602_arma_N_letra`

No loop `armas.forEach((arma, i))` (~linha 225), adicionar:

```ts
mapping[`b602_arma_${idx}_letra`] = numToLetra(i);  // 0→A, 1→B, ...
mapping[`b602_arma_${idx}_modelo`] = arma.modelo || '';
```

#### 11b. Função auxiliar `numToLetra()`

Adicionar no mesmo arquivo (fora de qualquer função, como module-private):

```ts
function numToLetra(n: number): string {
  if (n < 26) return String.fromCharCode(65 + n);
  return numToLetra(Math.floor(n / 26) - 1) + String.fromCharCode(65 + (n % 26));
}
// 0→A, 1→B, ..., 25→Z, 26→AA, 27→AB, ...
```

#### 11c. `buildPlaceholderMapping()` — respeitar `computed`

Placeholders com `computed: true` devem ser pulados na resolução por `jsonPath` (a tentativa de ler `b602.armas.0.letra` do JSON retorna `undefined`, o que é inofensivo, mas o código deve documentar que o valor real vem do loop `armas.forEach`).

---

### 12. Preview da REP (iteração futura)

**Arquivo:** `src/renderer/pages/REPsPage.tsx`

A mesma lógica de expansão pode ser aplicada em `buildRepHtml()` para preview. **Implementar em PR separado** para reduzir o escopo inicial.

---

### 13. REPsPage — Diálogo de aviso ao alterar armas

**Arquivo:** `src/renderer/pages/REPsPage.tsx`

> **Nota histórica:** esta estratégia de snapshot + diálogo modal ficou no plano original, mas o código final adotou sincronização direta sem snapshot persistido.

#### 13a. Snapshot dos dados de arma

Ao abrir edição (`handleEditar`), após popular o formulário, capturar snapshot dos dados de arma:

```ts
const armasSnapshotRef = useRef<Record<string, string>[] | null>(null);

// No handleEditar, após form.reset():
const raw = especificos?.b602?.armas;
armasSnapshotRef.current = raw ? JSON.parse(JSON.stringify(raw)) : null;
```

#### 13b. Detecção de mudança no `handleSalvar`

Antes de `executarSalvar`, extrair armas atuais do form e comparar com o snapshot:

```ts
const armasAtuais = extrairArmasDoForm(data); // lê b602_armas_0_tipo, etc.
const armasOriginais = armasSnapshotRef.current;
const armasMudaram = JSON.stringify(armasAtuais) !== JSON.stringify(armasOriginais);
```

#### 13c. Diálogo modal existente (reaproveitar ou criar)

Reaproveitar o mesmo padrão de `dialogoToggleAberto` (linhas 896-923). Se armas mudaram **e** existe laudo vinculado, abrir diálogo:

> **Os dados de arma foram alterados.**
> As seções correspondentes no laudo serão reescritas conforme o template. Edições manuais no conteúdo serão perdidas.
>
> [Continuar] [Cancelar]

#### 13d. Trigger de sincronização

Ao confirmar o diálogo, após salvar a REP, chamar `sincronizarSecoesCondicionais` no laudo vinculado:

```ts
if (armasMudaram) {
  const laudoResp = await window.ipcAPI.laudo.findByRepId(editingRep.id);
  if (laudoResp.success && laudoResp.data) {
    await window.ipcAPI.laudo.sincronizarSecoes(laudoResp.data.id);
  }
}
```

**Nota:** O canal `laudo:sincronizarSecoes` já existe? Verificar. Se não, criar handler que chama `sincronizarSecoesCondicionais` no service.

---

## Resumo dos Arquivos Modificados

| # | Arquivo | Mudança | Tipo |
|---|---|---|---|---|
| 1 | `src/main/database/index.ts` | Migration v26: coluna `repetir_para` + Migration v27: coluna `repetir_titulo` | Migration |
| 2 | `src/main/types/database.ts` | Campos `repetir_para` + `repetir_titulo` em `SecaoTemplateRow` | Tipo |
| 3 | `src/main/services/template.service.ts` | **Bug fix:** `condicao` no INSERT/UPDATE + `repetir_para` + `repetir_titulo` | Correção |
| 4 | `src/main/services/secao-builder.service.ts` | **NOVO:** `expandirSecoesRepetiveis` (usa `repetir_titulo \|\| nome` para H3), `colapsarSecoesExpandidas`, `reconciliarSecoes`, `buildHtml`, `substituirIndicePlaceholders` | Novo módulo |
| 5 | `src/main/services/laudo.service.ts` | Integrar com `secao-builder` em `criarLaudoInicial` e `sincronizarSecoesCondicionais` | Refactor |
| 6 | `src/main/services/placeholder.service.ts` | Placeholders `b602_arma_N_letra`, `b602_arma_N_modelo` (categoria B-602) — genéricos, sem índice fixo | Seed |
| 7 | `src/main/ipc/handlers/template.handlers.ts` | Propagar `repetir_para` + `repetir_titulo` nos handlers de seção | IPC |
| 8 | `src/renderer/pages/TemplatesPage.tsx` | **Bug fix:** `SecaoItem`, `handleEditar`, `handleClonar`, `handleSalvar` + `hydrateSecaoForm` + Select "Repetir para cada" + Input "Título do H3" + hints | UI + Correção |
| 9 | `src/renderer/components/rep/exam-fields/b602.tsx` | Campo "modelo" no `ArmasFields` + placeholders `letra`/`modelo` no `B602_MENU_STRUCTURE` | UI |
| 10 | `src/renderer/components/rep/exam-fields/placeholders.ts` | Interface `CampoEspecificoPlaceholder` com `computed` + placeholders genéricos `b602_arma_N_letra`, `b602_arma_N_modelo` | Tipo + Dados |
| 11 | `src/renderer/components/rep/exam-fields/services/b602.service.ts` | Adicionar `'modelo'` ao `ARMA_CAMPOS` | Dados |
| 12 | `src/renderer/lib/exportacao-placeholders.ts` | Resolver `b602_arma_N_letra` + `b602_arma_N_modelo` + função `numToLetra()` | Export |
| 13 | `src/renderer/lib/validators/template.schema.ts` | **Bug fix:** `condicao` no schema + `repetir_para` + `repetir_titulo` | Validação |
| 14 | `src/renderer/pages/REPsPage.tsx` | Snapshot de armas + diálogo modal ao alterar dados + trigger sync no laudo | UI + Integração |

---

## Verificação

1. **Criar template B-602** → adicionar seção com `repetir_para = 'armas'`, `repetir_titulo = 'ARMA {{b602_arma_1_letra}} - {{b602_arma_1_tipo}} {{b602_arma_1_marca}} {{b602_arma_1_modelo}}'` e nome `DOS EXAMES`
2. **Salvar e reabrir o template** → verificar que `repetir_para`, `repetir_titulo` e `condicao` foram preservados (valida correção do `SecaoItem`/`handleEditar` + `hydrateSecaoForm`)
3. **Clonar o template** → verificar que `repetir_para`, `repetir_titulo` e `condicao` foram preservados no clone
4. **Criar REP B-602** com 3 armas, preenchendo tipo, marca, modelo e demais campos
5. **Criar laudo** → verificar HTML:
   - `<h2>X. DOS EXAMES</h2>` seguido de `<div data-repeat-group="armas">`
   - Dentro do div, N `<h3>` com títulos vindos de `repetir_titulo`
   - Título da 1ª arma: "ARMA A - Pistola Taurus PT 100"
   - Título da 2ª arma: "ARMA B - Revólver S&W Model 686"
   - Placeholders de conteúdo com índices corretos (`_1_`, `_2_`, `_3_`)
   - **Fallback:** sem `repetir_titulo`, o H3 usa `secao.nome` (compatibilidade)
6. **Toggle "Possui Arma(s)?" desligado** → seção de armas some do laudo (após sincronizar)
7. **Toggle ligado, 0 armas cadastradas** → seção omitida (sem H2)
8. **Alterar dados de uma arma na REP** → sincronizar laudo → conteúdo do H3 correspondente é atualizado
9. **Adicionar texto manual num H3** → sincronizar laudo → texto manual é perdido (Opção A destrutiva)
9a. **Wrapper preservado no editor** → criar laudo, abrir no TinyMCE, salvar sem alterações, reabrir → `div[data-repeat-group="armas"]` ainda está presente (valida que TinyMCE não strip o atributo)
10. **Exportar PDF/DOCX** → subseções H3 formatadas corretamente, placeholders resolvidos
11. **Regressão** → templates sem `repetir_para` funcionam como antes
12. **Regressão** → `{{b602_tabela_armas}}` continua funcionando (tabela única)
13. **Regressão** → `condicao` que já existia no banco (se houver) continua funcionando após a correção do service
14. **Não duplicar conteúdo no H3** — se `repetir_titulo` exibe "ARMA A - Artesanal", o conteúdo não deve repetir esses mesmos dados na primeira linha
15. **Duplicação acidental** — se o conteúdo começar com o mesmo padrão do `repetir_titulo` (ex: "ARMA {{b602_arma_1_letra}} - {{b602_arma_1_tipo}}"), o laudo terá a informação duplicada (H3 + primeira linha do corpo). Orientar o perito a remover a linha duplicada do conteúdo.
16. **Aviso REP → Laudo** → editar REP com armas, alterar dados de uma arma, salvar → diálogo modal "Os dados de arma foram alterados" aparece → confirmar → laudo sincronizado com novos dados
17. **Sem alteração de armas** → editar REP, alterar apenas outro campo (ex: local do fato), salvar → **sem** diálogo modal (snapshot não detectou mudança)
18. **REP sem laudo vinculado** → alterar armas → salvar → **sem** diálogo modal (não há laudo para sincronizar)

---

## Notas de Implementação

### Correções de bugs pré-existentes incluídas neste PR

| Bug | Arquivo | Correção |
|-----|---------|----------|
| `condicao` nunca persistido no INSERT | `template.service.ts:createSecao()` | Adicionar `condicao` à lista de colunas e parâmetros |
| `condicao` nunca persistido no UPDATE | `template.service.ts:updateSecao()` | Adicionar `if (data.condicao !== undefined)` |
| `condicao` ausente do Zod schema | `template.schema.ts` | Adicionar `condicao: z.string().nullable().optional()` |
| `SecaoItem` sem `condicao` | `TemplatesPage.tsx` | Adicionar `condicao?: string \| null` |
| `handleEditar` dropa `condicao` | `TemplatesPage.tsx` | Usar `hydrateSecaoForm()` |
| `handleClonar` dropa `condicao` | `TemplatesPage.tsx` | Propagar `condicao` na chamada `createSecao` |

### Ordem recomendada de implementação

1. Migration v26 + v27 + tipo `SecaoTemplateRow` (arquivos 1-2)
2. Template service — corrigir `condicao` + adicionar `repetir_para` + `repetir_titulo` (arquivo 3)
3. IPC handlers — propagar `repetir_para` + `repetir_titulo` (arquivo 7)
4. Zod schema — adicionar `condicao` + `repetir_para` + `repetir_titulo` (arquivo 13)
5. Campo `modelo` nas armas (arquivos 9, 11)
6. Placeholders `letra` e `modelo` (arquivos 6, 10, 11 — exportação)
7. **NOVO módulo** `secao-builder.service.ts` (arquivo 4)
8. Integração no `laudo.service.ts` (arquivo 5)
9. TemplatesPage — UI + correções de hidratação (arquivo 8)
10. REPsPage — snapshot + diálogo + trigger sync (arquivo 14)
11. Testes manuais de verificação (todos os 18 itens acima)
