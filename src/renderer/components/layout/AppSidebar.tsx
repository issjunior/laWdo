import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Brain,
  Database,
  Camera,
  LogOut,
  Ruler,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback, AvatarBadge } from '@/components/ui/avatar';
import { AvatarUploadDialog } from '@/components/avatar/AvatarUploadDialog';

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
      { title: 'Modelos IA', path: '/modelos-ia', icon: Brain },
      { title: 'Margens do PDF', path: '/margens', icon: Ruler },
      { title: 'Backup', path: '/backup', icon: Database },
      { title: 'Logs', path: '/logs', icon: FileText },
    ],
  },
];

const AUTH_USER_KEY = 'lawdo_auth_user';

interface AppSidebarProps {
  currentUser: any;
  onLogout: () => void;
}

export function AppSidebar({ currentUser, onLogout }: AppSidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const userName = currentUser?.name || currentUser?.nome || currentUser?.username || 'Usuário';
  const userCargo = currentUser?.cargo || '';
  const userId = currentUser?.id;
  const firstName = userName.split(' ')[0];

  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const loadAvatar = useCallback(async () => {
    if (!userId) return;
    const raw = sessionStorage.getItem(AUTH_USER_KEY);
    let user = raw ? JSON.parse(raw) : null;

    if (user?.foto_url) {
      try {
        const result = await window.ipcAPI.user.getAvatar(userId);
        if (result.success && result.data?.foto_url) {
          setFotoUrl(result.data.foto_url);
          return;
        }
      } catch {
        // fallback to stored URL
      }
    }
    setFotoUrl(null);
  }, [userId]);

  useEffect(() => {
    loadAvatar();
  }, [loadAvatar]);

  useEffect(() => {
    const handleProfileUpdate = () => loadAvatar();
    window.addEventListener('storage', handleProfileUpdate);
    return () => window.removeEventListener('storage', handleProfileUpdate);
  }, [loadAvatar]);

  const handleAvatarUpdated = useCallback((newFotoUrl: string) => {
    setFotoUrl(newFotoUrl);
    const raw = sessionStorage.getItem(AUTH_USER_KEY);
    if (raw) {
      try {
        const user = JSON.parse(raw);
        user.foto_url = 'updated';
        sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        window.dispatchEvent(new Event('storage'));
      } catch { }
    }
  }, []);

  return (
    <>
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
                            <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
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
                            <SidebarMenuButton>
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
                      <SidebarMenuButton asChild isActive={pathname === item.path}>
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

        <SidebarFooter className="p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-md p-1 text-left outline-none transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center">
                <div className="relative">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={fotoUrl || undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <AvatarBadge className="h-2.5 w-2.5" />
                </div>
                <div className="flex flex-1 flex-col text-left overflow-hidden group-data-[collapsible=icon]:hidden">
                  <span className="text-xs font-medium text-sidebar-foreground truncate">{firstName}</span>
                  {userCargo && (
                    <span className="text-[10px] text-muted-foreground truncate">{userCargo}</span>
                  )}
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 group-data-[collapsible=icon]:hidden" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" sideOffset={8} className="min-w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{userCargo}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/perfil')}>
                <UserCircle className="mr-2 h-4 w-4" />
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setUploadDialogOpen(true)}>
                <Camera className="mr-2 h-4 w-4" />
                Alterar Foto
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => { onLogout(); await window.ipcAPI.closeApp(); }} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Fechar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      {userId && (
        <AvatarUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          userId={userId}
          currentFotoUrl={fotoUrl}
          userName={userName}
          onAvatarUpdated={handleAvatarUpdated}
        />
      )}
    </>
  );
}
