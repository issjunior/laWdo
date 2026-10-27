import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { IlustracoesPanel, type ImagemLaudo } from '@/components/laudo/IlustracoesPanel';
import { Button } from '@/components/ui/button';
import { PanelRightOpen } from 'lucide-react';
import { toast } from 'sonner';
import type { ResultadoAtualizacaoFiguras } from '@shared/types/imagem-laudo.types';

interface SyncState {
  figurasNoEditor: ImagemLaudo[];
  syncEnabled: boolean;
  figuraAtivaId: string | null;
  tema?: string;
  resultadoAtualizacao?: ResultadoAtualizacaoFiguras;
}

const IlustracoesPanelWindow: React.FC = () => {
  const [searchParams] = useSearchParams();
  const laudoId = searchParams.get('laudoId') || '';
  const tituloLaudo = searchParams.get('titulo') || '';

  const [figurasNoEditor, setFigurasNoEditor] = useState<ImagemLaudo[]>([]);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [figuraAtivaId, setFiguraAtivaId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const atualizacaoPendenteRef = useRef<{
    resolver: (resultado: ResultadoAtualizacaoFiguras) => void;
    rejeitar: (erro: Error) => void;
    temporizador: ReturnType<typeof setTimeout>;
  } | null>(null);

  useEffect(() => {
    const unsubState = window.ipcAPI.ilustracoes.onStateSync((data: SyncState) => {
      setFigurasNoEditor(data.figurasNoEditor || []);
      setSyncEnabled(data.syncEnabled ?? true);
      setFiguraAtivaId(data.figuraAtivaId ?? null);
      setReady(true);
      if (data.resultadoAtualizacao && atualizacaoPendenteRef.current) {
        clearTimeout(atualizacaoPendenteRef.current.temporizador);
        atualizacaoPendenteRef.current.resolver(data.resultadoAtualizacao);
        atualizacaoPendenteRef.current = null;
      }

      if (data.tema === 'dark') {
        document.body.classList.add('dark');
      } else if (data.tema === 'light') {
        document.body.classList.remove('dark');
      }
    });

    return () => {
      unsubState();
      if (atualizacaoPendenteRef.current) {
        clearTimeout(atualizacaoPendenteRef.current.temporizador);
        atualizacaoPendenteRef.current.rejeitar(new Error('A janela do painel foi fechada.'));
        atualizacaoPendenteRef.current = null;
      }
    };
  }, []);

  const sendAction = useCallback((action: string, ...args: unknown[]) => {
    window.ipcAPI.ilustracoes.sendAction(action, ...args);
  }, []);

  const handleInsertImage = useCallback(async (_url: string, id: string, legenda: string) => {
    const preparada = await window.ipcAPI.ilustracoes.prepararInsercao(laudoId, id, 800, 600, window.devicePixelRatio || 1);
    if (!preparada.success) {
      toast.error(preparada.error || 'Não foi possível preparar a imagem.');
      return false;
    }
    sendAction('insertImage', '', id, legenda);
    return true;
  }, [laudoId, sendAction]);

  const handleInsertAll = useCallback(async (imagens: ImagemLaudo[]) => {
    const preparadas: ImagemLaudo[] = [];
    for (const imagem of imagens) {
      const resposta = await window.ipcAPI.ilustracoes.prepararInsercao(laudoId, imagem.id, 800, 600, window.devicePixelRatio || 1);
      if (resposta.success) preparadas.push(imagem);
      else toast.error(resposta.error || 'Não foi possível preparar a imagem.');
    }
    if (preparadas.length > 0) sendAction('insertAll', preparadas);
    return preparadas.map(imagem => imagem.id);
  }, [laudoId, sendAction]);

  const handleDeleteImage = useCallback((imageId: string) => {
    sendAction('deleteImage', imageId);
  }, [sendAction]);

  const handleUpdateLegenda = useCallback((id: string, legenda: string) => {
    sendAction('updateLegenda', id, legenda);
  }, [sendAction]);

  const handleReorder = useCallback((imagens: ImagemLaudo[]) => {
    sendAction('reorder', imagens);
  }, [sendAction]);

  const handleRefreshHtml = useCallback((restaurarLegendas = false): Promise<ResultadoAtualizacaoFiguras> => {
    if (!restaurarLegendas) {
      sendAction('refreshHtml', false);
      return Promise.resolve({ restauradas: 0, semDescricao: 0, falhasConsulta: 0 });
    }
    return new Promise((resolver, rejeitar) => {
      const temporizador = setTimeout(() => {
        atualizacaoPendenteRef.current = null;
        rejeitar(new Error('O editor não respondeu à atualização das figuras.'));
      }, 15000);
      atualizacaoPendenteRef.current = { resolver, rejeitar, temporizador };
      sendAction('refreshHtml', true);
    });
  }, [sendAction]);

  const handleSyncToggle = useCallback((enabled: boolean) => {
    sendAction('syncToggle', enabled);
  }, [sendAction]);

  const handleScrollToFigure = useCallback((imageId: string) => {
    sendAction('scrollToFigure', imageId);
  }, [sendAction]);

  const handleReplaceImage = useCallback(async (imageId: string, imagem: ImagemLaudo, indice?: number) => {
    const preparada = await window.ipcAPI.ilustracoes.prepararInsercao(laudoId, imagem.id, 800, 600, window.devicePixelRatio || 1);
    if (!preparada.success) {
      toast.error(preparada.error || 'Não foi possível preparar a imagem.');
      return false;
    }
    sendAction('replaceImage', imageId, imagem, indice);
    return true;
  }, [laudoId, sendAction]);

  const handleEditImage = useCallback((indice: number, imagem: ImagemLaudo, imagemOrigemId: string, imagemAnteriorId: string) => {
    sendAction('editImage', indice, imagem, imagemOrigemId, imagemAnteriorId);
  }, [sendAction]);

  const handleGerarLegenda = useCallback(async (imageId: string): Promise<string | null> => {
    sendAction('generateCaption', imageId);
    return null;
  }, [sendAction]);

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
            onUpdateLegendaInEditor={handleUpdateLegenda}
            onReorder={handleReorder}
            onRefreshHtml={handleRefreshHtml}
            onSyncToggle={handleSyncToggle}
            onScrollToFigure={handleScrollToFigure}
            onReplaceImage={handleReplaceImage}
            onEditImage={handleEditImage}
            onGerarLegenda={handleGerarLegenda}
            figurasNoEditor={figurasNoEditor}
            syncEnabled={syncEnabled}
            figuraAtivaId={figuraAtivaId}
          />
        )}
      </div>
    </div>
  );
};

export default IlustracoesPanelWindow;
