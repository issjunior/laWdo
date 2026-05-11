import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  SpellCheck,
  PenLine,
  Image,
  Send,
  Loader2,
  Bot,
} from 'lucide-react';

export interface AISectionToolbarProps {
  editorId: string;
  secaoIndex: number;
  secaoTitulo: string;
  htmlContent: string;
  onRevisarOrtografia: (html: string, secaoIndex: number) => void;
  onAdequarEscrita: (html: string, secaoIndex: number) => void;
  onDescreverImagem: (imagens: Array<{ src: string; alt?: string }>, secaoIndex: number) => void;
  onPerguntar: (pergunta: string, html: string, secaoIndex: number, secaoTitulo: string) => void;
  onOpenSheet?: (secaoIndex: number, secaoTitulo: string) => void;
}

export const AISectionToolbar: React.FC<AISectionToolbarProps> = ({
  secaoIndex,
  secaoTitulo,
  htmlContent,
  onRevisarOrtografia,
  onAdequarEscrita,
  onDescreverImagem,
  onPerguntar,
  onOpenSheet,
}) => {
  const [pergunta, setPergunta] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Verificar se há imagens no HTML
  const temImagens = useMemo(() => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const imgs = doc.querySelectorAll('img');
      // Filtrar apenas imagens com src válido (data-URI ou HTTP)
      return Array.from(imgs).some(
        (img) =>
          img.src.startsWith('data:') ||
          img.src.startsWith('http://') ||
          img.src.startsWith('https://')
      );
    } catch {
      return false;
    }
  }, [htmlContent]);

  const extrairImagens = (): Array<{ src: string; alt?: string }> => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const imgs = doc.querySelectorAll('img');
      return Array.from(imgs)
        .filter(
          (img) =>
            img.src.startsWith('data:') ||
            img.src.startsWith('http://') ||
            img.src.startsWith('https://')
        )
        .map((img) => ({ src: img.src, alt: img.alt }));
    } catch {
      return [];
    }
  };

  const handleAction = async (
    action: 'ortografia' | 'adequar' | 'imagem' | 'perguntar'
  ) => {
    setError(null);
    setLoading(action);

    try {
      switch (action) {
        case 'ortografia':
          if (!htmlContent.trim()) {
            setError('Texto vazio na seção');
            return;
          }
          await onRevisarOrtografia(htmlContent, secaoIndex);
          break;
        case 'adequar':
          if (!htmlContent.trim()) {
            setError('Texto vazio na seção');
            return;
          }
          // Abre o sheet para mostrar o resultado
          if (onOpenSheet) onOpenSheet(secaoIndex, secaoTitulo);
          await onAdequarEscrita(htmlContent, secaoIndex);
          break;
        case 'imagem': {
          const imagens = extrairImagens();
          if (imagens.length === 0) {
            setError('Nenhuma imagem válida encontrada na seção');
            return;
          }
          if (onOpenSheet) onOpenSheet(secaoIndex, secaoTitulo);
          await onDescreverImagem(imagens, secaoIndex);
          break;
        }
        case 'perguntar':
          if (!pergunta.trim()) {
            setError('Digite uma pergunta');
            return;
          }
          if (onOpenSheet) onOpenSheet(secaoIndex, secaoTitulo);
          await onPerguntar(pergunta, htmlContent, secaoIndex, secaoTitulo);
          setPergunta('');
          break;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar solicitação';
      setError(msg);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2 mb-3">
      {error && (
        <Alert variant="destructive" className="text-xs py-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Bot size={14} className="text-primary" />
          <span className="text-xs font-medium text-muted-foreground">IA:</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => handleAction('ortografia')}
          disabled={loading !== null}
          title="Revisar ortografia e gramática"
        >
          {loading === 'ortografia' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <SpellCheck size={12} />
          )}
          Ortografia
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => handleAction('adequar')}
          disabled={loading !== null}
          title="Reescrever em tom pericial formal"
        >
          {loading === 'adequar' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <PenLine size={12} />
          )}
          Adequar
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => handleAction('imagem')}
          disabled={loading !== null || !temImagens}
          title="Descrever imagens com IA"
        >
          {loading === 'imagem' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Image size={12} />
          )}
          Imagem
        </Button>

        <div className="flex items-center gap-1.5 ml-auto">
          <Input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pergunta.trim()) {
                e.preventDefault();
                handleAction('perguntar');
              }
            }}
            placeholder="Pergunte à IA..."
            className="h-7 text-xs w-[200px]"
            disabled={loading !== null}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => handleAction('perguntar')}
            disabled={loading !== null || !pergunta.trim()}
            title="Enviar pergunta"
          >
            {loading === 'perguntar' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AISectionToolbar;
