import React, { useEffect, useState, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
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
const ModelosIAPage = lazy(() => import('@/pages/ModelosIAPage').then(m => ({ default: m.ModelosIAPage })));
const BackupPage = lazy(() => import('@/pages/BackupPage').then(m => ({ default: m.BackupPage })));
const LogsPage = lazy(() => import('@/pages/LogsPage').then(m => ({ default: m.LogsPage })));
import { AuthPage } from '@/pages/AuthPage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Info,
  LogOut,
  Github,
  Mail,
} from 'lucide-react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import './styles/globals.css';

const AUTH_USER_KEY = 'lawdo_auth_user';

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
      <Toaster
        richColors
        closeButton
        visibleToasts={5}
        position="bottom-right"
        duration={4000}
      />
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
                <Route path="/modelos-ia" element={<ModelosIAPage />} />
                <Route path="/backup" element={<BackupPage />} />
                <Route path="/logs" element={<LogsPage />} />
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
