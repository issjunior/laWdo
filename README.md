# laWdo

Aplicação desktop para elaboração de laudos periciais.

## Principais recursos

- Gestão local de REPs, laudos, templates, peças, placeholders e ilustrações.
- Editor TinyMCE com modos de documento único ou por seções, histórico de versões e exportação em PDF, DOCX e ODT.
- Assistente IA com Groq e Gemini em dock redimensionável ou janela destacada, aplicação revisável, processamento sequencial de laudos grandes e descrição segura de imagens persistidas.
- Operação offline-first com SQLite, backup local, logs de auditoria e integração opcional com o GDL.

## Acesse

- [Página oficial do laWdo](https://issjunior.github.io/laWdo/) — apresentação e informações do sistema.
- [Downloads e notas de atualização](https://github.com/issjunior/laWdo/releases) — instaladores e histórico de versões.

## Stack

- **Desktop:** Electron
- **Interface:** React, TypeScript e Vite
- **UI:** Tailwind CSS, shadcn/ui, Radix UI e Lucide
- **Formulários e validação:** React Hook Form e Zod
- **Editor:** TinyMCE
- **Dados locais:** SQLite
- **Testes:** Vitest e Testing Library
- **Build e distribuição:** Electron Builder e GitHub Actions
- **Runtime de desenvolvimento:** Node.js 24+
