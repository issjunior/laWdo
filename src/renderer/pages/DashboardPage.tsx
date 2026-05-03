import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PerfilPeritoForm } from '@/components/forms/PerfilPeritoForm';

interface DashboardPageProps {
  onNavigate?: (page: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
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
        // Silenciar erro - app info é opcional
      } finally {
        setLoading(false);
      }
    };

    fetchAppInfo();
  }, []);

  return (
    <main className="main-content">
      <div className="welcome-card">
        <h2 className="text-2xl font-bold mb-4">🚀 Bem-vindo ao Laudo Pericial PCP</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Esta é a nova versão desktop do sistema de laudos periciais. A migração está em andamento
          seguindo o plano de sprints.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📋 Status do Projeto</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2"><strong>Sprint atual:</strong> 2 - Perfil e Cadastros</p>
              <p className="mb-2"><strong>Status:</strong> 🚀 Em implementação</p>
              <p><strong>Progresso:</strong> Interface em desenvolvimento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">⚡ Tecnologias</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                <li>✅ Electron + Vite + TypeScript</li>
                <li>✅ React + Shadcn/ui</li>
                <li>✅ SQLite (local)</li>
                <li>✅ React Hook Form + Zod</li>
                <li>🚀 Handlers IPC específicos</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🔧 Informações do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Carregando...</p>
              ) : appInfo ? (
                <div className="space-y-2">
                  <p><strong>Nome:</strong> {appInfo.name}</p>
                  <p><strong>Versão:</strong> {appInfo.version}</p>
                  <p><strong>Ambiente:</strong> {import.meta.env.DEV ? 'Desenvolvimento' : 'Produção'}</p>
                </div>
              ) : (
                <p>Informações não disponíveis</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4 mb-8">
          <Button
            onClick={() => onNavigate?.('perfil')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            👤 Ir para Perfil
          </Button>
          <Button
            onClick={() => onNavigate?.('solicitantes')}
            variant="outline"
          >
            🏢 Gerenciar Solicitantes
          </Button>
          <Button
            onClick={() => onNavigate?.('tipos-exame')}
            variant="outline"
          >
            🔬 Gerenciar Tipos de Exame
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>🎨 Demonstração: Formulário de Perfil</CardTitle>
            <CardDescription>
              Exemplo de formulário usando Shadcn/ui, React Hook Form e validação Zod.
              Este formulário será integrado com a API IPC para persistência.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <PerfilPeritoForm
                onSubmit={(data) => {
                  alert('Formulário enviado! Em produção, estes dados seriam salvos no banco.');
                }}
              />
              <div className="text-sm text-muted-foreground">
                <p>✅ Componentes Shadcn/ui funcionando</p>
                <p>✅ Validação com Zod integrada</p>
                <p>✅ React Hook Form para gerenciamento de estado</p>
                <p>🔄 Aguardando integração com API IPC</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="sprint-info bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">📅 Progresso da Sprint 2</h3>
        <ul className="space-y-1">
          <li>✅ Criar estrutura de páginas</li>
          <li>🔄 Implementar página de perfil do perito</li>
          <li>🔲 Criar página de solicitantes</li>
          <li>🔲 Criar página de tipos de exame</li>
          <li>🔲 Integrar formulários com API</li>
          <li>🔲 Adicionar feedback visual</li>
        </ul>
      </div>
    </main>
  );
};