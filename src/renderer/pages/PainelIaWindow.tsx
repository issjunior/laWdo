import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import {
  AssistenteIaPanel,
  type ChatMessage,
} from '@/components/ai/AssistenteIaPanel'
import {
  aplicarAtualizacaoPainelIa,
  atualizacaoPainelIaValida,
  type EstadoPainelIa,
} from '@shared/types/ia.types'

export default function PainelIaWindow() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  const [estado, setEstado] = useState<EstadoPainelIa | null>(null)

  useEffect(() => {
    if (!sessionId) return

    const remover = window.ipcAPI.ia.onPainelEstado((atualizacao: unknown) => {
      if (!atualizacaoPainelIaValida(atualizacao)) return

      setEstado((atual) => {
        const resultado = aplicarAtualizacaoPainelIa(atual, atualizacao)
        if (resultado.requerRessincronizacao) {
          window.ipcAPI.ia.painelEnviarComando({ tipo: 'solicitar_ressincronizacao' })
        }
        return resultado.estado
      })
    })

    window.ipcAPI.ia.painelPronto()
    return remover
  }, [sessionId])

  if (!sessionId) {
    return <div className="p-6 text-sm text-destructive">Sessão do painel inválida.</div>
  }

  if (!estado) {
    return (
      <main className="flex h-screen items-center justify-center bg-background p-6 text-sm text-muted-foreground">
        Conectando ao editor...
      </main>
    )
  }

  const mensagens: ChatMessage[] = estado.mensagens.map((mensagem) => ({ ...mensagem }))

  return (
    <main className="h-screen min-w-0 bg-background">
      <AssistenteIaPanel
        secaoTitulo={estado.titulo}
        editorId={estado.editorDisponivel ? 'editor-destacado' : ''}
        messages={mensagens}
        loading={estado.carregando}
        progresso={estado.progresso}
        retomada={estado.retomada}
        error={estado.erro}
        modoAplicacao={estado.modoAplicacao}
        imagemSelecionada={estado.imagemSelecionada}
        contextoImagem={estado.contextoImagem}
        opcoesEscopo={estado.escopos}
        escopoSelecionado={estado.escopoSelecionado}
        onSelecionarEscopo={(indice) =>
          window.ipcAPI.ia.painelEnviarComando({ tipo: 'selecionar_escopo', indice })
        }
        onExecutarAcao={(acao) =>
          window.ipcAPI.ia.painelEnviarComando({ tipo: 'executar_acao', acao })
        }
        onDescreverImagens={() =>
          window.ipcAPI.ia.painelEnviarComando({ tipo: 'descrever_imagem' })
        }
        onSendMessage={(mensagem, aplicacao) =>
          window.ipcAPI.ia.painelEnviarComando({
            tipo: 'enviar_pedido_livre',
            mensagem,
            aplicacao,
          })
        }
        onApplyResponse={(mensagem) =>
          window.ipcAPI.ia.painelEnviarComando({
            tipo: 'aplicar_resposta',
            mensagemId: mensagem.id,
          })
        }
        onCancelarOperacao={() =>
          window.ipcAPI.ia.painelEnviarComando({ tipo: 'cancelar_operacao' })
        }
        onRetomarOperacao={() =>
          window.ipcAPI.ia.painelEnviarComando({ tipo: 'retomar_operacao' })
        }
        onReencaixar={() => window.ipcAPI.ia.painelReencaixar()}
      />
    </main>
  )
}
