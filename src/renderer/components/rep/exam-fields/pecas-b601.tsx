import { Checkbox } from '@/components/ui/checkbox'
import { CATALOGO_TIPOS_PECA_B601, OPCOES_UNIDADE_MEDIDA_B601, obterPendenciaPecaB601 } from '@shared/catalogos/b601.catalogo'
import type { PecaBalistica } from '@shared/types/pecas-balistica.types'
import { PecasBalisticaFields } from './pecas-balistica'
import type { ExamSectionProps } from './types'

function criarPeca(): PecaBalistica {
  return {
    idLocal: crypto.randomUUID(), origem: 'manual', alteradaLocalmente: false, tipoCodigo: '', tipoPeca: '',
    comuns: {
      identificacao: '', quantidade: 1, unidadeMedida: 'UNIDADES', quantidadeDescricao: '', examinadoInLoco: false,
      dataEntrada: '', lacreEntrada: '', lacreSaida: '', dataLiberacao: '', codigoVestigio: '', consumida: 'N', observacao: '',
    }, personalizados: {}, extrasGdl: {},
  }
}

export function PecasB601Fields({ dadosB601, onDadosB601Change, onEdicaoPecaB601Change, onRevisarPecasGdl }: ExamSectionProps) {
  if (!dadosB601 || !onDadosB601Change) return null
  return <div className="space-y-4">
    {dadosB601.pecas.length === 0 && <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={dadosB601.semPecas}
        onCheckedChange={valor => onDadosB601Change({ ...dadosB601, semPecas: valor === true })} />
      Declaro que esta REP não possui peças para exame
    </label>}
    {!dadosB601.semPecas && <PecasBalisticaFields pecas={dadosB601.pecas}
      onChange={pecas => onDadosB601Change({ ...dadosB601, pecas })}
      catalogo={CATALOGO_TIPOS_PECA_B601} opcoesMedida={OPCOES_UNIDADE_MEDIDA_B601}
      codigoExame="b601" criarPeca={criarPeca} validarPeca={obterPendenciaPecaB601} preservarPersonalizados permitirReordenacao
      onEdicaoChange={onEdicaoPecaB601Change} onRevisarPecasGdl={onRevisarPecasGdl} />}
  </div>
}
