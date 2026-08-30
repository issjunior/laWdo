import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { extrairTabelaMarkdownIa, tabelaMarkdownParaHtmlSeguro, tabelaMarkdownParaTexto } from '@/lib/ia-resposta-formatada';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bot, ChevronsRight, Send, Loader2, Check, Copy, ExternalLink, PanelRightOpen, Trash2, X, ChevronDown, MapPin } from 'lucide-react';
import type { AcaoIa, BlocoContextoIa, EstadoConsultaIa, ModoInteracaoIa, ProgressoConsultaIa, ProgressoIa, RetomadaIa } from '@shared/types/ia.types';

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
  permiteReenvio?: boolean;
  tamanhoResposta?: 'automatico' | 'curta' | 'media' | 'longa';
  evidencias?: BlocoContextoIa[];
  estadoConsulta?: EstadoConsultaIa;
  modeloConsulta?: string;
  recomendacao?: string;
  perguntaConsulta?: string;
  miniaturaDataUri?: string;
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

const rotulosTamanhoResposta = {
  automatico: 'Tamanho automático',
  curta: 'Resposta curta',
  media: 'Resposta média',
  longa: 'Resposta longa',
} as const;

interface AssistenteIaPanelProps {
  secaoTitulo: string;
  editorId: string;
  messages: ChatMessage[];
  onSendMessage: (message: string, modo: ModoInteracaoIa, tamanho: 'automatico' | 'curta' | 'media' | 'longa') => void;
  onLimparConversa?: () => void;
  onApplyResponse: (mensagem: ChatMessage) => void;
  modoAplicacao?: 'inserir' | 'substituir';
  loading?: boolean;
  progresso?: ProgressoIa | null;
  progressoConsulta?: ProgressoConsultaIa | null;
  error?: string | null;
  avisoLimite?: { mensagem: string; tentarNovamenteEm?: number } | null;
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
  onReenviarMensagem?: (mensagemId: string) => void;
  imagemSelecionada?: boolean;
  contextoImagem?: boolean;
  onNavegarEvidencia?: (evidencia: BlocoContextoIa) => void;
  opcoesModelo?: Array<{ id: string; rotulo: string; perfil?: 'rapido' | 'equilibrado' | 'maior_precisao' }>;
  modeloSelecionado?: string;
  onSelecionarModelo?: (modelo: string) => void;
  onPerguntarDocumentoCompleto?: (pergunta: string) => void;
}

type ContextoIaResposta = {
  success: boolean;
  data?: { configurado: boolean; provedor?: 'groq' | 'gemini'; modelo?: string };
};

function TabelaResposta({ texto }: { texto: string }) {
  const tabela = extrairTabelaMarkdownIa(texto)
  if (!tabela) return null
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead><tr>{tabela.cabecalho.map((celula, indice) => <th key={`${celula}-${indice}`} className="border border-border bg-background/60 px-2 py-1 font-semibold">{celula}</th>)}</tr></thead>
        <tbody>{tabela.linhas.map((linha, indice) => <tr key={`${linha.join('-')}-${indice}`}>{linha.map((celula, indiceCelula) => <td key={`${celula}-${indiceCelula}`} className="border border-border px-2 py-1 align-top">{celula}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

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
  progressoConsulta = null,
  error = null,
  avisoLimite = null,
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
  onReenviarMensagem,
  imagemSelecionada = false,
  contextoImagem = false,
  onNavegarEvidencia,
  opcoesModelo = [],
  modeloSelecionado,
  onSelecionarModelo,
  onPerguntarDocumentoCompleto,
}) => {
  const [input, setInput] = useState('');
  const [modoInteracao, setModoInteracao] = useState<ModoInteracaoIa>('perguntar');
  const [tamanhoResposta, setTamanhoResposta] = useState<'automatico' | 'curta' | 'media' | 'longa'>('automatico');
  const [segundosEmProcessamento, setSegundosEmProcessamento] = useState(0);
  const [evidenciasAbertas, setEvidenciasAbertas] = useState<Set<string>>(() => new Set());
  const mensagensContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [modelName, setModelName] = useState<string>('Carregando...');
  const [statusModelo, setStatusModelo] = useState<'carregando' | 'configurado' | 'indisponivel'>('carregando');

  useEffect(() => {
    const mensagensContainer = mensagensContainerRef.current;
    if (!mensagensContainer) return;

    if (typeof mensagensContainer.scrollTo === 'function') {
      mensagensContainer.scrollTo({
        top: mensagensContainer.scrollHeight,
        behavior: 'smooth',
      });
      return;
    }

    mensagensContainer.scrollTop = mensagensContainer.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) {
      setSegundosEmProcessamento(0);
      return;
    }
    const inicio = Date.now();
    const atualizar = () => setSegundosEmProcessamento(Math.floor((Date.now() - inicio) / 1000));
    atualizar();
    const intervalo = window.setInterval(atualizar, 1000);
    return () => window.clearInterval(intervalo);
  }, [loading]);

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
    onSendMessage(input.trim(), modoInteracao, tamanhoResposta);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string) => {
    const html = tabelaMarkdownParaHtmlSeguro(text);
    if (html) void window.ipcAPI.ia.copiarResposta(tabelaMarkdownParaTexto(text), html);
    else void window.ipcAPI.ia.copiarResposta(text);
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const obterModoAplicacao = (mensagem: ChatMessage) => mensagem.aplicacao || modoAplicacao;
  const controlesBloqueados = loading;

  return (
    <div data-diagnostico-id="painel-ia.dock" className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-muted/20">
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
                {onReencaixar ? <PanelRightOpen className="size-4" /> : <ExternalLink className="size-4" />}
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
                <span className="w-24 shrink-0 whitespace-nowrap">Contexto atual:</span>
                <Select
                  value={escopoSelecionado === null ? undefined : String(escopoSelecionado)}
                  onValueChange={valor => onSelecionarEscopo?.(Number(valor))}
                  disabled={loading || !onSelecionarEscopo}
                >
                  <SelectTrigger className="h-7 min-w-0 flex-1 border bg-background px-2 text-left text-xs shadow-sm focus:ring-1 [&>span]:text-left" aria-label="Contexto atual da IA">
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
            {opcoesModelo.length > 0 && (
              <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <span className="w-24 shrink-0 whitespace-nowrap">Modelo:</span>
                <Select value={modeloSelecionado} onValueChange={onSelecionarModelo} disabled={loading || !onSelecionarModelo}>
                  <SelectTrigger className="h-7 min-w-0 flex-1 border bg-background px-2 text-left text-xs shadow-sm focus:ring-1 [&>span]:text-left" aria-label="Modelo da IA para esta sessão">
                    <SelectValue placeholder="Modelo configurado" />
                  </SelectTrigger>
                  <SelectContent>
                    {(['rapido', 'equilibrado', 'maior_precisao'] as const).map(perfil => {
                      const modelos = opcoesModelo.filter(modelo => (modelo.perfil || 'equilibrado') === perfil);
                      if (!modelos.length) return null;
                      const rotuloPerfil = perfil === 'rapido' ? 'Rápido' : perfil === 'equilibrado' ? 'Equilibrado' : 'Maior precisão';
                      return <SelectGroup key={perfil}>
                        <SelectLabel>{rotuloPerfil}</SelectLabel>
                        {modelos.map(modelo => <SelectItem key={modelo.id} value={modelo.id} className="text-xs">
                          {modelo.rotulo}
                        </SelectItem>)}
                      </SelectGroup>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </header>

        {/* Área de mensagens */}
        <div
          ref={mensagensContainerRef}
          data-diagnostico-id="painel-ia.mensagens"
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        >
          <div className="space-y-4">
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
                    <div className="flex justify-end">
                      <Button type="button" size="sm" disabled={controlesBloqueados || !imagemSelecionada} onClick={onDescreverImagens}>{imagemSelecionada ? 'Descrever imagem selecionada' : 'Selecione uma imagem no laudo'}</Button>
                    </div>
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
              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={onDescreverImagens}>
                  Descrever novamente
                </Button>
              </div>
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
                  {msg.role === 'assistant' && extrairTabelaMarkdownIa(msg.content)
                    ? <TabelaResposta texto={msg.content} />
                    : <div className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">{msg.content}</div>}
                  {msg.role === 'user' && msg.miniaturaDataUri && (
                    <img
                      src={msg.miniaturaDataUri}
                      alt="Miniatura da imagem enviada para descrição"
                      className="mt-3 max-h-48 w-full rounded-lg border border-primary-foreground/30 bg-black/10 object-contain"
                    />
                  )}
                  {msg.role === 'assistant' && msg.estadoConsulta && msg.estadoConsulta !== 'respondida' && (
                    <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                      {msg.estadoConsulta === 'insuficiente'
                        ? 'O escopo atual não contém evidências suficientes para uma conclusão completa.'
                        : 'Há informações conflitantes no escopo. Revise as evidências antes de usar a resposta.'}
                    </p>
                  )}
                  {msg.role === 'assistant' && msg.estadoConsulta === 'insuficiente'
                    && escopoSelecionado !== -1 && msg.perguntaConsulta && onPerguntarDocumentoCompleto && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => onPerguntarDocumentoCompleto(msg.perguntaConsulta!)}
                        disabled={loading}
                      >
                        Perguntar ao documento completo
                      </Button>
                    )}
                  {msg.role === 'assistant' && msg.recomendacao && (
                    <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                      {msg.recomendacao}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {msg.acao && (
                    <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
                      {rotulosAcaoIa[msg.acao]}
                    </Badge>
                  )}
                  {msg.role === 'user' && msg.tamanhoResposta && (
                    <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
                      {rotulosTamanhoResposta[msg.tamanhoResposta]}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(msg.timestamp)}
                  </span>
                  {msg.role === 'assistant' && msg.modeloConsulta && (
                    <span className="max-w-32 truncate text-[10px] text-muted-foreground" title={msg.modeloConsulta}>
                      {msg.modeloConsulta}
                    </span>
                  )}
                  {msg.role === 'user' && msg.permiteReenvio && onReenviarMensagem && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] text-primary-foreground hover:text-primary-foreground"
                      onClick={() => onReenviarMensagem(msg.id)}
                      disabled={loading}
                      title="Reenviar esta solicitação"
                    >
                      Reenviar
                    </Button>
                  )}
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
                {msg.role === 'assistant' && msg.evidencias && msg.evidencias.length > 0 && (
                  <Collapsible
                    open={evidenciasAbertas.has(msg.id)}
                    onOpenChange={aberto => setEvidenciasAbertas(atuais => {
                      const proximas = new Set(atuais);
                      if (aberto) proximas.add(msg.id);
                      else proximas.delete(msg.id);
                      return proximas;
                    })}
                    className="mt-2 w-full max-w-[90%] rounded-md border bg-background/60 px-2 py-1"
                  >
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 py-1 text-left text-xs font-medium">
                      <span>Evidências ({msg.evidencias.length})</span>
                      <ChevronDown className="size-3.5" aria-hidden="true" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 pb-1">
                      {msg.evidencias.map(evidencia => (
                        <div key={evidencia.id} className="flex items-start justify-between gap-2 rounded px-1 py-1 text-xs text-muted-foreground">
                          <span className="min-w-0 break-words"><strong className="font-medium text-foreground">{evidencia.titulo}</strong>: {evidencia.texto}</span>
                          {onNavegarEvidencia && (
                            <Button type="button" variant="ghost" size="sm" className="h-6 shrink-0 px-1.5 text-[10px]" onClick={() => onNavegarEvidencia(evidencia)}>
                              <MapPin className="mr-1 size-3" />Ver no laudo
                            </Button>
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            ))}

            {loading && progresso && progresso.totalLotes > 1 && (
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

            {loading && (!progresso || progresso.totalLotes === 1) && (
              <div className="flex items-center gap-2 px-1 text-muted-foreground" aria-label="Processando solicitação">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs tabular-nums">
                  {progressoConsulta
                    ? ({ preparando: 'Preparando consulta...', analisando: 'Analisando evidências...', consolidando: 'Consolidando fatos...', verificando: 'Verificando resposta...' } as const)[progressoConsulta.fase]
                    : `${Math.floor(segundosEmProcessamento / 60).toString().padStart(2, '0')}:${(segundosEmProcessamento % 60).toString().padStart(2, '0')}`}
                </span>
              </div>
            )}

            {avisoLimite && (
              <Alert variant="destructive" className="border-amber-500/60 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                <AlertDescription>
                  <p className="font-medium">Solicitação recusada pelo provedor.</p>
                  <p>{avisoLimite.mensagem}</p>
                  {avisoLimite.tentarNovamenteEm && <p className="mt-1 font-medium">Nova tentativa recomendada após: {formatTime(avisoLimite.tentarNovamenteEm)}.</p>}
                </AlertDescription>
              </Alert>
            )}

            {error && !avisoLimite && (
              <Alert variant="destructive" className="text-xs">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {retomada && !loading && onRetomarOperacao && (
              <Button type="button" variant="outline" className="w-full" onClick={onRetomarOperacao}>
                Continuar do lote {retomada.lotesConcluidos + 1} de {retomada.totalLotes}
              </Button>
            )}

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
              <Tabs value={modoInteracao} onValueChange={valor => setModoInteracao(valor as ModoInteracaoIa)}>
                <TabsList className="grid w-full grid-cols-3" aria-label="Modo do assistente">
                  <TabsTrigger value="perguntar" onClick={() => setModoInteracao('perguntar')}>Perguntar</TabsTrigger>
                  <TabsTrigger value="escrever" onClick={() => setModoInteracao('escrever')}>Escrever</TabsTrigger>
                  <TabsTrigger value="reescrever" onClick={() => setModoInteracao('reescrever')}>Reescrever</TabsTrigger>
                </TabsList>
              </Tabs>
              {modoInteracao !== 'perguntar' && <Select value={tamanhoResposta} onValueChange={(valor: 'automatico' | 'curta' | 'media' | 'longa') => setTamanhoResposta(valor)} disabled={controlesBloqueados}>
                <SelectTrigger className="h-8 text-xs" aria-label="Tamanho da resposta"><SelectValue placeholder="Tamanho da resposta" /></SelectTrigger>
                <SelectContent><SelectItem value="automatico">Tamanho automático</SelectItem><SelectItem value="curta">Curta</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="longa">Longa</SelectItem></SelectContent>
              </Select>}
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={modoInteracao === 'perguntar' ? 'Pergunte sobre o escopo selecionado... (Shift+Enter para nova linha)' : modoInteracao === 'escrever' ? 'Descreva o texto que deseja inserir... (Shift+Enter para nova linha)' : 'Descreva como o escopo selecionado deve ser reescrito... (Shift+Enter para nova linha)'}
                  className="min-h-[60px] resize-none text-sm"
                  disabled={!editorId || controlesBloqueados}
                  aria-label="Pedido livre ao assistente IA"
                />
                <div className="flex w-10 shrink-0 flex-col gap-2">
                  {messages.length > 0 && onLimparConversa && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="min-h-0 flex-1"
                      onClick={onLimparConversa}
                      disabled={loading}
                      aria-label="Limpar conversa"
                      title="Limpar conversa"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!editorId || !input.trim() || controlesBloqueados}
                    className="min-h-0 flex-1"
                    aria-label="Enviar pedido livre"
                  >
                    <Send size={16} />
                  </Button>
                </div>
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
