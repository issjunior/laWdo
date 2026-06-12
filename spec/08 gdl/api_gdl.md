# API GDL — Especificação do Implementado

> **Princípio fundamental: Somente leitura.**
> Métodos permitidos: `GET`, `HEAD`, `OPTIONS`. Proibidos: `POST`, `PUT`, `PATCH`, `DELETE`.

---

## 1. Visão Geral

Integração com a API REST do GDL (Sistema de Gerenciamento de Laudos da Polícia Científica do Paraná)
para consulta de dados de REPs e preenchimento automático do formulário local.

**Requisito:** VPN da Polícia Científica do Paraná deve estar ativa.
**Fallback:** Preenchimento manual sempre disponível.

---

## 2. Arquivos da Feature

### Criados

| Arquivo | Descrição |
|---|---|
| `src/main/services/safe-storage.service.ts` | Wrapper do `safeStorage` do Electron (`encrypt`/`decrypt`/`isAvailable`) — base64 encode/decode |
| `src/main/services/gdl.service.ts` | Chamadas HTTPS à API GDL: `testarConexao(ambiente)`, `consultarRep(numero, ano)` |
| `src/main/ipc/handlers/gdl.handlers.ts` | IPC handlers `gdl:testar-conexao` e `gdl:consultar-rep` |
| `src/renderer/pages/GdlConfigPage.tsx` | Página de configuração "API GDL" (sidebar Configurações) |
| `src/renderer/components/rep/GdlConsultaModal.tsx` | Modal wizard 2 passos para consulta via GDL dentro da REPsPage |

### Modificados

| Arquivo | Mudança |
|---|---|
| `src/main/utils/logger.ts` | Adicionado `'gdl'` ao tipo `LogModule` |
| `src/main/services/configuracao.service.ts` | `obter()`/`salvar()` com criptografia transparente para `tipo ∈ {senha, api_key}` |
| `src/main/database/index.ts` | `CURRENT_SCHEMA_VERSION` → 24. Migration v24: API keys IA plaintext → safeStorage |
| `src/main/ipc/index.ts` | Registro de `registerGdlHandlers()` |
| `src/preload/index.ts` | Canais `gdl:testar-conexao`, `gdl:consultar-rep` + métodos no `IpcAPI` |
| `src/renderer/App.tsx` | Rota `/gdl-config` lazy-loaded |
| `src/renderer/components/layout/AppSidebar.tsx` | Item "API GDL" (ícone `Database`) no grupo Configurações |
| `src/renderer/pages/REPsPage.tsx` | Botão "GDL" no CardHeader + `camposPreenchidosGdl` + bg verde + integração com modal |
| `src/renderer/pages/LogsPage.tsx` | Módulo `gdl` no array `MODULOS` |
| `src/renderer/pages/ModelosIAPage.tsx` | `tipo: 'api_key'` ao salvar credenciais IA (criptografia via safeStorage) |

---

## 3. Arquitetura

```
Renderer (React)                        Main Process (Electron)
───────────────                         ──────────────────────

GdlConfigPage.tsx                       gdl.handlers.ts
├─ Cards Homologação/Produção           ├─ gdl:testar-conexao(ambiente)
├─ Login, Senha (👁 toggle), CPF       │   └─ gdlService.testarConexao(ambiente)
├─ Botão "Testar Conexão"              │       ├─ carregarCredenciais(ambiente)
│   └─ ipcAPI.gdl.testarConexao(amb)   │       │   ├─ configuracaoService.obter(gdl_login_{amb})
├─ Botão "Salvar Configurações"        │       │   ├─ configuracaoService.obter(gdl_senha_{amb})
│   └─ ipcAPI.configuracao.salvar()    │       │   └─ configuracaoService.obter(gdl_cpf_usuario_{amb})
└─ Banner validação (login/senha)      │       └─ GET {baseUrl}/unidadesMedida + Basic Auth
                                       │
GdlConsultaModal.tsx                    ├─ gdl:consultar-rep(numero, ano)
├─ Passo 1: nº REP + ano              │   └─ gdlService.consultarRep(numero, ano)
│   └─ Pré-teste GET /unidadesMedida  │       ├─ lê gdl_ambiente do banco
├─ Passo 2: revisão dados             │       ├─ carregarCredenciais(ambiente)
│   ├─ Campos preenchidos ✓           │       └─ GET {baseUrl}/rep/obter?numero=&ano=
│   ├─ Campos vazios (badges)         │
│   └─ Substituir/Mesclar              safe-storage.service.ts
│       └─ onAplicar(campos, modo)    ├─ encrypt(p): base64
└──────────────────────────────────    └─ decrypt(b64): string

REPsPage.tsx                            configuracao.service.ts
├─ Estado camposPreenchidosGdl         ├─ obter(): tipo ∈ {senha, api_key} → decrypt
├─ getGdlFieldStyle(name) → bg-green  └─ salvar(): tipo ∈ {senha, api_key} → encrypt
├─ handleAplicarGdl()
└─ Banner "N campos preenchidos"
```

---

## 4. Configurações Armazenadas

| Chave | Tipo | Criptografado | Descrição |
|---|---|---|---|
| `gdl_ambiente` | `texto` | Não | `"homologacao"` ou `"producao"` |
| `gdl_login_homologacao` | `texto` | Não | Login do ambiente de homologação |
| `gdl_senha_homologacao` | `senha` | **Sim** (safeStorage) | Senha do ambiente de homologação |
| `gdl_cpf_usuario_homologacao` | `texto` | Não | CPF para homologação |
| `gdl_login_producao` | `texto` | Não | Login do ambiente de produção |
| `gdl_senha_producao` | `senha` | **Sim** (safeStorage) | Senha do ambiente de produção |
| `gdl_cpf_usuario_producao` | `texto` | Não | CPF para produção |
| `api_key_groq` | `api_key` | **Sim** (safeStorage) | Migrado via migration v24 |
| `api_key_gemini` | `api_key` | **Sim** (safeStorage) | Migrado via migration v24 |

> **Nota:** As chaves `gdl_url_homologacao` e `gdl_url_producao` existem no código (`gdl.service.ts:64-69`) com fallback hardcoded. Não possuem UI — são chaves internas/opcionais para override de endpoint.

> **Credenciais separadas por ambiente.** Cada card (Homologação/Produção) gerencia suas próprias credenciais.
> Trocar de card carrega as credenciais salvas daquele ambiente. Sem auto-save — o usuário deve clicar "Salvar Configurações".
> As chaves antigas sem sufixo (`gdl_login`, `gdl_senha`, `gdl_cpf_usuario`) **não são migradas** — usuário reconfigura.

---

## 5. API GDL — Endpoints Utilizados

### 5.1 Teste de Conexão

```
GET {base_url}/unidadesMedida
Headers: Authorization: Basic <base64(login:senha)>
         Content-Type: application/json
         cpfUsuario: XXXXXXXXXXX (se configurado)
Timeout: 5000ms
```

> O ambiente testado é determinado pelo card selecionado na GdlConfigPage, **não** pelo `gdl_ambiente` salvo no banco.
> O `ambiente` é passado do renderer via parâmetro IPC.

Retorna ao renderer: `{ sucesso, latencia, statusCode, autenticado, ambiente, endpointTestado }`

### 5.2 Consulta de REP

```
GET {base_url}/rep/obter?numero={numero}&ano={ano}
Timeout: 15000ms
```

> O ambiente usado é o `gdl_ambiente` salvo no banco (via "Salvar Configurações").

---

## 6. Mapeamento GDL → Campos do Formulário

| Campo GDL (`obter`) | Campo `REPFormData` | Estilo |
|---|---|---|
| `numero` + `ano` | `numero` (formatado `{numero}-{ano}`) | `bg-green-50` |
| `origens[0].tipo` | `tipo_solicitacao` | `bg-green-50` |
| `origens[0].numero` | `numero_documento` | `bg-green-50` |
| `andamentos[0].dataHora` | `data_requisicao` | `bg-green-50` |
| `pecas[*]` (quantidade, tipoPeca, identificacao, unidadeMedida) | `observacoes` | `bg-green-50` |
| `naturezaExame` (futuro) | `tipo_exame_id` | — |

---

## 7. UX — Comportamentos

### 7.1 Página de Configuração (`GdlConfigPage`)

- **Cards visuais** para seleção de ambiente (Homologação / Produção) com `ring-2 ring-primary` no selecionado e opacidade reduzida no outro
- **Toggle 👁** no campo senha (`Eye`/`EyeOff` do lucide-react) para conferir o que está salvo
- **Banner inline** ao tentar salvar com login ou senha vazios: *"Preencha login e senha de {Ambiente} para consultas."*
- **Diagnóstico** mostra: ambiente testado (badge), latência, status HTTP, autenticação (OK/Falha), endpoint usado (`/api/unidadesMedida`)
- **Salvar** persiste cada ambiente independentemente via chaves com sufixo

### 7.2 Modal de Consulta (`GdlConsultaModal`)

- **Passo 1 — Busca:** pré-teste de conectividade automático + campos nº REP e ano
- **Passo 2 — Revisão:** lista campos que serão preenchidos (✓ verde) + badges dos campos que ficarão vazios
- **Rádio Substituir/Mesclar** se o formulário já tiver dados; default "Mesclar"
- Botão "Aplicar ao Formulário" preenche via `form.setValue()` e marca no `Set<string> camposPreenchidosGdl`

### 7.3 Integração na REPsPage

- Botão **"GDL"** no `CardHeader` (ícone `Database`), ao lado do botão Placeholders
- Helper `getGdlFieldStyle(name)` retorna `bg-green-50 border-green-300` para campos no set
- Banner verde: *"N campo(s) preenchido(s) via GDL. Campos com fundo verde foram preenchidos automaticamente."*
- `handleNovo` e `handleCancelar` limpam `camposPreenchidosGdl`

---

## 8. Logs (Módulo `gdl`)

Registros visíveis na **LogsPage** (aba Sistema), filtráveis pelo módulo "API GDL".

| Nível | Quando | Dados |
|---|---|---|
| `info` | Conexão testada com sucesso | `{ latencia, statusCode, ambiente }` |
| `info` | REP consultada com sucesso | `{ numero, ano, codRep }` |
| `error` | Falha no teste de conexão | `{ erro, latencia }` |
| `error` | Timeout / erro de rede | `{ erro, numero, ano }` |
| `error` | Autenticação rejeitada (401/403) | `{ statusCode }` |
| `warn` | Credenciais não configuradas | `"Teste de conexão GDL: credenciais não configuradas"` |

---

## 9. Criptografia — safeStorage

- `safe-storage.service.ts` encapsula `safeStorage.encryptString()` / `decryptString()` do Electron
- Dados armazenados como base64 na coluna `valor` da tabela `configuracoes`
- `configuracao.service.ts` faz encrypt/decrypt transparente baseado no campo `tipo`:
  - `tipo = 'senha'` ou `'api_key'` → auto-encrypt no `salvar()`, auto-decrypt no `obter()`
  - Demais tipos (`'texto'`, `'html'`, `'json'`) → plaintext
- **Migration v24:** na inicialização, migra `api_key_groq` e `api_key_gemini` de plaintext para safeStorage (altera `tipo` para `'api_key'`)
- Se `safeStorage.isEncryptionAvailable()` retornar `false`, os valores são armazenados sem criptografia (fallback)

---

## 10. Segurança

- **Credenciais nunca trafegam no renderer.** O renderer chama `ipcAPI.gdl.testarConexao(ambiente)` e recebe apenas o resultado do diagnóstico. Login/senha são lidos e usados exclusivamente no main process.
- **Somente leitura na API GDL.** Nenhum endpoint de escrita (`POST`, `PUT`, `DELETE`) é implementado. Apenas `GET` e `HEAD`.
- **HTTPS com `rejectUnauthorized: false`** para ambientes de homologação com certificados auto-assinados.
- **Timeout** de 5s para teste de conexão, 15s para consulta de REP.
