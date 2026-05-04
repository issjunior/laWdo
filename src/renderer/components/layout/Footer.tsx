import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <p>© 2024 Polícia Científica do Paraná - Sistema Laudo Pericial PCP</p>
        <p className="footer-links">
          <span>v0.2.0-alpha</span>
          <span>•</span>
          <span>Electron + React + TypeScript</span>
        </p>
      </div>
    </footer>
  );
};