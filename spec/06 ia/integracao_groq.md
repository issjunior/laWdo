# Groq como provedor de IA

## Papel atual

Groq continua sendo o fallback padrao do sistema quando `provedor_ia` nao estiver definido.
O roteamento real fica em `src/main/ipc/handlers/ia.handlers.ts`.

## Configuracao persistida

Chaves usadas no estado atual:

- `provedor_ia`
- `api_key_groq`
- `modelo_ia_padrao`

`ModelosIAPage.tsx` edita essas configuracoes pela UI.

## Endpoint e modelos aceitos

Endpoint:

```txt
https://api.groq.com/openai/v1/chat/completions
```

Modelos registrados em `ia.handlers.ts`:

- `llama-3.3-70b-versatile`
- `meta-llama/llama-4-scout-17b-16e-instruct`
- `gemma2-9b-it`
- `mixtral-8x7b-32768`

Defaults atuais:

- modelo textual padrao: `llama-3.3-70b-versatile`
- modelo de visao para Groq: `meta-llama/llama-4-scout-17b-16e-instruct`

## Onde o provider e escolhido

A escolha do provedor acontece em um lugar so:

- `src/renderer/pages/ModelosIAPage.tsx`

O restante da UI apenas chama `window.ipcAPI.ia.*`.

## Roteamento no backend

`chamarIA(messages, modelo?)` le `provedor_ia`.
Se o valor nao for `gemini`, o fluxo cai em `chamarGroq()`.

`chamarGroq()`:

1. le `api_key_groq`
2. le `modelo_ia_padrao`
3. valida o modelo contra a lista permitida
4. envia `messages`, `temperature` e `max_tokens`
5. retorna `choices[0].message.content`

## Recursos hoje expostos via Groq

Os handlers registrados sao:

- `ia:revisarOrtografia`
- `ia:adequarEscrita`
- `ia:descreverImagem`
- `ia:perguntar`

Para Groq:

- texto usa o modelo salvo ou o padrao
- descricao de imagem força o modelo de visao Groq quando o provider selecionado continua sendo Groq

## Observacao importante

`extrairTextoDoHtml()` roda no processo main e usa regex simples:

1. remove spans com `data-placeholder`
2. remove tags HTML
3. normaliza espacos

Isso garante que as acoes de revisao textual enviem texto limpo, sem a estrutura do editor.
