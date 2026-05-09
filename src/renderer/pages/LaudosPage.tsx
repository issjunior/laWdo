import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Save, ArrowLeft, Edit, Search } from 'lucide-react';
import { TinyMceEditor } from '@/components/editor/TinyMceEditor';

interface LaudoItem {
  id: string;
  rep_id: string;
  perito_id: string;
  template_id: string;
  conteudo: string;
  status: string;
  data_inicio: string;
  data_conclusao?: string;
  data_entrega?: string;
  rep_numero: string;
  template_nome: string;
  status_rep: string;
  tipo_exame_nome?: string;
  nome_envolvido?: string;
}

const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
    'Em andamento': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'Concluído': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'Entregue': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

function formatarData(iso: string | undefined): string {
  if (!iso) return '-';
  const partes = iso.split('T')[0].split('-');
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export const LaudosPage: React.FC = () => {
  const [laudos, setLaudos] = useState<LaudoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editando, setEditando] = useState<LaudoItem | null>(null);
  const [conteudo, setConteudo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const carregarLaudos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const r = await window.ipcAPI.laudo.findAll();
      if (r.success && r.data) {
        setLaudos(r.data);
      } else {
        setError(r.error || 'Erro ao carregar laudos');
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar laudos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarLaudos();
  }, [carregarLaudos]);

  const filtered = laudos.filter(l =>
    l.rep_numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.template_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.nome_envolvido || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditar = (laudo: LaudoItem) => {
    setEditando(laudo);
    setConteudo(laudo.conteudo || '');
    setError(null);
    setSuccess(null);
  };

  const handleVoltar = () => {
    setEditando(null);
    setConteudo('');
    setError(null);
    setSuccess(null);
  };

  const handleSalvar = async () => {
    if (!editando) return;
    try {
      setSalvando(true);
      setError(null);
      setSuccess(null);

      const r = await window.ipcAPI.laudo.updateConteudo(editando.id, conteudo);
      if (r.success) {
        setSuccess('Laudo salvo com sucesso!');
        setEditando(prev => prev ? { ...prev, conteudo } : null);
        setLaudos(prev =>
          prev.map(l => (l.id === editando.id ? { ...l, conteudo } : l))
        );
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(r.error || 'Erro ao salvar laudo');
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar laudo');
    } finally {
      setSalvando(false);
    }
  };

  // Modo editor
  if (editando) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Editor de Laudo</h1>
            <p className="text-muted-foreground mt-1">
              REP: {editando.rep_numero}
              {editando.tipo_exame_nome && ` — ${editando.tipo_exame_nome}`}
              {editando.nome_envolvido && ` — ${editando.nome_envolvido}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleVoltar} className="flex items-center gap-2">
              <ArrowLeft size={16} /> Voltar
            </Button>
            <Button onClick={handleSalvar} disabled={salvando} className="flex items-center gap-2">
              <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <div>
                <CardTitle className="text-lg">Template: {editando.template_nome || 'Não definido'}</CardTitle>
                <CardDescription>
                  Status: {editando.status} &middot; Iniciado em {formatarData(editando.data_inicio)}
                  {editando.data_conclusao ? ` &middot; Concluído em ${formatarData(editando.data_conclusao)}` : ''}
                </CardDescription>
              </div>
              {statusBadge(editando.status)}
            </div>
          </CardHeader>
          <CardContent>
            {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
            {success && <Alert className="mb-4 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900/50"><AlertDescription className="text-green-800 dark:text-green-400">{success}</AlertDescription></Alert>}

            <TinyMceEditor
              value={conteudo}
              onChange={setConteudo}
              height={600}
              placeholder="Escreva o conteúdo do laudo..."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Modo lista
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Laudos</h1>
          <p className="text-muted-foreground mt-1">Escreva e edite os laudos periciais usando os templates cadastrados</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
            <div>
              <CardTitle>Laudos em Andamento</CardTitle>
              <CardDescription>{filtered.length} laudo(s) encontrado(s)</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por REP, template ou envolvido..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Nenhum laudo encontrado.' : 'Nenhum laudo cadastrado. Crie uma REP com template vinculado para gerar um laudo automaticamente.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº REP</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Tipo de Exame</TableHead>
                  <TableHead>Envolvido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(laudo => (
                  <TableRow key={laudo.id}>
                    <TableCell className="font-medium">{laudo.rep_numero}</TableCell>
                    <TableCell>{laudo.template_nome || 'Não definido'}</TableCell>
                    <TableCell>{laudo.tipo_exame_nome || '-'}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{laudo.nome_envolvido || '-'}</TableCell>
                    <TableCell>{statusBadge(laudo.status)}</TableCell>
                    <TableCell>{formatarData(laudo.data_inicio)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditar(laudo)} aria-label={`Editar laudo da REP ${laudo.rep_numero}`}>
                        <Edit size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
