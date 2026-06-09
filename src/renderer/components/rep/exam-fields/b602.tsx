import React, { useState } from 'react';
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
import { Plus, X } from 'lucide-react';
import type { ExamSectionProps } from './types';

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
    {children}
  </label>
);

const NATUREZA_OPTS = ['Arma', 'Munição', 'Acessório'] as const;
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
const OBS_ESTOJO_OPTS = ['Intacto', 'NTA', 'Picotado', 'Percutido', 'Não deflagrado'] as const;

function formatarNumeroBO(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return digits;
  const year = digits.slice(0, 4);
  const num = digits.slice(4, 10);
  return `${year}/${num}`;
}

export const DadosInvestigacaoFields: React.FC<ExamSectionProps> = ({ form }) => {
  const [numEnvolvidos, setNumEnvolvidos] = useState(1);

  const envolvidos = Array.from({ length: numEnvolvidos }, (_, i) => i);

  return (
    <div className="space-y-4">
      <div>
        <Label>Envolvido(s) *</Label>
        <div className="space-y-2 mt-1">
          {envolvidos.map((i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
              <FormField
                control={form.control}
                name={`b602_envolvidos_${i}`}
                render={({ field }) => (
                  <FormItem className="flex-1">
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
            </div>
          ))}
        </div>
        {numEnvolvidos < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setNumEnvolvidos((n) => n + 1)}
          >
            <Plus size={14} className="mr-1" /> Adicionar envolvido
          </Button>
        )}
      </div>

      <FormField
        control={form.control}
        name="b602_data_ocorrencia"
        render={({ field }) => (
          <FormItem>
            <Label>Data da Ocorrência *</Label>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="b602_local"
        render={({ field }) => (
          <FormItem>
            <Label>Local *</Label>
            <FormControl>
              <Input placeholder="bairro / cidade / PR" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="b602_numero_bo"
          render={({ field }) => (
            <FormItem>
              <Label>Nº do BO</Label>
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
        <FormField
          control={form.control}
          name="b602_numero_ip"
          render={({ field }) => (
            <FormItem>
              <Label>Nº do IP</Label>
              <FormControl>
                <Input placeholder="Inquérito Policial" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="b602_solicitante_nome"
        render={({ field }) => (
          <FormItem>
            <Label>Solicitante *</Label>
            <FormControl>
              <Input placeholder="Nome que consta no documento" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
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
  const toggleValue = form.watch(toggleName as any) as string | undefined;
  const active = toggleValue === 'on';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Checkbox
          id={toggleName}
          checked={active}
          onCheckedChange={(checked) => {
            form.setValue(toggleName as any, checked ? 'on' : 'off', {
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
  const [numLinhas, setNumLinhas] = useState(1);

  const toggleValue = form.watch('b602_material_enc_toggle' as any) as string | undefined;
  const active = toggleValue === 'on';

  return (
    <ToggleSection form={form} toggleName="b602_material_enc_toggle" label="Possui Material Encaminhado?">
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
                      onClick={() => {
                        const prefix = `b602_material_enc_${i}_`;
                        ['natureza', 'quantidade', 'tipo', 'dito_oficio', 'numero_lacre'].forEach((f) =>
                          form.setValue(`${prefix}${f}` as any, '')
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
                    name={`b602_material_enc_${i}_natureza`}
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
                    name={`b602_material_enc_${i}_quantidade`}
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
                    name={`b602_material_enc_${i}_tipo`}
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
                    name={`b602_material_enc_${i}_dito_oficio`}
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
                    name={`b602_material_enc_${i}_numero_lacre`}
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

function LinhaTabelaBalistica({
  form,
  prefix,
  showProjetil,
}: {
  form: ExamSectionProps['form'];
  prefix: string;
  showProjetil: boolean;
}) {
  const obsValue = (form.watch(`${prefix}_observacao` as any) as string) || '';
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
  const [numLinhas, setNumLinhas] = useState(1);

  const toggleValue = form.watch('b602_cartuchos_toggle' as any) as string | undefined;
  const active = toggleValue === 'on';

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
  const [numLinhas, setNumLinhas] = useState(1);

  const toggleValue = form.watch('b602_estojos_toggle' as any) as string | undefined;
  const active = toggleValue === 'on';

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
