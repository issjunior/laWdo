# Integracao atual com a API GDL

## Principio

A integracao continua somente leitura e esta dividida entre:

- `src/main/services/gdl.service.ts`
- `src/main/ipc/handlers/gdl.handlers.ts`
- `src/renderer/pages/GdlConfigPage.tsx`

## Ambientes

O sistema trabalha com dois ambientes:

- `homologacao`
- `producao`

Helpers internos relevantes:

- `normalizarAmbiente()`
- `getAmbienteLabel()`

## Configuracoes persistidas

Credenciais e URLs por ambiente:

- `gdl_ambiente`
- `gdl_login_homologacao`
- `gdl_senha_homologacao`
- `gdl_cpf_usuario_homologacao`
- `gdl_url_homologacao`
- `gdl_login_producao`
- `gdl_senha_producao`
- `gdl_cpf_usuario_producao`
- `gdl_url_producao`

As senhas passam por `configuracao.service.ts`.

## Estado local de validacao

`gdl.service.ts` mantem um arquivo local:

```txt
{userData}/gdl/validacao-sessao.json
```

Esse arquivo guarda, por ambiente:

- `validado`
- `numeroRep`
- `anoRep`
- `dataHora`

Ele nao substitui autenticacao real; serve como memoria local de UX.

## Operacoes atuais

### Teste de rede

`testarConexao(ambiente)` faz `GET {baseUrl}/unidadesMedida` com timeout curto.

Retorno principal:

- `sucesso`
- `latencia`
- `statusCode`
- `ambiente`
- `endpointTestado`
- `rede`

### Consulta de REP

`consultarRep(numero, ano)`:

1. le o ambiente salvo
2. carrega credenciais daquele ambiente
3. envia `Authorization: Basic ...`
4. envia `cpfUsuario` quando configurado
5. consulta `GET {baseUrl}/rep/obter?numero=...&ano=...`

Ao sucesso:

- devolve o payload da REP
- registra a validacao da sessao local

Ao `401` ou `403`:

- limpa a validacao local
- devolve erro amigavel de autenticacao

### Validacao de credenciais

`validarCredenciais(ambiente, credenciais, numero, ano)` usa uma REP real como teste funcional.
Esse fluxo nao depende de salvar previamente as credenciais na UI.

## `GdlConfigPage`

A pagina atual:

- alterna entre cards de homologacao e producao
- carrega login, senha e CPF do ambiente ativo
- salva as configuracoes do ambiente
- limpa a validacao de sessao ao salvar
- testa rede
- abre um dialog para validar credenciais com uma REP real

## Regras tecnicas relevantes

- requests usam `rejectUnauthorized: false`
- o renderer nunca fala com HTTP diretamente
- qualquer falha de persistencia da validacao local vira `log.warn`
- sucesso de consulta de REP atualiza o arquivo local de validacao
