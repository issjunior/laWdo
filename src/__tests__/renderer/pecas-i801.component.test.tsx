import { fireEvent, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import { PecasI801Fields } from '@/components/rep/exam-fields/pecas-i801'
import type { REPFormData } from '@/components/rep/exam-fields/types'

function EditorI801({ onRevisarPecasGdl }: { onRevisarPecasGdl: () => void }) {
  const form = useForm<REPFormData>()

  return (
    <PecasI801Fields
      form={form}
      mostrarPlaceholders={false}
      dadosI801={{ pecas: [] }}
      onDadosI801Change={() => undefined}
      onRevisarPecasGdl={onRevisarPecasGdl}
    />
  )
}

describe('PecasI801Fields', () => {
  it('permite abrir a revisão das peças disponíveis no GDL', () => {
    const onRevisarPecasGdl = vi.fn()

    render(<EditorI801 onRevisarPecasGdl={onRevisarPecasGdl} />)

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar peças do GDL' }))

    expect(onRevisarPecasGdl).toHaveBeenCalledOnce()
  })
})
