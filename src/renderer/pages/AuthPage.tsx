import React, { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { FirstUserSetupForm, type FirstUserSetupInput } from '@/components/auth/FirstUserSetupForm'
import { LoginForm } from '@/components/auth/LoginForm'
import { Button } from '@/components/ui/button'
import { FlickeringGrid } from '@/components/ui/flickering-grid'
import type { LoginInput } from '@/lib/validators/user.schema'

interface AuthPageProps {
  onAuthenticated: (user: Record<string, unknown>) => void
}

export function respostaPossuiUsuarios(valor: unknown): boolean {
  if (!valor || typeof valor !== 'object') {
    throw new Error('Resposta inválida ao verificar usuários cadastrados.')
  }

  const resposta = valor as Record<string, unknown>
  if (resposta.success !== true) {
    throw new Error(
      typeof resposta.error === 'string' && resposta.error.trim()
        ? resposta.error
        : 'Não foi possível verificar os usuários cadastrados.'
    )
  }
  if (!Array.isArray(resposta.data)) {
    throw new Error('Resposta inválida ao verificar usuários cadastrados.')
  }

  return resposta.data.length > 0
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthenticated }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')
  const [hasUsers, setHasUsers] = useState<boolean | null>(null)
  const [verificationError, setVerificationError] = useState<string | null>(null)

  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
    }
  }, [isDarkMode])

  const checkUsers = useCallback(async () => {
    setHasUsers(null)
    setVerificationError(null)
    try {
      const result = await window.ipcAPI.user.findActivePeritos()
      setHasUsers(respostaPossuiUsuarios(result))
    } catch (error: unknown) {
      setVerificationError(
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível conectar ao aplicativo para verificar os usuários.'
      )
    }
  }, [])

  useEffect(() => {
    void checkUsers()
  }, [checkUsers])

  const handleToggleTheme = () => {
    const next = !isDarkMode
    setIsDarkMode(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const handleLogin = async (data: LoginInput) => {
    setLoginError(null)
    setLoginLoading(true)
    try {
      const result = await window.ipcAPI.login(data.username, data.senha)
      if (!result?.success || !result?.user) {
        throw new Error(result?.error || 'Credenciais inválidas')
      }
      localStorage.setItem('lastUsername', data.username)
      onAuthenticated(result.user)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setLoginError(message || 'Falha no login')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegisterFirstUser = async (data: FirstUserSetupInput) => {
    setRegisterError(null)
    setRegisterSuccess(null)
    setRegisterLoading(true)
    try {
      const result = await window.ipcAPI.user.create({
        nome: data.nome,
        username: data.username,
        email: data.email,
        senha: data.senha,
        cargo: data.cargo,
        lotacao: data.lotacao,
      })

      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao cadastrar usuário')
      }

      const loginResult = await window.ipcAPI.login(data.username, data.senha)
      if (!loginResult?.success || !loginResult?.user) {
        setRegisterSuccess('Usuário cadastrado com sucesso. Faça login para continuar.')
        setHasUsers(true)
      } else {
        onAuthenticated(loginResult.user)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setRegisterError(message || 'Falha no cadastro inicial')
    } finally {
      setRegisterLoading(false)
    }
  }

  if (verificationError) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-200 via-indigo-50 to-blue-100 p-6 dark:from-slate-950 dark:via-indigo-950 dark:to-blue-950">
        <FlickeringGrid
          className="absolute inset-0 z-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]"
          squareSize={4}
          gridGap={6}
          color={isDarkMode ? '#4B5563' : '#6B7280'}
          maxOpacity={0.25}
          flickerChance={0.4}
        />
        <div className="relative z-10 w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h1 className="text-lg font-semibold text-foreground">Falha ao verificar o cadastro</h1>
          <p className="mt-2 text-sm text-muted-foreground">{verificationError}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Seus dados não foram alterados. Reinicie o aplicativo ou tente novamente.
          </p>
          <Button className="mt-5" onClick={() => void checkUsers()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  if (hasUsers === null) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-200 via-indigo-50 to-blue-100 dark:from-slate-950 dark:via-indigo-950 dark:to-blue-950">
        <FlickeringGrid
          className="absolute inset-0 z-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]"
          squareSize={4}
          gridGap={6}
          color={isDarkMode ? '#4B5563' : '#6B7280'}
          maxOpacity={0.25}
          flickerChance={0.4}
        />
        <div className="relative z-10 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Verificando usuários cadastrados...</span>
        </div>
      </div>
    )
  }

  if (!hasUsers) {
    return (
      <FirstUserSetupForm
        loading={registerLoading}
        error={registerError}
        success={registerSuccess}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        onSubmit={handleRegisterFirstUser}
      />
    )
  }

  return (
    <LoginForm
      loading={loginLoading}
      error={loginError}
      isDarkMode={isDarkMode}
      onToggleTheme={handleToggleTheme}
      onSubmit={handleLogin}
    />
  )
}
