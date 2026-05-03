import { describe, it, expect } from 'vitest'
import {
  userSchema,
  createUserSchema,
  updateUserSchema,
  loginSchema,
  userResponseSchema,
  type User,
  type CreateUserInput,
  type UpdateUserInput,
  type LoginInput,
} from '@/lib/validators/user.schema'

describe('User Schema', () => {
  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    nome: 'João da Silva',
    matricula: '12345',
    cargo: 'Perito Criminal',
    lotacao: 'Núcleo de Perícias Criminais',
    email: 'joao.silva@pcpr.pr.gov.br',
    telefone: '(41) 3270-9100',
    username: 'joao.silva',
    senha_hash: 'hashed_password_123',
    ativo: true,
    data_criacao: new Date('2024-01-01'),
    data_atualizacao: new Date('2024-01-01'),
  }

  describe('userSchema', () => {
    it('deve validar um usuário válido', () => {
      expect(() => userSchema.parse(mockUser)).not.toThrow()
    })

    it('deve rejeitar nome muito curto', () => {
      const invalidUser = { ...mockUser, nome: 'J' }
      expect(() => userSchema.parse(invalidUser)).toThrow('Nome deve ter pelo menos 2 caracteres')
    })

    it('deve rejeitar email inválido', () => {
      const invalidUser = { ...mockUser, email: 'email-invalido' }
      expect(() => userSchema.parse(invalidUser)).toThrow('Email inválido')
    })

    it('deve rejeitar username com caracteres inválidos', () => {
      const invalidUser = { ...mockUser, username: 'joão silva' }
      expect(() => userSchema.parse(invalidUser)).toThrow('Username pode conter apenas letras, números, pontos, underscores e hífens')
    })

    it('deve aceitar telefone como nulo', () => {
      const userSemTelefone = { ...mockUser, telefone: null }
      expect(() => userSchema.parse(userSemTelefone)).not.toThrow()
    })
  })

  describe('createUserSchema', () => {
    const mockCreateUser: CreateUserInput = {
      nome: 'Maria Santos',
      matricula: '54321',
      cargo: 'Perita Criminal',
      lotacao: 'Núcleo de Perícias Criminais',
      email: 'maria.santos@pcpr.pr.gov.br',
      telefone: '(41) 3270-9200',
      username: 'maria.santos',
      senha: 'Senha123@',
      confirmar_senha: 'Senha123@',
    }

    it('deve validar criação de usuário válido', () => {
      expect(() => createUserSchema.parse(mockCreateUser)).not.toThrow()
    })

    it('deve rejeitar senha fraca', () => {
      const invalidCreate = { ...mockCreateUser, senha: 'senha', confirmar_senha: 'senha' }
      expect(() => createUserSchema.parse(invalidCreate)).toThrow('Senha deve ter pelo menos 8 caracteres')
    })

    it('deve rejeitar senha sem número', () => {
      const invalidCreate = { ...mockCreateUser, senha: 'SenhaSemNumero', confirmar_senha: 'SenhaSemNumero' }
      expect(() => createUserSchema.parse(invalidCreate)).toThrow('Senha deve conter pelo menos um número')
    })

    it('deve rejeitar senhas que não conferem', () => {
      const invalidCreate = { ...mockCreateUser, confirmar_senha: 'SenhaDiferente123' }
      expect(() => createUserSchema.parse(invalidCreate)).toThrow('Senhas não conferem')
    })
  })

  describe('updateUserSchema', () => {
    const mockUpdate: UpdateUserInput = {
      nome: 'João da Silva Atualizado',
      email: 'joao.atualizado@pcpr.pr.gov.br',
      telefone: '(41) 9999-8888',
    }

    it('deve validar atualização válida', () => {
      expect(() => updateUserSchema.parse(mockUpdate)).not.toThrow()
    })

    it('deve rejeitar atualização de senha sem senha atual', () => {
      const invalidUpdate = {
        ...mockUpdate,
        nova_senha: 'NovaSenha123',
        confirmar_nova_senha: 'NovaSenha123'
      }
      expect(() => updateUserSchema.parse(invalidUpdate)).toThrow('Senha atual é necessária para alterar a senha')
    })

    it('deve rejeitar nova senha que não confere com confirmação', () => {
      const invalidUpdate = {
        ...mockUpdate,
        senha_atual: 'SenhaAntiga123',
        nova_senha: 'NovaSenha123',
        confirmar_nova_senha: 'NovaSenha456'
      }
      expect(() => updateUserSchema.parse(invalidUpdate)).toThrow('Nova senha e confirmação não conferem')
    })

    it('deve permitir atualização apenas de alguns campos', () => {
      const partialUpdate = {
        telefone: '(41) 3270-9300'
      }
      expect(() => updateUserSchema.parse(partialUpdate)).not.toThrow()
    })
  })

  describe('loginSchema', () => {
    const mockLogin: LoginInput = {
      username: 'joao.silva',
      senha: 'Senha123'
    }

    it('deve validar login válido', () => {
      expect(() => loginSchema.parse(mockLogin)).not.toThrow()
    })

    it('deve rejeitar login sem username', () => {
      const invalidLogin = { ...mockLogin, username: '' }
      expect(() => loginSchema.parse(invalidLogin)).toThrow('Username é obrigatório')
    })

    it('deve rejeitar login sem senha', () => {
      const invalidLogin = { ...mockLogin, senha: '' }
      expect(() => loginSchema.parse(invalidLogin)).toThrow('Senha é obrigatória')
    })
  })

  describe('userResponseSchema', () => {
    it('deve remover senha_hash da resposta', () => {
      const response = userResponseSchema.parse(mockUser)
      expect(response).not.toHaveProperty('senha_hash')
      expect(response.id).toBe(mockUser.id)
      expect(response.nome).toBe(mockUser.nome)
      expect(response.email).toBe(mockUser.email)
    })
  })
})