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
import { Checkbox } from '@/components/ui/checkbox';
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
import type {
  DadosImportacaoB602,
  PecaB602,
  ResultadoImportacaoExame,
} from '@shared/types/b602-gdl.types';
import { TIPOS_PECA_B602_POR_CODIGO } from '@shared/catalogos/b602-gdl.catalogo';
import { combinarEnvolvido } from '@shared/utils/envolvido';
import { montarItensReconciliacaoPecasB602 } from '@/components/rep/exam-fields/pecas-b602.utils';

const ANO_SCHEMA = z.string().regex(/^\d{4}$/, 'Ano deve ter 4 dígitos');

const ANO_ATUAL = new Date().getFullYear();
const ANOS_OPCOES = Array.from({ length: 10 }, (_, i) => (ANO_ATUAL - i).toString());

interface CampoMapeado {
  campo: string;
  label: string;
  valor: string;
}

interface GdlConsultaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAplicar: (
    resultado: ResultadoImportacaoExame<DadosImportacaoB602>,
    modo: 'substituir' | 'mesclar',
    pecasImportadasSelecionadas: PecaB602[],
  ) => void | Promise<void>;
  temDadosExistentes: boolean;
  pecasB602: PecaB602[];
  onConfigurarCredenciais: () => void;
}

type Passo = 'busca' | 'revisao';

interface PreTesteResultado {
  ok: boolean;
  latencia: number;
  ambiente: string;
  statusCode: number;
  autenticado: boolean;
  erro?: string;
  rede?: PreTesteEtapa;
}

interface PreTesteEtapa {
  sucesso: boolean;
  latencia: number;
  statusCode: number;
  endpointTestado: string;
  erro?: string;
}

interface GdlTesteRespostaApi {
  sucesso: boolean;
  latencia: number;
  ambiente: string;
  statusCode: number;
  autenticado: boolean;
  erro?: string;
  rede?: PreTesteEtapa;
}

const getMensagemErro = (erro: unknown, fallback: string): string =>
  erro instanceof Error ? erro.message : fallback;

function formatarValorRevisao(valor: unknown): string {
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
  if (valor === null || valor === undefined) return 'Não informado'
  return JSON.stringify(valor)
}

function obterLabelCampoPersonalizado(peca: PecaB602, id: string): string {
  return TIPOS_PECA_B602_POR_CODIGO.get(peca.tipoCodigo)?.campos.find(campo => campo.id === id)?.label ?? id
}

export const GdlConsultaModal: React.FC<GdlConsultaModalProps> = ({
  open,
  onOpenChange,
  onAplicar,
  temDadosExistentes,
  pecasB602,
  onConfigurarCredenciais,
}) => {
  const [passo, setPasso] = useState<Passo>('busca');
  const [numeroRep, setNumeroRep] = useState('');
  const [anoRep, setAnoRep] = useState(ANO_ATUAL.toString());
  const [anoManual, setAnoManual] = useState(false);
  const [anoManualValor, setAnoManualValor] = useState('');
  const [anoManualErro, setAnoManualErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<'substituir' | 'mesclar'>('mesclar');

  const [preTeste, setPreTeste] = useState<PreTesteResultado | null>(null);
  const [preTesteTestando, setPreTesteTestando] = useState(false);
  const [ambiente, setAmbiente] = useState<string>('homologacao');

  const [resultadoConsulta, setResultadoConsulta] = useState<ResultadoImportacaoExame<DadosImportacaoB602> | null>(null);
  const [idsPecasSelecionadas, setIdsPecasSelecionadas] = useState<Set<string>>(new Set());
  const [camposMapeados, setCamposMapeados] = useState<CampoMapeado[]>([]);
  const [camposNaoPreenchidos, setCamposNaoPreenchidos] = useState<string[]>([]);

  const montarPreTeste = (data: GdlTesteRespostaApi): PreTesteResultado => ({
    ok: data.sucesso,
    latencia: data.latencia,
    ambiente: data.ambiente,
    statusCode: data.statusCode,
    autenticado: data.autenticado,
    erro: data.erro,
    rede: data.rede,
  });

  const handleTestarConexao = useCallback(async () => {
    setPreTesteTestando(true);
    try {
      const r = await window.ipcAPI.gdl.testarConexao(ambiente);
      if (r.success && r.data) {
        setPreTeste(montarPreTeste(r.data));
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
      setAplicando(false);
      setResultadoConsulta(null);
      setIdsPecasSelecionadas(new Set());
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
            setPreTeste(montarPreTeste(r.data));
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
        setAnoManualErro(result.error.issues[0].message);
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
        const resultado: ResultadoImportacaoExame<DadosImportacaoB602> = r.data;
        setResultadoConsulta(resultado);
        setIdsPecasSelecionadas(new Set(
          resultado.camposEspecificos.pecas.map(peca => `gdl-${peca.codPecaGdl ?? peca.idLocal}`),
        ));

        const mapeados: CampoMapeado[] = [];
        const naoPreenchidos: string[] = [];

        const tiposBo = [...new Set(resultado.camposEspecificos.dadosInvestigacao.boletinsOcorrencia.map(referencia => referencia.tipo))];
        const tiposIp = [...new Set(resultado.camposEspecificos.dadosInvestigacao.inqueritosPoliciais.map(referencia => referencia.tipo))];
        const labelsCampos: Record<string, string> = {
          numero: 'Nº REP',
          tipo_solicitacao: 'Tipo de Solicitação',
          numero_documento: 'Nº da Solicitação',
          data_requisicao: 'Data de Recebimento',
          b602_numero_bo: tiposBo.length ? `Nº BO (${tiposBo.join(', ')})` : 'Nº BO',
          b602_numero_ip: tiposIp.length ? `Nº IP (${tiposIp.join(', ')})` : 'Nº IP',
        };
        for (const [campo, valor] of Object.entries(resultado.camposGerais)) {
          if (campo.startsWith('b602_envolvidos_')) continue;
          if (valor) mapeados.push({ campo, label: labelsCampos[campo] ?? campo, valor });
        }

        const envolvidos = Array.from({ length: 10 }, (_, indice) => combinarEnvolvido(
          resultado.camposGerais[`b602_envolvidos_qualificacao_${indice}`] || '',
          resultado.camposGerais[`b602_envolvidos_${indice}`] || '',
        ))
          .filter(Boolean)
          .join('\n');
        if (envolvidos) mapeados.push({ campo: 'envolvidos', label: 'Envolvidos', valor: envolvidos });

        const pecas = resultado.camposEspecificos.pecas;
        if (pecas.length > 0) {
          const listaPecas = pecas
            .map((p) => `${p.comuns.quantidade}x ${p.tipoPeca} \u2014 ${p.comuns.identificacao || 'sem identificação'} (${p.comuns.unidadeMedida || '-'})`)
            .join('\n');
          mapeados.push({ campo: 'pecas', label: 'Peças estruturadas', valor: listaPecas });
        }

        const todosCampos = [
          { campo: 'tipo_exame', label: 'Tipo de Exame' },
          { campo: 'autoridade_solicitante', label: 'Autoridade Solicitante' },
          { campo: 'local_fato', label: 'Local do Fato' },
          { campo: 'latitude', label: 'Latitude' },
          { campo: 'longitude', label: 'Longitude' },
          { campo: 'envolvidos', label: 'Envolvidos' },
          { campo: 'b602_numero_bo', label: 'Nº BO' },
          { campo: 'b602_numero_ip', label: 'Nº IP' },
          { campo: 'veiculo', label: 'Veículo' },
          { campo: 'placa', label: 'Placa' },
          { campo: 'chassi', label: 'Chassi' },
          { campo: 'motor', label: 'Motor' },
        ];

        for (const { campo, label } of todosCampos) {
          if (!mapeados.some(m => m.campo === campo)) {
            naoPreenchidos.push(label);
          }
        }

        setCamposMapeados(mapeados);
        setCamposNaoPreenchidos(naoPreenchidos);
        setPasso('revisao');
      } else {
        setErro(r.error || 'Erro ao consultar REP');
      }
    } catch (e: unknown) {
      setErro(getMensagemErro(e, 'Erro ao consultar REP'));
    } finally {
      setBuscando(false);
    }
  };

  const handleAplicar = async () => {
    if (!resultadoConsulta) return;
    setAplicando(true);
    try {
      const itensReconciliacao = montarItensReconciliacaoPecasB602(
        pecasB602,
        resultadoConsulta.camposEspecificos.pecas,
      );
      const pecasImportadasSelecionadas = itensReconciliacao
        .filter(item => idsPecasSelecionadas.has(item.chave))
        .map(item => item.peca);

      await onAplicar({
        ...resultadoConsulta,
        camposEspecificos: {
          ...resultadoConsulta.camposEspecificos,
          pecas: resultadoConsulta.camposEspecificos.pecas.filter(peca => idsPecasSelecionadas.has(`gdl-${peca.codPecaGdl ?? peca.idLocal}`)),
        },
      }, modo, pecasImportadasSelecionadas);
      onOpenChange(false);
    } finally {
      setAplicando(false);
    }
  };

  const alternarSelecaoPeca = (idLocal: string) => {
    setIdsPecasSelecionadas(atuais => {
      const proximas = new Set(atuais)
      if (proximas.has(idLocal)) proximas.delete(idLocal)
      else proximas.add(idLocal)
      return proximas
    })
  }

  const handleClose = () => {
    setPasso('busca');
    setErro(null);
    onOpenChange(false);
  };

  const ambienteLabel = ambiente === 'producao' ? 'Produção' : 'Homologação';
  const itensReconciliacao = resultadoConsulta
    ? montarItensReconciliacaoPecasB602(pecasB602, resultadoConsulta.camposEspecificos.pecas)
    : [];

  const getPreTesteMensagem = (): string => {
    if (!preTeste) return 'Verificando conexão...';
    if (preTeste.ok) {
      return `GDL acessível na rede \u2014 ${preTeste.ambiente} (${preTeste.latencia}ms)`;
    }
    if (preTeste.erro?.includes('Timeout') || preTeste.erro?.includes('ENOTFOUND') || preTeste.erro?.includes('ECONNREFUSED')) {
      return `Sem conexão com o servidor GDL (${ambienteLabel}). Verifique a VPN.`;
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
                  <div className="flex items-start gap-2">
                    {preTeste.ok ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 mt-0.5" />
                    )}
                    <AlertDescription className="space-y-1">
                      <p>{getPreTesteMensagem()}</p>
                      {!preTeste.ok && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTestarConexao}
                          disabled={preTesteTestando}
                          className="mt-2"
                        >
                          Testar novamente
                        </Button>
                      )}
                      {preTeste.rede && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Badge variant={preTeste.rede.sucesso ? 'secondary' : 'destructive'} className="text-xs">
                            Rede: {preTeste.rede.sucesso ? 'OK' : 'Falha'}
                          </Badge>
                        </div>
                      )}
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
                    onKeyDown={e => { if (e.key === 'Enter') handleBuscar(); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gdl-ano-rep">Ano</Label>
                  <Select
                    value={selectTriggerAnoValue}
                    onValueChange={handleAnoChange}
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
                  <AlertDescription className="space-y-2">
                    <p>{erro}</p>
                    {erro.includes('Credenciais não configuradas') && (
                      <Button variant="outline" size="sm" onClick={onConfigurarCredenciais}>
                        Configurar credenciais
                      </Button>
                    )}
                  </AlertDescription>
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
          </>
        )}

        {passo === 'revisao' && (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
              <Alert>
                <AlertDescription>
                  REP <strong>{resultadoConsulta?.camposGerais.numero}</strong> encontrada.
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

              {!!resultadoConsulta?.avisos.length && (
                <Alert variant="default" className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription>
                    {resultadoConsulta.avisos.map(aviso => <p key={`${aviso.codigo}-${aviso.mensagem}`}>{aviso.mensagem}</p>)}
                  </AlertDescription>
                </Alert>
              )}

              {!!itensReconciliacao.length && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Revisão das peças do GDL</Label>
                  <p className="text-xs text-muted-foreground">Todas as peças retornadas pelo GDL começam marcadas. Em “Substituir”, desmarcar uma peça importada a remove apenas do laWdo.</p>
                  <div className="space-y-2">
                    {itensReconciliacao.map(({ chave, peca, jaImportada, retornadaPeloGdl }) => (
                      <label key={chave} className="block cursor-pointer rounded-md border border-border bg-card p-3 transition-colors hover:bg-muted/50">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={idsPecasSelecionadas.has(chave)}
                            onCheckedChange={() => alternarSelecaoPeca(chave)}
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{peca.tipoPeca}</span>
                              <Badge variant="secondary">{peca.comuns.quantidade} {peca.comuns.unidadeMedida || 'unidade(s)'}</Badge>
                              {jaImportada && <Badge variant="outline">Já importada</Badge>}
                              {!retornadaPeloGdl && <Badge variant="destructive">Não retornou nesta consulta</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">{peca.comuns.identificacao || 'Sem identificação'}</p>
                            {!!Object.keys(peca.personalizados).length && (
                              <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-2">
                                {Object.entries(peca.personalizados).map(([id, valor]) => (
                                  <div key={id} className="flex gap-1"><dt className="font-medium">{obterLabelCampoPersonalizado(peca, id)}:</dt><dd>{formatarValorRevisao(valor)}</dd></div>
                                ))}
                              </dl>
                            )}
                            {!!Object.keys(peca.extrasGdl).length && (
                              <div className="rounded bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                                <p className="font-medium">Campos não mapeados — serão preservados</p>
                                {Object.entries(peca.extrasGdl).map(([chave, valor]) => <p key={chave}>{chave}: {formatarValorRevisao(valor)}</p>)}
                              </div>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

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
                        <span className="text-sm">Substituir dados do GDL</span>
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
              <Button onClick={handleAplicar} disabled={aplicando} className="gap-2">
                {temDadosExistentes ? 'Aplicar ao Formulário' : 'Preencher formulário'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
