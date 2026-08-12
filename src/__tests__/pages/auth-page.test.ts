import { describe, expect, it } from 'vitest'
import { respostaPossuiUsuarios } from '@/pages/AuthPage'

describe('verificação inicial de usuários', () => {
  it('abre o cadastro inicial somente após uma resposta válida e vazia', () => {
    expect(respostaPossuiUsuarios({ success: true, data: [] })).toBe(false)
  })

  it('direciona para o login quando existe usuário cadastrado', () => {
    expect(respostaPossuiUsuarios({ success: true, data: [{ id: 'usuario-1' }] })).toBe(true)
  })

  it('não interpreta falha de IPC como ausência de usuários', () => {
    expect(() => respostaPossuiUsuarios({ success: false, error: 'IPC indisponível' }))
      .toThrow('IPC indisponível')
  })

  it('rejeita respostas malformadas', () => {
    expect(() => respostaPossuiUsuarios({ success: true })).toThrow('Resposta inválida')
    expect(() => respostaPossuiUsuarios(null)).toThrow('Resposta inválida')
  })
})
