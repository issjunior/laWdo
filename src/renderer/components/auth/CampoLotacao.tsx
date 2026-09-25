import React, { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { MUNICIPIOS_PARANA } from '@shared/catalogos/municipios-parana.catalogo'

interface CampoLotacaoProps extends Omit<React.ComponentPropsWithoutRef<typeof Input>, 'onChange' | 'value'> {
  value: string
  onValorChange: (valor: string) => void
}

function normalizarBusca(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

const municipiosPesquisaveis = MUNICIPIOS_PARANA.map(municipio => ({
  nome: municipio,
  busca: normalizarBusca(municipio),
}))

export const CampoLotacao = React.forwardRef<HTMLInputElement, CampoLotacaoProps>(({
  value,
  onValorChange,
  onBlur,
  onKeyDown,
  ...props
}, ref) => {
  const [aberto, setAberto] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(-1)
  const listaId = useId()
  const listaRef = useRef<HTMLUListElement>(null)
  const busca = normalizarBusca(value)
  const municipiosFiltrados = busca
    ? municipiosPesquisaveis.filter(municipio => municipio.busca.includes(busca))
    : municipiosPesquisaveis
  const possuiCorrespondenciaExata = municipiosFiltrados.some(municipio => municipio.busca === busca)

  useEffect(() => {
    if (indiceAtivo >= 0) listaRef.current?.children.item(indiceAtivo)?.scrollIntoView({ block: 'nearest' })
  }, [indiceAtivo])

  const selecionarMunicipio = (municipio: string) => {
    onValorChange(municipio)
    setAberto(false)
    setIndiceAtivo(-1)
  }

  const tratarTecla = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'ArrowDown' && municipiosFiltrados.length > 0) {
      evento.preventDefault()
      setAberto(true)
      setIndiceAtivo(indice => (indice + 1) % municipiosFiltrados.length)
    } else if (evento.key === 'ArrowUp' && municipiosFiltrados.length > 0) {
      evento.preventDefault()
      setAberto(true)
      setIndiceAtivo(indice => (indice <= 0 ? municipiosFiltrados.length - 1 : indice - 1))
    } else if (evento.key === 'Enter' && aberto) {
      evento.preventDefault()
      if (indiceAtivo >= 0) selecionarMunicipio(municipiosFiltrados[indiceAtivo].nome)
      else setAberto(false)
    } else if (evento.key === 'Escape') {
      setAberto(false)
      setIndiceAtivo(-1)
    }
    onKeyDown?.(evento)
  }

  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={aberto}
        aria-controls={aberto ? listaId : undefined}
        aria-activedescendant={aberto && indiceAtivo >= 0 ? `${listaId}-opcao-${indiceAtivo}` : undefined}
        value={value}
        onFocus={() => setAberto(true)}
        onChange={evento => {
          onValorChange(evento.target.value)
          setAberto(true)
          setIndiceAtivo(-1)
        }}
        onBlur={evento => {
          onBlur?.(evento)
          setAberto(false)
          setIndiceAtivo(-1)
        }}
        onKeyDown={tratarTecla}
        className="border-border/50 bg-muted/40 pr-10 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/30 dark:bg-muted/20"
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {aberto && (
        <ul
          id={listaId}
          ref={listaRef}
          role="listbox"
          aria-label="Municípios do Paraná"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {municipiosFiltrados.map((municipio, indice) => (
            <li key={municipio.nome} role="presentation">
              <button
                id={`${listaId}-opcao-${indice}`}
                type="button"
                role="option"
                aria-selected={indice === indiceAtivo}
                tabIndex={-1}
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                onMouseDown={evento => evento.preventDefault()}
                onClick={() => selecionarMunicipio(municipio.nome)}
              >
                {municipio.nome}
              </button>
            </li>
          ))}
          {municipiosFiltrados.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              Nenhum município encontrado.
            </li>
          )}
          {value.trim() && !possuiCorrespondenciaExata && (
            <li role="presentation" className="border-t border-border pt-1">
              <button
                type="button"
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={evento => evento.preventDefault()}
                onClick={() => setAberto(false)}
              >
                Usar “{value.trim()}” como lotação
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
})

CampoLotacao.displayName = 'CampoLotacao'
