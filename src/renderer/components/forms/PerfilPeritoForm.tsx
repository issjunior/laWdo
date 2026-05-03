import React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/forms/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Schema de validação para perfil do perito
const perfilPeritoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  matricula: z.string().min(4, "Matrícula deve ter pelo menos 4 caracteres"),
  cargo: z.string().min(3, "Cargo deve ter pelo menos 3 caracteres"),
  lotacao: z.string().min(3, "Lotação deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  telefone: z.string().optional(),
})

type PerfilPeritoFormValues = z.infer<typeof perfilPeritoSchema>

// Valores padrão
const defaultValues: Partial<PerfilPeritoFormValues> = {
  nome: "",
  matricula: "",
  cargo: "Perito Criminal",
  lotacao: "",
  email: "",
  telefone: "",
}

interface PerfilPeritoFormProps {
  onSubmit: (data: PerfilPeritoFormValues) => void
  loading?: boolean
  initialData?: Partial<PerfilPeritoFormValues>
}

export function PerfilPeritoForm({ onSubmit, loading = false, initialData }: PerfilPeritoFormProps) {
  const form = useForm<PerfilPeritoFormValues>({
    resolver: zodResolver(perfilPeritoSchema),
    defaultValues: { ...defaultValues, ...initialData },
  })

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Perfil do Perito</CardTitle>
        <CardDescription>
          Cadastre suas informações profissionais. Estas informações serão usadas para assinatura dos laudos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="João da Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="matricula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matrícula *</FormLabel>
                    <FormControl>
                      <Input placeholder="12345" {...field} />
                    </FormControl>
                    <FormDescription>Número de matrícula oficial</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Perito Criminal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lotacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lotação *</FormLabel>
                    <FormControl>
                      <Input placeholder="Núcleo de Perícias Criminais" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Institucional *</FormLabel>
                    <FormControl>
                      <Input placeholder="joao.silva@pcpr.pr.gov.br" type="email" {...field} />
                    </FormControl>
                    <FormDescription>Email oficial da instituição</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(41) 3270-9100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={loading}
              >
                Limpar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar Perfil"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}