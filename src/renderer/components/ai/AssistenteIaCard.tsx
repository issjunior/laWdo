import { useEffect, useMemo, useState } from 'react';
import { Bot, ChevronDown, Image, Loader2, PenLine, Send, SpellCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface AssistenteIaCardProps {
  secaoIndex: number;
  secaoTitulo: string;
  htmlContent: string;
  processando?: boolean;
  erro?: string | null;
  onRevisarOrtografia: (html: string, secaoIndex: number) => Promise<void> | void;
  onAdequarEscrita: (html: string, secaoIndex: number) => Promise<void> | void;
  onDescreverImagem: (
    imagens: Array<{ src: string; alt?: string }>,
    secaoIndex: number,
  ) => Promise<void> | void;
  onPerguntar: (
    pergunta: string,
    html: string,
    secaoIndex: number,
    secaoTitulo: string,
  ) => Promise<void> | void;
  onOpenSheet: (secaoIndex: number, secaoTitulo: string) => void;
}

type AcaoIa = 'ortografia' | 'adequar' | 'imagem' | 'perguntar';

type ConfiguracaoResposta = {
  success: boolean;
  data?: string | null;
};

export function AssistenteIaCard({
  secaoIndex,
  secaoTitulo,
  htmlContent,
  processando = false,
  erro = null,
  onRevisarOrtografia,
  onAdequarEscrita,
  onDescreverImagem,
  onPerguntar,
  onOpenSheet,
}: AssistenteIaCardProps) {
  const [aberto, setAberto] = useState(false);
  const [pergunta, setPergunta] = useState('');
  const [acaoLocal, setAcaoLocal] = useState<AcaoIa | null>(null);
  const [nomeModelo, setNomeModelo] = useState('Carregando...');

  useEffect(() => {
    if (!aberto) return;

    void window.ipcAPI.configuracao.obter('provedor_ia').then(resposta => {
      const configuracao = resposta as ConfiguracaoResposta;
      if (!configuracao.success || !configuracao.data) {
        setNomeModelo('Nenhuma IA configurada');
        return;
      }

      const provedor = configuracao.data;
      const chaveModelo = provedor === 'gemini' ? 'modelo_gemini_padrao' : 'modelo_ia_padrao';
      const nomeProvedor = provedor === 'gemini' ? 'Google Gemini' : 'Groq';

      void window.ipcAPI.configuracao.obter(chaveModelo).then(respostaModelo => {
        const modelo = respostaModelo as ConfiguracaoResposta;
        setNomeModelo(modelo.success && modelo.data ? `${nomeProvedor} · ${modelo.data}` : nomeProvedor);
      });
    });
  }, [aberto]);

  const imagens = useMemo(() => {
    try {
      const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
      return Array.from(doc.querySelectorAll('img'))
        .filter(img => (
          img.src.startsWith('data:')
          || img.src.startsWith('http://')
          || img.src.startsWith('https://')
          || img.src.startsWith('blob:')
        ))
        .map(img => ({ src: img.src, alt: img.alt || undefined }));
    } catch {
      return [];
    }
  }, [htmlContent]);

  const executar = async (acao: AcaoIa) => {
    if (processando || acaoLocal) return;
    if (!htmlContent.trim() && acao !== 'perguntar') return;
    if (acao === 'perguntar' && !pergunta.trim()) return;
    if (acao === 'imagem' && imagens.length === 0) return;

    setAcaoLocal(acao);
    onOpenSheet(secaoIndex, secaoTitulo);
    try {
      if (acao === 'ortografia') await onRevisarOrtografia(htmlContent, secaoIndex);
      if (acao === 'adequar') await onAdequarEscrita(htmlContent, secaoIndex);
      if (acao === 'imagem') await onDescreverImagem(imagens, secaoIndex);
      if (acao === 'perguntar') {
        await onPerguntar(pergunta.trim(), htmlContent, secaoIndex, secaoTitulo);
        setPergunta('');
      }
    } finally {
      setAcaoLocal(null);
    }
  };

  const emProcessamento = processando || acaoLocal !== null;

  if (!aberto) {
    return (
      <div className="mb-3 flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAberto(true)}
          aria-expanded="false"
          className="gap-1.5"
        >
          <Bot className="size-4 text-primary" />
          Assistente IA
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-3 overflow-hidden rounded-lg border bg-muted/30">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Bot className="size-4 shrink-0 text-primary" />
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <p className="whitespace-nowrap font-medium">Assistente IA</p>
            <span aria-hidden="true" className="text-muted-foreground">|</span>
            <p className="truncate text-muted-foreground">Contexto: {secaoTitulo}</p>
            <span aria-hidden="true" className="text-muted-foreground">|</span>
            <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-primary/70" />
              Modelo ativo: {nomeModelo}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAberto(false)}
          aria-expanded="true"
          aria-label="Recolher assistente de IA"
          className="gap-1.5"
        >
          Recolher
          <ChevronDown className="size-4 rotate-180" />
        </Button>
      </div>

      <div className="bg-muted/20 p-3">
        {erro && (
          <Alert variant="destructive" className="mb-3 py-2">
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={emProcessamento || !htmlContent.trim()}
              onClick={() => void executar('ortografia')}
              className="gap-1.5"
            >
              {acaoLocal === 'ortografia'
                ? <Loader2 className="size-3.5 animate-spin" />
                : <SpellCheck className="size-3.5" />}
              Revisar ortografia
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={emProcessamento || !htmlContent.trim()}
              onClick={() => void executar('adequar')}
              className="gap-1.5"
            >
              {acaoLocal === 'adequar'
                ? <Loader2 className="size-3.5 animate-spin" />
                : <PenLine className="size-3.5" />}
              Adequar redação
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={emProcessamento || imagens.length === 0}
              onClick={() => void executar('imagem')}
              className="gap-1.5"
            >
              {acaoLocal === 'imagem'
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Image className="size-3.5" />}
              Descrever imagens
            </Button>
            <div className="flex min-w-[240px] flex-1 items-center gap-2 lg:ml-auto lg:max-w-md">
              <Input
                value={pergunta}
                onChange={evento => setPergunta(evento.target.value)}
                onKeyDown={evento => {
                  if (evento.key === 'Enter' && pergunta.trim()) {
                    evento.preventDefault();
                    void executar('perguntar');
                  }
                }}
                placeholder="Pergunte sobre esta seção"
                disabled={emProcessamento}
                className="h-8 text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Enviar pergunta à IA"
                disabled={emProcessamento || !pergunta.trim()}
                onClick={() => void executar('perguntar')}
                className="size-8 shrink-0"
              >
                {acaoLocal === 'perguntar'
                  ? <Loader2 className="size-4 animate-spin" />
                  : <Send className="size-4" />}
              </Button>
            </div>
        </div>
      </div>
    </div>
  );
}
