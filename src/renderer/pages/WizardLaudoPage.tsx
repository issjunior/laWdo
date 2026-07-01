import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft, Save, Wand2, Loader2, AlertCircle, CheckCircle2,
  ChevronRight, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

interface EtapaWizard {
  id: string; pergunta: string; descricao_ajuda?: string;
  tipo_input: 'select' | 'radio' | 'checkbox' | 'text' | 'image';
  nivel: number; ordem: number; obrigatorio: boolean; multipla_escolha: boolean;
  opcoes: OpcaoWizard[];
}

interface OpcaoWizard {
  id: string; label: string; valor: string; ordem: number;
  etapa_filha?: EtapaWizard;
}

interface WizardResumo {
  id: string;
  nome?: string;
}

interface ArvoreWizard {
  wizard: WizardResumo;
  etapas: EtapaWizard[];
}

interface LaudoWizard {
  id: string;
  rep_id: string;
  template_id: string;
  wizard_id?: string;
  respostas_wizard?: string;
  rep_numero?: string;
  status?: string;
}

interface PecaCalculada {
  peca: { id: string; nome: string; conteudo: string; descricao?: string; categoria?: string };
  secao_template_id: string | null;
  regra_id: string;
  ordem: number;
}

type EtapaEstado = 'respondida' | 'atual' | 'pendente' | 'bloqueada';
type RespostasWizard = Record<string, string | string[]>;

function mensagemErro(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro';
}

function normalizarRespostasWizard(valor: unknown): RespostasWizard {
  if (!valor || typeof valor !== 'object') return {};

  const respostas: RespostasWizard = {};
  for (const [chave, resposta] of Object.entries(valor as Record<string, unknown>)) {
    if (chave.startsWith('_')) continue;
    if (typeof resposta === 'string') respostas[chave] = resposta;
    if (Array.isArray(resposta) && resposta.every(item => typeof item === 'string')) {
      respostas[chave] = resposta;
    }
  }
  return respostas;
}

const WizardLaudoPage: React.FC = () => {
  const { laudoId } = useParams<{ laudoId: string }>();
  const navigate = useNavigate();

  const [laudo, setLaudo] = useState<LaudoWizard | null>(null);
  const [arvore, setArvore] = useState<ArvoreWizard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [respostas, setRespostas] = useState<Record<string, string | string[]>>({});
  const [pecasCalculadas, setPecasCalculadas] = useState<PecaCalculada[]>([]);
  const [pecasSelecionadas, setPecasSelecionadas] = useState<Set<string>>(new Set());
  const [previewLoading, setPreviewLoading] = useState(false);
  const [visibleEtapas, setVisibleEtapas] = useState<EtapaWizard[]>([]);
  const [mapaExpandido, setMapaExpandido] = useState(true);

  const loadDados = useCallback(async () => {
    if (!laudoId) return;
    setLoading(true);
    try {
      const laudoRes = await window.ipcAPI.laudo.findById(laudoId);
      if (!laudoRes.success || !laudoRes.data) {
        setError('Laudo não encontrado');
        setLoading(false);
        return;
      }
      const l = laudoRes.data;
      setLaudo(l);

      // Buscar wizards compatíveis com o tipo de exame da REP do laudo
      const repRes = await window.ipcAPI.rep.findById(l.rep_id);
      if (repRes.success && repRes.data?.tipo_exame_id) {
        const wizRes = await window.ipcAPI.wizard.findByTipoExame(repRes.data.tipo_exame_id);
        if (wizRes.success && wizRes.data?.length > 0) {
          // Se o laudo já tem wizard_id, usar ele; senão, primeiro wizard disponível
          const wizardId = l.wizard_id || wizRes.data[0].id;
          const arvoreRes = await window.ipcAPI.wizard.getArvore(wizardId);
          if (arvoreRes.success) setArvore(arvoreRes.data);
        }
      }

      // Carregar respostas salvas
      if (l.respostas_wizard && l.respostas_wizard !== '{}') {
        try {
          const cached = JSON.parse(l.respostas_wizard);
          setRespostas(normalizarRespostasWizard(cached));
        } catch {}
      } else {
        const respRes = await window.ipcAPI.laudo.getRespostasWizard(laudoId);
        if (respRes.success && Object.keys(respRes.data || {}).length > 0) {
          setRespostas(normalizarRespostasWizard(respRes.data));
        }
      }
    } catch (e: unknown) {
      setError(mensagemErro(e) || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [laudoId]);

  useEffect(() => { loadDados(); }, [loadDados]);

  // Visible etapas based on cascading answers
  useEffect(() => {
    if (!arvore) return;
    const visible: EtapaWizard[] = [];
    const collectVisible = (etapas: EtapaWizard[]) => {
      for (const e of etapas) {
        visible.push(e);
        const resposta = respostas[e.id];
        if (resposta && typeof resposta === 'string') {
          const opcao = e.opcoes.find(o => o.valor === resposta || o.id === resposta);
          if (opcao?.etapa_filha) collectVisible([opcao.etapa_filha]);
        }
      }
    };
    collectVisible(arvore.etapas);
    setVisibleEtapas(visible);
  }, [arvore, respostas]);

  // Calculate peças (debounced)
  const calcularPecas = useCallback(async () => {
    if (!arvore?.wizard?.id || Object.keys(respostas).length === 0) return;
    setPreviewLoading(true);
    try {
      const res = await window.ipcAPI.regraWizard.calcularPecas(arvore.wizard.id, respostas);
      if (res.success) {
        setPecasCalculadas(res.data || []);
        setPecasSelecionadas(new Set((res.data || []).map((p: PecaCalculada) => p.peca.id)));
      }
    } catch {} finally { setPreviewLoading(false); }
  }, [arvore, respostas]);

  useEffect(() => {
    const timer = setTimeout(calcularPecas, 300);
    return () => clearTimeout(timer);
  }, [calcularPecas]);

  const handleResposta = (etapaId: string, valor: string | string[]) => {
    setRespostas(prev => {
      const novo = { ...prev, [etapaId]: valor };
      if (arvore) {
        const clearChildren = (etapas: EtapaWizard[], changedId: string) => {
          for (const e of etapas) {
            if (e.id === changedId) {
              for (const o of e.opcoes) {
                if (o.etapa_filha) {
                  delete novo[o.etapa_filha.id];
                  clearChildren([o.etapa_filha], o.etapa_filha.id);
                }
              }
            }
          }
        };
        clearChildren(arvore.etapas, etapaId);
      }
      return novo;
    });
  };

  const handleSalvarProgresso = async () => {
    if (!laudo) return;
    setSaving(true);
    try {
      const res = await window.ipcAPI.laudo.salvarProgressoWizard(laudo.id, respostas);
      if (res.success) toast.success('Progresso salvo. Você pode continuar depois.');
      else toast.error(res.error || 'Erro ao salvar');
    } catch (e: unknown) { toast.error(mensagemErro(e) || 'Erro'); }
    finally { setSaving(false); }
  };

  const handleGerar = async () => {
    if (!laudo || !arvore) return;
    for (const etapa of arvore.etapas) {
      if (etapa.obrigatorio && !respostas[etapa.id]) {
        toast.error(`Responda a pergunta obrigatória: "${etapa.pergunta}"`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await window.ipcAPI.laudo.gerarWizard({
        laudo_id: laudo.id,
        wizard_id: arvore.wizard.id,
        template_id: laudo.template_id,
        respostas,
        pecas_selecionadas: Array.from(pecasSelecionadas),
      });
      if (res.success) {
        toast.success('Laudo preenchido! Você pode continuar editando no editor.');
        navigate('/laudos');
      } else toast.error(res.error || 'Erro ao gerar');
    } catch (e: unknown) { toast.error(mensagemErro(e) || 'Erro'); }
    finally { setSaving(false); }
  };

  // ---- MAPA DE PERGUNTAS ----
  const getEtapaEstado = (etapa: EtapaWizard): EtapaEstado => {
    const resposta = respostas[etapa.id];
    const isAnswered = resposta !== undefined && resposta !== '' &&
      (!Array.isArray(resposta) || resposta.length > 0);
    if (isAnswered) return 'respondida';
    // Check if parent is answered
    if (arvore) {
      const isRoot = arvore.etapas.some(e => e.id === etapa.id);
      if (isRoot) return 'atual';
      const hasParent = (etapas: EtapaWizard[], childId: string): boolean => {
        for (const e of etapas) {
          for (const o of e.opcoes) {
            if (o.etapa_filha) {
              if (o.etapa_filha.id === childId) {
                const parentAnswered = respostas[e.id] !== undefined;
                return parentAnswered;
              }
              if (hasParent([o.etapa_filha], childId)) return true;
            }
          }
        }
        return false;
      };
      if (hasParent(arvore.etapas, etapa.id)) return 'atual';
    }
    return 'bloqueada';
  };

  const estadoStyle: Record<EtapaEstado, string> = {
    respondida: 'text-emerald-600 dark:text-emerald-400',
    atual: 'text-primary',
    pendente: 'text-muted-foreground',
    bloqueada: 'text-muted-foreground/40',
  };

  const estadoIcon = (estado: EtapaEstado) => {
    if (estado === 'respondida') return <CheckCircle2 size={12} className="text-emerald-500" />;
    if (estado === 'atual') return <span className="w-3 h-3 rounded-full bg-primary inline-block" />;
    return <span className="w-3 h-3 rounded-full border border-muted-foreground/30 inline-block" />;
  };

  const renderMapaArvore = (etapas: EtapaWizard[], depth: number = 0): React.ReactNode => {
    return etapas.map(e => {
      const estado = getEtapaEstado(e);
      const resposta = respostas[e.id];
      const answeredVal = typeof resposta === 'string' ? resposta : '';
      return (
        <div key={e.id} style={{ marginLeft: depth * 20 }}>
          <div className={`flex items-center gap-1.5 py-0.5 text-xs ${estadoStyle[estado]}`}>
            {estadoIcon(estado)}
            <span className={estado === 'bloqueada' ? 'opacity-50' : ''}>
              {e.pergunta}
              {answeredVal && <span className="ml-1 opacity-70">→ {e.opcoes.find(o => o.valor === answeredVal || o.id === answeredVal)?.label || answeredVal}</span>}
            </span>
          </div>
          {answeredVal && e.opcoes.filter(o => o.valor === answeredVal || o.id === answeredVal).map(o =>
            o.etapa_filha ? renderMapaArvore([o.etapa_filha], depth + 1) : null
          )}
        </div>
      );
    });
  };

  // ---- PREVIEW ----
  const previewHtml = useMemo(() => {
    return pecasCalculadas
      .filter(p => pecasSelecionadas.has(p.peca.id))
      .map(p => `<div class="peca-wizard mb-4">${p.peca.conteudo || ''}</div>`)
      .join('\n');
  }, [pecasCalculadas, pecasSelecionadas]);

  // ---- LOADING / ERROR ----
  if (loading) return (
    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
  );

  if (error) return (
    <div className="container p-6">
      <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
      <Button variant="outline" onClick={() => navigate('/laudos')} className="mt-4"><ArrowLeft size={16} className="mr-2" /> Voltar</Button>
    </div>
  );

  if (!arvore) return (
    <div className="container p-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Nenhum wizard disponível para o tipo de exame deste laudo. Cadastre um wizard primeiro.</AlertDescription>
      </Alert>
      <Button variant="outline" onClick={() => navigate('/laudos')} className="mt-4"><ArrowLeft size={16} className="mr-2" /> Voltar</Button>
    </div>
  );

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/laudos')}>
            <ArrowLeft size={16} className="mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Preencher Laudo via Wizard</h1>
            <p className="text-sm text-muted-foreground">
              {arvore.wizard?.nome || 'Wizard'} &middot; {laudo?.rep_numero}
              {' '}
              <Badge variant="default">{laudo?.status}</Badge>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSalvarProgresso} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
            Salvar Progresso
          </Button>
          <Button onClick={handleGerar} disabled={saving || pecasCalculadas.length === 0}>
            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Wand2 size={16} className="mr-2" />}
            Preencher Laudo
          </Button>
        </div>
      </div>

      {/* MAPA DE PERGUNTAS */}
      <Card>
        <CardHeader
          className="flex flex-row items-center gap-2 cursor-pointer py-3"
          onClick={() => setMapaExpandido(!mapaExpandido)}
        >
          {mapaExpandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <CardTitle className="text-sm">Mapa de Perguntas</CardTitle>
          <span className="text-xs text-muted-foreground ml-auto">
            {Object.keys(respostas).length} de {arvore.etapas.length} raízes respondidas
          </span>
        </CardHeader>
        {mapaExpandido && (
          <CardContent className="pt-0">
            <div className="border rounded-md p-3 bg-muted/30 max-h-[300px] overflow-y-auto">
              {renderMapaArvore(arvore.etapas)}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> Respondida</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary inline-block" /> Atual</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border border-muted-foreground/30 inline-block" /> Bloqueada</span>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Questions */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Perguntas</CardTitle></CardHeader>
            <CardContent>
              {visibleEtapas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma pergunta disponível.</p>
              ) : (
                <div className="space-y-6">
                  {visibleEtapas.map((etapa, idx) => {
                    const resposta = respostas[etapa.id];
                    const isAnswered = resposta !== undefined && resposta !== '' &&
                      (!Array.isArray(resposta) || resposta.length > 0);
                    return (
                      <div key={etapa.id}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isAnswered ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {isAnswered ? <CheckCircle2 size={14} /> : idx + 1}
                          </div>
                          <Label className="text-sm font-medium">
                            {etapa.pergunta}
                            {etapa.obrigatorio && <span className="text-destructive ml-1">*</span>}
                          </Label>
                        </div>
                        {etapa.descricao_ajuda && (
                          <p className="text-xs text-muted-foreground ml-8 mb-2">{etapa.descricao_ajuda}</p>
                        )}
                        <div className="ml-8">
                          {etapa.tipo_input === 'select' && (
                            <Select value={typeof resposta === 'string' ? resposta : ''} onValueChange={v => handleResposta(etapa.id, v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                              <SelectContent>
                                {etapa.opcoes.map(o => <SelectItem key={o.id} value={o.valor || o.id}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                          {etapa.tipo_input === 'radio' && (
                            <div className="space-y-2">
                              {etapa.opcoes.map(o => (
                                <label key={o.id} className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted">
                                  <input type="radio" name={etapa.id} value={o.valor || o.id}
                                    checked={resposta === o.valor || resposta === o.id}
                                    onChange={() => handleResposta(etapa.id, o.valor || o.id)} />
                                  <span className="text-sm">{o.label}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          {etapa.tipo_input === 'checkbox' && (
                            <div className="space-y-2">
                              {etapa.opcoes.map(o => (
                                <label key={o.id} className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted">
                                  <Checkbox
                                    checked={Array.isArray(resposta) && resposta.includes(o.valor || o.id)}
                                    onCheckedChange={checked => {
                                      const arr = Array.isArray(resposta) ? [...resposta] : [];
                                      if (checked) arr.push(o.valor || o.id);
                                      else { const ix = arr.indexOf(o.valor || o.id); if (ix >= 0) arr.splice(ix, 1); }
                                      handleResposta(etapa.id, arr);
                                    }} />
                                  <span className="text-sm">{o.label}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          {etapa.tipo_input === 'text' && (
                            <Textarea value={typeof resposta === 'string' ? resposta : ''}
                              onChange={e => handleResposta(etapa.id, e.target.value)}
                              placeholder="Digite sua resposta..." className="min-h-[80px]" />
                          )}
                          {etapa.tipo_input === 'image' && (
                            <Input type="file" accept="image/*"
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleResposta(etapa.id, f.name); }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Preview */}
        <Card>
          <CardHeader><CardTitle className="text-base">Prévia do Laudo</CardTitle></CardHeader>
          <CardContent>
            {previewLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : previewHtml ? (
              <div className="prose prose-sm max-w-none dark:prose-invert border rounded-md p-4 min-h-[400px]" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
                <p>Responda as perguntas para ver a prévia do laudo.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WizardLaudoPage;
