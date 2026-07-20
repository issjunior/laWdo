import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { PecasB602Fields } from '@/components/rep/exam-fields/pecas-b602'
import type { PecaB602 } from '@shared/types/b602-gdl.types'

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false
  HTMLElement.prototype.setPointerCapture = () => undefined
  HTMLElement.prototype.releasePointerCapture = () => undefined
  HTMLElement.prototype.scrollIntoView = () => undefined
})

function criarPecaGdl(): PecaB602 {
  return {
    idLocal: 'peca-gdl-1001',
    origem: 'gdl',
    alteradaLocalmente: false,
    codPecaGdl: 1001,
    tipoCodigo: '476',
    tipoPeca: 'CARABINA(S)',
    comuns: {
      identificacao: 'CARABINA TESTE',
      quantidade: 1,
      unidadeMedida: 'UNIDADE',
      quantidadeDescricao: '',
      examinadoInLoco: false,
      materialIncinerado: 'N',
      dataEntrada: '',
      lacreEntrada: '',
      lacreSaida: '',
      dataLiberacao: '',
      codigoVestigio: '',
      consumida: 'N',
      observacao: '',
    },
    personalizados: {
      '476:numero_serie': 'ABC123',
      '476:arma_institucional': '98',
    },
    extrasGdl: {},
  }
}

interface EditorControladoProps {
  pecasIniciais?: PecaB602[]
  onChange?: (pecas: PecaB602[]) => void
  onRevisarPecasGdl?: () => void
}

function EditorControlado({
  pecasIniciais = [],
  onChange,
  onRevisarPecasGdl,
}: EditorControladoProps) {
  const [pecas, setPecas] = useState(pecasIniciais)

  const atualizar = (novasPecas: PecaB602[]) => {
    setPecas(novasPecas)
    onChange?.(novasPecas)
  }

  return (
    <PecasB602Fields
      pecas={pecas}
      onChange={atualizar}
      onRevisarPecasGdl={onRevisarPecasGdl}
    />
  )
}

function obterControleDoCampo(label: string): HTMLElement {
  const elementoLabel = screen.getByText(label, { selector: 'label' })
  const controle = elementoLabel.parentElement?.querySelector<HTMLElement>('input, [role="combobox"]')

  if (!controle) throw new Error(`Controle do campo "${label}" não encontrado.`)
  return controle
}

async function selecionarOpcao(labelCampo: string, opcao: string) {
  fireEvent.pointerDown(obterControleDoCampo(labelCampo), {
    button: 0,
    buttons: 1,
    ctrlKey: false,
    pointerType: 'mouse',
  })
  fireEvent.click(await screen.findByRole('option', { name: opcao }))
}

describe('PecasB602Fields', () => {
  it('aciona a revisão das peças disponíveis no GDL', () => {
    const onRevisarPecasGdl = vi.fn()
    render(<EditorControlado onRevisarPecasGdl={onRevisarPecasGdl} />)

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar peças do GDL' }))

    expect(onRevisarPecasGdl).toHaveBeenCalledOnce()
  })

  it('valida tipo, quantidade e campos personalizados obrigatórios', async () => {
    const onChange = vi.fn()
    render(<EditorControlado onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar peça' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar peça' }))
    expect(screen.getByText('Selecione o Tipo do Item.')).toBeInTheDocument()

    await selecionarOpcao('Tipo do Item', 'CARABINA(S)')
    fireEvent.change(obterControleDoCampo('Quantidade'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar peça' }))
    expect(screen.getByText('A quantidade deve ser maior que zero.')).toBeInTheDocument()

    fireEvent.change(obterControleDoCampo('Quantidade'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar peça' }))
    expect(screen.getByText('Arma é Institucional? é obrigatório.')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('aplica os tipos e limites dos campos personalizados de ARMA(S) DE CHOQUE', async () => {
    render(<EditorControlado />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar peça' }))
    await selecionarOpcao('Tipo do Item', 'ARMA(S) DE CHOQUE')

    expect(obterControleDoCampo('Nº Série')).toHaveAttribute('type', 'text')
    expect(obterControleDoCampo('Nº Série')).toHaveAttribute('maxlength', '25')
    expect(obterControleDoCampo('Marca')).toHaveAttribute('maxlength', '50')
    expect(obterControleDoCampo('Modelo')).toHaveAttribute('maxlength', '50')
  })

  it('aplica os limites dos campos personalizados de ARMA(S) DE PRESSÃO', async () => {
    render(<EditorControlado />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar peça' }))
    await selecionarOpcao('Tipo do Item', 'ARMA(S) DE PRESSÃO')

    expect(obterControleDoCampo('Nº Série')).toHaveAttribute('maxlength', '25')
    expect(obterControleDoCampo('Marca')).toHaveAttribute('maxlength', '50')
    expect(obterControleDoCampo('Modelo')).toHaveAttribute('maxlength', '50')
  })

  it('exibe os campos de PISTOLA e permite marca catalogada ou personalizada', async () => {
    render(<EditorControlado />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar peça' }))
    await selecionarOpcao('Tipo do Item', 'PISTOLA(S)')

    expect(screen.queryByText('Marca', { selector: 'label' })).not.toBeInTheDocument()
    expect(obterControleDoCampo('Nº Série')).toHaveAttribute('maxlength', '25')
    expect(obterControleDoCampo('Modelo')).toHaveAttribute('maxlength', '50')
    expect(obterControleDoCampo('Capacidade')).toHaveAttribute('maxlength', '50')

    const marcaArma = obterControleDoCampo('Marca da Arma')
    expect(marcaArma).toHaveAttribute('role', 'combobox')
    fireEvent.click(marcaArma)
    expect(marcaArma).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(screen.getByPlaceholderText('Pesquisar marca...')).toBeVisible())
    const pesquisaMarca = screen.getByPlaceholderText('Pesquisar marca...')
    expect(screen.getByText('Digite para filtrar as 1.367 marcas disponíveis.')).toBeInTheDocument()

    fireEvent.change(pesquisaMarca, { target: { value: 'Taurus' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Taurus' }))
    expect(marcaArma).toHaveTextContent('Taurus')

    fireEvent.click(marcaArma)
    fireEvent.change(screen.getByPlaceholderText('Pesquisar marca...'), { target: { value: 'Marca personalizada' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Usar "Marca personalizada"' }))
    expect(marcaArma).toHaveTextContent('Marca personalizada')
    expect(screen.getByText('Funcionamento *', { selector: 'label' })).toBeInTheDocument()
    expect(screen.getByText('Arma é Institucional? *', { selector: 'label' })).toBeInTheDocument()
  })

  it('exibe o schema completo de REVÓLVER observado na REP 191/2026', async () => {
    render(<EditorControlado />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar peça' }))
    await selecionarOpcao('Tipo do Item', 'REVÓLVER(ES)')

    expect(obterControleDoCampo('Nº Série')).toHaveAttribute('maxlength', '25')
    expect(obterControleDoCampo('Marca')).toHaveAttribute('maxlength', '50')
    expect(obterControleDoCampo('Modelo')).toHaveAttribute('maxlength', '50')
    expect(obterControleDoCampo('Marca da Arma')).toHaveAttribute('role', 'combobox')
    expect(obterControleDoCampo('Status do Número de Série')).toBeInTheDocument()
    expect(obterControleDoCampo('Calibre Nominal Revolver')).toBeInTheDocument()
    expect(obterControleDoCampo('Tipo Acabamento')).toBeInTheDocument()
    expect(obterControleDoCampo('Estado Geral da Arma')).toBeInTheDocument()
    expect(obterControleDoCampo('Funcionamento *')).toBeInTheDocument()
    expect(obterControleDoCampo('Fabricação da Arma')).toBeInTheDocument()
    expect(obterControleDoCampo('Tambor')).toBeInTheDocument()
    expect(obterControleDoCampo('Arma é Institucional? *')).toBeInTheDocument()
  })

  it('exibe o schema completo de ESPINGARDA observado no GDL', async () => {
    render(<EditorControlado />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar peça' }))
    await selecionarOpcao('Tipo do Item', 'ESPINGARDA(S)')

    expect(obterControleDoCampo('Nº Série')).toHaveAttribute('maxlength', '25')
    expect(obterControleDoCampo('Marca')).toHaveAttribute('maxlength', '50')
    expect(obterControleDoCampo('Modelo')).toHaveAttribute('maxlength', '50')
    expect(obterControleDoCampo('Capacidade')).toHaveAttribute('maxlength', '50')
    expect(obterControleDoCampo('Marca da Arma')).toHaveAttribute('role', 'combobox')
    expect(obterControleDoCampo('Calibre Nominal Espingarda')).toBeInTheDocument()
    expect(obterControleDoCampo('Funcionamento *')).toBeInTheDocument()
    expect(obterControleDoCampo('Arma é Institucional? *')).toBeInTheDocument()
  })

  it('não oferece PEÇA TESTE e exige ORIGEM/COLETA para PROJÉTEIS', async () => {
    const onChange = vi.fn()
    render(<EditorControlado onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar peça' }))
    fireEvent.pointerDown(obterControleDoCampo('Tipo do Item'), {
      button: 0,
      buttons: 1,
      ctrlKey: false,
      pointerType: 'mouse',
    })

    expect(screen.queryByRole('option', { name: 'PEÇA TESTE' })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('option', { name: 'PROJÉTEIS' }))
    expect(obterControleDoCampo('ORIGEM/COLETA *')).toBeInTheDocument()

    await selecionarOpcao('ORIGEM/COLETA *', 'DELEGACIA')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar peça' }))

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        tipoCodigo: '105',
        tipoPeca: 'PROJÉTEIS',
        personalizados: { '105:origem_coleta': '95' },
      }),
    ])
  })

  it('reproduz Medida e os estados comuns como selects preenchidos', async () => {
    const onChange = vi.fn()
    render(<EditorControlado onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar peça' }))
    await selecionarOpcao('Tipo do Item', 'ARMA(S) DE CHOQUE')

    expect(obterControleDoCampo('Medida')).toHaveTextContent('UNIDADES')
    expect(obterControleDoCampo('Examinado In Loco')).toHaveTextContent('Não')
    expect(obterControleDoCampo('Mat. Incinerado?')).toHaveTextContent('Não')

    await selecionarOpcao('Medida', 'AMOSTRA')
    await selecionarOpcao('Examinado In Loco', 'Sim')
    await selecionarOpcao('Mat. Incinerado?', 'Sim')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar peça' }))

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        comuns: expect.objectContaining({
          unidadeMedida: 'AMOSTRA',
          examinadoInLoco: true,
          materialIncinerado: 'S',
        }),
      }),
    ])
  })

  it('adiciona uma peça manual com campos comuns e personalizados', async () => {
    const onChange = vi.fn()
    render(<EditorControlado onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar peça' }))
    await selecionarOpcao('Tipo do Item', 'CARABINA(S)')
    fireEvent.change(obterControleDoCampo('Identificação'), { target: { value: 'Carabina apreendida' } })
    fireEvent.change(obterControleDoCampo('Nº Série'), { target: { value: 'SERIE-01' } })
    await selecionarOpcao('Arma é Institucional? *', 'Não')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar peça' }))

    expect(await screen.findByText('CARABINA(S)')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
    expect(screen.getByText(/Carabina apreendida/)).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        origem: 'manual',
        tipoCodigo: '476',
        tipoPeca: 'CARABINA(S)',
        comuns: expect.objectContaining({ identificacao: 'Carabina apreendida', quantidade: 1 }),
        personalizados: expect.objectContaining({
          '476:numero_serie': 'SERIE-01',
          '476:arma_institucional': '98',
        }),
      }),
    ])
  })

  it('oferece seleção única para Arma é Institucional', async () => {
    render(<EditorControlado />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar peça' }))
    await selecionarOpcao('Tipo do Item', 'FUZIL(IS)')

    const controle = obterControleDoCampo('Arma é Institucional? *')
    await selecionarOpcao('Arma é Institucional? *', 'Indeterminado')
    expect(controle).toHaveTextContent('Indeterminado')
    await selecionarOpcao('Arma é Institucional? *', 'Não')
    expect(controle).toHaveTextContent('Não')
  })

  it('organiza os quatro campos de estado na última linha do formulário', async () => {
    render(<EditorControlado />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar peça' }))
    await selecionarOpcao('Tipo do Item', 'FUZIL(IS)')

    const examinado = screen.getByText('Examinado In Loco', { selector: 'label' }).parentElement
    const institucional = screen.getByText('Arma é Institucional? *', { selector: 'label' }).parentElement
    const incinerado = screen.getByText('Mat. Incinerado?', { selector: 'label' }).parentElement
    const consumido = screen.getByText('Consumido/Liberado no Exame?', { selector: 'label' }).parentElement
    const observacao = screen.getByText('Observação', { selector: 'label' }).parentElement
    const ultimaLinha = examinado?.parentElement

    expect(ultimaLinha).toBe(institucional?.parentElement)
    expect(ultimaLinha).toBe(incinerado?.parentElement)
    expect(ultimaLinha).toBe(consumido?.parentElement)
    expect(observacao?.nextElementSibling).toBe(ultimaLinha)
  })

  it('inicia Consumido/Liberado no Exame como Não e não oferece valor vazio', async () => {
    render(<EditorControlado />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar peça' }))
    await selecionarOpcao('Tipo do Item', 'ARMA(S) DE CHOQUE')

    const controle = obterControleDoCampo('Consumido/Liberado no Exame?')
    expect(controle).toHaveTextContent('Não')
    fireEvent.pointerDown(controle, {
      button: 0,
      buttons: 1,
      ctrlKey: false,
      pointerType: 'mouse',
    })

    expect(screen.queryByRole('option', { name: 'Não informado' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Sim' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Não' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Parcialmente' })).toBeInTheDocument()
  })

  it('exibe os valores importados de ARMA(S) DE CHOQUE ao editar', () => {
    const pecaChoque: PecaB602 = {
      ...criarPecaGdl(),
      tipoCodigo: '289',
      tipoPeca: 'ARMA(S) DE CHOQUE',
      comuns: {
        ...criarPecaGdl().comuns,
        dataEntrada: '2026-07-19',
      },
      personalizados: {
        '289:numero_serie': 'UX289-SERIE-01',
        '289:marca': 'UX289-MARCA',
        '289:modelo': 'UX289-MODELO',
      },
    }
    render(<EditorControlado pecasIniciais={[pecaChoque]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

    expect(obterControleDoCampo('Data de Entrada')).toHaveValue('2026-07-19')
    expect(obterControleDoCampo('Nº Série')).toHaveValue('UX289-SERIE-01')
    expect(obterControleDoCampo('Marca')).toHaveValue('UX289-MARCA')
    expect(obterControleDoCampo('Modelo')).toHaveValue('UX289-MODELO')
  })

  it('confirma a troca de tipo, descarta personalizados e preserva campos comuns', async () => {
    const onChange = vi.fn()
    const confirmar = vi.spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    render(<EditorControlado pecasIniciais={[criarPecaGdl()]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    await selecionarOpcao('Tipo do Item', 'ESTOJO(S)')
    expect(confirmar).toHaveBeenCalledWith('A troca do tipo descartará os campos personalizados preenchidos. Continuar?')
    expect(obterControleDoCampo('Tipo do Item')).toHaveTextContent('CARABINA(S)')

    await selecionarOpcao('Tipo do Item', 'ESTOJO(S)')
    expect(obterControleDoCampo('Tipo do Item')).toHaveTextContent('ESTOJO(S)')
    expect(screen.queryByText('Nº Série', { selector: 'label' })).not.toBeInTheDocument()

    await selecionarOpcao('ORIGEM/COLETA *', 'DELEGACIA')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar peça' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce())
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        tipoCodigo: '101',
        tipoPeca: 'ESTOJO(S)',
        alteradaLocalmente: true,
        comuns: expect.objectContaining({
          identificacao: 'CARABINA TESTE',
          unidadeMedida: 'UNIDADE',
        }),
        personalizados: { '101:origem_coleta': '95' },
      }),
    ])
  })

  it('marca a edição local e exclui uma peça importada somente após confirmação', () => {
    const onChange = vi.fn()
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<EditorControlado pecasIniciais={[criarPecaGdl()]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(obterControleDoCampo('Identificação'), { target: { value: 'Carabina revisada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar peça' }))

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        origem: 'gdl',
        codPecaGdl: 1001,
        alteradaLocalmente: true,
        comuns: expect.objectContaining({ identificacao: 'Carabina revisada' }),
      }),
    ])
    expect(screen.getByText('Alterada localmente')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    expect(confirmar).toHaveBeenCalledWith('A peça será excluída somente do laWdo; o GDL não será alterado. Continuar?')
    expect(onChange).toHaveBeenLastCalledWith([])
    expect(screen.getByText('Nenhuma peça adicionada.')).toBeInTheDocument()
  })
})
