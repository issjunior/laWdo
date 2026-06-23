# Spec: Seções Repetíveis para Armas no Template B-602

> **Arquivos relacionados:**
> - Guia geral de inputs por tipo de exame → [`../criar_input_personalizados_exame.md`](../criar_input_personalizados_exame.md)
> - Spec completa B-602 (formulário, placeholders, tabelas) → [`criar_input_personalizado_b602.md`](criar_input_personalizado_b602.md)
> - Salvamento/recuperação de inputs → [`../salvar_input_personalizado.md`](../salvar_input_personalizado.md)

## Resumo

Permitir que uma seção do template seja marcada como "repetir para cada arma". O sistema gera automaticamente uma subseção `<h3>` para cada arma cadastrada na REP, com título no formato **"ARMA A - TIPO MARCA MODELO"**, resolvendo placeholders com os dados específicos de cada arma.

### Fluxo completo (exemplo com 3 armas)

```
┌─────────────────────────────────────────────────────────┐
│                    1. TEMPLATE                           │
│  Seção marcada com repetir_para = 'armas'                │
│  Nome: "ARMA {{b602_arma_1_letra}} - ..."               │
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
│  <div data-repeat-group="armas">     ← wrapper DOM       │
│    <h3>ARMA A - Pistola Taurus PT100</h3>                 │
│    A arma Pistola marca Taurus, calibre .40...            │
│    <h3>ARMA B - Revólver S&W 686</h3>                     │
│    A arma Revólver marca S&W, calibre .357...             │
│    <h3>ARMA C - Espingarda CBC Pump</h3>                  │
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
│  Snapshot detecta mudança nos dados de arma               │
│       ↓                                                   │
│  Diálogo modal: "Os dados de arma foram alterados.       │
│  As seções correspondentes no laudo serão reescritas."    │
│       ↓ [Confirmar]                                       │
│  sincronizarSecoesCondicionais():                          │
│    1. Colapsa → remove div[data-repeat-group] do HTML    │
│    2. Re-expande → gera novo div com 3 H3s e .38         │
│    3. Reconcilia → insere novo div após o H2 pai         │
│    4. Build → HTML final atualizado                       │
│       ↓                                                   │
│  div wrapper substituído; H3 da arma 2 com calibre .38;  │
│  edições em H2 normais (Introdução, Conclusão)            │
│  preservadas                                              │
└─────────────────────────────────────────────────────────┘
```

---

## Decisões de Design (definidas na sessão de grilling)

| Decisão | Escolha |
|---------|---------|
| `condicao` vs `repetir_para` — manter ambos? | **Manter ambos.** São ortogonais: `condicao` controla visibilidade (toggle), `repetir_para` controla repetição. Uma seção pode ter os dois. |
| Correção do bug `condicao` não persistido? | **Corrigir junto.** `condicao` está na migration v25 e na interface mas NUNCA foi incluído no INSERT/UPDATE do service. Corrigir no mesmo PR. |
| Edições do perito em subseções H3 expandidas? | **Opção A — Destrutiva.** A REP é a fonte da verdade. Toda sincronização re-expande do template, sobrescrevendo conteúdo H3. Avisar o usuário no formulário específico. |
| Aviso ao alterar armas na REP? | **Diálogo modal** (mesmo padrão de toggles existente). Detecção por snapshot em memória (React ref) comparado no save. |
| Gatilho da sincronização? | **Imediato no save da REP.** Ao confirmar o diálogo, dispara `sincronizarSecoesCondicionais` no laudo vinculado. |
| Laudo aberto durante sync? | **Sem problema.** `/reps` e `/laudos` são rotas separadas — nunca abertas simultaneamente. |
| `_reaplicarBlocosPeca` adaptado? | **Sim — verificação obrigatória.** Reconhecer H3s na reaplicação de peças processuais. |
| Wizard (`gerarLaudoWizard`)? | **Fora do escopo.** Foco exclusivo no modo template. |
| Estratégia de colapsagem? | **DOM-based com `data-repeat-group`.** Cada expansão gera `<div data-repeat-group="armas">`. Colapsagem: regex que busca `div[data-repeat-group]`. Reconciliação: remove wrapper antigo, insere novo. Dispensa `parseHtmlEmSecoes`. |
| Limite de N para placeholders de armas? | **Dinâmico, sem limite.** Placeholders genéricos resolvidos em runtime no loop `armas.forEach`. |
| Preview de placeholders de exame? | **Curto prazo:** Aceitar limitação. Adicionar hint "Placeholders de exame são resolvidos na exportação." Resolução completa no preview será PR futuro. |
| Placeholders computados vs JSON? | **Separar explicitamente.** Campo `jsonPath` para dados do JSON, campo `computed: true` para valores gerados em runtime (ex: `letra`). |

---

## Arquitetura: Novo módulo `secao-builder.service.ts`

Para evitar que `laudo.service.ts` acumule lógica de parse/expansão/reconciliação, extrair um módulo dedicado com responsabilidades isoladas e testáveis:

```
src/main/services/secao-builder.service.ts
├── expandirSecoesRepetiveis(secoes: SecaoTemplateRow[], dadosRep: unknown) → string
│   // Aplica repetir_para, gera <div data-repeat-group="armas"> com H3s e placeholders reindexados
├── colapsarSecoesExpandidas(html: string) → string
│   // querySelectorAll('div[data-repeat-group]') → remove todos os wrappers do HTML
├── reconciliarSecoes(htmlOriginal: string, htmlExpansoes: Map<string, string>) → string
│   // Substitui cada div[data-repeat-group] antigo pelo novo HTML gerado
│   // Preserva edições do usuário em seções não-repetíveis
├── substituirIndicePlaceholders(html: string, idx: number) → string
│   // Troca _1_ por _N_ dentro de {{...}}
└── buildHtml(secoes: SecaoTemplateRow[], htmlExpansoes: Map<string, string>) → string
    // Monta HTML: seções normais viram <h2>, seções repetíveis usam o HTML do expandir
```

**`laudo.service.ts`** passa a ser um **orquestrador** que chama essas funções, sem lógica de parse/expansão inline.

**Por que `data-repeat-group`?** O TinyMCE 8.5 deste projeto preserva `data-*` attributes por padrão. O wrapper `<div>` com `data-repeat-group` permite colapsagem via `querySelector` em vez de regex, tornando a operação mais robusta e imune a HTML mal formatado ou edições manuais do usuário.

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

### 1. Database — Migration v26

**Arquivo:** `src/main/database/index.ts`

- Bump `CURRENT_SCHEMA_VERSION` de 25 para 26
- Adicionar coluna `repetir_para TEXT` à tabela `secoes_template`

```ts
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
  repetir_para?: string | null   // NOVO: 'armas' | null
  created_at: string
  updated_at: string
}
```

---

### 3. Template Service — CRUD completo

**Arquivo:** `src/main/services/template.service.ts`

#### 3a. Corrigir `createSecao()` — adicionar `condicao` (bug fix) + `repetir_para`

O INSERT atual ignora `condicao`. Corrigir incluindo ambos:

```ts
async createSecao(data: Omit<SecaoTemplateRow, 'id' | 'created_at' | 'updated_at'>): Promise<SecaoTemplateRow> {
  const id = randomUUID();
  await executeNonQuery(
    `INSERT INTO secoes_template (id, template_id, nome, ordem, conteudo, condicao, repetir_para, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [id, data.template_id, data.nome, data.ordem, data.conteudo || null, data.condicao || null, data.repetir_para || null]
  );
  // ...
}
```

#### 3b. Corrigir `updateSecao()` — adicionar `condicao` (bug fix) + `repetir_para`

Adicionar após o bloco de `conteudo`:

```ts
if (data.condicao !== undefined) { sets.push('condicao = ?'); params.push(data.condicao); }
if (data.repetir_para !== undefined) { sets.push('repetir_para = ?'); params.push(data.repetir_para); }
```

---

### 4. IPC Handlers — Propagar `repetir_para`

**Arquivo:** `src/main/ipc/handlers/template.handlers.ts`

#### 4a. `template:createSecao`

Adicionar `repetir_para` ao tipo do parâmetro `data` e propagar para o service:

```ts
ipcMain.handle('template:createSecao', async (_event, data: {
  template_id: string;
  nome: string;
  ordem: number;
  conteudo?: string;
  condicao?: string | null;
  repetir_para?: string | null;  // NOVO
}) => {
  const secao = await templateService.createSecao({
    template_id: data.template_id,
    nome: sanitizeInput(data.nome.trim()),
    ordem: data.ordem ?? 0,
    conteudo: data.conteudo || undefined,
    condicao: data.condicao || undefined,
    repetir_para: data.repetir_para || undefined,  // NOVO
  });
  return { success: true, data: secao, message: 'Seção criada com sucesso' };
});
```

#### 4b. `template:updateSecao`

Adicionar `repetir_para` ao tipo do parâmetro `data` e propagar:

```ts
ipcMain.handle('template:updateSecao', async (_event, id: string, data: {
  nome?: string;
  ordem?: number;
  conteudo?: string;
  condicao?: string | null;
  repetir_para?: string | null;  // NOVO
}) => {
  const updateData: Record<string, unknown> = {};
  if (data.nome !== undefined) updateData.nome = sanitizeInput(data.nome);
  if (data.ordem !== undefined) updateData.ordem = data.ordem;
  if (data.conteudo !== undefined) updateData.conteudo = data.conteudo;
  if (data.condicao !== undefined) updateData.condicao = data.condicao;
  if (data.repetir_para !== undefined) updateData.repetir_para = data.repetir_para;  // NOVO
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
      const nome = substituirIndicePlaceholders(secao.nome, idx);
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

**Nota:** Se toggle desligado ou 0 armas, o grupo é registrado como string vazia. Na reconciliação, o builder remove qualquer `div[data-repeat-group="armas"]` existente e não reinsere nada — o H2 pai permanece mas sem o wrapper.

#### 5c. ~~`parseHtmlEmSecoes()`~~ — **Removida**

Não é mais necessária. A colapsagem usa `querySelectorAll('div[data-repeat-group]')` no HTML bruto, sem parsear headings. A reconciliação substitui o wrapper inteiro por string, sem precisar de estrutura de árvore intermediária. Isso elimina a fragilidade do regex em H2/H3.

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
- O conteúdo removido é todo o H3 gerado — nada de formatação original do laudo se perde

#### 5e. `reconciliarSecoes()`

Recebe o HTML já colapsado (sem `div[data-repeat-group]`) e o `Map<repeatGroup, html>` da expansão. Reinsere cada grupo após o `<h2 data-repeat-section="...">` correspondente:

```ts
export function reconciliarSecoes(
  htmlColapsado: string,
  expansoes: Map<string, string>
): string {
  let html = htmlColapsado;

  for (const [repeatGroup, htmlGrupo] of expansoes) {
    // Encontra o H2 marcado com data-repeat-section
    const regexH2 = new RegExp(
      `<h2[^>]*data-repeat-section="${repeatGroup}"[^>]*>[\\s\\S]*?<\\/h2>`, 'i'
    );
    const match = regexH2.exec(html);
    if (!match) continue; // H2 não encontrado → preserva HTML como está

    const h2Completo = match[0];
    const posFimH2 = match.index + h2Completo.length;

    if (htmlGrupo) {
      // Insere o div após o H2 da seção
      html = html.slice(0, posFimH2) + '\n' + htmlGrupo + html.slice(posFimH2);
    }
    // Se htmlGrupo for vazio (toggle off ou 0 armas), não insere nada
    // O H2 permanece no HTML mas sem conteúdo de arma
  }

  return html;
}
```

**Marcação do H2 no `buildHtml`:** O H2 das seções repetíveis recebe `data-repeat-section` para que `reconciliarSecoes` encontre o ponto de inserção exato:

```ts
// Em buildHtml:
partes.push(`<h2 data-repeat-section="armas">${contador}. ${secao.nome}</h2>`);
```

**Opção A — Destrutiva:** O conteúdo de `htmlGrupo` sempre vem do template (fonte da verdade). Edições manuais do perito dentro do `div[data-repeat-group]` são perdidas na reconciliação — o wrapper antigo foi removido no colapsar, e o novo é inserido limpo.

#### 5f. `buildHtml()`

Monta o HTML final do laudo: seções normais (sem `repetir_para`) viram `<h2>` numerados. Seções com `repetir_para` usam o HTML do `expandirSecoesRepetiveis` (wrapper `<div data-repeat-group>` inserido após o H2):

```ts
export function buildHtml(
  secoes: SecaoTemplateRow[],
  expansoes: Map<string, string>
): string {
  let contador = 1;
  const partes: string[] = [];

  for (const secao of secoes) {
    if (secao.repetir_para === 'armas') {
      const grupoHtml = expansoes.get('armas');
      partes.push(`<h2 data-repeat-section="armas">${contador}. ${secao.nome}</h2>`);
      contador++;
      if (grupoHtml) {
        partes.push(grupoHtml);
      }
      // se grupoHtml vazio, H2 aparece sem conteúdo (seção vazia)
    } else {
      partes.push(`<h2>${contador}. ${secao.nome}</h2>\n${secao.conteudo || ''}`);
      contador++;
    }
  }

  return partes.join('\n');
}
```

**A numeração é sequencial (`1.`, `2.`, `3.`), sem subnumeração de H3.** Os H3s ficam dentro do `div[data-repeat-group]` e não recebem número próprio — sua hierarquia é visual (recuo no editor) e estrutural (DOM aninhado).

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

  // 1. Expandir seções repetíveis → Map<repeatGroup, html>
  const expansoes = expandirSecoesRepetiveis(secoes, especificos);

  // 2. Montar HTML: seções normais viram H2, repetíveis usam o wrapper
  const conteudo = buildHtml(secoes, expansoes);

  // Inserir laudo (código existente)
  // ...
}
```

**Nota:** No momento da criação da REP, `armas` está vazio → `expandirSecoesRepetiveis` retorna `Map` com `'armas' → ''` → `buildHtml` gera o H2 "Das Armas" sem conteúdo. Quando a REP é atualizada com armas, `sincronizarSecoesCondicionais` colapsa e re-expande.

#### 6b. `sincronizarSecoesCondicionais()`

Substituir o loop atual de montagem (linhas 406-466) pela integração com o builder:

```ts
async sincronizarSecoesCondicionais(laudo_id: string): Promise<void> {
  // ... fetch existente de laudo, secoes, rep, especificos ...

  // 1. Expandir seções do template com dados atuais da REP → Map<repeatGroup, html>
  const expansoes = expandirSecoesRepetiveis(secoes, especificos);

  // 2. Colapsar HTML atual: remove div[data-repeat-group] antigos
  const htmlColapsado = colapsarSecoesExpandidas(laudo.conteudo);

  // 3. Reconciliar: reinserir novos wrappers após os H2 correspondentes
  const novoConteudo = reconciliarSecoes(htmlColapsado, expansoes);

  // 4. Atualizar se houve mudança (código existente)
  if (novoConteudo !== laudo.conteudo) {
    await executeNonQuery('UPDATE laudos SET conteudo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [novoConteudo, laudo_id]);
  }
}
```

**O que muda em relação ao spec anterior:**
- Removeu `parseHtmlEmSecoes` (não mais necessária)
- `colapsarSecoesExpandidas` agora recebe `string` e retorna `string` (regex em vez de struct)
- `reconciliarSecoes` recebe HTML colapsado + Map de expansões e retorna HTML final diretamente
- `buildHtml` só é usado na criação inicial, não na sincronização

#### 6c. `_reaplicarBlocosPeca()` — **Incluso (verificação obrigatória)**

Precisa ignorar o conteúdo de `div[data-repeat-group]` ao reaplicar blocos de peças processuais — os blocos (cabeçalho, rodapé, assinatura) devem ser inseridos **fora** do wrapper. Adaptar a lógica atual para pular seções aninhadas dentro de `div[data-repeat-group]`.

**Verificação:** Após a implementação do secao-builder, testar se `_reaplicarBlocosPeca` ainda funciona corretamente com laudos contendo armas.

`gerarLaudoWizard()` está **fora do escopo** desta implementação. Foco exclusivo no modo template.

---

### 7. Schema Zod — Adicionar `condicao` (bug fix) + `repetir_para`

**Arquivo:** `src/renderer/lib/validators/template.schema.ts`

```ts
export const secaoTemplateSchema = z.object({
  id: z.string().uuid(),
  template_id: z.string().uuid(),
  nome: z.string().min(1).max(200),
  ordem: z.number().int().min(0),
  conteudo: z.string().nullable().optional(),
  condicao: z.string().nullable().optional(),       // bug fix: estava ausente
  repetir_para: z.enum(['armas']).nullable().optional(),  // NOVO
  created_at: z.string(),
  updated_at: z.string(),
});
```

---

### 8. TemplatesPage — Estado local resiliente

**Arquivo:** `src/renderer/pages/TemplatesPage.tsx`

#### 8a. Interface `SecaoForm` — adicionar `repetir_para`

```ts
interface SecaoForm {
  id?: string;
  nome: string;
  conteudo: string;
  condicao?: string;
  repetir_para?: string;  // NOVO
}
```

#### 8b. Interface `SecaoItem` — adicionar `condicao` (bug fix) + `repetir_para`

```ts
interface SecaoItem {
  id: string;
  template_id: string;
  nome: string;
  ordem: number;
  conteudo?: string;
  condicao?: string | null;       // bug fix: estava ausente
  repetir_para?: string | null;   // NOVO
}
```

#### 8c. `emptySecaoForm()` — inicializar `repetir_para`

```ts
const emptySecaoForm = (): SecaoForm => ({
  nome: '', conteudo: '', repetir_para: '',
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

#### 8f. `handleSalvar` — propagar `repetir_para`

Adicionar `repetir_para` aos objetos passados para `updateSecao` e `createSecao`:

```ts
await window.ipcAPI.template.updateSecao(sec.id, {
  nome: sec.nome.trim(),
  conteudo: sec.conteudo,
  ordem: i,
  condicao: sec.condicao || null,
  repetir_para: sec.repetir_para || null,  // NOVO
});
```

#### 8g. `handleClonar` — propagar `condicao` (bug fix) + `repetir_para`

```ts
await window.ipcAPI.template.createSecao({
  template_id: novoId,
  nome: sec.nome,
  ordem: i,
  conteudo: sec.conteudo,
  condicao: sec.condicao || null,          // bug fix
  repetir_para: sec.repetir_para || null,  // NOVO
});
```

#### 8h. UI — Select "Repetir para cada"

No painel de cada seção, ao lado do `<Select>` de condição (~linha 1201), adicionar:

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

**Hint** exibido quando `repetir_para = 'armas'`:

> Use placeholders com `_1_` como padrão. Ex: `{{b602_arma_1_tipo}}`, `{{b602_arma_1_letra}}`. O nome da seção será usado como título de cada subseção. **Atenção:** Edições manuais no conteúdo das subseções de arma serão perdidas ao atualizar a REP — os dados sempre refletem a REP atual.

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
|---|---|---|---|
| 1 | `src/main/database/index.ts` | Migration v26: coluna `repetir_para` | Migration |
| 2 | `src/main/types/database.ts` | Campo `repetir_para` em `SecaoTemplateRow` | Tipo |
| 3 | `src/main/services/template.service.ts` | **Bug fix:** `condicao` no INSERT/UPDATE + `repetir_para` | Correção |
| 4 | `src/main/services/secao-builder.service.ts` | **NOVO:** `expandirSecoesRepetiveis` (retorna Map c/ HTML de `div[data-repeat-group]`), `colapsarSecoesExpandidas` (regex DOM), `reconciliarSecoes` (substitui wrappers), `buildHtml` (H2 + expansões), `substituirIndicePlaceholders` | Novo módulo |
| 5 | `src/main/services/laudo.service.ts` | Integrar com `secao-builder` em `criarLaudoInicial` e `sincronizarSecoesCondicionais` | Refactor |
| 6 | `src/main/services/placeholder.service.ts` | Placeholders `b602_arma_N_letra`, `b602_arma_N_modelo` (categoria B-602) — genéricos, sem índice fixo | Seed |
| 7 | `src/main/ipc/handlers/template.handlers.ts` | Propagar `repetir_para` nos handlers de seção | IPC |
| 8 | `src/renderer/pages/TemplatesPage.tsx` | **Bug fix:** `SecaoItem`, `handleEditar`, `handleClonar`, `handleSalvar` + `hydrateSecaoForm` + Select "Repetir para cada" + hints | UI + Correção |
| 9 | `src/renderer/components/rep/exam-fields/b602.tsx` | Campo "modelo" no `ArmasFields` + placeholders `letra`/`modelo` no `B602_MENU_STRUCTURE` | UI |
| 10 | `src/renderer/components/rep/exam-fields/placeholders.ts` | Interface `CampoEspecificoPlaceholder` com `computed` + placeholders genéricos `b602_arma_N_letra`, `b602_arma_N_modelo` | Tipo + Dados |
| 11 | `src/renderer/components/rep/exam-fields/services/b602.service.ts` | Adicionar `'modelo'` ao `ARMA_CAMPOS` | Dados |
| 12 | `src/renderer/lib/exportacao-placeholders.ts` | Resolver `b602_arma_N_letra` + `b602_arma_N_modelo` + função `numToLetra()` | Export |
| 13 | `src/renderer/lib/validators/template.schema.ts` | **Bug fix:** `condicao` no schema + `repetir_para` | Validação |
| 14 | `src/renderer/pages/REPsPage.tsx` | Snapshot de armas + diálogo modal ao alterar dados + trigger sync no laudo | UI + Integração |

---

## Verificação

1. **Criar template B-602** → adicionar seção com nome `ARMA {{b602_arma_1_letra}} - {{b602_arma_1_tipo}} {{b602_arma_1_marca}} {{b602_arma_1_modelo}}` e `repetir_para = 'armas'`
2. **Salvar e reabrir o template** → verificar que `repetir_para = 'armas'` foi preservado (valida correção do `SecaoItem`/`handleEditar`)
3. **Clonar o template** → verificar que `repetir_para` e `condicao` foram preservados no clone
4. **Criar REP B-602** com 3 armas, preenchendo tipo, marca, modelo e demais campos
5. **Criar laudo** → verificar HTML:
   - `<h2>X. DAS ARMAS</h2>` seguido de `<div data-repeat-group="armas">`
   - Dentro do div, 3 `<h3>` com títulos resolvidos
   - Título da 1ª arma: "ARMA A - Pistola Taurus PT 100"
   - Título da 2ª arma: "ARMA B - Revólver S&W Model 686"
   - Placeholders de conteúdo com índices corretos (`_1_`, `_2_`, `_3_`)
6. **Toggle "Possui Arma(s)?" desligado** → seção de armas some do laudo (após sincronizar)
7. **Toggle ligado, 0 armas cadastradas** → seção omitida (sem H2)
8. **Alterar dados de uma arma na REP** → sincronizar laudo → conteúdo do H3 correspondente é atualizado
9. **Adicionar texto manual num H3** → sincronizar laudo → texto manual é perdido (Opção A destrutiva)
9a. **Wrapper preservado no editor** → criar laudo, abrir no TinyMCE, salvar sem alterações, reabrir → `div[data-repeat-group="armas"]` ainda está presente (valida que TinyMCE não strip o atributo)
10. **Exportar PDF/DOCX** → subseções H3 formatadas corretamente, placeholders resolvidos
11. **Regressão** → templates sem `repetir_para` funcionam como antes
12. **Regressão** → `{{b602_tabela_armas}}` continua funcionando (tabela única)
13. **Regressão** → `condicao` que já existia no banco (se houver) continua funcionando após a correção do service
14. **Aviso REP → Laudo** → editar REP com armas, alterar dados de uma arma, salvar → diálogo modal "Os dados de arma foram alterados" aparece → confirmar → laudo sincronizado com novos dados
15. **Sem alteração de armas** → editar REP, alterar apenas outro campo (ex: local do fato), salvar → **sem** diálogo modal (snapshot não detectou mudança)
16. **REP sem laudo vinculado** → alterar armas → salvar → **sem** diálogo modal (não há laudo para sincronizar)

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

1. Migration v26 + tipo `SecaoTemplateRow` (arquivos 1-2)
2. Template service — corrigir `condicao` + adicionar `repetir_para` (arquivo 3)
3. IPC handlers — propagar `repetir_para` (arquivo 7)
4. Zod schema — adicionar `condicao` + `repetir_para` (arquivo 13)
5. Campo `modelo` nas armas (arquivos 9, 11)
6. Placeholders `letra` e `modelo` (arquivos 6, 10, 11 — exportação)
7. **NOVO módulo** `secao-builder.service.ts` (arquivo 4)
8. Integração no `laudo.service.ts` (arquivo 5)
9. TemplatesPage — UI + correções de hidratação (arquivo 8)
10. REPsPage — snapshot + diálogo + trigger sync (arquivo 14)
11. Testes manuais de verificação (todos os 16 itens acima)
