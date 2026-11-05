import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  consultar: vi.fn(),
  executar: vi.fn(),
  criptografiaDisponivel: vi.fn(),
  criptografar: vi.fn(),
  descriptografar: vi.fn(),
  aviso: vi.fn(),
  erro: vi.fn(),
  notificarContexto: vi.fn(),
  notificarAvisos: vi.fn(),
}))

vi.mock('../../main/database/sqlite.js', () => ({
  executeQuery: (...args: unknown[]) => mocks.consultar(...args),
  executeNonQuery: (...args: unknown[]) => mocks.executar(...args),
}))

vi.mock('../../main/utils/logger.js', () => ({
  getLogger: () => ({ warn: mocks.aviso, error: mocks.erro, info: vi.fn() }),
}))

vi.mock('../../main/services/gdl-agendamento-eventos.service.js', () => ({
  notificarContextoGdlAlterado: mocks.notificarContexto,
}))
vi.mock('../../main/services/gdl-avisos-eventos.service.js', () => ({
  notificarAvisosGdlAlterados: mocks.notificarAvisos,
}))

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => mocks.criptografiaDisponivel(),
    encryptString: (valor: string) => mocks.criptografar(valor),
    decryptString: (valor: Buffer) => mocks.descriptografar(valor),
  },
}))

import { configuracaoService } from '../../main/services/configuracao.service'
import { safeStorageService } from '../../main/services/safe-storage.service'

describe('configuração e armazenamento seguro', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.criptografiaDisponivel.mockReturnValue(true)
  })

  it.each(['producao', 'homologacao'] as const)('exclui credenciais somente de %s e invalida o contexto após persistir', async ambiente => {
    await configuracaoService.excluirCredenciaisGdl(ambiente)
    expect(mocks.executar).toHaveBeenCalledWith('DELETE FROM configuracoes WHERE chave IN (?, ?, ?)', [
      `gdl_login_${ambiente}`, `gdl_senha_${ambiente}`, `gdl_cpf_usuario_${ambiente}`,
    ])
    expect(mocks.notificarContexto).toHaveBeenCalledWith(`gdl_login_${ambiente}`)
    expect(mocks.notificarAvisos).toHaveBeenCalledWith(true)
  })

  it('não comunica exclusão quando o banco falha', async () => {
    mocks.executar.mockRejectedValue(new Error('Falha de gravação'))
    await expect(configuracaoService.excluirCredenciaisGdl('producao')).rejects.toThrow('Falha de gravação')
    expect(mocks.notificarContexto).not.toHaveBeenCalled()
    expect(mocks.notificarAvisos).not.toHaveBeenCalled()
  })

  it('criptografa segredos e atualiza uma configuração já existente', async () => {
    mocks.criptografar.mockReturnValue(Buffer.from('valor-cifrado'))
    mocks.consultar.mockResolvedValue([{ chave: 'gemini_api_key' }])
    mocks.executar.mockResolvedValue(undefined)

    await configuracaoService.salvar('gemini_api_key', 'segredo', 'api_key', 'Chave Gemini')

    expect(mocks.criptografar).toHaveBeenCalledWith('segredo')
    expect(mocks.executar).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE configuracoes SET valor'),
      ['dmFsb3ItY2lmcmFkbw==', 'api_key', 'Chave Gemini', 'gemini_api_key'],
    )
  })

  it('cria configuração comum sem criptografar e devolve valor simples', async () => {
    mocks.consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { chave: 'cabecalho', valor: '<h1>Laudo</h1>', tipo: 'html' },
    ])
    mocks.executar.mockResolvedValue(undefined)

    await configuracaoService.salvar('cabecalho', '<h1>Laudo</h1>')
    await expect(configuracaoService.obter('cabecalho')).resolves.toBe('<h1>Laudo</h1>')

    expect(mocks.criptografar).not.toHaveBeenCalled()
    expect(mocks.executar).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO configuracoes'),
      ['cabecalho', '<h1>Laudo</h1>', 'html', ''],
    )
  })

  it('descriptografa segredos e preserva null quando a chave não existe', async () => {
    mocks.consultar.mockResolvedValueOnce([
      { chave: 'senha', valor: 'Y2lmcmFkbw==', tipo: 'senha' },
    ]).mockResolvedValueOnce([])
    mocks.descriptografar.mockReturnValue('texto-original')

    await expect(configuracaoService.obter('senha')).resolves.toBe('texto-original')
    await expect(configuracaoService.obter('ausente')).resolves.toBeNull()
    expect(mocks.descriptografar).toHaveBeenCalledWith(Buffer.from('Y2lmcmFkbw==', 'base64'))
  })

  it('usa valor bruto quando o armazenamento seguro está indisponível ou não consegue descriptografar', () => {
    mocks.criptografiaDisponivel.mockReturnValue(false)
    expect(safeStorageService.encrypt('valor')).toBe('valor')
    expect(safeStorageService.decrypt('valor')).toBe('valor')
    expect(mocks.aviso).toHaveBeenCalled()

    mocks.criptografiaDisponivel.mockReturnValue(true)
    mocks.descriptografar.mockImplementation(() => { throw new Error('chave inválida') })
    expect(safeStorageService.decrypt('YQ==')).toBe('YQ==')
    expect(mocks.aviso).toHaveBeenCalledWith(expect.stringContaining('Falha ao descriptografar'))
  })
})
