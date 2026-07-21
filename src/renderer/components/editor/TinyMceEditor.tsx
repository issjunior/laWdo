import React, { useRef, useState, useEffect } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import type { Editor as TinyMceEditorInstance, RawEditorOptions, Ui } from 'tinymce';
import { placeholderChaveEhValida } from '@/lib/utils';

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
function scanEditorForRawImages(editor: TinyMceEditorInstance): number {
  const body = editor.getBody();
  if (!body) return 0;

  const rawImages = Array.from(body.querySelectorAll('img')).filter(
    (img) =>
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

// ─── Injeção dinâmica de skin dark para o chrome do editor ───
function ensureDarkSkin() {
  if (document.getElementById('tinymce-dark-skin')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './tinymce/skins/ui/oxide-dark/skin.css';
  link.id = 'tinymce-dark-skin';
  document.head.appendChild(link);
}

function removeDarkSkin() {
  document.getElementById('tinymce-dark-skin')?.remove();
}

function aplicarTemaEditor(editor: TinyMceEditorInstance, dark: boolean) {
  const body = editor.getBody();
  if (!body) return;
  if (dark) {
    ensureDarkSkin();
    editor.dom.addClass(body, 'dark-content');
  } else {
    removeDarkSkin();
    editor.dom.removeClass(body, 'dark-content');
  }
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
  /** Lista de chaves de placeholder válidas para auto-conversão ao digitar {{chave}} */
  placeholderChaves?: string[];
  /** Callback disparado quando o editor termina de inicializar */
  onEditorInit?: (editor: TinyMceEditorInstance) => void;
  /** Solicita a substituição de uma figura dummy pelo fluxo de ilustrações do laudo. */
  onDummyFigureClick?: (imageId: string) => void;
  /** Auto-converter "XXX" digitado em span campo-reservado (apenas templates) */
  autoConverterReservados?: boolean;
  /** Toggles condicionais para o botão "Bloco Condicional" na toolbar (ex: B-602) */
  condToggles?: Array<{ id: string; label: string; subtitulo?: string; subToggles?: Array<{ id: string; label: string; subtitulo?: string }> }>;
}

type ToggleCondicionalFlat = { id: string; label: string; subtitulo?: string };
type UploadImagemHandler = NonNullable<RawEditorOptions['images_upload_handler']>;
type PastePostprocessHandler = NonNullable<RawEditorOptions['paste_postprocess']>;
type FilePickerHandler = NonNullable<RawEditorOptions['file_picker_callback']>;
type TinymceWindow = Window & {
  tinymce?: {
    get: (id?: string) => TinyMceEditorInstance | null;
  };
};
type ComandoTinyMce<T> = (_ui: boolean, data: T) => void;

interface PlaceholderPayload {
  chave: string;
}

interface ImagemLaudoPayload {
  url: string;
  id: string;
  legenda: string;
}

interface RemoverImagemPayload {
  id: string;
}

interface SubstituirImagemPayload {
  imageId?: string;
  newImageId?: string;
  figureElement?: HTMLElement;
  newUrl: string;
}

const BLOCOS_CONDICIONAIS_B602_POR_ARMA = [
  { id: 'b602_arma_N_func_toggle', label: 'Arma (N) - Funcionamento e Eficiência', subtitulo: 'FUNCIONAMENTO E EFICIÊNCIA' },
  { id: 'b602_arma_N_coleta_toggle', label: 'Arma (N) - Coleta de Padrões Balísticos', subtitulo: 'COLETA DE PADRÕES BALÍSTICOS' },
];

const BADGE_BLOCO_CONDICIONAL = 'Bloco condicional';

const RESUMOS_FIXOS_BLOCO_CONDICIONAL: Record<string, string> = {
  b602_armas_toggle: 'Mostra quando: houver armas na REP',
  b602_cartuchos_toggle: 'Mostra quando: houver cartuchos na REP',
  b602_estojos_toggle: 'Mostra quando: houver estojos na REP',
  b602_arma_N_func_toggle: 'Mostra quando: Funcionamento e eficiência da arma atual',
  b602_arma_N_coleta_toggle: 'Mostra quando: Coleta de padrões balísticos da arma atual',
};

function getTogglesCondicionaisDisponiveis(condToggles?: TinyMceEditorProps['condToggles']): ToggleCondicionalFlat[] {
  const toggles = condToggles || [];
  const extrasB602 = toggles.some(toggle => toggle.id === 'b602_armas_toggle')
    ? BLOCOS_CONDICIONAIS_B602_POR_ARMA
    : [];

  return [
    ...toggles.map(toggle => ({ id: toggle.id, label: toggle.label, subtitulo: toggle.subtitulo })),
    ...toggles.flatMap(toggle => (toggle.subToggles || []).map(subToggle => ({
      id: subToggle.id,
      label: subToggle.label,
      subtitulo: subToggle.subtitulo,
    }))),
    ...extrasB602,
  ];
}

function getResumoCondicional(toggleId: string, condToggles?: TinyMceEditorProps['condToggles']): string {
  if (RESUMOS_FIXOS_BLOCO_CONDICIONAL[toggleId]) {
    return RESUMOS_FIXOS_BLOCO_CONDICIONAL[toggleId];
  }

  const toggle = getTogglesCondicionaisDisponiveis(condToggles).find(item => item.id === toggleId);
  if (toggle?.label) {
    return `Mostra quando: ${toggle.label}`;
  }

  return `Mostra quando: ${toggleId}`;
}

function getTituloBlocoCondicional(toggleId: string, condToggles?: TinyMceEditorProps['condToggles']): string {
  const toggle = getTogglesCondicionaisDisponiveis(condToggles).find(item => item.id === toggleId);
  return toggle?.subtitulo || toggle?.label || toggleId;
}

function criarHtmlBlocoCondicional(toggleId: string, condToggles?: TinyMceEditorProps['condToggles']): string {
  const titulo = getTituloBlocoCondicional(toggleId, condToggles);
  const resumo = getResumoCondicional(toggleId, condToggles);

  return [
    `<div class="cond-bloco"`,
    ` data-cond-bloco="${toggleId}"`,
    ` data-cond-badge="${BADGE_BLOCO_CONDICIONAL}"`,
    ` data-cond-resumo="${resumo}"`,
    ` title="${resumo}">`,
    `<h3>${titulo}</h3><p>&nbsp;</p></div>`,
  ].join('');
}

function normalizarBlocosCondicionais(raiz: HTMLElement | null, condToggles?: TinyMceEditorProps['condToggles']): number {
  if (!raiz) return 0;

  let alterados = 0;
  const blocos = Array.from(raiz.querySelectorAll<HTMLElement>('.cond-bloco[data-cond-bloco]'));

  for (const bloco of blocos) {
    const toggleId = bloco.getAttribute('data-cond-bloco');
    if (!toggleId) continue;

    const badge = BADGE_BLOCO_CONDICIONAL;
    const resumo = getResumoCondicional(toggleId, condToggles);

    if (bloco.getAttribute('data-cond-badge') !== badge) {
      bloco.setAttribute('data-cond-badge', badge);
      alterados += 1;
    }

    if (bloco.getAttribute('data-cond-resumo') !== resumo) {
      bloco.setAttribute('data-cond-resumo', resumo);
      alterados += 1;
    }

    if (bloco.getAttribute('title') !== resumo) {
      bloco.setAttribute('title', resumo);
      alterados += 1;
    }
  }

  return alterados;
}

export const TinyMceEditor: React.FC<TinyMceEditorProps & Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>> = ({
  value,
  initialValue,
  onChange,
  height = 300,
  placeholder,
  laudoId: _laudoId,
  editorId,
  onImageInserted,
  placeholderChaves,
  onEditorInit,
  onDummyFigureClick,
  autoConverterReservados = false,
  condToggles,
  ...rest
}) => {
  const editorRef = useRef<TinyMceEditorInstance | null>(null);
  const placeholderChavesRef = useRef<string[] | undefined>(placeholderChaves);
  const [ready, setReady] = useState(false);

  const [stableInitialValue] = useState(initialValue);
  const isUncontrolled = initialValue !== undefined;

  useEffect(() => {
    placeholderChavesRef.current = placeholderChaves;
  }, [placeholderChaves]);

  const imagesUploadHandler: UploadImagemHandler = (blobInfo) =>
    new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blobInfo.blob());
    });

  const pastePostprocess: PastePostprocessHandler = (_editor, args) => {
    const fragment = args.node;
    if (!fragment) return;
    const convertidas = processarImagensPuras(fragment);
    if (convertidas > 0) {
      onImageInserted?.();
    }
  };

  const filePickerCallback: FilePickerHandler = (_callback, _value, meta) => {
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
          const editor = (window as TinymceWindow).tinymce?.get(editorId);
          if (editor) {
            editor.insertContent(buildFigureHtml(dataUri, id, ''));
            onImageInserted?.();
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  };

  return (
    <div className={ready ? '' : 'opacity-0'} {...rest}>
      <Editor
        id={editorId}
        licenseKey="gpl"
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
          height,
          menubar: false,
          placeholder,
          promotion: false,
          branding: false,
          statusbar: true,
          resize: true,
          contextmenu: false,
          skin_url: './tinymce/skins/ui/oxide',
          content_css: './tinymce/skins/content/default/content.css',
          icons_url: './tinymce/icons/default/icons.min.js',
          toolbar_mode: 'wrap',
          line_height_formats: '1 1.1 1.2 1.3 1.4 1.5 2',
          image_advtab: true,
          image_title: true,

          // ─── Upload de imagens (converte blob→dataURI na origem) ──
          images_upload_handler: imagesUploadHandler,

          paste_data_images: true,

          // ─── Pós-processamento de conteúdo colado ──────────
          paste_postprocess: pastePostprocess,
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
            (condToggles && condToggles.length > 0 ? 'condbloco | ' : '') +
            'help',
          content_style: `
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              padding: 12px;
            }
            body.dark-content {
              background-color: #222f3e;
              color: #fff;
            }
            body.dark-content a { color: #4099ff; }
            body.dark-content table[border]:not([border="0"]):not([style*="border-color"]) th,
            body.dark-content table[border]:not([border="0"]):not([style*="border-color"]) td {
              border-color: #6d737b;
            }
            body.dark-content figure figcaption { color: #8a8f97; }
            body.dark-content hr { border-color: #6d737b; }
            body.dark-content code { background-color: #6d737b; }
            body.dark-content .mce-content-body:not([dir=rtl]) blockquote { border-color: #6d737b; }
            body.dark-content .mce-content-body[dir=rtl] blockquote { border-color: #6d737b; }
            .placeholder-tag {
              background-color: #e8f0fe;
              color: #1a73e8;
              border-radius: 4px;
              padding: 2px 6px;
              font-weight: 500;
              user-select: all;
              cursor: default;
            }
            body.dark-content .placeholder-tag {
              background-color: rgba(138,180,248,0.15);
              color: #8ab4f8;
            }
            .campo-reservado {
              background-color: rgba(255,193,7,0.2);
              color: #b45309;
              border-radius: 4px;
              padding: 2px 6px;
              border-bottom: 2px dotted #f59e0b;
              font-weight: 500;
            }
            body.dark-content .campo-reservado {
              background-color: rgba(255,193,7,0.15);
              color: #fbbf24;
              border-bottom-color: #f59e0b;
            }
            .cond-bloco {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              border-left: 3px solid #f59e0b;
              border-radius: 0 10px 10px 0;
              background-color: rgba(245, 158, 11, 0.08);
              padding: 10px 14px 12px;
              margin: 12px 0;
            }
            body.dark-content .cond-bloco {
              border-left-color: #d97706;
              background-color: rgba(245, 158, 11, 0.12);
            }
            .cond-bloco::before {
              content: "Bloco condicional";
              order: -2;
              display: inline-flex;
              align-items: center;
              margin-bottom: 8px;
              padding: 2px 8px;
              border-radius: 999px;
              border: 1px solid #fdba74;
              background-color: #fff7ed;
              color: #9a3412;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.04em;
              text-transform: uppercase;
              line-height: 1.4;
            }
            .cond-bloco::after {
              content: attr(data-cond-resumo);
              order: -1;
              display: block;
              margin-bottom: 10px;
              color: #9a3412;
              font-size: 12px;
              font-weight: 500;
              line-height: 1.4;
              white-space: pre-wrap;
            }
            .cond-bloco h1,
            .cond-bloco h2,
            .cond-bloco h3,
            .cond-bloco h4,
            .cond-bloco h5,
            .cond-bloco h6,
            .cond-bloco p:first-of-type {
              margin-top: 0;
            }
            body.dark-content .cond-bloco::before {
              border-color: rgba(251, 191, 36, 0.45);
              background-color: rgba(120, 53, 15, 0.75);
              color: #fde68a;
            }
            body.dark-content .cond-bloco::after {
              color: #fcd34d;
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
            [data-template-secao] {
              border-color: rgba(128,128,128,0.2) !important;
            }
            [data-template-secao-header] {
              background: rgba(128,128,128,0.08) !important;
              border-bottom-color: rgba(128,128,128,0.2) !important;
              color: inherit !important;
            }
          `,

          // ─── Upload de imagens ───────────────────────────
          file_picker_callback: filePickerCallback,

          // ─── Placeholder personalizado e Proxy de ContextMenu ─────
          setup: (editor: TinyMceEditorInstance) => {
            editor.addCommand('insertPlaceholder', ((_ui, placeholder) => {
              const html = `<span contenteditable="false" class="placeholder-tag" data-placeholder="{{${placeholder.chave}}}">{{${placeholder.chave}}}</span>`;
              editor.insertContent(html);
            }) satisfies ComandoTinyMce<PlaceholderPayload>);

            editor.addCommand('insertLaudoImage', ((_ui, data) => {
              editor.insertContent(buildFigureHtml(data.url, data.id, data.legenda));
            }) satisfies ComandoTinyMce<ImagemLaudoPayload>);

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

            editor.addCommand('removeLaudoImage', ((_ui, data) => {
              const body = editor.getBody();
              const figure = body.querySelector(`.laudo-figure[data-image-id="${data.id}"]`);
              if (figure) {
                const nextSibling = figure.nextElementSibling;
                figure.remove();
                if (nextSibling && (nextSibling.tagName === 'BR' || (nextSibling.tagName === 'P' && (nextSibling as HTMLElement).innerHTML === '&nbsp;'))) {
                  nextSibling.remove();
                }
              }
            }) satisfies ComandoTinyMce<RemoverImagemPayload>);

            editor.addCommand('replaceLaudoImage', ((_ui, data) => {
              editor.undoManager.transact(() => {
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
                  editor.dom.setAttrib(img, 'src', data.newUrl);
                }
                if (data.newImageId) {
                  figure.setAttribute('data-image-id', data.newImageId);
                }
                figure.removeAttribute('data-dummy');
                figure.style.cursor = '';
              });
            }) satisfies ComandoTinyMce<SubstituirImagemPayload>);

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

            // Comando: Inserir bloco condicional
            editor.addCommand('insertCondBloco', ((_ui, toggleId) => {
              if (!toggleId || typeof toggleId !== 'string') return;
              editor.insertContent(criarHtmlBlocoCondicional(toggleId, condToggles));
            }) satisfies ComandoTinyMce<string>);

            // Registrar botão "Bloco Condicional" na toolbar
            if (condToggles && condToggles.length > 0) {
              const menuItems: Ui.Menu.MenuItemSpec[] = [];
              for (const toggle of condToggles) {
                menuItems.push({
                  type: 'menuitem',
                  text: toggle.label,
                  onAction: () => editor.execCommand('insertCondBloco', false, toggle.id),
                });
                if (toggle.subToggles) {
                  toggle.subToggles.forEach((sub) => {
                    menuItems.push({
                      type: 'menuitem',
                      text: `  ${sub.label}`,
                      onAction: () => editor.execCommand('insertCondBloco', false, sub.id),
                    });
                  });
                }
              }
              if (condToggles.some(toggle => toggle.id === 'b602_armas_toggle')) {
                for (const bloco of BLOCOS_CONDICIONAIS_B602_POR_ARMA) {
                  menuItems.push({
                    type: 'menuitem',
                    text: bloco.label,
                    onAction: () => editor.execCommand('insertCondBloco', false, bloco.id),
                  });
                }
              }
              editor.ui.registry.addMenuButton('condbloco', {
                text: 'Bloco Cond.',
                tooltip: 'Inserir bloco condicional',
                fetch: (callback) => callback(menuItems),
              });
            } else {
              editor.ui.registry.addButton('condbloco', {
                text: 'Bloco Cond.',
                tooltip: 'Bloco Condicional (sem toggles configurados)',
                onAction: () => {},
                enabled: false,
              });
            }

            // Repassar evento de clique direito para o componente pai (Shadcn ContextMenu)
            // Usamos init + listener nativo porque contextmenu:false desabilita o plugin
            // e o editor event 'contextmenu' nunca dispara.
            editor.on('init', () => {
              const doc = editor.getDoc();
              if (!doc) return;
              const body = editor.getBody();

              if (normalizarBlocosCondicionais(body, condToggles) > 0) {
                onChange(editor.getContent());
              }

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
                    const imageId = figure.getAttribute('data-image-id');
                    if (imageId && onDummyFigureClick) {
                      onDummyFigureClick(imageId);
                      return;
                    }
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

              // ─── Observador de tema global (Header toggle) ─────
              const isDark = document.body.classList.contains('dark');
              aplicarTemaEditor(editor, isDark);

              const temaObserver = new MutationObserver(() => {
                const nowDark = document.body.classList.contains('dark');
                aplicarTemaEditor(editor, nowDark);
              });
              temaObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

              editor.on('remove', () => temaObserver.disconnect());
            });

            // ─── Auto-converter {{chave}} digitado manualmente em span estilizado ─────
            if (placeholderChaves && placeholderChaves.length > 0) {
              let placeholderTimer: ReturnType<typeof setTimeout> | null = null;

              const converterPlaceholderLocal = () => {
                const chavesValidas = placeholderChavesRef.current;
                if (!chavesValidas || chavesValidas.length === 0) return;

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
                  if (placeholderChaveEhValida(match[1], chavesValidas)) {
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

            // ─── Auto-converter XXX digitado manualmente em span estilizado ─────
            if (autoConverterReservados) {
              let reservadoTimer: ReturnType<typeof setTimeout> | null = null;

              const converterReservadoLocal = () => {
                const rng = editor.selection.getRng();
                if (!rng || !rng.startContainer) return;

                const textNode = rng.startContainer;
                if (textNode.nodeType !== 3) return;

                const parent = textNode.parentElement;
                if (parent?.classList?.contains('campo-reservado')) return;
                if (parent?.getAttribute?.('data-reservado')) return;

                const text = textNode.textContent || '';
                const regex = /XXX/gi;
                const substituicoes: { pos: number; fim: number; padrao: string }[] = [];
                let match: RegExpExecArray | null;

                while ((match = regex.exec(text)) !== null) {
                  substituicoes.push({ pos: match.index, fim: match.index + match[0].length, padrao: match[0] });
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
                  span.className = 'campo-reservado';
                  span.setAttribute('data-reservado', 'true');
                  span.textContent = s.padrao;
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
                if (reservadoTimer) clearTimeout(reservadoTimer);
                reservadoTimer = setTimeout(converterReservadoLocal, 600);
              });

              editor.on('remove', () => {
                if (reservadoTimer) clearTimeout(reservadoTimer);
              });
            }
          },
        }}
      />
    </div>
  );
};
