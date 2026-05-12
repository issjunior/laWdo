import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utilitário para combinar classes Tailwind CSS
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Tags HTML de formatação inline que não devem envolver placeholders */
const TAGS_FORMATACAO = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'SUB', 'SUP',
]);

/**
 * Remove tags de formatação (negrito, itálico, sublinhado, etc.) que envolvem
 * placeholders, garantindo que {{chave}} seja salvo como texto puro sem estilo.
 *
 * Processa dois tipos de placeholder:
 * 1. Spans estilizados: <span class="placeholder-tag" contenteditable="false" data-placeholder="{{...}}">{{...}}</span>
 * 2. Texto puro: {{chave}}
 */
export function removerFormatacaoPlaceholders(html: string): string {
  if (!html) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  /** Desaninha o nó de tags de formatação ancestrais */
  function desaninhar(no: Node): void {
    const atual = no;
    while (atual) {
      const pai = atual.parentElement;
      if (!pai || pai === doc.body || pai === doc.documentElement) break;
      if (!TAGS_FORMATACAO.has(pai.tagName)) break;

      const avo = pai.parentNode;
      if (avo) {
        // Move todos os filhos do pai para o avô (antes do pai), depois remove o pai vazio
        while (pai.firstChild) {
          avo.insertBefore(pai.firstChild, pai);
        }
        avo.removeChild(pai);
      }
      // Continua verificando o nó (agora filho do avô)
    }
  }

  // Etapa 1: Desaninhar spans de placeholder estilizados
  const spansEstilizados = doc.querySelectorAll('.placeholder-tag');
  spansEstilizados.forEach(span => desaninhar(span));

  // Etapa 2: Desaninhar texto puro {{chave}} de tags de formatação
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const nosTexto: Text[] = [];
  while (walker.nextNode()) {
    nosTexto.push(walker.currentNode as Text);
  }

  for (const noTexto of nosTexto) {
    // Ignora nós que já foram removidos da árvore
    if (!noTexto.parentElement) continue;
    // Ignora texto dentro de spans de placeholder (já tratados na etapa 1)
    if (noTexto.parentElement.classList.contains('placeholder-tag')) continue;
    // Verifica se o texto contém padrão de placeholder
    if (/\{\{[^}]+\}\}/.test(noTexto.textContent || '')) {
      desaninhar(noTexto);
    }
  }

  return doc.body.innerHTML;
}