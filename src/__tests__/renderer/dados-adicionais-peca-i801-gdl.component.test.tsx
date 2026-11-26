import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DadosAdicionaisPecaI801Gdl } from '@/components/rep/DadosAdicionaisPecaI801Gdl'

describe('dados adicionais de peças I-801', () => {
  it('apresenta candidato não certificado para revisão sem alterar o dado preservado', () => {
    const dados = { placa: 'DADO-SIMULADO' }

    render(<DadosAdicionaisPecaI801Gdl dados={dados} tipoCodigo="caminhonete" />)

    expect(screen.getByText('Dados adicionais do GDL que exigem revisão')).toBeInTheDocument()
    expect(screen.getByText('Placa')).toBeInTheDocument()
    expect(screen.getByText('DADO-SIMULADO')).toBeInTheDocument()
    expect(dados.placa).toBe('DADO-SIMULADO')
  })
})
