import { useEffect, useState } from 'react';
import { Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LIMITES_PREVIA_EDITOR, PERFIL_PREVIA_EDITOR_PADRAO, perfilPreviaEditorValido, type PerfilPreviaEditor } from '@shared/types/imagem-laudo.types';
import { CONFIGURACAO_IMAGEM_IA_PADRAO, configuracaoImagemIaValida, type QualidadeImagemIa } from '@shared/types/ia.types';

const perfis: Array<{ valor: PerfilPreviaEditor; rotulo: string; descricao: string }> = [
  { valor: 'economico', rotulo: 'Econômico', descricao: 'Prévia de 480 a 640 px' },
  { valor: 'equilibrado', rotulo: 'Equilibrado', descricao: 'Prévia adaptativa de 640 a 960 px' },
  { valor: 'nitido', rotulo: 'Nítido', descricao: 'Prévia de 960 a 1280 px' },
];

const qualidadesIa: Array<{ valor: QualidadeImagemIa; rotulo: string; descricao: string }> = [
  { valor: 'original', rotulo: 'Original', descricao: 'Enviar o arquivo local sem redução' },
  { valor: 'alta', rotulo: 'Alta', descricao: 'Até 1536 px' },
  { valor: 'equilibrada', rotulo: 'Equilibrada', descricao: 'Até 768 px' },
  { valor: 'economica', rotulo: 'Econômica', descricao: 'Até 512 px' },
];

export function ImagensPage() {
  const [perfil, setPerfil] = useState<PerfilPreviaEditor>(PERFIL_PREVIA_EDITOR_PADRAO);
  const [qualidadeIa, setQualidadeIa] = useState<QualidadeImagemIa>(CONFIGURACAO_IMAGEM_IA_PADRAO.qualidade);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<'editor' | 'ia' | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [falhas, setFalhas] = useState<{ editor: boolean; ia: boolean }>({ editor: false, ia: false });

  useEffect(() => {
    let ativo = true;
    void Promise.all([
      window.ipcAPI.configuracao.obter('perfil_previa_editor'),
      window.ipcAPI.configuracao.obter('qualidade_imagem_ia'),
    ]).then(([respostaEditor, respostaIa]) => {
      if (!ativo) return;
      let falhaIa = !respostaIa.success;
      if (perfilPreviaEditorValido(respostaEditor.data)) setPerfil(respostaEditor.data);
      if (typeof respostaIa.data === 'string') {
        try {
          const configuracao: unknown = JSON.parse(respostaIa.data);
          if (configuracaoImagemIaValida(configuracao)) setQualidadeIa(configuracao.qualidade);
          else falhaIa = true;
        } catch { falhaIa = true; }
      }
      setFalhas({ editor: !respostaEditor.success, ia: falhaIa });
      if (!respostaEditor.success || falhaIa) setMensagem('Não foi possível carregar todas as preferências de imagens.');
    }).catch(error => {
      if (ativo) setMensagem(error instanceof Error ? error.message : 'Não foi possível ler as preferências.');
    }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const salvar = async (grupo: 'editor' | 'ia') => {
    if (falhas[grupo]) return;
    setSalvando(grupo);
    setMensagem(null);
    try {
      const resposta = grupo === 'editor'
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6">
      <div className="flex items-center gap-3"><Image className="h-6 w-6 text-primary" /><h1 className="text-2xl font-semibold">Imagens</h1></div>
      {mensagem && <p role="status" className="text-sm text-muted-foreground">{mensagem}</p>}
      <Card>
        <CardHeader><CardTitle>Prévia no editor</CardTitle><CardDescription>O arquivo original permanece local para recorte e impressão. Toda nova figura usa uma prévia proporcional ao espaço ocupado no laudo.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div role="radiogroup" aria-label="Perfil da prévia no editor" className="grid gap-3 md:grid-cols-3">
            {perfis.map(opcao => <button key={opcao.valor} type="button" role="radio" aria-checked={perfil === opcao.valor}
              disabled={carregando || salvando !== null || falhas.editor} onClick={() => setPerfil(opcao.valor)}
              className={`rounded-lg border p-4 text-left ${perfil === opcao.valor ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <span className="block font-medium">{opcao.rotulo}</span><span className="text-sm text-muted-foreground">{opcao.descricao}</span>
            </button>)}
          </div>
          <p className="text-xs text-muted-foreground">Limite atual: {LIMITES_PREVIA_EDITOR[perfil].minimo}–{LIMITES_PREVIA_EDITOR[perfil].maximo} px no maior lado. Imagens pequenas não são ampliadas.</p>
          <Button disabled={carregando || salvando !== null || falhas.editor} onClick={() => void salvar('editor')}>Salvar prévia do editor</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Imagem enviada para descrição por IA</CardTitle><CardDescription>Este ajuste controla apenas a cópia enviada ao modelo de IA. Não altera o editor nem o arquivo usado na impressão.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div role="radiogroup" aria-label="Qualidade da imagem enviada para descrição" className="grid gap-3 md:grid-cols-4">
            {qualidadesIa.map(opcao => <button key={opcao.valor} type="button" role="radio" aria-checked={qualidadeIa === opcao.valor}
              disabled={carregando || salvando !== null || falhas.ia} onClick={() => setQualidadeIa(opcao.valor)}
              className={`rounded-lg border p-4 text-left ${qualidadeIa === opcao.valor ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <span className="block font-medium">{opcao.rotulo}</span><span className="text-sm text-muted-foreground">{opcao.descricao}</span>
            </button>)}
          </div>
          <Button disabled={carregando || salvando !== null || falhas.ia} onClick={() => void salvar('ia')}>Salvar qualidade para IA</Button>
        </CardContent>
      </Card>
    </div>
  );
}
