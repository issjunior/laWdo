# laWdo

Sistema desktop para auxiliar na confecção de laudos no padrão da **Polícia Científica do Paraná**.

## Finalidade

O laWdo auxilia peritos forenses no preenchimento de laudos, **reduzindo o retrabalho** e **minimizando erros de referência** por meio de templates inteligentes, placeholders dinâmicos e validações automáticas.

## Tecnologias

- [Electron](https://www.electronjs.org/) — aplicativo desktop multiplataforma
- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) — interface do usuário
- [Vite](https://vitejs.dev/) — bundler do renderer
- [SQLite](https://www.sqlite.org/) — banco de dados local
- [Tailwind CSS](https://tailwindcss.com/) + [Shadcn/ui](https://ui.shadcn.com/) — estilização
- [Zod](https://zod.dev/) — validação de dados
- [TinyMCE](https://www.tiny.cloud/) — editor de texto rico
- [AES-256-GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode) + [bcrypt](https://en.wikipedia.org/wiki/Bcrypt) — criptografia de credenciais

## Pré-requisitos

- [Node.js](https://nodejs.org/) versão 18 ou superior
- npm (incluído no Node.js)

## Instalação e Execução

```bash
# 1. Clone o repositório
git clone https://github.com/issjunior/laWdo.git
cd LaudoPericial

# 2. Instale as dependências
npm install

# 3. Execute em modo desenvolvimento
npm run dev
```

O comando `npm run dev` compila o projeto e inicia o aplicativo automaticamente.

Para executar a partir de um build já existente:

```bash
npm start
```

## Desenvolvimento

| Comando | Descrição |
|---------|-----------|
| `npm run build` | Build de produção |
| `npm run dev` | Build de desenvolvimento para sem qualquer otimização (ideal para teste de usabilidade) |
| `npm run watch` | Watch mode (recompilação automática) |
| `npm run lint` | Checagem ESLint |
| `npm run format` | Formatação Prettier |
| `npm run test` | Executa testes com Vitest |
| `npm run type-check` | Verificação de tipos TypeScript |

## Empacotamento

Para gerar o instalador:

```bash
npx electron-builder
```

Os arquivos serão gerados no diretório `dist/`.
