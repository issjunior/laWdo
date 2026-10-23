import { describe, expect, it, vi } from 'vitest'
import { buildPlaceholderMapping, resolverPlaceholdersExportacao } from '../../renderer/lib/exportacao-placeholders'
import { criarDadosB601 } from '../../shared/types/b601.types'

describe('placeholders de exportação', () => {
  describe.each(['b601', 'b602'])('cidade da unidade policial em %s', exame => {
    it.each([undefined, '', '   ', ' TELÊMACO BORBA ', 'São João & <Cidade>'])('acrescenta somente a cidade válida na tabela: %s', cidade => {
      const ctx = {
        solicitanteNome: 'UNIDADE POLICIAL',
        repData: { campos_especificos: JSON.stringify({
          [exame]: { ...criarDadosB601(), solicitante_nome: 'UNIDADE LOCAL', local: { bairro: '', cidade: 'CURITIBA', uf: '' } },
          integracaoGdl: { dadosSolicitacao: { orgao: 'ÓRGÃO GDL', cidade } },
        }) },
      }
      const mapa = buildPlaceholderMapping(ctx)
      const tabela = new DOMParser().parseFromString(mapa[`${exame}_tabela_dados_investigacao`], 'text/html')
      expect(tabela.querySelector('tr:last-child td:last-child')?.textContent)
        .toBe(cidade?.trim() ? `UNIDADE POLICIAL / ${cidade.trim()}` : 'UNIDADE POLICIAL')
      expect(tabela.querySelector('cidade')).toBeNull()
      expect(mapa.solicitante_nome).toBe('UNIDADE POLICIAL')
      expect(resolverPlaceholdersExportacao('oriundo da {{solicitante_nome}}.', ctx)).toBe('oriundo da UNIDADE POLICIAL.')
    })

    it('ignora cidade com formato inválido na fronteira JSON', () => {
      const mapa = buildPlaceholderMapping({ repData: { campos_especificos: JSON.stringify({
        [exame]: { ...criarDadosB601(), solicitante_nome: 'UNIDADE' },
        integracaoGdl: { dadosSolicitacao: { orgao: 'UNIDADE', cidade: { nome: 'CURITIBA' } } },
      }) } })
      const tabela = new DOMParser().parseFromString(mapa[`${exame}_tabela_dados_investigacao`], 'text/html')
      expect(tabela.querySelector('tr:last-child td:last-child')?.textContent).toBe('UNIDADE')
    })
  })

  it.each([
    '<code>{{solicitante_nome}}</code>',
    '<code><span class="placeholder-tag" data-placeholder="{{solicitante_nome}}">VALOR ANTERIOR</span></code>',
  ])('exporta o solicitante com a fonte do parágrafo sem marcação de código: %s', campo => {
    const html = `<p style="font-family: Arial; font-size: 12pt">oriundo da ${campo}.</p>`
    const resultado = resolverPlaceholdersExportacao(html, { repData: {}, solicitanteNome: 'UNIDADE POLICIAL' })
    const doc = new DOMParser().parseFromString(resultado, 'text/html')
    expect(doc.querySelector('code')).toBeNull()
    expect(doc.querySelector('p')?.style.fontFamily).toBe('Arial')
    expect(doc.querySelector('p')?.style.fontSize).toBe('12pt')
    expect(doc.body.textContent).toBe('oriundo da UNIDADE POLICIAL.')
    expect(doc.querySelector('.placeholder-tag')).toBeNull()
  })

  it.each([
    { vinculado: '', local: 'UNIDADE LOCAL', orgao: 'ÓRGÃO GDL', esperado: 'UNIDADE LOCAL' },
    { vinculado: '', local: '', orgao: 'ÓRGÃO GDL', esperado: 'ÓRGÃO GDL' },
    { vinculado: 'SOLICITANTE VINCULADO', local: 'UNIDADE LOCAL', orgao: 'ÓRGÃO GDL', esperado: 'SOLICITANTE VINCULADO' },
  ])('resolve os solicitantes B601 pela prioridade $esperado', ({ vinculado, local, orgao, esperado }) => {
    const ctx = {
      solicitanteNome: vinculado,
      repData: { campos_especificos: JSON.stringify({
        b601: { ...criarDadosB601(), solicitante_nome: local },
        integracaoGdl: { dadosSolicitacao: { orgao } },
      }) },
    }
    const mapa = buildPlaceholderMapping(ctx)
    expect(mapa.solicitante_nome).toBe(esperado)
    expect(mapa.b601_solicitante_nome).toBe(esperado)
    expect(mapa.b601_tabela_dados_investigacao).toContain(esperado)
    expect(resolverPlaceholdersExportacao('oriundo da <span data-placeholder="{{solicitante_nome}}">XXX</span>.', ctx)).toBe(`oriundo da ${esperado}.`)
    expect(resolverPlaceholdersExportacao('{{b601_solicitante_nome}}', ctx)).toBe(esperado)
  })

  it('mantém ausência do solicitante B601 visível e não converte objetos externos em nomes', () => {
    const ctx = { repData: { campos_especificos: JSON.stringify({
      b601: criarDadosB601(), integracaoGdl: { dadosSolicitacao: { orgao: { nome: 'Não confirmado' } } },
    }) } }
    const mapa = buildPlaceholderMapping(ctx)
    expect(mapa.solicitante_nome).toBe('')
    expect(mapa.b601_solicitante_nome).toBe('')
    expect(resolverPlaceholdersExportacao('{{solicitante_nome}}', ctx)).toContain('XXX')
  })

  it('usa a data da última execução GDL somente no placeholder por extenso', () => {
    const placeholders = buildPlaceholderMapping({
      repData: {
        data_requisicao: '2026-08-23',
        campos_especificos: JSON.stringify({
          integracaoGdl: { dataExecucaoLaudo: '2026-08-25' },
        }),
      },
    })

    expect(placeholders.data_recebimento_rep).toBe('23/08/2026')
    expect(placeholders.data_extenso_recebimento_rep).toBe('25 de agosto de 2026')
  })

  it('mantém data de recebimento como fallback sem metadado GDL', () => {
    const placeholders = buildPlaceholderMapping({
      repData: { data_requisicao: '2026-08-23' },
    })

    expect(placeholders.data_extenso_recebimento_rep).toBe('23 de agosto de 2026')
  })

  it('inclui valores padrão de placeholders personalizados na resolução', () => {
    const placeholders = buildPlaceholderMapping({
      repData: {},
      placeholdersPersonalizados: [{ chave: 'nome_laboratorio', valor: 'Núcleo de Perícias' }],
    })

    expect(placeholders.nome_laboratorio).toBe('Núcleo de Perícias')
  })

  it('resolve as expressões do perito conforme o perfil da sessão', () => {
    const usuario = { id: 'perita-1', username: 'perita', nome: 'Ana', email: 'ana@example.test', cargo: 'Perito Oficial Criminal', forma_tratamento: 'feminino' }
    try {
      vi.mocked(window.sessionStorage.getItem).mockReturnValue(JSON.stringify(usuario))
      expect(buildPlaceholderMapping({ repData: {} })).toMatchObject({
        perito_nome: 'Ana',
        perito_cargo: 'Perita Oficial Criminal',
        perito_artigo: 'a',
        perito_titulo: 'Perita',
        perito_designado: 'designada',
        perito_pelo: 'pela',
        perito_qual: 'a qual',
      })
    } finally {
      vi.mocked(window.sessionStorage.getItem).mockReset()
    }
  })
})
