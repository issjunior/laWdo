import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { IlustracoesPanel, type ImagemLaudo } from '@/components/laudo/IlustracoesPanel';
import type { AjusteVisualParFiguras } from '@shared/figura/enquadramento';
import { ehEstadoPainelFiguras, ehResultadoAtualizacaoFiguras, ehResultadoInsercaoFiguras } from '@shared/figura/painel';
import { Button } from '@/components/ui/button';
import { PanelRightOpen } from 'lucide-react';
import type { OperacaoPainelFiguras, ResultadoAtualizacaoFiguras, ResultadoOperacaoPainelFiguras } from '@shared/types/imagem-laudo.types';

const IlustracoesPanelWindow: React.FC = () => {
  const [searchParams] = useSearchParams();
  const laudoId = searchParams.get('laudoId') || '';
  const tituloLaudo = searchParams.get('titulo') || '';

  const [figurasNoEditor, setFigurasNoEditor] = useState<ImagemLaudo[]>([]);
  const [figurasDevolvidas, setFigurasDevolvidas] = useState<ImagemLaudo[]>([]);
  const [sessaoId, setSessaoId] = useState<number | null>(null);
  const [imagensProtegidas, setImagensProtegidas] = useState<string[]>([]);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [figuraAtivaId, setFiguraAtivaId] = useState<string | null>(null);
  const [figuraAtivaOcorrenciaId, setFiguraAtivaOcorrenciaId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const operacoesPendentesRef = useRef(new Map<string, {
    resolver: (valor: ResultadoOperacaoPainelFiguras['valor']) => void;
    rejeitar: (erro: Error) => void;
    temporizador: ReturnType<typeof setTimeout>;
  }>());

  useEffect(() => {
    const operacoesPendentes = operacoesPendentesRef.current;
    const unsubState = window.ipcAPI.ilustracoes.onStateSync((data: unknown) => {
      if (!ehEstadoPainelFiguras(data)) return;
      setFigurasNoEditor(data.figurasNoEditor);
      setFigurasDevolvidas(data.figurasDevolvidas ?? []);
      setSessaoId(data.sessaoId ?? null);
      setImagensProtegidas(Array.isArray(data.imagensProtegidas) ? data.imagensProtegidas.filter((id): id is string => typeof id === 'string') : []);
      setSyncEnabled(data.syncEnabled ?? true);
      setFiguraAtivaId(data.figuraAtivaId ?? null);
      setFiguraAtivaOcorrenciaId(data.figuraAtivaOcorrenciaId ?? null);
      setReady(true);
      const resultado = data.resultadoOperacao;
      if (resultado && typeof resultado.solicitacaoId === 'string' && typeof resultado.sucesso === 'boolean') {
        const pendente = operacoesPendentesRef.current.get(resultado.solicitacaoId);
        if (pendente) {
          clearTimeout(pendente.temporizador);
          operacoesPendentesRef.current.delete(resultado.solicitacaoId);
          if (resultado.sucesso) pendente.resolver(resultado.valor);
          else pendente.rejeitar(new Error(resultado.erro || 'Não foi possível aplicar a operação no editor.'));
        }
      }

      if (data.tema === 'dark') {
        document.body.classList.add('dark');
      } else if (data.tema === 'light') {
        document.body.classList.remove('dark');
      }
    });
    window.ipcAPI.ilustracoes.sendAction('ready');

    return () => {
      unsubState();
      for (const pendente of operacoesPendentes.values()) {
        clearTimeout(pendente.temporizador);
        pendente.rejeitar(new Error('A janela do painel foi fechada.'));
      }
      operacoesPendentes.clear();
    };
  }, []);

  const sendAction = useCallback((action: string, ...args: unknown[]) => {
    window.ipcAPI.ilustracoes.sendAction(action, ...args);
  }, []);

  const solicitarOperacao = useCallback((operacao: OperacaoPainelFiguras, ...args: unknown[]): Promise<ResultadoOperacaoPainelFiguras['valor']> => (
    new Promise((resolver, rejeitar) => {
      if (sessaoId === null) {
        rejeitar(new Error('O editor ainda não confirmou a sessão do laudo.'));
        return;
      }
      const solicitacaoId = crypto.randomUUID();
      const temporizador = setTimeout(() => {
        operacoesPendentesRef.current.delete(solicitacaoId);
        rejeitar(new Error('O editor não confirmou a operação. Confira o documento antes de tentar novamente.'));
      }, 60000);
      operacoesPendentesRef.current.set(solicitacaoId, { resolver, rejeitar, temporizador });
      sendAction('solicitarOperacao', solicitacaoId, laudoId, sessaoId, operacao, ...args);
    })
  ), [laudoId, sessaoId, sendAction]);

  const handleInsertImage = useCallback(async (_url: string, id: string, legenda: string) => {
    return await solicitarOperacao('insertImage', '', id, legenda) === true;
  }, [solicitarOperacao]);

  const handleInsertAll = useCallback(async (imagens: ImagemLaudo[]) => {
    const resultado = await solicitarOperacao('insertAll', imagens);
    if (!ehResultadoInsercaoFiguras(resultado, imagens.map(imagem => imagem.id))) throw new Error('Resposta inválida do editor.');
    return resultado;
  }, [solicitarOperacao]);

  const handleDeleteImage = useCallback(async (imageId: string, indice?: number, ocorrenciaId?: string) => (
    await solicitarOperacao('deleteImage', imageId, indice, ocorrenciaId) === true
  ), [solicitarOperacao]);

  const handleExcluirArquivo = useCallback(async (imageId: string) => {
    if (await solicitarOperacao('deleteFile', imageId) !== true) throw new Error('O editor não confirmou a exclusão da imagem.');
  }, [solicitarOperacao]);

  const handleUpdateLegenda = useCallback(async (id: string, legenda: string, ocorrenciaId?: string) => {
    await solicitarOperacao('updateLegenda', id, legenda, ocorrenciaId);
  }, [solicitarOperacao]);

  const handleReorder = useCallback((imagens: ImagemLaudo[]) => {
    sendAction('reorder', imagens);
  }, [sendAction]);

  const handleRefreshHtml = useCallback(async (restaurarLegendas = false): Promise<ResultadoAtualizacaoFiguras> => {
    const resultado = await solicitarOperacao('refreshHtml', restaurarLegendas);
    if (!ehResultadoAtualizacaoFiguras(resultado)) throw new Error('Resposta inválida do editor.');
    if (resultado.erro) throw new Error(resultado.erro);
    return resultado;
  }, [solicitarOperacao]);

  const handleSyncToggle = useCallback((enabled: boolean) => {
    sendAction('syncToggle', enabled);
  }, [sendAction]);

  const handleScrollToFigure = useCallback((imageId: string, ocorrenciaId?: string) => {
    if (ocorrenciaId) sendAction('scrollToFigure', imageId, ocorrenciaId);
    else sendAction('scrollToFigure', imageId);
  }, [sendAction]);

  const handlePrevisualizarAlturaPar = useCallback((indice: number, alturaPercentual: number, ocorrenciaId?: string) => {
    sendAction('previewPairHeight', indice, alturaPercentual, ocorrenciaId);
  }, [sendAction]);

  const handleConfirmarAlturaPar = useCallback(async (indice: number, alturaPercentual: number, ocorrenciaId?: string) => (
    await solicitarOperacao('commitPairHeight', indice, alturaPercentual, ocorrenciaId) === true
  ), [solicitarOperacao]);

  const handleCancelarAlturaPar = useCallback((indice: number, ocorrenciaId?: string) => {
    sendAction('cancelPairHeight', indice, ocorrenciaId);
  }, [sendAction]);

  const handleDefinirAjusteVisualPar = useCallback(async (indice: number, ajusteVisual: AjusteVisualParFiguras, ocorrenciaId?: string) => (
    await solicitarOperacao('setPairVisualMode', indice, ajusteVisual, ocorrenciaId) === true
  ), [solicitarOperacao]);

  const handleReplaceImage = useCallback(async (imageId: string, imagem: ImagemLaudo, indice?: number) => {
    return await solicitarOperacao('replaceImage', imageId, imagem, indice) === true;
  }, [solicitarOperacao]);

  const handleEditImage = useCallback(async (indice: number, imagem: ImagemLaudo, imagemOrigemId: string, imagemAnteriorId: string) => {
    await solicitarOperacao('editImage', indice, imagem, imagemOrigemId, imagemAnteriorId);
  }, [solicitarOperacao]);

  const handleGerarLegenda = useCallback(async (imageId: string): Promise<string | null> => {
    const resultado = await solicitarOperacao('generateCaption', imageId);
    return typeof resultado === 'string' ? resultado : null;
  }, [solicitarOperacao]);

  const handleReintegrarAoEditor = () => {
    window.ipcAPI.ilustracoes.sendAction('popIn');
    window.ipcAPI.ilustracoes.closePanel();
  };

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-3">
        <div>
          <h1 className="text-sm font-semibold">Painel de Ilustrações</h1>
          {tituloLaudo && (
            <p className="text-[10px] text-muted-foreground">Laudo {tituloLaudo}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReintegrarAoEditor}
          className="h-7 text-xs gap-1"
          aria-label="Reintegrar ao editor"
        >
          <PanelRightOpen size={14} />
          Reintegrar ao editor
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {!ready ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Aguardando sincronização...
          </div>
        ) : (
          <IlustracoesPanel
            laudoId={laudoId}
            onInsertImage={handleInsertImage}
            onInsertAll={handleInsertAll}
            onDeleteImage={handleDeleteImage}
            onExcluirArquivo={handleExcluirArquivo}
            onUpdateLegendaInEditor={handleUpdateLegenda}
            onReorder={handleReorder}
            onRefreshHtml={handleRefreshHtml}
            onSyncToggle={handleSyncToggle}
            onScrollToFigure={handleScrollToFigure}
            onPrevisualizarAlturaPar={handlePrevisualizarAlturaPar}
            onConfirmarAlturaPar={handleConfirmarAlturaPar}
            onCancelarAlturaPar={handleCancelarAlturaPar}
            onDefinirAjusteVisualPar={handleDefinirAjusteVisualPar}
            onReplaceImage={handleReplaceImage}
            onEditImage={handleEditImage}
            onGerarLegenda={handleGerarLegenda}
            figurasNoEditor={figurasNoEditor}
            figurasDevolvidas={figurasDevolvidas}
            imagensProtegidas={imagensProtegidas}
            syncEnabled={syncEnabled}
            figuraAtivaId={figuraAtivaId}
            figuraAtivaOcorrenciaId={figuraAtivaOcorrenciaId}
          />
        )}
      </div>
    </div>
  );
};

export default IlustracoesPanelWindow;
