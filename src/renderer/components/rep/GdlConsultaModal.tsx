import React, { useState, useEffect } from 'react';
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
import { Stepper } from '@/components/ui/stepper';
import {
  Search,
  Database,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ListChecks,
} from 'lucide-react';

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

export const GdlConsultaModal: React.FC<GdlConsultaModalProps> = ({
  open,
  onOpenChange,
  onAplicar,
  temDadosExistentes,
}) => {
  const [passo, setPasso] = useState<Passo>('busca');
  const [numeroRep, setNumeroRep] = useState('');
  const [anoRep, setAnoRep] = useState(new Date().getFullYear().toString());
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<'substituir' | 'mesclar'>('mesclar');

  const [preTeste, setPreTeste] = useState<{
    ok: boolean;
    latencia: number;
    erro?: string;
  } | null>(null);

  const [dadosBrutos, setDadosBrutos] = useState<any>(null);
  const [camposMapeados, setCamposMapeados] = useState<CampoMapeado[]>([]);
  const [camposNaoPreenchidos, setCamposNaoPreenchidos] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setPasso('busca');
      setNumeroRep('');
      setAnoRep(new Date().getFullYear().toString());
      setErro(null);
      setDadosBrutos(null);
      setCamposMapeados([]);
      setModo('mesclar');

      // Pré-teste automático
      (async () => {
        try {
          const inicio = Date.now();
          const r = await window.ipcAPI.gdl.testarConexao();
          if (r.success && r.data) {
            setPreTeste({
              ok: r.data.sucesso,
              latencia: Date.now() - inicio,
              erro: r.data.erro,
            });
          } else {
            setPreTeste({ ok: false, latencia: 0, erro: 'Erro ao testar conexão' });
          }
        } catch {
          setPreTeste({ ok: false, latencia: 0, erro: 'Erro ao testar conexão' });
        }
      })();
    }
  }, [open]);

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

        // Nº REP
        if (dados.numero && dados.ano) {
          mapeados.push({ label: 'Nº REP', valor: `${dados.numero}-${dados.ano}` });
        }

        // Tipo de Solicitação / Nº da Solicitação (origens)
        if (dados.origens?.length > 0) {
          const origem = dados.origens[0];
          if (origem.tipo) {
            mapeados.push({ label: 'Tipo de Solicitação', valor: origem.tipo });
          }
          if (origem.numero) {
            mapeados.push({ label: 'Nº da Solicitação', valor: origem.numero });
          }
        }

        // Data de recebimento (primeiro andamento)
        if (dados.andamentos?.length > 0) {
          const dataHora = dados.andamentos[0].dataHora;
          if (dataHora) {
            const data = dataHora.split('T')[0];
            mapeados.push({ label: 'Data de Recebimento', valor: data });
          }
        }

        // Peças → observações
        if (dados.pecas?.length > 0) {
          const listaPecas = dados.pecas
            .map((p: any) => `${p.quantidade}x ${p.tipoPeca} — ${p.identificacao || 'sem identificação'} (${p.unidadeMedida || '-'})`)
            .join('\n');
          mapeados.push({ label: 'Observações (peças)', valor: listaPecas });
        }

        // Listar campos que NÃO vieram
        const mapeadosKeys = new Set([
          'numero',
          'tipo_solicitacao',
          'numero_documento',
          'data_requisicao',
          'observacoes',
        ]);

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
          .map((p: any) => `${p.quantidade}x ${p.tipoPeca} — ${p.identificacao || 'sem identificação'} (${p.unidadeMedida || '-'})`)
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Consultar GDL
          </DialogTitle>
          <DialogDescription>
            Busque uma REP no GDL para preencher automaticamente o formulário.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
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
          <div className="space-y-4">
            {preTeste && (
              <Alert variant={preTeste.ok ? 'default' : 'destructive'}>
                <div className="flex items-center gap-2">
                  {preTeste.ok ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {preTeste.ok
                      ? `Conectado ao GDL (${preTeste.latencia}ms)`
                      : preTeste.erro || 'Sem conexão com GDL. Verifique a VPN.'}
                  </AlertDescription>
                </div>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gdl-numero-rep">Nº da REP</Label>
                <Input
                  id="gdl-numero-rep"
                  value={numeroRep}
                  onChange={e => setNumeroRep(e.target.value)}
                  placeholder="12345"
                  onKeyDown={e => { if (e.key === 'Enter') handleBuscar(); }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gdl-ano-rep">Ano</Label>
                <Input
                  id="gdl-ano-rep"
                  value={anoRep}
                  onChange={e => setAnoRep(e.target.value)}
                  placeholder="2024"
                  onKeyDown={e => { if (e.key === 'Enter') handleBuscar(); }}
                />
              </div>
            </div>

            {erro && (
              <Alert variant="destructive">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}

            <Separator />

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleBuscar}
                disabled={!numeroRep.trim() || !anoRep.trim() || buscando}
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
          </div>
        )}

        {passo === 'revisao' && (
          <div className="space-y-4">
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

            <Separator />

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setPasso('busca')} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button onClick={handleAplicar} className="gap-2">
                Aplicar ao Formulário
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GdlConsultaModal;
