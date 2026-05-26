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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  Upload,
  AlertTriangle,
  Loader2,
  Database,
  FileArchive,
  Settings,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

const ITENS_INCLUIDOS = [
  { label: 'Solicitantes', desc: 'Orgaos, varas, delegacias cadastrados' },
  { label: 'Tipos de Exame', desc: 'Codigos, nomes e templates padrao' },
  { label: 'Templates', desc: 'Templates de laudo e secoes' },
  { label: 'Placeholders', desc: 'Variaveis de sistema e personalizadas' },
  { label: 'Configuracoes', desc: 'Cabecalho, rodape e preferencias (sem chaves de IA)' },
];

const ITENS_EXCLUIDOS = [
  { label: 'Usuarios', desc: 'Peritos e credenciais' },
  { label: 'REPs', desc: 'Requisicoes de Exame Pericial' },
  { label: 'Laudos', desc: 'Documentos e conteudos gerados' },
  { label: 'Modelos de IA', desc: 'Chaves de API e modelos Groq' },
  { label: 'Logs', desc: 'Registros de auditoria' },
  { label: 'Imagens', desc: 'Fotos vinculadas aos laudos' },
];

export const BackupPage: React.FC = () => {
  const [criando, setCriando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [dialogRestaurarAberto, setDialogRestaurarAberto] = useState(false);
  const [dialogImportarAberto, setDialogImportarAberto] = useState(false);

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
          toast.info('Operacao cancelada');
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
        toast.success('Restauracao iniciada. O aplicativo sera reiniciado.');
      } else {
        if (r.error?.includes('cancelada')) {
          toast.info('Operacao cancelada');
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

  const handleExportarConfig = async () => {
    setExportando(true);
    try {
      const r = await window.ipcAPI.backup.configExportar();
      if (r.success && r.path) {
        toast.success('Configuracao exportada com sucesso', {
          description: `Salvo em: ${r.path}`,
        });
      } else {
        if (r.error?.includes('cancelada')) {
          toast.info('Operacao cancelada');
        } else {
          toast.error('Erro ao exportar configuracao', { description: r.error });
        }
      }
    } catch (error) {
      toast.error('Erro inesperado ao exportar configuracao');
    } finally {
      setExportando(false);
    }
  };

  const handleImportarConfig = async () => {
    setDialogImportarAberto(false);
    setImportando(true);
    try {
      const r = await window.ipcAPI.backup.configImportar();
      if (r.success) {
        toast.success('Configuracao importada com sucesso');
      } else {
        if (r.error?.includes('cancelada')) {
          toast.info('Operacao cancelada');
        } else {
          toast.error('Erro ao importar configuracao', { description: r.error });
        }
      }
    } catch (error) {
      toast.error('Erro inesperado ao importar configuracao');
    } finally {
      setImportando(false);
    }
  };

  const disabled = criando || restaurando || exportando || importando;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Backup e Restauracao</h1>
      </div>

      <Tabs defaultValue="completo" className="w-full">
        <TabsList>
          <TabsTrigger value="completo">
            <FileArchive className="mr-2 h-4 w-4" />
            Backup Completo
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="mr-2 h-4 w-4" />
            Backup de Configuracao
          </TabsTrigger>
        </TabsList>

        {/* ABA: Backup Completo */}
        <TabsContent value="completo" className="space-y-6">
          <p className="text-muted-foreground">
            Gerencie copias de seguranca completas do sistema. Cada backup inclui o banco de dados e todas as imagens dos laudos.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileArchive className="h-5 w-5 text-primary" />
                  Criar Backup
                </CardTitle>
                <CardDescription>
                  Gere um arquivo ZIP contendo o banco de dados completo e todas as imagens vinculadas aos laudos.
                  O arquivo podera ser salvo em qualquer pasta do computador.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleCriarBackup}
                  disabled={disabled}
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Restaurar Backup
                </CardTitle>
                <CardDescription>
                  Substitua todo o estado atual do sistema por uma copia anterior.
                  <strong className="text-destructive"> Atencao:</strong> todos os dados atuais (laudos, imagens, configuracoes) serao sobrescritos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  onClick={() => setDialogRestaurarAberto(true)}
                  disabled={disabled}
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
        </TabsContent>

        {/* ABA: Backup de Configuracao */}
        <TabsContent value="config" className="space-y-6">
          <p className="text-muted-foreground">
            Exporte ou importe apenas as configuracoes do sistema (solicitantes, tipos de exame, templates,
            placeholders e preferencias). Ideal para compartilhar a estrutura entre instalacoes ou fazer
            manutencao sem afetar laudos e usuarios.
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                O que esta incluido e excluido
              </CardTitle>
              <CardDescription>
                O backup de configuracao contem apenas dados estruturais. Dados operacionais (laudos, REPs,
                usuarios) e credenciais de IA nao sao incluidos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Incluido no backup
                  </h4>
                  <ul className="space-y-2">
                    {ITENS_INCLUIDOS.map((item) => (
                      <li key={item.label} className="text-sm">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-muted-foreground"> — {item.desc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                    <XCircle className="h-4 w-4" />
                    Excluido do backup
                  </h4>
                  <ul className="space-y-2">
                    {ITENS_EXCLUIDOS.map((item) => (
                      <li key={item.label} className="text-sm">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-muted-foreground"> — {item.desc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" />
                  Exportar Configuracao
                </CardTitle>
                <CardDescription>
                  Gere um arquivo ZIP com as tabelas de configuracao do sistema. O arquivo pode ser
                  compartilhado com outros peritos para replicar a estrutura de trabalho.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleExportarConfig}
                  disabled={disabled}
                  className="w-full"
                >
                  {exportando ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {exportando ? 'Exportando...' : 'Exportar Configuracao...'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Importar Configuracao
                </CardTitle>
                <CardDescription>
                  Importe configuracoes de um arquivo ZIP previamente exportado. Novos registros serao
                  adicionados e os existentes serao atualizados.
                  <strong> Nenhum dado existente sera removido.</strong>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setDialogImportarAberto(true)}
                  disabled={disabled}
                  className="w-full"
                >
                  {importando ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {importando ? 'Importando...' : 'Selecionar Arquivo...'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmacao de restauracao completa */}
      <Dialog open={dialogRestaurarAberto} onOpenChange={setDialogRestaurarAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Restauracao
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>
                Esta acao substituira o banco de dados atual e todas as imagens pelos dados do arquivo de backup selecionado.
              </p>
              <p className="font-medium text-foreground">
                Recomenda-se criar um backup do estado atual antes de prosseguir.
              </p>
              <p>O aplicativo sera reiniciado automaticamente apos a restauracao.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogRestaurarAberto(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRestaurar}>
              Prosseguir com Restauracao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmacao de importacao de configuracao */}
      <Dialog open={dialogImportarAberto} onOpenChange={setDialogImportarAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Confirmar Importacao de Configuracao
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                Esta acao importara as configuracoes do arquivo selecionado (solicitantes, tipos de exame, templates,
                placeholders e preferencias).
              </p>
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p className="font-medium">Comportamento da importacao (UPSERT):</p>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                  <li>Registros novos serao <strong>adicionados</strong></li>
                  <li>Registros com mesmo ID serao <strong>atualizados</strong></li>
                  <li>Registros existentes nao listados no arquivo serao <strong>mantidos</strong></li>
                </ul>
              </div>
              <p className="font-medium text-foreground">
                Nenhum laudo, REP, usuario ou imagem sera afetado.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogImportarAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImportarConfig}>
              Importar Configuracao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
