import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { chaveRepReiteracao } from '@shared/gdl/reiteracao';
import { TooltipProvider } from '@/components/ui/tooltip';

const ContextoAvisos = createContext<ReadonlySet<string>>(new Set());
const esquemaAvisos = z.array(z.object({
  numero: z.string().regex(/^\d+$/), ano: z.string().regex(/^\d{4}$/), reiterando: z.boolean(),
  fonte: z.enum(['html', 'api']), consultadoEm: z.string().datetime(),
}));

export function AvisosReiteracaoProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    let ativo = true;
    let revisao = 0;
    const atualizar = (reiniciar = false) => {
      const atual = ++revisao;
      if (reiniciar) setAvisos(new Set());
      void window.ipcAPI.gdl.obterAvisosReiteracao().then(resposta => {
        if (!ativo || atual !== revisao || !resposta.success) return;
        const validacao = esquemaAvisos.safeParse(resposta.data);
        if (!validacao.success) return;
        const chaves = validacao.data.filter(aviso => aviso.reiterando)
          .map(aviso => chaveRepReiteracao(`${aviso.numero}/${aviso.ano}`))
          .filter((chave): chave is string => chave !== null);
        setAvisos(new Set(chaves));
      }).catch(() => undefined);
    };
    const remover = window.ipcAPI.gdl.onAvisosAlterados(atualizar);
    const aoFocar = () => atualizar();
    window.addEventListener('focus', aoFocar);
    atualizar();
    return () => { ativo = false; revisao += 1; remover(); window.removeEventListener('focus', aoFocar); };
  }, []);
  return <ContextoAvisos.Provider value={avisos}><TooltipProvider>{children}</TooltipProvider></ContextoAvisos.Provider>;
}

export function useConsultarRepReiterando() {
  const avisos = useContext(ContextoAvisos);
  return useCallback((numero: string): boolean => {
    const chave = chaveRepReiteracao(numero);
    return chave !== null && avisos.has(chave);
  }, [avisos]);
}

export function useRepReiterando(numero: string): boolean {
  return useConsultarRepReiterando()(numero);
}
