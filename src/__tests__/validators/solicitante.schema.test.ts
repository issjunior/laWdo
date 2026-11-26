import { describe, expect, it } from 'vitest'
import { createSolicitanteSchema, type CreateSolicitanteInput } from '@/lib/validators/solicitante.schema'

describe('createSolicitanteSchema', () => {
  const solicitanteValido: CreateSolicitanteInput = {
    nome: 'Delegacia Regional de Curitiba',
    tipo: 'Delegacia',
    endereco: 'Rua Exemplo, 100',
    telefone: '(41) 99999-9999',
    email: 'contato@pcpr.pr.gov.br',
  }

  it('aceita dados válidos e campos opcionais vazios', () => {
    expect(createSolicitanteSchema.parse(solicitanteValido)).toMatchObject(solicitanteValido)
    expect(createSolicitanteSchema.parse({ nome: 'Instituto', tipo: '', telefone: '', email: '' })).toMatchObject({
      nome: 'Instituto',
      tipo: '',
      telefone: '',
      email: '',
    })
  })

  it('rejeita nome obrigatório curto e tipo acima do limite', () => {
    expect(() => createSolicitanteSchema.parse({ ...solicitanteValido, nome: 'A' })).toThrow('Nome é obrigatório')
    expect(() => createSolicitanteSchema.parse({ ...solicitanteValido, tipo: 'a'.repeat(51) })).toThrow('Tipo não pode exceder 50 caracteres')
  })

  it('rejeita telefone e e-mail preenchidos em formato inválido', () => {
    expect(() => createSolicitanteSchema.parse({ ...solicitanteValido, telefone: '41999999999' })).toThrow('Telefone deve estar no formato')
    expect(() => createSolicitanteSchema.parse({ ...solicitanteValido, email: 'contato-invalido' })).toThrow('Email inválido')
  })
})
