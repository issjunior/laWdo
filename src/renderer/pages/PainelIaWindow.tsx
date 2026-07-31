import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowLeft, Bot, Check, Copy, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { AcaoPainelIa, EstadoPainelIa } from '@shared/types/ia.types';

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

function estadoPainelIaValido(valor: unknown): valor is EstadoPainelIa {
  if (!valor || typeof valor !== 'object') return false;
  const estado = valor as Record<string, unknown>;
  return typeof estado.revisao === 'number'
    && typeof estado.titulo === 'string'
    && typeof estado.carregando === 'boolean'
    && Array.isArray(estado.mensagens)
    && Array.isArray(estado.escopos);
}

export default function PainelIaWindow() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [estado, setEstado] = useState<EstadoPainelIa | null>(null);
  const [pedidoLivre, setPedidoLivre] = useState('');
  const [aplicacao, setAplicacao] = useState<'inserir' | 'reescrever'>('inserir');
  const fimHistoricoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) return;
    const remover = window.ipcAPI.ia.onPainelEstado((proximoEstado: unknown) => {
      if (!estadoPainelIaValido(proximoEstado)) return;
      setEstado(atual => (!atual || proximoEstado.revisao > atual.revisao ? proximoEstado : atual));
    });
    window.ipcAPI.ia.painelPronto();
    return remover;
  }, [sessionId]);

  useEffect(() => {
    fimHistoricoRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [estado?.mensagens, estado?.carregando]);

  if (!sessionId) return <div className="p-6 text-sm text-destructive">Sessão do painel inválida.</div>;

  const enviarPedidoLivre = () => {
    if (!pedidoLivre.trim() || estado?.carregando) return;
    window.ipcAPI.ia.painelEnviarComando({ tipo: 'enviar_pedido_livre', mensagem: pedidoLivre.trim(), aplicacao });
    setPedidoLivre('');
  };

  return (
    <main className="flex h-screen flex-col bg-background">
      <header className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Bot className="size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold">Assistente IA</h1>
              <p className="truncate text-xs text-muted-foreground">{estado?.titulo || 'Aguardando sincronização do editor...'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {estado?.carregando && <Button type="button" variant="ghost" size="sm" onClick={() => window.ipcAPI.ia.painelEnviarComando({ tipo: 'cancelar_operacao' })}>Cancelar</Button>}
            <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => window.ipcAPI.ia.painelReencaixar()}>
              <ArrowLeft className="size-4" /> Reencaixar
            </Button>
          </div>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto px-4 py-4">
        {!estado ? <p className="pt-8 text-center text-sm text-muted-foreground">Conectando ao editor...</p> : (
          <div className="space-y-4">
            {!estado.editorDisponivel && !estado.imagemSelecionada && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Escolha o escopo que a IA poderá usar</p>
                {estado.escopos.map(escopo => <Button key={escopo.id} type="button" variant="outline" className="w-full justify-start" onClick={() => window.ipcAPI.ia.painelEnviarComando({ tipo: 'selecionar_escopo', indice: escopo.id })}>{escopo.titulo}</Button>)}
              </div>
            )}
            {(estado.editorDisponivel || estado.imagemSelecionada) && estado.mensagens.length === 0 && !estado.carregando && (
              <div className="space-y-4">
                <p className="text-center text-sm text-muted-foreground">Escolha uma ação ou descreva o que deseja inserir.</p>
                {estado.editorDisponivel && <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Revisar</p><div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" size="sm" onClick={() => window.ipcAPI.ia.painelEnviarComando({ tipo: 'executar_acao', acao: 'ortografia' })}>Ortografia</Button><Button type="button" variant="outline" size="sm" onClick={() => window.ipcAPI.ia.painelEnviarComando({ tipo: 'executar_acao', acao: 'tecnico_pericial' })}>Técnico-pericial</Button></div></div>}
                {estado.editorDisponivel && <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Transformar</p><div className="grid grid-cols-3 gap-2"><Button type="button" variant="outline" size="sm" onClick={() => window.ipcAPI.ia.painelEnviarComando({ tipo: 'executar_acao', acao: 'clareza' })}>Clareza</Button><Button type="button" variant="outline" size="sm" onClick={() => window.ipcAPI.ia.painelEnviarComando({ tipo: 'executar_acao', acao: 'resumir' })}>Resumir</Button><Button type="button" variant="outline" size="sm" onClick={() => window.ipcAPI.ia.painelEnviarComando({ tipo: 'executar_acao', acao: 'expandir' })}>Expandir</Button></div></div>}
                <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Imagem</p><Button type="button" variant="outline" size="sm" disabled={!estado.imagemSelecionada} onClick={() => window.ipcAPI.ia.painelEnviarComando({ tipo: 'descrever_imagem' })}>{estado.imagemSelecionada ? 'Descrever imagem selecionada' : 'Selecione uma imagem no laudo'}</Button></div>
              </div>
            )}
            {estado.mensagens.map((mensagem, indice) => <div key={`${mensagem.timestamp}-${indice}`} className={`flex flex-col ${mensagem.role === 'user' ? 'items-end' : 'items-start'}`}><div className={`max-w-[90%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${mensagem.role === 'user' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground'}`}>{mensagem.content}</div><div className="mt-1 flex items-center gap-2"><span className="text-[10px] text-muted-foreground">{new Date(mensagem.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>{mensagem.acao && <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">{rotulosAcaoIa[mensagem.acao]}</Badge>}{mensagem.role === 'assistant' && <><Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0" title="Copiar resposta" onClick={() => void window.ipcAPI.ia.copiarResposta(mensagem.content)}><Copy className="size-3" /></Button>{mensagem.permiteAplicacao && <Button type="button" variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => window.ipcAPI.ia.painelEnviarComando({ tipo: 'aplicar_resposta', indiceMensagem: indice })}><Check className="mr-0.5 size-3" />{mensagem.aplicacao === 'substituir' ? 'Revisar substituição' : 'Inserir no cursor'}</Button>}</>}</div></div>)}
            {estado.carregando && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Aguardando resposta...</div>}
            {estado.erro && <Alert variant="destructive"><AlertDescription>{estado.erro}</AlertDescription></Alert>}
            <div ref={fimHistoricoRef} />
          </div>
        )}
      </section>

      {estado && <footer className="border-t bg-background px-4 py-3">{estado.contextoImagem ? <p className="text-xs text-muted-foreground">A descrição não será inserida automaticamente. Use o botão de copiar e cole o texto onde desejar.</p> : <div className="space-y-2"><div className="flex gap-2" role="group" aria-label="Ação do pedido livre"><Button type="button" size="sm" variant={aplicacao === 'inserir' ? 'default' : 'outline'} disabled={estado.carregando} onClick={() => setAplicacao('inserir')}>Inserir no cursor</Button><Button type="button" size="sm" variant={aplicacao === 'reescrever' ? 'default' : 'outline'} disabled={estado.carregando} onClick={() => setAplicacao('reescrever')}>Reescrever escopo</Button></div><div className="flex gap-2"><Textarea value={pedidoLivre} onChange={evento => setPedidoLivre(evento.target.value)} onKeyDown={evento => { if (evento.key === 'Enter' && !evento.shiftKey) { evento.preventDefault(); enviarPedidoLivre(); } }} disabled={!estado.editorDisponivel || estado.carregando} aria-label="Pedido livre ao assistente IA" placeholder="Descreva o que deseja..." className="min-h-[60px] resize-none text-sm" /><Button type="button" size="icon" disabled={!estado.editorDisponivel || estado.carregando || !pedidoLivre.trim()} aria-label="Enviar pedido livre" onClick={enviarPedidoLivre}><Send className="size-4" /></Button></div></div>}</footer>}
    </main>
  );
}
