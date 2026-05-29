import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CreateTipoExameInput } from '@/lib/validators';

interface TipoExameFormFieldsProps {
  formData: CreateTipoExameInput;
  onChange: (data: CreateTipoExameInput) => void;
  error?: string | null;
  success?: string | null;
}

export const TipoExameFormFields: React.FC<TipoExameFormFieldsProps> = ({
  formData,
  onChange,
  error,
  success,
}) => {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <label htmlFor="tipo-exame-qc-codigo" className="text-sm font-medium">
          Código do exame no GDL *
        </label>
        <Input
          id="tipo-exame-qc-codigo"
          value={formData.codigo}
          onChange={(e) => onChange({ ...formData, codigo: e.target.value })}
          placeholder="Ex: DNA, BAL, LOC..."
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="tipo-exame-qc-nome" className="text-sm font-medium">
          Nome do tipo de exame *
        </label>
        <Input
          id="tipo-exame-qc-nome"
          value={formData.nome}
          onChange={(e) => onChange({ ...formData, nome: e.target.value })}
          placeholder="Ex: Exame de DNA, Perícia Balística..."
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="tipo-exame-qc-descricao" className="text-sm font-medium">
          Descrição do exame
        </label>
        <Textarea
          id="tipo-exame-qc-descricao"
          value={formData.descricao ?? ''}
          onChange={(e) => onChange({ ...formData, descricao: e.target.value })}
          placeholder="Descrição detalhada do tipo de exame..."
          rows={4}
        />
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
          {success}
        </div>
      )}
    </div>
  );
};
