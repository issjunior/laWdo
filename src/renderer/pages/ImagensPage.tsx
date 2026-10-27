import { useEffect, useState } from 'react';
import { Check, Image, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LIMITES_FIGURA_LAUDO, PERFIL_FIGURA_LAUDO_PADRAO, perfilFiguraLaudoValido, LIMITES_PREVIA_EDITOR, PERFIL_PREVIA_EDITOR_PADRAO, perfilPreviaEditorValido, type PerfilFiguraLaudo, type PerfilPreviaEditor } from '@shared/types/imagem-laudo.types';
import { CONFIGURACAO_IMAGEM_IA_PADRAO, configuracaoImagemIaValida, type QualidadeImagemIa } from '@shared/types/ia.types';

const perfis: Array<{ valor: PerfilPreviaEditor; rotulo: string; descricao: string; largura: string }> = [
  { valor: 'economico', rotulo: 'Econômico', descricao: 'Prévia de 480 a 640 px', largura: 'w-24 sm:w-32' },
  { valor: 'equilibrado', rotulo: 'Equilibrado', descricao: 'Prévia adaptativa de 640 a 960 px', largura: 'w-36 sm:w-48' },
  { valor: 'nitido', rotulo: 'Nítido', descricao: 'Prévia de 960 a 1280 px', largura: 'w-48 sm:w-64' },
];

const qualidadesIa: Array<{ valor: QualidadeImagemIa; rotulo: string; descricao: string; largura: string }> = [
  { valor: 'muito_economica', rotulo: 'Muito econômica', descricao: 'Até 384 px · JPEG 60', largura: 'w-12 sm:w-16' },
  { valor: 'economica', rotulo: 'Econômica', descricao: 'Até 512 px', largura: 'w-16 sm:w-[85px]' },
  { valor: 'equilibrada', rotulo: 'Equilibrada', descricao: 'Até 768 px', largura: 'w-24 sm:w-32' },
  { valor: 'alta', rotulo: 'Alta', descricao: 'Até 1536 px', largura: 'w-48 sm:w-64' },
  { valor: 'original', rotulo: 'Original', descricao: 'Enviar o arquivo local sem redução', largura: '' },
];

const perfisLaudo: Array<{ valor: PerfilFiguraLaudo; rotulo: string; largura: string }> = [
  { valor: 'maxima_economia', rotulo: 'Máxima economia', largura: 'w-24 sm:w-32' },
  { valor: 'compacto', rotulo: 'Compacto', largura: 'w-30 sm:w-40' },
  { valor: 'equilibrado', rotulo: 'Equilibrado', largura: 'w-[150px] sm:w-[200px]' },
  { valor: 'nitido', rotulo: 'Nítido', largura: 'w-48 sm:w-64' },
];

function AmostraImagem({ largura, selecionada }: { largura: string; selecionada: boolean }) {
  return <svg viewBox="0 0 192 120" aria-hidden="true"
    className={`${largura} rounded border bg-card text-primary shadow-sm ${selecionada ? 'border-primary ring-2 ring-primary' : 'border-border opacity-70'}`}>
    <rect width="192" height="120" className="fill-muted/40" />
    <path d="M0 90 45 48 78 72 123 27 192 91v29H0Z" className="fill-primary/20" />
    <path d="m0 90 45-42 33 24 45-45 69 64" fill="none" className="stroke-primary/70" strokeWidth="2" />
    <circle cx="158" cy="28" r="12" className="fill-primary/25 stroke-primary/70" strokeWidth="2" />
    <path d="M18 104h65M18 110h42" className="stroke-foreground/50" strokeWidth="2" />
  </svg>;
}

function ComparacaoTamanhos({ opcoes, selecionado }: {
  opcoes: Array<{ valor: string; rotulo: string; largura: string }>;
  selecionado: string;
}) {
  const camadas = opcoes.filter(opcao => opcao.valor !== 'original').slice().reverse();
  const original = opcoes.find(opcao => opcao.valor === 'original');
  const rotulo = opcoes.find(opcao => opcao.valor === selecionado)?.rotulo;
  return <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4" role="img"
    aria-label={`Comparação proporcional dos limites de imagem. Selecionado: ${rotulo}${selecionado === 'original' ? ', tamanho variável' : ''}`}>
    <span className="text-sm font-medium">Comparação de tamanhos</span>
    <div className="flex h-48 items-end justify-center sm:h-60">
      <div className="relative h-44 w-56 sm:h-52 sm:w-72">
        {original && <div className={`absolute inset-0 rounded border-2 border-dashed ${selecionado === 'original' ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'border-muted-foreground/40'}`} aria-hidden="true" />}
        {camadas.map(opcao => <div key={opcao.valor} className="absolute bottom-2 left-2" aria-hidden="true">
          <AmostraImagem largura={opcao.largura} selecionada={selecionado === opcao.valor} />
        </div>)}
      </div>
    </div>
    <span className="text-xs font-medium text-primary">Selecionado: {rotulo}</span>
    {original && <span className="text-xs text-muted-foreground">Contorno tracejado: tamanho variável da origem</span>}
    <span className="text-xs text-muted-foreground">Escala ilustrativa pelo limite máximo em pixels.</span>
  </div>;
}

export function ImagensPage() {
  const [perfilLaudo, setPerfilLaudo] = useState<PerfilFiguraLaudo>(PERFIL_FIGURA_LAUDO_PADRAO);
  const [perfil, setPerfil] = useState<PerfilPreviaEditor>(PERFIL_PREVIA_EDITOR_PADRAO);
  const [qualidadeIa, setQualidadeIa] = useState<QualidadeImagemIa>(CONFIGURACAO_IMAGEM_IA_PADRAO.qualidade);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<'laudo' | 'editor' | 'ia' | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [falhas, setFalhas] = useState<{ laudo: boolean; editor: boolean; ia: boolean }>({ laudo: false, editor: false, ia: false });

  useEffect(() => {
    let ativo = true;
    void Promise.all([
      window.ipcAPI.configuracao.obter('perfil_figura_laudo'),
      window.ipcAPI.configuracao.obter('perfil_previa_editor'),
      window.ipcAPI.configuracao.obter('qualidade_imagem_ia'),
    ]).then(([respostaLaudo, respostaEditor, respostaIa]) => {
      if (!ativo) return;
      let falhaIa = !respostaIa.success;
      if (perfilFiguraLaudoValido(respostaLaudo.data)) setPerfilLaudo(respostaLaudo.data);
      if (perfilPreviaEditorValido(respostaEditor.data)) setPerfil(respostaEditor.data);
      if (typeof respostaIa.data === 'string') {
        try {
          const configuracao: unknown = JSON.parse(respostaIa.data);
          if (configuracaoImagemIaValida(configuracao)) setQualidadeIa(configuracao.qualidade);
          else falhaIa = true;
        } catch { falhaIa = true; }
      }
      setFalhas({ laudo: !respostaLaudo.success, editor: !respostaEditor.success, ia: falhaIa });
      if (!respostaLaudo.success || !respostaEditor.success || falhaIa) setMensagem('Não foi possível carregar todas as preferências de imagens.');
    }).catch(error => {
      if (ativo) setMensagem(error instanceof Error ? error.message : 'Não foi possível ler as preferências.');
    }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const salvar = async (grupo: 'laudo' | 'editor' | 'ia') => {
    if (falhas[grupo]) return;
    setSalvando(grupo);
    setMensagem(null);
    try {
      const resposta = grupo === 'laudo'
        ? await window.ipcAPI.configuracao.salvar('perfil_figura_laudo', perfilLaudo, 'string', 'Perfil da figura do laudo e PDF')
        : grupo === 'editor'
          ? await window.ipcAPI.configuracao.salvar('perfil_previa_editor', perfil, 'string', 'Perfil da prévia de imagens do editor')
          : await window.ipcAPI.configuracao.salvar('qualidade_imagem_ia', JSON.stringify({ versao: 1, qualidade: qualidadeIa }),
          'json', 'Qualidade da imagem enviada para descrição por IA');
      if (!resposta.success) throw new Error(resposta.error || 'Não foi possível salvar a preferência.');
      setMensagem('Preferência salva.');
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Não foi possível salvar a preferência.');
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3"><Image className="h-6 w-6 text-primary" /><h1 className="text-2xl font-semibold">Imagens</h1></div>
        <p className="text-sm text-muted-foreground">Configure separadamente as figuras do laudo, a prévia durante a edição e o envio para IA.</p>
      </header>
      {mensagem && <p role="status" className="text-sm text-muted-foreground">{mensagem}</p>}
      <p className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />Os desenhos comparam limites de dimensões; não simulam qualidade visual nem estimam tamanho em MB. Imagens menores nunca são ampliadas.
      </p>
      <Card>
        <CardHeader><CardTitle>Figura do laudo e PDF</CardTitle><CardDescription>Escolha a compactação das figuras inseridas. As fotos originais permanecem disponíveis durante a elaboração e são descartadas ao concluir o laudo.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div role="radiogroup" aria-label="Perfil da figura do laudo" className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Mais detalhes → maior economia</span>
              {perfisLaudo.slice().reverse().map(opcao => {
                const selecionado = perfilLaudo === opcao.valor;
                const limite = LIMITES_FIGURA_LAUDO[opcao.valor];
                return <button key={opcao.valor} type="button" role="radio" aria-checked={selecionado}
                  disabled={carregando || salvando !== null || falhas.laudo} onClick={() => setPerfilLaudo(opcao.valor)}
                  className={`flex min-h-14 flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selecionado ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/50'}`}>
                  <span className="flex items-start justify-between gap-2 font-medium">{opcao.rotulo}{selecionado && <span className="flex items-center gap-1 text-xs text-primary"><Check className="h-3.5 w-3.5" />Selecionado</span>}</span>
                  <span className="text-sm text-muted-foreground">Até {limite.maiorLado} px · JPEG {limite.qualidadeJpeg}{opcao.valor === PERFIL_FIGURA_LAUDO_PADRAO ? ' · Padrão' : ''}</span>
                </button>;
              })}
            </div>
            <ComparacaoTamanhos opcoes={perfisLaudo} selecionado={perfilLaudo} />
          </div>
          <p className="text-xs text-muted-foreground">Perfis mais econômicos podem reduzir detalhes em ampliações e na impressão.</p>
          <Button disabled={carregando || salvando !== null || falhas.laudo} onClick={() => void salvar('laudo')}>Salvar perfil do laudo</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Prévia no editor</CardTitle><CardDescription>Controla somente a imagem exibida durante a edição. Não altera a figura guardada nem o PDF.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div role="radiogroup" aria-label="Perfil da prévia no editor" className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Maior prévia → menor prévia</span>
              {perfis.slice().reverse().map(opcao => <button key={opcao.valor} type="button" role="radio" aria-checked={perfil === opcao.valor}
                disabled={carregando || salvando !== null || falhas.editor} onClick={() => setPerfil(opcao.valor)}
                className={`flex min-h-14 flex-col gap-0.5 rounded-lg border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${perfil === opcao.valor ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/50'}`}>
                <span className="flex justify-between gap-2 font-medium">{opcao.rotulo}{perfil === opcao.valor && <span className="flex items-center gap-1 text-xs text-primary"><Check className="h-3.5 w-3.5" />Selecionado</span>}</span>
                <span className="text-sm text-muted-foreground">{opcao.descricao}</span>
              </button>)}
            </div>
            <ComparacaoTamanhos opcoes={perfis} selecionado={perfil} />
          </div>
          <p className="text-xs text-muted-foreground">Limite atual: {LIMITES_PREVIA_EDITOR[perfil].minimo}–{LIMITES_PREVIA_EDITOR[perfil].maximo} px no maior lado. Imagens pequenas não são ampliadas.</p>
          <Button disabled={carregando || salvando !== null || falhas.editor} onClick={() => void salvar('editor')}>Salvar prévia do editor</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Envio para IA</CardTitle><CardDescription>Controla apenas a cópia enviada para descrição. Não altera o laudo nem o PDF.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div role="radiogroup" aria-label="Qualidade da imagem enviada para descrição" className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Mais detalhes → menor envio</span>
              {qualidadesIa.slice().reverse().map(opcao => <button key={opcao.valor} type="button" role="radio" aria-checked={qualidadeIa === opcao.valor}
                disabled={carregando || salvando !== null || falhas.ia} onClick={() => setQualidadeIa(opcao.valor)}
                className={`flex min-h-14 flex-col gap-0.5 rounded-lg border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${qualidadeIa === opcao.valor ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/50'}`}>
                <span className="flex justify-between gap-2 font-medium">{opcao.rotulo}{qualidadeIa === opcao.valor && <span className="flex items-center gap-1 text-xs text-primary"><Check className="h-3.5 w-3.5" />Selecionado</span>}</span>
                <span className="text-sm text-muted-foreground">{opcao.descricao}</span>
              </button>)}
            </div>
            <ComparacaoTamanhos opcoes={qualidadesIa} selecionado={qualidadeIa} />
          </div>
          <Button disabled={carregando || salvando !== null || falhas.ia} onClick={() => void salvar('ia')}>Salvar qualidade para IA</Button>
        </CardContent>
      </Card>
    </div>
  );
}
