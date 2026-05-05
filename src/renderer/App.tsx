import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import {
  PerfilPage,
  SolicitantesPage,
  TiposExamePage,
  DashboardPage,
} from '@/pages';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Info,
  ChevronDown,
  LayoutDashboard,
  FolderOpen,
  Settings,
  Users,
  FlaskConical,
  UserCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import './styles/globals.css';

// ─── Layout ────────────────────────────────────────────────────────────────────
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="app">
      <Header />
      <div className="app-body">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className={`main-content ${sidebarCollapsed ? 'full-width' : ''}`}>
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
};

// ─── Header ─────────────────────────────────────────────────────────────────────
const Header = () => {
  const [appInfo, setAppInfo] = useState<{ version: string; name: string } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const fetchAppInfo = async () => {
      try {
        if (window.ipcAPI) {
          const info = await window.ipcAPI.getAppInfo();
          setAppInfo(info);
        }
      } catch {
        // App info é opcional
      }
    };
    fetchAppInfo();
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <h1>🔍 laWdo</h1>
          <p className="subtitle">Sistema de automatização de laudos periciais</p>
        </div>
        <div className="app-info">
          <span className="version">v0.1.0</span>
          <span className="status online">● Online</span>
          <button
            onClick={toggleDarkMode}
            className="dark-mode-btn"
            title={isDarkMode ? 'Modo claro' : 'Modo escuro'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <Dialog>
            <DialogTrigger asChild>
              <button className="system-info-btn" title="Informações do Sistema">
                <Info size={18} />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Informações do Sistema</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-2">⚡ Tecnologias</h3>
                  <ul className="space-y-1 text-sm">
                    <li>✅ Electron + Vite + TypeScript</li>
                    <li>✅ React + Shadcn/ui</li>
                    <li>✅ SQLite (local)</li>
                    <li>✅ React Hook Form + Zod</li>
                    <li>🚀 Handlers IPC específicos</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">🔧 Sistema</h3>
                  {appInfo ? (
                    <div className="space-y-1 text-sm">
                      <p><strong>Nome:</strong> {appInfo.name}</p>
                      <p><strong>Versão:</strong> {appInfo.version}</p>
                      <p><strong>Ambiente:</strong> {import.meta.env.DEV ? 'Desenvolvimento' : 'Produção'}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Carregando informações...</p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
};

// ─── Nav Section (with collapse support) ────────────────────────────────────────
interface NavSectionProps {
  label: string;
  emoji: string;
  icon: React.ReactNode;
  items: { path: string; label: string; icon: React.ReactNode }[];
  currentPath: string;
  collapsed: boolean;
}

const NavSection: React.FC<NavSectionProps> = ({
  label,
  emoji,
  icon,
  items,
  currentPath,
  collapsed,
}) => {
  const [open, setOpen] = useState(true);
  const hasActive = items.some((i) => i.path === currentPath);

  if (collapsed) {
    // No estado recolhido mostra só os ícones dos links
    return (
      <div className="nav-section-collapsed">
        {items.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-icon-btn${currentPath === item.path ? ' active' : ''}`}
            title={item.label}
          >
            {item.icon}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className={`nav-section${hasActive && !open ? ' has-active' : ''}`}>
      {/* Section header */}
      <button
        className={`nav-section-header${open ? ' open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="nav-section-icon">{emoji}</span>
        <span className="nav-section-label">{label}</span>
        <ChevronDown
          size={14}
          className={`nav-section-chevron${open ? ' rotated' : ''}`}
        />
      </button>

      {/* Items */}
      <div className={`nav-section-items${open ? ' open' : ''}`}>
        {items.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-link${currentPath === item.path ? ' active' : ''}`}
          >
            <span className="nav-link-icon">{item.icon}</span>
            <span className="nav-link-label">{item.label}</span>
            {currentPath === item.path && <span className="nav-link-indicator" />}
          </Link>
        ))}
      </div>
    </div>
  );
};

// ─── Nav Item (single, no dropdown) ─────────────────────────────────────────────
interface NavItemProps {
  path: string;
  label: string;
  emoji: string;
  icon: React.ReactNode;
  currentPath: string;
  collapsed: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ path, label, emoji, icon, currentPath, collapsed }) => {
  const isActive = currentPath === path;

  if (collapsed) {
    return (
      <div className="nav-section-collapsed">
        <Link
          to={path}
          className={`nav-icon-btn${isActive ? ' active' : ''}`}
          title={label}
        >
          {icon}
        </Link>
      </div>
    );
  }

  return (
    <Link to={path} className={`nav-link solo${isActive ? ' active' : ''}`}>
      <span className="nav-link-icon">{emoji}</span>
      <span className="nav-link-label">{label}</span>
      {isActive && <span className="nav-link-indicator" />}
    </Link>
  );
};

// ─── Sidebar ─────────────────────────────────────────────────────────────────────
const Sidebar: React.FC<{ collapsed: boolean; onToggleCollapse: () => void }> = ({
  collapsed,
  onToggleCollapse,
}) => {
  const { pathname: currentPath } = useLocation();

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Toggle button */}
      <button
        className="sidebar-collapse-btn"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      <nav className="sidebar-nav">
        {/* Divisor visual */}
        {!collapsed && <p className="nav-divider-label">MENU</p>}

        {/* Dashboard — item único */}
        <NavItem
          path="/"
          label="Dashboard"
          emoji="📊"
          icon={<LayoutDashboard size={16} />}
          currentPath={currentPath}
          collapsed={collapsed}
        />

        {/* Cadastro */}
        <NavSection
          label="Cadastro"
          emoji="📁"
          icon={<FolderOpen size={16} />}
          items={[
            { path: '/solicitantes', label: 'Solicitantes', icon: <Users size={15} /> },
            { path: '/tipos-exame', label: 'Tipos de Exame', icon: <FlaskConical size={15} /> },
          ]}
          currentPath={currentPath}
          collapsed={collapsed}
        />

        {/* Configurações */}
        <NavSection
          label="Configurações"
          emoji="⚙️"
          icon={<Settings size={16} />}
          items={[
            { path: '/perfil', label: 'Perfil', icon: <UserCircle size={15} /> },
          ]}
          currentPath={currentPath}
          collapsed={collapsed}
        />
      </nav>

    </aside>
  );
};

// ─── Footer ───────────────────────────────────────────────────────────────────────
const Footer = () => (
  <footer className="footer">
    <div className="footer-content">
      <p>© 2026 — laWdo</p>
    </div>
  </footer>
);

// ─── App ──────────────────────────────────────────────────────────────────────────
const App = () => {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/solicitantes" element={<SolicitantesPage />} />
            <Route path="/tipos-exame" element={<TiposExamePage />} />
            <Route path="/perfil" element={<PerfilPage />} />
            <Route path="/reps" element={<PlaceholderPage title="REPs" description="Gestão de Requisições de Exame Pericial" />} />
            <Route path="/laudos" element={<PlaceholderPage title="Laudos" description="Criação e gestão de laudos periciais" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </HashRouter>
    </ErrorBoundary>
  );
};

// ─── Placeholder Page ─────────────────────────────────────────────────────────────
const PlaceholderPage: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="container mx-auto p-6">
    <div className="text-center py-16">
      <h1 className="text-3xl font-bold mb-4">{title}</h1>
      <p className="text-gray-600 mb-8">{description}</p>
      <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg max-w-md mx-auto">
        <h3 className="font-semibold text-yellow-800 mb-2">🚧 Em Desenvolvimento</h3>
        <p className="text-yellow-700">
          Esta funcionalidade será implementada nas próximas sprints.
          Por enquanto, você pode acessar as páginas já disponíveis.
        </p>
      </div>
    </div>
  </div>
);

// ─── 404 ──────────────────────────────────────────────────────────────────────────
const NotFoundPage = () => (
  <div className="container mx-auto p-6">
    <div className="text-center py-16">
      <h1 className="text-3xl font-bold mb-4">404 — Página não encontrada</h1>
      <p className="text-gray-600 mb-8">A página que você está procurando não existe.</p>
      <Link
        to="/"
        className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Ir para Dashboard
      </Link>
    </div>
  </div>
);

export default App;
