import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Eye, EyeOff } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);

  const placeholderChaves = useMemo(() => placeholders.map(p => p.chave), [placeholders]);

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
            onClick={() => setPreview(!preview)}
            className="flex items-center gap-2"
          >
            {preview ? <EyeOff size={16} /> : <Eye size={16} />}
            {preview ? 'Editar' : 'Visualizar'}
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
          <CardTitle>Editor de Cabeçalho</CardTitle>
          <CardDescription>
            Use o editor abaixo para formatar o cabeçalho dos laudos. Você pode inserir placeholders como nome do perito, número do laudo, etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : preview ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-6 min-h-[400px] bg-white"
              dangerouslySetInnerHTML={{ __html: conteudo || '<p class="text-gray-400">Nenhum conteúdo definido.</p>' }}
            />
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
  );
};

export default CabecalhoPage;
