# Fluxo de atualização do aplicativo

## Escopo e relação com GitHub Actions

Esta spec descreve o consumo de atualizações dentro do laWdo: consulta do feed, validação, download, atualização offline, autorização de reinício e instalação. A produção e publicação dos mesmos contratos está documentada em `spec/11 github actions/workflows_github_actions.md`.

```text
spec/11 github actions
  release pública -> manifesto + assinatura -> feed por plataforma
                                            |
                                            v
spec/12 atualizacao
  consulta -> validação Ed25519 -> download -> backup -> instalação
```

Mudanças em manifesto, assinatura, canais, nomes de plataforma, arquitetura, formato, URL ou seleção de assets exigem revisão coordenada das duas specs e dos dois lados do contrato. GitHub Actions é a fonte do artefato publicado; `AtualizacaoService` é a fronteira que volta a tratar todo conteúdo remoto como não confiável.

## Fontes de verdade e contratos

| Responsabilidade | Fonte atual |
|---|---|
| estado, consulta, download, agendamento e instalação | `src/main/services/atualizacao.service.ts` |
| contrato de manifesto, estado e falha | `src/shared/atualizacao/atualizacao.types.ts` |
| chave pública Ed25519 | `src/shared/atualizacao/chave-publica-release.ts` |
| handlers e autorização de reinício | `src/main/ipc/handlers/atualizacao.handlers.ts` |
| canais permitidos e API exposta | `src/preload/index.ts` |
| interface, polling e detalhamento da falha | `src/renderer/components/layout/Header.tsx` |
| alterações pendentes | `src/renderer/contexts/AlteracoesPendentesContext.tsx` |
| processamento de pendência | `src/main/index.ts` |
| backups obrigatórios | `src/main/services/backup-atualizacao.service.ts` |

O singleton `atualizacaoService` mantém o estado canônico em memória. Em `userData` persistem a pendência de instalação, a data da última verificação e os pacotes em `atualizacoes`; o renderer não usa `localStorage` para esses dados.

`EstadoAtualizacaoResposta` expõe `falha` opcional em vez da antiga string `erro`. A estrutura contém código estável, etapa, mensagem amigável, detalhe técnico sanitizado, horário ISO e ação de nova tentativa quando segura. `RespostaAtualizacao` pode repetir a mesma `falha` quando uma pré-condição falha no handler. Assim, `success: false` representa falha da ação solicitada, enquanto `atualizacao:estado` permanece uma leitura bem-sucedida do estado atual.

Os códigos atuais cobrem rede, timeout, serviço ou recurso indisponível, resposta inválida, assinatura, incompatibilidade, download, integridade, armazenamento, backup, alterações pendentes, confirmação, instalador, operação indisponível e erro inesperado. Stack traces, conteúdo remoto, caminhos pessoais e URLs completas não entram no contrato do renderer.

## Estado, concorrência e falhas

Os estados públicos são:

```text
ociosa -> verificando -> disponivel -> baixando -> baixada
                                         |            |
                                         |            +-> instalando -> concluida | falhou
                                         +-> falhou
baixada -> aguardando_reinicio
```

`verificar` recusa nova operação durante verificação, download ou instalação. `baixar` exige atualização disponível; após uma falha de download com pacote remoto ainda selecionado, permite a repetição indicada por `falha.acaoSugerida`. A instalação também pode ser repetida depois de falha recuperável enquanto o pacote validado permanecer disponível.

Falhas capturadas pelo serviço definem `estado: falhou` e armazenam a falha estruturada. Os handlers convertem a conclusão com `falha` em `success: false`; falhas lançadas antes do bloco interno são normalizadas no handler sem expor a mensagem crua. O Header deve observar `success`, `data.estado` e `data.falha`. Uma nova operação ou transição de sucesso limpa a falha anterior.

O serviço publica progresso para janelas não destruídas. O preload valida percentual, etapa e descrição antes de repassar o evento; ele não é log persistente nem mecanismo de retomada.

## Verificação online, validação e download

Após o Electron ficar pronto, uma atualização agendada é processada antes da abertura do banco. Sem pendência, a aplicação agenda verificação automática com atraso aleatório entre 5 e 30 segundos. A verificação automática é limitada a uma vez a cada 24 horas usando `verificadoEm`; a manual ignora o limite.

A URL-base é `https://issjunior.github.io/laWdo/stable`. Para a plataforma e arquitetura atuais, o serviço obtém em paralelo `<plataforma>-<arquitetura>.json` e `.sig`, ambos com timeout de 20 segundos. Falha de DNS, conexão recusada, rede inacessível, `fetch failed` ou timeout é classificada sem assumir se a causa é ausência de internet ou bloqueio de rede. HTTP 404 identifica recurso indisponível; os demais status HTTP identificam indisponibilidade do serviço.

O manifesto remoto é uma fronteira insegura: tipos, SemVer, data, canais, formatos, tamanho, SHA-256, nome simples de arquivo e URL HTTPS são normalizados antes de a serialização canônica ser verificada pela chave Ed25519 embutida. Somente uma versão superior à instalada e com artefato compatível produz `disponivel`. `verificadoEm` só é gravado após todas essas validações.

No download online, o pacote é escrito como `.parcial`, com tamanho e SHA-256 calculados durante o streaming. Apenas um arquivo compatível com o manifesto é renomeado para o nome final e muda o estado para `baixada`. Divergência remove o parcial; outras falhas podem deixá-lo para inspeção ou limpeza posterior. Falha de escrita é classificada como armazenamento indisponível antes da categoria genérica de download.

A atualização offline mantém o mesmo contrato de assinatura, versão, plataforma, arquitetura, tamanho e hash, e converge para `baixada`; o comportamento de falhas estruturadas também se aplica às etapas posteriores de backup e instalação.

## IPC, backup e instalação

Antes da instalação imediata, o main solicita autorização ao mesmo `webContents` por UUID e expira após 15 segundos. Alterações pendentes e expiração possuem mensagens próprias; a autorização não salva nem descarta conteúdo. Depois dela, o backup obrigatório precisa terminar antes de o instalador ser iniciado.

O backup permanece responsabilidade de `BackupAtualizacaoService`. A falha é classificada e apresentada pelo fluxo de atualização, mas não altera sua política de snapshot, backup completo, retenção ou persistência, documentadas em `backup_pre_atualizacao.md`.

Windows/NSIS inicia instalador silencioso e encerra o app; Linux/AppImage substitui e reabre quando executado como AppImage; DEB, DMG e ZIP usam abertura manual pelo sistema. Pacotes locais continuam sendo validados dentro de `userData/atualizacoes` antes de execução ou agendamento.

## Interface e suporte

O Header consulta o estado ao montar e a cada 30 segundos. Falhas automáticas permanecem silenciosas fora do modal; não geram toast nem destaque adicional no ícone. Falhas originadas por ação manual mostram toast com a mensagem amigável.

No modal **Atualizações**, uma `falha` substitui o status de ausência de atualização por **Falha na atualização** e exibe alerta com orientação em português. O usuário pode expandir **Ver detalhes técnicos** para consultar código, etapa e detalhe sanitizado, e usar **Copiar detalhes** para copiar essas informações, o horário e a versão do laWdo. O modal oferece repetição contextual de download ou instalação quando `acaoSugerida` permitir, além da verificação manual sempre disponível.

O processo principal continua responsável por rede, arquivos, assinatura, backup e execução; o renderer apenas apresenta o estado tipado.

## Invariantes e verificação

- Nenhum pacote é instalado sem manifesto assinado e validação local de nome, tamanho e SHA-256.
- Apenas arquivos dentro de `userData/atualizacoes` podem ser executados ou agendados.
- Versão igual ou inferior à instalada não é aceita.
- Backup pré-atualização é obrigatório antes de instalar.
- Detalhes apresentados ao usuário não podem expor stack trace, conteúdo remoto, caminhos pessoais ou URLs completas.
- Alterações em canais, manifesto, chave ou formatos exigem revisão coordenada com `spec/11 github actions/workflows_github_actions.md`.

`src/__tests__/main/atualizacao.service.test.ts` cobre estado inicial, HTTP ausente, falha de rede amigável, download válido, persistência da última verificação e agendamento validado. `src/__tests__/renderer/header-atualizacao.component.test.tsx` cobre o resumo amigável, detalhes inicialmente recolhidos e disponibilidade da cópia. Permanecem sem cobertura ponta a ponta timeout real, autorização IPC, instalação por processo, AppImage real e ciclo entre release publicada e aplicativo.
