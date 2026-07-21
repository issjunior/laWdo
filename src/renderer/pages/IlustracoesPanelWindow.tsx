import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IlustracoesPanel, type ImagemLaudo } from '@/components/laudo/IlustracoesPanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface SyncState {
  figurasNoEditor: ImagemLaudo[];
  syncEnabled: boolean;
  figuraAtivaId: string | null;
  tema?: string;
}

const IlustracoesPanelWindow: React.FC = () => {
  const [searchParams] = useSearchParams();
  const laudoId = searchParams.get('laudoId') || '';
  const tituloLaudo = searchParams.get('titulo') || '';

  const [figurasNoEditor, setFigurasNoEditor] = useState<ImagemLaudo[]>([]);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [figuraAtivaId, setFiguraAtivaId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubState = window.ipcAPI.ilustracoes.onStateSync((data: SyncState) => {
      setFigurasNoEditor(data.figurasNoEditor || []);
      setSyncEnabled(data.syncEnabled ?? true);
      setFiguraAtivaId(data.figuraAtivaId ?? null);
      setReady(true);

      if (data.tema === 'dark') {
        document.body.classList.add('dark');
      } else if (data.tema === 'light') {
        document.body.classList.remove('dark');
      }
    });

    return unsubState;
  }, []);

  const sendAction = useCallback((action: string, ...args: unknown[]) => {
    window.ipcAPI.ilustracoes.sendAction(action, ...args);
  }, []);

  const handleInsertImage = useCallback((url: string, id: string, legenda: string) => {
    sendAction('insertImage', url, id, legenda);
    toast.success('Imagem enviada ao editor');
  }, [sendAction]);

  const handleInsertAll = useCallback((imagens: ImagemLaudo[]) => {
    sendAction('insertAll', imagens);
    toast.success(`${imagens.length} imagens enviadas ao editor`);
  }, [sendAction]);

  const handleDeleteImage = useCallback((imageId: string) => {
    sendAction('deleteImage', imageId);
  }, [sendAction]);

  const handleUpdateLegenda = useCallback((id: string, legenda: string) => {
    sendAction('updateLegenda', id, legenda);
  }, [sendAction]);

  const handleReorder = useCallback((imagens: ImagemLaudo[]) => {
    sendAction('reorder', imagens);
  }, [sendAction]);

  const handleRefreshHtml = useCallback(() => {
    sendAction('refreshHtml');
  }, [sendAction]);

  const handleSyncToggle = useCallback((enabled: boolean) => {
    sendAction('syncToggle', enabled);
  }, [sendAction]);

  const handleScrollToFigure = useCallback((imageId: string) => {
    sendAction('scrollToFigure', imageId);
  }, [sendAction]);

  const handleReplaceImage = useCallback((imageId: string, imagem: ImagemLaudo) => {
    sendAction('replaceImage', imageId, imagem);
    toast.success('Figura enviada para substituição');
  }, [sendAction]);

  const handleVoltarAoEditor = () => {
    window.ipcAPI.ilustracoes.sendAction('popIn');
    window.ipcAPI.ilustracoes.closePanel();
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card flex-shrink-0">
        <div>
          <h1 className="text-sm font-semibold">Painel de Ilustrações</h1>
          {tituloLaudo && (
            <p className="text-[10px] text-muted-foreground">Laudo {tituloLaudo}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleVoltarAoEditor}
          className="h-7 text-xs gap-1"
        >
          <ArrowLeft size={14} />
          Voltar ao editor
        </Button>
      </header>

      <div className="flex-1 overflow-hidden">
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
