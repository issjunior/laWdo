# API GDL — Especificação do Implementado

> **Princípio fundamental: Somente leitura.**
> Métodos permitidos: `GET`, `HEAD`, `OPTIONS`. Proibidos: `POST`, `PUT`, `PATCH`, `DELETE`.
>
> **Última revisão:** 2026-06-29

---

## 1. Visão Geral

Integração com a API REST do GDL para:

1. testar acesso de rede ao ambiente configurado;
2. validar credenciais com uma consulta real de REP;
3. consultar REP e aplicar dados ao formulário local;
4. persistir localmente o status de validação da sessão por ambiente.

O sistema continua sendo apenas consumidor de dados do GDL. O preenchimento manual da REP permanece como fallback.

**Requisito:** VPN da Polícia Científica do Paraná ativa quando o ambiente exigir acesso interno.

---

## 2. Arquivos da Feature

| Arquivo | Papel atual |
|---|---|
| `src/main/services/gdl.service.ts` | Cliente HTTP/HTTPS do GDL, teste de rede, consulta de REP, validação de credenciais e persistência local do estado de validação |
| `src/main/ipc/handlers/gdl.handlers.ts` | Handlers IPC de leitura para GDL |
| `src/preload/index.ts` | Expõe os canais GDL permitidos em `window.ipcAPI.gdl` |
| `src/renderer/pages/GdlConfigPage.tsx` | Configuração dos ambientes, teste de rede e validação de credenciais |
| `src/renderer/components/rep/GdlConsultaModal.tsx` | Consulta de REP e revisão dos campos que serão aplicados ao formulário |
| `src/main/services/configuracao.service.ts` | Leitura e gravação das credenciais por ambiente, com criptografia transparente para senha |
| `src/main/services/safe-storage.service.ts` | Wrapper do `safeStorage` do Electron |
| `src/renderer/pages/REPsPage.tsx` | Aciona o modal GDL, aplica os campos retornados e destaca visualmente o que foi preenchido |

---

## 3. Canais IPC

Todos os canais seguem o modelo renderer → preload → main.

| Canal | Responsabilidade |
|---|---|
| `gdl:testar-conexao` | Verifica acesso de rede ao ambiente informado |
| `gdl:obter-validacao-sessao` | Retorna o estado persistido da validação da sessão no ambiente |
| `gdl:limpar-validacao-sessao` | Invalida o estado local de sessão validada |
| `gdl:validar-credenciais` | Faz uma consulta real usando login/senha/CPF informados e uma REP de referência |
| `gdl:consultar-rep` | Consulta uma REP usando o ambiente salvo nas configurações |

---

## 4. Arquitetura Atual

```text
Renderer                               Main
────────                               ────

GdlConfigPage                          gdl.handlers
├─ seleciona ambiente                  ├─ gdl:testar-conexao
├─ edita login/senha/cpf               ├─ gdl:obter-validacao-sessao
├─ salva configurações                 ├─ gdl:limpar-validacao-sessao
├─ testa rede                          ├─ gdl:validar-credenciais
└─ valida credenciais                  └─ gdl:consultar-rep

GdlConsultaModal                       gdl.service
├─ consulta REP                            ├─ carregarCredenciais()
├─ revisa campos                           ├─ testarConexao()
└─ aplica ao formulário                    ├─ validarCredenciais()
                                           ├─ consultarRep()
REPsPage                                   ├─ obterValidacaoSessao()
├─ abre modal GDL                          ├─ limparValidacaoSessao()
├─ aplica campos retornados                └─ persistir validacao-sessao.json
└─ destaca campos vindos do GDL
```

Separação atual:

- **teste de rede** verifica conectividade ao endpoint;
- **validação de credenciais** exige uma REP real e marca a sessão como validada;
- **consulta de REP** usa as credenciais persistidas do ambiente salvo.

---

## 5. Configurações e Estado Local

### 5.1 Configurações persistidas

| Chave | Tipo | Criptografado | Descrição |
|---|---|---|---|
| `gdl_ambiente` | `texto` | Não | Ambiente ativo para consultas de REP |
| `gdl_login_homologacao` | `texto` | Não | Login do ambiente de homologação |
| `gdl_senha_homologacao` | `senha` | Sim | Senha do ambiente de homologação |
| `gdl_cpf_usuario_homologacao` | `texto` | Não | CPF opcional enviado ao GDL |
| `gdl_login_producao` | `texto` | Não | Login do ambiente de produção |
| `gdl_senha_producao` | `senha` | Sim | Senha do ambiente de produção |
| `gdl_cpf_usuario_producao` | `texto` | Não | CPF opcional enviado ao GDL |
| `gdl_url_homologacao` | `texto` | Não | Override opcional de endpoint |
| `gdl_url_producao` | `texto` | Não | Override opcional de endpoint |

### 5.2 Estado da validação de sessão

O `gdl.service.ts` persiste um arquivo local em:

```text
{userData}/gdl/validacao-sessao.json
```

Estrutura lógica por ambiente:

```json
{
  "homologacao": {
    "ambiente": "Homologação",
    "validado": true,
    "numeroRep": "12345",
    "anoRep": "2026",
    "dataHora": "2026-06-29T16:00:00.000Z"
  }
}
```

Esse estado não substitui a autenticação do GDL. Ele serve apenas para UX local, mostrando se as credenciais já foram validadas manualmente naquela sessão persistida.

---

## 6. Operações Implementadas

### 6.1 Teste de rede

Usa o ambiente informado pela tela de configuração e tenta acessar:

```text
GET {baseUrl}/unidadesMedida
```

Características:

- timeout curto;
- mede latência;
- retorna status HTTP;
- não exige uma REP de referência;
- alimenta o card "Teste de Rede" da `GdlConfigPage`.

### 6.2 Validação de credenciais

Usa credenciais informadas na UI e uma REP real (`numero` + `ano`) para validar o acesso funcional ao GDL:

```text
GET {baseUrl}/rep/obter?numero={numero}&ano={ano}
```

Comportamento:

- sanitiza `login`, `cpfUsuario`, `numero` e `ano`;
- se a consulta funcionar, registra a sessão como validada;
- se falhar, limpa a validação persistida daquele ambiente;
- alimenta o card "Validação de Credenciais" e o modal de validação da `GdlConfigPage`.

### 6.3 Consulta de REP

`gdl:consultar-rep` usa o ambiente salvo em `gdl_ambiente` e as credenciais persistidas daquele ambiente.

Retorno principal:

```ts
interface GdlRepData {
  codRep: number;
  numero: number;
  ano: number;
  origens: GdlOrigem[];
  pecas: GdlPeca[];
  andamentos: GdlAndamento[];
}
```

---

## 7. Mapeamento GDL → Formulário da REP

O mapeamento continua conservador e focado em preenchimento assistido:

| Campo GDL | Campo local | Observação |
|---|---|---|
| `numero` + `ano` | `numero` | Formato `{numero}-{ano}` |
| `origens[0].tipo` | `tipo_solicitacao` | Primeira origem disponível |
| `origens[0].numero` | `numero_documento` | Primeira origem disponível |
| `andamentos[0].dataHora` | `data_requisicao` | Usa a data do primeiro andamento |
| `pecas[*]` | `observacoes` | Consolida material consultado em texto auxiliar |

Os campos aplicados via GDL ficam destacados no formulário com estilo verde em `REPsPage.tsx`.

---

## 8. UX Implementada

### 8.1 `GdlConfigPage`

Fluxo visual atual:

- cards de seleção de ambiente com destaque visual do ambiente ativo;
- campos de login, senha com toggle de visibilidade e CPF opcional;
- botão **Salvar Configurações**;
- card **Teste de Rede** com botão **Testar Rede**;
- card **Validação de Credenciais** com status da sessão e botão **Validar Credenciais**;
- modal para informar número e ano de uma REP de referência;
- exibição da data/hora da última validação bem-sucedida.

Detalhes relevantes:

- trocar o ambiente recarrega credenciais e estado de validação daquele ambiente;
- salvar configurações limpa a validação de sessão do ambiente salvo;
- a validação pode acontecer sem salvar previamente, usando os valores atualmente digitados na UI.

### 8.2 `GdlConsultaModal`

Mantém o fluxo em duas etapas:

1. informar número e ano da REP;
2. revisar os campos que serão aplicados.

Ao aplicar:

- usa `substituir` ou `mesclar`;
- marca os campos preenchidos em `camposPreenchidosGdl`;
- permite ao usuário revisar o resultado diretamente no formulário da REP.

### 8.3 `REPsPage`

- botão `GDL` no cabeçalho do formulário;
- destaque verde nos campos preenchidos automaticamente;
- banner informando quantos campos vieram do GDL;
- limpeza do estado visual ao iniciar/cancelar edição.

---

## 9. Logs

O módulo `gdl` continua registrando eventos visíveis na `LogsPage`.

| Nível | Situação típica |
|---|---|
| `info` | teste de rede bem-sucedido |
| `info` | REP consultada com sucesso |
| `warn` | falha ao persistir ou carregar a validação local |
| `error` | timeout, rede indisponível, credencial rejeitada ou erro na consulta |

---

## 10. Criptografia e Segurança

### 10.1 Armazenamento

- senhas do GDL usam `safeStorage` via `configuracao.service.ts`;
- valores são persistidos em base64 criptografada quando o Electron suporta criptografia local;
- se `safeStorage` não estiver disponível, o sistema faz fallback controlado para texto simples.

### 10.2 Limites de segurança

- a integração continua **somente leitura**;
- renderer nunca acessa `http`, `https`, banco local ou módulos do Electron diretamente;
- toda chamada passa por canais IPC explicitamente liberados no preload;
- o serviço usa `rejectUnauthorized: false` para tolerar certificados problemáticos de ambientes internos;
- timeouts curtos evitam travamentos longos na UI.

### 10.3 Tráfego de credenciais

As credenciais digitadas na `GdlConfigPage` existem temporariamente no renderer enquanto o usuário edita o formulário, mas o uso efetivo contra o GDL acontece apenas no main process via IPC. O renderer não executa chamadas HTTP diretas ao GDL.
