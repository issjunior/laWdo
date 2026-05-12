import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Upload, AlertTriangle, Loader2, Database, FileArchive } from 'lucide-react';
import { toast } from 'sonner';

export const BackupPage: React.FC = () => {
  const [criando, setCriando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [dialogRestaurarAberto, setDialogRestaurarAberto] = useState(false);

  const handleCriarBackup = async () => {
    setCriando(true);
    try {
      const r = await window.ipcAPI.backup.criar();
      if (r.success && r.path) {
        toast.success('Backup criado com sucesso', {
          description: `Salvo em: ${r.path}`,
        });
      } else {
        if (r.error?.includes('cancelada')) {
          toast.info('Operação cancelada');
        } else {
          toast.error('Erro ao criar backup', { description: r.error });
        }
      }
    } catch (error) {
      toast.error('Erro inesperado ao criar backup');
    } finally {
      setCriando(false);
    }
  };

  const handleRestaurar = async () => {
    setDialogRestaurarAberto(false);
    setRestaurando(true);
    try {
      const r = await window.ipcAPI.backup.restaurar();
      if (r.success) {
        toast.success('Restauração iniciada. O aplicativo será reiniciado.');
      } else {
        if (r.error?.includes('cancelada')) {
          toast.info('Operação cancelada');
        } else {
          toast.error('Erro ao restaurar backup', { description: r.error });
        }
        setRestaurando(false);
      }
    } catch (error) {
      toast.error('Erro inesperado ao restaurar backup');
      setRestaurando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Backup e Restauração</h1>
      </div>

      <p className="text-muted-foreground">
        Gerencie cópias de segurança completas do sistema. Cada backup inclui o banco de dados e todas as imagens dos laudos.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card — Criar Backup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-primary" />
              Criar Backup
            </CardTitle>
            <CardDescription>
              Gere um arquivo ZIP contendo o banco de dados completo e todas as imagens vinculadas aos laudos.
              O arquivo poderá ser salvo em qualquer pasta do computador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleCriarBackup}
              disabled={criando || restaurando}
              className="w-full"
            >
              {criando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {criando ? 'Criando backup...' : 'Salvar Backup...'}
            </Button>
          </CardContent>
        </Card>

        {/* Card — Restaurar Backup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Restaurar Backup
            </CardTitle>
            <CardDescription>
              Substitua todo o estado atual do sistema por uma cópia anterior.
              <strong className="text-destructive"> Atenção:</strong> todos os dados atuais (laudos, imagens, configurações) serão sobrescritos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => setDialogRestaurarAberto(true)}
              disabled={criando || restaurando}
              className="w-full"
            >
              {restaurando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {restaurando ? 'Restaurando...' : 'Selecionar Arquivo...'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de confirmação de restauração */}
      <Dialog open={dialogRestaurarAberto} onOpenChange={setDialogRestaurarAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Restauração
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>
                Esta ação substituirá o banco de dados atual e todas as imagens pelos dados do arquivo de backup selecionado.
              </p>
              <p className="font-medium text-foreground">
                Recomenda-se criar um backup do estado atual antes de prosseguir.
              </p>
              <p>O aplicativo será reiniciado automaticamente após a restauração.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogRestaurarAberto(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRestaurar}>
              Prosseguir com Restauração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
