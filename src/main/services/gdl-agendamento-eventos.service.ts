type Ouvinte = (chave?: string) => void;
type OuvinteLista = (usuarioId: string, identidade: string) => void;
const ouvintesContexto = new Set<Ouvinte>();
const ouvintesLista = new Set<OuvinteLista>();
let versaoContexto = 0;

export function obterVersaoContextoGdl(): number {
  return versaoContexto;
}

export function observarContextoGdl(ouvinte: Ouvinte): () => void {
  ouvintesContexto.add(ouvinte);
  return () => { ouvintesContexto.delete(ouvinte); };
}

export function notificarContextoGdlAlterado(chave?: string): void {
  versaoContexto += 1;
  for (const ouvinte of ouvintesContexto) ouvinte(chave);
}

export function observarListaGdl(ouvinte: OuvinteLista): () => void {
  ouvintesLista.add(ouvinte);
  return () => { ouvintesLista.delete(ouvinte); };
}

export function notificarListaGdlAtualizada(usuarioId: string, identidade: string): void {
  for (const ouvinte of ouvintesLista) ouvinte(usuarioId, identidade);
}
