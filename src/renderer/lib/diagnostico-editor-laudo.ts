import type { EventoEditorLaudo } from '@shared/diagnostico/contratos';

export function capturaProblemaLaudoAtiva(): boolean {
  return window.ipcAPI?.diagnosticoInterno?.capturaProblemaAtiva?.() === true;
}

export function registrarDiagnosticoEditorLaudo(evento: EventoEditorLaudo): void {
  if (capturaProblemaLaudoAtiva()) window.ipcAPI.diagnosticoInterno.registrarEventoEditorLaudo(evento);
}

type Diferenca = NonNullable<EventoEditorLaudo['diferencas']>[number];

export function resumirComparacaoEditorLaudo(referencia: string, atual: string): Pick<EventoEditorLaudo,
  'pendente' | 'referenciaTamanho' | 'atualTamanho' | 'ocultosReferencia' | 'ocultosAtual' | 'previasReferencia' | 'previasAtual' | 'diferencas'> {
  const parser = new DOMParser();
  const raizReferencia = parser.parseFromString(referencia, 'text/html').body;
  const raizAtual = parser.parseFromString(atual, 'text/html').body;
  const diferencas: Diferenca[] = [];

  const adicionar = (posicao: string, tag: string, categoria: Diferenca['categoria'], atributo?: string, medidas: Partial<Diferenca> = {}) => {
    if (diferencas.length < 10) diferencas.push({ posicao, tag: tag.toLowerCase(), categoria, ...(atributo ? { atributo } : {}), ...medidas });
  };

  const percorrer = (anterior: Node | undefined, presente: Node | undefined, caminho: number[], dentroTabela: boolean) => {
    if (diferencas.length >= 10 || (!anterior && !presente)) return;
    const posicao = caminho.slice(0, 20).join('/');
    const tag = (presente ?? anterior)?.nodeName.toLowerCase() ?? 'desconhecido';
    if (!anterior || !presente || anterior.nodeType !== presente.nodeType || anterior.nodeName !== presente.nodeName) {
      adicionar(posicao, tag.startsWith('#') ? 'texto' : tag, dentroTabela ? 'tabela' : 'estrutura');
      return;
    }
    if (anterior.nodeType === Node.TEXT_NODE) {
      if (anterior.textContent !== presente.textContent) {
        const antes = anterior.textContent ?? '';
        const depois = presente.textContent ?? '';
        adicionar(posicao, 'texto', dentroTabela ? 'tabela' : 'texto', undefined, {
          tamanhoAnterior: antes.length, tamanhoAtual: depois.length,
          apenasEspacosAnterior: !antes.trim(), apenasEspacosAtual: !depois.trim(),
          espacosInicioAnterior: antes.match(/^\s*/u)?.[0].length ?? 0,
          espacosInicioAtual: depois.match(/^\s*/u)?.[0].length ?? 0,
          espacosFimAnterior: antes.match(/\s*$/u)?.[0].length ?? 0,
          espacosFimAtual: depois.match(/\s*$/u)?.[0].length ?? 0,
        });
      }
      return;
    }
    if (anterior instanceof Element && presente instanceof Element) {
      const tabela = dentroTabela || anterior.tagName === 'TABLE' || presente.tagName === 'TABLE';
      const atributos = new Set([...anterior.getAttributeNames(), ...presente.getAttributeNames()]);
      for (const atributo of [...atributos].sort()) {
        if (anterior.getAttribute(atributo) === presente.getAttribute(atributo)) continue;
        adicionar(posicao, tag, tabela ? 'tabela' : tag === 'img' || atributo === 'src' ? 'imagem' : atributo === 'style' || atributo === 'class' ? 'estilo' : 'estrutura', atributo);
      }
      const total = Math.max(anterior.childNodes.length, presente.childNodes.length);
      for (let indice = 0; indice < total && diferencas.length < 10; indice += 1) {
        percorrer(anterior.childNodes[indice], presente.childNodes[indice], [...caminho, indice], tabela);
      }
    }
  };

  const total = Math.max(raizReferencia.childNodes.length, raizAtual.childNodes.length);
  for (let indice = 0; indice < total && diferencas.length < 10; indice += 1) {
    percorrer(raizReferencia.childNodes[indice], raizAtual.childNodes[indice], [indice], false);
  }

  return {
    pendente: referencia !== atual,
    referenciaTamanho: referencia.length,
    atualTamanho: atual.length,
    ocultosReferencia: raizReferencia.querySelectorAll('[data-placeholder][style*="display: none"]').length,
    ocultosAtual: raizAtual.querySelectorAll('[data-placeholder][style*="display: none"]').length,
    previasReferencia: raizReferencia.querySelectorAll('[data-placeholder-preview="true"]').length,
    previasAtual: raizAtual.querySelectorAll('[data-placeholder-preview="true"]').length,
    diferencas,
  };
}
