import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, LogIn, Moon, Sun } from 'lucide-react'

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
  CardHeader,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { loginSchema, type LoginInput } from '@/lib/validators/user.schema'
import logo from '@/assets/logo.png'

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

  const savedUsername = localStorage.getItem('lastUsername') || ''

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: savedUsername, senha: '' },
  })

  const handleSubmit = async (data: LoginInput) => {
    await onSubmit(data)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-200 via-indigo-50 to-blue-100 px-4 dark:from-slate-950 dark:via-indigo-950 dark:to-blue-950">
      <FlickeringGrid
        className="absolute inset-0 z-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]"
        squareSize={4}
        gridGap={6}
        color={isDarkMode ? '#4B5563' : '#6B7280'}
        maxOpacity={0.25}
        flickerChance={0.4}
      />
      <div className="relative z-10 w-full max-w-lg">
        <Card className="animate-fade-in border-0 bg-card/70 shadow-[0_8px_32px_rgba(26,85,224,0.12)] backdrop-blur-xl ring-1 ring-primary/20 dark:bg-card/60 dark:shadow-[0_8px_32px_rgba(106,176,255,0.08)]">
          <div className="flex justify-end px-7 pt-5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              className="transition-transform duration-300"
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>

          <CardHeader className="flex flex-col items-center text-center">
            <img
              src={logo}
              alt="laWdo"
              className="mb-4 h-auto w-80 max-w-full object-contain px-2"
            />
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
                          className="border-border/50 bg-muted/40 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/30 dark:bg-muted/20"
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
                            className="border-border/50 bg-muted/40 pr-10 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/30 dark:bg-muted/20"
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

                <Button type="submit" className="group w-full shadow-lg shadow-primary/20 hover:shadow-primary/30" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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
