# Fluxo atual de `/spec`

## Comandos do `package.json`

O estado atual exposto em `package.json` e:

| Comando | Implementacao |
|---|---|
| `npm run spec` | `node scripts/spec/index.mjs` |
| `npm run spec:auditar` | `node scripts/spec/auditar.mjs` |
| `npm run spec:registrar` | `node scripts/spec/registrar.mjs` |

O fluxo continua apoiado em:

- `.agents/skills/spec/SKILL.md`
- `scripts/spec/auditar.mjs`
- `scripts/spec/registrar.mjs`
- `scripts/spec/lib.mjs`
- `spec/09 automacao-spec/manifesto.json`

## Auditoria

`executarAuditoria()` em `lib.mjs`:

1. carrega o manifesto
2. resolve a base de arquivos pelo modo escolhido
3. filtra ruido (`.codex/`, `dist/`, `build/`, `node_modules/`, `graphify-out/`, specs existentes etc.)
4. cruza os arquivos com os globs dos specs de `estado_atual`
5. produz:
   - `specsQuePrecisam`
   - `specsSemMudanca`
   - `sugestoesNovoSpec`
   - `avisos`

Modos atuais:

- `diff`
- `ultimo-commit`
- `recente`
- `total`
- `focado`

`recente` continua sendo o modo padrao da skill.

## Artefatos operacionais

Gerados em `.codex/spec/`:

- `ultima-auditoria.json`
- `ultimo-relatorio.md`
- `plano-registrar.json`

O relatorio markdown ja sai no formato `/spec` exigido pelo projeto.

## Registro

`executarRegistro()` em `lib.mjs`:

1. le o plano JSON
2. valida se `instrucoes` existe e nao esta vazia
3. compara `headAuditado` com o `HEAD` atual
4. rejeita qualquer caminho fora de `spec/`
5. escreve apenas arquivos cujo conteudo mudou

Saidas contabilizadas:

- `criados`
- `atualizados`
- `inalterados`

## Comportamento relevante do registro

Pontos praticos do estado atual:

- o campo `acao` do plano nao controla a escrita; o registro deriva `criado` vs `atualizado` comparando o filesystem
- se o conteudo final for identico ao arquivo atual, o item entra como `inalterado`
- todo conteudo e normalizado para terminar com quebra de linha

## Papel da skill

A skill continua com a responsabilidade de conversa:

1. rodar `spec:auditar`
2. apresentar o relatorio
3. esperar aprovacao humana
4. montar `plano-registrar.json`
5. rodar `spec:registrar`

Ela nao deve escrever markdown temporario fora de `spec/`, nem pular a verificacao de `HEAD`.
