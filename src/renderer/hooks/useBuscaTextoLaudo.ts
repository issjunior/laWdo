import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from 'tinymce';
import { buscarTextoNoLaudo, rolarAteTextoLaudo } from '@/lib/busca-texto-laudo';

interface FonteBuscaLaudo {
  id: string;
  indice: number;
  criarCopia: () => HTMLElement;
}

interface OpcoesBuscaLaudo {
  laudoId?: string;
  fontes: FonteBuscaLaudo[];
  obterEditor: (id: string) => Editor | null | undefined;
  expandirSecao: (indice: number) => void;
}

interface ResultadoBuscaLaudo { editorId: string; indiceSecao: number; ocorrencia: number }

export function useBuscaTextoLaudo(opcoes: OpcoesBuscaLaudo) {
  const { fontes, obterEditor } = opcoes;
  const [aberta, setAberta] = useState(false);
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<ResultadoBuscaLaudo[]>([]);
  const [atual, setAtual] = useState(0);
  const [foco, setFoco] = useState(0);
  const opcoesRef = useRef(opcoes);
  opcoesRef.current = opcoes;
  const navegacaoRef = useRef(0);
  const invalidarNavegacao = useCallback(() => { navegacaoRef.current++; }, []);
  const limparDestaqueRef = useRef<() => void>(() => undefined);
  const abrir = useCallback(() => { setAberta(true); setFoco(valor => valor + 1); }, []);
  const fechar = useCallback(() => {
    invalidarNavegacao();
    limparDestaqueRef.current();
    setAberta(false);
  }, [invalidarNavegacao]);

  useEffect(() => {
    fechar(); setTermo(''); setResultados([]); setAtual(0);
  }, [opcoes.laudoId, fechar]);

  useEffect(() => {
    if (!opcoes.laudoId) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if ((evento.ctrlKey || evento.metaKey) && !evento.altKey && !evento.shiftKey && evento.key.toLowerCase() === 'f') {
        evento.preventDefault(); evento.stopImmediatePropagation(); abrir();
      } else if (evento.key === 'Escape') fechar();
    };
    window.addEventListener('keydown', aoTeclar, true);
    return () => window.removeEventListener('keydown', aoTeclar, true);
  }, [opcoes.laudoId, abrir, fechar]);

  useEffect(() => {
    if (!aberta) return;
    let temporizador: ReturnType<typeof setTimeout>;
    const atualizar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        const novos = opcoesRef.current.fontes.flatMap(fonte => {
          const raiz = opcoesRef.current.obterEditor(fonte.id)?.getBody() || fonte.criarCopia();
          return buscarTextoNoLaudo(raiz, termo).map((_, ocorrencia) => ({ editorId: fonte.id, indiceSecao: fonte.indice, ocorrencia }));
        });
        setResultados(novos);
        setAtual(indice => Math.min(indice, Math.max(0, novos.length - 1)));
      }, 200);
    };
    atualizar();
    const observador = new MutationObserver(atualizar);
    const editores = fontes.map(fonte => obterEditor(fonte.id)).filter((editor): editor is Editor => Boolean(editor));
    editores.forEach(editor => {
      const corpo = editor.getBody();
      if (corpo) observador.observe(corpo, { subtree: true, childList: true, characterData: true, attributes: true });
      editor.on('input change Undo Redo SetContent', atualizar);
    });
    return () => {
      clearTimeout(temporizador); observador.disconnect();
      editores.forEach(editor => editor.off('input change Undo Redo SetContent', atualizar));
    };
  }, [aberta, termo, fontes, obterEditor]);

  useEffect(() => {
    limparDestaqueRef.current();
    const resultado = resultados[atual];
    if (!aberta || !resultado) return;
    const navegacao = ++navegacaoRef.current;
    opcoesRef.current.expandirSecao(resultado.indiceSecao);
    let tentativa = 0;
    let temporizador: ReturnType<typeof setTimeout>;
    let limparDestaque: () => void = () => undefined;
    const destacar = () => {
      if (navegacao !== navegacaoRef.current) return;
      const editor = opcoesRef.current.obterEditor(resultado.editorId);
      const corpo = editor?.getBody();
      if (!corpo || editor?.removed || editor?.destroyed) {
        if (++tentativa < 30) temporizador = setTimeout(destacar, 50);
        return;
      }
      const intervalo = buscarTextoNoLaudo(corpo, termo)[resultado.ocorrencia]?.intervalo;
      if (!intervalo) {
        if (++tentativa < 30) temporizador = setTimeout(destacar, 50);
        return;
      }
      if (!rolarAteTextoLaudo(intervalo, editor?.iframeElement)) {
        if (++tentativa < 30) temporizador = setTimeout(destacar, 50);
        return;
      }
      const janela = corpo.ownerDocument.defaultView as (Window & typeof globalThis) | null;
      if (janela?.CSS?.highlights && janela.Highlight) {
        janela.CSS.highlights.set('laudo-busca', new janela.Highlight(intervalo));
        limparDestaque = () => { janela.CSS.highlights.delete('laudo-busca'); };
      } else {
        const selecao = corpo.ownerDocument.getSelection();
        selecao?.removeAllRanges(); selecao?.addRange(intervalo);
        limparDestaque = () => selecao?.removeAllRanges();
      }
      limparDestaqueRef.current = limparDestaque;
    };
    temporizador = setTimeout(destacar, 32);
    return () => { invalidarNavegacao(); clearTimeout(temporizador); limparDestaque(); };
  }, [aberta, atual, resultados, termo, invalidarNavegacao]);

  const navegar = (direcao: number) => {
    if (resultados.length) setAtual(indice => (indice + direcao + resultados.length) % resultados.length);
  };
  return { aberta, termo, setTermo, atual, total: resultados.length, foco, abrir, fechar, navegar };
}
