import type { LucideIcon } from 'lucide-react'
import {
  Brain,
  Database,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Layers,
  Network,
  Package,
  Puzzle,
  Ruler,
  ScrollText,
  Settings,
  Users,
  Wand2,
} from 'lucide-react'

type ItemMenuBase = {
  title: string
  icon: LucideIcon
}

type ItemMenuFolha = ItemMenuBase & {
  path: string
}

type ItemMenuGrupo = ItemMenuBase & {
  items: ItemMenuFolha[]
}

export type ItemMenu = ItemMenuFolha | ItemMenuGrupo

export const itensMenu: ItemMenu[] = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
  },
  {
    title: 'Cadastros',
    icon: Puzzle,
    items: [
      { title: 'Solicitantes', path: '/solicitantes', icon: Users },
      { title: 'Tipos de Exame', path: '/tipos-exame', icon: FlaskConical },
      { title: 'Cabeçalho', path: '/cabecalho', icon: FileText },
      { title: 'Placeholders', path: '/placeholders', icon: Puzzle },
      { title: 'Templates', path: '/templates', icon: FileText },
    ],
  },
  {
    title: 'Requisições (REPs)',
    icon: ScrollText,
    items: [
      { title: 'REPs', path: '/reps', icon: ScrollText },
    ],
  },
  {
    title: 'Laudos',
    icon: FileText,
    items: [
      { title: 'Editor de Laudos', path: '/laudos', icon: FileText },
    ],
  },
  {
    title: 'Wizard',
    icon: Wand2,
    items: [
      { title: 'Categorias', path: '/categorias-pecas', icon: Layers },
      { title: 'Peças', path: '/pecas', icon: Package },
      { title: 'Wizards', path: '/wizards', icon: Wand2 },
    ],
  },
  {
    title: 'Configurações',
    icon: Settings,
    items: [
      { title: 'Modelos IA', path: '/modelos-ia', icon: Brain },
      { title: 'Margens do PDF', path: '/margens', icon: Ruler },
      { title: 'API GDL', path: '/gdl-config', icon: Network },
      { title: 'Backup', path: '/backup', icon: Database },
      { title: 'Logs', path: '/logs', icon: FileText },
    ],
  },
]

export const obterIconeMenuPorRota = (rota: string, fallback: LucideIcon): LucideIcon => {
  for (const item of itensMenu) {
    if ('path' in item && item.path === rota) {
      return item.icon
    }

    if ('items' in item) {
      const encontrado = item.items.find(subitem => subitem.path === rota)
      if (encontrado) {
        return encontrado.icon
      }
    }
  }

  return fallback
}
