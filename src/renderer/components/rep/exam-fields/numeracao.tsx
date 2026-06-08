import React from 'react';
import { FormField, FormItem, FormControl, FormMessage } from '@/components/forms/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ExamSectionProps } from './types';

const CORES = [
  'Amarelo', 'Azul', 'Bege', 'Branco', 'Cinza', 'Dourado',
  'Laranja', 'Marrom', 'Preto', 'Prata', 'Rosa', 'Roxo', 'Verde', 'Vermelho',
] as const;

const COR_MAP: Record<string, string> = {
  Amarelo: '#facc15',
  Azul: '#3b82f6',
  Bege: '#d4c5a9',
  Branco: '#ffffff',
  Cinza: '#9ca3af',
  Dourado: '#d4a843',
  Laranja: '#f97316',
  Marrom: '#78350f',
  Preto: '#1c1917',
  Prata: '#c0c0c0',
  Rosa: '#f472b6',
  Roxo: '#7c3aed',
  Verde: '#22c55e',
  Vermelho: '#ef4444',
};

const CONSERVACOES = ['péssimo', 'ruim', 'regular', 'bom'] as const;

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
    {children}
  </label>
);

export const NumeracaoFields: React.FC<ExamSectionProps> = ({ form }) => (
  <div className="space-y-4">
    <FormField
      control={form.control}
      name="numeracao_veiculo"
      render={({ field }) => (
        <FormItem>
          <Label>Veículo *</Label>
          <FormControl>
            <Input placeholder="Marca, modelo ou tipo do veículo" maxLength={25} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="numeracao_placa"
        render={({ field }) => (
          <FormItem>
            <Label>Placa</Label>
            <FormControl>
              <Input placeholder="ABC1234 ou ABC1B23" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="numeracao_fabricacao"
        render={({ field }) => (
          <FormItem>
            <Label>Fabricação/Modelo</Label>
            <FormControl>
              <Input
                placeholder="2020/2021"
                maxLength={9}
                inputMode="numeric"
                value={field.value}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
                  let masked = raw;
                  if (raw.length > 4) {
                    masked = raw.slice(0, 4) + '/' + raw.slice(4);
                  }
                  field.onChange(masked);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="numeracao_cor"
        render={({ field }) => (
          <FormItem>
            <Label>Cor</Label>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a cor..." />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {CORES.map(c => (
                  <SelectItem key={c} value={c}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full border border-border shrink-0"
                        style={{ backgroundColor: COR_MAP[c] }}
                      />
                      {c}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="numeracao_conservacao"
        render={({ field }) => (
          <FormItem>
            <Label>Conservação</Label>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {CONSERVACOES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="numeracao_chassi"
        render={({ field }) => (
          <FormItem>
            <Label>Chassi</Label>
            <FormControl>
              <Input placeholder="Até 17 caracteres alfanuméricos" maxLength={17} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="numeracao_chassi_revelado"
        render={({ field }) => (
          <FormItem>
            <Label>Chassi Revelado</Label>
            <FormControl>
              <Input placeholder="Chassi após revelação química" maxLength={17} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="numeracao_motor"
        render={({ field }) => (
          <FormItem>
            <Label>Motor</Label>
            <FormControl>
              <Input placeholder="Até 15 caracteres alfanuméricos" maxLength={15} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="numeracao_motor_revelado"
        render={({ field }) => (
          <FormItem>
            <Label>Motor Revelado</Label>
            <FormControl>
              <Input placeholder="Motor após revelação química" maxLength={15} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  </div>
);
