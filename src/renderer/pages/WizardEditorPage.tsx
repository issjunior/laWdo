import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft, Plus, Trash2, GripVertical, Loader2, AlertCircle, Save, Link2, Search,
  type LucideIcon,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';

const iconesLucide = LucideIcons as unknown as Record<string, LucideIcon>;

interface EtapaWizard {
  id: string;
  pergunta: string;
  descricao_ajuda?: string;
  tipo_input: 'select' | 'radio' | 'checkbox' | 'text' | 'image';
  nivel: number;
  ordem: number;
  obrigatorio: boolean;
  multipla_escolha: boolean;
  opcoes: OpcaoWizard[];
}

interface OpcaoWizard {
  id: string;
  label: string;
  valor: string;
  ordem: number;
  etapa_filha?: EtapaWizard;
}

interface ArvoreWizard {
  wizard: WizardResumo;
  etapas: EtapaWizard[];
}

interface WizardResumo {
  id: string;
  nome?: string;
  descricao?: string;
  template_id?: string;
}

interface PecaItem {
  id: string; nome: string; conteudo: string;
  categoria_id?: string; categoria_label?: string; categoria_cor?: string; categoria_icone?: string;
  tags?: string; descricao?: string;
}

interface RegraWizard {
  id: string; wizard_id: string; peca_id: string;
  secao_template_id: string | null; condicoes: string; ordem: number;
  peca?: PecaItem; secao_nome?: string;
}

interface SecaoTemplate {
  id: string; nome: string;
}

interface CategoriaArvore {
  id: string; label: string; parent_id: string | null;
  subcategorias: CategoriaArvore[];
}

type ValorEtapa = EtapaWizard[keyof EtapaWizard];

function mensagemErro(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro';
}

const TIPO_INPUT_OPTIONS = [
  { value: 'select', label: 'Select (Dropdown)' },
  { value: 'radio', label: 'Radio' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'text', label: 'Texto livre' },
  { value: 'image', label: 'Imagem' },
];

const WizardEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [wizard, setWizard] = useState<WizardResumo | null>(null);
  const [arvore, setArvore] = useState<ArvoreWizard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [etapaSelecionada, setEtapaSelecionada] = useState<EtapaWizard | null>(null);
  const [secoesTemplate, setSecoesTemplate] = useState<SecaoTemplate[]>([]);
  const [regras, setRegras] = useState<RegraWizard[]>([]);

  // Vinculador de peça dialog
  const [vinculadorOpen, setVinculadorOpen] = useState(false);
  const [vinculadorEtapaId, setVinculadorEtapaId] = useState<string | null>(null);
  const [vinculadorOpcaoValor, setVinculadorOpcaoValor] = useState<string | null>(null);
  const [vinculadorOpcaoLabel, setVinculadorOpcaoLabel] = useState<string | null>(null);
  const [pecas, setPecas] = useState<PecaItem[]>([]);
  const [pecaBusca, setPecaBusca] = useState('');
  const [pecaSelecionada, setPecaSelecionada] = useState<PecaItem | null>(null);
  const [secaoAlvo, setSecaoAlvo] = useState<string>('');
  const [categoriaFiltroVinculador, setCategoriaFiltroVinculador] = useState<string>('todas');
  const [categoriasArvore, setCategoriasArvore] = useState<CategoriaArvore[]>([]);

  const openVinculadorParaOpcao = (etapaId: string, opcaoValor: string, opcaoLabel: string) => {
    setVinculadorEtapaId(etapaId);
    setVinculadorOpcaoValor(opcaoValor);
    setVinculadorOpcaoLabel(opcaoLabel);
    setPecaSelecionada(null);
    setSecaoAlvo('');
    setPecaBusca('');
    setCategoriaFiltroVinculador('todas');
    setVinculadorOpen(true);
  };

  const loadDados = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [arvoreRes, regrasRes, secoesRes, pecasRes, catsRes] = await Promise.all([
        window.ipcAPI.wizard.getArvore(id),
        window.ipcAPI.regraWizard.findByWizard(id),
        window.ipcAPI.template.findSecoes(wizard?.template_id || (await window.ipcAPI.wizard.findById(id)).data?.template_id || ''),
        window.ipcAPI.peca.findAll(),
        window.ipcAPI.categoriaPeca.findArvore(),
      ]);

      if (arvoreRes.success) {
        setArvore(arvoreRes.data);
        setWizard(arvoreRes.data.wizard);
      } else setError(arvoreRes.error || 'Erro');

      if (regrasRes.success) setRegras(regrasRes.data || []);
      if (secoesRes.success) setSecoesTemplate(secoesRes.data || []);
      if (pecasRes.success) setPecas(pecasRes.data || []);
      if (catsRes.success) setCategoriasArvore(catsRes.data || []);

      // If wizard not loaded yet, try loading just wizard
      if (!wizard) {
        const wizRes = await window.ipcAPI.wizard.findById(id);
        if (wizRes.success) {
          setWizard(wizRes.data);
          if (wizRes.data?.template_id) {
            const stRes = await window.ipcAPI.template.findSecoes(wizRes.data.template_id);
            if (stRes.success) setSecoesTemplate(stRes.data || []);
          }
        }
      }
    } catch (e: unknown) {
      setError(mensagemErro(e) || 'Erro');
    } finally {
      setLoading(false);
    }
  }, [id, wizard?.template_id]);

  useEffect(() => { loadDados(); }, []);

  // Etapa selection
  const handleSelectEtapa = (etapa: EtapaWizard) => {
    setEtapaSelecionada(etapa);
  };

  const handleAddEtapaRaiz = () => {
    const nova: EtapaWizard = {
      id: crypto.randomUUID(),
      pergunta: 'Nova pergunta',
      tipo_input: 'select',
      nivel: 0,
      ordem: (arvore?.etapas?.length || 0),
      obrigatorio: true,
      multipla_escolha: false,
      opcoes: [{ id: crypto.randomUUID(), label: 'Opção 1', valor: 'opcao1', ordem: 0 }],
    };
    setArvore(prev => prev ? { ...prev, etapas: [...prev.etapas, nova] } : prev);
    setEtapaSelecionada(nova);
  };

  const handleRemoveEtapa = (etapaId: string) => {
    if (!arvore) return;
    const removeFromTree = (etapas: EtapaWizard[]): EtapaWizard[] => {
      return etapas
        .filter(e => e.id !== etapaId)
        .map(e => ({
          ...e,
          opcoes: e.opcoes.map(o => ({
            ...o,
            etapa_filha: o.etapa_filha ? (o.etapa_filha.id === etapaId ? undefined : removeFromTree([o.etapa_filha])[0] || undefined) : undefined,
          })),
        }));
    };
    setArvore(prev => prev ? { ...prev, etapas: removeFromTree(prev.etapas) } : prev);
    if (etapaSelecionada?.id === etapaId) setEtapaSelecionada(null);
  };

  const handleUpdateEtapa = (field: keyof EtapaWizard, value: ValorEtapa) => {
    if (!etapaSelecionada || !arvore) return;
    const updateInTree = (etapas: EtapaWizard[]): EtapaWizard[] =>
      etapas.map(e => {
        if (e.id === etapaSelecionada.id) return { ...e, [field]: value };
        return { ...e, opcoes: e.opcoes.map(o => o.etapa_filha ? { ...o, etapa_filha: updateInTree([o.etapa_filha])[0] } : o) };
      });
    setArvore(prev => prev ? { ...prev, etapas: updateInTree(prev.etapas) } : prev);
    setEtapaSelecionada(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleAddOpcao = () => {
    if (!etapaSelecionada) return;
    const novoOpcao: OpcaoWizard = {
      id: crypto.randomUUID(),
      label: `Resposta ${etapaSelecionada.opcoes.length + 1}`,
      valor: `resposta${etapaSelecionada.opcoes.length + 1}`,
      ordem: etapaSelecionada.opcoes.length,
    };
    handleUpdateEtapa('opcoes', [...etapaSelecionada.opcoes, novoOpcao]);
  };

  const handleRemoveOpcao = (opcaoId: string) => {
    if (!etapaSelecionada) return;
    handleUpdateEtapa('opcoes', etapaSelecionada.opcoes.filter(o => o.id !== opcaoId));
  };

  const handleUpdateOpcao = (opcaoId: string, field: string, value: string) => {
    if (!etapaSelecionada) return;
    handleUpdateEtapa('opcoes', etapaSelecionada.opcoes.map(o =>
      o.id === opcaoId ? { ...o, [field]: value } : o
    ));
  };

  const handleVincularPeca = () => {
    if (!pecaSelecionada) return;
    if (!secaoAlvo) {
      toast.error('Selecione uma seção alvo para a peça');
      return;
    }
    const condObj: Record<string, string> = {};
    if (vinculadorEtapaId && vinculadorOpcaoValor) {
      condObj[vinculadorEtapaId] = vinculadorOpcaoValor;
    }
    const novaRegra: RegraWizard = {
      id: crypto.randomUUID(),
      wizard_id: id || '',
      peca_id: pecaSelecionada.id,
      secao_template_id: secaoAlvo,
      condicoes: JSON.stringify(condObj),
      ordem: regras.length,
      peca: pecaSelecionada,
      secao_nome: secoesTemplate.find(s => s.id === secaoAlvo)?.nome,
    };
    setRegras(prev => [...prev, novaRegra]);
    setVinculadorOpen(false);
    setVinculadorEtapaId(null);
    setVinculadorOpcaoValor(null);
    setVinculadorOpcaoLabel(null);
    setPecaSelecionada(null);
    setSecaoAlvo('');
    toast.success('Peça vinculada');
  };

  const handleRemoveRegra = (regraId: string) => {
    setRegras(prev => prev.filter(r => r.id !== regraId));
  };

  const handleSave = async () => {
    if (!id || !arvore) return;
    setSaving(true);
    try {
      await window.ipcAPI.wizard.saveArvore(id, arvore);
      if (regras.length > 0) {
        await window.ipcAPI.regraWizard.save(regras.map(r => ({
          id: r.id,
          wizard_id: r.wizard_id,
          peca_id: r.peca_id,
          secao_template_id: r.secao_template_id,
          condicoes: r.condicoes,
          ordem: r.ordem,
        })));
      }
      toast.success('Wizard salvo');
    } catch (e: unknown) {
      toast.error(mensagemErro(e) || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  // Helper: collect all descendant category IDs from tree
  const getDescendantIds = (catId: string, tree: CategoriaArvore[]): string[] => {
    const ids: string[] = [catId];
    for (const cat of tree) {
      if (cat.id === catId) {
        for (const sub of cat.subcategorias) {
          ids.push(...getDescendantIds(sub.id, [sub]));
        }
        break;
      }
      if (cat.subcategorias.length > 0) {
        const found = getDescendantIds(catId, cat.subcategorias);
        if (found.length > 1) return found;
      }
    }
    return ids;
  };

  const renderCategoriaOptionsVinculador = (cats: CategoriaArvore[], depth: number = 0): React.ReactNode[] => {
    const items: React.ReactNode[] = [];
    for (const cat of cats) {
      items.push(
        <SelectItem key={cat.id} value={cat.id}>
          <span style={{ paddingLeft: depth * 12 }}>{depth > 0 ? '└ ' : ''}{cat.label}</span>
        </SelectItem>
      );
      if (cat.subcategorias?.length) {
        items.push(...renderCategoriaOptionsVinculador(cat.subcategorias, depth + 1));
      }
    }
    return items;
  };

  // Filtered peças for vinculador
  const pecasFiltradas = pecas.filter(p => {
    const matchesSearch = !pecaBusca || p.nome.toLowerCase().includes(pecaBusca.toLowerCase());
    if (!matchesSearch) return false;
    if (categoriaFiltroVinculador === 'todas') return true;
    // Include peças from the selected category AND its subcategories
    const catIds = getDescendantIds(categoriaFiltroVinculador, categoriasArvore);
    return p.categoria_id ? catIds.includes(p.categoria_id) : false;
  });
  const renderArvoreEtapas = (etapas: EtapaWizard[], depth: number = 0): React.ReactNode => {
    return etapas.map((etapa) => (
      <div key={etapa.id}>
        <div
          className={`
            flex items-center gap-2 p-2 rounded-md cursor-pointer border
            ${etapaSelecionada?.id === etapa.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'}
          `}
          style={{ marginLeft: depth * 16 }}
          onClick={() => handleSelectEtapa(etapa)}
        >
          <GripVertical size={14} className="text-muted-foreground" />
          <span className="flex-1 text-sm truncate">{etapa.pergunta}</span>
          <Badge variant="outline" className="text-[10px]">{etapa.tipo_input}</Badge>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRemoveEtapa(etapa.id); }}>
            <Trash2 size={12} className="text-destructive" />
          </Button>
        </div>
        {etapa.opcoes.map(op => (
          <div key={op.id}>
            <div className="flex items-center gap-2 p-1 text-xs text-muted-foreground" style={{ marginLeft: (depth + 1) * 16 }}>
              <span>→ {op.label}{op.etapa_filha ? ' ▼' : ''}</span>
            </div>
            {op.etapa_filha && renderArvoreEtapas([op.etapa_filha], depth + 2)}
          </div>
        ))}
      </div>
    ));
  };

  if (loading) return (
    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
  );

  if (error) return (
    <div className="container p-6">
      <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
      <Button variant="outline" onClick={() => navigate('/wizards')} className="mt-4"><ArrowLeft size={16} className="mr-2" /> Voltar</Button>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/wizards')}>
              <ArrowLeft size={16} className="mr-1" /> Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{wizard?.nome || 'Editor de Wizard'}</h1>
              {wizard?.descricao && <p className="text-sm text-muted-foreground">{wizard.descricao}</p>}
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Árvore de Etapas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Árvore de Etapas</CardTitle>
              <Button size="sm" variant="outline" onClick={handleAddEtapaRaiz}><Plus size={14} className="mr-1" /> Etapa</Button>
            </CardHeader>
            <CardContent>
              {arvore?.etapas?.length ? (
                <div className="space-y-1">{renderArvoreEtapas(arvore.etapas)}</div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma etapa. Clique em &quot;+ Etapa&quot; para começar.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* RIGHT: Configuração da Etapa */}
          <div className="space-y-6">
            {etapaSelecionada ? (
              <Card>
                <CardHeader><CardTitle className="text-base">Configurar Etapa</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Pergunta</Label>
                    <Input value={etapaSelecionada.pergunta} onChange={e => handleUpdateEtapa('pergunta', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição de ajuda</Label>
                    <Input value={etapaSelecionada.descricao_ajuda || ''} onChange={e => handleUpdateEtapa('descricao_ajuda', e.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Input</Label>
                      <Select value={etapaSelecionada.tipo_input} onValueChange={v => handleUpdateEtapa('tipo_input', v as EtapaWizard['tipo_input'])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIPO_INPUT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 pt-6 flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={etapaSelecionada.obrigatorio} onChange={e => handleUpdateEtapa('obrigatorio', e.target.checked)} />
                        Obrigatório
                      </label>
                      {etapaSelecionada.tipo_input === 'checkbox' && (
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={etapaSelecionada.multipla_escolha} onChange={e => handleUpdateEtapa('multipla_escolha', e.target.checked)} />
                          Múltipla escolha
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Opções */}
                  {['select', 'radio', 'checkbox'].includes(etapaSelecionada.tipo_input) && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Opções</Label>
                        <Button size="sm" variant="ghost" onClick={handleAddOpcao}><Plus size={14} className="mr-1" /> Opção</Button>
                      </div>
                      <div className="space-y-2">
                        {etapaSelecionada.opcoes.map((op, i) => (
                          <div key={op.id} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                            <Input
                              value={op.label}
                              onChange={e => handleUpdateOpcao(op.id, 'label', e.target.value)}
                              placeholder="Label"
                              className="flex-1"
                            />
                            <Input
                              value={op.valor}
                              onChange={e => handleUpdateOpcao(op.id, 'valor', e.target.value)}
                              placeholder="Valor"
                              className="w-24"
                            />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm"
                                  onClick={() => openVinculadorParaOpcao(etapaSelecionada.id, op.valor, op.label)}
                                >
                                  <Link2 size={12} className="text-violet-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Vincular peça a esta resposta</TooltipContent>
                            </Tooltip>
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveOpcao(op.id)}>
                              <Trash2 size={12} className="text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p>Selecione uma etapa na árvore para configurá-la.</p>
                </CardContent>
              </Card>
            )}

            {/* Regras Vinculadas */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Peças Vinculadas</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={() => { setVinculadorEtapaId(null); setVinculadorOpcaoValor(null); setVinculadorOpcaoLabel(null); setPecaSelecionada(null); setSecaoAlvo(''); setPecaBusca(''); setCategoriaFiltroVinculador('todas'); setVinculadorOpen(true); }}>
                      <Link2 size={14} className="mr-1" /> Vincular Peça (sempre)
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Vincula uma peça que aparece independente das respostas. Use os ícones 🔗 nas opções para vincular com condição.</TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                {regras.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma peça vinculada.</p>
                ) : (
                  <div className="space-y-2">
                    {regras.map(r => {
                      const condObj = JSON.parse(r.condicoes || '{}');
                      const condEtapas = Object.entries(condObj);
                      const condLabel = condEtapas.length > 0
                        ? condEtapas.map(([etapaId, valor]) => {
                            const etapa = findEtapaById(arvore?.etapas, etapaId);
                            const opcao = etapa?.opcoes.find(o => o.valor === valor);
                            const pergunta = etapa?.pergunta || etapaId;
                            const resposta = opcao?.label || String(valor);
                            return `${pergunta} = ${resposta}`;
                          }).join(', ')
                        : 'Sempre';
                      return (
                        <div key={r.id} className="flex items-center justify-between p-2 border rounded-md">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium truncate">{r.peca?.nome || r.peca_id}</span>
                            {r.secao_nome && <Badge variant="secondary" className="text-[10px] shrink-0">{r.secao_nome}</Badge>}
                            <Badge variant="outline" className="text-[10px] shrink-0 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800">
                              {condLabel}
                            </Badge>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveRegra(r.id)}>
                            <Trash2 size={12} className="text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dialog Vincular Peça */}
        <Dialog open={vinculadorOpen} onOpenChange={setVinculadorOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Vincular Peça</DialogTitle>
              <DialogDescription>
                {vinculadorEtapaId && vinculadorOpcaoLabel ? (
                  <span className="flex items-center gap-1">
                    Quando <Badge variant="outline" className="text-[11px] font-normal">{etapaSelecionada?.pergunta || '?'}</Badge>
                    <span className="text-muted-foreground">=</span>
                    <Badge variant="secondary" className="text-[11px]">{vinculadorOpcaoLabel}</Badge>
                  </span>
                ) : (
                  'Busque uma peça no banco e defina a seção alvo do laudo.'
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar peça..."
                    value={pecaBusca}
                    onChange={e => setPecaBusca(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={categoriaFiltroVinculador} onValueChange={setCategoriaFiltroVinculador}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {renderCategoriaOptionsVinculador(categoriasArvore)}
                  </SelectContent>
                </Select>
              </div>
              <div className="max-h-[200px] overflow-y-auto border rounded-md">
                {pecasFiltradas.map(p => {
                  const IconComp = iconesLucide[p.categoria_icone || 'Tag'] || LucideIcons.Tag;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2 cursor-pointer hover:bg-muted ${pecaSelecionada?.id === p.id ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                      onClick={() => setPecaSelecionada(p)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{p.nome}</span>
                        {p.categoria_label && (
                          <Badge
                            variant="secondary"
                            className={`text-[10px] gap-0.5 bg-${p.categoria_cor || 'slate'}-100 dark:bg-${p.categoria_cor || 'slate'}-900/30 text-${p.categoria_cor || 'slate'}-700 dark:text-${p.categoria_cor || 'slate'}-300 shrink-0`}
                          >
                            <IconComp size={10} /> {p.categoria_label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
                {pecasFiltradas.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhuma peça encontrada{pecaBusca ? ` para "${pecaBusca}"` : ''}.
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Seção alvo *</Label>
                <Select value={secaoAlvo} onValueChange={setSecaoAlvo}>
                  <SelectTrigger><SelectValue placeholder="Selecione a seção..." /></SelectTrigger>
                  <SelectContent>
                    {secoesTemplate.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVinculadorOpen(false)}>Cancelar</Button>
              <Button onClick={handleVincularPeca} disabled={!pecaSelecionada || !secaoAlvo}>Vincular</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default WizardEditorPage;

function findEtapaById(etapas: EtapaWizard[] | undefined, id: string): EtapaWizard | undefined {
  if (!etapas) return undefined;
  for (const e of etapas) {
    if (e.id === id) return e;
    for (const o of e.opcoes) {
      if (o.etapa_filha) {
        const found = findEtapaById([o.etapa_filha], id);
        if (found) return found;
      }
    }
  }
  return undefined;
}
