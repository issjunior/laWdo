# Painel de Saúde do Sistema

> Gerado automaticamente em 19/11/2026, 09:42 a partir de `tmp\saude\2026-11-19T12-23-50-294Z\resumo.json`. Estado da árvore de trabalho; não representa validação remota de CI.

## Evidência da execução

- Ambiente: Node 24.21.0 / npm 11.17.0. Sem instalação limpa nesta execução.
- Execução completa: pacote e smoke Windows incluídos.
- Logs por fase: `tmp\saude\2026-11-19T12-23-50-294Z`.

## Gates bloqueantes aprovados

| Frente | Evidência |
|---|---|
| Dependências | Aprovado |
| Tipagem | Aprovado |
| Lint | Aprovado |
| Cobertura | 1884 testes em 246 arquivos; statements/branches/funções/linhas: 63,88% / 56,00% / 63,23% / 67,53%. |
| Testes de release | Aprovado |
| Testes de carga | Aprovado |
| Testes do executor | Aprovado |
| Build | Aprovado; maior chunk: 490,41 kB. |
| Schema | Aprovado; versão 51. |
| Auditoria de produção | Aprovado |
| Pacote Windows | Aprovado |
| Smoke de imagens | Aprovado |
| Integridade do diff | Aprovado |

## Observações que exigem análise

| Frente | Evidência |
|---|---|
| Knip | 0 achado(s) em 0 arquivo(s). |
| ts-prune | 683 candidato(s) requer(em) revisão humana. |
| Auditoria completa | 12 alerta(s): moderados 12, altos 0, críticos 0. |

Os achados observacionais não autorizam remoção automática. O grafo ajuda a localizar relações, mas consumidores, usos dinâmicos e entrypoints precisam ser confirmados no código antes de remover símbolos; consulte `DEAD_CODE_EXCEPTIONS.md` para falsos positivos já validados.

## Limites da evidência

A cobertura é serializada para evitar contenção entre SQLite, arquivos temporários e LibreOffice. O smoke de imagens usa perfil isolado e massa sintética; ele não equivale a validar um laudo real, o editor, o GDL ou a estabilidade prolongada de memória.

A auditoria completa pode registrar alertas transitivos moderados. Vulnerabilidades altas, críticas ou de produção impedem a aprovação.
