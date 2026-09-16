!include "WordFunc.nsh"

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customInit
  ${ifNot} ${isUpdated}
    ReadRegStr $R0 HKCU "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
    ${if} $R0 != ""
      ClearErrors
      ${VersionCompare} "$R0" "${VERSION}" $R1
      ${if} ${Errors}
        MessageBox MB_OK|MB_ICONEXCLAMATION "A versão instalada do laWdo é inválida. A instalação foi interrompida para proteger seus dados. Desinstale a versão atual ou contate o suporte."
        Abort
      ${endif}
      ${if} $R1 == 1
        MessageBox MB_OK|MB_ICONSTOP "Não é possível instalar a versão ${VERSION} porque a versão $R0 já está instalada. O downgrade foi bloqueado para proteger os dados locais."
        Abort
      ${endif}
      ${if} $R1 == 0
        MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "A versão ${VERSION} do laWdo já está instalada. Deseja reparar os arquivos do programa mantendo todos os dados locais?" IDOK +2
        Abort
      ${endif}
    ${endif}
  ${endif}
!macroend

!macro customUnInit
  ${if} ${isUpdated}
    ClearErrors
    ${GetParameters} $R0
    ${GetOptions} $R0 "--delete-app-data" $R1
    ${ifNot} ${Errors}
      DetailPrint "A atualização não permite excluir dados locais."
      Abort
    ${endif}
  ${endif}
!macroend

!macro customUnInstallSection
  Section "un.Excluir todos os dados locais do laWdo (laudos, imagens, credenciais e configurações)" un.excluirDadosLocais
    ${ifNot} ${isUpdated}
      ${if} ${Silent}
        ClearErrors
        ${GetParameters} $R0
        ${GetOptions} $R0 "--delete-app-data" $R1
        ${if} ${Errors}
          DetailPrint "Dados locais preservados no modo silencioso."
          Goto un.excluirDadosLocais_concluida
        ${endif}
      ${endif}

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
