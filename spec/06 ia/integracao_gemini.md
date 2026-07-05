# Gemini como provedor de IA

## Papel atual

Gemini ja esta integrado como alternativa real a Groq.
O fluxo usa o mesmo contrato OpenAI-compativel do restante da feature de IA.

## Configuracao persistida

Chaves usadas:

- `provedor_ia = 'gemini'`
- `api_key_gemini`
- `modelo_gemini_padrao`

A mesma `ModelosIAPage.tsx` salva esses valores.

## Endpoint e modelos aceitos

Endpoint:

```txt
https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
```

Modelos registrados:

- `gemini-2.5-flash`
- `gemini-2.5-pro`
- `gemini-2.0-flash`

Default atual:

- `gemini-2.5-flash`

## Roteamento no backend

`chamarIA()` delega para `chamarGemini()` quando `provedor_ia === 'gemini'`.

`chamarGemini()`:

1. le `api_key_gemini`
2. le `modelo_gemini_padrao`
3. valida o modelo recebido contra `GEMINI_MODELS`
4. envia a request no mesmo formato de `messages`
5. retorna `choices[0].message.content`

## Integracao com as acoes de IA

Os quatro handlers IPC sao os mesmos usados pela Groq:

- revisar ortografia
- adequar escrita
- descrever imagem
- perguntar livremente

O renderer nao muda de assinatura quando o provider vira Gemini.

## Descricao de imagem

`ia:descreverImagem` ainda chama `chamarIA(..., MODELO_VISION_GROQ)`.

No caso do Gemini, esse modelo externo nao passa pela validacao de `GEMINI_MODELS`, entao o backend faz fallback automatico para `modelo_gemini_padrao`.

Na pratica:

- com provider Groq -> usa o modelo de visao Groq
- com provider Gemini -> usa o modelo Gemini salvo na configuracao

## Regra pratica

Qualquer manutencao em IA precisa preservar duas invariantes:

1. o renderer continua falando apenas com `window.ipcAPI.ia.*`
2. a decisao do provider continua centralizada em `ModelosIAPage.tsx` + `chamarIA()`
