# Fluxo `/spec` — Skill e Scripts de Auditoria/Registro

## Visão geral

O projeto possui um fluxo dedicado para manter a pasta `spec/` alinhada ao código atual sem transformar a documentação em changelog. Esse fluxo combina:

- uma skill local `/spec`, em `.agents/skills/spec/SKILL.md`
- scripts de apoio em `scripts/`
- um manifesto de classificação e cobertura em `spec/manifesto.json`

O objetivo é separar claramente:

- **auditar**: descobrir quais specs de `estado_atual` precisam ser revisados
- **registrar**: gravar em `spec/` apenas um plano já aprovado

## Comandos disponíveis

| Comando | Papel |
|---|---|
| `npm run spec` | Atalho para a auditoria padrão (`git diff`) |
| `npm run spec:auditar` | Gera relatório `/spec` e artefatos da auditoria |
| `npm run spec:registrar` | Aplica um plano aprovado de escrita em `spec/` |

### Modos de auditoria

`spec-auditar.mjs` suporta estes modos:

- padrão: `git diff`
- total: varredura de todos os arquivos rastreados + untracked relevantes
- focado: revisão de um subdiretório de spec específico

Exemplos:

```bash
npm run spec
npm run spec:auditar -- --modo total
npm run spec:auditar -- --modo focado --alvo "03 laudo"
```

## Manifesto e classificação

O arquivo `spec/manifesto.json` centraliza:

- a lista de specs conhecidos
- a classificação de cada arquivo
- os globs de código que cada spec cobre
- os artefatos temporários do fluxo
- os grupos usados para sugerir novos specs

### Tipos usados no manifesto

| Tipo | Uso no fluxo |
|---|---|
| `estado_atual` | elegível para auditoria e registro padrão |
| `planejamento` | fora da automação padrão |
| `auditoria` | fora da automação padrão |
| `historico` | fora da automação padrão |

Na prática, `spec:auditar` e `spec:registrar` operam por padrão apenas em arquivos `estado_atual`.

## Artefatos temporários

O fluxo usa arquivos temporários em `.codex/spec/`:

| Arquivo | Papel |
|---|---|
| `.codex/spec/ultima-auditoria.json` | resultado estruturado da última auditoria |
| `.codex/spec/ultimo-relatorio.md` | relatório em Markdown no formato `/spec` |
| `.codex/spec/plano-registrar.json` | plano aprovado com conteúdo final a ser gravado |

Esses artefatos não são a documentação oficial; eles só sustentam a operação do fluxo.

## Papel da skill `/spec`

A skill local faz a orquestração conversacional:

1. roda `npm run spec:auditar`
2. lê o relatório e o JSON da auditoria
3. apresenta ao usuário quais specs precisam mudar e onde criar novo spec, se necessário
4. espera a aprovação humana
5. monta `.codex/spec/plano-registrar.json`
6. roda `npm run spec:registrar`

A skill não deve tratar `spec/` como histórico de mudanças. O texto final sempre descreve o comportamento implementado agora.

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

- o `HEAD` atual precisa bater com `headAuditado`
- apenas caminhos sob `spec/` são aceitos
- se o conteúdo novo for idêntico ao atual, o arquivo fica como `inalterado`

## Relatório `/spec`

O relatório gerado por `spec:auditar` segue o formato definido no `AGENTS.md`:

- modo da auditoria
- modelo IA esperado no fluxo
- base de arquivos analisados
- specs que precisam de atualização
- specs sem alterações necessárias
- sugestão de novo spec

Se o `graphify-out/GRAPH_REPORT.md` estiver ausente ou desatualizado em relação ao `HEAD`, a auditoria registra esse aviso, mas continua funcionando com diff + manifesto.
