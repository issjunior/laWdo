import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-100 px-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="w-full max-w-xl">
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
            <CardTitle>Primeiro acesso</CardTitle>
            <CardDescription>
              Nenhum usuário foi encontrado. Cadastre o primeiro usuário para
              liberar o sistema.
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
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Seu nome completo"
                          autoComplete="name"
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
                            className="pr-10"
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

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
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
