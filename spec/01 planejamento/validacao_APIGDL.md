# Validação da autenticação da API GDL em produção

## Objetivo

Determinar por que a consulta da API GDL funciona com `izaias.santos`, mas é rejeitada para outros usuários que conseguem acessar o GDL web. Este arquivo é um protocolo operacional: deve registrar as etapas executadas, as evidências obtidas e a conclusão, sem armazenar credenciais.

O ambiente em escopo é exclusivamente **Produção**. A falha de certificado observada em Homologação é independente e não deve ser misturada com esta investigação.

## Evidências iniciais

- A rede de Produção responde no laWdo antes da tentativa de consulta.
- Dois usuários diferentes receberam `Autenticação rejeitada pelo GDL. Verifique login e senha.`.
- Um dos usuários afetados é responsável pela REP `85.599/2026` e consegue acessá-la no GDL web.
- Os usuários afetados informaram o próprio CPF no laWdo.
- `izaias.santos` consegue consultar a API e será o baseline funcional.
- O código atual converte HTTP `401` e `403` na mesma mensagem visual. O log técnico registra o `statusCode`, mas a exportação CSV da página de Logs omite esse metadado.

## Invariantes de segurança

- Executar somente autenticação necessária e consultas de leitura.
- Nunca criar, editar, concluir, reabrir, movimentar ou excluir registros no GDL.
- Não solicitar que o usuário informe login, senha ou CPF ao agente.
- O próprio usuário deve digitar suas credenciais na interface, sem salvá-las no notebook de diagnóstico.
- Não registrar login, senha, CPF, `Authorization`, cookies ou corpo bruto da resposta.
- Realizar uma tentativa por cenário; não criar retry automático nem testar codificações alternativas de senha sem evidência.
- Manter screenshots e artefatos localmente até confirmar que não exibem dados periciais ou pessoais desnecessários.

## Preparação do notebook

Executar antes de encontrar o segundo usuário:

```powershell
npm ci
npm run build
npm run diagnostico:configurar-codex
```

Depois, reiniciar o Codex e iniciar cada sessão de investigação com:

```powershell
npm run dev:diagnostico
```

Confirmar a conexão por `diagnostico_status`. O modo de diagnóstico não é ativado por `npm run dev`, `npm start` nem pelo aplicativo empacotado.

Antes de entregar o teclado ao segundo usuário, limpar visualmente os campos de login, senha e CPF sem clicar em **Salvar Configurações**. A validação aceita os valores atuais do formulário sem persistir as credenciais.

## Protocolo A — baseline com `izaias.santos`

1. Abrir a página **API GDL** e selecionar Produção.
2. Preencher login, senha e CPF próprios.
3. Não salvar as configurações durante o protocolo.
4. Usar uma REP conhecida e acessível no GDL web.
5. Chamar `diagnostico_status`.
6. Iniciar `iniciar_captura` com:

```json
{
  "finalidade": "problema",
  "cenario": "Validar credenciais da API GDL em Produção com o usuário baseline izaias.santos."
}
```

7. Pedir ao usuário apenas para clicar uma vez em **Validar**.
8. Chamar `finalizar_captura` com `resultadoUsuario: "reproduzido"`.
9. Consultar `dossie`, `eventos` e `timeline`. Capturar tela ou interface somente se o resultado visual não estiver claro.
10. Registrar versão do laWdo, REP usada, resultado visual e horário aproximado.

Resultado esperado: validação bem-sucedida e resposta útil da API. Esse teste comprova o funcionamento do notebook, da VPN, do certificado de Produção, do build e do endpoint.

## Protocolo B — usuário afetado

Antes do teste, o usuário deve confirmar verbalmente apenas que:

- consegue entrar no GDL web de Produção;
- consegue abrir no GDL web a REP escolhida;
- preencherá o próprio CPF;
- não sabe ou não deseja revelar a senha ao agente, como esperado.

Procedimento:

1. Limpar os campos visíveis deixados pelo baseline, sem salvar.
2. O usuário afetado digita login, senha e CPF próprios.
3. Usar preferencialmente uma REP pela qual ele seja responsável ou que tenha confirmado abrir no GDL web. Para o primeiro usuário afetado, usar `85.599/2026`.
4. Chamar `diagnostico_status`.
5. Iniciar `iniciar_captura` com:

```json
{
  "finalidade": "problema",
  "cenario": "Reproduzir rejeição de autenticação da API GDL em Produção com usuário que acessa a mesma REP no GDL web."
}
```

6. Pedir ao usuário apenas para clicar uma vez em **Validar**.
7. Chamar `finalizar_captura` com `resultadoUsuario: "reproduzido"`, `"nao_reproduzido"` ou `"interrompido"`, conforme observado.
8. Consultar `dossie`, `eventos` e `timeline` para correlacionar interface e IPC.
9. No próprio notebook, localizar de forma somente leitura a linha técnica mais recente:

```powershell
$logGdl = Join-Path $env:APPDATA 'laWdo\logs\combined.log'
Select-String -LiteralPath $logGdl -Pattern 'Autenticação GDL rejeitada' |
  Select-Object -Last 1 |
  ForEach-Object { $_.Line }
```

10. Registrar o `statusCode`, ambiente, REP, horário, versão e resultado visual. Não copiar outras linhas sem necessidade.
11. Limpar os campos do formulário sem salvar e encerrar o aplicativo.

O diagnóstico assistido registra o fluxo da interface e a duração do IPC sem payload. O `statusCode` deve ser obtido do log técnico, pois uma resposta `{ success: false }` pode concluir o IPC normalmente e o código atual não expõe a distinção `401/403` na interface.

## Registro das execuções

| Data/hora | Versão | Usuário/alias | REP | Abre no GDL web | CPF próprio | Rede | HTTP API | Resultado | Captura/observação |
|---|---|---|---|---|---|---|---|---|---|
| Pendente | Pendente | `izaias.santos` | Pendente | Sim | Sim | Pendente | Pendente | Baseline | Pendente |
| Pendente | Pendente | Usuário afetado 1 | `85.599/2026` | Sim | Sim | OK | Pendente | Rejeitado | Imagens recebidas em 12/09/2026 |
| Pendente | Pendente | Usuário afetado 2 | Pendente | Sim | Sim | Pendente | Pendente | Rejeitado | REP do teste anterior não registrada |

## Matriz de interpretação

| Evidência | Conclusão provável | Próxima ação |
|---|---|---|
| Baseline recebe sucesso e afetado recebe `403` | Identidade reconhecida, mas conta sem perfil/permissão da API ou associação de CPF recusada | Solicitar ao administrador do GDL a comparação do perfil da conta com `izaias.santos` e a habilitação equivalente |
| Afetado recebe `401`, acessa o GDL web e usa senha somente ASCII | Conta não habilitada para Basic Auth/API, formato de login diferente ou regra própria do serviço | Solicitar conferência do cadastro e do acesso à API junto ao administrador do GDL |
| Afetado recebe `401` e a senha contém caracteres não ASCII | Possível incompatibilidade do charset usado no Basic Auth | Confirmar com o responsável pela API qual charset é esperado antes de alterar a codificação; não registrar a senha |
| O mesmo usuário funciona no notebook de baseline e falha em outro computador | Diferença de versão, ambiente, VPN, configuração ou persistência local | Comparar versões e configurações; resalvar as credenciais apenas no computador do próprio usuário e repetir uma vez |
| A API responde `200`, mas a interface falha | Autenticação aprovada; problema posterior no JSON, schema, natureza do exame ou adaptação B-602 | Investigar a etapa indicada na captura e no log, fora do fluxo de autenticação |
| Não há status HTTP e aparece DNS, timeout ou TLS | Falha de transporte | Tratar rede/VPN/certificado separadamente |
| O resultado muda ao corrigir ou adicionar o CPF próprio | O endpoint exige CPF válido associado ao login | Tornar CPF obrigatório em Produção e validar exatamente 11 dígitos |

## Diagnóstico complementar caso a evidência seja insuficiente

Se o log e a captura não determinarem a classe da falha, implementar no laWdo um relatório JSON sanitizado contendo apenas:

- versão do laWdo;
- data e hora;
- ambiente e etapa;
- endpoint relativo;
- status HTTP;
- código funcional da falha;
- indicação booleana de envio do CPF;
- esquema de `WWW-Authenticate`, quando informado;
- identificador de correlação.

O contrato será compartilhado entre main, preload e renderer. A interface distinguirá `401`, `403`, `404`, transporte e resposta inválida e permitirá exportar somente o diagnóstico sanitizado.

Os testes automatizados deverão proteger Basic Auth, normalização do CPF, distinção dos status, ausência de segredos e a regra existente que confirma uma REP previamente validada antes de classificar determinados `401` como REP inexistente. Depois das alterações, executar `npm run type-check`, `npm run lint` e `npm test`.

## Critério de conclusão

A causa somente será considerada confirmada quando houver:

- baseline funcional de `izaias.santos` no mesmo notebook e build;
- status HTTP do usuário afetado;
- confirmação de acesso web à REP usada;
- confirmação apenas da classe de caracteres da senha, se o resultado for `401`;
- repetição coerente em uma única tentativa controlada.

Após a confirmação, registrar nesta seção a causa, a solução adotada, o responsável por eventual habilitação no GDL e a validação final. Se o comportamento do laWdo for alterado, revisar separadamente `spec/08 gdl/api_gdl.md` para refletir o novo estado atual.
