# Placeholders não substituídos no PDF — Diagnóstico e Correção

**Data:** 10/05/2026  
**Status:** ✅ RESOLVIDO  
**Última atualização:** 2026-06-08

---

## Nota de Evolução (2026-06-08)

Após a correção documentada abaixo, as 19 chaves com prefixo `rep_` foram posteriormente **renomeadas** para formas mais curtas via migração `RENOMEACOES` em `src/main/services/placeholder.service.ts:19-47`. Exemplos:

| Antiga (documento original) | Nova (pós-migração) |
|---|---|
| `rep_numero` | `numero_rep` |
| `rep_autoridade_solicitante` | `autoridade_solicitante_rep` |
| `rep_nome_envolvido` | `nome_envolvido` |
| `rep_local_fato` | `local_fato` |
| `rep_latitude` | `latitude` |
| `rep_longitude` | `longitude` |

O `aplicarPlaceholders()` em `LaudosPage.tsx:134-180` mantém compatibilidade com ambos os formatos. As 5 chaves `rep_*` que não aparecem no mapping atual (`rep_autoridade_solicitante`, `rep_nome_envolvido`, `rep_local_fato`, `rep_latitude`, `rep_longitude`) foram intencionalmente removidas do fallback — apenas suas formas renomeadas são suportadas.

A solução com **DOMParser** + `querySelectorAll` (seção Solução, item 1) permanece ativa e é o mecanismo principal de substituição de placeholders no preview PDF.

---

## Problema

Ao gerar a pré-visualização (PDF) de um laudo, os placeholders inseridos via menu de contexto no editor TinyMCE não eram substituídos pelos valores reais da REP. O PDF exibia o texto literal `{{rep_numero}}` em vez do número da REP.

---

## Causas (dois bugs independentes)

### Bug 1: Regex frágil para spans de placeholder

A função `aplicarPlaceholders()` em `src/renderer/pages/LaudosPage.tsx` usava regex para encontrar e substituir spans:

```js
const spanRegex = new RegExp(
  `<span[^>]*data-placeholder="\\{\\{${escapedChave}\\}\\}"[^>]*>[\\s\\S]*?<\\/span>`,
  'gi'
);
resultado = resultado.replace(spanRegex, displayValue);
```

O TinyMCE modifica a estrutura HTML de spans com `contenteditable="false"` durante a serialização (`getContent()`):
- Adiciona atributos `data-mce-*` (ex: `data-mce-selected`, `data-mce-contenteditable`)
- Reordena atributos
- Pode alterar a formatação de quotes

O regex, dependente de uma estrutura exata de atributos, falhava ao casar com o HTML real retornado pelo editor.

### Bug 2 (causa principal): Chaves do banco ≠ chaves do mapping

| Local | Notação | Exemplo |
|---|---|---|
| Seed do sistema (`placeholder.service.ts`) | underscore | `rep_numero`, `rep_nome_envolvido` |
| Mapping no `aplicarPlaceholders` | ponto | `rep.numero`, `rep.envolvido` |

O menu de contexto insere o placeholder com a chave do banco:
```html
<span data-placeholder="{{rep_numero}}">{{rep_numero}}</span>
```

O `aplicarPlaceholders` extraía `rep_numero` do atributo `data-placeholder`, mas procurava em `mapping["rep_numero"]` — que era `undefined` porque o mapping só tinha `mapping["rep.numero"]` (com ponto).

As 19 chaves do seed do sistema **nunca casavam** com as 11 chaves do mapping antigo. Nenhum placeholder era substituído.

---

## Solução

### 1. DOMParser no lugar de regex

Substituição da detecção baseada em regex por `DOMParser` + `querySelectorAll`:

```js
const parser = new DOMParser();
const doc = parser.parseFromString(html, 'text/html');

const placeholderSpans = doc.querySelectorAll('span[data-placeholder]');
placeholderSpans.forEach(span => {
  const rawPlaceholder = span.getAttribute('data-placeholder') || '';
  const chaveMatch = rawPlaceholder.match(/^\{\{(.+)\}\}$/);
  if (chaveMatch) {
    const chave = chaveMatch[1];
    const valor = mapping[chave];
    if (valor !== undefined) {
      span.replaceWith(valor);
    }
  }
});

let resultado = doc.body.innerHTML;
```

O `querySelectorAll('span[data-placeholder]')` opera na árvore DOM real, sendo imune a:
- Reordenação de atributos
- Atributos extras (`data-mce-*`)
- Variações de quote (aspas simples/duplas)
- Qualquer outra modificação estrutural do TinyMCE

Com fallback para regex textual caso `DOMParser` falhe.

### 2. Alinhamento das chaves

Adicionadas ao mapping todas as 19 chaves com underscore do seed do sistema:

```
rep_numero, rep_data_requisicao, rep_prazo, rep_tipo_solicitacao,
rep_numero_documento, rep_data_documento, rep_autoridade_solicitante,
rep_nome_envolvido, rep_local_fato, rep_latitude, rep_longitude,
rep_data_acionamento, rep_data_chegada, rep_data_saida,
rep_numero_bo, rep_numero_ip, rep_lacre_entrada, rep_lacre_saida,
rep_observacoes
```

Mantidas também as chaves com ponto (`rep.numero` etc.) para compatibilidade retroativa.

### 3. Placeholders de relacionamento

Adicionados `solicitante_nome`, `tipo_exame_nome`, `tipo_exame_codigo` ao mapping, preenchidos via buscas assíncronas em `handlePreview`:

```js
if (repData.solicitante_id) {
  const rSol = await window.ipcAPI.solicitante.findById(repData.solicitante_id);
  if (rSol.success && rSol.data) solicitanteNome = rSol.data.nome || '';
}
if (repData.tipo_exame_id) {
  const rTipo = await window.ipcAPI.tipoExame.findById(repData.tipo_exame_id);
  if (rTipo.success && rTipo.data) {
    tipoExameNome = rTipo.data.nome || '';
    tipoExameCodigo = rTipo.data.codigo || '';
  }
}
```

---

## Arquivos alterados (na época da correção)

- `src/renderer/pages/LaudosPage.tsx` — funções `aplicarPlaceholders` (reescrita com DOMParser, linha 214-266) e `handlePreview` (adição de lookups)
- `src/main/services/placeholder.service.ts` — migração `RENOMEACOES` (linha 19-47) aplicada posteriormente para renomear chaves `rep_*` → formas curtas

---

## Lição aprendida

1. **Regex não é confiável para parse de HTML gerado por editores WYSIWYG.** O DOM é a abstração correta. Usar `DOMParser` + `querySelector` sempre que precisar manipular HTML serializado por editores ricos.

2. **Alinhar chaves entre banco e código.** O seed do sistema e o mapping de placeholders devem usar a mesma convenção de nomenclatura. Qualquer divergência silenciosa causa falha total na substituição.
