# Persistência de janelas desktop

## Fonte de verdade e ciclo

A janela principal é criada em `src/main/index.ts`. O estado local `janela_principal_estado`, na tabela `configuracoes`, é administrado por `src/main/utils/estado-janela-principal.ts`. Ele é salvo com debounce de 300 ms em mover, redimensionar, maximizar, restaurar e no fechamento. Falha de leitura, JSON inválido ou falha de gravação é registrada e não impede a abertura.

Em Windows e Linux, a janela principal usa `titleBarStyle: hidden` com `titleBarOverlay` de 44 px; macOS conserva o comportamento nativo padrão. O renderer pode solicitar apenas as cores da sobreposição pelo canal `janela:atualizar-barra-titulo`. O main ignora outras plataformas e payloads que não contenham duas cores HSL estritas (`cor` e `corSimbolo`), e atualiza somente a janela remetente. Assim, o renderer não recebe controle direto da janela Electron.

O formato ativo é versão 2:

```json
{
  "versao": 2,
  "x": 600, "y": 100, "largura": 1200, "altura": 800,
  "monitorId": 1,
  "areaMonitor": { "x": 0, "y": 0, "largura": 1920, "altura": 1040 },
  "escalaMonitor": 1,
  "maximizada": false
}
```

Ao maximizar, os limites normais são preservados para que restaurar a janela mantenha o tamanho anterior. O estado legado versão 1, sem área e escala do monitor, continua aceito e recebe a normalização absoluta anterior.

## Restauração adaptativa

Com o mesmo `monitorId`, área útil e escala, a janela recupera posição e tamanho absolutos. Quando o monitor não existe ou sua área útil/escala mudou, largura, altura e deslocamento são recalculados proporcionalmente na área útil do monitor escolhido. A escolha prefere o monitor pelo ID, depois pelo ponto salvo e por fim o principal.

Toda restauração limita tamanho a 90% da área útil e aplica mínimos de 1024 x 768, limitando também posição à região visível. Assim, dados vindos de JSON, backup ou uma configuração de outro arranjo de monitores não deixam a janela inacessível. Os limites mínimos podem exceder monitores menores; nesse caso a própria restrição mínima da aplicação prevalece.

O estado é específico do dispositivo, mas pode acompanhar backups por estar em `configuracoes`; a normalização v2 existe justamente para essa portabilidade parcial. Testes em `src/__tests__/main/estado-janela-principal.test.ts` cobrem manutenção absoluta no monitor compatível e transformação proporcional quando o monitor salvo não está disponível.

## Fechamento protegido da janela principal

Enquanto `AlteracoesPendentesProvider` está montado, o preload envia `janela:proteger-fechamento(true)`; o cleanup desativa a proteção. O main aceita somente booleano enviado pelo próprio `webContents` principal. Ao receber `close`, impede o fechamento e envia `janela:solicitar-fechamento`, mantendo no máximo uma solicitação pendente.

O renderer verifica o conteúdo atual e oferece o diálogo compartilhado de saída quando necessário. `janela:confirmar-fechamento` só é aceito da janela principal e com solicitação pendente; autoriza nova chamada a `close`. `janela:cancelar-fechamento` limpa a pendência, permitindo tentar novamente. Listeners e handlers são removidos em `closed`. As APIs ficam em `src/preload/index.ts`; a declaração legada usada pelo renderer também deve ser mantida em `src/renderer/index.tsx`.

Esse protocolo protege a saída normal, não é autosave nem recuperação após crash. Não existe timeout de confirmação no main: um renderer sem resposta pode manter o fechamento bloqueado enquanto a proteção estiver ativa. Janelas destacadas não recebem essa guarda da janela principal. A regra de salvar/descartar pertence a `spec/03 laudo/laudo_ciclo_vida.md`; o handshake de atualização tem contrato próprio.

## Atalhos de desktop na inicialização

Após criar a janela principal, index.ts dispara criarAtalhoDesktopLinux() e criarAtalhoMesaMacOS() sem aguardar. Executam somente na plataforma correspondente, empacotada, fora de root e dos modos LAWDO_SMOKE_SCHEMA, LAWDO_SMOKE_JANELA e LAWDO_TESTE_CARGA. Validam que desktop existe e não resolve para a pasta pessoal. Falhas geram aviso no logger sistema sem impedir abertura.

Linux cria laWdo.desktop para instalação comum ou laWdo-AppImage.desktop quando APPIMAGE está definido. O executável deve ser arquivo absoluto válido; a entrada escapa o caminho e usa ícone copiado de resources/assets/icone-linux.png para userData/integracao-desktop/icone.png. deb.json e appimage.json guardam versão 1 e SHA-256 do conteúdo criado: só um arquivo regular com esse hash pode ser atualizado; arquivo modificado, link ou destino sem registro são preservados. Se o atalho registrado foi apagado, não é recriado. A criação é exclusiva; a atualização revalida o arquivo aberto sem seguir symlink. Aplica modo 0755 e tenta gio metadata::trusted por até 3 s; indisponibilidade pode exigir **Permitir iniciar** no ambiente gráfico.

macOS exige bundle real com estrutura .app/Contents/MacOS dentro de /Applications ou ~/Applications. Cria link simbólico laWdo.app na Mesa, preserva destino existente e registra { versao: 1, criado: true } em userData/integracao-desktop/macos.json. Depois do registro não tenta criar novamente, inclusive se o usuário apagar o link. Não é Finder alias nem atualização de links existentes.

electron-builder.yml inclui logo.png como assets/icone-linux.png. atalho-linux.service.test.ts e atalho-macos.service.test.ts cobrem fluxos simulados; confiança e abertura do lançador real exigem smoke em cada plataforma.
