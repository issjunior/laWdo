# Padrão atual dos formulários do renderer

## Base técnica

Os formulários usam `react-hook-form`, Zod, wrappers de `src/renderer/components/forms/form.tsx` e componentes do design system local.

O contrato normal de campo é `FormField` dentro de `FormItem`, com `FormLabel`, `FormControl` e `FormMessage`. Isso mantém ids, descrição, estado inválido e mensagens ligados ao controle.

## Formulário de REP

A REP combina um passo fixo com seções dinâmicas por tipo de exame. Os títulos das seções são exibidos como cabeçalhos principais do bloco; as descrições registradas permanecem como metadados, mas não são renderizadas abaixo dos títulos na página.

`RepStepSection` fornece o alvo de rolagem e o destaque do passo ativo.

## Obrigatórios e salvamento

A página calcula pendências continuamente. Se houver campos obrigatórios ausentes:

- o alerta aparece depois das seções do formulário
- até quatro pendências viram botões de navegação
- o excedente é resumido numericamente
- é possível ir ao primeiro campo pendente
- o botão de criar ou atualizar fica desabilitado

A navegação rola até a seção e tenta focar o campo após a transição.

## Dados importados do GDL

Campos preenchidos pela importação são acompanhados em um `Set<string>` e recebem fundo e borda verdes durante a sessão do formulário. Não existe alerta persistente apenas para contar campos importados.

Na consulta geral, todas as peças retornadas começam marcadas. Depois de aplicar seus dados, a página exibe mensagem de sucesso somente quando a importação trouxe avisos; sem avisos, nenhum banner genérico é mantido.

Na seção B-602, `Selecionar peças do GDL` abre a revisão exclusiva. Os checkboxes refletem a coleção atual do formulário, e a aplicação mostra `Seleção de peças do GDL aplicada ao formulário.` por cinco segundos. O modal e o botão usam classes Tailwind e tokens do tema definidos em `globals.css`.

## Regra de uso

Novos formulários devem:

1. usar os wrappers de `form.tsx`
2. validar dados externos antes de alimentar o estado
3. manter o critério visual de conclusão alinhado ao bloqueio real de salvamento
4. usar classes Tailwind e tokens globais, sem estilos inline
