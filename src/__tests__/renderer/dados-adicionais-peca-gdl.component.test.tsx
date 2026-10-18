import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DadosAdicionaisPecaGdl } from '@/components/rep/DadosAdicionaisPecaGdl'

describe('informações adicionais de peças B601', () => {
  it('oculta Nº Análises sem alterar o dado preservado', () => {
    const dados = { numeroAnalises: '1' }
    const { container } = render(<DadosAdicionaisPecaGdl dados={dados} />)
    expect(container).toBeEmptyDOMElement()
    expect(dados.numeroAnalises).toBe('1')
  })

  it('mantém dados desconhecidos recolhidos sem alerta ou Nº Análises', () => {
    const { container } = render(<DadosAdicionaisPecaGdl dados={{ 'Campo novo': 'Conferir este valor', numeroAnalises: '1' }} />)
    expect(screen.getByText('Dados adicionais do GDL')).toBeInTheDocument()
    expect(container.querySelector('details')).not.toHaveAttribute('open')
    expect(screen.getByText('Campo novo')).toBeInTheDocument()
    expect(screen.getByText('Conferir este valor')).toBeInTheDocument()
    expect(screen.queryByText('Nº Análises')).not.toBeInTheDocument()
    expect(screen.queryByText('Informações adicionais recebidas do GDL')).not.toBeInTheDocument()
  })

  it('mostra a origem legada já preenchida como informação', () => {
    render(<DadosAdicionaisPecaGdl dados={{ 'ORIGEM/COLETA': 'DELEGACIA' }} tipoCodigo="101" personalizados={{ '101:origem_coleta': '95' }} />)
    expect(screen.getByText('DELEGACIA')).toBeInTheDocument()
    expect(screen.queryByText('Informações adicionais recebidas do GDL')).not.toBeInTheDocument()
  })
})
