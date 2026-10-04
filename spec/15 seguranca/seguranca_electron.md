# Segurança Electron e fronteiras locais

## Escopo e fontes de verdade

Esta spec descreve as barreiras entre renderer, preload e main, além da recuperação local após falhas de interface. As fontes canônicas são:

- `src/main/security/index.ts` para permissões, headers e novas janelas;
- `src/main/security/navegacao.ts` e `src/main/index.ts` para políticas de URL e navegação da janela principal;
- `src/main/security/autenticacao.ts` e o handler `login` em `src/main/ipc/index.ts` para validação das credenciais;
- `src/preload/index.ts` e `src/preload/types.ts` para a superfície IPC exposta;
- `src/renderer/lib/usuario-sessao.ts` para a fronteira do `sessionStorage`;
- `src/renderer/components/ErrorBoundary.tsx` para recuperação de falhas fatais do renderer.

## Invariantes da janela Electron

| Frente | Comportamento atual |
|---|---|
| Isolamento | `contextIsolation: true`, `nodeIntegration: false` e `sandbox: true`. |
| Novas janelas | Sempre negadas no Electron. URLs `https:`, `http:` e `mailto:` válidas podem ser encaminhadas ao navegador externo; qualquer outro protocolo é bloqueado e registrado. |
| Navegação principal | Em produção, somente o mesmo arquivo local pode permanecer no frame principal. Em desenvolvimento, somente a mesma origem do servidor configurado é aceita. |
| Permissões | Consultas e solicitações de permissão são negadas por padrão. |
| Site isolation | Nenhum switch desabilita isolamento de site ou `CrossOriginOpenerPolicy`. |

O handler global `web-contents-created` protege também conteúdos criados depois da janela principal. A janela principal adiciona uma barreira própria em `will-navigate`, porque abrir externamente uma URL e permitir que o conteúdo atual navegue são decisões diferentes.

## CSP e headers

Headers de segurança são aplicados somente ao `mainFrame` do laWdo. Subframes do visualizador PDF interno e blobs de PDF preservam seus headers, evitando quebrar o preview.

A CSP ainda permite `'unsafe-inline'` e `'unsafe-eval'` por compatibilidade com o TinyMCE. Essa permissão é uma limitação atual explícita; removê-la exige validação específica do editor e do preview, não apenas alteração textual da política.

## Superfície IPC

O preload expõe somente wrappers específicos incluídos em `ALLOWED_CHANNELS`. Não existe canal genérico para executar SQL: `execute-query`, `window.ipcAPI.executeQuery` e sua validação heurística foram removidos. Consultas ao banco devem permanecer encapsuladas em handlers e serviços de domínio tipados.

Ao adicionar um canal, atualizar em conjunto handler, allowlist, `IpcAPI`, validação de entrada e consumidor. Dados de IPC são fronteira insegura e não devem ser convertidos por cast direto.

## Autenticação

O login é normalizado com `trim`; a senha não é sanitizada nem aparada. Espaços e caracteres especiais fazem parte do segredo e são encaminhados exatamente ao comparador de hash. A fronteira valida tipo, presença e limites de tamanho antes da autenticação.

Logs de autenticação podem conter o login sanitizado e o identificador do usuário, mas nunca a senha. Mensagens de falha devolvidas ao renderer não distinguem usuário inexistente de senha incorreta.

## Sessão do renderer

`lawdo_auth_user` é a única chave canônica do usuário autenticado no `sessionStorage`. O parser recebe `unknown`, exige `id`, `username`, nome e e-mail textuais, valida campos opcionais e mantém somente propriedades conhecidas. `name` e `nome` são normalizados para o mesmo valor por compatibilidade.

JSON malformado, arrays, valores primitivos ou objetos incompatíveis resultam em `null`; quando lidos do storage, o valor inválido é removido. Componentes devem usar `lerUsuarioSessao` e `salvarUsuarioSessao`, sem repetir `JSON.parse` ou assertions locais.

## Recuperação de falhas do renderer

O `ErrorBoundary` tenta `restartApp` e aguarda a Promise. Se a API estiver ausente ou rejeitar, recarrega a janela. A navegação de recuperação usa `#/`, compatível com `HashRouter`.

A limpeza de estado remove somente chaves conhecidas de sessão e preferências de UI. Não usa `localStorage.clear()` nem `sessionStorage.clear()`, para não apagar dados que não participam da falha.

## Verificação

Os comportamentos são protegidos por:

- `src/__tests__/main/autenticacao-security.test.ts`;
- `src/__tests__/main/navegacao-security.test.ts`;
- `src/__tests__/main/security-pdf-preview.test.ts`;
- `src/__tests__/renderer/usuario-sessao.test.ts`;
- `src/__tests__/renderer/error-boundary.component.test.tsx`.

Mudanças nessas fronteiras exigem `type-check`, lint e testes. Alterações de Electron, preload ou empacotamento também exigem build, `pack`, smoke de schema e smoke do executável no Windows.
