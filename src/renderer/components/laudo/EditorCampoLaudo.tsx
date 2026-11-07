import { useId, useRef, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { MenuCorretorEditor } from '@/components/editor/MenuCorretorEditor';
import { registrarCorretorEditor } from '@/lib/corretor-editor';
import { ESTILO_TIPOGRAFIA_EDITOR_LAUDO } from '@/lib/tipografia-editor-laudo';
import { MEDIDAS_RECUO_PRIMEIRA_LINHA } from '@/lib/recuo-editor-laudo';

interface EditorCampoLaudoProps {
  valor: string;
  onChange: (html: string) => void;
  elementoOrigem?: HTMLElement;
  onRecuoChange?: (recuo: string) => void;
}

function obterTipografiaCampo(elemento?: HTMLElement): string {
  const tipografia = document.createElement('span').style;
  tipografia.cssText = ESTILO_TIPOGRAFIA_EDITOR_LAUDO;
  const estilo = elemento?.ownerDocument.defaultView?.getComputedStyle(elemento);
  if (estilo?.fontFamily) tipografia.fontFamily = estilo.fontFamily;
  if (estilo?.fontSize) tipografia.fontSize = estilo.fontSize;
  if (estilo?.lineHeight && estilo.lineHeight !== 'normal') tipografia.lineHeight = estilo.lineHeight;
  const paragrafo = elemento?.closest('p');
  if (paragrafo) tipografia.textIndent = paragrafo.ownerDocument.defaultView?.getComputedStyle(paragrafo).textIndent || '0pt';
  return tipografia.cssText;
}

export function EditorCampoLaudo({ valor, onChange, elementoOrigem, onRecuoChange }: EditorCampoLaudoProps) {
  const identificador = useId();
  const editorId = `campo-laudo-${identificador}`;
  const valorInicial = useRef(valor);
  const [tipografiaInicial] = useState(() => obterTipografiaCampo(elementoOrigem));
  const [falhaCarregamento, setFalhaCarregamento] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  if (falhaCarregamento) return <div className="space-y-3 rounded-md border border-destructive/40 p-4" role="alert">
    <p className="text-sm text-destructive">Não foi possível carregar o editor deste campo. O conteúdo não foi alterado.</p>
    <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" onClick={() => { setFalhaCarregamento(false); setTentativa(atual => atual + 1); }}>Tentar novamente</button>
  </div>;
  return <MenuCorretorEditor editorId={editorId}><div><Editor
    key={tentativa}
    id={editorId}
    licenseKey="gpl"
    tinymceScriptSrc="./tinymce/tinymce.min.js"
    onScriptsLoadError={() => setFalhaCarregamento(true)}
    initialValue={valorInicial.current}
    onEditorChange={onChange}
    init={{
      menubar: false,
      statusbar: false,
      browser_spellcheck: true,
      contextmenu: false,
      ui_mode: 'split',
      height: 320,
      toolbar: 'undo redo | bold italic underline superscript subscript | recuoprimeiralinha | removeformat',
      setup: editor => {
        editor.on('init', () => registrarCorretorEditor(editor, evento => {
          const recipiente = editor.getContainer();
          const retangulo = editor.iframeElement?.getBoundingClientRect() ?? recipiente.getBoundingClientRect();
          recipiente.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: evento.clientX + retangulo.left,
            clientY: evento.clientY + retangulo.top,
          }));
        }));
        editor.ui.registry.addMenuButton('recuoprimeiralinha', {
          text: 'Parágrafo',
          tooltip: 'Recuo da primeira linha do parágrafo',
          onSetup: api => { api.setEnabled(Boolean(elementoOrigem?.closest('p') && onRecuoChange)); return () => {}; },
          fetch: callback => callback(MEDIDAS_RECUO_PRIMEIRA_LINHA.map(({ texto, valor }) => ({
            type: 'menuitem' as const,
            text: texto,
            onAction: () => {
              editor.dom.setStyle(editor.getBody(), 'text-indent', valor || '0pt');
              onRecuoChange?.(valor || '0pt');
            },
          }))),
        });
      },
      plugins: [],
      newline_behavior: 'linebreak',
      valid_elements: 'strong/b,em/i,u,sup,sub,br',
      paste_data_images: false,
      skin_url: './tinymce/skins/ui/oxide',
      content_css: './tinymce/skins/content/default/content.css',
      language: 'pt_BR',
      language_url: './tinymce/langs/pt_BR.js',
      content_style: `body { ${tipografiaInicial} text-align: justify; padding: 12px; }`,
    }}
  /></div></MenuCorretorEditor>;
}
