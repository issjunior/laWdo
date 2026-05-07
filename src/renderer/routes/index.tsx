import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { DashboardPage } from '@/pages/DashboardPage';
import { PerfilPage } from '@/pages/PerfilPage';
import { SolicitantesPage } from '@/pages/SolicitantesPage';
import { TiposExamePage } from '@/pages/TiposExamePage';
import { CabecalhoPage } from '@/pages/CabecalhoPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const AppRoutes: React.FC = () => {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="/solicitantes" element={<SolicitantesPage />} />
        <Route path="/tipos-exame" element={<TiposExamePage />} />
        <Route path="/cabecalho" element={<CabecalhoPage />} />
        <Route path="/configuracoes" element={
          <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Configurações</h1>
            <p className="text-gray-600">Página de configurações em desenvolvimento...</p>
          </div>
        } />
        <Route path="*" element={
          <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Página não encontrada</h1>
            <p className="text-gray-600">A página que você está procurando não existe.</p>
          </div>
        } />
      </Routes>
    </ErrorBoundary>
  );
};