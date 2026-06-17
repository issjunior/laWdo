import React, { useEffect, useState } from 'react'
import { FirstUserSetupForm, type FirstUserSetupInput } from '@/components/auth/FirstUserSetupForm'
import { LoginForm } from '@/components/auth/LoginForm'
import { FlickeringGrid } from '@/components/ui/flickering-grid'
import type { LoginInput } from '@/lib/validators/user.schema'

interface AuthPageProps {
  onAuthenticated: (user: Record<string, unknown>) => void
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthenticated }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')
  const [hasUsers, setHasUsers] = useState<boolean | null>(null)

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

  useEffect(() => {
    const checkUsers = async () => {
      try {
        const result = await window.ipcAPI.user.findActivePeritos()
        const total = Array.isArray(result?.data) ? result.data.length : 0
        setHasUsers(total > 0)
      } catch {
        setHasUsers(true)
      }
    }
    checkUsers()
  }, [])

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

  if (hasUsers === null) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <FlickeringGrid
          className="absolute inset-0 z-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]"
          squareSize={4}
          gridGap={6}
          color={isDarkMode ? '#4B5563' : '#6B7280'}
          maxOpacity={0.3}
          flickerChance={0.1}
        />
        <p className="relative z-10 text-muted-foreground">Verificando usuários cadastrados...</p>
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
