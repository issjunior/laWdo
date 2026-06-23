import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Network,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ListChecks,
} from 'lucide-react';
import { z } from 'zod';

const ANO_SCHEMA = z.string().regex(/^\d{4}$/, 'Ano deve ter 4 dígitos');

const ANO_ATUAL = new Date().getFullYear();
const ANOS_OPCOES = Array.from({ length: 10 }, (_, i) => (ANO_ATUAL - i).toString());

interface CampoMapeado {
  label: string;
  valor: string;
}

interface GdlConsultaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAplicar: (campos: Record<string, string>, modo: 'substituir' | 'mesclar') => void;
  temDadosExistentes: boolean;
}

type Passo = 'busca' | 'revisao';

interface PreTesteResultado {
  ok: boolean;
  latencia: number;
  ambiente: string;
  statusCode: number;
  autenticado: boolean;
  erro?: string;
}

export const GdlConsultaModal: React.FC<GdlConsultaModalProps> = ({
  open,
  onOpenChange,
  onAplicar,
  temDadosExistentes,
}) => {
  const [passo, setPasso] = useState<Passo>('busca');
  const [numeroRep, setNumeroRep] = useState('');
  const [anoRep, setAnoRep] = useState(ANO_ATUAL.toString());
  const [anoManual, setAnoManual] = useState(false);
  const [anoManualValor, setAnoManualValor] = useState('');
  const [anoManualErro, setAnoManualErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<'substituir' | 'mesclar'>('mesclar');

  const [preTeste, setPreTeste] = useState<PreTesteResultado | null>(null);
  const [preTesteTestando, setPreTesteTestando] = useState(false);
  const [ambiente, setAmbiente] = useState<string>('homologacao');

  const [dadosBrutos, setDadosBrutos] = useState<any>(null);
  const [camposMapeados, setCamposMapeados] = useState<CampoMapeado[]>([]);
  const [camposNaoPreenchidos, setCamposNaoPreenchidos] = useState<string[]>([]);

  const handleTestarConexao = useCallback(async () => {
    setPreTesteTestando(true);
    try {
      const r = await window.ipcAPI.gdl.testarConexao(ambiente);
      if (r.success && r.data) {
        setPreTeste({
          ok: r.data.sucesso,
          latencia: r.data.latencia,
          ambiente: r.data.ambiente,
          statusCode: r.data.statusCode,
          autenticado: r.data.autenticado,
          erro: r.data.erro,
        });
      } else {
        setPreTeste({
          ok: false,
          latencia: 0,
          ambiente: '',
          statusCode: 0,
          autenticado: false,
          erro: r.error || 'Erro ao testar conexão',
        });
      }
    } catch {
      setPreTeste({
        ok: false,
        latencia: 0,
        ambiente: '',
        statusCode: 0,
        autenticado: false,
        erro: 'Erro ao testar conexão com GDL',
      });
    } finally {
      setPreTesteTestando(false);
    }
  }, [ambiente]);

  useEffect(() => {
    if (open) {
      setPasso('busca');
      setNumeroRep('');
      setAnoRep(ANO_ATUAL.toString());
      setAnoManual(false);
      setAnoManualValor('');
      setAnoManualErro(null);
      setErro(null);
      setDadosBrutos(null);
      setCamposMapeados([]);
      setModo('mesclar');
      setPreTeste(null);

      (async () => {
        const rAmb = await window.ipcAPI.configuracao.obter('gdl_ambiente');
        const amb = (rAmb.success && rAmb.data) ? rAmb.data : 'homologacao';
        setAmbiente(amb);

        setPreTesteTestando(true);
        try {
          const r = await window.ipcAPI.gdl.testarConexao(amb);
          if (r.success && r.data) {
            setPreTeste({
              ok: r.data.sucesso,
              latencia: r.data.latencia,
              ambiente: r.data.ambiente,
              statusCode: r.data.statusCode,
              autenticado: r.data.autenticado,
              erro: r.data.erro,
            });
          } else {
            setPreTeste({
              ok: false,
              latencia: 0,
              ambiente: '',
              statusCode: 0,
              autenticado: false,
              erro: r.error || 'Erro ao testar conexão',
            });
          }
        } catch {
          setPreTeste({
            ok: false,
            latencia: 0,
            ambiente: '',
            statusCode: 0,
            autenticado: false,
            erro: 'Erro ao testar conexão com GDL',
          });
        } finally {
          setPreTesteTestando(false);
        }
      })();
    }
  }, [open]);

  const inputsDesabilitados = !preTeste || !preTeste.ok;

  const handleAnoChange = (value: string) => {
    if (value === 'manual') {
      setAnoManual(true);
      setAnoRep('');
      setAnoManualValor('');
      setAnoManualErro(null);
    } else {
      setAnoManual(false);
      setAnoRep(value);
      setAnoManualValor('');
      setAnoManualErro(null);
    }
  };

  const handleAnoManualChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setAnoManualValor(digits);
    if (digits.length === 4) {
      const result = ANO_SCHEMA.safeParse(digits);
      if (result.success) {
        setAnoManualErro(null);
        setAnoRep(digits);
      } else {
        setAnoManualErro(result.error.errors[0].message);
        setAnoRep('');
      }
    } else if (digits.length > 0) {
      setAnoManualErro('Ano deve ter 4 dígitos');
      setAnoRep('');
    } else {
      setAnoManualErro(null);
      setAnoRep('');
    }
  };

  const handleBuscar = async () => {
    setErro(null);
    setBuscando(true);
    try {
      const r = await window.ipcAPI.gdl.consultarRep(numeroRep.trim(), anoRep.trim());
      if (r.success && r.data) {
        const dados = r.data;
        setDadosBrutos(dados);

        const mapeados: CampoMapeado[] = [];
        const naoPreenchidos: string[] = [];

        if (dados.numero && dados.ano) {
          mapeados.push({ label: 'Nº REP', valor: `${dados.numero}-${dados.ano}` });
        }

        if (dados.origens?.length > 0) {
          const origem = dados.origens[0];
          if (origem.tipo) {
            mapeados.push({ label: 'Tipo de Solicitação', valor: origem.tipo });
          }
          if (origem.numero) {
            mapeados.push({ label: 'Nº da Solicitação', valor: origem.numero });
          }
        }

        if (dados.andamentos?.length > 0) {
          const dataHora = dados.andamentos[0].dataHora;
          if (dataHora) {
            const data = dataHora.split('T')[0];
            mapeados.push({ label: 'Data de Recebimento', valor: data });
          }
        }

        if (dados.pecas?.length > 0) {
          const listaPecas = dados.pecas
            .map((p: any) => `${p.quantidade}x ${p.tipoPeca} \u2014 ${p.identificacao || 'sem identificação'} (${p.unidadeMedida || '-'})`)
            .join('\n');
          mapeados.push({ label: 'Observações (peças)', valor: listaPecas });
        }

        const todosLabels = [
          'Tipo de Exame',
          'Autoridade Solicitante',
          'Local do Fato',
          'Latitude',
          'Longitude',
          'Envolvidos',
          'Nº BO',
          'Nº IP',
          'Veículo',
          'Placa',
          'Chassi',
          'Motor',
        ];

        for (const label of todosLabels) {
          if (!mapeados.some(m => m.label === label)) {
            naoPreenchidos.push(label);
          }
        }

        setCamposMapeados(mapeados);
        setCamposNaoPreenchidos(naoPreenchidos);
        setPasso('revisao');
      } else {
        setErro(r.error || 'Erro ao consultar REP');
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao consultar REP');
    } finally {
      setBuscando(false);
    }
  };

  const handleAplicar = () => {
    const campos: Record<string, string> = {};
    if (dadosBrutos) {
      if (dadosBrutos.numero && dadosBrutos.ano) {
        campos.numero = `${dadosBrutos.numero}-${dadosBrutos.ano}`;
      }
      if (dadosBrutos.origens?.length > 0) {
        const origem = dadosBrutos.origens[0];
        if (origem.tipo) campos.tipo_solicitacao = origem.tipo;
        if (origem.numero) campos.numero_documento = origem.numero;
      }
      if (dadosBrutos.andamentos?.length > 0) {
        const dataHora = dadosBrutos.andamentos[0].dataHora;
        if (dataHora) {
          campos.data_requisicao = dataHora.split('T')[0];
        }
      }
      if (dadosBrutos.pecas?.length > 0) {
        campos.observacoes = dadosBrutos.pecas
          .map((p: any) => `${p.quantidade}x ${p.tipoPeca} \u2014 ${p.identificacao || 'sem identificação'} (${p.unidadeMedida || '-'})`)
          .join('\n');
      }
    }
    onAplicar(campos, modo);
    onOpenChange(false);
  };

  const handleClose = () => {
    setPasso('busca');
    setErro(null);
    onOpenChange(false);
  };

  const ambienteLabel = ambiente === 'producao' ? 'Produção' : 'Homologação';

  const getPreTesteMensagem = (): string => {
    if (!preTeste) return 'Verificando conexão...';
    if (preTeste.ok) {
      return `Conectado ao GDL \u2014 ${preTeste.ambiente} (${preTeste.latencia}ms)`;
    }
    if (preTeste.erro?.includes('Credenciais')) {
      return `Credenciais não configuradas para ${ambienteLabel}. Acesse a página de API GDL para configurar.`;
    }
    if (preTeste.erro?.includes('Timeout') || preTeste.erro?.includes('ENOTFOUND') || preTeste.erro?.includes('ECONNREFUSED')) {
      return `Sem conexão com o servidor GDL (${ambienteLabel}). Verifique a VPN.`;
    }
    if (preTeste.statusCode === 401 || preTeste.statusCode === 403) {
      return `Falha de autenticação no GDL (${ambienteLabel}). Verifique login e senha.`;
    }
    return preTeste.erro || `Erro de conexão com o GDL (${ambienteLabel}).`;
  };

  const selectTriggerAnoValue = anoManual ? 'manual' : (anoRep || undefined);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[540px] flex flex-col max-h-[85vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            Consultar GDL
            {ambiente && (
              <>
                <Badge variant={ambiente === 'producao' ? 'default' : 'secondary'} className="text-xs">
                  {ambienteLabel}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleTestarConexao}
                  disabled={preTesteTestando}
                  title="Testar conexão"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${preTesteTestando ? 'animate-spin' : ''}`} />
                </Button>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Busque uma REP no GDL para preencher automaticamente o formulário.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4 shrink-0">
          <div className={`flex items-center gap-1 text-sm ${passo === 'busca' ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-current text-xs">
              {passo === 'revisao' ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : '1'}
            </span>
            Busca
          </div>
          <Separator className="flex-1" />
          <div className={`flex items-center gap-1 text-sm ${passo === 'revisao' ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-current text-xs">2</span>
            Revisão
          </div>
        </div>

        {passo === 'busca' && (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
              {preTeste && (
                <Alert variant={preTeste.ok ? 'default' : 'destructive'}>
                  <div className="flex items-center gap-2">
                    {preTeste.ok ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      {getPreTesteMensagem()}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {!preTeste && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando conexão com o GDL...
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gdl-numero-rep">Nº da REP</Label>
                  <Input
                    id="gdl-numero-rep"
                    value={numeroRep}
                    onChange={e => setNumeroRep(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="12345"
                    disabled={inputsDesabilitados}
                    onKeyDown={e => { if (e.key === 'Enter' && !inputsDesabilitados) handleBuscar(); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gdl-ano-rep">Ano</Label>
                  <Select
                    value={selectTriggerAnoValue}
                    onValueChange={handleAnoChange}
                    disabled={inputsDesabilitados}
                  >
                    <SelectTrigger id="gdl-ano-rep">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="!max-h-[150px]">
                      {ANOS_OPCOES.map(ano => (
                        <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                      ))}
                      <SelectItem value="manual">Digitar manualmente...</SelectItem>
                    </SelectContent>
                  </Select>
                  {anoManual && (
                    <div className="pt-2">
                      <Input
                        value={anoManualValor}
                        onChange={e => handleAnoManualChange(e.target.value)}
                        placeholder="Ex: 2024"
                        maxLength={4}
                        inputMode="numeric"
                        disabled={inputsDesabilitados}
                        className={anoManualErro ? 'border-destructive' : ''}
                      />
                      {anoManualErro && (
                        <p className="text-xs text-destructive mt-1">{anoManualErro}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {erro && (
                <Alert variant="destructive">
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}
            </div>

            <Separator className="shrink-0" />

            <div className="flex justify-end gap-3 shrink-0 pt-3">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleBuscar}
                disabled={inputsDesabilitados || !numeroRep.trim() || !anoRep.trim() || buscando}
                className="gap-2"
              >
                {buscando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {buscando ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
          </>
        )}

        {passo === 'revisao' && (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
              <Alert>
                <AlertDescription>
                  REP <strong>{dadosBrutos?.numero}/{dadosBrutos?.ano}</strong> encontrada.
                  <br />
                  <span className="text-green-600 font-medium">{camposMapeados.length} campos</span> serão preenchidos.
                  <span className="text-muted-foreground"> {camposNaoPreenchidos.length} permanecem vazios.</span>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <ListChecks className="h-4 w-4" />
                  Campos que serão preenchidos:
                </Label>
                <div className="space-y-1">
                  {camposMapeados.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">{c.label}:</span>{' '}
                        <span className="text-muted-foreground whitespace-pre-wrap">{c.valor}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium">Campos que permanecem vazios (preenchimento manual):</Label>
                <div className="flex flex-wrap gap-1">
                  {camposNaoPreenchidos.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </div>

              {temDadosExistentes && (
                <Alert variant="default" className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription>
                    <p className="font-medium mb-1">O formulário já possui dados preenchidos.</p>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="modo-gdl"
                          checked={modo === 'mesclar'}
                          onChange={() => setModo('mesclar')}
                          className="text-primary"
                        />
                        <span className="text-sm">Mesclar (só preencher vazios)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="modo-gdl"
                          checked={modo === 'substituir'}
                          onChange={() => setModo('substituir')}
                          className="text-primary"
                        />
                        <span className="text-sm">Substituir tudo</span>
                      </label>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator className="shrink-0" />

            <div className="flex justify-between shrink-0 pt-3">
              <Button variant="outline" onClick={() => setPasso('busca')} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button onClick={handleAplicar} className="gap-2">
                Aplicar ao Formulário
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

