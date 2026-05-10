import React, { useEffect, useState, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary.js';
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const SolicitantesPage = lazy(() => import('@/pages/SolicitantesPage').then(m => ({ default: m.SolicitantesPage })));
const TiposExamePage = lazy(() => import('@/pages/TiposExamePage').then(m => ({ default: m.TiposExamePage })));
const PerfilPage = lazy(() => import('@/pages/PerfilPage').then(m => ({ default: m.PerfilPage })));
const CabecalhoPage = lazy(() => import('@/pages/CabecalhoPage').then(m => ({ default: m.CabecalhoPage })));
const REPsPage = lazy(() => import('@/pages/REPsPage').then(m => ({ default: m.REPsPage })));
const PlaceholdersPage = lazy(() => import('@/pages/PlaceholdersPage').then(m => ({ default: m.PlaceholdersPage })));
const TemplatesPage = lazy(() => import('@/pages/TemplatesPage').then(m => ({ default: m.TemplatesPage })));
const LaudosPage = lazy(() => import('@/pages/LaudosPage').then(m => ({ default: m.LaudosPage })));
import { AuthPage } from '@/pages/AuthPage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Info,
  LogOut,
} from 'lucide-react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import './styles/globals.css';

const AUTH_USER_KEY = 'lawdo_auth_user';

const Header: React.FC<{ onLogout: () => void; currentUser: any }> = ({ onLogout, currentUser }) => {
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
        const info = await window.ipcAPI.getAppInfo();
        setAppInfo(info);
      } catch {
        // opcional
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
    <header className="header flex items-center gap-4 px-4 h-16 shrink-0">
      <SidebarTrigger className="-ml-1" />
      <div className="header-content flex-1 flex justify-between items-center">
        <div className="logo">
          <h1 className="text-xl font-bold flex items-center gap-2">🔍 laWdo</h1>
        </div>
        <div className="app-info flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium">{currentUser?.name || currentUser?.username || 'Usuário'}</span>
            <span className="text-[10px] text-muted-foreground uppercase">v0.1.0 ● Online</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDarkMode}
              className="p-2 hover:bg-accent rounded-md transition-colors"
              title={isDarkMode ? 'Modo claro' : 'Modo escuro'}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <button onClick={onLogout} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors" title="Sair">
              <LogOut size={18} />
            </button>
            <Dialog>
              <DialogTrigger asChild>
                <button className="p-2 hover:bg-accent rounded-md transition-colors" title="Informações do Sistema">
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
      </div>
    </header>
  );
};



const Footer = () => (
  <footer className="footer">
    <div className="footer-content">
      <p>© 2026 — laWdo</p>
    </div>
  </footer>
);

const Layout: React.FC<{ children: React.ReactNode; onLogout: () => void; currentUser: any }> = ({
  children,
  onLogout,
  currentUser,
}) => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-col h-screen overflow-hidden bg-background">
          <Header onLogout={onLogout} currentUser={currentUser} />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-[1600px] mx-auto">
              {children}
            </div>
          </main>
          <Footer />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

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

const App = () => {
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const raw = sessionStorage.getItem(AUTH_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const handleAuthenticated = (user: any) => {
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_USER_KEY);
    setCurrentUser(null);
  };

  return (
    <ErrorBoundary>
      {!currentUser ? (
        <AuthPage onAuthenticated={handleAuthenticated} />
      ) : (
        <HashRouter>
          <Layout onLogout={handleLogout} currentUser={currentUser}>
            <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>}>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/solicitantes" element={<SolicitantesPage />} />
                <Route path="/tipos-exame" element={<TiposExamePage />} />
                <Route path="/perfil" element={<PerfilPage />} />
                <Route path="/cabecalho" element={<CabecalhoPage />} />
                <Route path="/reps" element={<REPsPage />} />
                <Route path="/placeholders" element={<PlaceholdersPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/laudos" element={<LaudosPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </Layout>
        </HashRouter>
      )}
    </ErrorBoundary>
  );
};

export default App;
