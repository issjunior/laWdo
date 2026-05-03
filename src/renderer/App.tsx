import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  PerfilPage,
  SolicitantesPage,
  TiposExamePage,
  DashboardPage,
} from '@/pages';
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
const Header = () => (
  <header className="header">
    <div className="header-content">
      <div className="logo">
        <h1>🔍 Laudo Pericial PCP</h1>
        <p className="subtitle">Polícia Científica do Paraná</p>
      </div>
      <div className="app-info">
        <span className="version">v0.1.0</span>
        <span className="status online">● Online</span>
      </div>
    </div>
  </header>
);

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
      <p>© 2024 Polícia Científica do Paraná - Sistema Laudo Pericial PCP</p>
      <p className="footer-links">
        <span>v0.1.0-alpha</span>
        <span>•</span>
        <span>Branch: main</span>
        <span>•</span>
        <span>Electron + React + TypeScript</span>
      </p>
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
