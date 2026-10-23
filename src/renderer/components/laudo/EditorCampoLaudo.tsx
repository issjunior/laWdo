import { useRef, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';
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
  const valorInicial = useRef(valor);
  const [tipografiaInicial] = useState(() => obterTipografiaCampo(elementoOrigem));
  return <Editor
    licenseKey="gpl"
    tinymceScriptSrc="./tinymce/tinymce.min.js"
    initialValue={valorInicial.current}
    onEditorChange={onChange}
    init={{
      menubar: false,
      statusbar: false,
      ui_mode: 'split',
      height: 320,
      toolbar: 'undo redo | bold italic underline superscript subscript | recuoprimeiralinha | removeformat',
      setup: editor => {
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
      forced_root_block: '',
      valid_elements: 'strong/b,em/i,u,sup,sub,br',
      paste_data_images: false,
      skin_url: './tinymce/skins/ui/oxide',
      content_css: './tinymce/skins/content/default/content.css',
      language: 'pt_BR',
      language_url: './tinymce/langs/pt_BR.js',
      content_style: `body { ${tipografiaInicial} text-align: justify; padding: 12px; }`,
    }}
  />;
}
