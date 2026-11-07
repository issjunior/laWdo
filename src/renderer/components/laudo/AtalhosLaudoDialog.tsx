import { Fragment, useRef } from 'react';
import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface GrupoAtalhos {
  titulo: string;
  contexto: string;
  atalhos: Array<{ teclas: string[][]; descricao: string }>;
}

const GRUPOS_ATALHOS: GrupoAtalhos[] = [
  {
    titulo: 'Tabelas B601',
    contexto: 'Clique uma vez no campo compatível da tabela de projéteis ou estojos e use o atalho. Também funciona na célula do cursor ou na seleção de células. Respeita as permissões de edição.',
    atalhos: [
      { teclas: [['Ctrl', 'Shift', 'P']], descricao: 'Marcar como Prejudicado a célula atual ou as células selecionadas. A seleção inteira deve permitir o preenchimento.' },
      { teclas: [['Ctrl', 'Shift', 'A']], descricao: 'Marcar como Ausente a célula atual ou as células selecionadas. A seleção inteira deve permitir o preenchimento.' },
    ],
  },
  {
    titulo: 'Busca no laudo',
    contexto: 'Localize o texto exibido em todo o laudo, incluindo os valores dos placeholders.',
    atalhos: [
      { teclas: [['Ctrl', 'F']], descricao: 'Abrir a busca no laudo.' },
      { teclas: [['Enter']], descricao: 'Ir ao próximo resultado, com foco no campo de busca.' },
      { teclas: [['Shift', 'Enter']], descricao: 'Ir ao resultado anterior, com foco no campo de busca.' },
      { teclas: [['Esc']], descricao: 'Fechar a busca aberta.' },
    ],
  },
  {
    titulo: 'Salvar',
    contexto: 'Com foco na página, fora da área de texto do editor.',
    atalhos: [{ teclas: [['Ctrl', 'S']], descricao: 'Salvar as alterações do laudo, quando a ação estiver disponível.' }],
  },
  {
    titulo: 'Edição de texto',
    contexto: 'Com foco dentro do texto. No modo por seções, os comandos atuam no editor da seção em foco.',
    atalhos: [
      { teclas: [['Ctrl', 'Z']], descricao: 'Desfazer a última edição.' },
      { teclas: [['Ctrl', 'Y'], ['Ctrl', 'Shift', 'Z']], descricao: 'Refazer uma edição desfeita.' },
      { teclas: [['Ctrl', 'A']], descricao: 'Selecionar todo o conteúdo do editor em foco.' },
      { teclas: [['Ctrl', 'C']], descricao: 'Copiar o texto selecionado.' },
      { teclas: [['Ctrl', 'X']], descricao: 'Recortar o texto selecionado.' },
      { teclas: [['Ctrl', 'V']], descricao: 'Colar o conteúdo copiado.' },
      { teclas: [['Ctrl', 'Shift', 'V']], descricao: 'Colar como texto, sem a formatação original.' },
    ],
  },
  {
    titulo: 'Formatação e editor',
    contexto: 'Com foco dentro do texto. A formatação é aplicada à seleção ou ao texto que você digitar em seguida.',
    atalhos: [
      { teclas: [['Ctrl', 'B']], descricao: 'Ativar ou desativar negrito.' },
      { teclas: [['Ctrl', 'I']], descricao: 'Ativar ou desativar itálico.' },
      { teclas: [['Ctrl', 'U']], descricao: 'Ativar ou desativar sublinhado.' },
      { teclas: [['Ctrl', 'K']], descricao: 'Inserir ou editar um link.' },
      { teclas: [['Ctrl', 'Shift', 'F']], descricao: 'Entrar ou sair da tela cheia do editor.' },
    ],
  },
];

export function AtalhosLaudoDialog({ aberto, onAbertoChange }: {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
}) {
  const origemFoco = useRef<HTMLElement | null>(null);
  return <Dialog open={aberto} onOpenChange={onAbertoChange}>
    <DialogContent className="flex max-h-[85vh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0"
      onOpenAutoFocus={() => { origemFoco.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
      onCloseAutoFocus={evento => {
        if (origemFoco.current?.isConnected) { evento.preventDefault(); origemFoco.current.focus(); }
      }}>
      <DialogHeader className="shrink-0 border-b p-6 pr-12 text-left">
        <DialogTitle className="flex items-center gap-2"><Keyboard className="size-5 shrink-0 text-primary" />Atalhos para elaborar o laudo</DialogTitle>
        <DialogDescription>Consulte os atalhos de teclado disponíveis no Windows e observe onde cada comando pode ser usado.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto px-4 sm:px-6" tabIndex={0} role="region" aria-label="Lista de atalhos">
        <Table className="table-fixed" containerClassName="overflow-visible">
          <TableHeader><TableRow><TableHead className="w-2/5">Atalho</TableHead><TableHead>Descrição</TableHead></TableRow></TableHeader>
          <TableBody>{GRUPOS_ATALHOS.map(grupo => <Fragment key={grupo.titulo}>
            <TableRow className="bg-muted/50 hover:bg-muted/50"><TableCell colSpan={2} className="py-3">
              <h3 className="font-semibold text-foreground">{grupo.titulo}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{grupo.contexto}</p>
            </TableCell></TableRow>
            {grupo.atalhos.map(atalho => <TableRow key={atalho.descricao}>
              <TableCell className="align-top"><div className="flex flex-wrap items-center gap-1.5">
                {atalho.teclas.map((combinacao, indice) => <Fragment key={combinacao.join('+')}>
                  {indice > 0 && <span className="text-xs text-muted-foreground">ou</span>}
                  <span className="inline-flex flex-wrap items-center gap-1" aria-label={combinacao.join(' + ')}>
                    {combinacao.map((tecla, posicao) => <Fragment key={tecla}>
                      {posicao > 0 && <span aria-hidden="true" className="text-xs text-muted-foreground">+</span>}
                      <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium shadow-sm">{tecla}</kbd>
                    </Fragment>)}
                  </span>
                </Fragment>)}
              </div></TableCell>
              <TableCell className="break-words align-top leading-relaxed">{atalho.descricao}</TableCell>
            </TableRow>)}
          </Fragment>)}</TableBody>
        </Table>
        <p className="py-4 text-xs leading-relaxed text-muted-foreground">Para substituir texto editável, use o botão “Localizar e substituir” na toolbar do editor. A busca do laWdo (Ctrl + F) permite localizar valores de placeholders e navegar pelos resultados.</p>
      </div>
      <DialogFooter className="shrink-0 border-t px-6 py-4"><Button type="button" onClick={() => onAbertoChange(false)}>Fechar</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
