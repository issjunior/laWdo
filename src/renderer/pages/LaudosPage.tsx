import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Save, ArrowLeft, Edit, Search, ChevronDown, ChevronRight, Eye, Printer, FileText } from 'lucide-react';
import { TinyMceEditor } from '@/components/editor/TinyMceEditor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

// ... (seções de interfaces mantidas)

function formatarData(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    const data = new Date(iso);
    if (isNaN(data.getTime())) return iso;
    return data.toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

const aplicarPlaceholders = (html: string, repData: any) => {
  if (!repData) return html;
  
  // Buscar usuário logado para placeholders de perito
  let perito: any = null;
  try {
    const userJson = localStorage.getItem('lawdo_auth_user');
    if (userJson) perito = JSON.parse(userJson);
  } catch (e) {}

  let resultado = html;
  
  // Mapeamento exaustivo para cobrir diferentes estilos de tag
  const mapping: Record<string, string> = {
    // Prefixados com rep.
    'rep.numero': repData.numero || '',
    'rep.documento': repData.numero_documento || '',
    'rep.envolvido': repData.nome_envolvido || '',
    'rep.local': repData.local_fato || '',
    'rep.bo': repData.numero_bo || '',
    'rep.ip': repData.numero_ip || '',
    'rep.data': formatarData(repData.data_requisicao),
    'rep.autoridade': repData.autoridade_solicitante || '',
    'rep.requisicao': repData.numero_documento || '',
    'rep.lacre_entrada': repData.lacre_entrada || '',
    'rep.lacre_saida': repData.lacre_saida || '',
    
    // Sem prefixo (compatibilidade)
    'NUMERO_REP': repData.numero || '',
    'NUMERO': repData.numero || '',
    'NOME_ENVOLVIDO': repData.nome_envolvido || '',
    'ENVOLVIDO': repData.nome_envolvido || '',
    'LOCAL_FATO': repData.local_fato || '',
    'BO': repData.numero_bo || '',
    'IP': repData.numero_ip || '',
    'AUTORIDADE': repData.autoridade_solicitante || '',
    'LACRE_ENTRADA': repData.lacre_entrada || '',
    'LACRE_SAIDA': repData.lacre_saida || '',

    // Perito
    'perito.nome': perito?.nome || '',
    'perito.cargo': perito?.cargo || 'Perito Criminal',
    'perito.especialidade': perito?.especialidade || '',
    
    // Geral
    'data_atual': new Date().toLocaleDateString('pt-BR'),
  };

  // 1. Primeiro passo: Substituir spans do TinyMCE (que contêm o atributo data-placeholder)
  Object.entries(mapping).forEach(([chave, valor]) => {
    const displayValue = valor || '';
    // Escapar pontos e outros caracteres para o Regex
    const escapedChave = chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Regex para encontrar o span inteiro do placeholder
    const spanRegex = new RegExp(`<span[^>]*data-placeholder="\\{\\{${escapedChave}\\}\\}"[^>]*>[\\s\\S]*?<\\/span>`, 'gi');
    resultado = resultado.replace(spanRegex, displayValue);
  });

  // 2. Segundo passo: Substituir tags de texto puro {{...}} que sobraram ou foram digitadas manualmente
  Object.entries(mapping).forEach(([chave, valor]) => {
    const displayValue = valor || '';
    const escapedChave = chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tagRegex = new RegExp(`\\{\\{${escapedChave}\\}\\}`, 'gi');
    resultado = resultado.replace(tagRegex, displayValue);
  });

  // 3. Terceiro passo: Se houver campos rep.X, tentar substituir também {{X}}
  Object.entries(mapping).forEach(([chave, valor]) => {
    if (chave.startsWith('rep.')) {
      const semPrefixo = chave.replace('rep.', '');
      const tagRegex = new RegExp(`\\{\\{${semPrefixo}\\}\\}`, 'gi');
      resultado = resultado.replace(tagRegex, valor || '');
    }
  });

  return resultado;
};

interface LaudoItem {
  id: string;
  rep_id: string;
  perito_id: string;
  template_id: string;
  conteudo: string;
  status: string;
  data_inicio: string;
  data_conclusao?: string;
  data_entrega?: string;
  rep_numero: string;
  template_nome: string;
  status_rep: string;
  tipo_exame_nome?: string;
  nome_envolvido?: string;
}

interface SecaoEditor {
  titulo: string;
  conteudo: string;
}

const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
    'Em andamento': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'Concluído': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'Entregue': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};



/** Decodifica entidades HTML (&Acirc; → Â, &amp; → &, etc.) usando o parser do navegador */
function decodificarEntidadesHtml(texto: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = texto;
  return txt.value;
}

/** Faz o parse do HTML do laudo em seções independentes, usando <h2> como delimitador */
function parseConteudoEmSecoes(html: string): SecaoEditor[] {
  if (!html) return [{ titulo: 'Conteúdo', conteudo: '<p>&nbsp;</p>' }];

  const regexH2 = /<h2[^>]*>(.*?)<\/h2>/gi;
  const matches: { titulo: string; pos: number; endPos: number }[] = [];
  let match;

  while ((match = regexH2.exec(html)) !== null) {
    matches.push({
      titulo: decodificarEntidadesHtml(match[1].replace(/<[^>]*>/g, '').trim()),
      pos: match.index,
      endPos: match.index + match[0].length,
    });
  }

  if (matches.length === 0) {
    return [{ titulo: 'Conteúdo', conteudo: html }];
  }

  const secoes: SecaoEditor[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].endPos;
    const end = i < matches.length - 1 ? matches[i + 1].pos : html.length;
    const conteudo = html.substring(start, end).trim();
    secoes.push({
      titulo: matches[i].titulo,
      conteudo: conteudo || '<p>&nbsp;</p>',
    });
  }

  return secoes;
}

/** Reconstrói o HTML completo concatenando as seções */
function reconstruirConteudo(secoes: SecaoEditor[]): string {
  return secoes.map(s => `<h2>${s.titulo}</h2>\n${s.conteudo}`).join('\n');
}

export const LaudosPage: React.FC = () => {
  const [laudos, setLaudos] = useState<LaudoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editando, setEditando] = useState<LaudoItem | null>(null);
  const [secoes, setSecoes] = useState<SecaoEditor[]>([]);
  const [secoesColapsadas, setSecoesColapsadas] = useState<Record<number, boolean>>({});
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState('');
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);

  const carregarPlaceholders = useCallback(async () => {
    const r = await window.ipcAPI.placeholder.findAll();
    if (r.success && r.data) {
      setPlaceholders(r.data);
    }
  }, []);

  const carregarLaudos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const r = await window.ipcAPI.laudo.findAll();
      if (r.success && r.data) {
        setLaudos(r.data);
      } else {
        setError(r.error || 'Erro ao carregar laudos');
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar laudos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarLaudos();
    carregarPlaceholders();
  }, [carregarLaudos, carregarPlaceholders]);

  const inserirPlaceholder = (editorId: string, chave: string) => {
    const editor = (window as any).tinymce?.get(editorId);
    if (editor) {
      editor.execCommand('insertPlaceholder', false, { chave });
    }
  };

  const filtered = laudos.filter(l =>
    l.rep_numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.template_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.nome_envolvido || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePreview = async () => {
    if (!editando) return;
    try {
      setCarregandoPreview(true);
      setError(null);
      
      // 1. Buscar dados da REP para placeholders
      const rRep = await window.ipcAPI.rep.findById(editando.rep_id);
      if (!rRep.success || !rRep.data) {
        setError('Erro ao carregar dados da REP para o preview');
        return;
      }

      // 2. Buscar cabeçalho das configurações
      let cabecalhoHtml = '';
      const headerResult = await window.ipcAPI.configuracao.obter('cabecalho_laudo');
      if (headerResult.success && headerResult.data) {
        cabecalhoHtml = headerResult.data;
      }

      // 3. Montar HTML completo
      const secoesHtml = secoes
        .map((s, i) => `<h2>${i + 1}. ${s.titulo}</h2>${s.conteudo}`)
        .join('\n');

      let fullHtml = cabecalhoHtml
        ? `<div class="cabecalho" style="border-bottom:2px solid #000;padding-bottom:16px;margin-bottom:32px;">${cabecalhoHtml}</div>`
        : '';
      fullHtml += secoesHtml;

      // 4. Aplicar placeholders
      const htmlProcessado = aplicarPlaceholders(fullHtml, rRep.data);

      // 5. Gerar PDF via IPC (usando o mesmo handler do template)
      const result = await window.ipcAPI.template.previewPDF(htmlProcessado);
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
        setPreviewOpen(true);
      } else {
        setError(result.error || 'Erro ao gerar PDF do laudo');
      }
    } catch (e: any) {
      setError('Erro ao gerar preview: ' + e.message);
    } finally {
      setCarregandoPreview(false);
    }
  };

  const handleEditar = (laudo: LaudoItem) => {
    setEditando(laudo);
    setSecoes(parseConteudoEmSecoes(laudo.conteudo || ''));
    setSecoesColapsadas({});
    setError(null);
    setSuccess(null);
  };

  const handleVoltar = () => {
    setEditando(null);
    setSecoes([]);
    setSecoesColapsadas({});
    setError(null);
    setSuccess(null);
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl('');
    }
  };

  const handleSalvar = async () => {
    if (!editando) return;
    try {
      setSalvando(true);
      setError(null);
      setSuccess(null);

      const conteudo = reconstruirConteudo(secoes);
      const r = await window.ipcAPI.laudo.updateConteudo(editando.id, conteudo);
      if (r.success) {
        setSuccess('Laudo salvo com sucesso!');
        setEditando(prev => prev ? { ...prev, conteudo } : null);
        setLaudos(prev =>
          prev.map(l => (l.id === editando.id ? { ...l, conteudo } : l))
        );
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(r.error || 'Erro ao salvar laudo');
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar laudo');
    } finally {
      setSalvando(false);
    }
  };

  const toggleSecao = (idx: number) => {
    setSecoesColapsadas(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const atualizarConteudoSecao = (idx: number, novoConteudo: string) => {
    setSecoes(prev => {
      const novas = [...prev];
      novas[idx] = { ...novas[idx], conteudo: novoConteudo };
      return novas;
    });
  };

  // Modo editor com múltiplas seções
  if (editando) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Editor de Laudo</h1>
            <p className="text-muted-foreground mt-1">
              REP: {editando.rep_numero}
              {editando.tipo_exame_nome && ` — ${editando.tipo_exame_nome}`}
              {editando.nome_envolvido && ` — ${editando.nome_envolvido}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleVoltar} className="flex items-center gap-2">
              <ArrowLeft size={16} /> Voltar
            </Button>
            <Button variant="secondary" onClick={handlePreview} disabled={carregandoPreview || salvando} className="flex items-center gap-2">
              <Eye size={16} /> {carregandoPreview ? 'Gerando PDF...' : 'Visualizar'}
            </Button>
            <Button onClick={handleSalvar} disabled={salvando || carregandoPreview} className="flex items-center gap-2">
              <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {success && <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900/50"><AlertDescription className="text-green-800 dark:text-green-400">{success}</AlertDescription></Alert>}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <div>
                <CardTitle className="text-lg">Template: {editando.template_nome || 'Não definido'}</CardTitle>
                <CardDescription>
                  Status: {editando.status} &middot; Iniciado em {formatarData(editando.data_inicio)}
                  {editando.data_conclusao ? ` &middot; Concluído em ${formatarData(editando.data_conclusao)}` : ''}
                </CardDescription>
              </div>
              {statusBadge(editando.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {secoes.map((secao, idx) => (
              <div key={idx} className="border rounded-lg">
                <button
                  type="button"
                  onClick={() => toggleSecao(idx)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 rounded-t-lg transition-colors"
                >
                  <h3 className="text-base font-semibold">{secao.titulo}</h3>
                  {secoesColapsadas[idx] ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                </button>
                 {!secoesColapsadas[idx] && (
                  <div className="px-4 pb-4">
                    <ContextMenu>
                      <ContextMenuTrigger>
                        <TinyMceEditor
                          editorId={`secao-${idx}`}
                          value={secao.conteudo}
                          onChange={val => atualizarConteudoSecao(idx, val)}
                          height={400}
                          placeholder={`Escreva o conteúdo de "${secao.titulo}"...`}
                          laudoId={editando.id}
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
                                    onClick={() => inserirPlaceholder(`secao-${idx}`, p.chave)}
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
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Modal de Visualização (Preview PDF) */}
        <Dialog open={previewOpen} onOpenChange={(open) => {
          if (!open && previewBlobUrl) {
            URL.revokeObjectURL(previewBlobUrl);
            setPreviewBlobUrl('');
          }
          setPreviewOpen(open);
        }}>
          <DialogContent className="max-w-[90vw] w-[1000px] h-[95vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-4 border-b">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Pré-visualização do Laudo (PDF)
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 bg-slate-100 dark:bg-slate-800">
              {carregandoPreview ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Gerando PDF...
                </div>
              ) : (
                <iframe
                  src={previewBlobUrl}
                  className="w-full h-full border-0"
                  title="Preview PDF"
                />
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-background">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Modo lista
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Laudos</h1>
          <p className="text-muted-foreground mt-1">Escreva e edite os laudos periciais usando os templates cadastrados</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
            <div>
              <CardTitle>Laudos em Andamento</CardTitle>
              <CardDescription>{filtered.length} laudo(s) encontrado(s)</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por REP, template ou envolvido..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Nenhum laudo encontrado.' : 'Nenhum laudo cadastrado. Crie uma REP com template vinculado para gerar um laudo automaticamente.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº REP</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Tipo de Exame</TableHead>
                  <TableHead>Envolvido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(laudo => (
                  <TableRow key={laudo.id}>
                    <TableCell className="font-medium">{laudo.rep_numero}</TableCell>
                    <TableCell>{laudo.template_nome || 'Não definido'}</TableCell>
                    <TableCell>{laudo.tipo_exame_nome || '-'}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{laudo.nome_envolvido || '-'}</TableCell>
                    <TableCell>{statusBadge(laudo.status)}</TableCell>
                    <TableCell>{formatarData(laudo.data_inicio)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditar(laudo)} aria-label={`Editar laudo da REP ${laudo.rep_numero}`}>
                        <Edit size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
