import React from 'react'
import type { PecaB602 } from '@shared/types/b602-gdl.types'
import { CATALOGO_TIPOS_PECA_B602, OPCOES_UNIDADE_MEDIDA_B602, UNIDADE_MEDIDA_PADRAO_B602, pecaB602EstaCompleta } from '@shared/catalogos/b602-gdl.catalogo'
import { PecasBalisticaFields } from './pecas-balistica'

function criarPecaVazia(): PecaB602 {
  return {
    idLocal: crypto.randomUUID(), origem: 'manual', alteradaLocalmente: false, tipoCodigo: '', tipoPeca: '',
    comuns: { identificacao: '', quantidade: 1, unidadeMedida: UNIDADE_MEDIDA_PADRAO_B602, quantidadeDescricao: '', examinadoInLoco: false,
      materialIncinerado: 'N', dataEntrada: '', lacreEntrada: '', lacreSaida: '', dataLiberacao: '', codigoVestigio: '', consumida: 'N', observacao: '' },
    personalizados: {}, extrasGdl: {},
  }
}
function validarPeca(peca: PecaB602): string | null {
  if (!Number.isFinite(peca.comuns.quantidade) || peca.comuns.quantidade <= 0) return 'A quantidade deve ser maior que zero.'
  const campo = CATALOGO_TIPOS_PECA_B602.find(tipo => tipo.codigo === peca.tipoCodigo)?.campos.find(item => item.obrigatorio && !peca.personalizados[item.id])
  return campo ? campo.label + ' é obrigatório.' : null
}
export const PecasB602Fields: React.FC<{ pecas: PecaB602[]; onChange: (pecas: PecaB602[]) => void; onRevisarPecasGdl?: () => void }> = props => (
  <PecasBalisticaFields {...props} catalogo={CATALOGO_TIPOS_PECA_B602} opcoesMedida={OPCOES_UNIDADE_MEDIDA_B602} codigoExame="b602"
    criarPeca={criarPecaVazia} validarPeca={validarPeca} estaCompleta={pecaB602EstaCompleta} exibirMaterialIncinerado />
)
