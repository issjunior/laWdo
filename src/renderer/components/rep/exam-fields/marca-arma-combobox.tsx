import React, { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { OpcaoCampoB602 } from '@shared/catalogos/b602-gdl.catalogo'

interface MarcaArmaComboboxProps {
  opcoes: OpcaoCampoB602[]
  value: string
  onChange: (valor: string) => void
}

const LIMITE_OPCOES_VISIVEIS = 50

function normalizarBusca(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

export const MarcaArmaCombobox: React.FC<MarcaArmaComboboxProps> = ({ opcoes, value, onChange }) => {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const opcoesUnicas = useMemo(() => {
    const marcasVistas = new Set<string>()
    return opcoes.filter(opcao => {
      const marcaNormalizada = normalizarBusca(opcao.label)
      if (marcasVistas.has(marcaNormalizada)) return false
      marcasVistas.add(marcaNormalizada)
      return true
    })
  }, [opcoes])
  const buscaNormalizada = normalizarBusca(busca)
  const opcoesFiltradas = useMemo(() => {
    const encontradas = buscaNormalizada
      ? opcoesUnicas.filter(opcao => normalizarBusca(opcao.label).includes(buscaNormalizada))
      : opcoesUnicas
    return encontradas.slice(0, LIMITE_OPCOES_VISIVEIS)
  }, [buscaNormalizada, opcoesUnicas])
  const possuiCorrespondenciaExata = opcoesUnicas.some(
    opcao => normalizarBusca(opcao.label) === buscaNormalizada,
  )
  const textoLivre = busca.trim()

  const selecionarMarca = (marca: string) => {
    onChange(marca)
    setAberto(false)
    setBusca('')
  }

  return (
    <Popover
      modal
      open={aberto}
      onOpenChange={novoEstado => {
        setAberto(novoEstado)
        if (novoEstado) setBusca('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value || 'Selecione ou digite...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={busca}
            onValueChange={setBusca}
            placeholder="Pesquisar marca..."
          />
          <CommandList>
            <CommandEmpty>Nenhuma marca encontrada.</CommandEmpty>
            <CommandGroup>
              {opcoesFiltradas.map(opcao => (
                <CommandItem
                  key={opcao.codigo}
                  value={opcao.label}
                  onSelect={() => selecionarMarca(opcao.label)}
                >
                  {opcao.label}
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4',
                      value === opcao.label ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
              {textoLivre && !possuiCorrespondenciaExata && (
                <CommandItem value={`texto-livre-${textoLivre}`} onSelect={() => selecionarMarca(textoLivre)}>
                  Usar &quot;{textoLivre}&quot;
                </CommandItem>
              )}
            </CommandGroup>
            {!buscaNormalizada && opcoesUnicas.length > LIMITE_OPCOES_VISIVEIS && (
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                Digite para filtrar as {opcoesUnicas.length.toLocaleString('pt-BR')} marcas disponíveis.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
