import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Eye } from 'lucide-react';
import { TinyMceEditor } from '@/components/editor/TinyMceEditor';
import { removerFormatacaoPlaceholders, converterPlaceholdersTextuais } from '@/lib/utils';
import { PlaceholderContextMenu, type CategoriaItem } from '@/components/editor/PlaceholderContextMenu';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getMargens } from '@/lib/margens';
import { buildHeaderTemplate } from '@/lib/pdf-header';

interface Placeholder {
  id: string;
  chave: string;
  descricao: string;
  categoria_id: string;
}

interface TinyMceGlobal {
  get: (editorId: string) => { execCommand: (command: string, ui: boolean, value: unknown) => void } | null;
}

interface PeritoSessao {
  nome?: string;
  name?: string;
  cargo?: string;
  role?: string;
  lotacao?: string;
  matricula?: string;
}

function mensagemErro(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

const DEFAUL_PAGINAS_HTML = `<p style="text-align: right;">FLS. {{pagina}}/{{totalPaginas}}</p>\n<p style="text-align: right;">LAUDO n&ordm; {{numero_rep}}</p>`;
const CHAVE_CONFIG = 'cabecalho_laudo';
const CHAVE_CONFIG_PAGINAS = 'cabecalho_paginas';

export const CabecalhoPage: React.FC = () => {
  const [conteudo, setConteudo] = useState('');
  const [conteudoPaginas, setConteudoPaginas] = useState(DEFAUL_PAGINAS_HTML);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvandoPaginas, setSalvandoPaginas] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);

  const placeholderChaves = useMemo(() => placeholders.map(p => p.chave), [placeholders]);

  useEffect(() => {
    let cancelado = false;

    const carregarDadosIniciais = async () => {
      const [cabecalho, cabecalhoPaginas, categoriasResult, placeholdersResult] = await Promise.allSettled([
        window.ipcAPI.configuracao.obter(CHAVE_CONFIG),
        window.ipcAPI.configuracao.obter(CHAVE_CONFIG_PAGINAS),
        window.ipcAPI.categoria.findAll(),
        window.ipcAPI.placeholder.findAll(),
      ]);

      if (cancelado) return;

      const novosPlaceholders: Placeholder[] = placeholdersResult.status === 'fulfilled' && placeholdersResult.value.success && placeholdersResult.value.data
        ? placeholdersResult.value.data
        : [];
      const chavesPlaceholders = novosPlaceholders.map(placeholder => placeholder.chave);

      if (categoriasResult.status === 'fulfilled' && categoriasResult.value.success && categoriasResult.value.data) {
        setCategorias(categoriasResult.value.data);
      } else if (categoriasResult.status === 'rejected') {
        console.error('Erro ao carregar categorias:', categoriasResult.reason);
      }

      if (placeholdersResult.status === 'fulfilled' && placeholdersResult.value.success && placeholdersResult.value.data) {
        setPlaceholders(novosPlaceholders);
      } else if (placeholdersResult.status === 'rejected') {
        console.error('Erro ao carregar placeholders:', placeholdersResult.reason);
      }

      if (cabecalho.status === 'fulfilled' && cabecalho.value.success && cabecalho.value.data) {
        setConteudo(converterPlaceholdersTextuais(cabecalho.value.data, chavesPlaceholders));
      } else if (cabecalho.status === 'rejected') {
        console.error('Erro ao carregar cabeçalho:', cabecalho.reason);
      }

      if (cabecalhoPaginas.status === 'fulfilled' && cabecalhoPaginas.value.success && cabecalhoPaginas.value.data) {
        setConteudoPaginas(converterPlaceholdersTextuais(cabecalhoPaginas.value.data, chavesPlaceholders));
      } else if (cabecalhoPaginas.status === 'rejected') {
        console.error('Erro ao carregar cabeçalho de páginas:', cabecalhoPaginas.reason);
      }

      setLoading(false);
    };

    void carregarDadosIniciais();

    return () => {
      cancelado = true;
    };
  }, []);

  const inserirPlaceholder = (editorId: string, chave: string) => {
    const tinymce = (window as Window & typeof globalThis & { tinymce?: TinyMceGlobal }).tinymce;
    const editor = tinymce?.get(editorId);
    if (editor) {
      editor.execCommand('insertPlaceholder', false, { chave });
    }
  };

  const handlePreview = async () => {
    try {
      setGeneratingPdf(true);
      setPreview(true);
      setError(null);

      const { html: headerTemplate } = buildHeaderTemplate(conteudoPaginas, { numero_rep: 'XXX.XXX-YYYY' });

      const primeiroHtml = conteudo || '';
      let bodyHtml = `<div class="cabecalho" style="padding-bottom:16px;margin-bottom:32px;">${primeiroHtml}</div>`;
      bodyHtml += '<p style="color:#999;font-style:italic;">Pré-visualização do conteúdo do laudo...</p>';

      let peritoNome = '';
      let peritoCargo = '';
      let peritoLotacao = '';
      let peritoMatricula = '';
      try {
        const userJson = sessionStorage.getItem('lawdo_auth_user');
        if (userJson) {
          const perito = JSON.parse(userJson) as PeritoSessao;
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
        '{{laudo.numero}}': '<strong>2026/00123</strong>',
        '{{numero_rep}}': '<strong>XXX.XXX-YYYY</strong>',
      };

      for (const [placeholder, value] of Object.entries(replacements)) {
        bodyHtml = bodyHtml.split(placeholder).join(value);
      }

      const result = await window.ipcAPI.template.previewPDF(bodyHtml, await getMargens(), headerTemplate || undefined);
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
    } catch (err: unknown) {
      setError(mensagemErro(err) || 'Erro ao gerar PDF');
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
        'Cabeçalho da primeira página'
      );

      if (result.success) {
        setSuccess('Cabeçalho da primeira página salvo com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Erro ao salvar cabeçalho');
      }
    } catch (err: unknown) {
      console.error('Erro ao salvar cabeçalho:', err);
      setError(mensagemErro(err) || 'Erro ao salvar cabeçalho');
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarPaginas = async () => {
    try {
      setSalvandoPaginas(true);
      setError(null);
      setSuccess(null);

      const result = await window.ipcAPI.configuracao.salvar(
        CHAVE_CONFIG_PAGINAS,
        removerFormatacaoPlaceholders(conteudoPaginas),
        'html',
        'Cabeçalho de todas as páginas com contador de folhas'
      );

      if (result.success) {
        setSuccess('Cabeçalho de páginas salvo com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Erro ao salvar cabeçalho');
      }
    } catch (err: unknown) {
      console.error('Erro ao salvar cabeçalho:', err);
      setError(mensagemErro(err) || 'Erro ao salvar cabeçalho');
    } finally {
      setSalvandoPaginas(false);
    }
  };

  const extraPlaceholderChaves = useMemo(() => [...placeholderChaves, 'pagina', 'totalPaginas'], [placeholderChaves]);

  return (
    <TooltipProvider>
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cabeçalho de Laudos</h1>
          <p className="text-gray-600 mt-2">
            Configure os cabeçalhos que aparecerão na geração dos laudos em PDF
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
          <div className="border rounded-lg p-1 flex items-center gap-1 bg-muted/50">
          </div>
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
              <CardTitle>Cabeçalho de Todas as Páginas</CardTitle>
              <CardDescription>
                Aplicado em <strong>todas</strong> as páginas do PDF na margem superior direita.
                Contém o contador de folhas automático. Use <code>{'{{pagina}}'}</code> para o número da folha corrente e <code>{'{{totalPaginas}}'}</code> para o total de folhas.
                Os placeholders do sistema (ex: <code>{'{{numero_rep}}'}</code>) também são suportados.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : (
            <PlaceholderContextMenu
              editorId="cabecalho-paginas-editor"
              categorias={categorias}
              placeholders={placeholders}
              onInsertPlaceholder={inserirPlaceholder}
            >
              <TinyMceEditor
                editorId="cabecalho-paginas-editor"
                value={conteudoPaginas}
                onChange={(html: string) => setConteudoPaginas(html)}
                height={300}
                placeholder="FLS. {{pagina}}/{{totalPaginas}}&#10;LAUDO nº {{numero_rep}}"
                placeholderChaves={extraPlaceholderChaves}
              />
            </PlaceholderContextMenu>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSalvarPaginas} disabled={salvandoPaginas} className="flex items-center gap-2">
              <Save size={16} />
              {salvandoPaginas ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cabeçalho da Primeira Página</CardTitle>
              <CardDescription>
                Aplicado somente na <strong>primeira página</strong> do laudo.
                Use o editor para inserir o conteúdo livre com imagens, tabelas e formatação.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : (
            <PlaceholderContextMenu
              editorId="cabecalho-editor"
              categorias={categorias}
              placeholders={placeholders}
              onInsertPlaceholder={inserirPlaceholder}
            >
                <TinyMceEditor
                  editorId="cabecalho-editor"
                  value={conteudo}
                  onChange={(html: string) => setConteudo(html)}
                  height={300}
                  placeholder="Digite o cabeçalho da primeira página..."
                  placeholderChaves={placeholderChaves}
                />
            </PlaceholderContextMenu>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSalvar} disabled={salvando} className="flex items-center gap-2">
              <Save size={16} />
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
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

