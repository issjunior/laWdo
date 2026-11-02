# Painel de Saúde do Sistema

> Consolidação: 02/11/2026. Estado medido na árvore de trabalho, com instalação limpa; não representa validação remota de CI.

## Verificação vigente

| Frente | Resultado |
|---|---|
| Ambiente | Node 24.21.0 / npm 11.17.0; `npm ci --strict-allow-scripts` aprovado |
| Tipagem e lint | `npm run type-check` e `npm run lint`: zero erros e warnings |
| Testes | 1622 aprovados em 229 arquivos |
| Cobertura statements / branches / funções / linhas | 64,22% / 56,38% / 63,73% / 67,43%; gates mantidos |
| Scripts | 14 testes de release, 16 de carga e 1 do executor Knip aprovados |
| Build | Aprovado; maior chunk de 479,42 kB, abaixo de 500 kB |
| Schema | Versão 49; contrato e smoke aprovados, inclusive no executável Windows |
| Código morto | Knip sem achados; ts-prune observacional, com falsos positivos NodeNext e uso interno |
| Dependências | Árvore de primeiro nível válida; auditoria de produção sem vulnerabilidades; 29 alertas moderados na árvore completa |
| Windows | `npm run pack` aprovado; auxiliar sharp, BMP, cancelamento, recuperação e conferência PNG/PDF aprovados no pacote isolado |

Comandos de reprodução: `npm ci --strict-allow-scripts`, `npm ls --depth=0`, `npm run type-check`, `npm run lint`, `npm run test:coverage`, `npm run test:release`, `npm run test:carga:unitarios`, `npm run test:saude`, `npm run build`, `npm run knip -- --no-exit-code`, `npm run dead-code:check`, `npm run smoke:schema`, `npm run pack`, `npm run smoke:imagens -- --executavel dist/win-unpacked/laWdo.exe` e `git diff --check`. A auditoria completa usa `npm audit --json`; separar produção com `--omit=dev`.

## Robustez e desempenho

A conexão SQLite só é publicada depois da abertura e dos PRAGMAs. Uma fila coordena consultas, escritas, transações, backup e fechamento; contexto assíncrono permite consultas da transação ativa sem incluir operações externas. Aninhamento é recusado. Falha de rollback preserva o erro original e bloqueia a conexão até reiniciar. Os testes de concorrência usam barreiras determinísticas com SQLite real.

Leitura de ZIP verifica deslocamentos e comprimentos antes da alocação; descompressão assíncrona tem limite real de saída. JPEG/PNG/GIF/WebP são transformados por sharp em utilityProcess; BMP de 24/32 bits sem compressão e hashes GDL legados mantêm caminhos específicos de compatibilidade. Derivados têm cache limitado e não substituem o arquivo original durante a elaboração. Preparação das figuras para conclusão acontece antes da transação, com revalidação do documento e registros.

`npm run smoke:imagens` usa perfil isolado e três rodadas frias/quentes de 100 JPEGs sintéticos de 12 MP. No pacote Windows, a mediana do lote foi 3.20 s fria e 35 ms quente; p95 por posto mais próximo entre três rodadas: 3.24 s e 37 ms. O RSS do processo principal variou de 135 a 161 MiB. Arquivos detalhados e conferências visuais são artefatos descartáveis em `tmp/saude-imagens/`; o comando os reproduz.

Limites da evidência: a massa usa cores sintéticas simples e mede o processador, não o fluxo completo do editor, GDL ou exportação do laudo. Não havia sessão de diagnóstico assistido ativa para uma referência anterior comparável. Não há comprovação de ganho ponta a ponta, estabilidade prolongada de memória ou cumprimento da margem de 10% frente à versão anterior. A conferência visual atual cobre o artefato sintético Electron/PDF; não equivale a conferir um laudo real com 100 fotos.

Uma execução concorrente com compilação/empacotamento provocou falta de memória no LibreOffice; a validação isolada e a suíte final passaram sem elevar timeouts. No sandbox, o cache do Vitest pode receber EPERM ao renomear temporários; a medição aprovada foi executada fora dele.

## Pendências de dependências

A auditoria completa encontra 29 pacotes sinalizados por propagação de um advisory moderado de minimatch: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), faixa reportada `<11.0.1`. Não são 29 falhas independentes. Não há alertas altos/críticos nem de produção na medição vigente.

Cadeias afetadas incluem ESLint/typescript-eslint/eslint-plugin-react, electron-builder/app-builder-lib/asar e ts-prune/ts-morph. Electron-builder/app-builder-lib estão alinhados em 26.18.0; Knip 6.44.1 e typescript-eslint 8.72.1. ESLint permanece 9.39.5: o plugin React 7.37.5 não declara peer para ESLint 10, e o ESLint 10.14.0 consultado ainda declara minimatch ^10.2.6.

Mitigação atual: ferramentas operam sobre o repositório local, sem receber padrões glob fornecidos por usuários do aplicativo; não forçar overrides major nem downgrade sugerido automaticamente por audit. Condição de encerramento: versões upstream com peers compatíveis e árvore sem o advisory, aprovadas por instalação limpa, tipos, lint, cobertura e pack/smoke quando houver impacto nativo. A pendência é explícita; a meta de zero alertas completos não está cumprida.

## Código morto e manutenção

`npm run knip` usa `scripts/check-knip.mjs`: repete uma única vez com `KNIP_DISABLE_RAW_TRANSFER=1` somente para a combinação RangeError de alocação + oxc-parser; preserva outras falhas e códigos de saída. Knip continua observacional. Scripts externos de carga, smoke e o entrypoint do auxiliar são declarados. Não remover símbolos de ts-prune sem conferir consumidores, usos dinâmicos e `DEAD_CODE_EXCEPTIONS.md`.

Sharp 0.35.5 é dependência de produção com lifecycle autorizado explicitamente. `electron-builder.yml` desempacota sharp e @img. Alterar encoder, cache ou auxiliar exige conferir originais, transparência/orientação, duplicatas legadas, fila, recuperação, preparação do editor, PDF e pacote Windows. Aumentos de chunk não devem ser escondidos elevando o limite.
