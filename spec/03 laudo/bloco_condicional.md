# Blocos Condicionais no Editor de Laudo

> **Status:** Implementado
> **Última revisão:** 2026-06-29
> **Esquema:** Migration v25 — coluna `condicao TEXT` em `secoes_template`

---

## 1. Visão Geral

Blocos condicionais são trechos opcionais do laudo que só permanecem quando o toggle correspondente está ativo na REP ou no contexto expandido por arma do B-602.

Exemplos:

- `b602_cartuchos_toggle` → bloco `DOS CARTUCHOS`
- `b602_estojos_toggle` → bloco `DOS ESTOJOS`
- `b602_armas_toggle` → bloco `DA ARMA`
- `b602_arma_N_func_toggle` → bloco por arma de funcionamento e eficiência
- `b602_arma_N_coleta_toggle` → bloco por arma de coleta de padrões balísticos

O editor do template pode inserir todos os toggles cadastrados para o tipo de exame. O editor do laudo filtra os toggles com base nos dados reais da REP carregada.

---

## 2. Estruturas Envolvidas

### 2.1 Registro base

`EXAM_TOGGLES` continua sendo a fonte principal dos toggles estáticos por tipo de exame.

```ts
export const EXAM_TOGGLES: Record<string, ExamToggle[]> = {
  'B-602': [
    { id: 'b602_cartuchos_toggle', label: 'Cartuchos', subtitulo: 'DOS CARTUCHOS', sectionId: 'cartuchos' },
    { id: 'b602_estojos_toggle', label: 'Estojos', subtitulo: 'DOS ESTOJOS', sectionId: 'estojos' },
    { id: 'b602_armas_toggle', label: 'Arma', subtitulo: 'DA ARMA', sectionId: 'armas' },
  ],
};
```

### 2.2 Toggles extras do B-602

Quando `b602_armas_toggle` está presente, o `TinyMceEditor` injeta ações adicionais em tempo de execução:

- `b602_arma_N_func_toggle`
- `b602_arma_N_coleta_toggle`

Esses toggles não precisam aparecer como `subToggles` fixos no registro estático.

---

## 3. Pipeline no Editor

### 3.1 Filtragem em `LaudosPage`

Ao editar um laudo vinculado a uma REP, `LaudosPage.tsx`:

1. lê `campos_especificos`;
2. identifica quais toggles estão ativos;
3. passa ao `TinyMceEditor` apenas os toggles habilitados naquele contexto.

Regras atuais:

- toggle explícito com valor `'on'` conta como ativo;
- presença de arrays como `cartuchos[]` e `estojos[]` também ativa os blocos correspondentes;
- para armas, os blocos por item dependem dos toggles individuais em `b602.armas[]`.

No `TemplatesPage.tsx`, o editor recebe os toggles do tipo de exame sem filtro por REP, porque o template ainda não está vinculado a dados concretos.

### 3.2 Botão `condbloco`

Se `condToggles` tiver itens, o editor registra o botão `condbloco`.

Comportamento:

- lista toggles estáticos;
- expande os toggles extras do B-602 quando houver armas;
- insere um wrapper `div.cond-bloco` com metadados de condição.

### 3.3 HTML gerado

O formato atual inclui metadados visuais no próprio bloco:

```html
<div
  class="cond-bloco"
  data-cond-bloco="b602_armas_toggle"
  data-cond-badge="Bloco condicional"
  data-cond-resumo="Mostra quando: houver armas na REP"
  title="Mostra quando: houver armas na REP"
>
  <h3>DA ARMA</h3>
  <p>&nbsp;</p>
</div>
```

Campos relevantes:

- `data-cond-bloco`: identifica o toggle;
- `data-cond-badge`: rótulo visual padronizado;
- `data-cond-resumo`: resumo legível da condição;
- `title`: repete o resumo para hover;
- `<h3>`: subtítulo visível sem numeração automática.

### 3.4 Normalização de blocos existentes

Na inicialização, o `TinyMceEditor` revisita blocos condicionais já presentes no HTML e sincroniza:

- `data-cond-badge`
- `data-cond-resumo`
- `title`

Isso atualiza templates antigos para o padrão visual novo sem exigir recriação manual do bloco.

---

## 4. Resumos de Condição

O editor mantém resumos fixos para os toggles principais do B-602:

| Toggle | Resumo |
|---|---|
| `b602_armas_toggle` | `Mostra quando: houver armas na REP` |
| `b602_cartuchos_toggle` | `Mostra quando: houver cartuchos na REP` |
| `b602_estojos_toggle` | `Mostra quando: houver estojos na REP` |
| `b602_arma_N_func_toggle` | `Mostra quando: Funcionamento e eficiência da arma atual` |
| `b602_arma_N_coleta_toggle` | `Mostra quando: Coleta de padrões balísticos da arma atual` |

Para outros toggles, o resumo usa o label disponível como fallback.

---

## 5. Persistência e Backend

### 5.1 Coluna `condicao`

A tabela `secoes_template` armazena a condição em `condicao TEXT`, normalmente como JSON com o campo do toggle:

```json
{"campo":"b602_cartuchos_toggle","valor":"on"}
```

### 5.2 Sincronização do laudo

Ao salvar ou atualizar a REP, `laudo.service.ts`:

1. busca o laudo e o template;
2. lê `condicao`, `repetir_para`, `repetir_titulo` e hierarquia das seções;
3. expande seções repetíveis por arma;
4. processa blocos condicionais no HTML base;
5. reconcilia o resultado com o HTML editado do laudo;
6. preserva conteúdo do usuário fora das áreas derivadas automaticamente.

### 5.3 Processamento em `secao-builder.service`

O backend remove blocos cujo toggle não está ativo e normaliza placeholders indexados por arma para o índice correto da instância expandida.

O processamento atual:

- não depende mais de numeração automática;
- trata blocos internos primeiro;
- respeita o contexto por arma do B-602.

---

## 6. Exportação e Preview

`resolverPlaceholdersExportacao()` continua chamando `limparIndicadoresCondicionais()` antes do preview/PDF final.

Responsabilidades atuais:

- manter compatibilidade com marcadores antigos `data-cond-label`;
- remover estilos inline do wrapper condicional;
- preservar o conteúdo útil do bloco no HTML final.

Não há mais etapa de renumeração de blocos condicionais na exportação.

---

## 7. Arquivos Principais

| Arquivo | Papel atual |
|---|---|
| `src/renderer/components/editor/TinyMceEditor.tsx` | registra o botão `condbloco`, gera o HTML do bloco e normaliza os metadados visuais |
| `src/renderer/pages/LaudosPage.tsx` | filtra toggles com base na REP atual e injeta `condToggles` no editor |
| `src/renderer/pages/TemplatesPage.tsx` | injeta toggles do tipo de exame no editor de template |
| `src/renderer/lib/exportacao-placeholders.ts` | limpa indicadores condicionais na exportação |
| `src/main/services/laudo.service.ts` | sincroniza seções condicionais com o laudo salvo |
| `src/main/services/secao-builder.service.ts` | processa blocos condicionais e contexto repetível por arma |
| `src/main/database/index.ts` | migration da coluna `condicao` |

---

## 8. Fluxo Resumido

```text
REP salva com toggles e campos_especificos
  → LaudosPage lê os dados da REP
  → filtra os condToggles ativos
  → TinyMceEditor insere <div class="cond-bloco" ...>
  → usuário edita o conteúdo interno
  → rep:update dispara sincronização do laudo
  → backend remove blocos inativos e expande contexto por arma
  → exportação limpa metadados visuais desnecessários para o HTML final
```
