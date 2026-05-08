import React, { useRef, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';

interface TinyMceEditorProps {
  value: string;
  onChange: (html: string) => void;
  height?: number;
  placeholder?: string;
}

export const TinyMceEditor: React.FC<TinyMceEditorProps> = ({
  value,
  onChange,
  height = 300,
  placeholder,
}) => {
  const editorRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  return (
    <div className={ready ? '' : 'opacity-0'}>
      <Editor
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
          skin_url: './tinymce/skins/ui/oxide',
          content_css: './tinymce/skins/content/default/content.css',
          icons_url: './tinymce/icons/default/icons.min.js',
          plugins: [
            'anchor', 'autolink', 'charmap', 'codesample', 'emoticons', 'image',
            'link', 'lists', 'media', 'searchreplace', 'table', 'visualblocks',
            'wordcount', 'code',
          ],
          toolbar:
            'undo redo | blocks | ' +
            'bold italic underline strikethrough | ' +
            'forecolor backcolor | ' +
            'alignleft aligncenter alignright alignjustify | ' +
            'bullist numlist outdent indent | ' +
            'table link image | ' +
            'removeformat | code',
          content_style: `
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              padding: 12px;
            }
            .placeholder-tag {
              background: #e8f0fe;
              color: #1a73e8;
              padding: 1px 4px;
              border-radius: 3px;
              font-family: monospace;
              font-size: 13px;
            }
          `,
          promotion: false,
          branding: false,
          statusbar: false,
          // Placeholder insertion via custom setup
          setup: (editor) => {
            editor.addCommand('insertPlaceholder', (tag: string) => {
              editor.insertContent(
                `<span class="placeholder-tag" contenteditable="false" data-placeholder="${tag}">{{${tag}}}</span>&nbsp;`
              );
            });
          },
        }}
      />
    </div>
  );
};
