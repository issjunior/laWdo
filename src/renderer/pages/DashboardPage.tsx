import React from 'react';
import { Button } from '@/components/ui/button';

interface DashboardPageProps {
  onNavigate?: (page: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  return (
    <main className="main-content">
      <div className="welcome-card">
        <h2 className="text-2xl font-bold mb-4">🚀 Bem-vindo ao laWdo.</h2>
      </div>

    </main>
  );
};