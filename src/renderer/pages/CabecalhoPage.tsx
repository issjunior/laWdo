import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Eye, EyeOff, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Heading } from 'lucide-react';

export const CabecalhoPage: React.FC = () => {
  const [conteudo, setConteudo] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const CHAVE_CONFIG = 'cabecalho_laudo';

  // Carregar cabeçalho salvo
  const carregarCabecalho = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.ipcAPI.configuracao.obter(CHAVE_CONFIG);
      if (result.success && result.data) {
        setConteudo(result.data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar cabeçalho:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarCabecalho();
  }, [carregarCabecalho]);

  // Salvar cabeçalho
  const handleSalvar = async () => {
    try {
      setSalvando(true);
      setError(null);
      setSuccess(null);

      const result = await window.ipcAPI.configuracao.salvar(
        CHAVE_CONFIG,
        conteudo,
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

  // Comandos do editor
  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      setConteudo(editorRef.current.innerHTML);
    }
  };

  const handleInsertHeading = () => {
    execCmd('formatBlock', '<h2>');
  };

  const handleInsertParagraph = () => {
    execCmd('formatBlock', '<p>');
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setConteudo(editorRef.current.innerHTML);
    }
  };

  // Inserir placeholder ao final do texto
  const handleInsertPlaceholder = (tag: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      execCmd('insertHTML', ` <span class="placeholder-tag" style="background:#e5e7eb;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:0.9em;color:#374151;">{${tag}}</span> `);
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
              className="prose prose-sm max-w-none border rounded-lg p-6 min-h-[400px] bg-white"
              dangerouslySetInnerHTML={{ __html: conteudo || '<p class="text-gray-400">Nenhum conteúdo definido.</p>' }}
            />
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-1 p-2 border rounded-t-lg bg-gray-50">
                <Button variant="ghost" size="sm" onClick={() => execCmd('bold')} title="Negrito">
                  <Bold size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCmd('italic')} title="Itálico">
                  <Italic size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCmd('underline')} title="Sublinhado">
                  <Underline size={16} />
                </Button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <Button variant="ghost" size="sm" onClick={handleInsertHeading} title="Título">
                  <Heading size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleInsertParagraph} title="Parágrafo">
                  <span className="text-xs font-bold">P</span>
                </Button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <Button variant="ghost" size="sm" onClick={() => execCmd('justifyLeft')} title="Alinhar à esquerda">
                  <AlignLeft size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCmd('justifyCenter')} title="Centralizar">
                  <AlignCenter size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCmd('justifyRight')} title="Alinhar à direita">
                  <AlignRight size={16} />
                </Button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <Button variant="ghost" size="sm" onClick={() => execCmd('insertUnorderedList')} title="Lista">
                  <List size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCmd('insertOrderedList')} title="Lista numerada">
                  <ListOrdered size={16} />
                </Button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <Button variant="ghost" size="sm" onClick={() => execCmd('outdent')} title="Recuar">
                  <span className="text-xs font-bold">←</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => execCmd('indent')} title="Avançar">
                  <span className="text-xs font-bold">→</span>
                </Button>
              </div>

              {/* Área de edição */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="border-x border-b rounded-b-lg p-4 min-h-[400px] focus:outline-none focus:ring-2 focus:ring-blue-500 prose prose-sm max-w-none bg-white"
                dangerouslySetInnerHTML={{ __html: conteudo }}
                onInput={handleEditorInput}
                onBlur={handleEditorInput}
              />

              {/* Inserir placeholders */}
              <div className="flex flex-wrap items-center gap-2 p-3 border rounded-lg bg-gray-50">
                <span className="text-sm text-gray-600 font-medium mr-1">Placeholders:</span>
                {['perito.nome', 'rep.numero', 'data_atual', 'laudo.numero', 'solicitante.nome'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleInsertPlaceholder(tag)}
                    className="inline-flex items-center px-2.5 py-1 rounded text-xs font-mono bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors cursor-pointer border-0"
                  >
                    {'{' + tag + '}'}
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Preview de como fica no laudo */}
      <Card>
        <CardHeader>
          <CardTitle>Pré-visualização no Laudo</CardTitle>
          <CardDescription>
            Simulação de como o cabeçalho aparecerá no início de cada laudo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-8 bg-white">
            {/* Cabeçalho */}
            <div
              className="border-b pb-4 mb-4"
              dangerouslySetInnerHTML={{ __html: conteudo || '<span class="text-gray-400">[Cabeçalho vazio - configure acima]</span>' }}
            />
            {/* Conteúdo simulado do laudo */}
            <div className="text-gray-500 italic text-sm">
              <p>--- Conteúdo do laudo será inserido aqui ---</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            * Esta é apenas uma simulação. O cabeçalho real será aplicado automaticamente em todos os laudos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CabecalhoPage;
