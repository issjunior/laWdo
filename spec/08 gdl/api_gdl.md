# Integração atual com a API GDL

## Limite e fluxo

A integração é somente leitura no GDL. O fluxo é:

```text
GdlConsultaModal ou GdlPecasModal → preload → gdl.handlers
→ gdl.service → API GDL → schemas Zod → adaptador do exame
→ ResultadoImportacaoExame → REPsPage
```

`gdl.service.ts` controla HTTP, ambientes e credenciais; `gdl.schema.ts` é a fronteira de validação; `gdl-adaptadores.service.ts` escolhe o conversor pelo código do exame. B-602 é a entrada registrada atualmente. Códigos sem adaptador são rejeitados de modo explícito, para não aplicar dados de outro exame ao formulário B-602.

## Fronteira externa

`consultarRep(numero, ano)` exige credenciais, chama `/rep/obter`, interpreta a resposta como `unknown`, valida com Zod e só então normaliza. O request possui timeout de 15 segundos; não há retry/backoff. Em homologação, a consulta auxiliar de envolvidos é tolerante a falhas e pode acrescentar até 15 segundos por filtro processado sequencialmente.

Schemas preservam propriedades dinâmicas como `unknown`. O renderer nunca recebe JSON bruto: campos conhecidos são normalizados e extras permanecem em `extrasGdl`. Falhas de autenticação limpam a validação local; timeout, 404 e falhas genéricas não a limpam.

## Conversão B-602

`converterRepB602()` produz dados gerais, peças, origens, investigação, metadados e avisos. Tipos de peça são resolvidos por label/alias normalizado contra `b602-gdl.catalogo.ts`, fonte de verdade dos 16 tipos suportados, seus campos, aliases e opções. `PEÇA TESTE` (`771`) é ignorada por decisão funcional e nunca chega ao editor.

Campos comuns aceitam chaves canônicas ou labels visuais; datas brasileiras ou ISO são normalizadas para `AAAA-MM-DD`. `numeroAnalises` é aceito no payload bruto, mas descartado do modelo local. Campos enumerados aceitam código ou label e são convertidos ao valor canônico. Só campos explicitamente confirmados no catálogo entram em `personalizados`; chaves restantes são preservadas em `extrasGdl`.

A REP 191/2026 confirmou e passou por importação/persistência/reabertura os valores preenchidos de ARMA(S) DE PRESSÃO, ESPINGARDA(S), FUZIL(IS), GARRUCHA(S), PROJÉTEIS e SUBMETRALHADORA(S). Os fixtures são anonimizados e usados pelos testes; credenciais e dados sensíveis não entram em fixtures ou logs.

## Aplicação local

A consulta geral inicia todas as peças retornadas marcadas e permite Mesclar ou Substituir sem salvar automaticamente. A revisão exclusiva de peças consulta a REP já preenchida e só reconcilia `PecaB602[]`: peças GDL presentes ficam marcadas, removidas localmente ficam desmarcadas e peças manuais são preservadas.

Mesclar mantém alterações locais; Substituir reconcilia por `codPecaGdl` e pode remover peças GDL desmarcadas ou ausentes da seleção. Nenhuma ação desse fluxo cria, atualiza ou exclui dados no GDL.

## Verificação e limitações

A integração é coberta por testes de schemas, normalizador, adaptadores, catálogo, modais, aplicação no formulário e persistência por handlers IPC/SQLite. A rede GDL real, a validação em produção e o round-trip preenchido de seis tipos restantes não são automatizados. `rejectUnauthorized: false` continua uma limitação de TLS a ser revista antes de uso regular em produção.
