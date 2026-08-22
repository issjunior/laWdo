import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface PainelIaErrorBoundaryProps {
  children: ReactNode;
}

interface PainelIaErrorBoundaryState {
  erro: Error | null;
}

export class PainelIaErrorBoundary extends Component<PainelIaErrorBoundaryProps, PainelIaErrorBoundaryState> {
  state: PainelIaErrorBoundaryState = { erro: null };

  static getDerivedStateFromError(erro: Error): PainelIaErrorBoundaryState {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo): void {
    console.error('[painel-ia] Falha isolada no painel', { mensagem: erro.message, componente: info.componentStack });
  }

  render(): ReactNode {
    if (!this.state.erro) return this.props.children;
    return (
      <section className="flex h-full min-h-48 flex-col items-start justify-center gap-3 p-5" role="alert">
        <h2 className="text-sm font-semibold">O painel de IA encontrou um problema</h2>
        <p className="text-sm text-muted-foreground">O editor e o conteúdo do laudo continuam disponíveis.</p>
        <Button type="button" variant="outline" onClick={() => this.setState({ erro: null })}>Tentar novamente</Button>
      </section>
    );
  }
}
