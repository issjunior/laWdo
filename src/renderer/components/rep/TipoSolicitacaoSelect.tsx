import type { ReferenciaOrigemGdl } from '@shared/types/b602-gdl.types'
import { LABELS_TIPOS_ORIGEM_GDL } from '@shared/catalogos/tipos-origem-gdl.catalogo'
import { FormControl } from '@/components/forms/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRef } from 'react'

const TIPOS_SOLICITACAO_LEGADOS = ['BOU', 'BO PM', 'BO PC', 'Ofício', 'CECOMP'] as const

interface ApresentacaoTipoSolicitacao {
  modoOutro: boolean
  opcoes: string[]
  valorSelect: string
}

const PREFIXO_ORIGEM_GDL = 'origem-gdl:'

function criarValorOrigemGdl(indice: number): string {
  return `${PREFIXO_ORIGEM_GDL}${indice}`
}

export function resolverValorSelectTipoSolicitacao(
  tipo: string,
  numero: string,
  origensGdl: ReferenciaOrigemGdl[],
): string | undefined {
  const indice = origensGdl.findIndex(origem => (
    origem.tipo.trim() === tipo && origem.numero === numero
  ))
  return indice >= 0 ? criarValorOrigemGdl(indice) : undefined
}

export function resolverSelecaoTipoSolicitacao(
  valorSelect: string,
  origensGdl: ReferenciaOrigemGdl[],
): ReferenciaOrigemGdl | undefined {
  if (!valorSelect.startsWith(PREFIXO_ORIGEM_GDL)) return undefined
  const indice = Number(valorSelect.slice(PREFIXO_ORIGEM_GDL.length))
  return Number.isInteger(indice) ? origensGdl[indice] : undefined
}

export function resolverApresentacaoTipoSolicitacao(
  valor: string,
  origensGdl: ReferenciaOrigemGdl[],
  valorVeioDoGdl: boolean,
): ApresentacaoTipoSolicitacao {
  const opcoes: string[] = [...LABELS_TIPOS_ORIGEM_GDL, ...TIPOS_SOLICITACAO_LEGADOS]

  for (const origem of origensGdl) {
    const tipo = origem.tipo.trim()
    if (tipo && !opcoes.includes(tipo)) {
      opcoes.push(tipo)
    }
  }

  if (valorVeioDoGdl && valor && !opcoes.includes(valor)) {
    opcoes.push(valor)
  }

  const modoOutro = !valor || !opcoes.includes(valor)
  return { modoOutro, opcoes, valorSelect: modoOutro ? 'Outros' : valor }
}

interface TipoSolicitacaoSelectProps {
  valor: string
  numeroDocumento: string
  origensGdl: ReferenciaOrigemGdl[]
  valorVeioDoGdl: boolean
  className?: string
  onValorChange: (valor: string) => void
  onNumeroDocumentoChange: (numero: string) => void
}

export function TipoSolicitacaoSelect({
  valor,
  numeroDocumento,
  origensGdl,
  valorVeioDoGdl,
  className,
  onValorChange,
  onNumeroDocumentoChange,
}: TipoSolicitacaoSelectProps) {
  const interacaoUsuarioRef = useRef(false)
  const apresentacao = resolverApresentacaoTipoSolicitacao(valor, origensGdl, valorVeioDoGdl)
  const valorOrigemSelecionada = resolverValorSelectTipoSolicitacao(
    valor,
    numeroDocumento,
    origensGdl,
  )
  const textoValorSelecionado = apresentacao.modoOutro ? 'Outros' : valor

  const selecionar = (novoValor: string): void => {
    if (!interacaoUsuarioRef.current) return
    interacaoUsuarioRef.current = false

    const origemSelecionada = resolverSelecaoTipoSolicitacao(novoValor, origensGdl)
    if (origemSelecionada) {
      onValorChange(origemSelecionada.tipo)
      onNumeroDocumentoChange(origemSelecionada.numero)
      return
    }

    if (novoValor === 'Outros') {
      onValorChange('')
      onNumeroDocumentoChange('')
      return
    }

    onValorChange(novoValor)
    onNumeroDocumentoChange('')
  }

  return (
    <>
      <Select
        value={valorOrigemSelecionada ?? apresentacao.valorSelect}
        onValueChange={selecionar}
        onOpenChange={aberto => {
          if (!aberto) interacaoUsuarioRef.current = false
        }}
      >
        <FormControl>
          <SelectTrigger
            className={className}
            onPointerDown={() => { interacaoUsuarioRef.current = true }}
            onKeyDown={() => { interacaoUsuarioRef.current = true }}
          >
            <SelectValue placeholder="Selecione...">
              <span data-testid="tipo-solicitacao-valor">
                {textoValorSelecionado || 'Selecione...'}
              </span>
            </SelectValue>
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {origensGdl.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-sm font-semibold">Origens cadastradas nesta REP</div>
              {origensGdl.map((origem, indice) => (
                <SelectItem key={`${origem.tipo}:${origem.numero}:${indice}`} value={criarValorOrigemGdl(indice)}>
                  {origem.numero ? `${origem.tipo} — ${origem.numero}` : origem.tipo}
                </SelectItem>
              ))}
              <div className="-mx-1 my-1 h-px bg-muted" />
            </>
          )}
          <div className="px-2 py-1.5 text-sm font-semibold">Preenchimento manual</div>
          {apresentacao.opcoes.map(opcao => (
            <SelectItem key={opcao} value={opcao}>{opcao}</SelectItem>
          ))}
          <SelectItem value="Outros">Outros</SelectItem>
        </SelectContent>
      </Select>
      {apresentacao.modoOutro && (
        <Input
          className="mt-2"
          placeholder="Especifique o tipo..."
          value={valor}
          onChange={evento => onValorChange(evento.target.value)}
          maxLength={50}
        />
      )}
    </>
  )
}
