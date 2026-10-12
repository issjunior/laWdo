import { useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';

interface EditorCampoLaudoProps {
  valor: string;
  onChange: (html: string) => void;
}

export function EditorCampoLaudo({ valor, onChange }: EditorCampoLaudoProps) {
  const valorInicial = useRef(valor);
  return <Editor
    licenseKey="gpl"
    tinymceScriptSrc="./tinymce/tinymce.min.js"
    initialValue={valorInicial.current}
    onEditorChange={onChange}
    init={{
      menubar: false,
      statusbar: false,
      height: 220,
      toolbar: 'undo redo | bold italic underline superscript subscript | removeformat',
      plugins: [],
      newline_behavior: 'linebreak',
      forced_root_block: '',
      valid_elements: 'strong/b,em/i,u,sup,sub,br',
      paste_data_images: false,
      skin_url: './tinymce/skins/ui/oxide',
      content_css: './tinymce/skins/content/default/content.css',
      language: 'pt_BR',
      language_url: './tinymce/langs/pt_BR.js',
      content_style: 'body { text-align: justify; }',
    }}
  />;
}
