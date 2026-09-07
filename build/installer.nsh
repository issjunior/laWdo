!macro customUnInstallSection
  Section /o "Excluir todos os dados locais do laWdo" un.excluirDadosLocais
    ${ifNot} ${isUpdated}
      MessageBox MB_YESNO|MB_ICONEXCLAMATION "Esta ação exclui permanentemente laudos, imagens, configurações, credenciais locais, logs e arquivos de atualização do laWdo.$\r$\n$\r$\nDeseja continuar?" IDYES un.excluirDadosLocais_confirmada
      DetailPrint "Dados locais preservados pelo usuário."
      Goto un.excluirDadosLocais_concluida

      un.excluirDadosLocais_confirmada:
      ${if} $installMode == "all"
        SetShellVarContext current
      ${endif}

      RMDir /r "$APPDATA\laWdo"
      RMDir /r "$APPDATA\laudo-pericial-electron"

      ${if} $installMode == "all"
        SetShellVarContext all
      ${endif}
      DetailPrint "Todos os dados locais do laWdo foram excluídos."

      un.excluirDadosLocais_concluida:
    ${endif}
  SectionEnd
!macroend
