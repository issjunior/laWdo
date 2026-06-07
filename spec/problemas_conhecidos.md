# Problemas Conhecidos

## 1. Roteamento 404 no Electron (HashRouter vs BrowserRouter) ✅ RESOLVIDO

**Problema:** Ao navegar pelos links do menu lateral, o Electron exibia "404 - Página não encontrada".

**Causa:** O Electron carrega o renderizador via protocolo `file://`. O `BrowserRouter` do React Router depende de um servidor web para resolver as rotas.

**Solução:** Substituir `BrowserRouter` por `HashRouter` em `src/renderer/App.tsx`.

**Status:** ✅ **RESOLVIDO** - Implementado com sucesso

---

## 2. Criptografia Indiscriminada em Campos de Contato ✅ RESOLVIDO

**Problema:** Ao cadastrar ou editar um solicitante, os campos `telefone` e `email` exibiam dados criptografados (base64 extenso) em vez dos valores legíveis.

**Causa:** O serviço `solicitante.service.ts` criptografava todos os campos de entrada indiscriminadamente, mas nunca descriptografava ao recuperar os dados do banco.

**Solução Implementada:**
1. Adicionado método `isEncrypted()` para detectar dados criptografados pelo tamanho e formato base64
2. Adicionado método `decryptFields()` para descriptografar condicionalmente campos
3. Sobreescritos métodos `findAll()`, `findById()` e `update()` para sempre retornar dados descriptografados
4. Definida política clara: **SOMENTE** a senha do perito é criptografada (AES-256-GCM)
5. Campos como `telefone`, `email`, `endereco` são dados operacionais e NÃO devem ser criptografados

**Arquivos alterados:**
- `src/main/services/solicitante.service.ts` (completa reestruturação)
- `src/main/services/user.service.ts` (atualização de comentários)
- `src/renderer/pages/SolicitantesPage.tsx` (correção de operadores `||` para `??`)

**Status:** ✅ **RESOLVIDO** - Criptografia seletiva implementada e testada

**Referência:** Ver `migracao/relatorio_criptografia_solicitantes.md` para detalhes técnicos.

---

## 3. Aviso de Módulo CommonJS no Vite  ⚠️ AVISO

**Problema:** O build do Vite exibe avisos:
```
The CJS build of Vite's Node API is deprecated
Warning: Module type of file:///postcss.config.js is not specified
```

**Causa:** Configuração atual usa módulo CommonJS (CJS), mas o aviso indica migração futura para ES Modules (ESM).

**Status:** ⚠️ **INOFENSIVO** - Pode ser ignorado no momento, pois:
- O build completa com sucesso 1580 módulos transformados
- Aplicação funciona corretamente em produção
- A migração para ESM pode ser feita em sprint futura como melhoria

**Ação Futura:** Adicionar `"type": "module"` ao `package.json` quando oportuno.

---

## 4. Criptografia Manual no Handler de Usuário  ⚠️ TODO

**Problema:** O handler IPC de usuário usa placeholder para criptografia (`Buffer.from(senha).toString('hex')`) em vez de usar `encrypt()` real.

**Status:** ⚠️ **TODO** - Implementação real de criptografia necessária quando setup de chaves estiver completo.

**Referência:** `src/main/ipc/handlers/user.handlers.ts`

---

## 5. Placeholders não substituídos no PDF ✅ RESOLVIDO

**Problema:** Ao gerar o PDF, placeholders inseridos via menu de contexto no TinyMCE apareciam como texto literal (`{{rep_numero}}`) em vez dos valores da REP.

**Causa:** Duas falhas independentes:
1. **Chaves divergentes** — seed do banco usa underscore (`rep_numero`), mapping no código usava ponto (`rep.numero`). Nenhuma chave casava.
2. **Regex frágil** — detecção de spans por regex quebrava com modificações do TinyMCE no HTML (`data-mce-*`, reordenação de atributos).

**Solução:**
1. Adicionadas todas as 19 chaves com underscore ao mapping, alinhando com o seed do sistema
2. Substituído regex por `DOMParser` + `querySelectorAll('span[data-placeholder]')` — opera na árvore DOM, imune a variações estruturais
3. Adicionados placeholders de relacionamento (`solicitante_nome`, `tipo_exame_nome`, `tipo_exame_codigo`) com busca assíncrona

**Status:** ✅ **RESOLVIDO** - Implementado em 10/05/2026

**Referência:** `migracao/placeholder/placeholder-pdf-bug.md` (diagnóstico completo)

---

## Histórico de Problemas Resolução

| Data | Problema | Status | Notas |
|------|----------|--------|-------|
| 10/05/2026 | Placeholders não substituídos no PDF | ✅ RESOLVIDO | Chaves underscore vs ponto + regex frágil; DOMParser + alinhamento |
| 03/05/2026 | Criptografia telefone/email | ✅ RESOLVIDO | Implementada política de criptografia seletiva |
| 03/05/2026 | Roteamento 404 Electron | ✅ RESOLVIDO | MigraçãoBrowserRouter → HashRouter |

