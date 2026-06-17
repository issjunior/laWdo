import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Moon, Sun, UserPlus } from 'lucide-react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import logo from '@/assets/logo.jpg'

const firstUserSchema = z
  .object({
    nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    username: z
      .string()
      .min(3, 'Nome de usuário deve ter pelo menos 3 caracteres')
      .regex(
        /^[a-zA-Z0-9._-]+$/,
        'Use apenas letras, números, ponto, underline e hífen',
      ),
    email: z.string().email('E-mail inválido'),
    cargo: z.enum([
      'Perito Oficial Criminal',
      'Técnico de Perícia Oficial',
    ]),
    lotacao: z.string().min(3, 'Lotação deve ter pelo menos 3 caracteres'),
    senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
    confirmarSenha: z.string(),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: 'Senhas não conferem',
    path: ['confirmarSenha'],
  })

export type FirstUserSetupInput = z.infer<typeof firstUserSchema>

interface FirstUserSetupFormProps {
  loading: boolean
  error: string | null
  success: string | null
  isDarkMode: boolean
  onToggleTheme: () => void
  onSubmit: (data: FirstUserSetupInput) => Promise<void>
}

export const FirstUserSetupForm: React.FC<FirstUserSetupFormProps> = ({
  loading,
  error,
  success,
  isDarkMode,
  onToggleTheme,
  onSubmit,
}) => {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const form = useForm<FirstUserSetupInput>({
    resolver: zodResolver(firstUserSchema),
    defaultValues: {
      nome: '',
      username: '',
      email: '',
      cargo: 'Perito Oficial Criminal',
      lotacao: '',
      senha: '',
      confirmarSenha: '',
    },
  })

  const handleSubmit = async (data: FirstUserSetupInput) => {
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
      <div className="relative z-10 w-full max-w-xl">
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
              className="mb-4 h-auto w-40 max-w-[60%] object-contain"
            />
            <div className="mt-4 space-y-1">
              <p className="text-lg font-semibold text-foreground">
                Primeiro acesso
              </p>
              <p className="text-sm text-muted-foreground">
                Nenhum usuário foi encontrado. Cadastre o primeiro usuário
                para liberar o sistema.
              </p>
            </div>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Seu nome completo"
                          autoComplete="name"
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
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome de usuário</FormLabel>
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="email@pcp.pr.gov.br"
                          autoComplete="email"
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
                  name="cargo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o cargo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Perito Oficial Criminal">
                            Perito Oficial Criminal
                          </SelectItem>
                          <SelectItem value="Técnico de Perícia Oficial">
                            Técnico de Perícia Oficial
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lotacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lotação</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Instituto de Criminalística"
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
                            placeholder="Mínimo 6 caracteres"
                            autoComplete="new-password"
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

                <FormField
                  control={form.control}
                  name="confirmarSenha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="Repita a senha"
                            autoComplete="new-password"
                            className="border-border/50 bg-muted/40 pr-10 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/30 dark:bg-muted/20"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowConfirmPassword((p) => !p)
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? (
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

                {success && (
                  <Alert>
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="group w-full shadow-lg shadow-primary/20 hover:shadow-primary/30" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      Cadastrar primeiro usuário
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
