import React, { useState, useEffect } from 'react';
import { FormField, FormItem, FormControl, FormMessage } from '@/components/forms/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, X } from 'lucide-react';
import type { Path } from 'react-hook-form';
import type { ExamSectionProps, MenuSection, REPFormData } from './types';

type CampoRep = Path<REPFormData>;

const campoRep = (nome: string): CampoRep => nome as CampoRep;
const camposRep = (nomes: string[]): CampoRep[] => nomes.map(campoRep);

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
    {children}
  </label>
);

const NATUREZA_OPTS = ['Arma', 'Munição', 'Acessório', 'Cartucho', 'Estojo'] as const;
const TIPO_OPTS = ['Artesanal', 'Carabina', 'Cartucho', 'Espingarda', 'Garrucha', 'Pistola', 'Revólver'] as const;
const CALIBRE_OPTS = ['.380 AUTO', '9 mm Luger', '.38 SPL'] as const;
const MARCA_OPTS = ['Aguila', 'Blazer', 'CBC', 'R-P (Remington)', 'Speer'] as const;
const PAISES = [
  'Brasil', 'Argentina', 'Bolívia', 'Chile', 'Colômbia', 'Equador',
  'Paraguai', 'Peru', 'Uruguai', 'Venezuela', 'EUA', 'China', 'Rússia',
  'Alemanha', 'Itália', 'Espanha', 'Portugal', 'França', 'Reino Unido',
  'Japão', 'Coreia do Sul', 'Índia', 'África do Sul', 'Austrália',
] as const;
const ESPOLETA_OPTS = ['Latonada', 'Niquelada'] as const;
const ESTOJO_OPTS = ['Latonada', 'Niquelada'] as const;
const PROJETIL_OPTS = [
  'CHOG – Chumbo Ogival',
  'CHPP – Chumbo Ponta Plana',
  'CSCV – Chumbo Semi Canto Vivo',
  'CHCV – Chumbo Canto Vivo',
  'EXPP – Expansivo Ponta Plana',
  'ETOG – Encamisado Total Ogival',
  'EXPO – Expansivo Ponta Oca',
  'ETPP – Encamisado Total Ponta Plana',
  'ETPT – Encamisado Total Pontiagudo',
] as const;
const OBS_CARTUCHO_OPTS = ['Intacto', 'NTA', 'Picotado', 'Percutido', 'Não deflagrado'] as const;

function formatarNumeroBO(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return digits;
  const year = digits.slice(0, 4);
  const num = digits.slice(4, 10);
  return `${year}/${num}`;
}

const UF_OPTS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const DadosInvestigacaoFields: React.FC<ExamSectionProps> = ({ form }) => {
  const [numEnvolvidos, setNumEnvolvidos] = useState(() => {
    let maxIndex = 0;
    for (let i = 0; i < 10; i++) {
      const valor = form.getValues(campoRep(`b602_envolvidos_${i}`));
      if (valor && typeof valor === 'string' && valor.trim() !== '') {
        maxIndex = i;
      }
    }
    return Math.max(1, maxIndex + 1);
  });

  const envolvidosValores = form.watch(camposRep([
    'b602_envolvidos_0', 'b602_envolvidos_1', 'b602_envolvidos_2',
    'b602_envolvidos_3', 'b602_envolvidos_4', 'b602_envolvidos_5',
    'b602_envolvidos_6', 'b602_envolvidos_7', 'b602_envolvidos_8',
    'b602_envolvidos_9'
  ]));

  useEffect(() => {
    let maxIndex = 0;
    for (let i = 0; i < 10; i++) {
      const valor = form.getValues(campoRep(`b602_envolvidos_${i}`));
      if (valor && typeof valor === 'string' && valor.trim() !== '') {
        maxIndex = i;
      }
    }
    const count = maxIndex + 1;
    if (count > numEnvolvidos) {
      setNumEnvolvidos(count);
    }
  }, [envolvidosValores, form, numEnvolvidos]);

  const envolvidos = Array.from({ length: numEnvolvidos }, (_, i) => i);

  return (
    <div className="border rounded-lg p-4 bg-muted/30 space-y-4 overflow-hidden">
      <span className="text-xs font-semibold text-muted-foreground block mb-2">Dados da Investigação</span>

      {/* Envolvidos */}
      <div className="flex flex-col md:flex-row gap-2 items-start">
        <label className="text-sm font-medium shrink-0 md:w-[150px] md:pt-2.5">
          Envolvido(s) *
        </label>
        <div className="flex-1 space-y-2 min-w-0 w-full">
          {envolvidos.map((i) => {
            const isLast = i === envolvidos.length - 1;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                <FormField
                  control={form.control}
                  name={`b602_envolvidos_${i}`}
                  render={({ field }) => (
                    <FormItem className="flex-1 space-y-0 min-w-0">
                      <FormControl>
                        <Input placeholder="Nome do envolvido" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {envolvidos.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      form.setValue(`b602_envolvidos_${i}`, '');
                      setNumEnvolvidos((n) => Math.max(1, n - 1));
                    }}
                  >
                    <X size={14} />
                  </Button>
                )}
                {isLast && numEnvolvidos < 10 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setNumEnvolvidos((n) => n + 1)}
                  >
                    <Plus size={14} />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Data e Local */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <label className="text-sm font-medium shrink-0 md:w-[150px]">
            Data da Ocorrência *
          </label>
          <div className="flex-1 min-w-0 w-full">
            <FormField
              control={form.control}
              name="b602_data_ocorrencia"
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
            Local *
          </label>
          <div className="flex-1 flex items-center gap-1 min-w-0">
            <FormField
              control={form.control}
              name="b602_local_bairro"
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
              name="b602_local_cidade"
              render={({ field }) => (
                <FormItem className="flex-1 min-w-0 space-y-0">
                  <FormControl>
                    <Input placeholder="Cidade" className="flex-1 min-w-0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <span className="text-muted-foreground shrink-0 text-sm">/</span>
            <FormField
              control={form.control}
              name="b602_local_uf"
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
              name="b602_numero_bo"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="2026/123456"
                      value={field.value || ''}
                      onChange={(e) => field.onChange(formatarNumeroBO(e.target.value))}
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
              name="b602_numero_ip"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Inquérito Policial" {...field} />
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
            name="b602_solicitante_nome"
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

function ToggleSection({
  form,
  toggleName,
  label,
  children,
}: {
  form: ExamSectionProps['form'];
  toggleName: string;
  label: string;
  children: (active: boolean) => React.ReactNode;
}) {
  const toggleValue = form.watch(campoRep(toggleName)) as string | undefined;
  const active = toggleValue === 'on';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Checkbox
          id={toggleName}
          checked={active}
          onCheckedChange={(checked) => {
            form.setValue(campoRep(toggleName), checked ? 'on' : 'off', {
              shouldValidate: false,
              shouldDirty: true,
            });
          }}
        />
        <label htmlFor={toggleName} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
          {label}
        </label>
      </div>
      {children(active)}
    </div>
  );
}

export const MaterialEncFields: React.FC<ExamSectionProps> = ({ form }) => {
  const [numLinhas, setNumLinhas] = useState(() => {
    let maxIndex = 0;
    for (let i = 0; i < 10; i++) {
      const prefix = `b602_material_enc_${i}_`;
      const natureza = form.getValues(campoRep(`${prefix}natureza`));
      const quantidade = form.getValues(campoRep(`${prefix}quantidade`));
      const tipo = form.getValues(campoRep(`${prefix}tipo`));
      const dito = form.getValues(campoRep(`${prefix}dito_oficio`));
      const lacre = form.getValues(campoRep(`${prefix}numero_lacre`));
      if (natureza || quantidade || tipo || dito || lacre) {
        maxIndex = i;
      }
    }
    return Math.max(1, maxIndex + 1);
  });

  const materialValores = form.watch(camposRep([
    'b602_material_enc_0_natureza', 'b602_material_enc_1_natureza',
    'b602_material_enc_2_natureza', 'b602_material_enc_3_natureza',
    'b602_material_enc_4_natureza', 'b602_material_enc_5_natureza',
    'b602_material_enc_6_natureza', 'b602_material_enc_7_natureza',
    'b602_material_enc_8_natureza', 'b602_material_enc_9_natureza'
  ]));

  useEffect(() => {
    let maxIndex = 0;
    for (let i = 0; i < 10; i++) {
      const prefix = `b602_material_enc_${i}_`;
      const natureza = form.getValues(campoRep(`${prefix}natureza`));
      const quantidade = form.getValues(campoRep(`${prefix}quantidade`));
      const tipo = form.getValues(campoRep(`${prefix}tipo`));
      const dito = form.getValues(campoRep(`${prefix}dito_oficio`));
      const lacre = form.getValues(campoRep(`${prefix}numero_lacre`));
      if (natureza || quantidade || tipo || dito || lacre) {
        maxIndex = i;
      }
    }
    const count = maxIndex + 1;
    if (count > numLinhas) {
      setNumLinhas(count);
    }
  }, [materialValores, form, numLinhas]);

  const ARMA_CAMPOS = [
    { key: 'arma_marca', label: 'Marca', placeholder: 'Marca' },
    { key: 'arma_calibre', label: 'Calibre', placeholder: 'Calibre' },
    { key: 'arma_numeracao_serie', label: 'Nº Série', placeholder: 'Nº Série' },
    { key: 'arma_numeracao_cano', label: 'Nº Cano', placeholder: 'Nº Cano' },
    { key: 'arma_capacidade_carregador', label: 'Capacid. Carreg.', placeholder: 'Capacidade' },
    { key: 'arma_comprimento_cano', label: 'Compr. Cano', placeholder: 'Compr. Cano' },
    { key: 'arma_acabamento', label: 'Acabamento', placeholder: 'Acabamento' },
    { key: 'arma_funcionamento', label: 'Funcionamento', placeholder: 'Funcionamento' },
    { key: 'arma_estado_conservacao', label: 'Est. Conservação', placeholder: 'Conservação' },
  ];

  return (
    <div className="space-y-3">
      {Array.from({ length: numLinhas }, (_, i) => {
        const prefix = `b602_material_enc_${i}_`;
        const natureza = form.watch(campoRep(`${prefix}natureza`)) as string | undefined;
        const isArma = natureza === 'Arma';
        return (
          <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Item {i + 1}</span>
              {numLinhas > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    const pf = `b602_material_enc_${i}_`;
                    ['natureza', 'quantidade', 'tipo', 'dito_oficio', 'numero_lacre',
                     'arma_marca', 'arma_calibre', 'arma_numeracao_serie', 'arma_numeracao_cano',
                     'arma_capacidade_carregador', 'arma_comprimento_cano', 'arma_acabamento',
                     'arma_funcionamento', 'arma_estado_conservacao'].forEach((f) =>
                      form.setValue(campoRep(`${pf}${f}`), '')
                    );
                    setNumLinhas((n) => Math.max(1, n - 1));
                  }}
                >
                  <X size={12} />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              <FormField
                control={form.control}
                name={`${prefix}natureza`}
                render={({ field }) => (
                  <FormItem>
                    <Label>Natureza *</Label>
                    <Select value={field.value || 'Arma'} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NATUREZA_OPTS.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`${prefix}quantidade`}
                render={({ field }) => (
                  <FormItem>
                    <Label>Qtd *</Label>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        placeholder="01"
                        {...field}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                          field.onChange(v);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`${prefix}tipo`}
                render={({ field }) => (
                  <FormItem>
                    <Label>Tipo *</Label>
                    <Select value={field.value || 'Pistola'} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIPO_OPTS.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`${prefix}dito_oficio`}
                render={({ field }) => (
                  <FormItem>
                    <Label>Dito do Ofício *</Label>
                    <FormControl>
                      <Input placeholder='"texto texto"' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`${prefix}numero_lacre`}
                render={({ field }) => (
                  <FormItem>
                    <Label>Nº do Lacre *</Label>
                    <FormControl>
                      <Input placeholder="Nº do lacre" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {isArma && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 pt-2 border-t border-dashed border-muted-foreground/20">
                <span className="col-span-full text-xs text-muted-foreground font-medium">Especificações da Arma</span>
                {ARMA_CAMPOS.map((campo) => (
                  <FormField
                    key={campo.key}
                    control={form.control}
                    name={`${prefix}${campo.key}`}
                    render={({ field }) => (
                      <FormItem>
                        <Label>{campo.label}</Label>
                        <FormControl>
                          <Input placeholder={campo.placeholder} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setNumLinhas((n) => n + 1)}
      >
        <Plus size={14} className="mr-1" /> Adicionar item
      </Button>
    </div>
  );
};

function LinhaTabelaBalistica({
  form,
  prefix,
  showProjetil,
}: {
  form: ExamSectionProps['form'];
  prefix: string;
  showProjetil: boolean;
}) {
  const obsValue = (form.watch(campoRep(`${prefix}_observacao`)) as string) || '';
  const selectedObs = obsValue ? obsValue.split(',') : [];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
      <FormField
        control={form.control}
        name={`${prefix}_quantidade`}
        render={({ field }) => (
          <FormItem>
            <Label>Qtd *</Label>
            <FormControl>
              <Input
                type="number"
                min={1}
                max={999}
                placeholder="0"
                {...field}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 3);
                  field.onChange(v);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`${prefix}_calibre`}
        render={({ field }) => (
          <FormItem>
            <Label>Calibre *</Label>
            <Select value={field.value || undefined} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {CALIBRE_OPTS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`${prefix}_marca`}
        render={({ field }) => (
          <FormItem>
            <Label>Marca *</Label>
            <Select value={field.value || 'CBC'} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {MARCA_OPTS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`${prefix}_origem`}
        render={({ field }) => (
          <FormItem>
            <Label>Origem *</Label>
            <Select value={field.value || 'Brasil'} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {PAISES.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`${prefix}_espoleta`}
        render={({ field }) => (
          <FormItem>
            <Label>Espoleta *</Label>
            <Select value={field.value || undefined} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {ESPOLETA_OPTS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`${prefix}_estojo`}
        render={({ field }) => (
          <FormItem>
            <Label>Estojo *</Label>
            <Select value={field.value || undefined} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {ESTOJO_OPTS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      {showProjetil && (
        <FormField
          control={form.control}
          name={`${prefix}_projetil`}
          render={({ field }) => (
            <FormItem>
              <Label>Projétil *</Label>
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-72">
                  {PROJETIL_OPTS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      <FormField
        control={form.control}
        name={`${prefix}_observacao`}
        render={({ field }) => (
          <FormItem>
            <Label>Observação</Label>
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2">
              {OBS_CARTUCHO_OPTS.map((opt) => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedObs.includes(opt)}
                    onCheckedChange={(checked) => {
                      const current = selectedObs.filter((o) => o !== opt);
                      if (checked) current.push(opt);
                      field.onChange(current.join(','));
                    }}
                  />
                  {opt}
                </label>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export const CartuchosFields: React.FC<ExamSectionProps> = ({ form }) => {
  const [numLinhas, setNumLinhas] = useState(() => {
    let maxIndex = 0;
    for (let i = 0; i < 10; i++) {
      const prefix = `b602_cartuchos_${i}_`;
      const qtd = form.getValues(campoRep(`${prefix}quantidade`));
      const calibre = form.getValues(campoRep(`${prefix}calibre`));
      const marca = form.getValues(campoRep(`${prefix}marca`));
      const origem = form.getValues(campoRep(`${prefix}origem`));
      const espoleta = form.getValues(campoRep(`${prefix}espoleta`));
      const estojo = form.getValues(campoRep(`${prefix}estojo`));
      const projetil = form.getValues(campoRep(`${prefix}projetil`));
      const obs = form.getValues(campoRep(`${prefix}observacao`));
      if (qtd || calibre || marca || origem || espoleta || estojo || projetil || obs) {
        maxIndex = i;
      }
    }
    return Math.max(1, maxIndex + 1);
  });

  const cartuchosValores = form.watch(camposRep([
    'b602_cartuchos_0_quantidade', 'b602_cartuchos_1_quantidade',
    'b602_cartuchos_2_quantidade', 'b602_cartuchos_3_quantidade',
    'b602_cartuchos_4_quantidade', 'b602_cartuchos_5_quantidade',
    'b602_cartuchos_6_quantidade', 'b602_cartuchos_7_quantidade',
    'b602_cartuchos_8_quantidade', 'b602_cartuchos_9_quantidade'
  ]));

  useEffect(() => {
    let maxIndex = 0;
    for (let i = 0; i < 10; i++) {
      const prefix = `b602_cartuchos_${i}_`;
      const qtd = form.getValues(campoRep(`${prefix}quantidade`));
      const calibre = form.getValues(campoRep(`${prefix}calibre`));
      const marca = form.getValues(campoRep(`${prefix}marca`));
      const origem = form.getValues(campoRep(`${prefix}origem`));
      const espoleta = form.getValues(campoRep(`${prefix}espoleta`));
      const estojo = form.getValues(campoRep(`${prefix}estojo`));
      const projetil = form.getValues(campoRep(`${prefix}projetil`));
      const obs = form.getValues(campoRep(`${prefix}observacao`));
      if (qtd || calibre || marca || origem || espoleta || estojo || projetil || obs) {
        maxIndex = i;
      }
    }
    const count = maxIndex + 1;
    if (count > numLinhas) {
      setNumLinhas(count);
    }
  }, [cartuchosValores, form, numLinhas]);

  return (
    <ToggleSection form={form} toggleName="b602_cartuchos_toggle" label="Possui Cartuchos?">
      {(active) =>
        active ? (
          <div className="space-y-3">
            {Array.from({ length: numLinhas }, (_, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Item {i + 1}</span>
                  {numLinhas > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => setNumLinhas((n) => Math.max(1, n - 1))}
                    >
                      <X size={12} />
                    </Button>
                  )}
                </div>
                <LinhaTabelaBalistica
                  form={form}
                  prefix={`b602_cartuchos_${i}`}
                  showProjetil={true}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNumLinhas((n) => n + 1)}
            >
              <Plus size={14} className="mr-1" /> Adicionar item
            </Button>
          </div>
        ) : null
      }
    </ToggleSection>
  );
};

export const EstojosFields: React.FC<ExamSectionProps> = ({ form }) => {
  const [numLinhas, setNumLinhas] = useState(() => {
    let maxIndex = 0;
    for (let i = 0; i < 10; i++) {
      const prefix = `b602_estojos_${i}_`;
      const qtd = form.getValues(campoRep(`${prefix}quantidade`));
      const calibre = form.getValues(campoRep(`${prefix}calibre`));
      const marca = form.getValues(campoRep(`${prefix}marca`));
      const origem = form.getValues(campoRep(`${prefix}origem`));
      const espoleta = form.getValues(campoRep(`${prefix}espoleta`));
      const estojo = form.getValues(campoRep(`${prefix}estojo`));
      const obs = form.getValues(campoRep(`${prefix}observacao`));
      if (qtd || calibre || marca || origem || espoleta || estojo || obs) {
        maxIndex = i;
      }
    }
    return Math.max(1, maxIndex + 1);
  });

  const estojosValores = form.watch(camposRep([
    'b602_estojos_0_quantidade', 'b602_estojos_1_quantidade',
    'b602_estojos_2_quantidade', 'b602_estojos_3_quantidade',
    'b602_estojos_4_quantidade', 'b602_estojos_5_quantidade',
    'b602_estojos_6_quantidade', 'b602_estojos_7_quantidade',
    'b602_estojos_8_quantidade', 'b602_estojos_9_quantidade'
  ]));

  useEffect(() => {
    let maxIndex = 0;
    for (let i = 0; i < 10; i++) {
      const prefix = `b602_estojos_${i}_`;
      const qtd = form.getValues(campoRep(`${prefix}quantidade`));
      const calibre = form.getValues(campoRep(`${prefix}calibre`));
      const marca = form.getValues(campoRep(`${prefix}marca`));
      const origem = form.getValues(campoRep(`${prefix}origem`));
      const espoleta = form.getValues(campoRep(`${prefix}espoleta`));
      const estojo = form.getValues(campoRep(`${prefix}estojo`));
      const obs = form.getValues(campoRep(`${prefix}observacao`));
      if (qtd || calibre || marca || origem || espoleta || estojo || obs) {
        maxIndex = i;
      }
    }
    const count = maxIndex + 1;
    if (count > numLinhas) {
      setNumLinhas(count);
    }
  }, [estojosValores, form, numLinhas]);

  return (
    <ToggleSection form={form} toggleName="b602_estojos_toggle" label="Possui Estojos?">
      {(active) =>
        active ? (
          <div className="space-y-3">
            {Array.from({ length: numLinhas }, (_, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Item {i + 1}</span>
                  {numLinhas > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => setNumLinhas((n) => Math.max(1, n - 1))}
                    >
                      <X size={12} />
                    </Button>
                  )}
                </div>
                <LinhaTabelaBalistica
                  form={form}
                  prefix={`b602_estojos_${i}`}
                  showProjetil={false}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNumLinhas((n) => n + 1)}
            >
              <Plus size={14} className="mr-1" /> Adicionar item
            </Button>
          </div>
        ) : null
      }
    </ToggleSection>
  );
};

export const ArmasFields: React.FC<ExamSectionProps> = ({ form }) => {
  const [numLinhas, setNumLinhas] = useState(() => {
    let maxIndex = 0;
    for (let i = 0; i < 10; i++) {
      const prefix = `b602_armas_${i}_`;
      const tipo = form.getValues(campoRep(`${prefix}tipo`));
      const marca = form.getValues(campoRep(`${prefix}marca`));
      if (tipo || marca) { maxIndex = i; }
    }
    return Math.max(1, maxIndex + 1);
  });

  const armasValores = form.watch(camposRep([
    'b602_armas_0_tipo', 'b602_armas_0_marca',
    'b602_armas_1_tipo', 'b602_armas_1_marca',
    'b602_armas_2_tipo', 'b602_armas_2_marca',
    'b602_armas_3_tipo', 'b602_armas_3_marca',
    'b602_armas_4_tipo', 'b602_armas_4_marca',
    'b602_armas_5_tipo', 'b602_armas_5_marca',
    'b602_armas_6_tipo', 'b602_armas_6_marca',
    'b602_armas_7_tipo', 'b602_armas_7_marca',
    'b602_armas_8_tipo', 'b602_armas_8_marca',
    'b602_armas_9_tipo', 'b602_armas_9_marca',
  ]));

  useEffect(() => {
    let maxIndex = 0;
    for (let i = 0; i < 10; i++) {
      const prefix = `b602_armas_${i}_`;
      const tipo = form.getValues(campoRep(`${prefix}tipo`));
      const marca = form.getValues(campoRep(`${prefix}marca`));
      if (tipo || marca) { maxIndex = i; }
    }
    const count = maxIndex + 1;
    if (count > numLinhas) setNumLinhas(count);
  }, [armasValores, form, numLinhas]);

  const ARMA_CAMPOS = [
    { key: 'tipo', label: 'Tipo *', type: 'select', opts: TIPO_OPTS },
    { key: 'marca', label: 'Marca *', type: 'input' },
    { key: 'modelo', label: 'Modelo', type: 'input' },
    { key: 'calibre', label: 'Calibre *', type: 'input' },
    { key: 'numeracao_serie', label: 'Nº Série', type: 'input' },
    { key: 'numeracao_cano', label: 'Nº Cano', type: 'input' },
    { key: 'capacidade_carregador', label: 'Cap. Carreg.', type: 'input' },
    { key: 'comprimento_cano', label: 'Compr. Cano', type: 'input' },
    { key: 'acabamento', label: 'Acabamento', type: 'input' },
    { key: 'funcionamento', label: 'Funcionamento *', type: 'input' },
    { key: 'estado_conservacao', label: 'Est. Conservação *', type: 'input' },
    { key: 'quantidade', label: 'Qtd *', type: 'qtd' },
    { key: 'dito_oficio', label: 'Dito Ofício *', type: 'input' },
    { key: 'numero_lacre', label: 'Nº Lacre *', type: 'input' },
  ];

  return (
    <ToggleSection form={form} toggleName="b602_armas_toggle" label="Possui Arma(s)?">
      {(active) =>
        active ? (
          <div className="space-y-4">
            {Array.from({ length: numLinhas }, (_, i) => {
              const prefix = `b602_armas_${i}_`;
              return (
                <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Arma {i + 1}</span>
                    {numLinhas > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          ARMA_CAMPOS.forEach((c) =>
                            form.setValue(campoRep(`${prefix}${c.key}`), '')
                          );
                          form.setValue(campoRep(`${prefix}func_toggle`), 'off');
                          form.setValue(campoRep(`${prefix}coleta_toggle`), 'off');
                          setNumLinhas((n) => Math.max(1, n - 1));
                        }}
                      >
                        <X size={12} />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {ARMA_CAMPOS.map((campo) => {
                      if (campo.type === 'select') {
                        return (
                          <FormField
                            key={campo.key}
                            control={form.control}
                            name={`${prefix}${campo.key}`}
                            render={({ field }) => (
                              <FormItem>
                                <Label>{campo.label}</Label>
                                <Select value={field.value || undefined} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {campo.opts!.map((o: string) => (
                                      <SelectItem key={o} value={o}>{o}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        );
                      }
                      if (campo.type === 'qtd') {
                        return (
                          <FormField
                            key={campo.key}
                            control={form.control}
                            name={`${prefix}${campo.key}`}
                            render={({ field }) => (
                              <FormItem>
                                <Label>{campo.label}</Label>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={99}
                                    placeholder="01"
                                    {...field}
                                    onChange={(e) => {
                                      const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                                      field.onChange(v);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        );
                      }
                      return (
                        <FormField
                          key={campo.key}
                          control={form.control}
                          name={`${prefix}${campo.key}`}
                          render={({ field }) => (
                            <FormItem>
                              <Label>{campo.label}</Label>
                              <FormControl>
                                <Input placeholder="" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      );
                    })}
                  </div>
                  <div className="grid gap-3 pt-1 md:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`${prefix}func_toggle`}
                        checked={(form.watch(campoRep(`${prefix}func_toggle`)) as string | undefined) === 'on'}
                        onCheckedChange={(checked) => {
                          form.setValue(campoRep(`${prefix}func_toggle`), checked ? 'on' : 'off', {
                            shouldValidate: false,
                            shouldDirty: true,
                          });
                        }}
                      />
                      <label htmlFor={`${prefix}func_toggle`} className="text-sm font-medium leading-none cursor-pointer">
                        Funcionamento e Eficiência
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`${prefix}coleta_toggle`}
                        checked={(form.watch(campoRep(`${prefix}coleta_toggle`)) as string | undefined) === 'on'}
                        onCheckedChange={(checked) => {
                          form.setValue(campoRep(`${prefix}coleta_toggle`), checked ? 'on' : 'off', {
                            shouldValidate: false,
                            shouldDirty: true,
                          });
                        }}
                      />
                      <label htmlFor={`${prefix}coleta_toggle`} className="text-sm font-medium leading-none cursor-pointer">
                        Coleta de Padrões Balísticos
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNumLinhas((n) => n + 1)}
            >
              <Plus size={14} className="mr-1" /> Adicionar arma
            </Button>
          </div>
        ) : null
      }
    </ToggleSection>
  );
};

export const B602_MENU_STRUCTURE: MenuSection[] = [
  {
    id: 'dados_investigacao',
    label: 'Dados da Investigação',
    items: [
      { type: 'field', name: 'b602_tabela_dados_investigacao', label: 'Tabela completa' },
      { type: 'field', name: 'b602_envolvidos', label: 'Envolvidos (todos)' },
      {
        type: 'group',
        label: 'Envolvidos',
        prefix: 'b602_envolvido_',
        fields: [{ name: '', label: 'Nome do envolvido' }],
      },
      { type: 'field', name: 'b602_data_ocorrencia', label: 'Data da Ocorrência' },
      { type: 'field', name: 'b602_local_bairro', label: 'Bairro' },
      { type: 'field', name: 'b602_local_cidade', label: 'Cidade' },
      { type: 'field', name: 'b602_local_uf', label: 'UF' },
      { type: 'field', name: 'b602_numero_bo', label: 'Nº do BO' },
      { type: 'field', name: 'b602_numero_ip', label: 'Nº do IP' },
      { type: 'field', name: 'b602_solicitante_nome', label: 'Unidade Policial' },
    ],
  },
  {
    id: 'material_enc',
    label: 'Material Encaminhado',
    items: [
      { type: 'field', name: 'b602_tabela_material_enc', label: 'Tabela completa' },
      {
        type: 'group',
        label: 'Item',
        prefix: 'b602_material_enc_',
        fields: [
          { name: 'natureza', label: 'Natureza' },
          { name: 'quantidade', label: 'Quantidade' },
          { name: 'tipo', label: 'Tipo' },
          { name: 'dito_oficio', label: 'Dito do Ofício' },
          { name: 'numero_lacre', label: 'Nº do Lacre' },
        ],
      },
    ],
  },
  {
    id: 'cartuchos',
    label: 'Cartuchos',
    items: [
      { type: 'field', name: 'b602_tabela_cartuchos', label: 'Tabela completa' },
      {
        type: 'group',
        label: 'Cartucho',
        prefix: 'b602_cartucho_',
        fields: [
          { name: 'quantidade', label: 'Quantidade' },
          { name: 'calibre', label: 'Calibre' },
          { name: 'marca', label: 'Marca' },
          { name: 'origem', label: 'Origem' },
          { name: 'espoleta', label: 'Espoleta' },
          { name: 'estojo', label: 'Estojo' },
          { name: 'projetil', label: 'Projétil' },
          { name: 'observacao', label: 'Observação' },
        ],
      },
    ],
  },
  {
    id: 'estojos',
    label: 'Estojos',
    items: [
      { type: 'field', name: 'b602_tabela_estojos', label: 'Tabela completa' },
      {
        type: 'group',
        label: 'Estojo',
        prefix: 'b602_estojo_',
        fields: [
          { name: 'quantidade', label: 'Quantidade' },
          { name: 'calibre', label: 'Calibre' },
          { name: 'marca', label: 'Marca' },
          { name: 'origem', label: 'Origem' },
          { name: 'espoleta', label: 'Espoleta' },
          { name: 'estojo', label: 'Estojo' },
          { name: 'observacao', label: 'Observação' },
        ],
      },
    ],
  },
  {
    id: 'armas',
    label: 'Armas',
    items: [
      { type: 'field', name: 'b602_tabela_armas', label: 'Tabela completa' },
      {
        type: 'group',
        label: 'Arma',
        prefix: 'b602_arma_',
        fields: [
          { name: 'tipo', label: 'Tipo' },
          { name: 'marca', label: 'Marca' },
          { name: 'modelo', label: 'Modelo' },
          { name: 'calibre', label: 'Calibre' },
          { name: 'letra', label: 'Letra' },
          { name: 'numeracao_serie', label: 'Nº Série' },
          { name: 'numeracao_cano', label: 'Nº Cano' },
          { name: 'capacidade_carregador', label: 'Cap. Carregador' },
          { name: 'comprimento_cano', label: 'Compr. Cano' },
          { name: 'acabamento', label: 'Acabamento' },
          { name: 'funcionamento', label: 'Funcionamento' },
          { name: 'estado_conservacao', label: 'Est. Conservação' },
          { name: 'quantidade', label: 'Quantidade' },
          { name: 'dito_oficio', label: 'Dito Ofício' },
          { name: 'numero_lacre', label: 'Nº Lacre' },
        ],
      },
      { type: 'field', name: 'b602_total_material_enc', label: 'Total Material Enc.' },
      { type: 'field', name: 'b602_total_cartuchos', label: 'Total Cartuchos' },
      { type: 'field', name: 'b602_total_estojos', label: 'Total Estojos' },
      { type: 'field', name: 'b602_total_armas', label: 'Total Armas' },
    ],
  },
];
