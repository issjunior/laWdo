import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { beforeAll, describe, expect, it } from 'vitest'
import { Form, FormField, FormItem } from '@/components/forms/form'
import { TipoSolicitacaoSelect } from '@/components/rep/TipoSolicitacaoSelect'

interface FormularioTeste {
  tipo: string
  numero: string
}

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false
  HTMLElement.prototype.setPointerCapture = () => undefined
  HTMLElement.prototype.releasePointerCapture = () => undefined
  HTMLElement.prototype.scrollIntoView = () => undefined
})

function FormularioOrigemTeste() {
  const form = useForm<FormularioTeste>({ defaultValues: { tipo: 'Ofício', numero: '' } })
  const [origens, setOrigens] = useState<Array<{ tipo: string; numero: string }>>([])

  const aplicarApi = (): void => {
    setOrigens([{ tipo: 'IP/PM', numero: '212314/2026' }])
    form.setValue('tipo', 'IP/PM')
    form.setValue('numero', '212314/2026')
  }

  const tipo = form.watch('tipo')
  const numero = form.watch('numero')

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="tipo"
        render={({ field }) => (
          <FormItem>
            <TipoSolicitacaoSelect
              valor={field.value}
              numeroDocumento={numero}
              origensGdl={origens}
              valorVeioDoGdl={origens.length > 0}
              onValorChange={field.onChange}
              onNumeroDocumentoChange={valor => form.setValue('numero', valor)}
            />
          </FormItem>
        )}
      />
      <span data-testid="tipo">{tipo}</span>
      <span data-testid="numero">{numero}</span>
      <button type="button" onClick={aplicarApi}>Aplicar API</button>
    </Form>
  )
}

describe('TipoSolicitacaoSelect integrado ao formulário', () => {
  it('não apaga tipo e número quando a API aplica uma origem', async () => {
    render(<FormularioOrigemTeste />)

    screen.getByRole('button', { name: 'Aplicar API' }).click()

    await waitFor(() => {
      expect(screen.getByTestId('tipo')).toHaveTextContent('IP/PM')
      expect(screen.getByTestId('numero')).toHaveTextContent('212314/2026')
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByTestId('tipo-solicitacao-valor')).toHaveTextContent(/^IP\/PM$/)
    })
  })

  it('continua aceitando uma seleção feita pelo usuário', async () => {
    render(<FormularioOrigemTeste />)
    screen.getByRole('button', { name: 'Aplicar API' }).click()
    await waitFor(() => expect(screen.getByTestId('tipo')).toHaveTextContent('IP/PM'))

    fireEvent.pointerDown(screen.getByRole('combobox'), {
      button: 0,
      buttons: 1,
      ctrlKey: false,
      pointerType: 'mouse',
    })
    fireEvent.click(await screen.findByRole('option', { name: 'BO' }))

    expect(screen.getByTestId('tipo')).toHaveTextContent('BO')
    expect(screen.getByTestId('numero')).toBeEmptyDOMElement()
  })
})
