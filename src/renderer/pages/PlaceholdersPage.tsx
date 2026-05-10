import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Lock,
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Layers,
  UserCheck,
  FileText,
  Settings,
  Puzzle,
  Hash,
  Type,
  AlignLeft,
  Tag,
} from 'lucide-react';
import { Placeholder } from '@/lib/validators';

/* ═══════════════════════════════════════════════════════════════
   CONFIGURAÇÃO DE CATEGORIAS
   ═══════════════════════════════════════════════════════════════ */
interface CategoriaConfig {
  chave: string;
  label: string;
  descricao: string;
  cor: string;
  corFundo: string;
  corBorda: string;
  corTexto: string;
  icone: React.ElementType;
}

const CATEGORIAS: CategoriaConfig[] = [
  {
    chave: 'TODOS',
    label: 'Todos',
    descricao: 'Todos os placeholders cadastrados',
    cor: 'slate',
    corFundo: 'bg-slate-50 dark:bg-slate-900/40',
    corBorda: 'border-slate-200 dark:border-slate-700',
    corTexto: 'text-slate-700 dark:text-slate-200',
    icone: Layers,
  },
  {
    chave: 'REP',
    label: 'REP/Laudo',
    descricao: 'Dados da Requisição de Exame Pericial e do Laudo',
    cor: 'blue',
    corFundo: 'bg-blue-50 dark:bg-blue-900/20',
    corBorda: 'border-blue-200 dark:border-blue-800',
    corTexto: 'text-blue-700 dark:text-blue-200',
    icone: FileText,
  },
  {
    chave: 'Personalizado',
    label: 'Personalizado',
    descricao: 'Configurados manualmente pelo usuário',
    cor: 'emerald',
    corFundo: 'bg-emerald-50 dark:bg-emerald-900/20',
    corBorda: 'border-emerald-200 dark:border-emerald-800',
    corTexto: 'text-emerald-700 dark:text-emerald-200',
    icone: Puzzle,
  },
  {
    chave: 'Perito',
    label: 'Perito',
    descricao: 'Informações do perito responsável',
    cor: 'violet',
    corFundo: 'bg-violet-50 dark:bg-violet-900/20',
    corBorda: 'border-violet-200 dark:border-violet-800',
    corTexto: 'text-violet-700 dark:text-violet-200',
    icone: UserCheck,
  },
  {
    chave: 'Sistema',
    label: 'Sistema',
    descricao: 'Variáveis e metadados do sistema',
    cor: 'rose',
    corFundo: 'bg-rose-50 dark:bg-rose-900/20',
    corBorda: 'border-rose-200 dark:border-rose-800',
    corTexto: 'text-rose-700 dark:text-rose-200',
    icone: Settings,
  },
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
const categoriaConfig = (cat?: string | null): CategoriaConfig =>
  CATEGORIAS.find(c => c.chave === (cat || 'Personalizado')) ?? CATEGORIAS[0];

const isSistema = (p: Placeholder): boolean => p.categoria === 'REP';

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */
interface PlaceholderFormData {
  chave: string;
  valor: string;
  descricao: string;
  categoria: string;
}

const emptyForm = (): PlaceholderFormData => ({
  chave: '', valor: '', descricao: '', categoria: 'Personalizado',
});

export const PlaceholdersPage: React.FC = () => {
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [abaAtual, setAbaAtual] = useState('TODOS');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlaceholder, setEditingPlaceholder] = useState<Placeholder | null>(null);
  const [formData, setFormData] = useState<PlaceholderFormData>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  /* ── Carregamento ── */
  const carregarPlaceholders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await window.ipcAPI.placeholder.migrateSistema();
      await window.ipcAPI.placeholder.seedSistema();
      const r = await window.ipcAPI.placeholder.findAll();
      if (r.success && r.data) {
        setPlaceholders(r.data);
      } else {
        setError(r.error || 'Erro ao carregar placeholders');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar placeholders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarPlaceholders(); }, [carregarPlaceholders]);

  /* ── Filtro + categorização ── */
  const filtradosPorBusca = useMemo(
    () =>
      placeholders.filter(p =>
        p.chave.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.valor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.categoria || '').toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [placeholders, searchTerm]
  );

  const placeholdersPorCategoria = useMemo(() => {
    const map: Record<string, Placeholder[]> = {};
    CATEGORIAS.forEach(c => { map[c.chave] = []; });
    filtradosPorBusca.forEach(p => {
      const cat = p.categoria || 'Personalizado';
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    });
    map['TODOS'] = filtradosPorBusca;
    return map;
  }, [filtradosPorBusca]);

  const contagemPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    CATEGORIAS.forEach(c => { map[c.chave] = 0; });
    placeholders.forEach(p => {
      const cat = p.categoria || 'Personalizado';
      if (!map[cat]) map[cat] = 0;
      map[cat] += 1;
    });
    map['TODOS'] = placeholders.length;
    return map;
  }, [placeholders]);

  /* ── Ações ── */
  const handleNovo = () => {
    setEditingPlaceholder(null);
    setFormData(emptyForm());
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  };

  const handleEditar = (p: Placeholder) => {
    setEditingPlaceholder(p);
    setFormData({
      chave: p.chave,
      valor: p.valor || '',
      descricao: p.descricao || '',
      categoria: p.categoria || 'Personalizado',
    });
    setError(null);
    setSuccess(null);
    setDialogOpen(true);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este placeholder?')) return;
    try {
      const r = await window.ipcAPI.placeholder.delete(id);
      if (r.success) {
        await carregarPlaceholders();
      } else {
        alert(`Erro: ${r.error}`);
      }
    } catch (err: any) {
      alert('Erro ao excluir placeholder');
    }
  };

  const handleSalvar = async () => {
    try {
      setError(null);
      setSuccess(null);

      if (!formData.chave.trim()) {
        setError('A chave do placeholder é obrigatória.');
        return;
      }

      const payload = {
        chave: formData.chave,
        valor: formData.valor,
        descricao: formData.descricao || null,
        categoria: formData.categoria || null,
      };

      if (editingPlaceholder) {
        const r = await window.ipcAPI.placeholder.update(editingPlaceholder.id, payload);
        if (r.success) {
          setSuccess('Placeholder atualizado com sucesso!');
          await carregarPlaceholders();
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(r.error || 'Erro ao atualizar placeholder');
        }
      } else {
        const r = await window.ipcAPI.placeholder.create(payload);
        if (r.success) {
          setSuccess('Placeholder criado com sucesso!');
          await carregarPlaceholders();
          setTimeout(() => setDialogOpen(false), 1000);
        } else {
          setError(r.error || 'Erro ao criar placeholder');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar placeholder');
    }
  };

  /* ── Render ── */
  const totalSistema = placeholders.filter(p => isSistema(p)).length;
  const totalPersonalizados = placeholders.filter(p => !isSistema(p)).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Placeholders</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os placeholders disponíveis para uso nos laudos
          </p>
        </div>
        <Button onClick={handleNovo} className="flex items-center gap-2 shrink-0">
          <Plus size={16} /> Novo Placeholder
        </Button>
      </div>

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Placeholders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{placeholders.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Placeholders do Sistema</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Lock size={16} className="text-blue-500" />
            <div className="text-xl font-semibold text-blue-600 dark:text-blue-300">{totalSistema}</div>
            <span className="text-xs text-muted-foreground">fixos (REP)</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Personalizados</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Puzzle size={16} className="text-emerald-500" />
            <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-300">{totalPersonalizados}</div>
            <span className="text-xs text-muted-foreground">criados pelo usuário</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {CATEGORIAS.filter(c => c.chave !== 'TODOS').map(c => (
                <Badge key={c.chave} variant="secondary" className="text-[10px] px-1.5 py-0.5">
                  {c.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Área principal: Tabs + Grid ── */}
      <Tabs value={abaAtual} onValueChange={setAbaAtual} className="space-y-4">
        {/* Barra de busca + abas */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <TabsList className="h-auto flex-wrap gap-1 p-1 bg-muted/50">
            {CATEGORIAS.map(cat => {
              const Icon = cat.icone;
              return (
                <TabsTrigger
                  key={cat.chave}
                  value={cat.chave}
                  className="flex items-center gap-1.5 data-[state=active]:shadow-sm text-xs sm:text-sm"
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{cat.label}</span>
                  <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1 min-w-[18px] justify-center">
                    {contagemPorCategoria[cat.chave] || 0}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="relative w-full lg:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por chave, valor, descrição..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Conteúdo das abas */}
        {CATEGORIAS.map(cat => (
          <TabsContent key={cat.chave} value={cat.chave} className="space-y-4">
            {/* Cabeçalho da aba */}
            <div className={`flex items-center gap-3 rounded-lg border p-3 ${cat.corFundo} ${cat.corBorda}`}>
              <cat.icone size={22} className={`shrink-0 ${cat.corTexto}`} />
              <div>
                <h3 className={`text-sm font-semibold ${cat.corTexto}`}>
                  {cat.label}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {cat.descricao} · {placeholdersPorCategoria[cat.chave]?.length || 0} item(s)
                </p>
              </div>
            </div>

            {/* Grid de cards */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="pb-3 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="h-3 bg-muted rounded w-full" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (placeholdersPorCategoria[cat.chave]?.length || 0) === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Puzzle size={40} className="text-muted-foreground/40 mb-3" />
                  <h3 className="text-lg font-medium text-muted-foreground">
                    {searchTerm ? 'Nenhum resultado encontrado' : `Nenhum placeholder na categoria ${cat.label}`}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {searchTerm
                      ? 'Tente ajustar os termos da busca ou troque de categoria.'
                      : cat.chave === 'Personalizado'
                        ? 'Clique em "Novo Placeholder" para adicionar o primeiro.'
                        : 'Placeholders desta categoria serão criados automaticamente pelo sistema.'}
                  </p>
                  {(!searchTerm && cat.chave === 'Personalizado') && (
                    <Button onClick={handleNovo} variant="outline" className="mt-4">
                      <Plus size={16} className="mr-2" /> Criar placeholder
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {placeholdersPorCategoria[cat.chave]!.map(p => {
                  const cfg = categoriaConfig(p.categoria);
                  const sistema = isSistema(p);
                  const deletavel = p.categoria === 'Personalizado';

                  return (
                    <Card
                      key={p.id}
                      className={`group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                        sistema ? 'border-blue-200 dark:border-blue-800/60' : ''
                      }`}
                    >
                      {/* Faixa lateral indicadora de categoria */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.corFundo.replace('bg-', 'bg-').replace('/20', '').replace('/40', '')}`}
                        style={{ backgroundColor: 'transparent' }}
                      >
                        <div className={`w-full h-full ${cfg.corTexto.replace('text-', 'bg-').replace('700', '500').replace('200', '500')}`} />
                      </div>

                      <CardHeader className="pb-3 pl-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted font-mono text-xs font-semibold text-foreground truncate">
                                <Hash size={10} className="mr-1 text-muted-foreground shrink-0" />
                                {`{{${p.chave}}}`}
                              </code>
                              {sistema && (
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 shrink-0 border-blue-200 text-blue-600 dark:text-blue-300">
                                  <Lock size={9} />
                                  Fixo
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <cfg.icone size={11} className="text-muted-foreground" />
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                {p.categoria || 'Personalizado'}
                              </span>
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEditar(p)}
                              title="Editar"
                            >
                              <Edit size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={!deletavel ? 'text-muted-foreground/30 cursor-not-allowed' : 'h-7 w-7 text-destructive hover:text-destructive'}
                              onClick={() => deletavel && handleExcluir(p.id)}
                              disabled={!deletavel}
                              title={!deletavel ? 'Somente placeholders personalizados podem ser excluídos' : 'Excluir'}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="pt-0 pl-5 space-y-3">
                        {/* Valor padrão */}
                        {p.valor ? (
                          <div className="flex items-start gap-2">
                            <Type size={12} className="text-muted-foreground mt-1 shrink-0" />
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">
                                Valor padrão
                              </p>
                              <p className="text-sm text-foreground font-medium truncate" title={p.valor}>
                                {p.valor}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <Type size={12} className="text-muted-foreground mt-1 shrink-0" />
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">
                                Valor padrão
                              </p>
                              <span className="text-xs text-muted-foreground italic">Sem valor definido</span>
                            </div>
                          </div>
                        )}

                        {/* Descrição */}
                        {p.descricao ? (
                          <div className="flex items-start gap-2">
                            <AlignLeft size={12} className="text-muted-foreground mt-1 shrink-0" />
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">
                                Descrição
                              </p>
                              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                {p.descricao}
                              </p>
                            </div>
                          </div>
                        ) : null}

                        {/* Tag de referência rápida */}
                        <div className="pt-1 flex items-center gap-1.5">
                          <Tag size={10} className="text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Usar como: <span className="text-foreground">{`{{${p.chave}}}`}</span>
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Instruções de uso (colapsável) ── */}
      <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-b from-white dark:from-gray-900 to-blue-50/30 dark:to-blue-950/20">
        <CardHeader
          className="pb-2 cursor-pointer select-none hover:bg-blue-50/50 dark:hover:bg-blue-950/50 transition-colors rounded-t-lg"
          onClick={() => setShowInstructions(!showInstructions)}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900">
              <Zap size={20} className="text-blue-600 dark:text-blue-300" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">Como usar placeholders no laudo</CardTitle>
              <CardDescription>
                Um guia simples para automatizar o preenchimento dos seus documentos
              </CardDescription>
            </div>
            {showInstructions
              ? <ChevronUp size={22} className="text-muted-foreground shrink-0" />
              : <ChevronDown size={22} className="text-muted-foreground shrink-0" />
            }
          </div>
        </CardHeader>
        {showInstructions && (
          <CardContent className="space-y-8 pt-4">
            {/* O que são */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-800 rounded-lg p-5">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                  <Puzzle size={18} className="text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1.5">O que é um placeholder?</h3>
                  <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
                    É um <strong>atalho inteligente</strong> que o sistema substitui automaticamente pela informação real.
                    Funciona como um "espaço reservado" no texto: você digita um código simples entre chaves duplas,
                    e na hora de gerar o laudo, o sistema troca esse código pelo dado verdadeiro —
                    como o número da REP, o nome do envolvido ou a data da solicitação.
                  </p>
                </div>
              </div>
            </div>

            {/* Exemplo visual */}
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <ArrowRight size={18} className="text-muted-foreground" />
                Veja na prática
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Antes */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-amber-50 dark:bg-amber-950 px-4 py-2 border-b border-amber-100 dark:border-amber-800">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-200 uppercase tracking-wide">O que você digita</span>
                  </div>
                  <div className="p-4 font-mono text-sm leading-relaxed bg-card">
                    <p><span className="text-muted-foreground">REP nº</span> <span className="bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-200 px-1 rounded">{'{{numero_rep}}'}</span></p>
                    <p><span className="text-muted-foreground">Solicitante:</span> <span className="bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-200 px-1 rounded">{'{{solicitante_nome}}'}</span></p>
                    <p><span className="text-muted-foreground">Envolvido:</span> <span className="bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-200 px-1 rounded">{'{{nome_envolvido}}'}</span></p>
                    <p><span className="text-muted-foreground">BO nº</span> <span className="bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-200 px-1 rounded">{'{{numero_bo}}'}</span> <span className="text-muted-foreground">— IP nº</span> <span className="bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-200 px-1 rounded">{'{{numero_ip}}'}</span></p>
                    <p><span className="text-muted-foreground">Exame:</span> <span className="bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-200 px-1 rounded">{'{{tipo_exame_nome}}'}</span></p>
                  </div>
                </div>

                {/* Depois */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-green-50 dark:bg-green-950 px-4 py-2 border-b border-green-100 dark:border-green-800">
                    <span className="text-xs font-semibold text-green-700 dark:text-green-200 uppercase tracking-wide">O que o laudo exibe</span>
                  </div>
                  <div className="p-4 text-sm leading-relaxed bg-card">
                    <p>REP nº <strong className="text-foreground">2025/00123</strong></p>
                    <p>Solicitante: <strong className="text-foreground">Delegacia de Polícia Civil</strong></p>
                    <p>Envolvido: <strong className="text-foreground">João da Silva</strong></p>
                    <p>BO nº <strong className="text-foreground">1234/2025</strong> — IP nº <strong className="text-foreground">567/2025</strong></p>
                    <p>Exame: <strong className="text-foreground">Exame de DNA</strong></p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Os códigos em rosa são trocados pelos dados reais da REP automaticamente
              </p>
            </div>

            {/* Criando os seus próprios */}
            <div className="bg-card border rounded-lg p-5">
              <div className="flex gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 shrink-0">
                  <Plus size={18} className="text-purple-600 dark:text-purple-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1.5">Crie seus próprios placeholders</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Precisa de um campo que não existe na lista? Clique em <strong>"Novo Placeholder"</strong> no topo da página,
                    dê um nome (ex: <code className="bg-muted px-1 rounded text-pink-600 dark:text-pink-300 text-xs">SECAO_TECNICA</code>),
                    preencha um valor padrão se quiser, e pronto. Use <code className="bg-muted px-1 rounded text-pink-600 dark:text-pink-300 text-xs">{'{{SECAO_TECNICA}}'}</code> em qualquer editor.
                  </p>
                </div>
              </div>
            </div>

            {/* Dicas */}
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-800 rounded-lg p-5">
              <div className="flex gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 shrink-0">
                  <Lock size={16} className="text-amber-600 dark:text-amber-300" />
                </div>
                <div className="space-y-3 text-sm text-amber-800 dark:text-amber-200">
                  <div>
                    <h3 className="font-semibold mb-1">Placeholders fixos (REP)</h3>
                    <p className="leading-relaxed">
                      Os placeholders com o ícone <Lock size={12} className="inline text-amber-600 dark:text-amber-300" /> e categoria <strong>REP</strong> são fornecidos pelo sistema.
                      Eles correspondem aos campos da Requisição de Exame Pericial e <strong>não podem ser removidos</strong>.
                    </p>
                  </div>
                  <div className="border-t border-amber-200 dark:border-amber-700 pt-3">
                    <h3 className="font-semibold mb-1">Dica importante</h3>
                    <p className="leading-relaxed">
                      Se o placeholder não tiver um valor correspondente na REP (ex: campos de local em exames laboratoriais),
                      ele simplesmente <strong>aparecerá em branco</strong> no laudo final. Nenhum erro será exibido.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Dialog de criação/edição ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingPlaceholder ? 'Editar Placeholder' : 'Novo Placeholder'}
            </DialogTitle>
            <DialogDescription>
              {editingPlaceholder
                ? 'Atualize as informações do placeholder.'
                : 'Preencha as informações para criar um novo placeholder.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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

            <div className="space-y-2">
              <Label htmlFor="chave">Chave *</Label>
              <Input
                id="chave"
                value={formData.chave}
                onChange={e => setFormData({ ...formData, chave: e.target.value })}
                placeholder="Ex: MEU_CAMPO"
                disabled={!!editingPlaceholder && editingPlaceholder.categoria === 'REP'}
              />
              <p className="text-xs text-muted-foreground">
                Será usado como {'{{chave}}'} no editor de laudo.
                {editingPlaceholder && editingPlaceholder.categoria === 'REP' && ' Chave do sistema não pode ser alterada.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                value={formData.categoria}
                onValueChange={v => setFormData({ ...formData, categoria: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REP">REP/Laudo (Sistema)</SelectItem>
                  <SelectItem value="Personalizado">Personalizado</SelectItem>
                  <SelectItem value="Perito">Perito</SelectItem>
                  <SelectItem value="Sistema">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.categoria === 'Personalizado' && (
              <div className="space-y-2">
                <Label htmlFor="valor">Valor padrão</Label>
                <Input
                  id="valor"
                  value={formData.valor}
                  onChange={e => setFormData({ ...formData, valor: e.target.value })}
                  placeholder="Valor padrão (opcional)"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descreva o que este placeholder representa..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={!formData.chave.trim()}>
              {editingPlaceholder ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
