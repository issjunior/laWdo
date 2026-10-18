import React, { useState, useEffect } from 'react';
import { FormField, FormItem, FormControl, FormMessage } from '@/components/forms/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, X } from 'lucide-react';
import type { Path } from 'react-hook-form';
import type { ExamSectionProps, REPFormData } from './types';
import { CIDADES_GDL } from './catalogos/cidades-gdl.catalogo';
type CampoRep = Path<REPFormData>;
const campoRep = (nome: string): CampoRep => nome;
const camposRep = (nomes: string[]): CampoRep[] => nomes;
function formatarNumeroBO(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 15);
  if (digits.length <= 4) return digits;
  const numero = digits.slice(0, -4);
  const ano = digits.slice(-4);
  return `${numero}/${ano}`;
}

const UF_OPTS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const DadosInvestigacaoFields: React.FC<ExamSectionProps & { codigoExame?: 'b601' | 'b602' }> = ({ form, camposPreenchidosGdl, codigoExame = 'b602' }) => {
  const prefixo = codigoExame
  const obrigatorio = codigoExame === 'b602' ? ' *' : ''
  const obterClasseGdl = (campo: string): string => (
    camposPreenchidosGdl?.has(campo)
      ? 'bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-800'
      : ''
  )
  const [numEnvolvidos, setNumEnvolvidos] = useState(() => {
    let maxIndex = 0;
    for (let i = 0; i < 10; i++) {
      const valor = form.getValues(campoRep(`${prefixo}_envolvidos_${i}`));
      if (valor && typeof valor === 'string' && valor.trim() !== '') {
        maxIndex = i;
      }
    }
    return Math.max(1, maxIndex + 1);
  });
  const envolvidosValores = form.watch(camposRep([
    `${prefixo}_envolvidos_0`, `${prefixo}_envolvidos_1`, `${prefixo}_envolvidos_2`,
    `${prefixo}_envolvidos_3`, `${prefixo}_envolvidos_4`, `${prefixo}_envolvidos_5`,
    `${prefixo}_envolvidos_6`, `${prefixo}_envolvidos_7`, `${prefixo}_envolvidos_8`,
    `${prefixo}_envolvidos_9`
  ]));

  useEffect(() => {
    let maxIndex = 0;
    for (let i = 0; i < 10; i++) {
      const valor = form.getValues(campoRep(`${prefixo}_envolvidos_${i}`));
      if (valor && typeof valor === 'string' && valor.trim() !== '') {
        maxIndex = i;
      }
    }
    const count = maxIndex + 1;
    if (count > numEnvolvidos) {
      setNumEnvolvidos(count);
    }
  }, [envolvidosValores, form, numEnvolvidos, prefixo]);

  const envolvidos = Array.from({ length: numEnvolvidos }, (_, i) => i);

  const removerEnvolvido = (indice: number): void => {
    for (let atual = indice; atual < numEnvolvidos - 1; atual++) {
      const proximo = atual + 1;
      form.setValue(
        campoRep(`${prefixo}_envolvidos_qualificacao_${atual}`),
        form.getValues(campoRep(`${prefixo}_envolvidos_qualificacao_${proximo}`)) || '',
        { shouldDirty: true, shouldValidate: true },
      );
      form.setValue(
        campoRep(`${prefixo}_envolvidos_${atual}`),
        form.getValues(campoRep(`${prefixo}_envolvidos_${proximo}`)) || '',
        { shouldDirty: true, shouldValidate: true },
      );
    }

    const ultimo = numEnvolvidos - 1;
    form.setValue(campoRep(`${prefixo}_envolvidos_qualificacao_${ultimo}`), '', { shouldDirty: true });
    form.setValue(campoRep(`${prefixo}_envolvidos_${ultimo}`), '', { shouldDirty: true, shouldValidate: true });
    setNumEnvolvidos((quantidade) => Math.max(1, quantidade - 1));
  };

  const adicionarEnvolvido = (): void => {
    form.setValue(campoRep(`${prefixo}_envolvidos_qualificacao_${numEnvolvidos}`), '');
    form.setValue(campoRep(`${prefixo}_envolvidos_${numEnvolvidos}`), '');
    setNumEnvolvidos((quantidade) => Math.min(10, quantidade + 1));
  };

  return (
    <div className="border rounded-lg p-4 bg-muted/30 space-y-4 overflow-hidden">
      <span className="text-xs font-semibold text-muted-foreground block mb-2">Dados da Investigação</span>

      {/* Envolvidos */}
      <div className="flex flex-col md:flex-row gap-2 items-start">
        <label className="text-sm font-medium shrink-0 md:w-[150px] md:pt-2.5">
          Envolvido(s){obrigatorio}
        </label>
        <div className="flex-1 space-y-2 min-w-0 w-full">
          {envolvidos.map((i) => {
            return (
              <div key={i} className="flex items-start gap-2">
                <span className="w-5 shrink-0 pt-2 text-sm text-muted-foreground">{i + 1}.</span>
                <FormField
                  control={form.control}
                  name={campoRep(`${prefixo}_envolvidos_qualificacao_${i}`)}
                  render={({ field }) => (
                    <FormItem className="w-36 sm:w-44 shrink-0 space-y-0">
                      <FormControl>
                        <Input
                          placeholder="Qualificação"
                          aria-label={`Qualificação do envolvido ${i + 1}`}
                          list={`${prefixo}-qualificacoes-envolvido`}
                          className={`text-sm font-normal ${obterClasseGdl(`${prefixo}_envolvidos_qualificacao_${i}`)}`}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={campoRep(`${prefixo}_envolvidos_${i}`)}
                  render={({ field }) => (
                    <FormItem className="flex-1 space-y-0 min-w-0">
                      <FormControl>
                        <Input
                          placeholder="Nome do envolvido"
                          aria-label={`Nome do envolvido ${i + 1}`}
                          className={obterClasseGdl(`${prefixo}_envolvidos_${i}`)}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex w-8 shrink-0">
                  {envolvidos.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Excluir envolvido ${i + 1}`}
                      onClick={() => removerEnvolvido(i)}
                    >
                      <X size={14} />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {numEnvolvidos < 10 && (
            <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    aria-label="Adicionar envolvido"
                    onClick={adicionarEnvolvido}
                  >
                    <Plus size={14} />
                    Adicionar envolvido
                  </Button>
            </div>
          )}
          <datalist id={`${prefixo}-qualificacoes-envolvido`}>
            <option value="EM PODER DE:" />
            <option value="AUTOR:" />
            <option value="VÍTIMA:" />
          </datalist>
        </div>
      </div>

      {/* Data e Local */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <label className="text-sm font-medium shrink-0 md:w-[150px]">
            Data da Ocorrência{obrigatorio}
          </label>
          <div className="flex-1 min-w-0 w-full">
            <FormField
              control={form.control}
              name={`${prefixo}_data_ocorrencia`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <label className="text-sm font-medium shrink-0 md:w-[60px]">
            Local{obrigatorio}
          </label>
          <div className="flex-1 flex items-center gap-1 min-w-0">
            <FormField
              control={form.control}
              name={`${prefixo}_local_bairro`}
              render={({ field }) => (
                <FormItem className="flex-1 min-w-0 space-y-0">
                  <FormControl>
                    <Input placeholder="Bairro" className="flex-1 min-w-0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <span className="text-muted-foreground shrink-0 text-sm">/</span>
            <FormField
              control={form.control}
              name={`${prefixo}_local_cidade`}
              render={({ field }) => (
                <FormItem className="flex-1 min-w-0 space-y-0">
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className={`flex-1 min-w-0 ${obterClasseGdl(`${prefixo}_local_cidade`)}`}>
                        <SelectValue placeholder="Cidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CIDADES_GDL.map((cidade) => (
                        <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <span className="text-muted-foreground shrink-0 text-sm">/</span>
            <FormField
              control={form.control}
              name={`${prefixo}_local_uf`}
              render={({ field }) => (
                <FormItem className="w-[72px] shrink-0 space-y-0">
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {UF_OPTS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>

      {/* BO e IP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <label className="text-sm font-medium shrink-0 md:w-[150px]">
            Boletim de Ocorrência
          </label>
          <div className="flex-1 min-w-0 w-full">
            <FormField
              control={form.control}
              name={`${prefixo}_numero_bo`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Boletim de Ocorrência"
                      className={obterClasseGdl(`${prefixo}_numero_bo`)}
                      value={field.value || ''}
                      onChange={(e) => {
                        form.setValue(`${prefixo}_numero_bo`, formatarNumeroBO(e.target.value), { shouldDirty: true });
                        void form.trigger([`${prefixo}_numero_bo`, `${prefixo}_numero_ip`]);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <label className="text-sm font-medium shrink-0 md:w-[60px]">
            Nº do IP
          </label>
          <div className="flex-1 min-w-0 w-full">
            <FormField
              control={form.control}
              name={`${prefixo}_numero_ip`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Inquérito Policial"
                      className={obterClasseGdl(`${prefixo}_numero_ip`)}
                      value={field.value || ''}
                      onChange={(e) => {
                        form.setValue(`${prefixo}_numero_ip`, e.target.value, { shouldDirty: true });
                        void form.trigger([`${prefixo}_numero_bo`, `${prefixo}_numero_ip`]);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>

      {/* Unidade Policial */}
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <div className="shrink-0 md:w-[150px]">
          <Tooltip>
            <TooltipTrigger asChild>
              <label className="text-sm font-medium cursor-help">
                Unidade Policial
              </label>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="max-w-[250px] text-xs">
                Preenchido automaticamente com o nome do Solicitante selecionado acima.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex-1 min-w-0 w-full">
          <FormField
            control={form.control}
            name={`${prefixo}_solicitante_nome`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...field}
                    disabled
                    placeholder="Preenchido automaticamente"
                    className="bg-muted cursor-not-allowed"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
};
