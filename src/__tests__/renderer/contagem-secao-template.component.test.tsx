import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SecaoConfiguracaoTemplate } from '../../renderer/components/template/SecaoConfiguracaoTemplate';
import type { SecaoTemplateEstrutural } from '../../renderer/components/template/secao-configuracao-template.utils';

function ConfiguracaoTeste() {
  const [secao, definirSecao] = useState<SecaoTemplateEstrutural>({ chave_local: 'inicio', nome: 'Introdução' });
  return <SecaoConfiguracaoTemplate
    secao={secao} index={0} total={1} opcoesSecaoPai={[]} opcoesRepeticao={[]} placeholderChaves={[]}
    diagnosticos={[]} podeSubir={false} podeDescer={false} dragHandleProps={{ attributes: {}, listeners: {} }}
    onUpdateSecao={(campo, valor) => definirSecao(atual => ({ ...atual, [campo]: valor }))}
    onMoveSecao={() => {}} onRemoveSecao={() => {}}
  />;
}

describe('escolha da contagem no template', () => {
  it('oferece a contagem ativada ao ocultar e preserva a preferência ao reexibir', () => {
    render(<ConfiguracaoTeste />);
    expect(screen.queryByRole('checkbox', { name: 'Contar esta seção na numeração' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ocultar título no laudo' }));
    expect(screen.getByRole('checkbox', { name: 'Contar esta seção na numeração' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Contar esta seção na numeração' }));
    expect(screen.getByText('Título oculto')).toBeInTheDocument();
    expect(screen.getByText('Fora da numeração')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ocultar título no laudo' }));
    expect(screen.queryByRole('checkbox', { name: 'Contar esta seção na numeração' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ocultar título no laudo' }));
    expect(screen.getByRole('checkbox', { name: 'Contar esta seção na numeração' })).not.toBeChecked();
    expect(screen.getByDisplayValue('Introdução')).toBeInTheDocument();
  });
});
