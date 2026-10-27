import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { app } from 'electron'

const DIRETORIO_CACHE = path.join(app.getPath('userData'), 'gdl', 'cache-fotos')
const LIMITE_ENTRADAS_CACHE = 20
const LIMITE_BYTES_ENTRADA_CACHE = 1024 * 1024
const PADRAO_HASH = /^[a-f0-9]{64}$/

export interface CacheFotosGdl {
  hashes: Map<string, string>
  salvar: () => void
}

export function abrirCacheFotosGdl(ambiente: string, numero: string, ano: string, hashZip: string, versao: string): CacheFotosGdl {
  const chave = createHash('sha256').update(JSON.stringify([ambiente, numero, ano, hashZip, versao])).digest('hex')
  const caminho = path.join(DIRETORIO_CACHE, `${chave}.json`)
  let hashes = new Map<string, string>()

  try {
    if (fs.statSync(caminho).size > LIMITE_BYTES_ENTRADA_CACHE) throw new Error('Cache de fotos acima do limite.')
    const conteudo: unknown = JSON.parse(fs.readFileSync(caminho, 'utf8'))
    if (conteudo && typeof conteudo === 'object' && 'hashes' in conteudo && conteudo.hashes && typeof conteudo.hashes === 'object' && !Array.isArray(conteudo.hashes)) {
      hashes = new Map(Object.entries(conteudo.hashes).filter(([id, hash]) => PADRAO_HASH.test(id) && typeof hash === 'string' && PADRAO_HASH.test(hash)) as [string, string][])
    }
  } catch {
    hashes = new Map()
  }

  return {
    hashes,
    salvar: () => {
      let temporario: string | null = null
      try {
        fs.mkdirSync(DIRETORIO_CACHE, { recursive: true })
        temporario = `${caminho}.${randomUUID()}.tmp`
        fs.writeFileSync(temporario, JSON.stringify({ hashes: Object.fromEntries(hashes) }), { encoding: 'utf8', flag: 'wx' })
        fs.renameSync(temporario, caminho)
        temporario = null
        const arquivos = fs.readdirSync(DIRETORIO_CACHE)
          .filter(nome => PADRAO_HASH.test(nome.replace(/\.json$/, '')) && nome.endsWith('.json'))
          .map(nome => ({ nome, data: fs.statSync(path.join(DIRETORIO_CACHE, nome)).mtimeMs }))
          .sort((a, b) => b.data - a.data)
        for (const arquivo of arquivos.slice(LIMITE_ENTRADAS_CACHE)) fs.unlinkSync(path.join(DIRETORIO_CACHE, arquivo.nome))
      } catch {
        if (temporario) {
          try { fs.unlinkSync(temporario) } catch { /* arquivo temporário já removido */ }
        }
      }
    },
  }
}
