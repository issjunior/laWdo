# Configuração de Seções do Template B-602

> **Status:** Implementado
> **Última atualização:** 2026-06-28
> **Escopo:** `src/renderer/pages/TemplatesPage.tsx`, `src/renderer/components/template/SecaoConfiguracaoTemplate.tsx`, `src/renderer/components/template/secao-configuracao-template.utils.ts`

Este spec descreve como o editor de templates funciona hoje para qualquer exame, com regras extras para o B-602 quando a seção usa repetição por arma.

---

## 1. Estrutura da UI

Cada seção do template no modo multi-seção é renderizada por `SecaoConfiguracaoTemplate`, enquanto `TemplatesPage.tsx` mantém o estado, ordenação, persistência e preview.

O cabeçalho da seção foi dividido em duas camadas:

1. linha superior com drag handle, badge da posição, nome da seção e ações de mover/remover
2. grade inferior com controles explícitos de `Visibilidade`, `Estrutura` e `Repetição`

O resumo textual da configuração aparece logo abaixo do nome, em tempo real, no formato:

```txt
Sempre mostrar · seção principal · conteúdo único
Mostrar quando Arma · subseção de Histórico · uma seção por arma
```

---

## 2. Terminologia exposta ao usuário

Os rótulos deixaram de usar `H2/H3` como linguagem principal.

| Regra interna | Texto exibido |
|---|---|
| seção sem `parent_id` | `Seção principal` |
| seção com `parent_id` | `Subseção de <seção pai>` |
| seção sem `condicao` | `Sempre mostrar` |
| `repetir_para` vazio | `Conteúdo único` |
| `repetir_para = armas` | `Uma seção por arma` |

Os textos de ajuda ficam visíveis abaixo de cada select:

- `Visibilidade`: a seção pode aparecer sempre ou apenas quando um toggle da REP estiver ativo
- `Estrutura`: a hierarquia atual vai só até subseção
- `Repetição`: só faz sentido quando o exame suporta blocos derivados da REP

---

## 3. Repetição por arma

`repetir_para = armas` é uma capacidade declarativa por exame, não um `if` espalhado no JSX.

Hoje apenas o exame `B-602` registra essa opção em `CONFIGURACOES_POR_EXAME`:

```ts
'B-602': {
  opcoesRepeticao: [{ value: 'armas', label: 'Uma seção por arma' }],
  tituloPadraoArmas: 'ARMA {{b602_arma_1_letra}} - {{b602_arma_1_tipo}} {{b602_arma_1_marca}} {{b602_arma_1_modelo}}',
}
```

Comportamento atual:

- exames sem suporte não exibem a opção `Uma seção por arma`
- ao trocar a repetição para `armas`, o campo `repetir_titulo` recebe o título padrão apenas se ainda estiver vazio
- o campo `Título de cada arma` ganha prévia visual, segmentando placeholders válidos
- a ajuda fixa informa que o bloco repetido sempre reflete a REP atual

---

## 4. Guardrails e validações

As validações ficam centralizadas em `validarConfiguracaoSecaoTemplate()`. O resultado é calculado por seção e usado de duas formas:

- erros e avisos inline no card da seção
- bloqueio de salvamento quando existe pelo menos um diagnóstico do tipo `erro`

Regras atuais para `repetir_para = armas`:

| Tipo | Regra |
|---|---|
| erro | só pode ser usado em templates do exame `B-602` |
| erro | a seção precisa ser subseção de uma seção principal |
| erro | `repetir_titulo` é obrigatório |
| aviso | o título deveria usar placeholders com `_1_` para variar por arma |
| aviso | se o conteúdo repete o mesmo padrão textual do título, a UI avisa possível duplicação no laudo |

Ao tentar salvar um template com erro estrutural, `TemplatesPage.tsx` cancela o envio e mostra `Revise as seções destacadas antes de salvar o template.`

---

## 5. Placeholder e preview no título repetido

O campo `repetir_titulo` usa `segmentarTextoComPlaceholders()` para destacar placeholders válidos sem alterar o texto digitado.

Essa validação aceita placeholders indexados a partir de chaves-base com `_N_`, por exemplo:

- `{{b602_arma_1_letra}}`
- `{{b602_arma_1_tipo}}`
- `{{b602_arma_1_numero_lacre}}`

O reconhecimento usa a mesma regra utilitária aplicada no TinyMCE (`placeholderChaveEhValida`), então a prévia do título e a digitação no editor seguem o mesmo contrato.

---

## 6. Modularização atual

Responsabilidades efetivas:

| Arquivo | Responsabilidade |
|---|---|
| `TemplatesPage.tsx` | carrega dados, calcula `tipoExameCodigo`, ordena seções, salva template e preview |
| `SecaoConfiguracaoTemplate.tsx` | renderiza a configuração visual e mensagens inline de uma seção |
| `secao-configuracao-template.utils.ts` | registry por exame, labels, resumo, ajuda e validações |

A modularização reduziu o acoplamento do builder de template sem mover a lógica de persistência para fora da página.
