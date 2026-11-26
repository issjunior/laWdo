# Plano de assinatura do instalador Windows do laWdo

## Objetivo e decisão

Permitir que cada perito confira no Windows quem publicou o instalador antes da primeira execução. A proposta é assinar o instalador NSIS x64 com Authenticode no acionamento de release que o desenvolvedor já utiliza. A assinatura deve ser automática, inclusive nas releases seguintes.

Hoje o job `build-windows` calcula o SHA-256 do instalador e exige o estado `NotSigned`. Depois, o fluxo publica o instalador e gera um manifesto assinado. O manifesto atende ao mecanismo de atualização do laWdo. O Authenticode permitirá ao próprio Windows identificar o editor já no primeiro download. A mudança se limita à distribuição Windows e independe da credencial OAuth do Google Drive.

## Preparação única

1. Confirmar quem está autorizado a figurar como editor e registrar o nome certificado que o perito deverá conferir. Usar o nome da instituição exige autorização para assinar em seu nome.
2. Provisionar uma identidade de assinatura de código cuja cadeia seja confiável nos computadores dos peritos. Selecionar um serviço compatível com o titular e seu país, com chave privada não exportável e assinatura automatizada no runner Windows. A escolha do provedor depende dessa confirmação de titularidade e disponibilidade.
3. Autorizar somente o job de release Windows a usar o perfil de assinatura, limitado ao repositório e ao ambiente `release` restrito à `main`. Preferir autenticação federada de curta duração quando suportada. Configurar separadamente a identidade esperada do editor para validar o resultado e registrar o procedimento de renovação ou revogação em caso de comprometimento.

## Alteração no fluxo de release

1. Integrar a assinatura ao empacotamento Windows em `electron-builder.yml` e em `.github/workflows/release.yml`. Assinar o executável do aplicativo antes de montar o pacote e o instalador final antes da geração de `.exe.blockmap` e `latest.yml`. Usar SHA-256 e carimbo de tempo confiável RFC 3161. Ativar a exigência de assinatura apenas na distribuição oficial para permitir builds e testes locais sem acesso à identidade de produção.
2. No job `build-windows`, substituir a exigência de `NotSigned` por uma verificação de assinatura válida, editor autorizado e carimbo de tempo. Conferir o executável principal em `win-unpacked` e o arquivo exato `laWdo-Setup-<versão>-x64.exe` que seguirá para publicação. Qualquer falha de assinatura ou de verificação deve encerrar o job antes do envio de artefatos.
3. Calcular o SHA-256 sobre o instalador final assinado. Entregar esses mesmos bytes ao fluxo existente de manifesto e promoção. Preservar o acionamento único da release e os checks atuais, sem adicionar aprovação manual por versão.
4. Informar nas instruções de download o canal oficial, o nome esperado do editor e onde conferi-lo nas propriedades do arquivo, na aba **Assinaturas Digitais**. Orientar o perito a interromper a instalação se a assinatura estiver ausente, inválida ou em nome de outro editor. O SmartScreen ainda pode exibir aviso de reputação para uma versão nova.

## Validação e critério de liberação

- Após estabilizar a implementação, validar o verificador com um executável assinado pelo editor esperado e com amostras de teste sem assinatura, alteradas após a assinatura e assinadas por outro editor. Confirmar também a rejeição de assinatura sem carimbo de tempo. Usar identidade de teste nos cenários automatizados de PR.
- Na primeira release candidata, baixar o instalador do rascunho e conferir em Windows limpo a validade da assinatura, o editor exibido e a instalação. Comparar o SHA-256 do download com o manifesto assinado e verificar que os metadados de atualização correspondem ao pacote final. Exercitar a atualização a partir da versão publicada anterior.
- Promover a candidata pelo fluxo habitual após essas verificações. Nas releases seguintes, a validação automática do job deve impedir a publicação da versão Windows quando o serviço de assinatura estiver indisponível ou o editor divergir.

Referências para implementação e orientação aos peritos. [Opções de assinatura no Windows](https://learn.microsoft.com/windows/apps/package-and-deploy/code-signing-options) · [Reputação do instalador no SmartScreen](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation)
