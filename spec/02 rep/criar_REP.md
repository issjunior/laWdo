# Ciclo atual de criação e edição de REP

## Fluxo entre camadas

```text
REPsPage
  → window.ipcAPI.rep.create/update
  → preload
  → rep.handlers
  → repService/BaseService
  → SQLite
```

O renderer valida e monta o payload. O preload restringe os canais. O handler sanitiza campos textuais, aplica regras de ciclo de vida e delega o CRUD.

## Fontes de validação

O renderer combina:

- schema Zod e `react-hook-form`
- pendências específicas por tipo de exame
- validação estrutural das peças B-602

O handler do main não repete todo o schema. Na criação ele exige número, verifica duplicidade e sanitiza campos conhecidos. Na atualização ele aceita um payload parcial e sanitiza somente os campos presentes.

Consequência: o renderer é a principal barreira de domínio, mas o IPC continua sendo fronteira insegura. Novas chamadas ou novos campos precisam manter payload, handler, preload e tipos alinhados.

## Montagem do payload

`prepareForApi()` separa:

- colunas comuns da REP
- ids opcionais
- coordenadas convertidas para número
- `campos_especificos` serializado conforme o tipo
- `template_id` e `perito_id` quando há template selecionado

Para B-602, a composição final inclui dados de investigação, `b602.pecas` e metadados GDL.

## Criação

`rep:create`:

1. rejeita número vazio ou duplicado
2. gera UUID
3. força status `Pendente`
4. sanitiza textos
5. cria a REP
6. registra auditoria
7. tenta criar laudo se template e perito forem enviados e o template não for `tpl-nao-definido`

A criação de REP e laudo não é transacional. Se o laudo falhar, a REP permanece criada, o erro é registrado e a resposta da REP continua sendo sucesso. Uma solução futura não deve assumir atomicidade sem introduzir transação ou compensação explícita.

## Edição

Na abertura:

1. resolve tipo, template e laudo vinculado
2. desserializa campos específicos
3. extrai peças e metadados B-602
4. combina dados persistidos com `emptyForm()`
5. preserva snapshots legados de toggles e armas para avisos

Na atualização, o handler persiste a REP primeiro. Depois:

- cria laudo se ainda não existe e há template/perito
- troca o template quando ele mudou
- sincroniza seções condicionais quando o template permanece igual

Falhas de criação, troca ou sincronização do laudo são registradas, mas não desfazem a atualização da REP. O retorno pode indicar sucesso da REP mesmo com o laudo desatualizado.

## Exclusão

`rep:delete` remove primeiro o laudo vinculado e depois a REP para respeitar a chave estrangeira. As duas operações não estão numa transação visível. Se a segunda falhar após a primeira, pode restar uma REP sem o laudo anterior.

## B-602

Seções ativas:

- Dados da Investigação
- Peças

O salvamento exige dados fixos, ao menos uma peça completa, primeiro envolvido, data da ocorrência, cidade, UF e BO ou IP.

Peças ficam em estado separado de `react-hook-form`. A validade usa o catálogo compartilhado. O JSON novo não é equivalente aos arrays legados ainda usados por parte do laudo.

## Aplicação do GDL

A consulta produz um contrato B-602 tipado. Ao aplicar:

- sem tipo selecionado, a página seleciona B-602
- com outro tipo, interrompe e exige confirmação da troca
- `mesclar` preserva valores locais não vazios
- `substituir` aplica os valores retornados
- formulário sem dados relevantes é tratado como substituição
- peças são reconciliadas por `codPecaGdl`

O destaque verde é estado de sessão da página; não é persistido como estilo. Avisos do normalizador são mostrados, mas não bloqueiam salvar.

## Acoplamento legado com o laudo

`handleSalvar` ainda verifica toggles e snapshots de armas do modelo antigo para alertar sobre laudo vinculado. Como as seções legadas não estão ativas e a composição final remove seus arrays, esse caminho não representa o estado canônico novo das peças.

Antes de reutilizar esse código para `PecaB602`, é necessário definir conversão ou migrar os consumidores. Não associar automaticamente uma peça da família arma a `b602.armas` sem regra explícita de mapeamento.

## Desempenho e concorrência

- a página carrega listas e templates por IPC e mantém o formulário localmente
- salvamento é uma chamada por REP, seguida de recarga da lista
- não há controle otimista por `updated_at`; duas edições concorrentes podem sobrescrever campos
- criação automática e sincronização do laudo acrescentam operações sequenciais após persistir a REP

Evitar novas consultas por campo ou por peça durante renderização. Dados derivados devem ser calculados localmente ou carregados em lote.

## Verificação e lacunas

Não há teste automatizado direto dos handlers `rep:create` e `rep:update` cobrindo persistência mais laudo. Mudanças no ciclo devem validar:

1. criação sem template
2. criação com template e falha de laudo
3. edição com e sem troca de template
4. sincronização de seções
5. exclusão com laudo vinculado
6. round-trip de `campos_especificos`
7. edição concorrente quando a solução alterar controle de versão
