import React, { useRef, useState, useEffect } from 'react';
import { Editor } from '@tinymce/tinymce-react';

/* ─── Funções utilitárias para figuras (modularizadas / DRY) ─── */

/** Markup interno da figura (sem <br> ao final) — usado para criar elementos DOM */
function buildFigureInnerHtml(url: string, id: string, legenda: string): string {
  return (
    `<figure class="laudo-figure" data-image-id="${id}" style="text-align: center; margin: 12px auto; max-width: 100%;">` +
    `<img src="${url}" alt="${legenda}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; padding: 4px;" />` +
    `<figcaption style="font-size: 13px; color: #666; font-weight: bold; margin-top: 4px;">Figura XX${legenda ? ': ' + legenda : ''}</figcaption>` +
    `</figure>`
  );
}

/** Markup completo da figura com <br> ao final — ideal para insertContent */
function buildFigureHtml(url: string, id: string, legenda: string): string {
  return buildFigureInnerHtml(url, id, legenda) + '<br>';
}

/** Converte um <img> órfão em um elemento <figure class="laudo-figure"> com id e figcaption */
function wrapImgAsFigure(img: HTMLImageElement): HTMLElement {
  const id = crypto.randomUUID();
  const template = document.createElement('template');
  template.innerHTML = buildFigureInnerHtml(img.src, id, img.alt || '').trim();
  return template.content.firstElementChild as HTMLElement;
}

/**
 * Varre um nó-fragmento e converte <img>s órfãos (fora de .laudo-figure)
 * em figuras estruturadas. Retorna quantos foram convertidos.
 */
function processarImagensPuras(raiz: Node): number {
  let count = 0;
  if (!(raiz instanceof Element) && !(raiz instanceof DocumentFragment)) return count;

  const imagens = Array.from(
    (raiz as Element).querySelectorAll?.('img') ?? []
  );

  for (const img of imagens) {
    const htmlImg = img as HTMLImageElement;
    if (htmlImg.closest('.laudo-figure')) continue;
    if (!htmlImg.src || (!htmlImg.src.startsWith('data:') && !htmlImg.src.startsWith('http') && !htmlImg.src.startsWith('blob:'))) continue;

    const figure = wrapImgAsFigure(htmlImg);
    htmlImg.parentNode?.replaceChild(figure, htmlImg);
    count++;
  }

  return count;
}

/** Varre o body do editor e converte todos os <img>s órfãos em figuras laudo-figure */
function scanEditorForRawImages(editor: any): number {
  const body = editor.getBody();
  if (!body) return 0;

  const rawImages = Array.from(body.querySelectorAll('img')).filter(
    (img: any) =>
      !img.closest('.laudo-figure') &&
      (img.src?.startsWith('data:') || img.src?.startsWith('http') || img.src?.startsWith('blob:'))
  ) as HTMLImageElement[];

  if (rawImages.length === 0) return 0;

  editor.undoManager.transact(() => {
    for (const img of rawImages) {
      const figure = wrapImgAsFigure(img);
      img.parentNode?.replaceChild(figure, img);
    }
  });

  return rawImages.length;
}

interface TinyMceEditorProps {
  /** Modo controlado: conteúdo sincronizado com estado React. Pode causar salto de cursor com HTML complexo. Use initialValue para evitar. */
  value?: string;
  /** Modo NÃO controlado: conteúdo inicial fixo, sem sincronização automática. Ideal para editores com HTML complexo (ex: seções). */
  initialValue?: string;
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
  /** Lista de chaves de placeholder válidas para auto-conversão ao digitar {{chave}} */
  placeholderChaves?: string[];
  /** Callback disparado quando o editor termina de inicializar */
  onEditorInit?: (editor: any) => void;
}

export const TinyMceEditor: React.FC<TinyMceEditorProps & React.HTMLAttributes<HTMLDivElement>> = ({
  value,
  initialValue,
  onChange,
  height = 300,
  placeholder,
  laudoId,
  editorId,
  onImageInserted,
  theme = 'light',
  placeholderChaves,
  onEditorInit,
  ...rest
}) => {
  const editorRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const [stableInitialValue] = useState(initialValue);
  const isUncontrolled = initialValue !== undefined;

  const resolveTheme = () => {
    if (theme === 'auto') {
      return document.body.classList.contains('dark') ? 'dark' : 'light';
    }
    return theme;
  };
  const resolved = resolveTheme();

  useEffect(() => {
    if (editorRef.current && placeholderChaves) {
      (editorRef.current as any)._placeholderChaves = new Set(placeholderChaves);
    }
  }, [placeholderChaves]);

  return (
    <div className={ready ? '' : 'opacity-0'} {...rest}>
      <Editor
        key={resolved}
        id={editorId}
        tinymceScriptSrc="./tinymce/tinymce.min.js"
        onInit={(_evt, editor) => {
          editorRef.current = editor;
          setReady(true);
          onEditorInit?.(editor);
        }}
        {...(isUncontrolled
          ? { initialValue: stableInitialValue }
          : { value: value || '' }
        )}
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
          line_height_formats: '1 1.1 1.2 1.3 1.4 1.5 2',
          image_advtab: true,
          image_title: true,

          // ─── Upload de imagens (converte blob→dataURI na origem) ──
          images_upload_handler: (blobInfo: any) =>
            new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blobInfo.blob());
            }),

          paste_data_images: true,

          // ─── Pós-processamento de conteúdo colado ──────────
          paste_postprocess: (_editor: any, args: any) => {
            const fragment = args.node;
            if (!fragment) return;
            const convertidas = processarImagensPuras(fragment);
            if (convertidas > 0) {
              onImageInserted?.();
            }
          },
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
            'paste',
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
            'bold italic underline strikethrough | forecolor backcolor removeformat | ' +
            'fontfamily fontsize lineheight styles | subscript superscript | ' +
            'charmap | link image table | blockquote hr | ' +
            'alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | ' +
            'searchreplace visualblocks nonbreaking code | fullscreen preview | ' +
            'help',
          content_style: `
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              padding: 12px;
            }
            .placeholder-tag {
              background-color: ${resolved === 'dark' ? 'rgba(138,180,248,0.15)' : '#e8f0fe'};
              color: ${resolved === 'dark' ? '#8ab4f8' : '#1a73e8'};
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
                    editor.insertContent(buildFigureHtml(dataUri, id, ''));
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
              const html = `<span contenteditable="false" class="placeholder-tag" data-placeholder="{{${placeholder.chave}}}">{{${placeholder.chave}}}</span>`;
              editor.insertContent(html);
            });

            editor.addCommand('insertLaudoImage', (_ui: any, data: { url: string, id: string, legenda: string }) => {
              editor.insertContent(buildFigureHtml(data.url, data.id, data.legenda));
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
                  const textoLimpo = legendaAtual.replace(/^Fig(?:ura|\.)\s*(?:\d+|XX)[:\s]*\s*/i, '');
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
                if (nextSibling && (nextSibling.tagName === 'BR' || (nextSibling.tagName === 'P' && (nextSibling as HTMLElement).innerHTML === '&nbsp;'))) {
                  nextSibling.remove();
                }
              }
            });

            editor.addCommand('replaceLaudoImage', (_ui: any, data: { imageId?: string; figureElement?: HTMLElement; newUrl: string }) => {
              const body = editor.getBody();
              let figure: HTMLElement | null = null;
              if (data.figureElement) {
                figure = data.figureElement;
              } else if (data.imageId) {
                figure = body.querySelector(`.laudo-figure[data-image-id="${data.imageId}"]`);
              }
              if (!figure) return;
              const img = figure.querySelector('img');
              if (img) {
                (img as HTMLImageElement).src = data.newUrl;
              }
              figure.removeAttribute('data-dummy');
              figure.style.cursor = '';
            });

            editor.addCommand('insertLaudoImageDummy', () => {
              const id = crypto.randomUUID();
              const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400' width='100%' height='auto'><rect width='600' height='400' fill='%233a3a3a' rx='8'/><rect x='235' y='115' width='130' height='100' rx='8' fill='none' stroke='%23888' stroke-width='2.5'/><circle cx='265' cy='145' r='11' fill='none' stroke='%23888' stroke-width='2.5'/><polyline points='235,195 275,162 325,195' fill='none' stroke='%23888' stroke-width='2.5'/><text x='300' y='260' text-anchor='middle' fill='%23aaa' font-size='20' font-family='sans-serif' font-weight='500'>INSERIR IMAGEM</text><text x='300' y='290' text-anchor='middle' fill='%23777' font-size='13' font-family='sans-serif'>Clique para substituir</text></svg>`;
              const src = `data:image/svg+xml;base64,${btoa(svg)}`;
              const html = `<figure class="laudo-figure" data-image-id="${id}" data-dummy="true" style="text-align:center;margin:12px auto;max-width:100%;cursor:pointer"><img src="${src}" alt="Figura XX" style="max-width:100%;height:auto;border:1px solid #444;border-radius:4px;padding:4px"/><figcaption style="font-size:13px;color:#666;font-weight:bold;margin-top:4px">Figura XX</figcaption></figure><br>`;
              editor.insertContent(html);
            });

            editor.addCommand('scanAndWrapImages', () => {
              const count = scanEditorForRawImages(editor);
              editor.execCommand('reindexFiguras');
              return count;
            });

            // Repassar evento de clique direito para o componente pai (Shadcn ContextMenu)
            // Usamos init + listener nativo porque contextmenu:false desabilita o plugin
            // e o editor event 'contextmenu' nunca dispara.
            editor.on('init', () => {
              const doc = editor.getDoc();
              if (!doc) return;

              doc.addEventListener('contextmenu', (e: MouseEvent) => {
                e.preventDefault();

                const container = editor.getContainer();
                const iframe = editor.iframeElement as HTMLIFrameElement | null;
                const iframeRect = iframe?.getBoundingClientRect() ?? container.getBoundingClientRect();

                const newEvent = new MouseEvent('contextmenu', {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  clientX: e.clientX + iframeRect.left,
                  clientY: e.clientY + iframeRect.top,
                });

                container.dispatchEvent(newEvent);
              });

              doc.addEventListener('click', (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                if (target.tagName === 'IMG') {
                  const figure = target.closest('.laudo-figure[data-dummy="true"]');
                  if (figure) {
                    e.preventDefault();
                    e.stopPropagation();
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const dataUri = reader.result as string;
                        editor.execCommand('replaceLaudoImage', false, {
                          figureElement: figure as HTMLElement,
                          newUrl: dataUri,
                        });
                        onChange(editor.getContent());
                      };
                      reader.readAsDataURL(file);
                    };
                    input.click();
                  }
                }
              });

              // ─── Observer para imagens arrastadas/soltadas ─────
              const body = editor.getBody();
              if (body) {
                let processando = false;

                const figuraObserver = new MutationObserver((mutations) => {
                  if (processando) return;

                  const rawImages: HTMLImageElement[] = [];
                  for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                      if (node.nodeType !== 1) continue;
                      const el = node as Element;

                      if (el.tagName === 'IMG' && !el.closest('.laudo-figure')) {
                        const src = (el as HTMLImageElement).src;
                        if (src && (src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:'))) {
                          rawImages.push(el as HTMLImageElement);
                        }
                      }

                      el.querySelectorAll('img').forEach(nestedImg => {
                        if (!nestedImg.closest('.laudo-figure')) {
                          const src = (nestedImg as HTMLImageElement).src;
                          if (src && (src.startsWith('data:') || src.startsWith('http') || src.startsWith('blob:'))) {
                            rawImages.push(nestedImg as HTMLImageElement);
                          }
                        }
                      });
                    }
                  }

                  if (rawImages.length === 0) return;

                  processando = true;
                  figuraObserver.disconnect();

                  editor.undoManager.transact(() => {
                    for (const img of rawImages) {
                      const figure = wrapImgAsFigure(img);
                      img.parentNode?.replaceChild(figure, img);
                    }
                  });

                  onChange(editor.getContent());

                  figuraObserver.observe(body, { childList: true, subtree: true });
                  processando = false;
                  onImageInserted?.();
                });

                figuraObserver.observe(body, { childList: true, subtree: true });

                editor.on('remove', () => figuraObserver.disconnect());
              }
            });

            // ─── Auto-converter {{chave}} digitado manualmente em span estilizado ─────
            if (placeholderChaves && placeholderChaves.length > 0) {
              (editor as any)._placeholderChaves = new Set(placeholderChaves);

              let placeholderTimer: ReturnType<typeof setTimeout> | null = null;

              const converterPlaceholderLocal = () => {
                const chavesSet: Set<string> = (editor as any)._placeholderChaves;
                if (!chavesSet || chavesSet.size === 0) return;

                const rng = editor.selection.getRng();
                if (!rng || !rng.startContainer) return;

                const textNode = rng.startContainer;
                if (textNode.nodeType !== 3) return;

                const parent = textNode.parentElement;
                if (parent?.classList?.contains('placeholder-tag')) return;
                if (parent?.getAttribute?.('data-placeholder')) return;

                const text = textNode.textContent || '';
                const regex = /\{\{([^{}]+)\}\}/g;
                const substituicoes: { pos: number; fim: number; chave: string }[] = [];
                let match: RegExpExecArray | null;

                while ((match = regex.exec(text)) !== null) {
                  if (chavesSet.has(match[1])) {
                    substituicoes.push({ pos: match.index, fim: match.index + match[0].length, chave: match[1] });
                  }
                }

                if (substituicoes.length === 0) return;

                const bookmark = editor.selection.getBookmark(2, true);

                const fragment = document.createDocumentFragment();
                let cursor = 0;
                for (const s of substituicoes) {
                  if (s.pos > cursor) {
                    fragment.appendChild(document.createTextNode(text.substring(cursor, s.pos)));
                  }
                  const span = document.createElement('span');
                  span.className = 'placeholder-tag';
                  span.setAttribute('contenteditable', 'false');
                  span.setAttribute('data-placeholder', `{{${s.chave}}}`);
                  span.textContent = `{{${s.chave}}}`;
                  fragment.appendChild(span);
                  cursor = s.fim;
                }
                if (cursor < text.length) {
                  fragment.appendChild(document.createTextNode(text.substring(cursor)));
                }

                textNode.parentNode?.replaceChild(fragment, textNode);

                editor.selection.moveToBookmark(bookmark);
              };

              editor.on('input', () => {
                if (placeholderTimer) clearTimeout(placeholderTimer);
                placeholderTimer = setTimeout(converterPlaceholderLocal, 600);
              });

              editor.on('remove', () => {
                if (placeholderTimer) clearTimeout(placeholderTimer);
              });
            }
          },
        }}
      />
    </div>
  );
};
