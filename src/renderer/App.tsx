import React, { useEffect, useState } from 'react';
import './styles/globals.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PerfilPeritoForm } from './components/forms/PerfilPeritoForm';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';

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
              <strong>Sprint atual:</strong> 1 - Arquitetura Base
            </p>
            <p>
              <strong>Status:</strong> 🔄 Em andamento
            </p>
            <p>
              <strong>Progresso:</strong> Shadcn/ui configurado
            </p>
          </div>

          <div className="info-card">
            <h3>⚡ Tecnologias</h3>
            <ul>
              <li>Electron + Vite + TypeScript</li>
              <li>React + Shadcn/ui ✅</li>
              <li>SQLite (local) ✅</li>
              <li>Node.js (main process) ✅</li>
              <li>React Hook Form + Zod 🔄</li>
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

      <div className="mt-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>🎨 Demonstração: Formulário Shadcn/ui</CardTitle>
            <CardDescription>
              Exemplo de formulário usando Shadcn/ui, React Hook Form e validação Zod.
              Esta é uma prévia dos componentes que serão usados no sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <PerfilPeritoForm
                onSubmit={(data) => {
                  console.log('Dados do formulário:', data);
                  alert('Formulário enviado! Verifique o console para ver os dados.');
                }}
              />
              <div className="text-sm text-muted-foreground">
                <p>✅ Componentes Shadcn/ui funcionando</p>
                <p>✅ Validação com Zod integrada</p>
                <p>✅ React Hook Form para gerenciamento de estado</p>
                <p>✅ Estilos consistentes com tema dark/light</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="sprint-info">
        <h3>📅 Progresso da Sprint 1</h3>
        <ul>
          <li>✅ Configurar Shadcn/ui components</li>
          <li>✅ Criar tema claro/escuro</li>
          <li>🔄 Implementar schemas Zod para entidades</li>
          <li>🔲 Integrar formulários com validação</li>
          <li>🔲 Criar handlers IPC específicos</li>
          <li>🔲 Configurar testes unitários</li>
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
