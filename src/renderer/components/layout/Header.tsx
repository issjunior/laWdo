import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <h1>🔍 Laudo Pericial PCP</h1>
          <p className="subtitle">Polícia Científica do Paraná</p>
        </div>
        <div className="app-info">
          <span className="version">v0.2.0</span>
          <span className="status online">● Online</span>
        </div>
      </div>
    </header>
  );
};