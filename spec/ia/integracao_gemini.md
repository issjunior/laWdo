# Plano: Integração com Google Gemini como Provedor de IA Alternativo

## Contexto

O projeto já possui integração com IA via Groq (implementada conforme `migracao/ia/integracao_groq.md`). O PRD prevê FR7: Assistente IA com revisão gramatical, adequação de tom formal técnico e descrição de imagens.

Agora será adicionado o **Google Gemini** como provedor alternativo, permitindo que o usuário escolha entre Groq e Gemini na página de configuração.

O Gemini expõe um endpoint OpenAI-compatível (`/v1beta/openai/chat/completions`), o que permite reutilizar praticamente todo o código existente — apenas o endpoint, a chave e os modelos mudam.

## Problema

Atualmente o perito só pode usar Groq. Adicionar Gemini:
- Oferece alternativa caso a Groq esteja indisponível ou com latência alta
- O Google oferece cotas gratuitas generosas para uso institucional
- Modelos Gemini têm bom desempenho em português jurídico/técnico
- Uso com email institucional `@policiacientifica.pr.gov.br` garante que dados não sejam usados para treinamento

## Abordagem

### Ponto único de escolha: `ModelosIAPage.tsx`

**Toda a decisão de qual modelo de IA será usado acontece exclusivamente na página `ModelosIAPage.tsx`.** O perito escolhe o provedor (Groq ou Gemini) e o modelo dentro daquele provedor. Essa escolha é persistida em `configuracoes` e lida pelo backend a cada chamada. Nenhum outro ponto do sistema expõe essa decisão — os componentes de toolbar, sheet e editor apenas disparam as ações de IA sem saber qual provedor está por trás.

### UI: Select de provedor no topo do Card de configuração

Na página `ModelosIAPage.tsx`, um **Select** no topo do Card permite escolher entre **Groq** e **Gemini**. Os campos de API Key e modelo são renderizados condicionalmente conforme o provedor selecionado. O formulário usa `react-hook-form` + `zod` (padrão já existente) com schema estendido para ambos provedores.

### Backend: Roteamento transparente por provedor

O handler `ia.handlers.ts` ganha uma função `chamarIA()` que lê a config `provedor_ia` e roteia para `chamarGroq()` (existente) ou `chamarGemini()` (nova). Ambos usam o mesmo formato de request OpenAI-compatível. Os 4 handlers IPC (`revisarOrtografia`, `adequarEscrita`, `descreverImagem`, `perguntar`) passam a chamar `chamarIA()` em vez de `chamarGroq()` diretamente.

### Segurança

As chaves de API (`api_key_groq`, `api_key_gemini`) são armazenadas na tabela `configuracoes` do SQLite local e nunca expostas ao renderer. As chamadas HTTP são feitas exclusivamente pelo processo main do Electron. As chaves e modelos são excluídos dos backups de configuração.

## Arquivos a Modificar

### 1. `src/renderer/pages/ModelosIAPage.tsx` — Página de configuração

**Schema zod estendido:**
```ts
provedor: 'groq' | 'gemini'
apiKeyGroq: string (opcional)
apiKeyGemini: string (opcional)
modeloGroq: string
modeloGemini: string
```

**Layout do Card de Configuração:**
- Select "Provedor de IA" (Groq / Gemini) no topo
- Abaixo, campos condicionais:
  - **Groq**: Input chave `gsk_...` + Select modelos (Llama 3.3 70B, Llama 4 Scout, Gemma 2 9B, Mixtral 8x7B) + link `console.groq.com/keys`
  - **Gemini**: Input chave + Select modelos (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`) + link `aistudio.google.com/apikey`
- Botões "Testar Conexão" e "Salvar Configurações"
- Testar conexão testa o provedor **selecionado no momento**

**Card de Instruções Gemini (condicional):**
- Exibido apenas quando provedor = Gemini
- Orienta criar conta no Google AI Studio com email `@policiacientifica.pr.gov.br`
- Explica que o uso com email institucional impede uso dos dados para treinamento
- Link para `https://aistudio.google.com/apikey`

**Persistência (via `configuracao.salvar`):**
| Chave | Valor |
|-------|-------|
| `provedor_ia` | `'groq'` ou `'gemini'` |
| `api_key_groq` | chave Groq |
| `api_key_gemini` | chave Gemini |
| `modelo_ia_padrao` | modelo Groq selecionado |
| `modelo_gemini_padrao` | modelo Gemini selecionado |

### 2. `src/main/ipc/handlers/ia.handlers.ts` — Handlers IPC

**Novas constantes:**
```ts
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MODELO_PADRAO_GEMINI = 'gemini-2.5-flash';
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];
```

**Nova função `chamarGemini()`:**
- Lê `api_key_gemini` da config
- Lê `modelo_gemini_padrao` como fallback
- POST para `GEMINI_API_URL` com mesmo formato OpenAI (messages, temperature, max_tokens)
- Autenticação: `Authorization: Bearer {apiKey}`
- Retorna `choices[0].message.content`

**Nova função `chamarIA()` — roteadora:**
```ts
async function chamarIA(texto, systemPrompt, modelo?) {
  const provedor = await configuracaoService.obter('provedor_ia') || 'groq';
  if (provedor === 'gemini') return chamarGemini(texto, systemPrompt, modelo);
  return chamarGroq(texto, systemPrompt, modelo);
}
```

**Handlers atualizados:**
- Todos os 4 handlers (`ia:revisarOrtografia`, `ia:adequarEscrita`, `ia:descreverImagem`, `ia:perguntar`) passam a chamar `chamarIA()` em vez de `chamarGroq()`
- `ia:descreverImagem`: Gemini suporta `image_url` no mesmo formato OpenAI — reutiliza o mesmo código, apenas troca o endpoint
- Fallback: se `provedor_ia` não estiver definido, usa Groq (retrocompatível)

### 3. `src/main/services/config-backup.service.ts` — Exclusão de backup

**Antes:**
```ts
const CHAVES_IA_EXCLUIDAS = ['api_key_groq', 'modelo_ia_padrao'];
```

**Depois:**
```ts
const CHAVES_IA_EXCLUIDAS = ['api_key_groq', 'api_key_gemini', 'modelo_ia_padrao', 'modelo_gemini_padrao', 'provedor_ia'];
```

## O que NÃO muda

- **Preload** (`src/preload/index.ts`): mesma interface `window.ipcAPI.ia.*`, mesmos canais `ia:revisarOrtografia` etc.
- **AISheet.tsx** e **AISectionToolbar.tsx**: não referenciam provedor diretamente, apenas chamam a API
- **Menu lateral** (`AppSidebar.tsx`) e **rotas** (`App.tsx`): já apontam para `/modelos-ia`
- **LaudosPage.tsx**: integração com toolbar e sheet permanece idêntica

## Modelos Gemini Disponíveis

| Modelo | Descrição | Visão |
|--------|-----------|-------|
| `gemini-2.5-flash` | Rápido, eficiente (padrão) | Sim |
| `gemini-2.5-pro` | Mais capaz, raciocínio avançado | Sim |
| `gemini-2.0-flash` | Geração anterior, leve | Sim |

Todos os modelos listados suportam entrada multimodal (texto + imagem), portanto a funcionalidade "Descrever Imagem" funciona com qualquer um deles — não é necessário um modelo de visão separado como no Groq.

## Comportamento

- Se `provedor_ia` não estiver configurado → fallback para `groq` (retrocompatível)
- Se chave do provedor selecionado não existir → erro amigável no handler
- Ambos provedores usam o mesmo formato de request (OpenAI-compatível) → reuso máximo do código existente

## Verificação

### Build e Lint
```bash
npm run build       # compilação completa sem erros
npm run lint        # sem novos warnings
```

### Testes Manuais
1. Abrir Configurações → Modelos IA
2. Selecionar "Gemini" no Select de provedor
3. Campos de chave e modelo do Gemini devem aparecer
4. Card de instruções do Gemini deve aparecer com orientação sobre email institucional
5. Inserir chave de API Gemini válida
6. Selecionar modelo `gemini-2.5-flash`
7. Clicar "Testar Conexão" → deve retornar sucesso
8. Salvar configuração → recarregar página → configuração persiste
9. Selecionar "Groq" → campos do Groq devem aparecer (chave e modelo salvos anteriormente)
10. Ir para Laudos → usar botões de IA → deve funcionar com o provedor configurado
11. Alterar provedor para Gemini → botões de IA devem usar Gemini
12. Testar com chave inválida → mensagem de erro amigável
13. Verificar tema dark — todos os componentes shadcn devem adaptar

### Cenários de Erro
- Sem chave API do provedor selecionado → erro "Chave de API do Gemini/Groq não configurada"
- API retorna erro (rate limit, chave inválida) → Alert inline com detalhes
- Provedor não configurado → fallback para Groq (não quebra existente)
- Timeout na chamada → mensagem "Serviço indisponível, tente novamente"
