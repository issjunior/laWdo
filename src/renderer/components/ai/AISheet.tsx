import React, { useState, useRef, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, Loader2, Check, Copy, X } from 'lucide-react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AISheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secaoTitulo: string;
  editorId: string;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onApplyResponse: (texto: string) => void;
  loading?: boolean;
  error?: string | null;
}

export const AISheet: React.FC<AISheetProps> = ({
  open,
  onOpenChange,
  secaoTitulo,
  messages,
  onSendMessage,
  onApplyResponse,
  loading = false,
  error = null,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focar textarea ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[460px] flex flex-col p-0 [&>button]:hidden">
        <SheetHeader className="px-5 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base flex items-center gap-2">
              Assistente IA
              <Badge variant={loading ? 'secondary' : 'default'} className="text-[10px]">
                {loading ? 'Pensando...' : 'Online'}
              </Badge>
            </SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <span className="sr-only">Fechar</span>
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            Seção: {secaoTitulo}
          </p>
        </SheetHeader>

        {/* Área de mensagens */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            {messages.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <p>Digite uma pergunta sobre o laudo.</p>
                <p className="text-xs mt-1">A IA responde com base no contexto da seção atual.</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-xl px-4 py-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(msg.timestamp)}
                  </span>
                  {msg.role === 'assistant' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => handleCopy(msg.content)}
                        title="Copiar resposta"
                      >
                        <Copy size={10} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px]"
                        onClick={() => onApplyResponse(msg.content)}
                        title="Aplicar ao editor"
                      >
                        <Check size={10} className="mr-0.5" />
                        Aplicar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="bg-muted rounded-xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    Aguardando resposta...
                  </div>
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="text-xs">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input de pergunta */}
        <div className="border-t px-4 py-3 shrink-0 bg-background">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua pergunta... (Shift+Enter para nova linha)"
              className="min-h-[60px] resize-none text-sm"
              disabled={loading}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="shrink-0 self-end"
            >
              <Send size={16} />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            A IA pode cometer erros. Sempre revise antes de aplicar ao laudo.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AISheet;
