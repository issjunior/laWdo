import React, { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { Eye, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TinyMceEditor } from '@/components/editor/TinyMceEditor';
import { PlaceholderContextMenu, type CategoriaItem, type PlaceholderItem } from '@/components/editor/PlaceholderContextMenu';
import { converterPlaceholdersTextuais, removerFormatacaoPlaceholders } from '@/lib/utils';
import { CHAVES_PLACEHOLDERS_REP } from '@/lib/indice-placeholders';
import { carregarApresentacaoPadrao } from '@/lib/apresentacao-laudo';
import { buildPdfHeaderConfig } from '@/lib/pdf-header';
import { getMargens } from '@/lib/margens';
import {
  CHAVE_CABECALHO_DOCUMENTO, CHAVE_FECHAMENTO_LAUDO, FECHAMENTO_DESATIVADO, MODELO_FECHAMENTO_LAUDO,
  esquemaFechamentoLaudo, type CabecalhoLaudo, type FechamentoLaudo,
} from '@shared/configuracoes/apresentacao-laudo';

const esquemaCategorias = z.array(z.object({ id: z.string(), label: z.string(), icone: z.string(), cor: z.string(), is_sistema: z.number().optional() }));
const esquemaPlaceholders = z.array(z.object({ id: z.string(), chave: z.string(), descricao: z.string(), categoria_id: z.string() }));
const mensagemErro = (erro: unknown) => erro instanceof Error ? erro.message : 'Erro inesperado';

export const CabecalhoPage: React.FC = () => {
  const [cabecalho, setCabecalho] = useState<CabecalhoLaudo>({ habilitado: true, primeiraPagina: '', todasPaginas: '' });
  const [fechamento, setFechamento] = useState<FechamentoLaudo>({ ...FECHAMENTO_DESATIVADO });
  const [espacamento, setEspacamento] = useState('24');
  const [perito, setPerito] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [previaAberta, setPreviaAberta] = useState(false);
  const [urlPrevia, setUrlPrevia] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [placeholders, setPlaceholders] = useState<PlaceholderItem[]>([]);
  const chaves = useMemo(() => [...new Set([...CHAVES_PLACEHOLDERS_REP, ...placeholders.map(item => item.chave), 'pagina', 'totalPaginas'])], [placeholders]);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const [apresentacao, respostaCategorias, respostaPlaceholders] = await Promise.all([
          carregarApresentacaoPadrao(), window.ipcAPI.categoria.findAll(), window.ipcAPI.placeholder.findAll(),
        ]);
        if (cancelado) return;
        const categoriasValidas = esquemaCategorias.safeParse(respostaCategorias.success ? respostaCategorias.data : []);
        const placeholdersValidos = esquemaPlaceholders.safeParse(respostaPlaceholders.success ? respostaPlaceholders.data : []);
        const placeholdersCarregados = placeholdersValidos.success ? placeholdersValidos.data : [];
        const chavesIniciais = [...CHAVES_PLACEHOLDERS_REP, ...placeholdersCarregados.map(item => item.chave), 'pagina', 'totalPaginas'];
        setCategorias(categoriasValidas.success ? categoriasValidas.data : []);
        setPlaceholders(placeholdersCarregados);
        setCabecalho({
          ...apresentacao.cabecalho,
          primeiraPagina: converterPlaceholdersTextuais(apresentacao.cabecalho.primeiraPagina, chavesIniciais),
          todasPaginas: converterPlaceholdersTextuais(apresentacao.cabecalho.todasPaginas, chavesIniciais),
        });
        setFechamento({ ...apresentacao.fechamento, conteudo: converterPlaceholdersTextuais(apresentacao.fechamento.conteudo, chavesIniciais) });
        setEspacamento(String(apresentacao.fechamento.espacamentoAntesPt));
        setPerito(apresentacao.perito);
        setCarregado(true);
      } catch (falha: unknown) {
        if (!cancelado) setErro(mensagemErro(falha));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  useEffect(() => () => { if (urlPrevia) URL.revokeObjectURL(urlPrevia); }, [urlPrevia]);

  const obterFechamento = () => esquemaFechamentoLaudo.parse({
    ...fechamento, espacamentoAntesPt: espacamento.trim() ? Number(espacamento) : NaN,
  });

  const salvar = async (aba: 'cabecalho' | 'fechamento') => {
    setSalvando(true); setErro(null); setSucesso(null);
    try {
      const dados = aba === 'cabecalho'
        ? { ...cabecalho, primeiraPagina: removerFormatacaoPlaceholders(cabecalho.primeiraPagina), todasPaginas: removerFormatacaoPlaceholders(cabecalho.todasPaginas) }
        : { ...obterFechamento(), conteudo: removerFormatacaoPlaceholders(fechamento.conteudo) };
      const resposta = await window.ipcAPI.configuracao.salvar(
        aba === 'cabecalho' ? CHAVE_CABECALHO_DOCUMENTO : CHAVE_FECHAMENTO_LAUDO,
        JSON.stringify(dados), 'json', aba === 'cabecalho' ? 'Cabeçalhos e ativação dos novos laudos' : 'Fechamento dos novos laudos',
      );
      if (!resposta.success) throw new Error(resposta.error || 'Não foi possível salvar.');
      setSucesso(aba === 'cabecalho' ? 'Cabeçalho salvo para os novos laudos.' : 'Fechamento salvo para os novos laudos.');
    } catch (falha: unknown) {
      setErro(falha instanceof z.ZodError ? 'Informe um espaçamento entre 0 e 300 pontos.' : mensagemErro(falha));
    } finally { setSalvando(false); }
  };

  const visualizar = async () => {
    setGerandoPdf(true); setErro(null); setPreviaAberta(true);
    try {
      const { headerTemplate, cabecalhoPrimeiraPagina, fechamentoHtml } = await buildPdfHeaderConfig({
        usarCopiaLaudo: true, apresentacaoJson: { versao: 1, cabecalho, fechamento: obterFechamento(), perito }, numeroRepFallback: '321.654-2026',
      });
      const html = (cabecalhoPrimeiraPagina ? `<div class="cabecalho" style="padding-bottom:16px;margin-bottom:32px;">${cabecalhoPrimeiraPagina}</div>` : '')
        + '<p>Pré-visualização do conteúdo do laudo.</p>' + fechamentoHtml;
      const resposta = await window.ipcAPI.template.previewPDF(html, await getMargens(), headerTemplate || undefined);
      if (!resposta.success || typeof resposta.data !== 'string') throw new Error(resposta.error || 'Não foi possível gerar a prévia.');
      const bytes = Uint8Array.from(atob(resposta.data), caractere => caractere.charCodeAt(0));
      setUrlPrevia(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })));
    } catch (falha: unknown) {
      setErro(falha instanceof z.ZodError ? 'Informe um espaçamento entre 0 e 300 pontos.' : mensagemErro(falha));
      setPreviaAberta(false);
    } finally { setGerandoPdf(false); }
  };

  const editor = (id: string, conteudo: string, alterar: (html: string) => void) => carregando
    ? <p className="py-8 text-center text-muted-foreground">Carregando...</p>
    : carregado && <PlaceholderContextMenu editorId={id} categorias={categorias} placeholders={placeholders} onInsertPlaceholder={(editorId, chave) => {
      const janela = window as Window & { tinymce?: { get: (id: string) => { execCommand: (comando: string, interfaceUsuario: boolean, valor: unknown) => void } | null } };
      janela.tinymce?.get(editorId)?.execCommand('insertPlaceholder', false, { chave });
    }}>
      <TinyMceEditor editorId={id} value={conteudo} onChange={alterar} height={300} placeholderChaves={chaves} />
    </PlaceholderContextMenu>;

  return <TooltipProvider><div className="container mx-auto space-y-6 p-6">
    <div className="flex items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Cabeçalho e fechamento</h1>
        <p className="mt-2 text-muted-foreground">As configurações salvas serão aplicadas aos novos laudos. Os existentes mantêm sua configuração.</p></div>
      <Button variant="outline" onClick={() => { void visualizar(); }} disabled={!carregado || gerandoPdf || salvando}><Eye className="mr-2 h-4 w-4" />{gerandoPdf ? 'Gerando PDF...' : 'Visualizar'}</Button>
    </div>
    {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}
    {sucesso && <Alert><AlertDescription>{sucesso}</AlertDescription></Alert>}
    <Tabs defaultValue="cabecalho">
      <TabsList><TabsTrigger value="cabecalho">Cabeçalho</TabsTrigger><TabsTrigger value="fechamento">Fechamento</TabsTrigger></TabsList>
      <TabsContent value="cabecalho" forceMount className="space-y-6 data-[state=inactive]:hidden">
        <div className="space-y-2"><div className="flex items-center gap-2"><Checkbox id="inserir-cabecalho" checked={cabecalho.habilitado} disabled={!carregado || salvando} onCheckedChange={valor => setCabecalho(atual => ({ ...atual, habilitado: valor === true }))} /><Label htmlFor="inserir-cabecalho">Inserir cabeçalho nos laudos</Label></div>
          {!cabecalho.habilitado && <p className="text-sm text-muted-foreground">Desativado — não será incluído nos novos laudos</p>}</div>
        <Card><CardHeader><CardTitle>Cabeçalho da Primeira Página</CardTitle><CardDescription>Conteúdo livre com imagens, tabelas, formatação e placeholders.</CardDescription></CardHeader><CardContent>
          {editor('cabecalho-editor', cabecalho.primeiraPagina, html => setCabecalho(atual => ({ ...atual, primeiraPagina: html })))}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Cabeçalho de Todas as Páginas</CardTitle><CardDescription>No PDF, use {'{{pagina}}'} e {'{{totalPaginas}}'} para o contador de folhas.</CardDescription></CardHeader><CardContent>
          {editor('cabecalho-paginas-editor', cabecalho.todasPaginas, html => setCabecalho(atual => ({ ...atual, todasPaginas: html })))}
        </CardContent></Card>
        <div className="flex justify-end"><Button onClick={() => { void salvar('cabecalho'); }} disabled={!carregado || salvando}><Save className="mr-2 h-4 w-4" />{salvando ? 'Salvando...' : 'Salvar cabeçalho'}</Button></div>
      </TabsContent>
      <TabsContent value="fechamento" forceMount className="space-y-6 data-[state=inactive]:hidden">
        <div className="space-y-2"><div className="flex items-center gap-2"><Checkbox id="inserir-fechamento" checked={fechamento.habilitado} disabled={!carregado || salvando} onCheckedChange={valor => setFechamento(atual => ({ ...atual, habilitado: valor === true }))} /><Label htmlFor="inserir-fechamento">Inserir fechamento nos laudos</Label></div>
          {!fechamento.habilitado && <p className="text-sm text-muted-foreground">Desativado — não será incluído nos novos laudos</p>}</div>
        <Card><CardHeader><CardTitle>Fechamento do laudo</CardTitle><CardDescription>Inserido uma única vez, após todo o conteúdo. Revise os templates que já contenham fechamento para evitar duplicação. A indicação de assinatura digital é apenas visual.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!carregado || Boolean(fechamento.conteudo.trim())} onClick={() => setFechamento(atual => ({ ...atual, conteudo: converterPlaceholdersTextuais(MODELO_FECHAMENTO_LAUDO, chaves) }))}>Inserir modelo de fechamento</Button>
            </div>
            {editor('fechamento-editor', fechamento.conteudo, html => setFechamento(atual => ({ ...atual, conteudo: html })))}
            <div className="max-w-xs space-y-2"><Label htmlFor="espacamento-fechamento">Espaçamento acima (pontos)</Label><Input id="espacamento-fechamento" type="number" min={0} max={300} step={1} value={espacamento} disabled={!carregado} onChange={evento => setEspacamento(evento.target.value)} /></div>
          </CardContent>
        </Card>
        <div className="flex justify-end"><Button onClick={() => { void salvar('fechamento'); }} disabled={!carregado || salvando}><Save className="mr-2 h-4 w-4" />{salvando ? 'Salvando...' : 'Salvar fechamento'}</Button></div>
      </TabsContent>
    </Tabs>
    <Dialog open={previaAberta} onOpenChange={setPreviaAberta}><DialogContent className="h-[90vh] max-w-5xl"><DialogHeader><DialogTitle>Pré-visualização do cabeçalho e fechamento</DialogTitle></DialogHeader>
      {gerandoPdf ? <p className="text-center text-muted-foreground">Gerando PDF...</p> : <iframe src={urlPrevia} title="Prévia do laudo" className="h-full min-h-0 w-full rounded border" />}
    </DialogContent></Dialog>
  </div></TooltipProvider>;
};
