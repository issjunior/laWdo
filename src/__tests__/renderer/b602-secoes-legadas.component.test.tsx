import { fireEvent, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'
import { Form } from '../../renderer/components/forms/form'
import {
  ArmasFields,
  CartuchosFields,
  EstojosFields,
  MaterialEncFields,
} from '../../renderer/components/rep/exam-fields/b602'
import type { REPFormData } from '../../renderer/components/rep/exam-fields/types'

function SecoesB602Teste() {
  const form = useForm<REPFormData>({
    defaultValues: {
      b602_material_enc_0_natureza: 'Arma',
      b602_material_enc_0_quantidade: '1',
      b602_material_enc_1_natureza: 'Munição',
      b602_material_enc_1_quantidade: '2',
      b602_cartuchos_toggle: 'on',
      b602_cartuchos_0_quantidade: '1',
      b602_cartuchos_1_quantidade: '2',
      b602_estojos_toggle: 'on',
      b602_estojos_0_quantidade: '1',
      b602_estojos_1_quantidade: '2',
      b602_armas_toggle: 'on',
      b602_armas_0_tipo: 'Pistola',
      b602_armas_0_marca: 'Marca A',
      b602_armas_1_tipo: 'Revólver',
      b602_armas_1_marca: 'Marca B',
    },
  })
  const propriedades = { form, mostrarPlaceholders: false }

  return (
    <Form {...form}>
      <MaterialEncFields {...propriedades} />
      <CartuchosFields {...propriedades} />
      <EstojosFields {...propriedades} />
      <ArmasFields {...propriedades} />
    </Form>
  )
}

describe('seções legadas da REP B602', () => {
  it('reidrata coleções, permite acrescentar linhas e alterna subseções', () => {
    render(<SecoesB602Teste />)

    expect(screen.getByText('Especificações da Arma')).toBeInTheDocument()
    expect(screen.getByText('Arma 2')).toBeInTheDocument()
    expect(screen.getAllByText('Item 2')).toHaveLength(3)

    for (const botao of screen.getAllByRole('button', { name: /Adicionar item/i })) {
      fireEvent.click(botao)
    }
    fireEvent.click(screen.getByRole('button', { name: /Adicionar arma/i }))

    expect(screen.getAllByText('Item 3')).toHaveLength(3)
    expect(screen.getByText('Arma 3')).toBeInTheDocument()

    const toggles = screen.getAllByRole('checkbox')
    fireEvent.click(toggles[0])
    fireEvent.click(toggles[0])
    fireEvent.click(toggles.at(-1)!)
  }, 20000)

  it('normaliza quantidades digitadas nos editores preservados', () => {
    render(<SecoesB602Teste />)
    const quantidades = screen.getAllByRole('spinbutton')

    fireEvent.change(quantidades[0], { target: { value: '123' } })
    fireEvent.change(quantidades.at(-1)!, { target: { value: '987' } })

    expect(quantidades[0]).toHaveValue(12)
    expect(quantidades.at(-1)).toHaveValue(98)
  })
})
