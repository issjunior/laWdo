import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  PerfilPage,
  SolicitantesPage,
  TiposExamePage,
  DashboardPage,
} from '@/pages';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Info } from 'lucide-react';
import './styles/globals.css';

// Layout component
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="app">
      <Header />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">{children}</main>
      </div>
      <Footer />
    </div>
  );
};

// Header component
const Header = () => {
  const [appInfo, setAppInfo] = useState<{ version: string; name: string } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

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
    setIsDarkMode(!isDarkMode);
    document.body.classList.toggle('dark', !isDarkMode);
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <h1>🔍 Laudo Pericial PCP</h1>
          <p className="subtitle">Polícia Científica do Paraná</p>
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

// Sidebar component
const Sidebar = () => {
  const { pathname: currentPath } = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/solicitantes', label: 'Solicitantes', icon: '🏛️' },
    { path: '/tipos-exame', label: 'Tipos de Exame', icon: '🔬' },
    { path: '/reps', label: 'REPs', icon: '📋' },
    { path: '/laudos', label: 'Laudos', icon: '📝' },
    { path: '/perfil', label: 'Perfil', icon: '👤' },
  ];

  return (
    <aside className="sidebar">
      <nav className="nav">
        <ul>
          {navItems.map((item) => (
            <li
              key={item.path}
              className={`nav-item ${currentPath === item.path ? 'active' : ''}`}
            >
              <Link to={item.path} className="nav-link">
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-text">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

// Footer component
const Footer = () => (
  <footer className="footer">
    <div className="footer-content">
      <p>© 2026 - laWdo</p>
    </div>
  </footer>
);

// Main App component
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

// Componente para páginas em desenvolvimento
const PlaceholderPage: React.FC<{ title: string; description: string }> = ({ title, description }) => {
  return (
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
};

// Página 404
const NotFoundPage = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="text-center py-16">
        <h1 className="text-3xl font-bold mb-4">404 - Página não encontrada</h1>
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
};

export default App;
