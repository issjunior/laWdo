import React, { useRef, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';

interface TinyMceEditorProps {
  value: string;
  onChange: (html: string) => void;
  height?: number;
  placeholder?: string;
  /** ID do laudo para upload de imagens. Se ausente, usa base64 (templates/cabeçalho). */
  laudoId?: string;
  /** ID único para a instância do editor (necessário com múltiplos editores na mesma página) */
  editorId?: string;
  /** Callback disparado quando uma imagem é inserida via botão de imagem do editor */
  onImageInserted?: () => void;
  /** Tema do editor: 'light' (padrão), 'dark' ou 'auto' (segue preferência do sistema) */
  theme?: 'light' | 'dark' | 'auto';
}

export const TinyMceEditor: React.FC<TinyMceEditorProps> = ({
  value,
  onChange,
  height = 300,
  placeholder,
  laudoId,
  editorId,
  onImageInserted,
  theme = 'light',
}) => {
  const editorRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const resolveTheme = () => {
    if (theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };
  const resolved = resolveTheme();

  return (
    <div className={ready ? '' : 'opacity-0'}>
      <Editor
        key={resolved}
        id={editorId}
        tinymceScriptSrc="./tinymce/tinymce.min.js"
        onInit={(_evt, editor) => {
          editorRef.current = editor;
          setReady(true);
        }}
        value={value}
        onEditorChange={(html: string) => onChange(html)}
        init={{
          license_key: 'gpl',
          height,
          menubar: false,
          placeholder,
          promotion: false,
          branding: false,
          statusbar: true,
          resize: 'vertical',
          contextmenu: false,
          skin_url: resolved === 'dark' ? './tinymce/skins/ui/oxide-dark' : './tinymce/skins/ui/oxide',
          content_css: resolved === 'dark' ? './tinymce/skins/content/dark/content.css' : './tinymce/skins/content/default/content.css',
          icons_url: './tinymce/icons/default/icons.min.js',
          toolbar_mode: 'wrap',
          image_advtab: true,
          image_title: true,
          relative_urls: false,
          remove_script_host: false,
          convert_urls: false,
          plugins: [
            'anchor',
            'autolink',
            'charmap',
            'codesample',
            'emoticons',
            'image',
            'link',
            'lists',
            'media',
            'searchreplace',
            'table',
            'visualblocks',
            'wordcount',
            'code',
            'fullscreen',
            'preview',
            'nonbreaking',
            'visualchars',
            'insertdatetime',
            'pagebreak',
            'help',
          ],
          toolbar:
            'undo redo | ' +
            'styles fontsize fontfamily | ' +
            'bold italic underline strikethrough | ' +
            'forecolor backcolor | ' +
            'alignleft aligncenter alignright alignjustify | ' +
            'bullist numlist outdent indent | ' +
            'blockquote hr table | ' +
            'link image media | ' +
            'searchreplace | ' +
            'fullscreen preview | ' +
            'removeformat code | ' +
            'help',
          content_style: `
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              padding: 12px;
            }
            .placeholder-tag {
              background-color: #e8f0fe;
              color: #1a73e8;
              border-radius: 4px;
              padding: 2px 6px;
              font-weight: 500;
              user-select: all;
              cursor: default;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            [data-laudo-secao] {
              border-color: rgba(128,128,128,0.2) !important;
            }
            [data-laudo-secao-header] {
              background: rgba(128,128,128,0.08) !important;
              border-bottom-color: rgba(128,128,128,0.2) !important;
              color: inherit !important;
            }
          `,

          // ─── Upload de imagens ───────────────────────────
          file_picker_callback: (_callback: any, _value: any, meta: any) => {
            if (meta.filetype === 'image') {
              const id = crypto.randomUUID();
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = () => {
                const file = input.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUri = reader.result as string;
                  const editor = (window as any).tinymce.get(editorId);
                  if (editor) {
                    const html = `
                      <figure class="laudo-figure" data-image-id="${id}" style="text-align: center; margin: 12px auto; max-width: 100%;">
                        <img src="${dataUri}" alt="" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; padding: 4px;" />
                        <figcaption style="font-size: 13px; color: #666; font-weight: bold; margin-top: 4px;"></figcaption>
                      </figure>
                      <br>`;
                    editor.insertContent(html);
                    editor.execCommand('reindexFiguras');
                    onImageInserted?.();
                  }
                };
                reader.readAsDataURL(file);
              };
              input.click();
            }
          },

          // ─── Placeholder personalizado e Proxy de ContextMenu ─────
          setup: (editor: any) => {
            editor.addCommand('insertPlaceholder', (_ui: any, placeholder: { chave: string }) => {
              const html = `<span class="placeholder-tag" contenteditable="false" data-placeholder="{{${placeholder.chave}}}">{{${placeholder.chave}}}</span>`;
              editor.insertContent(html);
            });

            editor.addCommand('insertLaudoImage', (_ui: any, data: { url: string, id: string, legenda: string, skipReindex?: boolean }) => {
              const html = `
                <figure class="laudo-figure" data-image-id="${data.id}" style="text-align: center; margin: 12px auto; max-width: 100%;">
                  <img src="${data.url}" alt="${data.legenda}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; padding: 4px;" />
                  <figcaption style="font-size: 13px; color: #666; font-weight: bold; margin-top: 4px;">${data.legenda}</figcaption>
                </figure>
                <br>`;
              editor.insertContent(html);
              if (!data.skipReindex) {
                editor.execCommand('reindexFiguras');
              }
            });

            editor.addCommand('reindexFiguras', () => {
              const body = editor.getBody();
              const figures = body.querySelectorAll('.laudo-figure');
              figures.forEach((figure: Element, index: number) => {
                const num = index + 1;
                const numFormatado = num.toString().padStart(2, '0');
                const figcaption = figure.querySelector('figcaption');
                const img = figure.querySelector('img');
                if (figcaption) {
                  const legendaAtual = figcaption.textContent || '';
                  const textoLimpo = legendaAtual.replace(/^Fig(?:ura|\.)\s*\d+[:\s]*\s*/i, '');
                  figcaption.textContent = textoLimpo ? `Figura ${numFormatado}: ${textoLimpo}` : `Figura ${numFormatado}`;
                  if (img) {
                    (img as HTMLImageElement).alt = figcaption.textContent;
                  }
                }
              });
              editor.undoManager.add();
            });

            editor.addCommand('removeLaudoImage', (_ui: any, data: { id: string }) => {
              const body = editor.getBody();
              const figure = body.querySelector(`.laudo-figure[data-image-id="${data.id}"]`);
              if (figure) {
                const nextSibling = figure.nextElementSibling;
                figure.remove();
                // Remove o <br> ou <p>&nbsp;</p> que segue a figura
                if (nextSibling && (nextSibling.tagName === 'BR' || (nextSibling.tagName === 'P' && (nextSibling as HTMLElement).innerHTML === '&nbsp;'))) {
                  nextSibling.remove();
                }
              }
              editor.execCommand('reindexFiguras');
            });

            // Repassar evento de clique direito para o componente pai (Shadcn ContextMenu)
            editor.on('contextmenu', (e: any) => {
              const container = editor.getContainer();
              const rect = container.getBoundingClientRect();
              
              // Criar evento de clique direito simulado no documento pai
              const newEvent = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: e.clientX + rect.left,
                clientY: e.clientY + rect.top,
              });
              
              // Disparar no container para que o ContextMenuTrigger capture
              container.dispatchEvent(newEvent);
            });
          },
        }}
      />
    </div>
  );
};
