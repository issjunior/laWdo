import React from 'react';
import { FormField, FormItem, FormControl, FormMessage } from '@/components/forms/form';
import { Input } from '@/components/ui/input';
import type { ExamSectionProps } from './types';

const FIELD_PLACEHOLDER_LABEL: Record<string, string> = {
  local_fato: 'local_fato',
  latitude: 'latitude',
  longitude: 'longitude',
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

export const LocalFatoFields: React.FC<ExamSectionProps> = ({ form, mostrarPlaceholders }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div className="md:col-span-2">
      <FormField
        control={form.control}
        name="local_fato"
        render={({ field }) => (
          <FormItem>
            <LabelWithPlaceholder field="local_fato" mostrar={mostrarPlaceholders}>
              Local do Fato
            </LabelWithPlaceholder>
            <FormControl>
              <Input placeholder="Descrição do local" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
    <FormField
      control={form.control}
      name="latitude"
      render={({ field }) => (
        <FormItem>
          <LabelWithPlaceholder field="latitude" mostrar={mostrarPlaceholders}>
            Latitude
          </LabelWithPlaceholder>
          <FormControl>
            <Input type="number" step="any" placeholder="-25.4284" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={form.control}
      name="longitude"
      render={({ field }) => (
        <FormItem>
          <LabelWithPlaceholder field="longitude" mostrar={mostrarPlaceholders}>
            Longitude
          </LabelWithPlaceholder>
          <FormControl>
            <Input type="number" step="any" placeholder="-49.2674" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>
);
