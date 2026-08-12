import { useEffect, useRef } from 'react';

interface UseAtalhoSalvarLaudoParams {
  ativo: boolean;
  bloqueado: boolean;
  onSalvar: () => void;
}

export function useAtalhoSalvarLaudo({
  ativo,
  bloqueado,
  onSalvar,
}: UseAtalhoSalvarLaudoParams) {
  const onSalvarRef = useRef(onSalvar);

  useEffect(() => {
    onSalvarRef.current = onSalvar;
  }, [onSalvar]);

  useEffect(() => {
    const aoPressionarTecla = (evento: KeyboardEvent) => {
      if (!(evento.ctrlKey || evento.metaKey) || evento.key.toLowerCase() !== 's') return;
      evento.preventDefault();
      if (!ativo || bloqueado) return;
      onSalvarRef.current();
    };

    window.addEventListener('keydown', aoPressionarTecla);
    return () => window.removeEventListener('keydown', aoPressionarTecla);
  }, [ativo, bloqueado]);
}
