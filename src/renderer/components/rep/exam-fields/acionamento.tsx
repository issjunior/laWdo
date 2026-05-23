import React from 'react';
import { FormField, FormItem, FormControl, FormMessage } from '@/components/forms/form';
import { Input } from '@/components/ui/input';
import type { ExamSectionProps } from './types';

const FIELD_PLACEHOLDER_LABEL: Record<string, string> = {
  data_acionamento: 'data_acionamento_local',
  data_chegada: 'data_chegada_local',
  data_saida: 'data_saida_local',
};

const LabelWithPlaceholder: React.FC<{ field: string; children: React.ReactNode; mostrar: boolean }> = ({ field, children, mostrar }) => {
  const chave = FIELD_PLACEHOLDER_LABEL[field];
  if (!mostrar || !chave) {
    return <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{children}</label>;
  }
  return (
    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-help border-b border-dotted border-muted-foreground/50">
      {children}
    </label>
  );
};

export const AcionamentoFields: React.FC<ExamSectionProps> = ({ form, mostrarPlaceholders }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <FormField
      control={form.control}
      name="data_acionamento"
      render={({ field }) => (
        <FormItem>
          <LabelWithPlaceholder field="data_acionamento" mostrar={mostrarPlaceholders}>
            Data/Hora Acionamento
          </LabelWithPlaceholder>
          <FormControl>
            <Input type="datetime-local" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={form.control}
      name="data_chegada"
      render={({ field }) => (
        <FormItem>
          <LabelWithPlaceholder field="data_chegada" mostrar={mostrarPlaceholders}>
            Data/Hora Chegada
          </LabelWithPlaceholder>
          <FormControl>
            <Input type="datetime-local" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={form.control}
      name="data_saida"
      render={({ field }) => (
        <FormItem>
          <LabelWithPlaceholder field="data_saida" mostrar={mostrarPlaceholders}>
            Data/Hora Saída
          </LabelWithPlaceholder>
          <FormControl>
            <Input type="datetime-local" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>
);
