import React from 'react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.jpg';

interface DashboardPageProps {
  onNavigate?: (page: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  return (
    <main className="main-content">
      <div className="welcome-card">
        <div className="logo-container">
          <img src={logo} alt="Logo laWdo" className="dashboard-logo" />
        </div>
      </div>

    </main>
  );
};