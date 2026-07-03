import React from 'react';
import { Input } from '@/components/ui/input';
import type { CreateSolicitanteInput } from '@/lib/validators/solicitante.schema';

interface SolicitanteFormFieldsProps {
  formData: CreateSolicitanteInput;
  onChange: (data: CreateSolicitanteInput) => void;
  errors?: Partial<Record<keyof CreateSolicitanteInput, string>>;
  error?: string | null;
  success?: string | null;
}

export const SolicitanteFormFields: React.FC<SolicitanteFormFieldsProps> = ({
  formData,
  onChange,
  errors = {},
  error: generalError,
  success,
}) => {
  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <label htmlFor="solicitante-qc-nome" className="text-sm font-medium">
            Solicitante *
          </label>
          <Input
            id="solicitante-qc-nome"
            value={formData.nome}
            onChange={(e) => onChange({ ...formData, nome: e.target.value })}
            placeholder="Ex: Tribunal de Justiça do Paraná"
            className={errors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}
          />
          {errors.nome && (
            <p className="text-xs text-red-600">{errors.nome}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="solicitante-qc-tipo" className="text-sm font-medium">
            Responsável/Contato
          </label>
          <Input
            id="solicitante-qc-tipo"
            value={formData.tipo ?? ''}
            onChange={(e) => onChange({ ...formData, tipo: e.target.value })}
            placeholder="Ex: Vara Criminal, Delegacia, Ministério Público"
            className={errors.tipo ? 'border-red-500 focus-visible:ring-red-500' : ''}
          />
          {errors.tipo && (
            <p className="text-xs text-red-600">{errors.tipo}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="solicitante-qc-endereco" className="text-sm font-medium">
            Endereço
          </label>
          <Input
            id="solicitante-qc-endereco"
            value={formData.endereco ?? ''}
            onChange={(e) => onChange({ ...formData, endereco: e.target.value })}
            placeholder="Endereço completo"
            className={errors.endereco ? 'border-red-500 focus-visible:ring-red-500' : ''}
          />
          {errors.endereco && (
            <p className="text-xs text-red-600">{errors.endereco}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="solicitante-qc-telefone" className="text-sm font-medium">
            Telefone
          </label>
          <Input
            id="solicitante-qc-telefone"
            value={formData.telefone ?? ''}
            onChange={(e) => onChange({ ...formData, telefone: e.target.value })}
            placeholder="(99) 99999-9999"
            className={errors.telefone ? 'border-red-500 focus-visible:ring-red-500' : ''}
          />
          {errors.telefone && (
            <p className="text-xs text-red-600">{errors.telefone}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="solicitante-qc-email" className="text-sm font-medium">
            E-mail
          </label>
          <Input
            id="solicitante-qc-email"
            type="email"
            value={formData.email ?? ''}
            onChange={(e) => onChange({ ...formData, email: e.target.value })}
            placeholder="email@tjpr.jus.br"
            className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
          />
          {errors.email && (
            <p className="text-xs text-red-600">{errors.email}</p>
          )}
        </div>
      </div>

      {generalError && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
          {generalError}
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
