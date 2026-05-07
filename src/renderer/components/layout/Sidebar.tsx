import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const menuSections = [
    {
      title: 'Navegação',
      items: [
        { path: '/', label: 'Dashboard', icon: '📊' },
      ]
    },
    {
      title: 'Cadastros',
      items: [
        { path: '/solicitantes', label: 'Solicitantes', icon: '🏢' },
        { path: '/tipos-exame', label: 'Tipos de Exame', icon: '🔬' },
        { path: '/cabecalho', label: 'Cabeçalho', icon: '📝' },
      ]
    },
    {
      title: 'Configurações',
      items: [
        { path: '/perfil', label: 'Perfil', icon: '👤' },
        { path: '/configuracoes', label: 'Configurações', icon: '⚙️' },
      ]
    },
  ];

  return (
    <aside className="sidebar">
      <nav className="nav">
        {menuSections.map((section) => (
          <div key={section.title} className="mb-4">
            <div className="px-3 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {section.title}
            </div>
            <ul>
              {section.items.map((item) => (
                <li key={item.path} className={`nav-item ${isActive(item.path) ? 'active' : ''}`}>
                  <Link to={item.path} className="nav-link">
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-text">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
};
