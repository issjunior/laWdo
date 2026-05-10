import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FlaskConical,
  FileText,
  Puzzle,
  ScrollText,
  UserCircle,
  Settings,
  ChevronRight,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const menuItems = [
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
    title: 'Configurações',
    icon: Settings,
    items: [
      { title: 'Perfil', path: '/perfil', icon: UserCircle },
    ],
  },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { state } = useSidebar();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="flex items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-xl font-bold">🔍</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">laWdo</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Pericial</span>
          </div>
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex h-8 w-8 items-center justify-start rounded-lg bg-primary text-primary-foreground p-1">
           <span className="text-lg font-bold ml-1">L</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.items ? (
                    state === 'collapsed' ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuButton tooltip={item.title} className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start" sideOffset={8}>
                          {item.items.map((subItem) => (
                            <DropdownMenuItem key={subItem.path} asChild>
                              <Link to={subItem.path} className="flex items-center gap-2 cursor-pointer">
                                <subItem.icon className="h-4 w-4" />
                                <span>{subItem.title}</span>
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Collapsible defaultOpen className="group/collapsible">
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.title}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.path}>
                                <SidebarMenuSubButton asChild isActive={pathname === subItem.path}>
                                  <Link to={subItem.path}>
                                    <subItem.icon className="h-4 w-4" />
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    )
                  ) : (
                    <SidebarMenuButton asChild isActive={pathname === item.path} tooltip={item.title}>
                      <Link to={item.path!}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
         <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <UserCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
                <span className="text-xs font-medium text-sidebar-foreground">Sistema de Laudos</span>
                <span className="text-[10px] text-muted-foreground">v0.1.0</span>
            </div>
         </div>
      </SidebarFooter>
    </Sidebar>
  );
}
