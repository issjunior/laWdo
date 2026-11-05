import { useContext } from 'react';
import { ContextoConexaoGdl } from '@/contexts/ConexaoGdlContext';

export function useConexaoGdl() {
  const contexto = useContext(ContextoConexaoGdl);
  if (!contexto) throw new Error('O estado do GDL requer ConexaoGdlProvider.');
  return contexto;
}
