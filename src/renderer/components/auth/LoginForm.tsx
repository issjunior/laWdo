import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FlickeringGrid } from '@/components/ui/flickering-grid'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/forms/form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { loginSchema, type LoginInput } from '@/lib/validators/user.schema'
import logo from '@/assets/logo.jpg'

interface LoginFormProps {
  loading: boolean
  error: string | null
  isDarkMode: boolean
  onToggleTheme: () => void
  onSubmit: (data: LoginInput) => Promise<void>
}

export const LoginForm: React.FC<LoginFormProps> = ({
  loading,
  error,
  isDarkMode,
  onToggleTheme,
  onSubmit,
}) => {
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', senha: '' },
  })

  const handleSubmit = async (data: LoginInput) => {
    await onSubmit(data)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-100 px-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <FlickeringGrid
        className="absolute inset-0 z-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]"
        squareSize={4}
        gridGap={6}
        color={isDarkMode ? '#4B5563' : '#6B7280'}
        maxOpacity={0.3}
        flickerChance={0.1}
      />
      <div className="relative z-10 w-full max-w-md">
        <Card className="shadow-xl backdrop-blur">
          <div className="flex justify-end px-7 pt-5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleTheme}
            >
              {isDarkMode ? 'Tema claro' : 'Tema escuro'}
            </Button>
          </div>

          <CardHeader className="flex flex-col items-center text-center">
            <img
              src={logo}
              alt="laWdo"
              className="mb-4 h-20 w-20 rounded-2xl object-cover shadow-md"
            />
            <CardTitle>Acesso ao laWdo</CardTitle>
            <CardDescription>
              Entre com suas credenciais para acessar o sistema.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuário</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="usuario.perito"
                          autoComplete="username"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="senha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Digite sua senha"
                            autoComplete="current-password"
                            className="pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((p) => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Entrar
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
