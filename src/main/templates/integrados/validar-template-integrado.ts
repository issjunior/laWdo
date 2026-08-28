import type { DefinicaoTemplateIntegrado } from './tipos.js';

export function validarTemplateIntegrado(template: DefinicaoTemplateIntegrado): void {
  if (!template.chave.trim()) throw new Error('Template integrado sem chave');
  if (!Number.isInteger(template.versao) || template.versao < 1) throw new Error(`Versão inválida do template ${template.chave}`);
  if (template.versaoFormato !== 1) throw new Error(`Formato não suportado do template ${template.chave}`);
  if (!template.nome.trim() || !template.tipoExame.codigo.trim() || !template.tipoExame.nome.trim()) {
    throw new Error(`Metadados obrigatórios ausentes no template ${template.chave}`);
  }
  if (!template.secoes.length) throw new Error(`Template integrado ${template.chave} não possui seções`);

  const chaves = new Set<string>();
  const ordens = new Set<number>();
  for (const secao of template.secoes) {
    if (!secao.chave.trim() || chaves.has(secao.chave)) throw new Error(`Chave de seção inválida em ${template.chave}`);
    if (!secao.nome.trim() || !secao.conteudo.trim()) throw new Error(`Seção incompleta em ${template.chave}`);
    if (!Number.isInteger(secao.ordem) || secao.ordem < 0 || ordens.has(secao.ordem)) throw new Error(`Ordem inválida em ${template.chave}`);
    chaves.add(secao.chave);
    ordens.add(secao.ordem);
  }
  for (const secao of template.secoes) {
    if (secao.chavePai && !chaves.has(secao.chavePai)) throw new Error(`Seção pai inexistente em ${template.chave}`);
    if (secao.chavePai === secao.chave) throw new Error(`Seção não pode ser pai de si mesma em ${template.chave}`);
  }
}
