import React from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { segmentarTextoComPlaceholders } from '@/lib/utils';
import {
  type DiagnosticoSecaoTemplate,
  type OpcaoSecaoPai,
  type SecaoTemplateEstrutural,
  type ToggleTemplateOption,
  getAjudaConfiguracaoSecao,
  getResumoConfiguracaoSecao,
} from './secao-configuracao-template.utils';

interface SecaoConfiguracaoTemplateProps {
  secao: SecaoTemplateEstrutural;
  index: number;
  total: number;
  tipoExameCodigo?: string;
  opcoesSecaoPai: OpcaoSecaoPai[];
  exameToggles?: ToggleTemplateOption[];
  opcoesRepeticao: Array<{ value: string; label: string }>;
  placeholderChaves: string[];
  diagnosticos: DiagnosticoSecaoTemplate[];
  podeSubir: boolean;
  podeDescer: boolean;
  dragHandleProps: {
    attributes: React.ButtonHTMLAttributes<HTMLButtonElement>;
    listeners: React.ButtonHTMLAttributes<HTMLButtonElement>;
  };
  onUpdateSecao: (field: 'nome' | 'condicao' | 'parent_id' | 'repetir_para' | 'repetir_titulo', value: string) => void;
  onMoveSecao: (direction: 'up' | 'down') => void;
  onRemoveSecao: () => void;
}

export const SecaoConfiguracaoTemplate: React.FC<SecaoConfiguracaoTemplateProps> = ({
  secao,
  index,
  total,
  tipoExameCodigo,
  opcoesSecaoPai,
  exameToggles = [],
  opcoesRepeticao,
  placeholderChaves,
  diagnosticos,
  podeSubir,
  podeDescer,
  dragHandleProps,
  onUpdateSecao,
  onMoveSecao,
  onRemoveSecao,
}) => {
  const resumo = getResumoConfiguracaoSecao(secao, opcoesSecaoPai, exameToggles);
  const ajuda = getAjudaConfiguracaoSecao(secao, tipoExameCodigo);
  const erros = diagnosticos.filter(item => item.tipo === 'erro');
  const avisos = diagnosticos.filter(item => item.tipo === 'aviso');
  const tipoSecao = secao.parent_id ? 'Subseção' : 'Seção principal';
  const opcoesRepeticaoRenderizadas = secao.repetir_para && !opcoesRepeticao.some(opcao => opcao.value === secao.repetir_para)
    ? [...opcoesRepeticao, { value: secao.repetir_para, label: 'Configuração atual não suportada' }]
    : opcoesRepeticao;
  const segmentosTituloRepeticao = segmentarTextoComPlaceholders(secao.repetir_titulo || '', placeholderChaves);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <button
            type="button"
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
            className="mt-1 p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            aria-label="Reordenar seção"
          >
            <GripVertical size={16} />
          </button>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Badge variant="outline" className="w-fit">
                {tipoSecao} · {index + 1} de {total}
              </Badge>
              <Input
                value={secao.nome}
                onChange={e => onUpdateSecao('nome', e.target.value)}
                placeholder="Nome da seção"
                className="h-9 flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">{resumo}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => onMoveSecao('up')} disabled={!podeSubir} aria-label="Mover para cima">
            <ArrowUp size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onMoveSecao('down')} disabled={!podeDescer} aria-label="Mover para baixo">
            <ArrowDown size={14} />
          </Button>
          <Button variant="ghost" size="sm" className="text-red-600" onClick={onRemoveSecao} aria-label="Remover seção">
            <X size={14} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {exameToggles.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Visibilidade</Label>
            <Select
              value={secao.condicao || '__always__'}
              onValueChange={valor => onUpdateSecao('condicao', valor === '__always__' ? '' : valor)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Escolha quando mostrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__always__">Sempre mostrar</SelectItem>
                {exameToggles.map(toggle => (
                  <SelectItem key={toggle.id} value={JSON.stringify({ campo: toggle.id, valor: 'on' })}>
                    {toggle.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ajuda.visibilidade}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Estrutura</Label>
          <Select
            value={secao.parent_id || '__root__'}
            onValueChange={valor => onUpdateSecao('parent_id', valor === '__root__' ? '' : valor)}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Escolha a posição da seção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__root__">Seção principal</SelectItem>
              {opcoesSecaoPai
                .filter(opcao => opcao.value !== (secao.id || secao.chave_local))
                .map(opcao => (
                  <SelectItem key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{ajuda.estrutura}</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Repetição</Label>
          <Select
            value={secao.repetir_para || '__none__'}
            onValueChange={valor => onUpdateSecao('repetir_para', valor === '__none__' ? '' : valor)}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Escolha a estratégia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Conteúdo único</SelectItem>
              {opcoesRepeticaoRenderizadas.map(opcao => (
                <SelectItem key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{ajuda.repeticao}</p>
        </div>
      </div>

      {secao.repetir_para === 'armas' && (
        <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-950/20">
          <Label className="text-xs font-medium text-amber-950 dark:text-amber-100">
            Título de cada arma
          </Label>
          <Input
            value={secao.repetir_titulo || ''}
            onChange={e => onUpdateSecao('repetir_titulo', e.target.value)}
            placeholder="Ex: ARMA {{b602_arma_1_letra}} - {{b602_arma_1_tipo}}"
            className="h-9 font-mono text-xs"
          />
          {(secao.repetir_titulo || '').trim() && (
            <div className="rounded-md border border-amber-200/80 bg-white/80 px-3 py-2 dark:border-amber-800/70 dark:bg-amber-950/10">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-amber-900 dark:text-amber-100">
                Prévia visual
              </p>
              <p className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                {segmentosTituloRepeticao.map((segmento, index) => (
                  segmento.tipo === 'placeholder' ? (
                    <span
                      key={`${segmento.valor}-${index}`}
                      className="mx-[1px] inline-flex rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                    >
                      {segmento.valor}
                    </span>
                  ) : (
                    <React.Fragment key={`${segmento.valor}-${index}`}>{segmento.valor}</React.Fragment>
                  )
                ))}
              </p>
            </div>
          )}
          <p className="text-xs text-amber-900 dark:text-amber-100">
            Use placeholders com <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">_1_</code> como padrão.
            O bloco repetido sempre reflete a REP atual. Edições manuais nesses blocos serão reescritas quando os dados da REP mudarem.
          </p>
        </div>
      )}

      {diagnosticos.length > 0 && (
        <div className="space-y-2">
          {erros.map(erro => (
            <div
              key={`erro-${erro.mensagem}`}
              className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{erro.mensagem}</span>
            </div>
          ))}
          {avisos.map(aviso => (
            <div
              key={`aviso-${aviso.mensagem}`}
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{aviso.mensagem}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
