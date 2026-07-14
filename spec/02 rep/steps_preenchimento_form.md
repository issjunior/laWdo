# Stepper e validação do formulário de REP

## Papel do stepper

O stepper orienta navegação e indica conclusão visual. Ele não é, sozinho, a autoridade para permitir salvamento.

Arquivos centrais:

- `RepStepper.tsx`: apresentação
- `useRepStepper.ts`: passos, estado ativo e conclusão
- `step-registry.ts`: passo fixo
- `exam-fields/index.ts`: passos dinâmicos
- `REPsPage.tsx`: pendências que bloqueiam o salvamento

## Passos atuais

| Código | Passos |
|---|---|
| todos | Dados da Solicitação |
| `LOC` | Local do Fato; Linha do Tempo |
| `I-801` | Numerações Identificadoras |
| `B-602` | Dados da Investigação; Peças |

Sem tipo selecionado, somente o passo fixo é montado.

## Duas camadas de validação

Há duas fontes independentes que precisam permanecer coerentes:

1. `useRepStepper()` calcula `completedSteps` para a interface
2. `listarCamposObrigatoriosPendentes()` calcula se criar ou atualizar pode prosseguir

O stepper usa:

- `requiredFields` para seções simples
- conclusão automática quando o array está vazio
- `isComplete` para estado externo, como `PecaB602[]`

O bloqueio final acrescenta regras de negócio que não cabem em um único `requiredFields`. No B-602, ele exige peças válidas, primeiro envolvido, data, cidade, UF e pelo menos um entre BO e IP.

Consequência atual: um passo pode parecer concluído e ainda existir pendência de salvamento. O caso concreto é Dados da Investigação, cujo stepper não inclui a alternativa BO-ou-IP, mas o bloqueio final inclui.

## Invariantes de manutenção

- o stepper nunca deve liberar salvamento; ele apenas comunica estado
- `formularioPodeSalvar` depende de ausência de pendências e de `formState.isValid`
- uma regra alternativa, como BO ou IP, deve permanecer no cálculo de pendências ou ser extraída para função compartilhada
- `isComplete` deve usar exatamente o mesmo catálogo e critérios do editor correspondente
- ids em `CampoObrigatorioPendente.stepId` devem apontar para uma `RepStepSection` existente
- campos sintéticos usados apenas para representar uma pendência não devem ser tratados como valores persistidos

## Navegação e foco

`onStepClick(id)` procura `step-${id}` e usa rolagem suave. Para pendências, `irParaPendencia()` rola até a seção e chama `form.setFocus()` após 250 ms.

A pendência sintética `b602_pecas_validas` aponta para a seção de peças, mas não corresponde a um input real. A rolagem funciona; foco efetivo depende de existir um campo registrado com aquele nome.

O alerta mostra no máximo quatro atalhos e resume o restante. O botão permanece desabilitado enquanto houver pendências.

## Desempenho

`useRepStepper()` chama `form.watch()` sem lista, portanto alterações em qualquer campo recalculam a conclusão. O custo atual é pequeno, mas funções de completude devem permanecer puras e sem parse, I/O ou varreduras pesadas.

Se o formulário crescer significativamente, a otimização segura é observar apenas campos relevantes com `useWatch` ou centralizar regras derivadas. Não duplicar caches manuais sem medir, pois isso aumenta o risco de estado obsoleto.

## Resiliência contra divergência

A duplicação entre stepper e bloqueio final é o principal risco. Ao mudar obrigatórios:

1. atualizar `SECTION_REGISTRY` ou `isComplete`
2. atualizar `listarCamposObrigatoriosPendentes()`
3. conferir ids de navegação e foco
4. validar criação e edição
5. validar o estado com dados importados e manuais

Não existe teste automatizado dedicado que compare as duas fontes de validação. Alterações nessa área exigem ao menos teste do helper extraído ou verificação manual dos dois estados até que a regra seja centralizada.
