# Reformulação de Logs — Plano de Implementação

> **Para agentes:** Use superpowers:subagent-driven-development ou superpowers:executing-plans para implementar tarefa por tarefa. Passos usam checkbox (`- [ ]`) para tracking.

**Objetivo:** Reduzir verbosidade, enriquecer erros, padronizar datas BR, corrigir backup/restauração de auditoria e tornar mensagens da trilha REP/Laudo amigáveis ao perito.

**Arquitetura:** Híbrida mantida — Winston JSON (warn+) para sistema, SQLite `logs_auditoria` para rastreabilidade. Mudanças cirúrgicas: thresholds, remoção de infos poluentes, enriquecimento de mensagens de erro, timestamp brasileiro.

**Tech Stack:** TypeScript, Winston, SQLite, React 18, shadcn/ui

**Design doc:** `spec/07 logs/reformulacao-logs-design.md`

**Nota:** Os botões de timeline/histórico em REPsPage e LaudosPage já existem e funcionam — não precisam ser implementados.

---

### Task 1: Logger — Thresholds + Timestamp Brasileiro

**Files:**
- Modify: `src/main/utils/logger.ts`

- [ ] **Step 1: Ajustar thresholds padrão**

No `logger.ts`, alterar `DEFAULT_LEVELS` — todos os módulos sobem para `'warn'`, exceto `ia` (`'debug'`):

```typescript
const DEFAULT_LEVELS: Partial<Record<LogModule, LogLevel>> = {
  database: 'warn',
  auth: 'warn',
  renderer: 'warn',
  ilustracao: 'warn',
  ia: 'debug',
  sistema: 'warn',
  rep: 'warn',
  laudo: 'warn',
  template: 'warn',
  solicitante: 'warn',
  tipo_exame: 'warn',
  placeholder: 'warn',
  backup: 'warn',
  configuracao: 'warn',
  ipc: 'warn',
  security: 'warn',
  wizard: 'warn',
  peca: 'warn',
  'regra-wizard': 'warn',
  gdl: 'warn',
  exportacao: 'warn',
};
```

- [ ] **Step 2: Alterar timestamp para formato brasileiro**

No `fileFormat` (linha ~47):

```typescript
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'DD/MM/YY HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);
```

No `consoleFormat` (linha ~53):

```typescript
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'DD/MM/YY HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, module, message, duration, ...rest }) => {
    // ... resto mantido igual
  }),
);
```

- [ ] **Step 3: Mover `setupLogging` info para debug**

Trocar `logInfo` por `logDebug` nas mensagens de inicialização (linha ~181):

```typescript
export const setupLogging = () => {
  logDebug('Sistema de logs inicializado', {
    logsDir: LOGS_DIR,
    nodeEnv: process.env.NODE_ENV,
    appVersion: app.getVersion(),
  });
  // ... resto mantido (uncaughtException, unhandledRejection continuam com error)
};
```

- [ ] **Step 4: Mover `clearAllLogs` info para debug**

Na função `clearAllLogs` (linha ~277), trocar `logInfo` por `logDebug`:

```typescript
logDebug('Logs do sistema limpos pelo usuário');
```

- [ ] **Step 5: Mover `cleanupOldLogs` info para debug**

Na função `cleanupOldLogs` (linha ~308), trocar `logInfo` por `logDebug`:

```typescript
logDebug(`Log antigo removido: ${file}`);
```

- [ ] **Step 6: Commit**

```bash
git add src/main/utils/logger.ts
git commit -m "ajuste_logger_thresholds_warn_timestamp_br"
```

---

### Task 2: BaseService — Remover Logs Info de CRUD

**Files:**
- Modify: `src/main/services/base.service.ts`

- [ ] **Step 1: Remover `log.info` dos métodos create, update, delete**

Em `base.service.ts`, remover as 3 chamadas `log.info()`:

**Método `create` (linha ~117)**: Remover completamente:
```typescript
log.info(`${this.tableName} criado`, { id });
```

**Método `update` (linha ~153)**: Remover completamente:
```typescript
log.info(`${this.tableName} atualizado`, { id });
```

**Método `delete` (linha ~174)**: Remover completamente:
```typescript
log.info(`${this.tableName} excluído`, { id });
```

Manter os `log.error()` em todos os métodos (erros continuam sendo logados).

- [ ] **Step 2: Commit**

```bash
git add src/main/services/base.service.ts
git commit -m "ajuste_remove_info_crud_baseservice"
```

---

### Task 3: Database — Migrations e Conexão para Debug

**Files:**
- Modify: `src/main/database/index.ts`
- Modify: `src/main/database/sqlite.ts`

- [ ] **Step 1: database/index.ts — trocar ~40 `log.info` por `log.debug`**

No arquivo `src/main/database/index.ts`, buscar todas as ocorrências de `log.info(` e substituir por `log.debug(`.

A lista completa de mensagens a alterar:
- Linha 30: `Diretório de dados criado`
- Linha 37: `Diretório de imagens criado`
- Linha 44: `Banco de dados não encontrado. Criando novo`
- Linha 48: `Banco de dados encontrado`
- Linha 55: `Banco de dados inicializado com sucesso`
- Linha 66: `Criando schema inicial`
- Linha 294: `Schema inicial criado com sucesso`
- Linha 306: `Schema version definida`
- Linha 331: `Aplicando migrations`
- Linha 337: `Migrations aplicadas com sucesso`
- Linha 339: `Schema está atualizado`
- Linhas 367-1364: Todas as mensagens de migration individuais
- Linha 1633: `Aplicadas migrations da versão`
- Linha 1643: `Teste de conexão com banco de dados: OK`
- Linha 1667: `Backup criado`
- Linha 1688: `Backup pré-restauração criado`
- Linha 1693: `Banco de dados restaurado`
- Linha 1706: `Verificação de integridade`

Usar replaceAll ou fazer as trocas uma a uma. **ATENÇÃO**: NÃO trocar `log.error(` — apenas `log.info(`.

- [ ] **Step 2: database/sqlite.ts — trocar `log.info` por `log.debug`**

No arquivo `src/main/database/sqlite.ts`, trocar `log.info(` por `log.debug(`:
- Linha 28: `Diretório de dados criado`
- Linha 31: `Conectando ao banco de dados`
- Linha 48: `Conexão com SQLite estabelecida com sucesso`
- Linha 65: `Conexão com banco de dados fechada`
- Linha 241: `Backup criado`

- [ ] **Step 3: Commit**

```bash
git add src/main/database/index.ts src/main/database/sqlite.ts
git commit -m "ajuste_database_logs_debug"
```

---

### Task 4: IPC Index — Handlers para Debug

**Files:**
- Modify: `src/main/ipc/index.ts`

- [ ] **Step 1: Trocar `log.info` por `log.debug` em mensagens de sistema**

Mensagens a alterar (`log.info` → `log.debug`):
- Linha 43: `'Registrando handlers IPC...'`
- Linha 82: `'Handlers IPC registrados com sucesso'`
- Linha 167: `'Reiniciando aplicativo...'`
- Linha 180: `'DevTools abertos'`
- Linha 186: `'Fechando aplicativo...'`

**NÃO alterar**:
- Linha 258: `Tentativa de login` — esta é de auditoria/auth
- Linha 262: `Login bem-sucedido` — esta é de auditoria
- Linha 297: `Logout solicitado` — esta é de auditoria

- [ ] **Step 2: Commit**

```bash
git add src/main/ipc/index.ts
git commit -m "ajuste_ipc_handlers_debug"
```

---

### Task 5: GDL — Enriquecer Mensagens de Erro

**Files:**
- Modify: `src/main/services/gdl.service.ts`
- Modify: `src/main/ipc/handlers/gdl.handlers.ts`

- [ ] **Step 1: gdl.service.ts — erro de conexão com ambiente**

No método `testarConexao`, no bloco `catch` (linha ~173), a variável `ambienteLabel` está fora de escopo. Mover sua declaração para antes do `try` e enriquecer a mensagem:

```typescript
export async function testarConexao(ambiente: string): Promise<GdlTesteResultado> {
  const inicio = Date.now();
  const amb = ambiente || 'homologacao';
  const ambienteLabel = amb === 'producao' ? 'Produção' : 'Homologação';
  try {
    const creds = await carregarCredenciais(amb);
    // ... resto do try mantido ...
  } catch (err) {
    const latencia = Date.now() - inicio;
    const mensagem = err instanceof Error ? err.message : String(err);
    log.error(`Falha no teste de conexão GDL em ambiente ${ambienteLabel}`, {
      erro: mensagem,
      latencia,
      endpoint: endpointTeste,
    });
    return {
      sucesso: false,
      latencia,
      statusCode: 0,
      autenticado: false,
      ambiente: ambienteLabel,
      endpointTestado: endpointTeste,
      erro: mensagem,
    };
  }
}
```

Nota: `endpointTeste` também precisa ser declarado antes do `try` para estar disponível no `catch`.

- [ ] **Step 2: gdl.service.ts — erro de consulta REP**

No método `consultarRep`, bloco `catch` (linha ~232), adicionar o ambiente à mensagem:

```typescript
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    const ambiente = (await configuracaoService.obter('gdl_ambiente').catch(() => 'homologacao')) || 'homologacao';
    const ambLabel = ambiente === 'producao' ? 'Produção' : 'Homologação';
    log.error(`Falha ao consultar REP ${numero}/${ano} no GDL (${ambLabel})`, {
      erro: mensagem,
      numero,
      ano,
    });
    return { sucesso: false, dados: null, erro: mensagem };
  }
```

- [ ] **Step 3: gdl.handlers.ts — handler testar-conexao**

Enriquecer a mensagem de erro no handler (linha ~12):

```typescript
ipcMain.handle('gdl:testar-conexao', async (_event, ambiente: string) => {
  try {
    const resultado = await gdlService.testarConexao(ambiente || 'homologacao');
    return { success: true, data: resultado };
  } catch (error) {
    const amb = ambiente || 'homologacao';
    const ambLabel = amb === 'producao' ? 'Produção' : 'Homologação';
    logError(`Falha ao testar conexão GDL em ambiente ${ambLabel}`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao testar conexão GDL',
    };
  }
});
```

- [ ] **Step 4: gdl.handlers.ts — handler consultar-rep**

Enriquecer a mensagem de erro no handler (linha ~33):

```typescript
ipcMain.handle('gdl:consultar-rep', async (_event, numero: string, ano: string) => {
  try {
    // ... validação mantida ...
  } catch (error) {
    logError(`Falha ao consultar REP ${numero}/${ano} no GDL`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao consultar REP',
    };
  }
});
```

- [ ] **Step 5: Commit**

```bash
git add src/main/services/gdl.service.ts src/main/ipc/handlers/gdl.handlers.ts
git commit -m "ajuste_gdl_enriquecer_erros"
```

---

### Task 6: REP Handlers — Mensagens Amigáveis + Enriquecer Erros

**Files:**
- Modify: `src/main/ipc/handlers/rep.handlers.ts`

- [ ] **Step 1: Mensagem de criação de REP**

Linha 57-60. Trocar a mensagem de auditoria:

```typescript
auditCicloVida('', 'rep', rep.id, 'criacao', `Requisição ${data.numero} registrada`, null, {
  numero: data.numero, status: 'Pendente',
  solicitante_id: data.solicitante_id, tipo_exame_id: data.tipo_exame_id,
});
```

- [ ] **Step 2: Mensagem de laudo criado automaticamente**

Linha 71-75. Trocar:

```typescript
auditCicloVida('', 'laudo', rep.id, 'criacao',
  `Laudo da Requisição ${data.numero} iniciado automaticamente`,
  null,
  { rep_id: rep.id, perito_id: data.perito_id, template_id: data.template_id },
);
```

- [ ] **Step 3: Mensagem de transição de status da REP**

Linha 172-176. Trocar:

```typescript
auditCicloVida('', 'rep', id, 'transicao_status',
  `Requisição ${repAntes?.numero ?? id}: ${statusAnterior ?? '?'} → ${sanitizedData.status}`,
  { status: statusAnterior },
  { status: sanitizedData.status },
);
```

- [ ] **Step 4: Mensagem de laudo criado na atualização da REP**

Linha 190-194. Trocar:

```typescript
auditCicloVida('', 'laudo', id, 'criacao',
  `Laudo da Requisição ${repAntes?.numero ?? id} iniciado automaticamente`,
  null,
  { rep_id: id, perito_id: data.perito_id, template_id: data.template_id },
);
```

- [ ] **Step 5: Mensagem de exclusão de REP**

Linha 232. Trocar:

```typescript
auditDelete('', 'reps', id, `Requisição ${rep?.numero ?? id} removida`);
```

- [ ] **Step 6: Mensagem de transição de status (updateStatus)**

Linha 257-261. Trocar:

```typescript
auditCicloVida('', 'rep', id, 'transicao_status',
  `Requisição ${repAntes?.numero ?? id}: ${statusAnterior ?? '?'} → ${status}`,
  statusAnterior ? { status: statusAnterior } : null,
  { status },
);
```

- [ ] **Step 7: Enriquecer mensagens de erro nos handlers**

Trocar `logError` com mensagens genéricas para incluir contexto:

```typescript
// rep:create catch (linha 83)
logError('Erro ao criar Requisição', { numero: data.numero, error });

// rep:findAll catch (linha 99)
logError('Erro ao buscar Requisições', error);

// rep:findById catch (linha 117)
logError('Erro ao buscar Requisição por ID', { id, error });

// rep:findByNumero catch (linha 132)
logError('Erro ao buscar Requisição por número', { numero, error });

// rep:update catch (linha 211)
logError('Erro ao atualizar Requisição', { id, numero: repAntes?.numero, error });

// rep:delete catch (linha 235)
logError('Erro ao excluir Requisição', { id, numero: rep?.numero, error });

// rep:updateStatus catch (linha 265)
logError('Erro ao atualizar status da Requisição', { id, numero: repAntes?.numero, status, error });
```

- [ ] **Step 8: Commit**

```bash
git add src/main/ipc/handlers/rep.handlers.ts
git commit -m "ajuste_rep_handlers_mensagens_amigaveis_erros"
```

---

### Task 7: Laudo Handlers — Mensagens Amigáveis + Buscar Nº REP

**Files:**
- Modify: `src/main/ipc/handlers/laudo.handlers.ts`
- Import necessário: `import { repService } from '../../services/rep.service.js';` (já existe)

- [ ] **Step 1: Mensagem de atualização de conteúdo**

Linha 85-89. Buscar o número da REP antes de logar:

```typescript
ipcMain.handle('laudo:updateConteudo', async (_event, laudoId: string, conteudo: string) => {
  try {
    // ... validação mantida ...
    const laudo = await laudoService.updateConteudo(laudoId, conteudo);

    const rep = await repService.findById(laudo.rep_id);
    const repNumero = rep?.numero ?? laudo.rep_id;

    auditCicloVida('', 'laudo', laudoId, 'atualizacao',
      `Laudo da Requisição ${repNumero} salvo (versão ${laudo?.versao ?? '?'})`,
      null,
      { versao: laudo?.versao },
    );

    return { success: true, data: laudo };
  } catch (error) {
    logError('Erro ao salvar conteúdo do laudo', { laudoId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
});
```

- [ ] **Step 2: Mensagem de criação de laudo**

Linha 116-120. Buscar número da REP:

```typescript
const rep = await repService.findById(data.rep_id);
const repNumero = rep?.numero ?? data.rep_id;

auditCicloVida('', 'laudo', laudo.id, 'criacao',
  `Laudo da Requisição ${repNumero} iniciado`,
  null,
  { rep_id: data.rep_id, perito_id: data.perito_id, template_id: data.template_id, status: 'Em andamento', versao: 1 },
);
```

- [ ] **Step 3: Mensagem de exclusão de laudo**

Linha 189-196. Buscar número da REP:

```typescript
const rep = await repService.findById(rep_id);
const repNumero = rep?.numero ?? rep_id;
const uid = userId || '';
logDebug('Laudo excluído e Requisição resetada para Pendente', { laudoId, repId: rep_id, status: statusAnterior });
auditDelete(uid, 'laudos', laudoId,
  `Laudo da Requisição ${repNumero} excluído. Requisição ${repNumero} voltou a Pendente`);
auditCicloVida(uid, 'rep', rep_id, 'transicao_status',
  `Requisição ${repNumero} voltou a Pendente`,
  { status: statusAnterior },
  { status: 'Pendente', motivo: 'laudo_excluido' },
);
```

Nota: trocar `logInfo` por `logDebug` na linha 188.

- [ ] **Step 4: Mensagem de transição de status do laudo**

Linha 224-228. Buscar número da REP:

```typescript
const rep = await repService.findById(laudoAntes.rep_id);
const repNumero = rep?.numero ?? laudoAntes.rep_id;

auditCicloVida('', 'laudo', laudoId, 'transicao_status',
  `Laudo da Requisição ${repNumero}: ${statusAnterior ?? '?'} → ${novoStatus}`,
  { status: statusAnterior, data_conclusao: laudoAntes.data_conclusao, data_entrega: laudoAntes.data_entrega },
  { status: novoStatus, data_conclusao: laudo.data_conclusao, data_entrega: laudo.data_entrega },
);
```

- [ ] **Step 5: Enriquecer mensagens de erro nos handlers de laudo**

```typescript
// laudo:findById catch (linha 21)
logError('Erro ao buscar laudo por ID', { id, error });

// laudo:findByRepId catch (linha 35)
logError('Erro ao buscar laudo da Requisição', { repId, error });

// laudo:findAll catch (linha 68)
logError('Erro ao buscar todos os laudos', error);

// laudo:create catch (linha 124)
logError('Erro ao criar laudo para Requisição', { rep_id: data.rep_id, error });

// laudo:gerarWizard catch (linha 140)
logError('Erro ao gerar laudo pelo assistente', { laudo_id: params.laudo_id, error });

// laudo:salvarProgressoWizard catch (linha 153)
logError('Erro ao salvar progresso do assistente', { laudoId, error });

// laudo:delete catch (linha 199)
logError('Erro ao excluir laudo', { laudoId, error });

// laudo:updateStatus catch (linha 232)
logError('Erro ao atualizar status do laudo', { laudoId, novoStatus, error });

// laudo:exportar catch (linha 258)
logError('Erro ao exportar laudo', { laudoId: params.laudoId, formato: params.formato, error });
```

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/handlers/laudo.handlers.ts
git commit -m "ajuste_laudo_handlers_mensagens_amigaveis_erros"
```

---

### Task 8: REP e Laudo Services — Enriquecer Erros

**Files:**
- Modify: `src/main/services/rep.service.ts`
- Modify: `src/main/services/laudo.service.ts`

- [ ] **Step 1: rep.service.ts — mensagens de erro com contexto**

Alterar as mensagens de `log.error`:

```typescript
// findAllOrdered (linha 24)
log.error('Erro ao buscar Requisições ordenadas', error);

// findByStatus (linha 38)
log.error('Erro ao buscar Requisições por status', { status, error });

// findByNumero (linha 52)
log.error('Erro ao buscar Requisição por número', { numero, error });

// updateStatus (linha 66)
log.error('Erro ao atualizar status da Requisição', { id, status, error });
```

- [ ] **Step 2: laudo.service.ts — mensagens de erro com contexto**

```typescript
// criarLaudoInicial (linha 68)
log.error('Erro ao criar laudo para Requisição', { repId: params.rep_id, error });

// findByRepId (linha 81)
log.error('Erro ao buscar laudo da Requisição', { repId, error });

// findAllByRepId (linha 93)
log.error('Erro ao buscar laudos da Requisição', { repId, error });

// findAllComRep (linha 132)
log.error('Erro ao buscar laudos com Requisições', error);

// updateConteudo (linha 148)
log.error('Erro ao salvar conteúdo do laudo', { id, error });

// updateStatus (linha 180)
log.error('Erro ao atualizar status do laudo', { id, status, error });

// deletarPorRepId (linha 197)
log.error('Erro ao excluir laudos da Requisição', { repId, error });

// deletar (linha 219)
log.error('Erro ao excluir laudo', { laudoId, error });
```

- [ ] **Step 3: Commit**

```bash
git add src/main/services/rep.service.ts src/main/services/laudo.service.ts
git commit -m "ajuste_rep_laudo_services_erros"
```

---

### Task 9: Backup Service — Debug + Filtro de Auditoria

**Files:**
- Modify: `src/main/services/backup.service.ts`

- [ ] **Step 1: Trocar `log.info` por `log.debug` nos passos de backup**

Todas as mensagens `log.info` nos métodos de backup/restauração devem virar `log.debug`:
- Linha 30: `'Cópia temporária do banco criada para limpeza de auditoria'`
- Linha 38: `'Registros de auditoria removidos da cópia de backup'`
- Linha 48: `'Banco de dados (sem auditoria) adicionado ao ZIP de backup'`
- Linha 53: `'Pasta de imagens adicionada ao ZIP de backup'`
- Linha 55: `'Pasta de imagens não existe'`
- Linha 65: `'Backup ZIP criado com sucesso'`
- Linha 100: `'Pré-backup do estado atual criado'`
- Linha 104: `'Conexão com banco de dados fechada para restauração'`
- Linha 110: `'Backup extraído para diretório temporário'`
- Linha 116: `'Banco de dados substituído'`
- Linha 127: `'Pasta de imagens substituída'`
- Linha 132: `'Diretório temporário de restauração removido'`

- [ ] **Step 2: Alterar DELETE para filtrar só não-REP/Laudo**

Localizar a linha com `DELETE FROM logs_auditoria` (no método de backup) e trocar para:

```typescript
await executeNonQuery(
  "DELETE FROM logs_auditoria WHERE modulo NOT IN ('rep', 'laudo')",
);
```

E atualizar a mensagem de debug correspondente:

```typescript
log.debug('Registros de auditoria (exceto REPs e Laudos) removidos da cópia de backup');
```

- [ ] **Step 3: Commit**

```bash
git add src/main/services/backup.service.ts
git commit -m "ajuste_backup_debug_filtro_auditoria"
```

---

### Task 10: LogsPage — Formatar Timestamp com Ano 2 Dígitos

**Files:**
- Modify: `src/renderer/pages/LogsPage.tsx`

- [ ] **Step 1: Ajustar `formatarTimestamp` para DD/MM/AA**

Na função `formatarTimestamp` (linha ~130), garantir que o ano seja 2 dígitos e o formato seja `DD/MM/AA HH:mm:ss`:

```typescript
const formatarTimestamp = (ts: string): string => {
  if (!ts) return '';
  const [dataPart, horaPart] = ts.split(' ');
  if (!dataPart) return ts;
  const partes = dataPart.split('-');
  if (partes.length !== 3) {
    // Tenta split por '/' (formato já brasileiro)
    const partesBR = dataPart.split('/');
    if (partesBR.length === 3) {
      const [dia, mes, ano] = partesBR;
      const anoCurto = (ano ?? '').slice(-2);
      const hora = horaPart ? ` ${horaPart}` : '';
      return `${dia}/${mes}/${anoCurto}${hora}`;
    }
    return ts;
  }
  const [ano, mes, dia] = partes;
  const anoCurto = (ano ?? '').slice(-2);
  const hora = horaPart ? ` ${horaPart}` : '';
  return `${dia}/${mes}/${anoCurto}${hora}`;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/pages/LogsPage.tsx
git commit -m "ajuste_logspage_timestamp_dd_mm_aa"
```

---

### Task 11: Demais Serviços/Handlers — Revisar e Enriquecer Erros

**Files:**
- Modify: `src/main/ipc/handlers/importacao.handlers.ts`
- Modify: `src/main/ipc/handlers/exportacao.handlers.ts` (se existir)
- Modify: `src/main/ipc/handlers/backup.handlers.ts`
- Modify: `src/main/ipc/handlers/template.handlers.ts`
- Modify: `src/main/ipc/handlers/placeholder.handlers.ts`
- Modify: `src/main/ipc/handlers/solicitante.handlers.ts`
- Modify: `src/main/ipc/handlers/tipo-exame.handlers.ts`
- Modify: `src/main/ipc/handlers/user.handlers.ts`
- Modify: `src/main/ipc/handlers/ia.handlers.ts`
- Modify: `src/main/ipc/handlers/ilustracoes.handlers.ts`
- Modify: `src/main/ipc/handlers/wizard.handlers.ts`
- Modify: `src/main/ipc/handlers/configuracao.handlers.ts`
- Modify: `src/main/services/exportacao.service.ts`

- [ ] **Step 1: Revisar cada handler — adicionar contexto em `logError`**

Para cada handler listado acima, revisar as chamadas `logError` e garantir que incluam o identificador da entidade na mensagem. Exemplos de ajuste:

```typescript
// Antes:
logError('Erro ao buscar templates', error);
// Depois:
logError('Erro ao buscar templates', error); // já ok, sem entidade específica

// Antes:
logError('Erro ao excluir template', { id, error });
// Depois:
logError('Erro ao excluir template', { id, error }); // já ok

// Antes:
logError('Erro no handler backup:criar', error);
// Depois:
logError('Falha ao criar backup', error);
```

Regra: se a mensagem já contém o ID ou nome da entidade no `meta`, está ok. Se não, adicionar.

- [ ] **Step 2: Substituir `logInfo` residuais por `logDebug` nos handlers**

Buscar `logInfo(` nos handlers listados e verificar se são mensagens operacionais que devem ser `debug`:

```typescript
// Exemplo no backup.handlers.ts:
logDebug('Backup criado com sucesso', { destino });
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/handlers/ src/main/services/exportacao.service.ts
git commit -m "ajuste_handlers_servicos_enriquecer_erros"
```

---

### Task 12: Verificação — Type-Check + Lint

- [ ] **Step 1: Rodar type-check**

```bash
npm run type-check
```

Corrigir quaisquer erros de tipo que surgirem.

- [ ] **Step 2: Rodar lint**

```bash
npm run lint
```

Corrigir warnings/errors.

- [ ] **Step 3: Commit (se houver correções)**

```bash
git add -A
git commit -m "correcao_typecheck_lint_reformulacao_logs"
```

---

### Task 13: Testes

- [ ] **Step 1: Rodar testes**

```bash
npm test
```

Verificar se todos passam.

- [ ] **Step 2: Se houver falhas, corrigir**

Testes que mockam `logInfo`/`logError` podem precisar de ajuste se as mensagens mudaram.

- [ ] **Step 3: Commit (se houver correções)**

```bash
git add -A
git commit -m "correcao_testes_reformulacao_logs"
```

---

### Task 14: Atualizar Spec

**Files:**
- Modify: `spec/07 logs/logs.md`

- [ ] **Step 1: Atualizar spec com o novo estado**

Editar `spec/07 logs/logs.md` para refletir:
- Thresholds padrão `warn` (seção "Níveis de Log por Módulo")
- Timestamp brasileiro (seção "Arquivos de log")
- Filtro de auditoria no backup (`WHERE modulo NOT IN ('rep','laudo')`)
- Mensagens amigáveis na trilha (seção "Eventos de Ciclo de Vida Rastreados")
- Remoção de infos do BaseService

- [ ] **Step 2: Commit**

```bash
git add spec/07\ logs/logs.md
git commit -m "update_spec_logs_reformulacao"
```
