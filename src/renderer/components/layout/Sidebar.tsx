import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/perfil', label: 'Perfil', icon: '👤' },
    { path: '/solicitantes', label: 'Solicitantes', icon: '🏢' },
    { path: '/tipos-exame', label: 'Tipos de Exame', icon: '🔬' },
    { path: '/configuracoes', label: 'Configurações', icon: '⚙️' },
  ];

  return (
    <aside className="sidebar">
      <nav className="nav">
        <ul>
          {navItems.map((item) => (
            <li key={item.path} className={`nav-item ${isActive(item.path) ? 'active' : ''}`}>
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