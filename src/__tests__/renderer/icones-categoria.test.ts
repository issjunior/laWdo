import { describe, expect, it } from 'vitest';
import { Circle, Tag } from 'lucide-react';
import { ICON_CATEGORIES } from '@/lib/category-constants';
import { obterIconeCategoria } from '@/lib/icones-categoria';

describe('registro de ícones de categoria', () => {
  it('resolve todos os ícones oferecidos pelos catálogos', () => {
    for (const categoria of ICON_CATEGORIES) {
      for (const nome of categoria.icons) {
        expect(obterIconeCategoria(nome, Circle), nome).not.toBe(Circle);
      }
    }
  });

  it('preserva o alias legado Tool e usa fallback para nomes desconhecidos', () => {
    expect(obterIconeCategoria('Tool')).not.toBe(Tag);
    expect(obterIconeCategoria('IconeInexistente', Tag)).toBe(Tag);
  });
});
