# Fluxo `/spec` — Skill e Scripts de Auditoria/Registro

## Visão geral

O projeto mantém `spec/` como documentação do comportamento atual. O fluxo `/spec` existe para auditar impacto de mudanças no código e registrar atualizações aprovadas sem transformar a pasta em histórico de alterações.

A automação combina:

- a skill local em `.agents/skills/spec/SKILL.md`
- os scripts `scripts/spec/auditar.mjs`, `scripts/spec/registrar.mjs`, `scripts/spec/index.mjs` e `scripts/spec/lib.mjs`
- o manifesto `spec/09 automacao-spec/manifesto.json`
- a área temporária `.codex/spec/`

## Objetivo do fluxo

O fluxo separa duas etapas:

- **auditar**: descobrir quais specs de `estado_atual` foram impactados pelas mudanças analisadas
- **registrar**: aplicar em `spec/` apenas um plano explícito, com conteúdo final já aprovado

`spec/` não deve funcionar como changelog. O texto gravado deve descrever apenas como o sistema funciona agora.

## Comandos disponíveis

| Comando | Papel |
|---|---|
| `npm run spec` | atalho para a auditoria padrão baseada no diff atual mais o último commit |
| `npm run spec:auditar` | gera o relatório `/spec` e os artefatos temporários da auditoria |
| `npm run spec:registrar` | aplica um plano aprovado de escrita em `spec/` |

## Modos de auditoria

A skill roda `npm run spec:auditar -- --modo recente` por padrão. Quando o usuário pedir outro escopo, a auditoria aceita:

- recente: `npm run spec:auditar -- --modo recente`
- diff atual: `npm run spec:auditar -- --modo diff`
- último commit: `npm run spec:auditar -- --modo ultimo-commit`
- total: `npm run spec:auditar -- --modo total`
- focado: `npm run spec:auditar -- --modo focado --alvo "<subdiretorio>"`

O modo `recente` combina os arquivos não commitados do worktree com os arquivos alterados em `HEAD~1..HEAD`, removendo duplicidades antes do mapeamento por globs. O modo `diff` preserva a auditoria estrita contra o `HEAD`; o modo `ultimo-commit` audita apenas o último commit já gravado.

O script filtra artefatos irrelevantes como `.codex/`, `dist/`, `build/`, `release/`, `node_modules/` e também ignora specs já existentes, exceto `spec/09 automacao-spec/manifesto.json`.

## Manifesto e cobertura

`spec/09 automacao-spec/manifesto.json` é a fonte de verdade da automação. Ele define:

- quais specs existem
- o tipo de cada spec
- os globs de código cobertos por cada arquivo
- os grupos usados para sugerir novos specs
- os caminhos dos artefatos temporários do fluxo

Na automação padrão, apenas specs com tipo `estado_atual` entram na auditoria e no registro.

## Artefatos temporários

`.codex/spec/` é uma área operacional temporária. A documentação oficial continua sendo apenas o conteúdo sob `spec/`.

Rascunhos de conteúdo final não devem ser materializados como arquivos Markdown fora de `spec/`. Em `.codex/spec/`, a automação deve manter apenas os artefatos operacionais previstos pelo fluxo.

Arquivos usados no fluxo:

| Arquivo | Papel |
|---|---|
| `.codex/spec/ultima-auditoria.json` | resultado estruturado da última auditoria |
| `.codex/spec/ultimo-relatorio.md` | relatório em Markdown no formato `/spec` |
| `.codex/spec/plano-registrar.json` | plano aprovado com o conteúdo final a ser gravado |

Fora esses artefatos, a skill não deve criar novos `.md` temporários em `.codex/spec/` nem em qualquer outro diretório fora de `spec/`.

## Papel da skill `/spec`

A skill orquestra a conversa e o uso dos scripts neste fluxo:

1. roda `npm run spec:auditar -- --modo recente`
2. lê `.codex/spec/ultimo-relatorio.md` e `.codex/spec/ultima-auditoria.json`
3. apresenta o relatório no formato definido em `AGENTS.md`
4. se não houver mudança relevante, informa isso em uma linha e encerra
5. se houver impacto, espera aprovação humana antes de montar o plano
6. após aprovação, grava `.codex/spec/plano-registrar.json`, sem criar arquivos `.md` temporários com o conteúdo final
7. roda `npm run spec:registrar`
8. informa o resultado com arquivos criados, atualizados ou mantidos inalterados

## Aprovação humana

A skill não deve gravar nada em `spec/` antes da aprovação do usuário.

Quando a auditoria encontra impacto, a resposta precisa separar:

- specs que precisam de atualização
- specs sem alterações necessárias
- sugestão de novo spec, quando houver

A recomendação é sempre preferir atualizar um spec existente antes de propor um novo arquivo.

## Contrato do plano de registro

`spec:registrar` espera um JSON com este formato:

```json
{
  "headAuditado": "abcdef123456",
  "instrucoes": [
    {
      "acao": "atualizar",
      "arquivo": "spec/03 laudo/menu_contexto.md",
      "conteudo": "# Conteudo final..."
    }
  ]
}
```

Regras do registro:

- apenas caminhos sob `spec/` são aceitos
- o `HEAD` atual precisa bater com `headAuditado`
- se o `HEAD` divergir, é obrigatório rodar nova auditoria antes de registrar
- se o conteúdo final for igual ao já existente, o arquivo é marcado como `inalterado`


## Integração com `AGENTS.md`

`AGENTS.md` é o guia operacional lido pelos agentes antes de alterar o projeto. Ele lista os comandos essenciais, as regras de validação e as referências de spec que devem ser consultadas durante manutenção.

A tabela de comandos do `AGENTS.md` deve refletir o estado atual dos gates de qualidade. No estado atual, `npm run test:coverage` roda o Vitest com cobertura e usa o gate progressivo definido em `vitest.config.ts`, não um percentual global fixo documentado fora da configuração.

## Relatório `/spec`

O relatório gerado por `spec:auditar` segue o formato exigido em `AGENTS.md`:

- modo da auditoria
- modelo IA
- base de arquivos analisados
- specs que precisam de atualização
- specs sem alterações necessárias
- sugestão de novo spec

Se `graphify-out/GRAPH_REPORT.md` estiver ausente ou desatualizado em relação ao `HEAD`, a auditoria registra apenas um aviso e prossegue normalmente.
