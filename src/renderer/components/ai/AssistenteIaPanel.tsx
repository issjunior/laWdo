import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Bot, ChevronsRight, Send, Loader2, Check, Copy, ExternalLink, Trash2, X } from 'lucide-react';
import type { AcaoIa, ProgressoIa, RetomadaIa } from '@shared/types/ia.types';

type AcaoPainelIa = AcaoIa | 'descrever_imagem';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  aplicacao?: 'inserir' | 'substituir';
  acao?: AcaoPainelIa;
  alvo?: { id: string; indice: number; conteudo: string; tipo: 'selecao' | 'secao' | 'laudo_completo' | 'cursor' };
  conteudoProposto?: string;
  proposalId?: string;
  permiteAplicacao?: boolean;
}

const rotulosAcaoIa: Record<AcaoPainelIa, string> = {
  ortografia: 'Ortografia',
  tecnico_pericial: 'Técnico-pericial',
  reescrever: 'Reescrever',
  clareza: 'Clareza',
  resumir: 'Resumir',
  expandir: 'Expandir',
  inserir: 'Inserir',
  descrever_imagem: 'Descrever imagem',
};

interface AssistenteIaPanelProps {
  secaoTitulo: string;
  editorId: string;
  messages: ChatMessage[];
  onSendMessage: (message: string, acao: 'inserir' | 'reescrever') => void;
  onLimparConversa?: () => void;
  onApplyResponse: (mensagem: ChatMessage) => void;
  modoAplicacao?: 'inserir' | 'substituir';
  loading?: boolean;
  progresso?: ProgressoIa | null;
  error?: string | null;
  opcoesEscopo?: Array<{ id: number; titulo: string }>;
  escopoSelecionado?: number | null;
  onSelecionarEscopo?: (id: number) => void;
  onExecutarAcao?: (acao: AcaoIa) => void;
  onDestacar?: () => void;
  onReencaixar?: () => void;
  onRecolher?: () => void;
  onFechar?: () => void;
  onCancelarOperacao?: () => void;
  onRetomarOperacao?: () => void;
  retomada?: RetomadaIa | null;
  onDescreverImagens?: () => void;
  imagemSelecionada?: boolean;
  contextoImagem?: boolean;
}

type ContextoIaResposta = {
  success: boolean;
  data?: { configurado: boolean; provedor?: 'groq' | 'gemini'; modelo?: string };
};

export const AssistenteIaPanel: React.FC<AssistenteIaPanelProps> = ({
  secaoTitulo,
  editorId,
  messages,
  onSendMessage,
  onLimparConversa,
  onApplyResponse,
  modoAplicacao = 'inserir',
  loading = false,
  progresso = null,
  error = null,
  opcoesEscopo = [],
  escopoSelecionado = null,
  onSelecionarEscopo,
  onExecutarAcao,
  onDestacar,
  onReencaixar,
  onRecolher,
  onFechar,
  onCancelarOperacao,
  onRetomarOperacao,
  retomada = null,
  onDescreverImagens,
  imagemSelecionada = false,
  contextoImagem = false,
}) => {
  const [input, setInput] = useState('');
  const [acaoPedidoLivre, setAcaoPedidoLivre] = useState<'inserir' | 'reescrever'>('inserir');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [modelName, setModelName] = useState<string>('Carregando...');
  const [statusModelo, setStatusModelo] = useState<'carregando' | 'configurado' | 'indisponivel'>('carregando');

  // Auto-scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focar textarea e buscar modelo de IA ao montar o painel.
  useEffect(() => {
    const foco = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);

    const grupoIa = window.ipcAPI.ia as { obterContexto?: () => Promise<ContextoIaResposta> } | undefined;
    const obterContexto = grupoIa?.obterContexto;
    if (typeof obterContexto !== 'function') {
      setModelName('Modelo não informado');
      setStatusModelo('configurado');
      return () => window.clearTimeout(foco);
    }

    obterContexto().then((res: ContextoIaResposta) => {
      if (!res.success || !res.data?.configurado || !res.data.provedor || !res.data.modelo) {
        setModelName('Nenhuma IA configurada');
        setStatusModelo('indisponivel');
        return;
      }
      setModelName(`${res.data.provedor === 'gemini' ? 'Google Gemini' : 'Groq'} · ${res.data.modelo}`);
      setStatusModelo('configurado');
    }).catch(() => {
      setModelName('IA indisponível');
      setStatusModelo('indisponivel');
    });

    return () => window.clearTimeout(foco);
  }, []);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSendMessage(input.trim(), acaoPedidoLivre);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string) => {
    void window.ipcAPI.ia.copiarResposta(text);
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const obterModoAplicacao = (mensagem: ChatMessage) => mensagem.aplicacao || modoAplicacao;
  const controlesBloqueados = loading;

  return (
    <div className="flex h-full min-w-0 flex-col bg-muted/20">
        <header className="shrink-0 border-b bg-background px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-base font-semibold">
              <Bot className="size-4 shrink-0 text-primary" />
              <span className="truncate">Assistente IA</span>
              <Badge variant={loading ? 'secondary' : statusModelo === 'configurado' ? 'default' : 'destructive'} className="shrink-0 text-[10px]">
                {loading ? 'Processando' : statusModelo === 'configurado' ? 'Configurado' : statusModelo === 'carregando' ? 'Verificando' : 'Indisponível'}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              {onRecolher && (
                <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onRecolher} aria-label="Recolher Assistente IA">
                  <ChevronsRight className="size-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size={onReencaixar ? 'sm' : 'icon'}
                className={onReencaixar ? 'h-8 gap-1 px-2' : 'size-8'}
                onClick={onReencaixar || onDestacar}
                aria-label={onReencaixar ? 'Reencaixar Assistente IA' : 'Destacar Assistente IA'}
              >
                {onReencaixar ? <ArrowLeft className="size-4" /> : <ExternalLink className="size-4" />}
                {onReencaixar && <span className="hidden sm:inline">Reencaixar</span>}
              </Button>
              {loading && onCancelarOperacao && (
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onCancelarOperacao}>
                  Cancelar
                </Button>
              )}
              {onFechar && (
                <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onFechar}>
                  <span className="sr-only">Fechar</span>
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse"></span>
              <span className="truncate">Modelo Ativo: {modelName}</span>
            </p>
            {contextoImagem ? (
              <p className="text-xs text-muted-foreground truncate">Contexto atual: Imagem selecionada</p>
            ) : (
              <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <span className="shrink-0">Contexto atual:</span>
                <Select
                  value={escopoSelecionado === null ? undefined : String(escopoSelecionado)}
                  onValueChange={valor => onSelecionarEscopo?.(Number(valor))}
                  disabled={loading || !onSelecionarEscopo}
                >
                  <SelectTrigger className="h-7 min-w-0 flex-1 border bg-background px-2 text-xs shadow-sm focus:ring-1" aria-label="Contexto atual da IA">
                    <SelectValue placeholder={secaoTitulo || 'Escolha uma seção'} />
                  </SelectTrigger>
                  <SelectContent>
                    {opcoesEscopo.map(opcao => (
                      <SelectItem key={opcao.id} value={String(opcao.id)} className="text-xs">
                        {opcao.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </header>

        {/* Área de mensagens */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            {!editorId && !imagemSelecionada && !loading && (
              <div className="space-y-3 py-4">
                <p className="text-sm font-medium">Escolha o escopo que a IA poderá usar</p>
                <p className="text-xs text-muted-foreground">Nenhum conteúdo é enviado até uma ação ser solicitada.</p>
                <div className="flex flex-col gap-2">
                  {opcoesEscopo.map(opcao => (
                    <Button key={opcao.id} type="button" variant="outline" className="justify-start" onClick={() => onSelecionarEscopo?.(opcao.id)}>
                      {opcao.titulo}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {(editorId || imagemSelecionada) && messages.length === 0 && !loading && (
              <div className="space-y-5 py-4">
                <div className="text-center text-muted-foreground text-sm">
                  <p>Escolha uma ação ou descreva o que deseja inserir.</p>
                  <p className="text-xs mt-1">A IA usa somente o conteúdo do escopo selecionado.</p>
                </div>
                <div className="space-y-3">
                  {editorId && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Revisar</p>
                      <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2">
                        <Button type="button" variant="outline" size="sm" disabled={controlesBloqueados} onClick={() => onExecutarAcao?.('ortografia')}>Ortografia</Button>
                        <Button type="button" variant="outline" size="sm" disabled={controlesBloqueados} onClick={() => onExecutarAcao?.('tecnico_pericial')}>Técnico-pericial</Button>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Imagem</p>
                    <Button type="button" variant="outline" size="sm" disabled={controlesBloqueados || !imagemSelecionada} onClick={onDescreverImagens}>{imagemSelecionada ? 'Descrever imagem selecionada' : 'Selecione uma imagem no laudo'}</Button>
                  </div>
                  {editorId && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Transformar</p>
                      <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-3">
                        <Button type="button" variant="outline" size="sm" disabled={controlesBloqueados} onClick={() => onExecutarAcao?.('clareza')}>Clareza</Button>
                        <Button type="button" variant="outline" size="sm" disabled={controlesBloqueados} onClick={() => onExecutarAcao?.('resumir')}>Resumir</Button>
                        <Button type="button" variant="outline" size="sm" disabled={controlesBloqueados} onClick={() => onExecutarAcao?.('expandir')}>Expandir</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {imagemSelecionada && messages.length > 0 && !loading && (
              <Button type="button" variant="outline" size="sm" onClick={onDescreverImagens}>
                Descrever novamente
              </Button>
            )}

            {messages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-xl px-4 py-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  <div className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">{msg.content}</div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {msg.acao && (
                    <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
                      {rotulosAcaoIa[msg.acao]}
                    </Badge>
                  )}
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
                      {msg.acao !== 'descrever_imagem' && msg.permiteAplicacao !== false && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px]"
                          onClick={() => onApplyResponse(msg)}
                          title={obterModoAplicacao(msg) === 'substituir'
                            ? 'Revisar antes de substituir a seção'
                            : 'Inserir resposta na posição atual do cursor'}
                        >
                          <Check size={10} className="mr-0.5" />
                          {obterModoAplicacao(msg) === 'substituir'
                            ? 'Revisar substituição'
                            : 'Inserir no cursor'}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="min-w-56 rounded-xl rounded-bl-sm bg-muted px-4 py-3" aria-live="polite">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    {progresso?.fase === 'processando'
                      ? `Processando lote ${progresso.loteAtual} de ${progresso.totalLotes}`
                      : 'Preparando a solicitação...'}
                  </div>
                  {progresso && progresso.totalLotes > 1 && (
                    <div className="mt-2 space-y-1">
                      <progress
                        className="h-1.5 w-full accent-primary"
                        max={progresso.totalLotes}
                        value={progresso.chamadasConcluidas}
                        aria-label={`${progresso.chamadasConcluidas} de ${progresso.totalLotes} lotes concluídos`}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {progresso.chamadasConcluidas} concluído(s)
                        {progresso.tentativa > 1 ? ` · tentativa corretiva ${progresso.tentativa}` : ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="text-xs">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {retomada && !loading && onRetomarOperacao && (
              <Button type="button" variant="outline" className="w-full" onClick={onRetomarOperacao}>
                Continuar do lote {retomada.lotesConcluidos + 1} de {retomada.totalLotes}
              </Button>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input de pergunta */}
        <div className="border-t px-4 py-3 shrink-0 bg-background">
          {imagemSelecionada ? (
            <p className="text-xs text-muted-foreground">
              A descrição não será inserida automaticamente. Use o botão de copiar e cole o texto onde desejar.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2" role="group" aria-label="Ação do pedido livre">
                <Button type="button" size="sm" variant={acaoPedidoLivre === 'inserir' ? 'default' : 'outline'} onClick={() => setAcaoPedidoLivre('inserir')} disabled={controlesBloqueados}>
                  Inserir no cursor
                </Button>
                <Button type="button" size="sm" variant={acaoPedidoLivre === 'reescrever' ? 'default' : 'outline'} onClick={() => setAcaoPedidoLivre('reescrever')} disabled={controlesBloqueados}>
                  Reescrever escopo
                </Button>
              </div>
              {messages.length > 0 && onLimparConversa && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={onLimparConversa}
                    disabled={loading}
                  >
                    <Trash2 className="mr-1 size-3" />
                    Limpar conversa
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={acaoPedidoLivre === 'inserir'
                    ? 'Descreva o texto que deseja inserir... (Shift+Enter para nova linha)'
                    : 'Descreva como o escopo selecionado deve ser reescrito... (Shift+Enter para nova linha)'}
                  className="min-h-[60px] resize-none text-sm"
                  disabled={!editorId || controlesBloqueados}
                  aria-label="Pedido livre ao assistente IA"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!editorId || !input.trim() || controlesBloqueados}
                  className="shrink-0 self-end"
                  aria-label="Enviar pedido livre"
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-1.5">
            A IA pode cometer erros. Sempre revise antes de aplicar ao laudo.
          </p>
        </div>
    </div>
  );
};
