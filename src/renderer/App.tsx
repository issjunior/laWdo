import React, { useEffect, useState } from 'react';
import './styles/globals.css';
import { ErrorBoundary } from './components/ErrorBoundary';

// Componentes básicos
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

const Sidebar = () => (
  <aside className="sidebar">
    <nav className="nav">
      <ul>
        <li className="nav-item active">
          <span className="nav-icon">📊</span>
          <span className="nav-text">Dashboard</span>
        </li>
        <li className="nav-item">
          <span className="nav-icon">📋</span>
          <span className="nav-text">REPs</span>
        </li>
        <li className="nav-item">
          <span className="nav-icon">📝</span>
          <span className="nav-text">Laudos</span>
        </li>
        <li className="nav-item">
          <span className="nav-icon">👤</span>
          <span className="nav-text">Perfil</span>
        </li>
        <li className="nav-item">
          <span className="nav-icon">⚙️</span>
          <span className="nav-text">Configurações</span>
        </li>
      </ul>
    </nav>
  </aside>
);

const MainContent = () => {
  const [appInfo, setAppInfo] = useState<{ version: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAppInfo = async () => {
      try {
        if (window.ipcAPI) {
          const info = await window.ipcAPI.getAppInfo();
          setAppInfo(info);
        }
      } catch (error) {
        console.error('Erro ao buscar informações do app:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAppInfo();
  }, []);

  return (
    <main className="main-content">
      <div className="welcome-card">
        <h2>🚀 Bem-vindo ao Laudo Pericial PCP</h2>
        <p className="welcome-text">
          Esta é a nova versão desktop do sistema de laudos periciais. A migração está em andamento
          seguindo o plano de sprints.
        </p>

        <div className="info-grid">
          <div className="info-card">
            <h3>📋 Status do Projeto</h3>
            <p>
              <strong>Sprint atual:</strong> 0 - Fundação
            </p>
            <p>
              <strong>Próxima sprint:</strong> 1 - Arquitetura Base
            </p>
            <p>
              <strong>Progresso:</strong> 🔵 Iniciando
            </p>
          </div>

          <div className="info-card">
            <h3>⚡ Tecnologias</h3>
            <ul>
              <li>Electron + Vite + TypeScript</li>
              <li>React + Shadcn/ui</li>
              <li>SQLite (local)</li>
              <li>Node.js (main process)</li>
            </ul>
          </div>

          <div className="info-card">
            <h3>🔧 Informações do Sistema</h3>
            {loading ? (
              <p>Carregando...</p>
            ) : appInfo ? (
              <>
                <p>
                  <strong>Nome:</strong> {appInfo.name}
                </p>
                <p>
                  <strong>Versão:</strong> {appInfo.version}
                </p>
                <p>
                  <strong>Ambiente:</strong> {import.meta.env.DEV ? 'Desenvolvimento' : 'Produção'}
                </p>
              </>
            ) : (
              <p>Informações não disponíveis</p>
            )}
          </div>
        </div>

        <div className="action-buttons">
          <button
            className="btn primary"
            onClick={() => window.ipcAPI?.logInfo?.('Botão Teste clicado')}
          >
            Testar Log
          </button>
          <button className="btn secondary" onClick={() => window.ipcAPI?.openDevTools?.()}>
            Abrir DevTools
          </button>
          <button
            className="btn outline"
            onClick={async () => {
              try {
                const result = await window.ipcAPI?.ping?.();
                alert(`Ping: ${result}`);
              } catch (error) {
                alert('Erro ao fazer ping');
              }
            }}
          >
            Testar Conexão
          </button>
        </div>
      </div>

      <div className="sprint-info">
        <h3>📅 Próximas Etapas (Sprint 0)</h3>
        <ul>
          <li>✅ Criar estrutura de pastas</li>
          <li>✅ Configurar TypeScript + ESLint + Prettier</li>
          <li>🔲 Configurar banco de dados SQLite</li>
          <li>🔲 Implementar segurança básica</li>
          <li>🔲 Configurar sistema de logs</li>
          <li>🔲 Criar página de tratamento de erros</li>
        </ul>
      </div>
    </main>
  );
};

const Footer = () => (
  <footer className="footer">
    <div className="footer-content">
      <p>© 2024 Polícia Científica do Paraná - Sistema Laudo Pericial PCP</p>
      <p className="footer-links">
        <span>v0.1.0-alpha</span>
        <span>•</span>
        <span>Branch: migracao-electron</span>
        <span>•</span>
        <span>Electron + React + TypeScript</span>
      </p>
    </div>
  </footer>
);

const App = () => {
  return (
    <ErrorBoundary>
      <div className="app">
        <Header />
        <div className="app-body">
          <Sidebar />
          <MainContent />
        </div>
        <Footer />
      </div>
    </ErrorBoundary>
  );
};

export default App;
