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
}

export const TinyMceEditor: React.FC<TinyMceEditorProps> = ({
  value,
  onChange,
  height = 300,
  placeholder,
  laudoId,
  editorId,
}) => {
  const editorRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  return (
    <div className={ready ? '' : 'opacity-0'}>
      <Editor
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
          skin_url: './tinymce/skins/ui/oxide',
          content_css: './tinymce/skins/content/default/content.css',
          icons_url: './tinymce/icons/default/icons.min.js',
          toolbar_mode: 'wrap',
          image_advtab: true,
          image_title: true,
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
            'undo redo | blocks fontsize fontfamily forecolor backcolor | ' +
            'bold italic underline strikethrough subscript superscript | ' +
            'alignleft aligncenter alignright alignjustify | ' +
            'bullist numlist outdent indent | ' +
            'blockquote hr table link image | ' +
            'fullscreen preview | removeformat code help',
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
          `,

          // ─── Upload de imagens ───────────────────────────
          // Se laudoId existe, usa diálogo nativo + protocolo customizado.
          // Caso contrário (templates, cabeçalho), fallback para base64 padrão.
          ...(laudoId
            ? {
                file_picker_callback: (callback: any, _value: any, meta: any) => {
                  if (meta.filetype === 'image') {
                    window.ipcAPI.imagem
                      .pickAndUpload(laudoId)
                      .then(r => {
                        if (r.success && r.data) {
                          callback(r.data.url, { title: r.data.legenda, alt: r.data.legenda });
                        }
                      })
                      .catch(() => {
                        // Silencioso: usuário cancelou ou erro
                      });
                  }
                },
                automatic_uploads: true,
              }
            : {}),

          // ─── Placeholder personalizado e Proxy de ContextMenu ─────
          setup: (editor: any) => {
            editor.addCommand('insertPlaceholder', (_ui: any, placeholder: { chave: string }) => {
              const html = `<span class="placeholder-tag" contenteditable="false" data-placeholder="{{${placeholder.chave}}}">{{${placeholder.chave}}}</span>`;
              editor.insertContent(html);
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
