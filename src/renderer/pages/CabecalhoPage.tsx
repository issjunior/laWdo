import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Eye, Sun, Moon, SunMoon } from 'lucide-react';
import { TinyMceEditor } from '@/components/editor/TinyMceEditor';
import { removerFormatacaoPlaceholders, converterPlaceholdersTextuais } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Placeholder {
  id: string;
  chave: string;
  descricao: string;
  categoria: string;
}

export const CabecalhoPage: React.FC = () => {
  const [conteudo, setConteudo] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);

  const placeholderChaves = useMemo(() => placeholders.map(p => p.chave), [placeholders]);

  const [editorTheme, setEditorTheme] = useState<'light' | 'dark' | 'auto'>(() => {
    try { return (localStorage.getItem('laudo_editor_theme') as 'light' | 'dark' | 'auto') || 'auto'; }
    catch { return 'auto'; }
  });

  const toggleEditorTheme = useCallback(() => {
    setEditorTheme(prev => {
      const next = prev === 'light' ? 'dark' : prev === 'dark' ? 'auto' : 'light';
      try { localStorage.setItem('laudo_editor_theme', next); } catch {}
      return next;
    });
  }, []);

  const themeLabel = editorTheme === 'light' ? 'Claro' : editorTheme === 'dark' ? 'Escuro' : 'Auto';
  const ThemeIcon = editorTheme === 'light' ? Sun : editorTheme === 'dark' ? Moon : SunMoon;

  const CHAVE_CONFIG = 'cabecalho_laudo';

  const carregarCabecalho = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.ipcAPI.configuracao.obter(CHAVE_CONFIG);
      if (result.success && result.data) {
        setConteudo(converterPlaceholdersTextuais(result.data, placeholderChaves));
      }
    } catch (err: any) {
      console.error('Erro ao carregar cabeçalho:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarPlaceholders = useCallback(async () => {
    const r = await window.ipcAPI.placeholder.findAll();
    if (r.success && r.data) {
      setPlaceholders(r.data);
    }
  }, []);

  useEffect(() => {
    carregarCabecalho();
    carregarPlaceholders();
  }, [carregarCabecalho, carregarPlaceholders]);

  const inserirPlaceholder = (chave: string) => {
    const editor = (window as any).tinymce?.get('cabecalho-editor');
    if (editor) {
      editor.execCommand('insertPlaceholder', false, { chave });
    }
  };

  const handlePreview = async () => {
    try {
      setGeneratingPdf(true);
      setPreview(true);

      let html = conteudo || '';

      let peritoNome = '';
      let peritoCargo = '';
      let peritoLotacao = '';
      let peritoMatricula = '';
      try {
        const userJson = sessionStorage.getItem('lawdo_auth_user');
        if (userJson) {
          const perito = JSON.parse(userJson);
          peritoNome = perito.nome || perito.name || '';
          peritoCargo = perito.cargo || perito.role || '';
          peritoLotacao = perito.lotacao || '';
          peritoMatricula = perito.matricula || '';
        }
      } catch {}

      const replacements: Record<string, string> = {
        '{{perito.nome}}': peritoNome,
        '{{perito.cargo}}': peritoCargo,
        '{{perito_nome}}': peritoNome,
        '{{perito_cargo}}': peritoCargo,
        '{{perito_lotacao}}': peritoLotacao,
        '{{perito_matricula}}': peritoMatricula,
        '{{data_atual}}': new Date().toLocaleDateString('pt-BR'),
      };

      for (const [placeholder, value] of Object.entries(replacements)) {
        html = html.split(placeholder).join(value);
      }

      const result = await window.ipcAPI.template.previewPDF(html);
      if (result.success && result.data) {
        const byteChars = atob(result.data);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNums[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(url);
      } else {
        setError(result.error || 'Erro ao gerar PDF');
        setPreview(false);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar PDF');
      setPreview(false);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSalvar = async () => {
    try {
      setSalvando(true);
      setError(null);
      setSuccess(null);

      const result = await window.ipcAPI.configuracao.salvar(
        CHAVE_CONFIG,
        removerFormatacaoPlaceholders(conteudo),
        'html',
        'Cabeçalho padrão para todos os laudos'
      );

      if (result.success) {
        setSuccess('Cabeçalho salvo com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Erro ao salvar cabeçalho');
      }
    } catch (err: any) {
      console.error('Erro ao salvar cabeçalho:', err);
      setError(err.message || 'Erro ao salvar cabeçalho');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <TooltipProvider>
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cabeçalho de Laudos</h1>
          <p className="text-gray-600 mt-2">
            Configure o texto que aparecerá no início de todos os laudos, independentemente do template
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={generatingPdf}
            className="flex items-center gap-2"
          >
            <Eye size={16} />
            {generatingPdf ? 'Gerando PDF...' : 'Visualizar'}
          </Button>
          <Button onClick={handleSalvar} disabled={salvando} className="flex items-center gap-2">
            <Save size={16} />
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Editor de Cabeçalho</CardTitle>
              <CardDescription>
                Use o editor abaixo para formatar o cabeçalho dos laudos. Você pode inserir placeholders como nome do perito, número do laudo, etc.
              </CardDescription>
            </div>
            <div className="border rounded-lg p-1 flex items-center gap-1 bg-muted/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleEditorTheme}
                  className="h-8 px-2.5"
                >
                  <ThemeIcon size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Tema do editor: {themeLabel} {editorTheme === 'auto' ? '(segue o tema do sistema)' : ''}
              </TooltipContent>
            </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : (
            <ContextMenu>
              <ContextMenuTrigger>
                <TinyMceEditor
                  editorId="cabecalho-editor"
                  value={conteudo}
                  onChange={setConteudo}
                  height={400}
                  placeholder="Digite o cabeçalho padrão dos laudos..."
                  placeholderChaves={placeholderChaves}
                  theme={editorTheme}
                />
              </ContextMenuTrigger>
              <ContextMenuContent className="w-64">
                <ContextMenuLabel>Inserir Placeholder</ContextMenuLabel>
                <ContextMenuSeparator />
                {Array.from(new Set(placeholders.map(p => p.categoria))).sort().map(cat => (
                  <ContextMenuSub key={cat}>
                    <ContextMenuSubTrigger>{cat || 'Outros'}</ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-56">
                      {placeholders
                        .filter(p => p.categoria === cat)
                        .sort((a, b) => a.chave.localeCompare(b.chave))
                        .map(p => (
                          <ContextMenuItem
                            key={p.id}
                            onClick={() => inserirPlaceholder(p.chave)}
                          >
                            <div className="flex flex-col">
                              <span className="font-mono text-xs">{`{{${p.chave}}}`}</span>
                              {p.descricao && <span className="text-[10px] text-muted-foreground truncate">{p.descricao}</span>}
                            </div>
                          </ContextMenuItem>
                        ))}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                ))}
              </ContextMenuContent>
            </ContextMenu>
          )}
        </CardContent>
      </Card>

    </div>

    <Dialog open={preview} onOpenChange={(open) => {
      if (!open && previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl('');
      }
      setPreview(open);
    }}>
      <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pré-visualização do Cabeçalho (PDF)</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-[70vh] border rounded-lg overflow-hidden bg-gray-200">
          {generatingPdf ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Gerando PDF...
            </div>
          ) : (
            <iframe
              src={previewBlobUrl}
              className="w-full h-full min-h-[70vh] border-0"
              title="Preview PDF"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
};

export default CabecalhoPage;
